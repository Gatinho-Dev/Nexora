import { env } from "../../lib/env";

/**
 * Cliente central do OpenRouter — ÚNICO ponto de contato com o gateway.
 * Taxonomia de erros própria; nunca vaza detalhes técnicos ao usuário.
 */

export class OpenRouterAuthenticationError extends Error {
  constructor() {
    super("OpenRouter rejeitou as credenciais.");
  }
}
export class OpenRouterRateLimitError extends Error {
  retryAfterMs: number | null;
  constructor(retryAfterMs: number | null = null) {
    super("OpenRouter rate limit.");
    this.retryAfterMs = retryAfterMs;
  }
}
export class OpenRouterTimeoutError extends Error {
  constructor() {
    super("OpenRouter timeout.");
  }
}
export class OpenRouterProviderError extends Error {
  status: number;
  constructor(status: number) {
    super(`OpenRouter respondeu ${status}.`);
    this.status = status;
  }
}

export type ChatMessage = {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

export type ChatResult = { content: string; latencyMs: number };

/** Uma chamada /chat/completions com timeout e erros tipados. */
export async function openRouterChat(input: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<ChatResult> {
  if (!env.openrouterApiKey) {
    throw new OpenRouterAuthenticationError();
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    env.openrouterTimeoutMs,
  );
  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`${env.openrouterBaseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.openrouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.openrouterSiteUrl,
        "X-Title": env.openrouterAppName,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.maxTokens ?? 300,
        temperature: 0,
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    // AbortController estourou o timeout.
    if ((e as Error)?.name === "AbortError") {
      throw new OpenRouterTimeoutError();
    }
    throw new OpenRouterProviderError(0);
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) {
    throw new OpenRouterAuthenticationError();
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "") || null;
    throw new OpenRouterRateLimitError(
      retryAfter ? retryAfter * 1000 : null,
    );
  }
  if (res.status === 404) {
    throw new OpenRouterProviderError(404); // modelo indisponível
  }
  if (!res.ok) {
    throw new OpenRouterProviderError(res.status);
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new OpenRouterProviderError(res.status);
  return { content, latencyMs: Date.now() - startedAt };
}

/** Backoff exponencial com jitter. */
export function backoffDelay(attempt: number): number {
  const base = 500 * Math.pow(2, attempt);
  return base + Math.floor(Math.random() * 250);
}
