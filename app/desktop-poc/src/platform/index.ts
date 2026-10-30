import type { PlatformAPI } from "./types";
import { webPlatform } from "./web";
import { desktopPlatform } from "./desktop";

const isTauriEnvironment = () => {
  if (typeof window === "undefined") return false;
  return !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
};

export const platform: PlatformAPI = isTauriEnvironment()
  ? desktopPlatform
  : webPlatform;

export const isDesktop = platform.isDesktop();
export const getPlatform = platform.getPlatform;

export { type PlatformAPI, type WindowState, type SessionData, type DiagnosticsInfo } from "./types";