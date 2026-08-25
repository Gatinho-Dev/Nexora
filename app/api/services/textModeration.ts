import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { SafetyService } from "./safety/safetyService";
import type { SafetyResult } from "./safety/safetyParser";
import { env } from "../lib/env";
import { handleSevereViolation } from "./accountSafety";
import {
  broadcastToChannel,
  broadcastToConversation,
  sendToUsers,
} from "../realtime";
import { buildMessageDTOs } from "../messageRouter";
import { createAutomaticCase } from "./reports/moderationCaseService";
import { logSafetyEvent } from "./safetyAudit";

/**
 * Moderação de TEXTO — pipeline eficiente:
 *
 *   mensagem
 *     ↓ regras locais rápidas (AutoMod/spam já rodaram ANTES de publicar)
 *     ↓ publica (texto não segura a fila do chat)
 *     ↓ OpenRouter Safety (assíncrono, com cache por hash)
 *     ↓ SafetyPolicyEngine local:
 *         sexual_minor → REMOVER + suspensão preventiva + caso crítico
 *         outras categorias → caso para revisão humana
 *         safe → nada a fazer
 *
 * Shadow mode (SAFETY_SHADOW_MODE=true): classifica e registra, NÃO aplica.
 * Kill switch: nenhuma chamada é feita; regras locais seguem valendo.
 */

const TEXT_UNSAFE_EXCERPT_LIMIT = 400;

/** Remove a mensagem violando as diretrizes e avisa autor + canal. */
export async function removeMessageForModeration(
  messageId: number,
  authorId: number
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.messages.id,
      channelId: schema.messages.channelId,
      conversationId: schema.messages.conversationId,
    })
    .from(schema.messages)
    .where(eq(schema.messages.id, messageId))
    .limit(1);
  if (rows.length === 0) return false;
  const { channelId, conversationId } = rows[0];
  await removeViolatingMessage(messageId, authorId, channelId, conversationId);
  return true;
}

async function removeViolatingMessage(
  messageId: number,
  authorId: number,
  channelId: number | null,
  conversationId: number | null
): Promise<void> {
  const db = getDb();
  // Placeholder público: conteúdo original NUNCA volta ao cliente.
  await db
    .update(schema.messages)
    .set({ content: "", tag: "removed" })
    .where(eq(schema.messages.id, messageId));
  await db
    .delete(schema.messageReactions)
    .where(eq(schema.messageReactions.messageId, messageId));

  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.id, messageId))
    .limit(1);
  if (rows.length === 0) return;
  const [dto] = await buildMessageDTOs(rows);
  if (!dto) return;

  if (channelId) broadcastToChannel(channelId, { t: "message:update", message: dto });
  if (conversationId) {
    broadcastToConversation(conversationId, { t: "message:update", message: dto });
  }

  sendToUsers([authorId], {
    t: "notification",
    notification: {
      id: 0,
      type: "moderation",
      actor: null,
      serverId: null,
      channelId,
      conversationId,
      messageId,
      content:
        "Uma mensagem sua foi removida por violar as Diretrizes da Comunidade do Nexora.",
      isRead: false,
      createdAt: new Date(),
    },
  });
}

/** Decisão de política para texto. Pura — unit-tested. */
export function decideTextAction(result: SafetyResult): {
  action: "allow" | "remove_and_suspend" | "review";
} {
  if (result.categories.includes("sexual_minor")) return { action: "remove_and_suspend" };
  if (!result.safe) return { action: "review" };
  return { action: "allow" };
}

