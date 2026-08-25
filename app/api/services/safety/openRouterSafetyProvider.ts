import { createHash } from "node:crypto";
import { env } from "../../lib/env";
import {
  classifyWithRetry,
  SAFETY_SYSTEM_PROMPT,
  type SafetyResult,
} from "./safetyParser";

/**
 * OpenRouterSafetyProvider — implementa a análise de texto e imagem
 * exclusivamente via OpenRouter. A plataforma usa SafetyService e nunca
 * fala com o gateway diretamente.
 */

export type SafetyTextInput = {
  content: string;
  /** Contexto mínimo opcional (nunca histórico inteiro). */
  context?: string[];
};

export type SafetyImageInput = {
  /** Bytes da imagem (analisados em memória, nunca re-publicados). */
  data: Buffer;
  mimeType: string;
};

/** Hash SHA-256 do conteúdo — deduplicação de análises. */
export function contentHash(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function textMessages(input: SafetyTextInput): Parameters<typeof classifyWithRetry>[0] {
  const messages: Parameters<typeof classifyWithRetry>[0] = [
    { role: "system", content: SAFETY_SYSTEM_PROMPT },
    {
      role: "user",
      content:
        input.context && input.context.length > 0
          ? `Contexto recente (apenas para referência):\n${input.context
              .map(c => `- ${c.slice(0, 200)}`)
              .join("\n")}\n\nConteúdo a classificar:\n${input.content.slice(0, 2000)}`
          : input.content.slice(0, 2000),
    },
  ];
  return messages;
}

function imageMessages(input: SafetyImageInput): Parameters<typeof classifyWithRetry>[0] {
  const dataUri = `data:${input.mimeType};base64,${input.data.toString("base64")}`;
  return [
    { role: "system", content: SAFETY_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Classify this image for safety." },
        { type: "image_url", image_url: { url: dataUri } },
      ],
    },
  ];
}

export const OpenRouterSafetyProvider = {
  async analyzeText(input: SafetyTextInput): Promise<SafetyResult> {
    return classifyWithRetry(textMessages(input), {
      model: env.openrouterSafetyModel,
    });
  },

  async analyzeImage(input: SafetyImageInput): Promise<SafetyResult> {
    // Modelo de visão configurável (o safety model de texto pode não
    // aceitar imagens — a env permite trocar sem refactor).
    return classifyWithRetry(imageMessages(input), {
      model: env.openrouterVisionModel,
      vision: true,
    });
  },

  /** Hash do conteúdo (dedup de análises por policyVersion+model). */
  hash(data: Buffer | string): string {
    return contentHash(data);
  },
};
