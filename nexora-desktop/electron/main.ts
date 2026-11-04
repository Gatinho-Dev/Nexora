import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  safeStorage,
  shell,
  session,
  Tray,
  Menu,
  Notification,
  dialog,
} from "electron";
import { join, resolve, sep, extname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import WebSocket from "ws";
import { initUpdater, startUpdateChecks, stopUpdateChecks, checkForUpdates, installUpdate, getUpdateState } from "./updater";
import {
  API_ORIGIN,
  trustedFrame,
  safeExternal,
  validRpc,
  validTyping,
  validVoiceOutbound,
  mediaPermissionAllowed,
  allowedUploadType,
} from "./security";

const dev = !app.isPackaged && process.argv.includes("--dev");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "nexora",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
app.enableSandbox();
let win: BrowserWindow | null = null;
let token: string | null = null;
let socket: WebSocket | null = null;
let timer: NodeJS.Timeout | null = null;
let heartbeat: NodeJS.Timeout | null = null;
let retry = 1000;
let generation = 0;
let tray: Tray | null = null;
let quitting = false;
let settings = { notifications: false, minimizeToTray: false };
const settingsFile = () => join(app.getPath("userData"), "desktop-settings.json");
async function loadSettings() {
  try {
    const saved = JSON.parse(await readFile(settingsFile(), "utf8"));
    settings = { notifications: saved.notifications === true, minimizeToTray: saved.minimizeToTray === true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("Não foi possível ler as configurações do Desktop.", error);
  }
}
async function setSettings(patch: unknown) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Configurações inválidas.");
  const changes = patch as Record<string, unknown>;
  if (!Object.keys(changes).length || Object.entries(changes).some(([key, value]) => !["notifications", "minimizeToTray"].includes(key) || typeof value !== "boolean")) throw new Error("Configurações inválidas.");
  if (changes.minimizeToTray === true && !tray) throw new Error("A bandeja do sistema não está disponível.");
  const next = { ...settings, ...changes };
  await writeFile(settingsFile(), JSON.stringify(next), { mode: 0o600 });
  settings = next;
  updateTray();
  win?.webContents.send("desktop:settings", settings);
  return { ...settings, trayAvailable: !!tray };
}
function updateTray() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir Nexora", click: () => { win?.show(); win?.focus(); } },
    { label: "Notificações", type: "checkbox", checked: settings.notifications, click: (item) => { void setSettings({ notifications: item.checked }).catch(error => console.error("Erro ao salvar preferências:", error)); } },
    { type: "separator" },
    { label: "Encerrar aplicativo", click: () => { quitting = true; app.quit(); } },
  ]));
}
async function notify(event: { type?: unknown; conversationId?: unknown; serverId?: unknown; channelId?: unknown }) {
  if (!settings.notifications || !token || !win || win.isFocused() || !Notification.isSupported()) return;
  if (event.type !== "dm" && event.type !== "mention") return;
  const currentGeneration = generation;
  try {
    const me = (await request("auth.me", undefined, false)).value as { status?: string };
    if (me.status === "dnd") return;
    if (event.conversationId && Number.isSafeInteger(event.conversationId)) {
      const conversations = (await request("dm.list", undefined, false)).value as { id: number; mutedForever?: boolean; mutedUntil?: string | null }[];
      const conversation = conversations.find(c => c.id === event.conversationId);
      if (!conversation || conversation.mutedForever || (conversation.mutedUntil && new Date(conversation.mutedUntil).getTime() > Date.now())) return;
    } else if (event.serverId && event.channelId && Number.isSafeInteger(event.serverId) && Number.isSafeInteger(event.channelId)) {
      const pref = (await request("server.notificationPreferences", { serverId: event.serverId }, false)).value as { level?: string; mutedUntil?: string | null };
      if (pref.level === "none" || (pref.mutedUntil && new Date(pref.mutedUntil).getTime() > Date.now())) return;
    } else return;
    if (currentGeneration !== generation || !settings.notifications || !token || !win || win.isFocused()) return;
    const notification = new Notification({ title: "Nexora", body: "Você recebeu uma notificação.", silent: true });
    notification.on("click", () => { win?.show(); win?.focus(); win?.webContents.send("desktop:navigate", { conversationId: event.conversationId, serverId: event.serverId, channelId: event.channelId }); });
    notification.show();
  } catch (error) { console.error("Não foi possível verificar as preferências de notificação:", error); }
}
const sessionFile = () => join(app.getPath("userData"), "session.enc");
const secureStoreAvailable = () =>
  safeStorage.isEncryptionAvailable() &&
  (process.platform !== "linux" ||
    safeStorage.getSelectedStorageBackend() !== "basic_text");