/** Ponto de entrada: analisa uma mensagem recém-publicada (fire-and-forget). */
export async function moderateTextMessage(message: {
  id: number;
  authorId: number;
  channelId: number | null;
  conversationId: number | null;
  content: string;
}): Promise<void> {
  if (
    !env.textModerationEnabled ||
    !env.safetyAiEnabled ||
    !env.openrouterApiKey ||
    message.content.trim().length < 3
  ) {
    return;
  }

  let result: SafetyResult;
  try {
    result = await SafetyService.analyzeText({
      content: message.content.slice(0, 2000),
      requestId: `msg:${message.id}`,
    });
  } catch {
    // Falhou o provedor => mensagem permanece publicada (texto é fail-open
    // por design; mídia é fail-closed). Caso será pego por denúncia/revisão.
    return;
  }

  const decision = decideTextAction(result);
  if (decision.action === "allow") return;

  if (env.safetyShadowMode) {
    console.log(
      JSON.stringify({
        event: "text_moderation_shadow",
        messageId: message.id,
        categories: result.categories,
      })
    );
    return;
  }

  await logSafetyEvent({
    event: "text_flagged",
    targetUserId: message.authorId,
    metadata: { messageId: message.id, categories: result.categories },
  });

  if (decision.action === "remove_and_suspend") {
    await removeViolatingMessage(
      message.id,
      message.authorId,
      message.channelId,
      message.conversationId
    );    const violationId = await handleSevereViolation({
      userId: message.authorId,
      messageId: message.id,
      targetType: "message",
      category: "sexual_minor",
      model: result.model,
      policyVersion: env.safetyPolicyVersion,
    });
    if (violationId) {
      await createAutomaticCase({
        targetType: "message",
        targetId: message.id,
        reportedUserId: message.authorId,
        category: "minor_safety",
        priority: "critical",
        internalContext: message.content.slice(0, TEXT_UNSAFE_EXCERPT_LIMIT),
        linkedViolationId: violationId,
        aiAssessment: {
          safe: result.safe,
          categories: result.categories,
          model: result.model,
          confidence: result.confidence ?? null,
        },
        violationStatus: "pending_review",
      });
    }
    return;
  }

  // Demais categorias inseguras: mantém a mensagem, cria caso para revisão.
  const violationId = await createFlaggedViolation(message, result);
  await createAutomaticCase({
    targetType: "message",
    targetId: message.id,
    reportedUserId: message.authorId,
    category: mapCategoryToCaseCategory(result.categories),
    priority: "normal",
    internalContext: message.content.slice(0, TEXT_UNSAFE_EXCERPT_LIMIT),
    linkedViolationId: violationId,
    aiAssessment: {
      safe: result.safe,
      categories: result.categories,
      model: result.model,
      confidence: result.confidence ?? null,
    },
    violationStatus: "pending_review",
  });
}

async function createFlaggedViolation(
  message: { id: number; authorId: number },
  result: SafetyResult
): Promise<number | null> {
  try {
    const inserted = await getDb()
      .insert(schema.violations)
      .values({
        userId: message.authorId,
        messageId: message.id,
        targetType: "message",
        category: mapCategoryToViolationCategory(result.categories),
        severity: "moderate",
        source: "automatic_ai",
        moderationModel: result.model,
        policyVersion: env.safetyPolicyVersion,
        status: "pending_review",
        action: "none",
      })
      .$returningId();
    return Number(Object.values(inserted[0] ?? {})[0] ?? 0);
  } catch {
    return null; // duplicado (mesma msg+categoria) — idempotente
  }
}

function mapCategoryToViolationCategory(categories: string[]): string {
  if (categories.includes("hate")) return "hate";
  if (categories.includes("harassment")) return "harassment";
  if (categories.includes("violence") || categories.includes("graphic_violence"))
    return "violence";
  if (categories.includes("self_harm")) return "self_harm";
  if (categories.includes("scam")) return "scam";
  if (categories.includes("spam")) return "spam";
  if (categories.includes("sexual")) return "sexual_content";
  return "other";
}

function mapCategoryToCaseCategory(categories: string[]): string {
  if (categories.includes("hate")) return "hate";
  if (categories.includes("harassment")) return "harassment";
  if (categories.includes("violence") || categories.includes("graphic_violence"))
    return "violence";
  if (categories.includes("self_harm")) return "self_harm";
  if (categories.includes("scam")) return "scam_or_spam";
  if (categories.includes("sexual")) return "sexual_content";
  return "other";
}
