import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import {
  requireChannelAccess,
  requireConversationAccess,
} from "../utils/permissions";
import { assertCanInteract } from "./accountSafety";
import { buildMessageDTO } from "../messageRouter";
import { broadcastToChannel, broadcastToConversation } from "../realtime";

const POLL_INTERVAL_MS = 15_000;
let started = false;

async function claim(id: number): Promise<boolean> {
  const result = await getDb()
    .update(schema.scheduledMessages)
    .set({ state: "PROCESSING", attempts: sql`${schema.scheduledMessages.attempts} + 1` })
    .where(and(
      eq(schema.scheduledMessages.id, id),
      inArray(schema.scheduledMessages.state, ["PENDING", "FAILED"]),
    ));
  return ((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) === 1;
}

async function deliver(job: typeof schema.scheduledMessages.$inferSelect) {
  await assertCanInteract(job.userId);
  if (job.channelId) {
    const { channel, perms } = await requireChannelAccess(job.userId, job.channelId);
    if (!perms.has("SEND_MESSAGES")) throw new Error("Permissão de envio removida.");
    if (channel.type === "FORUM") throw new Error("Use um post de fórum para este canal.");
  } else if (job.conversationId) {
    await requireConversationAccess(job.userId, job.conversationId);
  } else {
    throw new Error("Destino removido.");
  }

  const db = getDb();
  const attachmentIds = job.attachmentIds ?? [];
  const files = attachmentIds.length
    ? await db.select().from(schema.files).where(and(
        eq(schema.files.uploaderId, job.userId),
        inArray(schema.files.id, attachmentIds),
      ))
    : [];
  if (files.length !== attachmentIds.length) throw new Error("Anexo indisponível.");

  const clientNonce = `scheduled:${job.id}`;
  const existing = await db.query.messages.findFirst({ where: and(
    eq(schema.messages.authorId, job.userId),
    eq(schema.messages.clientNonce, clientNonce),
  ) });
  let id = existing?.id;
  if (!id) {
    [{ id }] = await db.insert(schema.messages).values({
      authorId: job.userId,
      channelId: job.channelId,
      conversationId: job.conversationId,
      content: job.content,
      clientNonce,
    }).$returningId();
  }
  if (!existing && files.length) {
    await db.insert(schema.attachments).values(files.map(file => ({
      messageId: id,
      fileId: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      spoiler: false,
    })));
  }
  const row = await db.query.messages.findFirst({ where: eq(schema.messages.id, id) });
  const message = await buildMessageDTO(row!);
  if (job.channelId) await broadcastToChannel(job.channelId, { t: "message:new", message });
  else await broadcastToConversation(job.conversationId!, { t: "message:new", message });
  await db.update(schema.scheduledMessages).set({
    state: "SENT",
    sentMessageId: id,
    failureReason: null,
  }).where(eq(schema.scheduledMessages.id, job.id));
}

export async function processDueScheduledMessages() {
  // A process can stop after claiming a job. Return stale claims to the queue;
  // the message nonce above makes the recovery delivery idempotent.
  await getDb().update(schema.scheduledMessages).set({
    state: "PENDING",
    failureReason: "Envio interrompido; tentando novamente.",
  }).where(and(
    eq(schema.scheduledMessages.state, "PROCESSING"),
    lte(schema.scheduledMessages.updatedAt, new Date(Date.now() - 10 * 60_000)),
  ));
  const due = await getDb()
    .select()
    .from(schema.scheduledMessages)
    .where(and(
      inArray(schema.scheduledMessages.state, ["PENDING", "FAILED"]),
      lte(schema.scheduledMessages.scheduledFor, new Date()),
      sql`${schema.scheduledMessages.attempts} < 5`,
    ))
    .orderBy(asc(schema.scheduledMessages.scheduledFor))
    .limit(25);
  for (const job of due) {
    if (!(await claim(job.id))) continue;
    try {
      await deliver({ ...job, state: "PROCESSING", attempts: job.attempts + 1 });
    } catch (error) {
      const attempts = job.attempts + 1;
      await getDb().update(schema.scheduledMessages).set({
        state: attempts >= 5 ? "FAILED" : "PENDING",
        scheduledFor: attempts >= 5
          ? job.scheduledFor
          : new Date(Date.now() + Math.min(60_000 * 2 ** attempts, 15 * 60_000)),
        failureReason: error instanceof Error ? error.message.slice(0, 500) : "Falha ao enviar.",
      }).where(eq(schema.scheduledMessages.id, job.id));
    }
  }
}

export function startScheduledMessageWorker() {
  if (started) return;
  started = true;
  void processDueScheduledMessages().catch(error =>
    console.error("[scheduled-messages] Initial sweep failed", error),
  );
  setInterval(() => {
    void processDueScheduledMessages().catch(error =>
      console.error("[scheduled-messages] Sweep failed", error),
    );
  }, POLL_INTERVAL_MS).unref();
}
