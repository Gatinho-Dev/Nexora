import { env } from "../lib/env";

/**
 * NVIDIA NIM content-safety service. Centralizes every call to the NVIDIA
 * API so no other module talks to it directly. The API key lives only in
 * the server environment (NVIDIA_API_KEY) and is never sent to clients.
 */

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const MODERATION_MODEL =
  process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3.5-content-safety";

/** Categories we understand, ordered by severity (minor checks run FIRST). */
export const SEXUAL_MINOR_MARKERS = [
  "sexual_minor",
  "sexual (minor)",
  "minor sexual",
  "csam",
  "child sexual",
];

export const SEXUAL_MARKERS = ["sexual", "nsfw", "porn"];

export type SafetyAnalysis = {
  safe: boolean;
  categories: string[];
  sexualMinor: boolean;
  sexualAdult: boolean;
  rawResponse: unknown;
};

export class ModerationUnavailableError extends Error {}

type ChatChoice = { message?: { content?: string } };

function extractJson(text: string): unknown {
  // Models sometimes wrap JSON in code fences or prose; find the first object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new ModerationUnavailableError("Resposta da NVIDIA sem JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeCategories(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const p = parsed as Record<string, unknown>;
  const raw = p.categories ?? p.flagged_categories ?? p.labels ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map(c =>
      typeof c === "string"
        ? c
        : typeof c === "object" && c && "category" in (c as Record<string, unknown>)
          ? String((c as Record<string, unknown>).category)
          : "",
    )
    .filter(Boolean);
}

function isFlagged(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  if (typeof p.safe === "boolean") return !p.safe;
  if (typeof p.is_safe === "boolean") return !p.is_safe;
  if (typeof p.unsafe === "boolean") return p.unsafe;
  // No explicit flag: presence of categories means unsafe.
  return normalizeCategories(parsed).length > 0;
}

/**
 * Analyzes an image through the NVIDIA content-safety model.
 * Throws ModerationUnavailableError on any failure — callers MUST treat
 * failures as "not safe to publish" and keep the media private.
 */
export async function analyzeImage(
  data: Buffer,
  mimeType: string,
): Promise<SafetyAnalysis> {
  if (!env.nvidiaApiKey) {
    throw new ModerationUnavailableError(
      "NVIDIA_API_KEY não configurada no servidor."
    );
  }

  const dataUri = `data:${mimeType};base64,${data.toString("base64")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

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
              "You are a content safety classifier. Inspect the image and reply ONLY with a JSON object: " +
              '{"safe": boolean, "categories": string[]}. ' +
              'Use category labels exactly like "Sexual", "Sexual (minor)", "Violence", "Self-harm", "Hate", "Shock". ' +
              '"Sexual (minor)" MUST be used when sexual content may involve a minor. Empty categories means safe.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this image for safety." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
    });
  } catch (e) {
    clearTimeout(timeout);
    throw new ModerationUnavailableError(
      e instanceof Error ? `Falha de rede na NVIDIA: ${e.message}` : "Falha de rede na NVIDIA."
    );
  }
  clearTimeout(timeout);

  if (!res.ok) {
    throw new ModerationUnavailableError(`NVIDIA respondeu ${res.status}`);
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: ChatChoice[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch {
    throw new ModerationUnavailableError("JSON inválido da NVIDIA.");
  }

  const categories = normalizeCategories(parsed).map(c => c.trim());
  const lower = categories.map(c => c.toLowerCase());
  // Order matters: minor-related categories are checked BEFORE plain sexual.
  const sexualMinor = SEXUAL_MINOR_MARKERS.some(m => lower.some(c => c.includes(m)));
  const sexualAdult = !sexualMinor && SEXUAL_MARKERS.some(m => lower.some(c => c.includes(m)));

  return {
    safe: !isFlagged(parsed) || categories.length === 0,
    categories,
    sexualMinor,
    sexualAdult,
    rawResponse: parsed,
  };
}
