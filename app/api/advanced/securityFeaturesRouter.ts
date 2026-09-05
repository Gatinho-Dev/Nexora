import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { createRouter, authedQuery, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import {
  beginPasskeyAuthentication,
  beginPasskeyRegistration,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
} from "../services/passkeys";
import {
  buildTotpUri,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  verifyBackupCode,
  verifyTotp,
} from "../services/mfa";
import { decryptPrivate, encryptPrivate } from "../lib/crypto";
import { issueSession } from "../accountRouter";
import { getClientIp } from "../lib/ip";
import { friendlyDeviceName, parseUserAgent } from "../auth/userAgent";
import { rateLimit } from "../utils/rateLimit";
import { RateLimits } from "@contracts/constants";
import { sendToUsers } from "../realtime";

const QR_TTL_MS = 2 * 60_000;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function partialIp(value: string | null) {
  if (!value) return null;
  if (value.includes(":")) return `${value.split(":").slice(0, 3).join(":")}::/48`;
  const parts = value.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : null;
}

async function assertTotpOrBackup(userId: number, code: string) {
  const settings = await getDb().query.totpSettings.findFirst({
    where: and(eq(schema.totpSettings.userId, userId), eq(schema.totpSettings.enabled, true)),
  });
  if (!settings) return;
  const secret = decryptPrivate(settings.encryptedSecret, `totp:${userId}`);
  if (secret) {
    const result = verifyTotp(secret, code, {
      minStepExclusive: settings.lastUsedStep == null ? undefined : Number(settings.lastUsedStep),
    });
    if (result.valid && result.step != null) {
      await getDb().update(schema.totpSettings).set({ lastUsedStep: result.step }).where(eq(schema.totpSettings.userId, userId));
      return;
    }
  }
  const codes = await getDb().select().from(schema.backupCodes).where(and(
    eq(schema.backupCodes.userId, userId),
    isNull(schema.backupCodes.usedAt),
  ));
  const match = codes.find(row => verifyBackupCode(code, row.codeHash));
  if (match) {
    const result = await getDb().update(schema.backupCodes).set({ usedAt: new Date() }).where(and(eq(schema.backupCodes.id, match.id), isNull(schema.backupCodes.usedAt)));
    const affected = (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
    if (affected === 1) return;
  }
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Código de autenticação inválido ou já utilizado." });
}

async function qrRow(sessionId: string, token: string) {
  const row = await getDb().query.qrLoginSessions.findFirst({
    where: and(
      eq(schema.qrLoginSessions.id, sessionId),
      eq(schema.qrLoginSessions.tokenHash, hash(token)),
    ),
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row && row.status === "PENDING") {
      await getDb().update(schema.qrLoginSessions).set({ status: "EXPIRED" }).where(eq(schema.qrLoginSessions.id, row.id));
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: "Este QR expirou." });
  }
  return row;
}

export const securityFeaturesRouter = createRouter({
  passkeys: authedQuery.query(async ({ ctx }) => getDb()
    .select({
      id: schema.passkeys.id,
      name: schema.passkeys.name,
      deviceType: schema.passkeys.deviceType,
      backedUp: schema.passkeys.backedUp,
      createdAt: schema.passkeys.createdAt,
      lastUsedAt: schema.passkeys.lastUsedAt,
    })
    .from(schema.passkeys)
    .where(eq(schema.passkeys.userId, ctx.user.id))
    .orderBy(desc(schema.passkeys.id))),

  beginPasskeyRegistration: authedQuery.mutation(async ({ ctx }) => {
    rateLimit(`passkey-register:${ctx.user.id}`, RateLimits.securityChallenge.limit, RateLimits.securityChallenge.windowMs);
    return beginPasskeyRegistration(ctx.user);
  }),

  finishPasskeyRegistration: authedQuery
    .input(z.object({ challengeId: z.string().uuid(), name: z.string().min(1).max(80), response: z.unknown() }))
    .mutation(async ({ ctx, input }) => finishPasskeyRegistration({
      user: ctx.user,
      challengeId: input.challengeId,
      name: input.name,
      response: input.response as RegistrationResponseJSON,
    })),

  beginPasskeyLogin: publicQuery
    .input(z.object({ username: z.string().min(2).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req.headers) ?? "unknown";
      rateLimit(`passkey-login:${input.username.toLowerCase()}`, RateLimits.securityChallenge.limit, RateLimits.securityChallenge.windowMs);
      rateLimit(`passkey-login-ip:${ip}`, 20, RateLimits.securityChallenge.windowMs);
      return beginPasskeyAuthentication(input.username);
    }),

  finishPasskeyLogin: publicQuery
    .input(z.object({ challengeId: z.string().uuid(), response: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      const user = await finishPasskeyAuthentication({
        challengeId: input.challengeId,
        response: input.response as AuthenticationResponseJSON,
      });
      await getDb().update(schema.users).set({ status: "online", lastSignInAt: new Date() }).where(eq(schema.users.id, user.id));
      await issueSession(ctx, user);
      await getDb().insert(schema.securityEvents).values({
        userId: user.id,
        type: "passkey_login",
        severity: "info",
        partialIp: partialIp(getClientIp(ctx.req.headers)),
      });
      return { ok: true };
    }),

  deletePasskey: authedQuery
    .input(z.object({ id: z.number(), verificationCode: z.string().min(6).max(32).optional() }))
    .mutation(async ({ ctx, input }) => {
      // If 2FA is enabled, the helper rejects a missing code. Accounts without
      // TOTP keep the existing authenticated-session behavior.
      await assertTotpOrBackup(ctx.user.id, input.verificationCode ?? "");
      const key = await getDb().query.passkeys.findFirst({ where: and(eq(schema.passkeys.id, input.id), eq(schema.passkeys.userId, ctx.user.id)) });
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey não encontrada." });
      const [{ count }] = await getDb().select({ count: sql<number>`count(*)` }).from(schema.passkeys).where(eq(schema.passkeys.userId, ctx.user.id));
      if (Number(count) === 1 && !ctx.user.passwordHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cadastre outra forma de login antes de remover a última passkey." });
      await getDb().delete(schema.passkeys).where(eq(schema.passkeys.id, key.id));
      await getDb().insert(schema.securityEvents).values({ userId: ctx.user.id, type: "passkey_removed", severity: "warning", metadata: { name: key.name } });
      return { ok: true };
    }),

  totp: authedQuery.query(async ({ ctx }) => {
    const row = await getDb().query.totpSettings.findFirst({ where: eq(schema.totpSettings.userId, ctx.user.id) });
    const [{ remaining }] = await getDb().select({ remaining: sql<number>`count(*)` }).from(schema.backupCodes).where(and(eq(schema.backupCodes.userId, ctx.user.id), isNull(schema.backupCodes.usedAt)));
    return { enabled: row?.enabled ?? false, verifiedAt: row?.verifiedAt ?? null, backupCodesRemaining: Number(remaining) };
  }),

  beginTotp: authedQuery.mutation(async ({ ctx }) => {
    rateLimit(`totp-begin:${ctx.user.id}`, RateLimits.securityChallenge.limit, RateLimits.securityChallenge.windowMs);
    const current = await getDb().query.totpSettings.findFirst({ where: eq(schema.totpSettings.userId, ctx.user.id) });
    if (current?.enabled) throw new TRPCError({ code: "CONFLICT", message: "A autenticação em duas etapas já está ativa." });
    const secret = generateTotpSecret();
    const encryptedSecret = encryptPrivate(secret, `totp:${ctx.user.id}`);
    await getDb().insert(schema.totpSettings).values({ userId: ctx.user.id, encryptedSecret }).onDuplicateKeyUpdate({ set: { encryptedSecret, enabled: false, verifiedAt: null, lastUsedStep: null, updatedAt: new Date() } });
    const username = ctx.user.username ?? `user-${ctx.user.id}`;
    return { secret, uri: buildTotpUri({ secret, username }) };
  }),

  enableTotp: authedQuery
    .input(z.object({ code: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const row = await getDb().query.totpSettings.findFirst({ where: eq(schema.totpSettings.userId, ctx.user.id) });
      const secret = row ? decryptPrivate(row.encryptedSecret, `totp:${ctx.user.id}`) : null;
      if (!row || !secret || row.enabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Inicie a configuração do autenticador novamente." });
      const verified = verifyTotp(secret, input.code);
      if (!verified.valid || verified.step == null) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
      const codes = generateBackupCodes();
      await getDb().delete(schema.backupCodes).where(eq(schema.backupCodes.userId, ctx.user.id));
      await getDb().insert(schema.backupCodes).values(codes.map(code => ({ userId: ctx.user.id, codeHash: hashBackupCode(code) })));
      await getDb().update(schema.totpSettings).set({ enabled: true, verifiedAt: new Date(), lastUsedStep: verified.step }).where(eq(schema.totpSettings.userId, ctx.user.id));
      await getDb().insert(schema.securityEvents).values({ userId: ctx.user.id, type: "totp_enabled", severity: "info" });
      return { backupCodes: codes };
    }),

  regenerateBackupCodes: authedQuery
    .input(z.object({ code: z.string().min(6).max(32) }))
    .mutation(async ({ ctx, input }) => {
      await assertTotpOrBackup(ctx.user.id, input.code);
      const codes = generateBackupCodes();
      await getDb().delete(schema.backupCodes).where(eq(schema.backupCodes.userId, ctx.user.id));
      await getDb().insert(schema.backupCodes).values(codes.map(code => ({ userId: ctx.user.id, codeHash: hashBackupCode(code) })));
      await getDb().insert(schema.securityEvents).values({ userId: ctx.user.id, type: "backup_codes_regenerated", severity: "warning" });
      return { backupCodes: codes };
    }),

  disableTotp: authedQuery
    .input(z.object({ code: z.string().min(6).max(32) }))
    .mutation(async ({ ctx, input }) => {
      await assertTotpOrBackup(ctx.user.id, input.code);
      await getDb().delete(schema.backupCodes).where(eq(schema.backupCodes.userId, ctx.user.id));
      await getDb().delete(schema.totpSettings).where(eq(schema.totpSettings.userId, ctx.user.id));
      await getDb().insert(schema.securityEvents).values({ userId: ctx.user.id, type: "totp_disabled", severity: "warning" });
      return { ok: true };
    }),

  markTrusted: authedQuery
    .input(z.object({ sessionId: z.string().min(1).max(32), trusted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getDb().query.accountSessions.findFirst({ where: and(eq(schema.accountSessions.id, input.sessionId), eq(schema.accountSessions.userId, ctx.user.id), isNull(schema.accountSessions.revokedAt)) });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Dispositivo não encontrado." });
      if (input.trusted) await getDb().insert(schema.trustedDevices).values({ userId: ctx.user.id, sessionId: session.id, expiresAt: new Date(Date.now() + 180 * 86_400_000) }).onDuplicateKeyUpdate({ set: { trustedAt: new Date(), expiresAt: new Date(Date.now() + 180 * 86_400_000) } });
      else await getDb().delete(schema.trustedDevices).where(and(eq(schema.trustedDevices.userId, ctx.user.id), eq(schema.trustedDevices.sessionId, session.id)));
      return { ok: true };
    }),

  trustedDevices: authedQuery.query(async ({ ctx }) => getDb()
    .select({ trusted: schema.trustedDevices, session: schema.accountSessions })
    .from(schema.trustedDevices)
    .innerJoin(schema.accountSessions, eq(schema.accountSessions.id, schema.trustedDevices.sessionId))
    .where(eq(schema.trustedDevices.userId, ctx.user.id))
    .orderBy(desc(schema.trustedDevices.trustedAt))),

  blocks: authedQuery.query(async ({ ctx }) => getDb()
    .select({ block: schema.userBlocks, user: schema.users })
    .from(schema.userBlocks)
    .innerJoin(schema.users, eq(schema.users.id, schema.userBlocks.blockedUserId))
    .where(eq(schema.userBlocks.userId, ctx.user.id))
    .orderBy(desc(schema.userBlocks.id))),

  setBlocked: authedQuery
    .input(z.object({ userId: z.number(), blocked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode bloquear a si mesmo." });
      if (input.blocked) {
        await getDb().insert(schema.userBlocks).values({ userId: ctx.user.id, blockedUserId: input.userId }).onDuplicateKeyUpdate({ set: { blockedUserId: input.userId } });
        await getDb().delete(schema.friendships).where(sql`(${schema.friendships.requesterId} = ${ctx.user.id} AND ${schema.friendships.addresseeId} = ${input.userId}) OR (${schema.friendships.requesterId} = ${input.userId} AND ${schema.friendships.addresseeId} = ${ctx.user.id})`);
      } else await getDb().delete(schema.userBlocks).where(and(eq(schema.userBlocks.userId, ctx.user.id), eq(schema.userBlocks.blockedUserId, input.userId)));
      sendToUsers([ctx.user.id, input.userId], { t: "friends:refresh" });
      return { ok: true };
    }),

  restrictions: authedQuery.query(async ({ ctx }) => getDb()
    .select({ restriction: schema.userRestrictions, user: schema.users })
    .from(schema.userRestrictions)
    .innerJoin(schema.users, eq(schema.users.id, schema.userRestrictions.restrictedUserId))
    .where(eq(schema.userRestrictions.userId, ctx.user.id))
    .orderBy(desc(schema.userRestrictions.id))),

  setRestricted: authedQuery
    .input(z.object({ userId: z.number(), restricted: z.boolean(), filterMessages: z.boolean().default(true), muteCalls: z.boolean().default(true), muteNotifications: z.boolean().default(true), hidePresence: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode restringir a si mesmo." });
      if (input.restricted) await getDb().insert(schema.userRestrictions).values({ userId: ctx.user.id, restrictedUserId: input.userId, filterMessages: input.filterMessages, muteCalls: input.muteCalls, muteNotifications: input.muteNotifications, hidePresence: input.hidePresence }).onDuplicateKeyUpdate({ set: { filterMessages: input.filterMessages, muteCalls: input.muteCalls, muteNotifications: input.muteNotifications, hidePresence: input.hidePresence, updatedAt: new Date() } });
      else await getDb().delete(schema.userRestrictions).where(and(eq(schema.userRestrictions.userId, ctx.user.id), eq(schema.userRestrictions.restrictedUserId, input.userId)));
      return { ok: true };
    }),

  events: authedQuery.query(async ({ ctx }) => getDb()
    .select()
    .from(schema.securityEvents)
    .where(eq(schema.securityEvents.userId, ctx.user.id))
    .orderBy(desc(schema.securityEvents.id))
    .limit(200)),

  acknowledgeEvent: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getDb().update(schema.securityEvents).set({ acknowledgedAt: new Date() }).where(and(eq(schema.securityEvents.id, input.id), eq(schema.securityEvents.userId, ctx.user.id)));
      return { ok: true };
    }),

  createQrLogin: publicQuery.mutation(async ({ ctx }) => {
    const ip = getClientIp(ctx.req.headers);
    rateLimit(`qr-create:${ip ?? "unknown"}`, RateLimits.securityChallenge.limit, RateLimits.securityChallenge.windowMs);
    const token = randomBytes(32).toString("base64url");
    const id = randomUUID();
    const parsed = parseUserAgent(ctx.req.headers.get("user-agent") ?? "", ctx.req.headers.get("sec-ch-ua"));
    const expiresAt = new Date(Date.now() + QR_TTL_MS);
    await getDb().insert(schema.qrLoginSessions).values({
      id,
      tokenHash: hash(token),
      deviceSummary: friendlyDeviceName(parsed),
      browser: parsed.browser,
      partialIp: partialIp(ip),
      expiresAt,
    });
    return { id, token, expiresAt, payload: `nexora://login?session=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}` };
  }),

  inspectQrLogin: authedQuery
    .input(z.object({ id: z.string().uuid(), token: z.string().min(32).max(128) }))
    .query(async ({ input }) => {
      const row = await qrRow(input.id, input.token);
      if (row.status !== "PENDING") throw new TRPCError({ code: "CONFLICT", message: "Este QR não está mais disponível." });
      return { id: row.id, deviceSummary: row.deviceSummary, browser: row.browser, approximateLocation: row.approximateLocation, partialIp: row.partialIp, expiresAt: row.expiresAt };
    }),

  approveQrLogin: authedQuery
    .input(z.object({ id: z.string().uuid(), token: z.string().min(32).max(128), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const row = await qrRow(input.id, input.token);
      if (row.status !== "PENDING") throw new TRPCError({ code: "CONFLICT", message: "Este QR já foi utilizado." });
      const result = await getDb().update(schema.qrLoginSessions).set({ status: input.approve ? "APPROVED" : "REJECTED", approvedByUserId: input.approve ? ctx.user.id : null, approvedAt: input.approve ? new Date() : null }).where(and(eq(schema.qrLoginSessions.id, row.id), eq(schema.qrLoginSessions.status, "PENDING")));
      if (((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "Este QR já foi utilizado." });
      await getDb().insert(schema.securityEvents).values({ userId: ctx.user.id, type: input.approve ? "qr_login_approved" : "qr_login_rejected", severity: input.approve ? "warning" : "info", device: row.deviceSummary, browser: row.browser, partialIp: row.partialIp });
      return { ok: true };
    }),

  qrLoginStatus: publicQuery
    .input(z.object({ id: z.string().uuid(), token: z.string().min(32).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const row = await qrRow(input.id, input.token);
      if (row.status !== "APPROVED" || !row.approvedByUserId) return { status: row.status, authenticated: false };
      const result = await getDb().update(schema.qrLoginSessions).set({ status: "CONSUMED", consumedAt: new Date() }).where(and(eq(schema.qrLoginSessions.id, row.id), eq(schema.qrLoginSessions.status, "APPROVED")));
      if (((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) !== 1) return { status: "CONSUMED" as const, authenticated: false };
      const user = await getDb().query.users.findFirst({ where: eq(schema.users.id, row.approvedByUserId) });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await issueSession(ctx, user);
      return { status: "CONSUMED" as const, authenticated: true };
    }),
});
