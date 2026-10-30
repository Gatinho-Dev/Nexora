import { and, eq, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { sendToUsers } from "../realtime";

function privacyData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, unknown>;
  const privacy = (value as Record<string, unknown>).privacy;
  return privacy && typeof privacy === "object" && !Array.isArray(privacy)
    ? privacy as Record<string, unknown>
    : {};
}

/**
 * Lightweight deterministic DM-abuse classifier. It complements the global
 * message rate limit and deliberately exposes no private risk signals to the sender.
 */
export async function classifyDirectMessage(userId: number, conversationId: number, content: string) {
  const db = getDb();
  const conversation = await db.query.conversations.findFirst({ where: eq(schema.conversations.id, conversationId) });
  if (!conversation || conversation.isGroup) return;
  const recipient = await db.query.conversationMembers.findFirst({ where: and(
    eq(schema.conversationMembers.conversationId, conversationId),
    ne(schema.conversationMembers.userId, userId),
  ) });
  if (!recipient) return;

  const friendship = await db.query.friendships.findFirst({ where: sql`((${schema.friendships.requesterId} = ${userId} AND ${schema.friendships.addresseeId} = ${recipient.userId}) OR (${schema.friendships.requesterId} = ${recipient.userId} AND ${schema.friendships.addresseeId} = ${userId})) AND ${schema.friendships.status} = 'ACCEPTED'` });
  const isFriend = Boolean(friendship);
  const since = new Date(Date.now() - 10 * 60_000);
  const recent = await db.select({ conversationId: schema.messages.conversationId, content: schema.messages.content }).from(schema.messages).where(and(
    eq(schema.messages.authorId, userId),
    sql`${schema.messages.conversationId} IS NOT NULL`,
    sql`${schema.messages.createdAt} >= ${since}`,
  )).orderBy(schema.messages.id).limit(120);
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  const normalized = content.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  const recipientsReached = new Set(recent.map(row => row.conversationId)).size;
  const repeated = recent.filter(row => row.content.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ") === normalized).length;
  const reasons: string[] = [];
  let riskScore = 0;
  if (recipientsReached >= 5) { riskScore += Math.min(50, 20 + recipientsReached * 4); reasons.push("dm_mass"); }
  if (repeated >= 2) { riskScore += Math.min(35, repeated * 10); reasons.push("repeated_content"); }
  if (/https?:\/\/|www\./i.test(content)) { riskScore += 12; reasons.push("link"); }
  if (/(senha|password|token|pix|cripto|carteira|wallet|pr[eê]mio|gift|nitro|verifique sua conta)/i.test(content)) { riskScore += 28; reasons.push("social_engineering_terms"); }
  if (/(xn--|bit\.ly|tinyurl|t\.me\/|discord\.gift|@everyone)/i.test(content)) { riskScore += 30; reasons.push("suspicious_link_pattern"); }
  if (/(.)\1{14,}/u.test(content) || content.length > 1500) { riskScore += 12; reasons.push("flood_pattern"); }
  if (user && Date.now() - user.createdAt.getTime() < 7 * 86_400_000) { riskScore += 15; reasons.push("new_account"); }
  riskScore = Math.min(100, riskScore);

  const recipientPreferences = await db.query.userPreferences.findFirst({ where: eq(schema.userPreferences.userId, recipient.userId) });
  const shouldFilterUnknown = privacyData(recipientPreferences?.data).filterUnknownDms !== false;
  const suspicious = riskScore >= 55;
  if (!isFriend || suspicious) {
    await db.insert(schema.messageRequests).values({
      ownerUserId: recipient.userId,
      conversationId,
      category: suspicious ? "suspicious" : "mutual_servers",
      riskScore,
      reasons,
      state: suspicious ? "SPAM" : "PENDING",
    }).onDuplicateKeyUpdate({ set: {
      category: suspicious ? "suspicious" : "mutual_servers",
      riskScore,
      reasons,
      state: suspicious ? "SPAM" : "PENDING",
      updatedAt: new Date(),
    } });
    if (suspicious || shouldFilterUnknown) {
      await db.insert(schema.conversationPreferences).values({
        conversationId,
        userId: recipient.userId,
        requestState: suspicious ? "spam" : "pending",
      }).onDuplicateKeyUpdate({ set: {
        requestState: suspicious ? "spam" : "pending",
        updatedAt: new Date(),
      } });
    }
    sendToUsers([recipient.userId], { t: "dm:refresh" });
  }
  if (riskScore >= 90) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Esta mensagem foi bloqueada pela proteção contra spam." });
  }
}
