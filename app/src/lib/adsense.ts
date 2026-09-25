export const ADSENSE_SITE_URL = "https://nexorachat.cloud";
export const ADSENSE_PUBLISHER_ID = "pub-9433688755768515";
export const ADSENSE_PUBLISHER_NUMBER = ADSENSE_PUBLISHER_ID.replace(/^pub-/, "");
export const ADSENSE_SCRIPT_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9433688755768515";
export const ADSENSE_ADS_TXT_CONTENT =
  "google.com, pub-9433688755768515, DIRECT, f08c47fec0942fa0";

const ADSENSE_SCRIPT_SELECTOR =
  'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]';

type GoogleFundingChoicesCallback = Record<string, () => void>;

type GoogleFundingChoicesQueue =
  | GoogleFundingChoicesCallback[]
  | { push: (callback: GoogleFundingChoicesCallback) => unknown };

type GoogleFundingChoicesApi = {
  callbackQueue?: GoogleFundingChoicesQueue;
  showRevocationMessage?: () => void;
};

type AdSenseWindow = Window & {
  googlefc?: GoogleFundingChoicesApi;
};

const GOOGLE_FUNDING_CHOICES_TIMEOUT_MS = 8_000;

function getGoogleFundingChoicesApi(
  create = false,
): AdSenseWindow["googlefc"] | null {
  if (typeof window === "undefined") return null;

  const adsenseWindow = window as AdSenseWindow;
  if (!adsenseWindow.googlefc && create) {
    adsenseWindow.googlefc = {};
  }

  const api = adsenseWindow.googlefc;
  if (api && (typeof api !== "object" || api === null)) return null;
  if (api && !api.callbackQueue && create) {
    api.callbackQueue = [];
  }

  return api ?? null;
}

/**
 * Prepara apenas o namespace/fila documentados pela API oficial do Google.
 * A mensagem, o TCF, os valores de Consent Mode e a decisão do usuário
 * continuam pertencendo ao Google Funding Choices/Privacy & messaging.
 */
export function prepareGoogleFundingChoicesApi(): void {
  getGoogleFundingChoicesApi(true);
}

/**
 * Abre o gerenciador oficial da mensagem europeia do Google.
 *
 * O AdSense carrega essa API quando a mensagem publicada no Privacy &
 * messaging está disponível. A função agenda a chamada em
 * CONSENT_API_READY para cobrir a corrida entre o carregamento assíncrono da
 * tag e a abertura da tela pelo usuário; não cria banner, estado ou TCF
 * paralelo no Nexora.
 */
export function openAdSensePrivacySettings(): Promise<boolean> {
  const api = getGoogleFundingChoicesApi(true);
  if (!api || typeof window === "undefined") return Promise.resolve(false);

  if (typeof api.showRevocationMessage === "function") {
    try {
      api.showRevocationMessage();
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  const queue = api.callbackQueue;
  if (!queue || !("push" in queue)) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;
    const finish = (opened: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(opened);
    };
    const openWhenReady = () => {
      if (settled) return;
      const readyApi = getGoogleFundingChoicesApi();
      if (!readyApi || typeof readyApi.showRevocationMessage !== "function") {
        return;
      }
      try {
        readyApi.showRevocationMessage();
        finish(true);
      } catch {
        finish(false);
      }
    };
    timeoutId = window.setTimeout(
      () => finish(false),
      GOOGLE_FUNDING_CHOICES_TIMEOUT_MS,
    );

    try {
      queue.push({ CONSENT_API_READY: openWhenReady });
    } catch {
      finish(false);
    }
  });
}

/**
 * A tag fica no index.html para estar disponível no primeiro HEAD load.
 * Esta função é uma proteção para HMR, extensões e futures shells: nunca
 * adiciona uma segunda tag quando o Google AdSense já está presente.
 */
export function ensureAdSenseScript(): boolean {
  prepareGoogleFundingChoicesApi();
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
