import type {
  PlatformAPI,
  WindowState,
  SessionData,
  DiagnosticsInfo,
} from "./types";

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
      event: {
        listen: (event: string, handler: (e: unknown) => void) => Promise<() => void>;
        emit: (event: string, payload?: unknown) => Promise<void>;
      };
      clipboard: {
        writeText: (text: string) => Promise<void>;
        readText: () => Promise<string>;
      };
    };
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauri = () => {
  return typeof window !== "undefined" && !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
};

const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauri() || !window.__TAURI__) {
    throw new Error("Tauri not available");
  }
  return window.__TAURI__.core.invoke(cmd, args) as Promise<T>;
};

export const desktopPlatform: PlatformAPI = {
  isDesktop: () => true,
  getPlatform: () => "linux",
  getDesktopVersion: async () => {
    try {
      return await invoke<string>("get_desktop_version");
    } catch {
      return "unknown";
    }
  },
  showWindow: async () => {
    await invoke("show_window");
  },
  hideWindow: async () => {
    await invoke("hide_window");
  },
  minimizeWindow: async () => {
    await invoke("minimize_window");
  },
  maximizeWindow: async () => {
    await invoke("maximize_window");
  },
  isWindowMaximized: async () => {
    try {
      return await invoke<boolean>("is_window_maximized");
    } catch {
      return false;
    }
  },
  closeWindow: async () => {
    await invoke("close_window");
  },
  getWindowState: async () => {
    return await invoke<WindowState>("get_window_state");
  },
  setMinimizeToTray: async (value: boolean) => {
    await invoke("set_minimize_to_tray", { value });
  },
  getMinimizeToTray: async () => {
    try {
      return await invoke<boolean>("get_minimize_to_tray");
    } catch {
      return true;
    }
  },
  setAutolaunch: async (enabled: boolean) => {
    await invoke("set_autolaunch", { enabled });
  },
  getAutolaunch: async () => {
    try {
      return await invoke<boolean>("get_autolaunch");
    } catch {
      return false;
    }
  },
  getShowNotificationContent: async () => {
    try {
      return await invoke<boolean>("get_show_notification_content");
    } catch {
      return true;
    }
  },
  setShowNotificationContent: async (value: boolean) => {
    await invoke("set_show_notification_content", { value });
  },
  getPlayNotificationSound: async () => {
    try {
      return await invoke<boolean>("get_play_notification_sound");
    } catch {
      return true;
    }
  },
  setPlayNotificationSound: async (value: boolean) => {
    await invoke("set_play_notification_sound", { value });
  },
  showNotification: async (
    title: string,
    body: string,
    conversationId?: string
  ) => {
    await invoke("show_notification", { title, body, conversation_id: conversationId });
  },
  openExternalUrl: async (url: string) => {
    await invoke("open_external_url", { url });
  },
  pickFiles: async (multiple?: boolean) => {
    return await invoke<string[]>("pick_files", { multiple: multiple ?? false });
  },
  saveFile: async (suggestedName: string, data: Uint8Array) => {
    return await invoke<string>("save_file", {
      suggested_name: suggestedName,
      data: Array.from(data),
    });
  },
  showInFolder: async (path: string) => {
    await invoke("show_in_folder", { path });
  },
  getCacheSize: async () => {
    return await invoke<number>("get_cache_size");
  },
  clearCache: async () => {
    await invoke("clear_cache");
  },
  openLogsFolder: async () => {
    await invoke("open_logs_folder");
  },
  getDiagnostics: async () => {
    return await invoke<DiagnosticsInfo>("get_diagnostics");
  },
  setSecureSession: async (session: SessionData) => {
    await invoke("set_secure_session", {
      token: session.token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user_id: session.user_id,
      username: session.username,
    });
  },
  getSecureSession: async () => {
    try {
      return await invoke<SessionData | null>("get_secure_session");
    } catch {
      return null;
    }
  },
  clearSecureSession: async () => {
    await invoke("clear_secure_session");
  },
  hasSecureSession: async () => {
    try {
      return await invoke<boolean>("has_secure_session");
    } catch {
      return false;
    }
  },
  copyToClipboard: async (text: string) => {
    if (isTauri() && window.__TAURI__) {
      await window.__TAURI__.clipboard.writeText(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
  },
  getClipboardText: async () => {
    if (isTauri() && window.__TAURI__) {
      return await window.__TAURI__.clipboard.readText();
    }
    return await navigator.clipboard.readText();
  },
  openLoginInBrowser: async () => {
    await invoke("open_login_in_browser");
  },
};