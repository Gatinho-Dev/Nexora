import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as cookie from "cookie";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { nanoid } from "nanoid";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { signSessionToken } from "./auth/token";
import {
  createSession,
  currentSessionIdFromCookie,
  listActiveSessions,
  revokeAllOthers,
  revokeSession,
} from "./auth/sessions";
import { getClientIp } from "./lib/ip";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";
import { rateLimit } from "./utils/rateLimit";
import { toPublicUser } from "./utils/permissions";
import { recordEvent } from "./services/badgeService";
import { moderatePublicFieldAsync } from "./services/profileModeration";
import { logSafetyEvent } from "./services/safetyAudit";
import { kickSession } from "./realtime";

// ── Password hashing (scrypt, no native deps) ─────────────────
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

const usernameSchema = z
  .string()
  .min(3, "O nome de usuário precisa de pelo menos 3 caracteres.")
  .max(32, "O nome de usuário pode ter no máximo 32 caracteres.")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Use apenas letras, números, ponto, hífen e sublinhado.");

const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Escolha uma cor hexadecimal válida.");

const profileGameSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  imageUrl: z.string().max(500).nullable().optional(),
});

async function issueSession(
  ctx: { req: Request; resHeaders: Headers },
  user: { id: number; unionId: string },
) {
  const sid = nanoid(24);
  const token = await signSessionToken({
    unionId: user.unionId,
    clientId: "nexora",
    sid,
  });
  const created = await createSession({
    userId: user.id,
    sid,
    token,
    userAgent: ctx.req.headers.get("user-agent"),
    secChUa: ctx.req.headers.get("sec-ch-ua"),
    ip: getClientIp(ctx.req.headers),
  });
  void logSafetyEvent({
    event: "login_success",
    actorUserId: user.id,
    targetUserId: user.id,
    metadata: { sessionId: created.sid },
  }).catch(() => {});
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

async function findByUsername(username: string) {
  return getDb().query.users.findFirst({
    where: eq(schema.users.username, username),
  });
}

export const accountRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        username: usernameSchema,
        displayName: z.string().min(1, "Informe um nome de exibição.").max(64),
        password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres.").max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`register:${ctx.req.headers.get("x-forwarded-for") ?? "unknown"}`, 10, 60_000);

      const existing = await findByUsername(input.username);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este nome de usuário já está em uso.",
        });
      }

      const unionId = `local:${nanoid(16)}`;
      const now = new Date();
      const [{ id }] = await getDb()
        .insert(schema.users)
        .values({
          unionId,
          username: input.username,
          passwordHash: hashPassword(input.password),
          name: input.displayName,
          status: "online",
          lastSignInAt: now,
        })
        .$returningId();

      await issueSession(ctx, { id, unionId });
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, id),
      });
      // Badge "I'm new here, say hi!" — concessão automática (7 dias).
      void recordEvent("USER_CREATED", id, { username: input.username }).catch(
        () => {},
      );
      return { user: user ? toPublicUser(user) : null };
    }),

  login: publicQuery
    .input(
      z.object({
        username: z.string().min(1, "Informe o nome de usuário."),
        password: z.string().min(1, "Informe a senha."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req.headers) ?? "unknown";
      // Anti brute-force: por usuário e por IP.
      rateLimit(`login:${input.username.toLowerCase()}`, 10, 60_000);
      rateLimit(`login-ip:${ip}`, 20, 60_000);

      const user = await findByUsername(input.username);
      if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
        void logSafetyEvent({
          event: "login_failed",
          targetUserId: user?.id ?? null,
          metadata: { ip },
        }).catch(() => {});
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuário ou senha incorretos.",
        });
      }

      await getDb()
        .update(schema.users)
        .set({ lastSignInAt: new Date(), status: "online" })
        .where(eq(schema.users.id, user.id));

      await issueSession(ctx, user);
      return { user: toPublicUser(user) };
    }),

  /** Disponibilidade de username para o cadastro (feedback em tempo real). */
  checkUsername: publicQuery
    .input(z.object({ username: usernameSchema }))
    .query(async ({ input }) => {
      rateLimit(`checkUsername:${input.username.toLowerCase()}`, 30, 60_000);
      const RESERVED = new Set([
        "admin", "nexora", "suporte", "support", "moderacao", "moderation",
        "oficial", "official", "staff", "sistema", "system", "login", "register",
      ]);
      if (RESERVED.has(input.username.toLowerCase())) {
        return { available: false, reason: "Este nome é reservado." };
      }
      const existing = await findByUsername(input.username);
      return existing
        ? { available: false, reason: "Este nome já está em uso." }
        : { available: true, reason: null };
    }),

  // ── Dispositivos e sessões ───────────────────────────────────
  sessionsList: authedQuery.query(async ({ ctx }) => {
    const rows = await listActiveSessions(ctx.user.id);
    const current = await currentSessionIdFromCookie(
      ctx.req.headers.get("cookie")
    );
    return rows.map(r => ({ ...r, isCurrent: r.id === current }));
  }),

  sessionRevoke: authedQuery
    .input(z.object({ sessionId: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`sessionRevoke:${ctx.user.id}`, 10, 60_000);
      // Ownership validado dentro de revokeSession (userId na cláusula).
      const ok = await revokeSession(input.sessionId, ctx.user.id);
      if (!ok) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sessão não encontrada ou já encerrada.",
        });
      }
      kickSession(input.sessionId);
      return { ok: true };
    }),

  sessionRevokeOthers: authedQuery.mutation(async ({ ctx }) => {
    rateLimit(`sessionRevokeAll:${ctx.user.id}`, 5, 60_000);
    const current = await currentSessionIdFromCookie(ctx.req.headers.get("cookie"));
    if (!current) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Sessão atual inválida.",
      });
    }
    const revokedIds = await revokeAllOthers(ctx.user.id, current);
    for (const sid of revokedIds) kickSession(sid);
    return { ok: true, revoked: revokedIds.length };
  }),

  updateProfile: authedQuery
    .input(
      z.object({
        displayName: z.string().min(1).max(64).optional(),
        bio: z.string().max(500).optional(),
        avatar: z.string().max(500).optional(),
        banner: z.string().max(500).optional(),
        customStatus: z.string().max(128).optional(),
        profileTheme: z.enum(["cobalt", "rose", "mint", "sunset", "midnight"]).optional(),
        profileAccent: colorSchema.optional(),
        nameFont: z.enum(["sans", "serif", "rounded", "mono", "display", "handwritten"]).optional(),
        nameEffect: z.enum(["solid", "gradient", "neon", "outline", "pop", "prism"]).optional(),
        nameColorA: colorSchema.optional(),
        nameColorB: colorSchema.optional(),
        avatarDecoration: z.enum(["none", "sparkles", "crown", "orbit"]).optional(),
        profileEffect: z.enum(["none", "aurora", "stardust", "bubbles"]).optional(),
        profileGames: z.array(profileGameSchema).max(20).optional(),
        profileWishlist: z.array(profileGameSchema).max(20).optional(),
        profileWidgets: z.array(z.enum(["games", "favorite", "connections", "activity"])).max(4).optional(),
        favoriteGameId: z.string().max(64).nullable().optional(),
        favoriteGameNote: z.string().max(240).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: Partial<typeof schema.users.$inferInsert> = {};
      if (input.displayName !== undefined) patch.name = input.displayName;
      if (input.bio !== undefined) patch.bio = input.bio;
      if (input.avatar !== undefined) patch.avatar = input.avatar;
      if (input.banner !== undefined) patch.banner = input.banner;
      if (input.customStatus !== undefined) patch.customStatus = input.customStatus || null;
      if (input.profileTheme !== undefined) patch.profileTheme = input.profileTheme;
      if (input.profileAccent !== undefined) patch.profileAccent = input.profileAccent;
      if (input.nameFont !== undefined) patch.nameFont = input.nameFont;
      if (input.nameEffect !== undefined) patch.nameEffect = input.nameEffect;
      if (input.nameColorA !== undefined) patch.nameColorA = input.nameColorA;
      if (input.nameColorB !== undefined) patch.nameColorB = input.nameColorB;
      if (input.avatarDecoration !== undefined) patch.avatarDecoration = input.avatarDecoration;
      if (input.profileEffect !== undefined) patch.profileEffect = input.profileEffect;
      if (input.profileGames !== undefined) patch.profileGames = input.profileGames;
      if (input.profileWishlist !== undefined) patch.profileWishlist = input.profileWishlist;
      if (input.profileWidgets !== undefined) patch.profileWidgets = input.profileWidgets;
      if (input.favoriteGameId !== undefined) patch.favoriteGameId = input.favoriteGameId;
      if (input.favoriteGameNote !== undefined) patch.favoriteGameNote = input.favoriteGameNote || null;
      if (Object.keys(patch).length === 0) return { user: toPublicUser(ctx.user) };

      await getDb()
        .update(schema.users)
        .set(patch)
        .where(eq(schema.users.id, ctx.user.id));
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
      });
      // Segurança: campos públicos passam por análise assíncrona (sem bloquear).
      if (patch.name) moderatePublicFieldAsync("profile_name", patch.name, ctx.user.id);
      if (patch.bio) moderatePublicFieldAsync("profile_bio", patch.bio, ctx.user.id);
      return { user: user ? toPublicUser(user) : null };
    }),

  setUsername: authedQuery
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await findByUsername(input.username);
      if (existing && existing.id !== ctx.user.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este nome de usuário já está em uso.",
        });
      }
      await getDb()
        .update(schema.users)
        .set({ username: input.username })
        .where(eq(schema.users.id, ctx.user.id));
      moderatePublicFieldAsync("profile_username", input.username, ctx.user.id);
      return { ok: true };
    }),

  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: z.string().min(1, "Informe a senha atual."),
        newPassword: z.string().min(6, "A nova senha precisa de pelo menos 6 caracteres.").max(128),
        disconnectOthers: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta conta usa login externo e não possui senha local.",
        });
      }
      if (!verifyPassword(input.currentPassword, ctx.user.passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "A senha atual está incorreta.",
        });
      }
      await getDb()
        .update(schema.users)
        .set({ passwordHash: hashPassword(input.newPassword) })
        .where(eq(schema.users.id, ctx.user.id));
      void logSafetyEvent({
        event: "password_changed",
        actorUserId: ctx.user.id,
        targetUserId: ctx.user.id,
      }).catch(() => {});

      let revokedOthers = 0;
      if (input.disconnectOthers) {
        const current = await currentSessionIdFromCookie(
          ctx.req.headers.get("cookie")
        );
        if (current) {
          const revokedIds = await revokeAllOthers(ctx.user.id, current);
          for (const sid of revokedIds) kickSession(sid);
          revokedOthers = revokedIds.length;
        }
      }
      return { ok: true, revokedOthers };
    }),

  getPublicUser: authedQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, input.userId),
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      return toPublicUser(user);
    }),

  // ── Privacidade ──────────────────────────────────────────────
  privacy: authedQuery.query(async ({ ctx }) => {
    const [row] = await getDb()
      .select({ readReceipts: schema.users.readReceipts })
      .from(schema.users)
      .where(eq(schema.users.id, ctx.user.id));
    return { readReceipts: row?.readReceipts ?? true };
  }),

  setPrivacy: authedQuery
    .input(
      z.object({
        readReceipts: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: Partial<typeof schema.users.$inferInsert> = {};
      if (input.readReceipts !== undefined) patch.readReceipts = input.readReceipts;
      if (Object.keys(patch).length === 0) return { ok: true };
      await getDb()
        .update(schema.users)
        .set(patch)
        .where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),
});
