/** Erros do pipeline de moderação — falhas NUNCA viram "unsafe". */
export type ModerationErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "NETWORK"
  | "NO_API_KEY"
  | "INVALID_RESPONSE";

export class ModerationUnavailableError extends Error {
  code: ModerationErrorCode;
  constructor(code: ModerationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Veredicto normalizado consumido pelo pipeline de mídia. */
export type NormalizedVerdict = {
  decision: "ALLOW" | "SENSITIVE_ADULT" | "BLOCK" | "UNCERTAIN";
  categories: string[];
  sexualMinor: boolean;
};

import type { SafetyResult } from "./safetyParser";

/** Converte o resultado do OpenRouter no veredicto do pipeline. */
export function toNormalizedVerdict(result: SafetyResult): NormalizedVerdict {
  const sexualMinor = result.categories.includes("sexual_minor");
  if (sexualMinor) return { decision: "BLOCK", categories: result.categories, sexualMinor };
  if (!result.safe) {
    return { decision: "SENSITIVE_ADULT", categories: result.categories, sexualMinor };
  }
  return { decision: "ALLOW", categories: result.categories, sexualMinor: false };
}
