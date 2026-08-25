import dns from "node:dns";
import net from "node:net";
import { promisify } from "node:util";

/**
 * Fetcher seguro para metadata externa — proteção SSRF completa.
 * - Só https
 * - Resolve DNS e valida o IP ANTES de conectar (anti DNS-rebinding)
 * - Segue redirects manualmente revalidando cada destino (máx 5)
 * - Timeout e limite de bytes
 */

const lookup = promisify(dns.lookup);
export const MAX_REDIRECTS = 5;
export const FETCH_TIMEOUT_MS = 6_000;
export const MAX_BYTES = 400_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
]);

/** IP privado/reservado? (SSRF) */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local/metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("::ffff:")) {
      return isPrivateIp(lower.replace("::ffff:", ""));
    }
    return false;
  }
  return true; // desconhecido → bloqueia
}

export class UnsafeUrlError extends Error {
  constructor(message = "URL não permitida.") {
    super(message);
  }
}

/** Valida protocolo + host + IP resolvido. */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("URL inválida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Protocolo não permitido.");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw new UnsafeUrlError();
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError();
  }
  // IP literal?
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError();
    return url;
  }
  // Resolve todos os A/AAAA e valida cada um (anti DNS-rebinding básico).
  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) throw new UnsafeUrlError("Host não resolvido.");
    for (const { address } of addresses) {
      if (isPrivateIp(address)) throw new UnsafeUrlError();
    }
  } catch (e) {
    if (e instanceof UnsafeUrlError) throw e;
    throw new UnsafeUrlError("Falha ao resolver host.");
  }
  return url;
}

export type SafeFetchResult = {
  status: number;
  contentType: string;
  body: string;
  finalUrl: string;
};

/**
 * GET com SSRF-guard em cada redirect, timeout e cap de bytes.
 * Lê no máximo MAX_BYTES e encerra a conexão depois.
 */
export async function safeFetchText(
  rawUrl: string,
  opts: { maxBytes?: number } = {},
): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  let currentUrl = rawUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const safeUrl = await assertSafeUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(safeUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "NexoraBot/1.0 (+https://nexorachat.cloud)",
          Accept: "text/html,application/json,oembed+json,*/*;q=0.8",
        },
      });
    } catch {
      clearTimeout(timer);
      throw new Error("Falha ao contatar o serviço externo.");
    }
    clearTimeout(timer);

    // Redirect: valida o próximo destino pelo mesmo guard.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect sem destino.");
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }
    if (!res.ok) {
      throw new Error(`Serviço respondeu ${res.status}.`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    // Lê no máximo maxBytes do stream.
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, contentType, body: "", finalUrl: safeUrl.toString() };
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (received >= maxBytes) {
        void reader.cancel().catch(() => {});
        break;
      }
    }
    const body = Buffer.concat(chunks).subarray(0, maxBytes).toString("utf8");
    return {
      status: res.status,
      contentType,
      body,
      finalUrl: safeUrl.toString(),
    };
  }
  throw new Error("Excesso de redirecionamentos.");
}

/** JSON com guard SSRF (oEmbed/APIs oficiais). */
export async function safeFetchJson<T>(url: string): Promise<T> {
  const res = await safeFetchText(url, { maxBytes: 200_000 });
  if (!contentTypeIsJson(res.contentType) && !res.body.trimStart().startsWith("{")) {
    throw new Error("Resposta não é JSON.");
  }
  return JSON.parse(res.body) as T;
}

export function contentTypeIsJson(contentType: string): boolean {
  return /json/i.test(contentType);
}

export function contentTypeIsHtml(contentType: string): boolean {
  return /text\/html/i.test(contentType);
}
