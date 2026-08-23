import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as cookie from "cookie";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { nanoid } from "nanoid";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { signSessionToken } from "./kimi/session";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";
import { rateLimit } from "./utils/rateLimit";
import { toPublicUser } from "./utils/permissions";
import { env } from "./lib/env";

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

async function issueSession(
  ctx: { req: Request; resHeaders: Headers },
  unionId: string,
) {
  const token = await signSessionToken({ unionId, clientId: env.appId });
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

      await issueSession(ctx, unionId);
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, id),
      });
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
      rateLimit(`login:${input.username.toLowerCase()}`, 10, 60_000);

      const user = await findByUsername(input.username);
      if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuário ou senha incorretos.",
        });
      }

      await getDb()
        .update(schema.users)
        .set({ lastSignInAt: new Date(), status: "online" })
        .where(eq(schema.users.id, user.id));

      await issueSession(ctx, user.unionId);
      return { user: toPublicUser(user) };
    }),

  updateProfile: authedQuery
    .input(
      z.object({
        displayName: z.string().min(1).max(64).optional(),
        bio: z.string().max(500).optional(),
        avatar: z.string().max(500).optional(),
        banner: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: Partial<typeof schema.users.$inferInsert> = {};
      if (input.displayName !== undefined) patch.name = input.displayName;
      if (input.bio !== undefined) patch.bio = input.bio;
      if (input.avatar !== undefined) patch.avatar = input.avatar;
      if (input.banner !== undefined) patch.banner = input.banner;
      if (Object.keys(patch).length === 0) return { user: toPublicUser(ctx.user) };

      await getDb()
        .update(schema.users)
        .set(patch)
        .where(eq(schema.users.id, ctx.user.id));
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
      });
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
      return { ok: true };
    }),

  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: z.string().min(1, "Informe a senha atual."),
        newPassword: z.string().min(6, "A nova senha precisa de pelo menos 6 caracteres.").max(128),
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
      return { ok: true };
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
});
