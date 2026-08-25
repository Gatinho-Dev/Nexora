/**
 * Parser de User-Agent — puro, sem dependências.
 * Identifica navegador, sistema operacional e tipo de dispositivo a partir
 * do User-Agent (e Client Hints quando presentes). Nunca promete precisão
 * que o navegador não fornece.
 */

export type ParsedUserAgent = {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
};

/** Ordem importa: engines derivadas antes das originais. */
export function parseUserAgent(ua: string, secChUa?: string | null): ParsedUserAgent {
  const s = ua.slice(0, 300);

  // Client Hints têm prioridade quando disponíveis (Chromium moderno).
  let browser: string;
  if (secChUa) {
    const brands = secChUa.split(",").map(b => b.trim().replace(/"/g, ""));
    const real = brands.find(
      b => !/Not.A.Brand|Chromium/i.test(b)
    )?.split(";")[0]?.trim();
    browser = /Brave/i.test(s)
      ? "Brave"
      : /Edg\//.test(s)
        ? "Edge"
        : /OPR\//.test(s)
          ? "Opera"
          : real || "Chrome";
  } else if (/Edg\//.test(s)) {
    browser = "Edge";
  } else if (/OPR\/|Opera/.test(s)) {
    browser = "Opera";
  } else if (/Firefox|FxiOS/.test(s)) {
    browser = "Firefox";
  } else if (/Brave/.test(s)) {
    browser = "Brave";
  } else if (/Chrome|CriOS/.test(s)) {
    browser = "Chrome";
  } else if (/Safari/.test(s)) {
    browser = "Safari";
  } else {
    browser = "Navegador desconhecido";
  }

  let os: string;
  let deviceType: ParsedUserAgent["deviceType"];
  if (/iPhone|iPod/.test(s)) {
    os = "iOS";
    deviceType = "mobile";
  } else if (/iPad/.test(s)) {
    os = "iPadOS";
    deviceType = "tablet";
  } else if (/Android/.test(s)) {
    os = "Android";
    deviceType = /Mobile/.test(s) ? "mobile" : "tablet";
  } else if (/Windows/.test(s)) {
    os = "Windows";
    deviceType = "desktop";
  } else if (/Mac OS X|Macintosh/.test(s)) {
    os = "macOS";
    deviceType = "desktop";
  } else if (/CrOS/.test(s)) {
    os = "ChromeOS";
    deviceType = "desktop";
  } else if (/Linux/.test(s)) {
    os = "Linux";
    deviceType = "desktop";
  } else {
    os = "Desconhecido";
    deviceType = "unknown";
  }

  return { browser, os, deviceType };
}

/** Nome amigável do dispositivo: "Chrome no Windows", "Safari no iPhone". */
export function friendlyDeviceName(parsed: ParsedUserAgent): string {
  return `${parsed.browser} no ${parsed.os}`;
}
