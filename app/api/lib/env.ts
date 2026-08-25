import { config } from "dotenv";

// A production host (Render, Railway, Fly.io, etc.) injects its environment
// directly. Loading a developer's .env file there can silently point the
// service at localhost, which is inside the container and has no MySQL server.
if (process.env.NODE_ENV !== "production") {
  config();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function validateDatabaseUrl(value: string): string {
  if (!value || process.env.NODE_ENV !== "production") return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid MySQL URL, for example mysql://user:password@host:3306/database",
    );
  }

  if (!["mysql:", "mysql2:", "mariadb:"].includes(url.protocol)) {
    throw new Error(
      `DATABASE_URL uses ${url.protocol} but Nexora currently requires a MySQL-compatible URL`,
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(hostname)) {
    throw new Error(
      "DATABASE_URL points to localhost. Render cannot reach a MySQL server running on your computer; set DATABASE_URL to a reachable managed MySQL instance and do not upload the local .env file as a production secret.",
    );
  }

  return value;
}

function csv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

function numericCsv(name: string): number[] {
  return csv(name)
    .map(value => Number(value))
    .filter(value => Number.isSafeInteger(value) && value > 0);
}

const databaseUrl = validateDatabaseUrl(required("DATABASE_URL"));

export const env = {
  /** Identificador do app embutido no JWT de sessão (não é mais OAuth). */
  appId: process.env.APP_ID ?? "nexora",
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl,
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  ownerUnionIds: [process.env.OWNER_UNION_ID ?? "", ...csv("NEXORA_OWNER_UNION_IDS")]
    .filter(Boolean),
  ownerUserIds: numericCsv("NEXORA_OWNER_USER_IDS"),
  adminUnionIds: csv("NEXORA_ADMIN_UNION_IDS"),
  adminUserIds: numericCsv("NEXORA_ADMIN_USER_IDS"),
  appOrigin: process.env.APP_ORIGIN?.replace(/\/$/, "") ?? "",
  publicApiUrl: process.env.PUBLIC_API_URL?.replace(/\/$/, "") ?? "",
  // ── OpenRouter (ÚNICO gateway de IA da plataforma) ──────────
  // Nunca use API direta da NVIDIA: todo tráfego passa por aqui.
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterBaseUrl:
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  /** Modelo principal de classificação de segurança (texto). */
  openrouterSafetyModel:
    process.env.OPENROUTER_SAFETY_MODEL ??
    "nvidia/nemotron-3.5-content-safety:free",
  /** Modelo de visão para imagens (o safety model pode não aceitar imagem). */
  openrouterVisionModel:
    process.env.OPENROUTER_VISION_MODEL ?? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  /** Fallbacks se o modelo de visão principal deixar de existir (404). */
  openrouterVisionFallbacks: csv("OPENROUTER_VISION_FALLBACK_MODELS").length
    ? csv("OPENROUTER_VISION_FALLBACK_MODELS")
    : ["google/gemma-4-31b-it:free"],
  /** Modelo do chatbot oficial — separado da segurança (nunca usado para moderar). */
  openrouterChatModel: process.env.OPENROUTER_CHAT_MODEL ?? "",
  openrouterAppName: process.env.OPENROUTER_APP_NAME ?? "Nexora",
  openrouterSiteUrl:
    process.env.OPENROUTER_SITE_URL ?? "https://nexorachat.cloud",
  openrouterTimeoutMs: Number(process.env.OPENROUTER_SAFETY_TIMEOUT_MS ?? 15_000),
  safetyMaxRetries: Number(process.env.SAFETY_MAX_RETRIES ?? 3),

  // ── Nexora Safety: flags e kill switch ─────────────────────
  safetyAiEnabled: process.env.SAFETY_AI_ENABLED !== "false",
  textModerationEnabled: process.env.TEXT_MODERATION_ENABLED !== "false",
  imageModerationEnabled: process.env.IMAGE_MODERATION_ENABLED !== "false",
  reportAiTriageEnabled: process.env.REPORT_AI_TRIAGE_ENABLED !== "false",
  automaticSevereSuspensionEnabled:
    process.env.AUTOMATIC_SEVERE_SUSPENSION_ENABLED !== "false",
  /**
   * Shadow mode: a IA classifica e registra, mas NENHUMA ação é aplicada.
   * Use para testar novos modelos/políticas com segurança.
   */
  safetyShadowMode: process.env.SAFETY_SHADOW_MODE === "true",
  severeStrikeLimit: Number(process.env.SEVERE_STRIKE_LIMIT ?? 3),
  safetyPolicyVersion: process.env.SAFETY_POLICY_VERSION ?? "2026.08.1",
  sexualMinorSuspensionDays: Number(
    process.env.SEXUAL_MINOR_INITIAL_SUSPENSION_DAYS ?? 3,
  ),

  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? process.env.APP_ORIGIN ?? "")
    .split(",")
    .map(origin => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
};
