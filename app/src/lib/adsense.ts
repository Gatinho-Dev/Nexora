export const ADSENSE_SITE_URL = "https://nexorachat.cloud";
export const ADSENSE_PUBLISHER_ID = "pub-9433688755768515";
export const ADSENSE_PUBLISHER_NUMBER = ADSENSE_PUBLISHER_ID.replace(/^pub-/, "");
export const ADSENSE_SCRIPT_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9433688755768515";
export const ADSENSE_ADS_TXT_CONTENT =
  "google.com, pub-9433688755768515, DIRECT, f08c47fec0942fa0";

const ADSENSE_SCRIPT_SELECTOR =
  'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]';

/**
 * A tag fica no index.html para estar disponível no primeiro HEAD load.
 * Esta função é uma proteção para HMR, extensões e futures shells: nunca
 * adiciona uma segunda tag quando o Google AdSense já está presente.
 */
export function ensureAdSenseScript(): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector(ADSENSE_SCRIPT_SELECTOR)) return false;

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = ADSENSE_SCRIPT_SRC;
  script.setAttribute("data-nexora-adsense", "true");
  document.head.appendChild(script);
  return true;
}
