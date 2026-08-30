const isDesktop = typeof window !== "undefined" && !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

const configuredApiOrigin =
  (import.meta.env.VITE_API_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, "") ?? "";

const configuredWsOrigin =
  (import.meta.env.VITE_WS_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, "") ?? "";

const desktopApiOrigin =
  (import.meta.env.VITE_DESKTOP_API_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, "") ?? "";

const desktopWsOrigin =
  (import.meta.env.VITE_DESKTOP_WS_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, "") ?? "";

function getApiOrigin(): string {
  if (isDesktop && desktopApiOrigin) return desktopApiOrigin;
  return configuredApiOrigin;
}

function getWsOrigin(): string {
  if (isDesktop && desktopWsOrigin) return desktopWsOrigin;
  return configuredWsOrigin;
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const origin = getApiOrigin();
  if (origin) return `${origin}${normalizedPath}`;
  return normalizedPath;
}

export function websocketUrl(path = "/ws"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const origin = getWsOrigin();
  if (origin) {
    return `${origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}${normalizedPath}`;
  }
  if (getApiOrigin()) {
    return `${getApiOrigin().replace(/^http:/, "ws:").replace(/^https:/, "wss:")}${normalizedPath}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${normalizedPath}`;
}

export function getCurrentApiOrigin(): string {
  return getApiOrigin();
}

export function getCurrentWsOrigin(): string {
  return getWsOrigin();
}

export { isDesktop };