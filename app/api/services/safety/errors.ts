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
  if (sexualMinor)
    return { decision: "BLOCK", categories: result.categories, sexualMinor };
  if (result.reviewRecommended) {
    return {
      decision: "UNCERTAIN",
      categories: result.categories,
      sexualMinor,
    };
  }
  if (!result.safe && result.categories.includes("sexual")) {
    return {
      decision: "SENSITIVE_ADULT",
      categories: result.categories,
      sexualMinor,
    };
  }
  // Violence, hate and other non-sexual findings are not an adult-content
  // label. They stay private for human review instead of being misrepresented
  // to users as "+18".
  if (!result.safe) {
    return {
      decision: "UNCERTAIN",
      categories: result.categories,
      sexualMinor,
    };
  }
  return {
    decision: "ALLOW",
    categories: result.categories,
    sexualMinor: false,
  };
}
