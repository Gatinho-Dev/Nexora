import { env } from "../lib/env";

/**
 * NVIDIA NIM content-safety client — the ONLY place that talks to the
 * provider. Everything downstream consumes the normalized verdict.
 *
 * Design rules (audit 2026-08-23):
 * - Service failures NEVER become "unsafe". They throw typed errors that
 *   callers map to MODERATION_UNAVAILABLE.
 * - Scores are normalized to numbers and compared against explicit
 *   thresholds (never truthy checks).
 * - Response schema validated → INVALID_RESPONSE instead of guessing.
 */

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
/** Vision-capable chat model available on build.nvidia.com. Override via env. */
export const MODERATION_MODEL =
  process.env.NVIDIA_MODEL ?? "meta/llama-3.2-11b-vision-instruct";

export const TIMEOUT_MS = 12_000;

/** Thresholds (explicit numeric comparisons — never truthy). */
export const MINOR_BLOCK_THRESHOLD = 0.6;
export const ADULT_THRESHOLD = 0.5;

export type ModerationErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE"
  | "NETWORK"
  | "NO_API_KEY";

export class ModerationUnavailableError extends Error {
  code: ModerationErrorCode;
  constructor(code: ModerationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class ModerationInvalidResponseError extends ModerationUnavailableError {
  constructor(message: string) {
    super("INVALID_RESPONSE", message);
  }
}

/** Labels that indicate minor-involving sexual content (checked FIRST). */
export const SEXUAL_MINOR_MARKERS = [
  "sexual_minor",
  "sexual (minor)",
  "minor sexual",
  "csam",
  "child sexual",
];
export const SEXUAL_ADULT_MARKERS = ["sexual", "nsfw", "porn", "adult_content"];

export type NormalizedVerdict = {
  /** Explicit decision — service failures never reach here. */
  decision: "ALLOW" | "SENSITIVE_ADULT" | "BLOCK" | "UNCERTAIN";
  /** 0..1 best matching score, when available. */
  confidence: number;
  categories: string[];
  sexualMinor: boolean;
  sexualAdult: boolean;
  raw: unknown;
};

type ChatChoice = { message?: { content?: string } };

// ── Parsing helpers ───────────────────────────────────────────

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new ModerationInvalidResponseError("Resposta sem JSON.");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new ModerationInvalidResponseError("JSON inválido.");
  }
}