async function restore() {
  if (!secureStoreAvailable()) return;
  try {
    token = safeStorage.decryptString(await readFile(sessionFile()));
  } catch {
    token = null;
  }
}
async function persist(value: string) {
  if (!secureStoreAvailable()) return;
  await writeFile(sessionFile(), safeStorage.encryptString(value), {
    mode: 0o600,
  });
}
function disconnect() {
  generation++;
  if (timer) clearTimeout(timer);
  if (heartbeat) clearInterval(heartbeat);
  timer = null;
  heartbeat = null;
  socket?.removeAllListeners();
  socket?.close();
  socket = null;
}
function connect() {
  disconnect();
  if (!token) return;
  const current = generation;
  const open = () => {
    if (current !== generation || !token) return;
    const ws = new WebSocket("wss://nexorachat.cloud/ws", {
      headers: { Authorization: `Bearer ${token}` },
    });
    socket = ws;
    ws.on("open", () => {
      retry = 1000;
      win?.webContents.send("realtime:event", {
        t: "connection",
        connected: true,
      });
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ t: "ping" }));
      }, 25000);
    });
    ws.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString());
        if (!event || typeof event.t !== "string") return;
        if (event.t === "session:revoked") {
          void clearSession();
        }
        win?.webContents.send("realtime:event", event);
        if (event.t === "notification" && event.notification && typeof event.notification === "object") void notify(event.notification);
      } catch {
        /* Discard malformed frames. */
      }
    });
    ws.on("error", () => ws.close());
    ws.on("close", () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      if (current !== generation) return;
      win?.webContents.send("realtime:event", {
        t: "connection",
        connected: false,
      });
      timer = setTimeout(open, retry);
      retry = Math.min(retry * 2, 30000);
    });
  };
  open();
}
async function clearSession() {
  disconnect();
  token = null;
  try {
    await unlink(sessionFile());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
const MAX_UPLOAD_MB = 8;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const pickedFiles = new Set<string>();
function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  const types: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
    ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".zip": "application/zip", ".txt": "text/plain", ".md": "text/plain", ".csv": "text/plain",
  };
  return types[ext] ?? "application/octet-stream";
}
async function request(path: string, input: unknown, mutation: boolean) {
  const url = new URL(`/api/trpc/${path}`, API_ORIGIN);
  if (!mutation && input !== undefined)
    url.searchParams.set("input", JSON.stringify({ json: input }));
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (mutation) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method: mutation ? "POST" : "GET",
    headers,
    body: mutation ? JSON.stringify({ json: input ?? null }) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response.json()) as {
    result?: { data?: { json?: unknown } };
    error?: { json?: { message?: string }; message?: string };
  };
  if (!response.ok || body.error)
    throw new Error(
      body.error?.json?.message ||
        body.error?.message ||
        `Erro da API (${response.status}).`,
    );
  return {
    value: body.result?.data?.json,
    cookies: response.headers.getSetCookie(),
  };
}
function guard(event: Electron.IpcMainInvokeEvent) {
  if (
    !win ||
    event.sender !== win.webContents ||
    event.senderFrame !== win.webContents.mainFrame ||
    !trustedFrame(event.senderFrame.url, dev)
  )
    throw new Error("Origem IPC não autorizada.");
}
app
  .whenReady()
  .then(async () => {
    await restore();
    await loadSettings();
    const root = resolve(__dirname, "../dist");
    protocol.handle("nexora", (request) => {
      const u = new URL(request.url);
      if (u.hostname !== "app")
        return new Response("Not found", { status: 404 });
      const path = resolve(root, `.${decodeURIComponent(u.pathname)}`);
      if (path !== root && !path.startsWith(root + sep))
        return new Response("Forbidden", { status: 403 });
      const file = extname(path) ? path : join(root, "index.html");
      return net.fetch(pathToFileURL(file).href);
    });
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_webContents, permission, callback, details) =>
      callback(
        mediaPermissionAllowed(permission, details.requestingUrl, dev),
      ),
    );
    ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
      permission === "media" &&
      trustedFrame(`${requestingOrigin}/`, dev),
    );
    ses.setDisplayMediaRequestHandler((_request, callback) => callback(null));
    ses.webRequest.onHeadersReceived((details, callback) => {
      if (trustedFrame(details.url, dev)) {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'",
            ],
          },
        });
      } else callback({ responseHeaders: details.responseHeaders });
    });
    win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 860,
      minHeight: 600,
      title: "Nexora Desktop",
      backgroundColor: "#17181e",
      icon: join(__dirname, "../resources/icon.png"),
      webPreferences: {
        preload: join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    try {
      tray = new Tray(join(__dirname, "../resources/icon.png"));
      tray.setToolTip("Nexora Desktop");
      tray.on("click", () => { win?.show(); win?.focus(); });
      updateTray();
    } catch (error) { console.error("Bandeja indisponível:", error); tray = null; }
    win.on("close", (event) => { if (!quitting && settings.minimizeToTray && tray) { event.preventDefault(); win?.hide(); } });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
      if (!trustedFrame(url, dev)) event.preventDefault();
    });
    ipcMain.handle("auth:login", async (event, credentials: unknown) => {
      guard(event);
      if (!credentials || typeof credentials !== "object")
        throw new Error("Credenciais inválidas.");
      const { identifier, password, code } = credentials as Record<
        string,
        unknown
      >;
      if (
        typeof identifier !== "string" ||
        identifier.length > 320 ||
        !identifier.trim() ||
        typeof password !== "string" ||
        !password ||
        password.length > 128 ||
        (code !== undefined && (typeof code !== "string" || code.length > 32))
      )
        throw new Error("Credenciais inválidas.");
      const { value, cookies } = await request(
        "account.login",
        { identifier: identifier.trim(), password, ...(code ? { code } : {}) },
        true,
      );
      const result = value as { requiresTwoFactor?: boolean; user?: unknown };
      if (!result?.requiresTwoFactor) {
        const cookie = cookies.find((c) => c.startsWith("nexora_sid="));
        const newToken = cookie?.split(";")[0].slice("nexora_sid=".length);
        if (!newToken) throw new Error("O servidor não retornou uma sessão.");
        await clearSession();
        await persist(newToken);
        token = newToken;
        connect();
      }
      return result;
    });
    ipcMain.handle("api:rpc", async (event, path: unknown, input: unknown) => {
      guard(event);
      if (!validRpc(path, input)) throw new Error("Operação inválida.");
      const name = path as string;
      const { value } = await request(
        name,
        input,
        ["message.send", "message.edit", "message.delete", "message.addReaction", "message.removeReaction", "message.markRead", "auth.logout"].includes(name),
      );
      if (name === "auth.logout") await clearSession();
      return value;
    });
    ipcMain.handle("files:pick", async (event) => {
      guard(event);
      const window = BrowserWindow.fromWebContents(event.sender);
      const picked = window
        ? await dialog.showOpenDialog(window, { title: "Anexar arquivos", properties: ["openFile", "multiSelections"] })
        : await dialog.showOpenDialog({ title: "Anexar arquivos", properties: ["openFile", "multiSelections"] });
      if (picked.canceled) return [];
      const files: { path: string; name: string; size: number; mimeType: string }[] = [];
      for (const path of picked.filePaths.slice(0, 10)) {
        const info = await stat(path);
        const mimeType = mimeFor(path);
        if (!info.isFile() || info.size <= 0 || info.size > MAX_UPLOAD_BYTES)
          throw new Error(`"${basename(path)}" está vazio ou excede ${MAX_UPLOAD_MB} MB.`);
        if (!allowedUploadType(mimeType))
          throw new Error(`Tipo de arquivo não permitido: ${basename(path)}`);
        pickedFiles.add(path);
        files.push({ path, name: basename(path), size: info.size, mimeType });
      }
      return files;
    });
    ipcMain.handle("files:upload", async (event, paths: unknown) => {
      guard(event);
      if (!Array.isArray(paths) || paths.length === 0 || paths.length > 10 || !paths.every((p) => typeof p === "string"))
        throw new Error("Anexos inválidos.");
      const ids: number[] = [];
      for (const path of paths as string[]) {
        if (!pickedFiles.has(path)) throw new Error("Anexo não selecionado.");
        const info = await stat(path);
        if (!info.isFile() || info.size <= 0 || info.size > MAX_UPLOAD_BYTES) throw new Error("Anexo excede o limite.");
        const bytes = await readFile(path);
        const name = basename(path).slice(0, 255);
        const mimeType = mimeFor(path);
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: mimeType }), name);
        const response = await fetch(new URL("/api/upload", API_ORIGIN), {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
          redirect: "error",
          signal: AbortSignal.timeout(60000),
        });
        const body = (await response.json().catch(() => ({}))) as { id?: number; error?: string };
        if (!response.ok || typeof body.id !== "number")
          throw new Error(body.error || `Falha no envio (${response.status}).`);
        ids.push(body.id);
        pickedFiles.delete(path);
      }
      return ids;
    });
    ipcMain.handle("app:external", async (event, url: unknown) => {
      guard(event);
      if (typeof url !== "string" || !safeExternal(url))
        throw new Error("URL não permitida.");
      await shell.openExternal(url);
    });
    ipcMain.handle("desktop:getSettings", (event) => { guard(event); return { ...settings, trayAvailable: !!tray }; });
    ipcMain.handle("desktop:setSettings", (event, patch: unknown) => { guard(event); return setSettings(patch); });
    ipcMain.handle("app:version", (event) => {
      guard(event);
      return app.getVersion();
    });
    ipcMain.handle("updater:state", (event) => {
      guard(event);
      return getUpdateState();
    });
    ipcMain.handle("updater:check", (event) => {
      guard(event);
      return checkForUpdates();
    });
    ipcMain.handle("updater:install", (event) => {
      guard(event);
      installUpdate();
    });
    let lastTyping = 0;
    ipcMain.handle("realtime:typing", (event, target: unknown) => {
      guard(event);
      if (!validTyping(target)) throw new Error("Destino inválido.");
      if (socket?.readyState !== WebSocket.OPEN || Date.now() - lastTyping < 3000) return false;
      lastTyping = Date.now();
      socket.send(JSON.stringify({ t: "typing", ...(target as object) }));
      return true;
    });
    ipcMain.handle("app:connected", (event) => {
      guard(event);
      return socket?.readyState === WebSocket.OPEN;
    });
    ipcMain.handle("voice:send", (event, message: unknown) => {
      guard(event);
      if (!validVoiceOutbound(message)) throw new Error("Evento de voz inválido.");
      if (socket?.readyState !== WebSocket.OPEN) throw new Error("Sem conexão em tempo real.");
      socket.send(JSON.stringify(message));
      return true;
    });
    ipcMain.handle("voice:iceServers", async (event) => {
      guard(event);
      const response = await fetch(`${API_ORIGIN}/api/rtc-config`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Configuração de chamada indisponível.");
      const body = (await response.json()) as { iceServers?: unknown };
      if (!Array.isArray(body.iceServers)) throw new Error("Configuração de chamada inválida.");
      return body.iceServers.slice(0, 8);
    });
    win.on("closed", () => {
      win = null;
      disconnect();
    });
    initUpdater((next) => win?.webContents.send("updater:state", next));
    startUpdateChecks();
    if (dev) await win.loadURL("http://127.0.0.1:5174");
    else await win.loadURL("nexora://app/");
    if (token) connect();
  })
  .catch((error) => {
    console.error("Erro ao iniciar Nexora Desktop:", error);
    app.quit();
  });
app.on("before-quit", () => { quitting = true; stopUpdateChecks(); });
app.on("window-all-closed", () => app.quit());
