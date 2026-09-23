/**
 * Emite um token de sessão real do Nexora para um usuário existente —
 * usado APENAS para testar o device flow e a TUI contra a API local.
 *
 * Uso: npx tsx scripts/make-test-session.mts <unionId>
 */
process.env.PORT = process.env.PORT || "3000";

const { getDb } = await import("../api/queries/connection.ts");
const schema = await import("../db/schema.ts");
const { eq } = await import("drizzle-orm");
const { signSessionToken } = await import("../api/auth/token.ts");
const { createSession } = await import("../api/auth/sessions.ts");
const { randomUUID, randomBytes } = await import("crypto");

const unionId = process.argv[2];
if (!unionId) {
  console.error("uso: make-test-session.mts <unionId>");
  process.exit(1);
}

const db = getDb();
const [user] = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.unionId, unionId))
  .limit(1);

if (!user) {
  console.error("usuário não encontrado:", unionId);
  process.exit(1);
}

const sid = randomUUID();
const secret = randomBytes(32).toString("base64url");
const token = await signSessionToken({
  sub: String(user.id),
  unionId: user.unionId,
  sid,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 24 * 3600,
});
await createSession({
  userId: user.id,
  sid,
  token,
  userAgent: "NexoraCLI-E2E/1.0",
});

console.log(JSON.stringify({ token, userId: user.id, sid }));
