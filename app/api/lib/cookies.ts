import type { CookieOptions } from "hono/utils/cookie";
import { env } from "./env";

function isLocalhost(headers: Headers): boolean {
  if (env.isProduction) return false;
  const rawHost = (headers.get("host") ?? "").trim().toLowerCase();
  const host = rawHost.startsWith("[")
    ? rawHost.slice(1, rawHost.indexOf("]"))
    : rawHost.split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const localhost = isLocalhost(headers);

  return {
    httpOnly: true,
    path: "/",
    sameSite: localhost ? "Lax" : "None",
    secure: !localhost,
  };
}
