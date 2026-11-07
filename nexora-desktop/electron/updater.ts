import { app } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdateState = {
  status: "unsupported" | "idle" | "checking" | "available" | "downloading" | "ready" | "upToDate" | "error";
  version?: string;
  percent?: number;
  message?: string;
};

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
let state: UpdateState = { status: "idle" };
let publish: ((next: UpdateState) => void) | null = null;
let timer: NodeJS.Timeout | null = null;

function setState(next: UpdateState) {
  state = next;
  publish?.(state);
}

export function getUpdateState(): UpdateState {
  return state;
}

// Atualizações só fazem sentido no app empacotado; em desenvolvimento o updater fica desligado.
export function initUpdater(send: (next: UpdateState) => void) {
  publish = send;
  if (!app.isPackaged) {
    setState({ status: "unsupported", message: "Atualizações automáticas funcionam apenas na versão instalada." });
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => setState({ status: "checking" }));
  autoUpdater.on("update-available", (info) => setState({ status: "downloading", version: info.version, percent: 0 }));
  autoUpdater.on("update-not-available", () => setState({ status: "upToDate" }));
  autoUpdater.on("download-progress", (progress) =>
    setState({ status: "downloading", version: state.version, percent: Math.round(progress.percent) })
  );
  autoUpdater.on("update-downloaded", (info) => {
    setState({ status: "ready", version: info.version });
    autoUpdater.quitAndInstall(false, true);
  });
  autoUpdater.on("error", (error) => {
    console.error("Falha na atualização automática.", error);
    setState({ status: "error", message: "Não foi possível verificar atualizações agora." });
  });
}

// Verifica ao abrir o app e depois periodicamente, como o Discord.
export function startUpdateChecks() {
  if (!app.isPackaged) return;
  void checkForUpdates();
  timer = setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}

export function stopUpdateChecks() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function checkForUpdates() {
  if (!app.isPackaged) return state;
  if (state.status === "downloading" || state.status === "ready") return state;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("Falha ao consultar atualizações.", error);
    setState({ status: "error", message: "Não foi possível verificar atualizações agora." });
  }
  return state;
}

// Reinicia e instala somente depois de o download estar concluído e confirmado pelo usuário.
export function installUpdate() {
  if (state.status !== "ready") throw new Error("Nenhuma atualização pronta para instalar.");
  autoUpdater.quitAndInstall(false, true);
}
