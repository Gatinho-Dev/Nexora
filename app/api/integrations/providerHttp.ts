import { ProviderApiError, type IntegrationProviderId } from "./types";

export async function providerFetch(
  provider: IntegrationProviderId,
  allowedHosts: ReadonlySet<string>,
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const url = new URL(input);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new ProviderApiError(provider, 400, "Destino externo não permitido.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (response.status === 429) {
      const raw = response.headers.get("retry-after");
      const seconds = raw ? Number(raw) : Number.NaN;
      throw new ProviderApiError(
        provider,
        429,
        "O serviço externo limitou temporariamente as consultas.",
        Number.isFinite(seconds) ? Math.max(1, seconds) * 1000 : null
      );
    }
    return response;
  } catch (error) {
    if (error instanceof ProviderApiError) throw error;
    if ((error as Error)?.name === "AbortError") {
      throw new ProviderApiError(
        provider,
        0,
        "Tempo limite no serviço externo."
      );
    }
    throw new ProviderApiError(
      provider,
      0,
      "Falha de rede no serviço externo."
    );
  } finally {
    clearTimeout(timer);
  }
}

export function basicAuthorization(
  clientId: string,
  clientSecret: string
): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}
