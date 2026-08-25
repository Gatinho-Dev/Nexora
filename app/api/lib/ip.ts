/**
 * Captura do IP real do cliente.
 *
 * O Nexora roda exclusivamente atrás de proxy da plataforma (Render etc.):
 * o socket chega sempre do proxy, então o `x-forwarded-for` é a única
 * fonte do IP original. Validamos estritamente o formato (IPv4/IPv6) e
 * NUNCA aceitamos IP enviado pelo frontend. Suporta IPv6 (coluna varchar).
 */

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]{2,45}$/;

function isValidIp(value: string): boolean {
  if (IPV4.test(value)) {
    return value.split(".").every(o => Number(o) <= 255);
  }
  return IPV6.test(value) && value.includes(":");
}

/** Primeiro IP válido e público-plausível do header X-Forwarded-For. */
export function getClientIp(headers: Headers, remoteAddress?: string | null): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    for (const part of xff.split(",")) {
      const candidate = part.trim();
      // Ignora redes privadas/loopback à esquerda da cadeia de proxies.
      if (
        candidate &&
        !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|^fc|^fd)/.test(candidate) &&
        isValidIp(candidate)
      ) {
        return candidate.slice(0, 64);
      }
    }
  }
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? remoteAddress ?? "";
  const clean = direct.replace(/^::ffff:/, "").trim();
  return clean && isValidIp(clean) ? clean.slice(0, 64) : null;
}
