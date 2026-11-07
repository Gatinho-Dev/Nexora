import { app, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

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

// Instalações .deb no Linux não têm APPIMAGE; o electron-updater não as atualiza sozinho.
export function isDebInstall(): boolean {
  return process.platform === "linux" && !process.env.APPIMAGE;
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

const RELEASE_FEED = "https://github.com/Gatinho-Dev/Nexora/releases/latest/download/latest-linux.yml";

// Lê o latest-linux.yml, compara a versão e, se for mais nova, baixa e abre o .deb.
async function checkDebUpdate() {
  setState({ status: "checking" });
  const text = await (await fetch(RELEASE_FEED, { signal: AbortSignal.timeout(15000) })).text();
  const version = /^version:\s*(\S+)/m.exec(text)?.[1];
  const debEntry = /url:\s*(nexora-desktop_\S+\.deb)\s*\n\s*sha512:\s*(\S+)/.exec(text);
  if (!version || !debEntry) throw new Error("Feed de atualização inválido.");
  if (!isNewer(version, app.getVersion())) {
    setState({ status: "upToDate" });
    return;
  }
  setState({ status: "downloading", version, percent: 0 });
  const debUrl = `https://github.com/Gatinho-Dev/Nexora/releases/latest/download/${debEntry[1]}`;
  await installDebUpdate(version, debUrl, debEntry[2]);
  setState({ status: "ready", version });
}

// Compara versões x.y.z numéricamente.
function isNewer(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
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
    if (isDebInstall()) {
      await checkDebUpdate();
      return state;
    }
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("Falha ao consultar atualizações.", error);
    setState({ status: "error", message: "Não foi possível verificar atualizações agora." });
  }
  return state;
}

// Baixa o .deb novo do release, confere o SHA512 do latest-linux.yml e abre o instalador do sistema.
export async function installDebUpdate(version: string, debUrl: string, expectedSha512: string) {
  const target = join(tmpdir(), `nexora-desktop_${version}_amd64.deb`);
  const response = await fetch(debUrl, { signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error("Download da atualização falhou.");
  const hash = createHash("sha512");
  const file = createWriteStream(target);
  await pipeline(Readable.fromWeb(response.body as never), async function* (source) {
    for await (const chunk of source) {
      hash.update(chunk);
      yield chunk;
    }
  }, file);
  if (hash.digest("base64") !== expectedSha512) throw new Error("Arquivo de atualização corrompido.");
  const openError = await shell.openPath(target);
  if (openError) throw new Error(openError);
}

// Reinicia e instala somente depois de o download estar concluído e confirmado pelo usuário.
export function installUpdate() {
  if (state.status !== "ready") throw new Error("Nenhuma atualização pronta para instalar.");
  autoUpdater.quitAndInstall(false, true);
}
