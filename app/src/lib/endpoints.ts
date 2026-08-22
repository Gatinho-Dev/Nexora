const configuredApiOrigin =
  (import.meta.env.VITE_API_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, "") ?? "";
const configuredWsOrigin =
  (import.meta.env.VITE_WS_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, "") ?? "";

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${configuredApiOrigin}${normalizedPath}`;
}

export function websocketUrl(path = "/ws"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (configuredWsOrigin) {
    return `${configuredWsOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}${normalizedPath}`;
  }
  if (configuredApiOrigin) {
    return `${configuredApiOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}${normalizedPath}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${normalizedPath}`;
}
