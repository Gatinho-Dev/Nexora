import { z } from "zod";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
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
  revokeAllSessions,
  revokeSession,
} from "./auth/sessions";
import { getClientIp } from "./lib/ip";
import { getSessionCookieOptions } from "./lib/cookies";
import { parseUserAgent } from "./auth/userAgent";
import { Session } from "@contracts/constants";
import { rateLimit } from "./utils/rateLimit";
import { toPublicUser } from "./utils/permissions";
import { recordEvent } from "./services/badgeService";
import { moderatePublicFieldAsync } from "./services/profileModeration";
import { logSafetyEvent } from "./services/safetyAudit";
import { kickSession } from "./realtime";
import {
  consumeEmailToken,
  hashEmail,
  issueEmailToken,
  normalizeEmail,
} from "./services/emailTokens";
import {
  emailChangeTemplate,
  emailChangedAlertTemplate,
  emailVerificationTemplate,
  loginAlertTemplate,
  passwordResetTemplate,
  sendTransactionalEmail,
} from "./services/email";
import { assertTotpOrBackup } from "./services/secondFactor";

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

const emailSchema = z
  .string()
  .trim()
  .max(320, "O e-mail precisa ter no máximo 320 caracteres.")
  .email("Informe um e-mail válido.")
  .transform(normalizeEmail);

const optionalEmailSchema = z
  .union([z.literal(""), emailSchema])
  .transform(value => (value ? value : undefined));

const GENERIC_LOGIN_ERROR =
  "Nome de usuário/e-mail ou senha incorretos.";
const GENERIC_EMAIL_REQUEST_MESSAGE =
  "Se houver uma conta associada a esse endereço, você receberá um e-mail com as instruções.";
const GENERIC_EMAIL_ACTION_ERROR =
  "Este link expirou ou já foi utilizado. Solicite um novo link para continuar.";

const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Escolha uma cor hexadecimal válida.");

const profileGameSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  imageUrl: z.string().max(500).nullable().optional(),
});

