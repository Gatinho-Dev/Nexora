import { createHash, randomUUID } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { env } from "../lib/env";

const CHALLENGE_TTL_MS = 5 * 60_000;

function challengeHash(challenge: string): string {
  return createHash("sha256").update(challenge).digest("hex");
}

function challengeMatches(expectedHash: string) {
  return async (challenge: string) => challengeHash(challenge) === expectedHash;
}

async function loadChallenge(input: {
  id: string;
  purpose: "register" | "authenticate";
  userId?: number;
}) {
  const row = await getDb().query.webauthnChallenges.findFirst({
    where: and(
      eq(schema.webauthnChallenges.id, input.id),
      eq(schema.webauthnChallenges.purpose, input.purpose),
      isNull(schema.webauthnChallenges.consumedAt),
    ),
  });
  if (
    !row ||
    row.expiresAt.getTime() <= Date.now() ||
    (input.userId != null && row.userId !== input.userId)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O desafio de passkey expirou. Tente novamente.",
    });
  }
  return row;
}

async function consumeChallenge(id: string): Promise<void> {
  const result = await getDb()
    .update(schema.webauthnChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.webauthnChallenges.id, id),
        isNull(schema.webauthnChallenges.consumedAt),
      ),
    );
  const affected =
    (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
  if (affected !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este desafio de passkey já foi utilizado.",
    });
  }
}

export async function beginPasskeyRegistration(user: typeof schema.users.$inferSelect) {
  const existing = await getDb()
    .select({
      id: schema.passkeys.credentialId,
      transports: schema.passkeys.transports,
    })
    .from(schema.passkeys)
    .where(eq(schema.passkeys.userId, user.id));
  const options = await generateRegistrationOptions({
    rpName: "Nexora",
    rpID: env.passkeyRpId,
    userID: new TextEncoder().encode(String(user.id)),
    userName: user.username ?? `user-${user.id}`,
    userDisplayName: user.name ?? user.username ?? `Usuário ${user.id}`,
    attestationType: "none",
    excludeCredentials: existing,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    timeout: CHALLENGE_TTL_MS,
  });
  const challengeId = randomUUID();
  await getDb().insert(schema.webauthnChallenges).values({
    id: challengeId,
    userId: user.id,
    challengeHash: challengeHash(options.challenge),
    purpose: "register",
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return { challengeId, options };
}

export async function finishPasskeyRegistration(input: {
  user: typeof schema.users.$inferSelect;
  challengeId: string;
  name: string;
  response: RegistrationResponseJSON;
}) {
  const challenge = await loadChallenge({
    id: input.challengeId,
    purpose: "register",
    userId: input.user.id,
  });
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: challengeMatches(challenge.challengeHash),
      expectedOrigin: env.passkeyOrigin,
      expectedRPID: env.passkeyRpId,
      requireUserVerification: true,
    });
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Não foi possível validar esta passkey.",
    });
  }
  if (!verification.verified) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Passkey inválida." });
  }
  await consumeChallenge(input.challengeId);
  const info = verification.registrationInfo;
  await getDb().insert(schema.passkeys).values({
    userId: input.user.id,
    credentialId: info.credential.id,
    publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
    counter: info.credential.counter,
    transports: input.response.response.transports ?? [],
    name: input.name,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
  });
  return { verified: true };
}

export async function beginPasskeyAuthentication(username: string) {
  const user = await getDb().query.users.findFirst({
    where: sql`lower(${schema.users.username}) = ${username.toLowerCase()}`,
  });
  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Nenhuma passkey está disponível para esta conta.",
    });
  }
  const credentials = await getDb()
    .select({
      id: schema.passkeys.credentialId,
      transports: schema.passkeys.transports,
    })
    .from(schema.passkeys)
    .where(eq(schema.passkeys.userId, user.id));
  if (credentials.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Nenhuma passkey está disponível para esta conta.",
    });
  }
  const options = await generateAuthenticationOptions({
    rpID: env.passkeyRpId,
    allowCredentials: credentials,
    userVerification: "required",
    timeout: CHALLENGE_TTL_MS,
  });
  const challengeId = randomUUID();
  await getDb().insert(schema.webauthnChallenges).values({
    id: challengeId,
    userId: user.id,
    challengeHash: challengeHash(options.challenge),
    purpose: "authenticate",
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return { challengeId, options };
}

export async function finishPasskeyAuthentication(input: {
  challengeId: string;
  response: AuthenticationResponseJSON;
}) {
  const challenge = await loadChallenge({
    id: input.challengeId,
    purpose: "authenticate",
  });
  if (!challenge.userId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Desafio inválido." });
  }
  const credential = await getDb().query.passkeys.findFirst({
    where: and(
      eq(schema.passkeys.userId, challenge.userId),
      eq(schema.passkeys.credentialId, input.response.id),
    ),
  });
  if (!credential) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Passkey não reconhecida." });
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: challengeMatches(challenge.challengeHash),
      expectedOrigin: env.passkeyOrigin,
      expectedRPID: env.passkeyRpId,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")),
        counter: Number(credential.counter),
        transports: credential.transports,
      },
    });
  } catch {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Não foi possível validar esta passkey.",
    });
  }
  if (!verification.verified) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Passkey inválida." });
  }
  await consumeChallenge(input.challengeId);
  await getDb()
    .update(schema.passkeys)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(schema.passkeys.id, credential.id));
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, credential.userId),
  });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Conta não encontrada." });
  }
  return user;
}
