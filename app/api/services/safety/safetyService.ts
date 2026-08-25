import { env } from "../../lib/env";
import {
  OpenRouterSafetyProvider,
  type SafetyImageInput,
  type SafetyTextInput,
  contentHash,
} from "./openRouterSafetyProvider";
import type { SafetyResult } from "./safetyParser";
import { safetyMetrics, safetyMetricsSnapshot } from "./safetyMetrics";

/**
 * SafetyService — fachada única de análise de segurança da plataforma.
 *
 * O restante do Nexora NUNCA fala com o OpenRouter diretamente: sempre
 * passa por aqui. Responsabilidades:
 * - cache de classificação (contentHash + model + policyVersion);
 * - deduplicação de análises idênticas em voo;
 * - métricas seguras (sem conteúdo privado);
 * - kill switch global (SAFETY_KILL_SWITCH / runtime) e shadow mode.
 *
 * Kill switch aberto => nenhuma análise é feita. Para MÍDIA isso significa
 * fail closed (fica em revisão); para TEXTO significa publicar sem IA
 * (regras locais continuam valendo).
 */

const CACHE_MAX = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { result: SafetyResult; at: number };

const classificationCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<SafetyResult>>();

/** Kill switch em runtime (painel admin). Env define o estado inicial. */
let runtimeKilled = process.env.SAFETY_KILL_SWITCH === "true";

export function setSafetyKillSwitch(killed: boolean): void {
  runtimeKilled = killed;
}

export function isSafetyKilled(): boolean {
  return runtimeKilled || !env.safetyAiEnabled || !env.openrouterApiKey;
}

function cacheKey(hash: string, model: string): string {
  return `${hash}:${model}:${env.safetyPolicyVersion}`;
}

function cacheGet(key: string): SafetyResult | null {
  const hit = classificationCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    classificationCache.delete(key);
    return null;
  }
  // Refresca a posição (LRU simples via re-insert).
  classificationCache.delete(key);
  classificationCache.set(key, hit);
  return hit.result;
}

function cachePut(key: string, result: SafetyResult): void {
  classificationCache.set(key, { result, at: Date.now() });
  if (classificationCache.size > CACHE_MAX) {
    const oldest = classificationCache.keys().next().value;
    if (oldest !== undefined) classificationCache.delete(oldest);
  }
}

async function cachedAnalyze(
  hashInput: Buffer | string,
  model: string,
  analyze: () => Promise<SafetyResult>
): Promise<SafetyResult> {
  if (isSafetyKilled()) throw new Error("SAFETY_DISABLED");
  const key = cacheKey(contentHash(hashInput), model);

  const hit = cacheGet(key);
  if (hit) {
    safetyMetrics.cacheHits += 1;
    return hit;
  }
  safetyMetrics.cacheMisses += 1;

  const running = inFlight.get(key);
  if (running) {
    safetyMetrics.deduped += 1;
    return running;
  }

  const promise = analyze()
    .then(result => {
      recordResult(result);
      cachePut(key, result);
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

function recordResult(result: SafetyResult): void {
  safetyMetrics.requestsTotal += 1;
  safetyMetrics.latencySumMs += result.latencyMs ?? 0;
  safetyMetrics.latencyCount += 1;
  if (!result.safe) safetyMetrics.flaggedTotal += 1;
  for (const category of result.categories) {
    safetyMetrics.categories[category] =
      (safetyMetrics.categories[category] ?? 0) + 1;
  }
}

export const SafetyService = {
  /** Análise de texto (modelo OPENROUTER_SAFETY_MODEL). */
  async analyzeText(
    input: SafetyTextInput & { requestId?: string }
  ): Promise<SafetyResult> {
    return cachedAnalyze(input.content, env.openrouterSafetyModel, () =>
      OpenRouterSafetyProvider.analyzeText(input)
    );
  },

  /** Análise de imagem (modelo de visão configurável via env). */
  async analyzeImage(
    input: SafetyImageInput & { requestId?: string }
  ): Promise<SafetyResult> {
    return cachedAnalyze(input.data, env.openrouterVisionModel, () =>
      OpenRouterSafetyProvider.analyzeImage(input)
    );
  },

  hash: contentHash,

  /** Snapshot de métricas para o painel admin (fila incluída). */
  metricsSnapshot() {
    return safetyMetricsSnapshot(inFlight.size);
  },

  /**
   * Executa `action` somente se a política estiver ativa e fora de shadow
   * mode. Em shadow mode a ação é registrada mas NÃO aplicada.
   */
  shouldEnforce(): boolean {
    return !runtimeKilled && !env.safetyShadowMode && env.safetyAiEnabled;
  },

  isShadowMode(): boolean {
    return env.safetyShadowMode && !runtimeKilled;
  },
};
