export interface PlatformAPI {
  isDesktop: () => boolean;
  getPlatform: () => string;
  getDesktopVersion: () => Promise<string>;
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  getWindowState: () => Promise<WindowState>;
  setMinimizeToTray: (value: boolean) => Promise<void>;
  getMinimizeToTray: () => Promise<boolean>;
  setAutolaunch: (enabled: boolean) => Promise<void>;
  getAutolaunch: () => Promise<boolean>;
  getShowNotificationContent: () => Promise<boolean>;
  setShowNotificationContent: (value: boolean) => Promise<void>;
  getPlayNotificationSound: () => Promise<boolean>;
  setPlayNotificationSound: (value: boolean) => Promise<void>;
  showNotification: (
    title: string,
    body: string,
    conversationId?: string
  ) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  pickFiles: (multiple?: boolean) => Promise<string[]>;
  saveFile: (suggestedName: string, data: Uint8Array) => Promise<string>;
  showInFolder: (path: string) => Promise<void>;
  getCacheSize: () => Promise<number>;
  clearCache: () => Promise<void>;
  openLogsFolder: () => Promise<void>;
  getDiagnostics: () => Promise<DiagnosticsInfo>;
  setSecureSession: (session: SessionData) => Promise<void>;
  getSecureSession: () => Promise<SessionData | null>;
  clearSecureSession: () => Promise<void>;
  hasSecureSession: () => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<void>;
  getClipboardText: () => Promise<string>;
}

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
  fullscreen: boolean;
}

export interface SessionData {
  token: string;
  refresh_token?: string;
  expires_at?: number;
  user_id?: number;
  username?: string;
}

export interface DiagnosticsInfo {
  app: string;
  version: string;
  os: string;
  webview: string;
  tauri: string;
  arch: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  conversationId?: string;
}

export interface FilePickerOptions {
  multiple?: boolean;
  filters?: FileFilter[];
}

export interface FileFilter {
  name: string;
  extensions: string[];
}