export async function issueSession(
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
  void securityEvent({
    userId: user.id,
    type: "login",
    device: created.parsed.deviceType,
    browser: created.parsed.browser,
    os: created.parsed.os,
  });
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

async function findByIdentifier(identifier: string) {
  const value = identifier.trim();
  if (!value.includes("@")) return findByUsername(value);
  const normalized = normalizeEmail(value);
  return getDb().query.users.findFirst({
    where: or(
      eq(schema.users.emailHash, hashEmail(normalized)),
      // Compatibilidade com contas antigas que ainda não possuem emailHash.
      sql`LOWER(TRIM(${schema.users.email})) = ${normalized}`,
    ),
  });
}

function securityEvent(input: {
  userId: number;
  type: string;
  severity?: "info" | "warning" | "critical";
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  partialIp?: string | null;
}) {
  return getDb()
    .insert(schema.securityEvents)
    .values({
      userId: input.userId,
      type: input.type,
      severity: input.severity ?? "info",
      device: input.device ?? null,
      browser: input.browser ?? null,
      os: input.os ?? null,
      partialIp: input.partialIp ?? null,
    })
    .catch(() => {});
}

export const accountRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        username: usernameSchema,
        displayName: z.string().min(1, "Informe um nome de exibição.").max(64),
        password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres.").max(128),
        email: optionalEmailSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(
        `register:${ctx.req.headers.get("x-forwarded-for") ?? "unknown"}`,
        10,
        60_000,
      );

      const existing = await findByUsername(input.username);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este nome de usuário já está em uso.",
        });
      }
      if (input.email) {
        const emailOwner = await getDb().query.users.findFirst({
          where: eq(schema.users.emailHash, hashEmail(input.email)),
        });
        if (emailOwner) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este e-mail já está associado a outra conta.",
          });
        }
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
          email: input.email ?? null,
          emailHash: input.email ? hashEmail(input.email) : null,
          emailVerifiedAt: null,
          status: "online",
          lastSignInAt: now,
        })
        .$returningId();

      await issueSession(ctx, { id, unionId });
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, id),
      });
      if (input.email) {
        try {
          const token = await issueEmailToken({
            userId: id,
            purpose: "verify_email",
            targetEmail: input.email,
          });
          void sendTransactionalEmail({
            to: input.email,
            template: emailVerificationTemplate({ email: input.email, token }),
          });
        } catch (error) {
          // A conta não depende do provedor de e-mail para ser criada.
          console.error(
            "[email] verification setup failed",
            error instanceof Error ? error.message : "unknown error",
          );
        }
      }
      // Badge "I'm new here, say hi!" — concessão automática (7 dias).
      void recordEvent("USER_CREATED", id, { username: input.username }).catch(
        () => {},
      );
      return {
        user: user ? toPublicUser(user) : null,
        emailVerificationRequired: Boolean(input.email),
      };
    }),

  login: publicQuery
    .input(
      z.object({
        identifier: z.string().trim().min(1, "Informe seu usuário ou e-mail.").max(320),
        password: z.string().min(1, "Informe a senha."),
        code: z.string().trim().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req.headers) ?? "unknown";
      const identifierKey = hashEmail(input.identifier);
      rateLimit(`login:${identifierKey}`, 10, 60_000);
      rateLimit(`login-ip:${ip}`, 20, 60_000);

      const user = await findByIdentifier(input.identifier);
      if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
        void logSafetyEvent({
          event: "login_failed",
          targetUserId: user?.id ?? null,
          metadata: { ip },
        }).catch(() => {});
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: GENERIC_LOGIN_ERROR,
        });
      }

      const mfa = await getDb().query.totpSettings.findFirst({
        where: and(
          eq(schema.totpSettings.userId, user.id),
          eq(schema.totpSettings.enabled, true),
        ),
      });
      if (mfa) {
        if (!input.code) return { requiresTwoFactor: true, user: null };
        try {
          await assertTotpOrBackup(user.id, input.code);
        } catch {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Código de autenticação inválido ou já utilizado.",
          });
        }
      }

      await getDb()
        .update(schema.users)
        .set({ lastSignInAt: new Date(), status: "online" })
        .where(eq(schema.users.id, user.id));

      await issueSession(ctx, user);
      if (user.email && user.emailVerifiedAt && user.username) {
        const parsed = parseUserAgent(
          ctx.req.headers.get("user-agent") ?? "",
          ctx.req.headers.get("sec-ch-ua"),
        );
        void sendTransactionalEmail({
          to: user.email,
          template: loginAlertTemplate({
            username: user.username,
            browser: parsed.browser,
            os: parsed.os,
            dateLabel: new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date()),
          }),
        });
      }
      return { requiresTwoFactor: false, user: toPublicUser(user) };
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

  requestPasswordReset: publicQuery
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req.headers) ?? "unknown";
      rateLimit(`password-reset-request:${hashEmail(input.email)}`, 5, 15 * 60_000);
      rateLimit(`password-reset-ip:${ip}`, 10, 15 * 60_000);
      const user = await findByIdentifier(input.email);
      if (user?.email) {
        try {
          const token = await issueEmailToken({
            userId: user.id,
            purpose: "password_reset",
          });
          void sendTransactionalEmail({
            to: user.email,
            template: passwordResetTemplate({ token }),
          });
        } catch (error) {
          console.error(
            "[email] password reset setup failed",
            error instanceof Error ? error.message : "unknown error",
          );
        }
      }
      // A resposta é idéntica exista ou não uma conta, evitando enumeração.
      return { accepted: true, message: GENERIC_EMAIL_REQUEST_MESSAGE };
    }),

  resetPassword: publicQuery
    .input(
      z.object({
        token: z.string().min(32).max(128),
        password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres.").max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req.headers) ?? "unknown";
      rateLimit(`password-reset:${ip}`, 10, 15 * 60_000);
      const row = await consumeEmailToken(input.token, "password_reset");
      if (!row) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: GENERIC_EMAIL_ACTION_ERROR,
        });
      }
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, row.userId),
      });
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: GENERIC_EMAIL_ACTION_ERROR,
        });
      }
      await getDb()
        .update(schema.users)
        .set({ passwordHash: hashPassword(input.password) })
        .where(eq(schema.users.id, user.id));
      await revokeAllSessions(user.id);
      void securityEvent({
        userId: user.id,
        type: "password_reset",
        severity: "warning",
      });
      return { success: true };
    }),

  verifyEmail: publicQuery
    .input(z.object({ token: z.string().min(32).max(128) }))
    .mutation(async ({ input }) => {
      const row =
        (await consumeEmailToken(input.token, "verify_email")) ??
        (await consumeEmailToken(input.token, "email_change"));
      if (!row) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: GENERIC_EMAIL_ACTION_ERROR,
        });
      }
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, row.userId),
      });
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: GENERIC_EMAIL_ACTION_ERROR,
        });
      }

      const nextEmail = row.purpose === "email_change" ? row.targetEmail : user.email;
      if (!nextEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: GENERIC_EMAIL_ACTION_ERROR,
        });
      }
      if (row.purpose === "email_change") {
        const owner = await getDb().query.users.findFirst({
          where: eq(schema.users.emailHash, hashEmail(nextEmail)),
        });
        if (owner && owner.id !== user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este e-mail já está associado a outra conta.",
          });
        }
      }

      const oldEmail = user.email;
      await getDb()
        .update(schema.users)
        .set({
          email: nextEmail,
          emailHash: hashEmail(nextEmail),
          emailVerifiedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));
      void securityEvent({
        userId: user.id,
        type: row.purpose === "email_change" ? "email_changed" : "email_verified",
        severity: row.purpose === "email_change" ? "warning" : "info",
      });
      if (row.purpose === "email_change" && oldEmail && oldEmail !== nextEmail) {
        void sendTransactionalEmail({
          to: oldEmail,
          template: emailChangedAlertTemplate({ email: oldEmail }),
        });
      }
      return { success: true, kind: row.purpose };
    }),

  resendVerification: authedQuery.mutation(async ({ ctx }) => {
    if (ctx.user.email && !ctx.user.emailVerifiedAt) {
      try {
        const token = await issueEmailToken({
          userId: ctx.user.id,
          purpose: "verify_email",
          targetEmail: ctx.user.email,
        });
        void sendTransactionalEmail({
          to: ctx.user.email,
          template: emailVerificationTemplate({ email: ctx.user.email, token }),
        });
      } catch (error) {
        console.error(
          "[email] verification resend failed",
          error instanceof Error ? error.message : "unknown error",
        );
      }
    }
    return { accepted: true };
  }),

  emailStatus: authedQuery.query(async ({ ctx }) => {
    const pending = await getDb().query.emailActionTokens.findFirst({
      where: and(
        eq(schema.emailActionTokens.userId, ctx.user.id),
        eq(schema.emailActionTokens.purpose, "email_change"),
        isNull(schema.emailActionTokens.consumedAt),
      ),
      orderBy: desc(schema.emailActionTokens.createdAt),
    });
    return {
      email: ctx.user.email,
      verified: Boolean(ctx.user.emailVerifiedAt),
      pendingEmail: pending?.targetEmail ?? null,
    };
  }),

  requestEmailChange: authedQuery
    .input(
      z.object({
        email: emailSchema,
        currentPassword: z.string().min(1, "Informe a senha atual.").max(128),
        code: z.string().trim().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit(`email-change:${ctx.user.id}`, 5, 15 * 60_000);
      if (
        !ctx.user.passwordHash ||
        !verifyPassword(input.currentPassword, ctx.user.passwordHash)
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "A senha atual está incorreta.",
        });
      }
      const mfa = await getDb().query.totpSettings.findFirst({
        where: and(
          eq(schema.totpSettings.userId, ctx.user.id),
          eq(schema.totpSettings.enabled, true),
        ),
      });
      if (mfa) await assertTotpOrBackup(ctx.user.id, input.code ?? "");
      if (ctx.user.emailHash === hashEmail(input.email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escolha um e-mail diferente do atual.",
        });
      }
      const owner = await getDb().query.users.findFirst({
        where: eq(schema.users.emailHash, hashEmail(input.email)),
      });
      if (owner) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este e-mail já está associado a outra conta.",
        });
      }
      try {
        const token = await issueEmailToken({
          userId: ctx.user.id,
          purpose: "email_change",
          targetEmail: input.email,
        });
        void sendTransactionalEmail({
          to: input.email,
          template: emailChangeTemplate({ token }),
        });
      } catch (error) {
        console.error(
          "[email] change setup failed",
          error instanceof Error ? error.message : "unknown error",
        );
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Não foi possível solicitar a alteração agora. Tente novamente.",
        });
      }
      return { accepted: true };
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