/** Coerces unknown value to a finite number in 0..1 (or NaN if not usable). */
function toScore(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") return 1;
    if (trimmed === "false") return 0;
    // Some providers answer words like "high"/"medium"/"low".
    const word = { high: 0.9, medium: 0.5, low: 0.15, none: 0 }[trimmed];
    if (word !== undefined) return word;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

type ParsedPayload = {
  flagged: boolean | null;
  categories: string[];
  scores: Record<string, number>;
};

function parsePayload(parsed: unknown): ParsedPayload {
  if (!parsed || typeof parsed !== "object") {
    throw new ModerationInvalidResponseError("Payload não é objeto.");
  }
  const p = parsed as Record<string, unknown>;
  const categories: string[] = [];
  const scores: Record<string, number> = {};

  // Shape A/B: categories array of strings OR objects with label/score.
  const rawCats = p.categories ?? p.flagged_categories ?? p.labels;
  if (Array.isArray(rawCats)) {
    for (const item of rawCats) {
      if (typeof item === "string") {
        categories.push(item);
        scores[item.toLowerCase()] = Math.max(scores[item.toLowerCase()] ?? 0, 1);
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const label = String(obj.category ?? obj.label ?? obj.name ?? "");
        if (label) {
          categories.push(label);
          const sc = toScore(obj.score ?? obj.confidence ?? obj.value);
          if (!Number.isNaN(sc)) scores[label.toLowerCase()] = sc;
        }
      }
    }
  }

  // Shape C: flat score map (e.g. {"safe":0.96,"sexual":0.02}).
  for (const [key, value] of Object.entries(p)) {
    const k = key.toLowerCase();
    if (k === "safe" || k === "is_safe") continue; // handled below
    const sc = toScore(value);
    if (!Number.isNaN(sc) && sc > 0 && k.length <= 40) {
      scores[k] = Math.max(scores[k] ?? 0, sc);
      if (sc > 0) categories.push(key);
    }
  }

  let flagged: boolean | null = null;
  if (typeof p.safe === "number") flagged = p.safe < 0.5;
  else if (typeof p.safe === "boolean") flagged = !p.safe;
  else if (typeof p.is_safe === "boolean") flagged = !p.is_safe;

  if (categories.length === 0 && flagged === null) {
    throw new ModerationInvalidResponseError(
      "Nenhuma categoria ou flag reconhecível."
    );
  }
  return { flagged, categories, scores };
}

/**
 * Pure normalizer: model payload → Nexora verdict. Unit-tested.
 * Minor-related labels are evaluated BEFORE generic sexual ones.
 */
export function normalizeVerdict(parsed: unknown): NormalizedVerdict {
  const { flagged, categories, scores } = parsePayload(parsed);

  const minorScore = Math.max(
    0,
    ...Object.entries(scores)
      .filter(([k]) => SEXUAL_MINOR_MARKERS.some(m => k.includes(m)))
      .map(([, v]) => v),
    0
  );
  const adultScore = Math.max(
    0,
    ...Object.entries(scores)
      .filter(([k]) => SEXUAL_ADULT_MARKERS.some(m => k.includes(m)))
      .map(([, v]) => v),
    0
  );
  const otherUnsafe =
    flagged === true &&
    !SEXUAL_MINOR_MARKERS.some(k => k in scores) &&
    !SEXUAL_ADULT_MARKERS.some(k => k.includes(Object.keys(scores)[0] ?? "")) &&
    categories.length > 0;

  const sexualMinor = minorScore >= MINOR_BLOCK_THRESHOLD;
  const sexualAdult = !sexualMinor && adultScore >= ADULT_THRESHOLD;

  let decision: NormalizedVerdict["decision"];
  if (sexualMinor || (flagged === true && minorScore > 0 && minorScore >= MINOR_BLOCK_THRESHOLD)) {
    decision = "BLOCK";
  } else if (sexualAdult) {
    decision = "SENSITIVE_ADULT";
  } else if (
    flagged === false ||
    (flagged === null && categories.length === 0)
  ) {
    decision = "ALLOW";
  } else if (otherUnsafe || flagged === true) {
    // Unsafe but not confidently classified → human-style caution without
    // punishing anyone.
    decision = "SENSITIVE_ADULT";
  } else {
    decision = "UNCERTAIN";
  }

  const confidence = Math.max(minorScore, adultScore, flagged === false ? 0.99 : 0);
  return {
    decision,
    confidence,
    categories,
    sexualMinor,
    sexualAdult,
    raw: parsed,
  };
}

// ── Provider call ─────────────────────────────────────────────

/**
 * Analyzes image bytes through the configured vision model.
 * Throws ModerationUnavailableError (with .code) on ANY failure — callers
 * must map failures to MODERATION_UNAVAILABLE and keep media private.
 */
export async function analyzeImage(
  data: Buffer,
  mimeType: string,
): Promise<NormalizedVerdict> {
  if (!env.nvidiaApiKey) {
    throw new ModerationUnavailableError(
      "NO_API_KEY",
      "NVIDIA_API_KEY não configurada."
    );
  }

  const dataUri = `data:${mimeType};base64,${data.toString("base64")}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let timedOut = false;
  controller.signal.addEventListener("abort", () => {
    timedOut = true;
  });

  let res: Response;
  try {
    res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.nvidiaApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a strict content-safety classifier for images. Reply ONLY with minified JSON: " +
              '{"safe": <number 0..1>, "categories": [{"category":"<name>","score":<number 0..1>}]}. ' +
              'Category names must be exactly one of: "Sexual (minor)", "Sexual", "Violence", "Self-harm", "Hate", "Shock". ' +
              '"Sexual (minor)" MUST be used whenever sexual content may involve a minor. ' +
              '"safe" is 1 when no category applies, otherwise low. No prose.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this image." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    if (timedOut) {
      throw new ModerationUnavailableError("TIMEOUT", "Timeout na NVIDIA.");
    }
    throw new ModerationUnavailableError(
      "NETWORK",
      e instanceof Error ? e.message : "Erro de rede."
    );
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) {
    throw new ModerationUnavailableError(
      "PROVIDER_ERROR",
      `NVIDIA rejeitou credenciais (${res.status}).`
    );
  }
  if (res.status === 429) {
    throw new ModerationUnavailableError("RATE_LIMITED", "NVIDIA rate limit.");
  }
  if (!res.ok) {
    throw new ModerationUnavailableError(
      "PROVIDER_ERROR",
      `NVIDIA respondeu ${res.status}.`
    );
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: ChatChoice[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new ModerationInvalidResponseError("Resposta vazia do modelo.");
  }
  return normalizeVerdict(extractJson(content));
}
