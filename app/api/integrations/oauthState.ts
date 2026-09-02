import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import type { IntegrationProviderId } from "./types";

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function createOauthState(input: {
  userId: number;
  provider: IntegrationProviderId;
  returnPath?: string;
}) {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const returnPath =
    input.returnPath?.startsWith("/") && !input.returnPath.startsWith("//")
      ? input.returnPath.slice(0, 180)
      : "/";
  await getDb()
    .insert(schema.externalOauthStates)
    .values({
      state,
      userId: input.userId,
      provider: input.provider,
      codeVerifierEnc: encryptSecret(codeVerifier),
      nonce,
      returnPath,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
  return {
    state,
    codeVerifier,
    codeChallenge: pkceChallenge(codeVerifier),
    nonce,
  };
}

export async function consumeOauthState(input: {
  state: string;
  userId: number;
  provider: IntegrationProviderId;
}) {
  const [row] = await getDb()
    .select()
    .from(schema.externalOauthStates)
    .where(
      and(
        eq(schema.externalOauthStates.state, input.state),
        eq(schema.externalOauthStates.userId, input.userId),
        eq(schema.externalOauthStates.provider, input.provider),
        isNull(schema.externalOauthStates.consumedAt),
        gt(schema.externalOauthStates.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!row) return null;
  const updateResult = await getDb()
    .update(schema.externalOauthStates)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.externalOauthStates.state, input.state),
        eq(schema.externalOauthStates.userId, input.userId),
        eq(schema.externalOauthStates.provider, input.provider),
        gt(schema.externalOauthStates.expiresAt, new Date()),
        isNull(schema.externalOauthStates.consumedAt)
      )
    );
  const [header] = updateResult as unknown as [ResultSetHeader];
  if (header.affectedRows !== 1) return null;
  const codeVerifier = row.codeVerifierEnc
    ? decryptSecret(row.codeVerifierEnc)
    : null;
  if (!codeVerifier) return null;
  return { codeVerifier, nonce: row.nonce, returnPath: row.returnPath };
}
