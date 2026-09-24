import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

export type EmailTokenPurpose =
  | "verify_email"
  | "password_reset"
  | "email_change";

export const EMAIL_TOKEN_TTL_MS = {
  verify_email: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
  email_change: 60 * 60 * 1000,
} as const;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function hashEmail(value: string): string {
  return createHash("sha256").update(normalizeEmail(value)).digest("hex");
}

export function hashEmailToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function affectedRows(result: unknown): number {
  return (
    (result as unknown as [{ affectedRows?: number }])?.[0]?.affectedRows ?? 0
  );
}

export async function invalidateEmailTokens(
  userId: number,
  purpose: EmailTokenPurpose,
): Promise<void> {
  await getDb()
    .update(schema.emailActionTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.emailActionTokens.userId, userId),
        eq(schema.emailActionTokens.purpose, purpose),
        isNull(schema.emailActionTokens.consumedAt),
      ),
    );
}

export async function issueEmailToken(input: {
  userId: number;
  purpose: EmailTokenPurpose;
  targetEmail?: string | null;
}): Promise<string> {
  await invalidateEmailTokens(input.userId, input.purpose);
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  await getDb().insert(schema.emailActionTokens).values({
    id: randomUUID(),
    userId: input.userId,
    purpose: input.purpose,
    tokenHash: hashEmailToken(rawToken),
    targetEmail: input.targetEmail ? normalizeEmail(input.targetEmail) : null,
    expiresAt: new Date(now.getTime() + EMAIL_TOKEN_TTL_MS[input.purpose]),
    createdAt: now,
  });
  return rawToken;
}

export async function consumeEmailToken(
  rawToken: string,
  purpose: EmailTokenPurpose,
): Promise<typeof schema.emailActionTokens.$inferSelect | null> {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 128) return null;
  const tokenHash = hashEmailToken(rawToken);
  const row = await getDb().query.emailActionTokens.findFirst({
    where: and(
      eq(schema.emailActionTokens.tokenHash, tokenHash),
      eq(schema.emailActionTokens.purpose, purpose),
      isNull(schema.emailActionTokens.consumedAt),
    ),
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;

  const result = await getDb()
    .update(schema.emailActionTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.emailActionTokens.id, row.id),
        isNull(schema.emailActionTokens.consumedAt),
      ),
    );
  return affectedRows(result) === 1 ? row : null;
}
