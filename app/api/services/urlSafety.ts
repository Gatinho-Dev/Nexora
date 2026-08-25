/**
 * UrlSafetyService — detecção LOCAL de links suspeitos (phishing/golpe).
 * Não depende de LLM: heurísticas determinísticas, rápidas e auditáveis.
 * Usado pelo AutoMod e como regra rápida antes da análise por IA.
 */

export type UrlVerdict = {
  suspicious: boolean;
  reasons: string[];
};

const SUSPICIOUS_TLDS = new Set([
  "zip", "mov", "tk", "ml", "ga", "cf", "gq", "xyz", "top", "work",
  "click", "link", "fit", "rest", "cam", "quest", "cfd", "sbs",
]);

/** Encurtadores populares — escondem o destino real. */
const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "shorturl.at", "cutt.ly", "rb.gy", "tiny.cc", "shorte.st",
]);

/** Palavras-chave comuns em phishing (host ou caminho). */
const PHISHING_KEYWORDS = [
  "free-nitro", "discordnitro", "nitro-free", "steamcommuniy",
  "steamcommunity-", "discrod", "dicsord", "giveaway-", "-giveaway",
  "airdrops", "free-skins", "robux-free", "vbucks", "login-secure",
  "verify-account", "account-verify", "recover-account", "gift-drop",
];

const SUSPICIOUS_FILE_TYPES = [".exe", ".scr", ".bat", ".cmd", ".msi", ".apk", ".jar"];

function registrableDomain(hostname: string): string {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  // Heurística simples: últimos 2 labels (suficiente para heurística local).
  return parts.slice(-2).join(".");
}

/** Analisa UMA URL. Pura — unit-tested. */
export function inspectUrl(rawUrl: string): UrlVerdict {
  const reasons: string[] = [];
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { suspicious: false, reasons }; // não-URL não é problema aqui
  }

  const host = url.hostname.toLowerCase();

  // IP literal como host é padrão clássico de infra efêmera.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) reasons.push("ip_literal_host");
  if (host.startsWith("xn--") || host.includes(".xn--")) reasons.push("punycode");

  const tld = host.split(".").pop() ?? "";
  if (SUSPICIOUS_TLDS.has(tld)) reasons.push("suspicious_tld");

  if (URL_SHORTENERS.has(registrableDomain(host))) reasons.push("url_shortener");

  // Credenciais embutidas na URL.
  if (url.username || url.password) reasons.push("embedded_credentials");

  const full = `${host}${url.pathname.toLowerCase()}`;
  for (const keyword of PHISHING_KEYWORDS) {
    if (full.includes(keyword)) {
      reasons.push("phishing_keyword");
      break;
    }
  }
  for (const ext of SUSPICIOUS_FILE_TYPES) {
    if (url.pathname.toLowerCase().endsWith(ext)) {
      reasons.push("executable_download");
      break;
    }
  }

  return { suspicious: reasons.length > 0, reasons };
}

/** Extrai URLs de um texto (http/https + www.). */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+/gi) ?? [];
  return matches
    .map(u => (u.startsWith("www.") ? `https://${u}` : u))
    .slice(0, 10);
}

/** Verdicto agregado de um texto inteiro. */
export function inspectTextForUrls(
  text: string,
  opts: { blockInvites?: boolean } = {}
): UrlVerdict & { inviteLink: boolean; urls: string[] } {
  const urls = extractUrls(text);
  let inviteLink = false;
  const allReasons = new Set<string>();
  let suspicious = false;

  // Convites de plataformas de chat concorrentes / do próprio Nexora fora
  // de contexto confiável são tratados pelo AutoMod (rule invites).
  if (/discord\.gg\/|discord\.com\/invite\/|chat\.whatsapp\.com\/|t\.me\/joinchat|telegram\.me\//i.test(text)) {
    inviteLink = true;
  }

  for (const url of urls) {
    const verdict = inspectUrl(url);
    if (verdict.suspicious) {
      suspicious = true;
      for (const r of verdict.reasons) allReasons.add(r);
    }
  }

  void opts;
  return { suspicious, reasons: [...allReasons], inviteLink, urls };
}
