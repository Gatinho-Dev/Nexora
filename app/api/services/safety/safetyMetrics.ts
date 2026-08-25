import { env } from "../../lib/env";

/**
 * Métricas seguras da camada de IA — NUNCA contêm conteúdo privado,
 * apenas contadores e latências. Snapshot exposto só para admins.
 */

type SafetyCategoryName = string;

export const safetyMetrics = {
  requestsTotal: 0,
  flaggedTotal: 0,
  rateLimited: 0,
  errorsTotal: 0,
  timeouts: 0,
  cacheHits: 0,
  cacheMisses: 0,
  deduped: 0,
  latencySumMs: 0,
  latencyCount: 0,
  categories: {} as Record<SafetyCategoryName, number>,
};

export function recordSafetyError(kind: "rate_limited" | "timeout" | "error") {
  if (kind === "rate_limited") safetyMetrics.rateLimited += 1;
  else if (kind === "timeout") safetyMetrics.timeouts += 1;
  safetyMetrics.errorsTotal += 1;
}

export function safetyMetricsSnapshot(queueDepth = 0) {
  return {
    provider: env.openrouterApiKey ? "openrouter" : "disabled",
    model: env.openrouterSafetyModel,
    visionModel: env.openrouterVisionModel,
    policyVersion: env.safetyPolicyVersion,
    shadowMode: env.safetyShadowMode,
    aiEnabled: env.safetyAiEnabled,
    textModerationEnabled: env.textModerationEnabled,
    imageModerationEnabled: env.imageModerationEnabled,
    ...safetyMetrics,
    averageLatencyMs:
      safetyMetrics.latencyCount > 0
        ? Math.round(safetyMetrics.latencySumMs / safetyMetrics.latencyCount)
        : 0,
    cacheHitRate:
      safetyMetrics.cacheHits + safetyMetrics.cacheMisses > 0
        ? Number(
            (
              safetyMetrics.cacheHits /
              (safetyMetrics.cacheHits + safetyMetrics.cacheMisses)
            ).toFixed(3)
          )
        : 0,
    queueDepth,
  };
}
