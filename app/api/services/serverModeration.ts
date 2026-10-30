import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";

export async function activeServerTimeout(userId: number, serverId: number) {
  const member = await getDb().query.serverMembers.findFirst({
    where: and(
      eq(schema.serverMembers.userId, userId),
      eq(schema.serverMembers.serverId, serverId),
    ),
  });
  return member?.timeoutUntil && member.timeoutUntil.getTime() > Date.now()
    ? member.timeoutUntil
    : null;
}

export async function assertNotTimedOut(userId: number, serverId: number) {
  const until = await activeServerTimeout(userId, serverId);
  if (!until) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `Você está em timeout até ${until.toISOString()}.`,
  });
}

export async function lastChannelMessageAt(
  userId: number,
  channelId: number,
): Promise<Date | null> {
  const [row] = await getDb()
    .select({ createdAt: schema.messages.createdAt })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.authorId, userId),
        eq(schema.messages.channelId, channelId),
      ),
    )
    .orderBy(sql`${schema.messages.id} DESC`)
    .limit(1);
  return row?.createdAt ?? null;
}

export async function enforceSlowMode(input: {
  userId: number;
  channelId: number;
  canBypass: boolean;
}) {
  if (input.canBypass) return { retryAfterSeconds: 0 };
  const settings = await getDb().query.channelAdvancedSettings.findFirst({
    where: eq(schema.channelAdvancedSettings.channelId, input.channelId),
  });
  const slowModeSeconds = settings?.slowModeSeconds ?? 0;
  if (slowModeSeconds <= 0) return { retryAfterSeconds: 0 };
  const lastSentAt = await lastChannelMessageAt(input.userId, input.channelId);
  if (!lastSentAt) return { retryAfterSeconds: 0 };
  const remainingMs =
    lastSentAt.getTime() + slowModeSeconds * 1000 - Date.now();
  if (remainingMs <= 0) return { retryAfterSeconds: 0 };
  const retryAfterSeconds = Math.ceil(remainingMs / 1000);
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `Modo lento ativo. Aguarde ${retryAfterSeconds}s.`,
    cause: { retryAfterSeconds },
  });
}
