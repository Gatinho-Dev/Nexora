import type {
  PlatformAPI,
  WindowState,
  SessionData,
  DiagnosticsInfo,
} from "./types";

export const webPlatform: PlatformAPI = {
  isDesktop: () => false,
  getPlatform: () => "web",
  getDesktopVersion: async () => "N/A",
  showWindow: async () => {},
  hideWindow: async () => {},
  minimizeWindow: async () => {},
  maximizeWindow: async () => {},
  isWindowMaximized: async () => false,
  closeWindow: async () => {},
  getWindowState: async (): Promise<WindowState> => ({
    width: window.innerWidth,
    height: window.innerHeight,
    maximized: false,
    fullscreen: false,
  }),
  setMinimizeToTray: async () => {},
  getMinimizeToTray: async () => false,
  setAutolaunch: async () => {},
  getAutolaunch: async () => false,
  getShowNotificationContent: async () => true,
  setShowNotificationContent: async () => {},
  getPlayNotificationSound: async () => true,
  setPlayNotificationSound: async () => {},
  showNotification: async (
    title: string,
    body: string,
    conversationId?: string
  ) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        tag: conversationId,
      });
      if (conversationId) {
        notification.onclick = () => {
          window.focus();
          window.dispatchEvent(
            new CustomEvent("notification-click", { detail: conversationId })
          );
        };
      }
    }
  },
  openExternalUrl: async (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  pickFiles: async (): Promise<string[]> => [],
  saveFile: async (): Promise<string> => "",
  showInFolder: async () => {},
  getCacheSize: async (): Promise<number> => 0,
  clearCache: async () => {},
  openLogsFolder: async () => {},
  getDiagnostics: async (): Promise<DiagnosticsInfo> => ({
    app: "Nexora Web",
    version: "unknown",
    os: navigator.platform,
    webview: "browser",
    tauri: "N/A",
    arch: "unknown",
  }),
  setSecureSession: async () => {},
  getSecureSession: async (): Promise<SessionData | null> => null,
  clearSecureSession: async () => {},
  hasSecureSession: async (): Promise<boolean> => false,
  copyToClipboard: async (text: string) => {
    await navigator.clipboard.writeText(text);
  },
  getClipboardText: async (): Promise<string> => {
    return await navigator.clipboard.readText();
  },
  openLoginInBrowser: async () => {
    // Web platform: just redirect to login page
    window.location.href = "/login";
  },
};
