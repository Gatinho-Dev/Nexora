/**
 * Publica a faixa atual do player como presença na Nexora.
 *
 * A identidade vem da sessão: a página `/cider` já está autenticada e o
 * WebSocket já está aberto, então não há token, chave nem OAuth aqui. O
 * servidor (`api/realtime.ts` → `ciderNowPlaying`) valida, limita a taxa e
 * reescreve para o formato de `rich_presence_activities`.
 *
 * O que este módulo **não** faz: inventar dados. Se não há faixa, manda
 * `title: null` para limpar; se o player está pausado, continua publicando a
 * faixa (é o que o Spotify faz), porque "tô com X parado na tela" ainda é o que
 * a pessoa está ouvindo.
 */

import { realtime } from "@/lib/ws";
import type { WSClientEvent } from "@contracts/types";
import type { CiderTrack } from "./api/query";

/**
 * Intervalo mínimo entre publicações.
 *
 * O servidor já impõe o mesmo limite; repetir aqui evita encher a fila do
 * WebSocket de mensagens que seriam descartadas. Também cobre o tique de
 * progresso: reenviar a cada 250 ms seria desperdício, a barra de progresso na
 * Nexora é calculada no cliente a partir de `startedAt`/`endsAt`.
 */
const MIN_PUBLISH_MS = 20_000;

let lastPublishAt = 0;
let lastVideoId: string | null = null;

export interface PublishOptions {
  /** `true` enquanto há faixa carregada e tocando. */
  playing: boolean;
  /** Posição atual, em ms, para derivar `startedAt`. */
  positionMs: number;
  durationMs: number;
}

/**
 * Publica a faixa. Só envia quando a faixa **mudou** ou o intervalo passou —
 * o mesmo efeito do `fingerprint` do lado do servidor, sem o custo de rede.
 */
export function publishNowPlaying(
  track: CiderTrack | null,
  options: PublishOptions
): void {
  if (!track) {
    if (lastVideoId === null) return; // já estava limpo
    lastVideoId = null;
    lastPublishAt = Date.now();
    send({ title: null });
    return;
  }

  const now = Date.now();
  const changed = track.videoId !== lastVideoId;
  if (!changed && now - lastPublishAt < MIN_PUBLISH_MS) return;

  lastVideoId = track.videoId;
  lastPublishAt = now;

  const durationMs = options.durationMs || track.durationMs;
  // `startedAt` no passado dá à barra de progresso o ponto de partida certo,
  // mesmo que apublicação só chegue ao servidor alguns segundos depois.
  const startedAt = now - Math.max(0, options.positionMs);
  const endsAt = durationMs > 0 ? startedAt + durationMs : null;

  send({
    title: track.title,
    details: track.artist || track.channelName || null,
    state: track.albumHint ?? null,
    largeImageUrl: track.artworkUrl || null,
    largeImageText: track.title,
    smallImageUrl: null,
    smallImageText: "Cider",
    startedAt,
    endsAt,
    externalUrl: track.url || null,
  });
}

function send(activity: NonNullable<
  Extract<WSClientEvent, { t: "cider:now-playing" }>["activity"]
>): void {
  try {
    realtime.send({ t: "cider:now-playing", activity });
  } catch {
    // WebSocket fechado: a próxima publicação quando ele voltar cobre o
    // estado. Perder o push é aceitável; derrubar a página não.
  }
}

/** Zera o estado local — usado ao desmontar o provider inteiro. */
export function resetNowPlaying(): void {
  lastVideoId = null;
  lastPublishAt = 0;
}

/**
 * Limpa a presença e zera o throttle.
 *
 * Separate de `resetNowPlaying` porque a página chama isto ao desmontar: sair
 * de `/cider` **não** deve interromper o áudio (o mini-player continua), mas a
 * faixa para de ser anunciada a cada 20 s para quem não está mais aqui.
 */
export function releaseNowPlaying(): void {
  if (lastVideoId !== null) send({ title: null });
  lastVideoId = null;
  lastPublishAt = 0;
}

export const __testing = { MIN_PUBLISH_MS };
