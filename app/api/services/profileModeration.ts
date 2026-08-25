import { env } from "../lib/env";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { SafetyService } from "./safety/safetyService";
import type { SafetyResult } from "./safety/safetyParser";
import { handleSevereViolation } from "./accountSafety";
import { createAutomaticCase } from "./reports/moderationCaseService";
import { logSafetyEvent } from "./safetyAudit";

/**
 * Moderação de metadados públicos: nome de exibição, username, bio,
 * nome/descrição de servidor e nome/tópico de canal.
 *
 * Fluxo assíncrono (não bloqueia salvar): IA classifica; sexual_minor segue
 * o caminho grave; outras categorias geram caso para revisão humana.
 */

type FieldKind =
  | "profile_name"
  | "profile_username"
  | "profile_bio"
  | "server_name"
  | "server_description"
  | "channel_name"
  | "channel_topic";

export function moderatePublicFieldAsync(
  kind: FieldKind,
  value: string,
  ownerUserId: number,
  targetRef?: { targetType: string; targetId: number }
): void {
  if (
    !env.safetyAiEnabled ||
    !env.openrouterApiKey ||
    !value ||
    value.trim().length < 3
  ) {
    return;
  }
  void moderate(kind, value, ownerUserId, targetRef).catch(() => {});
}

async function moderate(
  kind: FieldKind,
  value: string,
  ownerUserId: number,
  targetRef?: { targetType: string; targetId: number }
): Promise<void> {
  let result: SafetyResult;
  try {
    result = await SafetyService.analyzeText({
      content: `[${kind}] ${value}`.slice(0, 500),
    });
  } catch {
    return; // best-effort
  }
  if (result.safe) return;

  if (env.safetyShadowMode) {
    console.log(
      JSON.stringify({ event: "profile_moderation_shadow", kind, categories: result.categories })
    );
    return;
  }

  await logSafetyEvent({
    event: "public_field_flagged",
    targetUserId: ownerUserId,
    metadata: { kind, categories: result.categories },
  });

  const targetType = targetRef?.targetType ?? "profile";
  const targetId = targetRef?.targetId ?? ownerUserId;

  if (result.categories.includes("sexual_minor")) {
    const violationId = await handleSevereViolation({
      userId: ownerUserId,
      messageId: null,
      targetType,
      category: "sexual_minor",
      model: result.model,
      policyVersion: env.safetyPolicyVersion,
    });
    if (violationId) {
      await createAutomaticCase({
        targetType,
        targetId,
        reportedUserId: ownerUserId,
        category: "minor_safety",
        priority: "critical",
        internalContext: `${kind}: ${value.slice(0, 200)}`,
        linkedViolationId: violationId,
        aiAssessment: { safe: result.safe, categories: result.categories, model: result.model },
      });
    }
    return;
  }

  // Outras violações em metadados: caso para revisão (sem punição automática).
  try {
    const inserted = await getDb()
      .insert(schema.violations)
      .values({
        userId: ownerUserId,
        targetType,
        category: "profile_content",
        severity: "moderate",
        source: "automatic_ai",
        moderationModel: result.model,
        policyVersion: env.safetyPolicyVersion,
        status: "pending_review",
        action: "none",
      })
      .$returningId();
    const violationId = Number(Object.values(inserted[0] ?? {})[0] ?? 0);
    await createAutomaticCase({
      targetType,
      targetId,
      reportedUserId: ownerUserId,
      category: mapKindToCaseCategory(kind),
      priority: "low",
      internalContext: `${kind}: ${value.slice(0, 300)}`,
      linkedViolationId: violationId,
      aiAssessment: { safe: result.safe, categories: result.categories, model: result.model },
    });
  } catch {
    // idempotente
  }
}

function mapKindToCaseCategory(kind: FieldKind): string {
  if (kind.startsWith("server") || kind.startsWith("channel")) return "server_content";
  return "other";
}
