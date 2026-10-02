/**
 * "Ouvir junto": as decisões que o Cider toma para **seguir** o anfitrião e para
 * **publicar** o que está tocando.
 *
 * Nada aqui toca no player nem no React. É de propósito: as duas perguntas
 * delicadas desta funcionalidade são de dados, e são elas que estes módulos
 * respondem —
 *
 * - **o convidado está no mesmo ponto que o anfitrião?** Não exatamente: os dois
 *   players nunca tocam no mesmo milissegundo, e corrigir cada segundo faria o
 *   áudio engasgar. A banda de tolerância (`DRIFT_TOLERANCE_MS`) decide quando a
 *   diferença é grande o bastante para valer um `seek`.
 * - **o anfitrião precisa publicar de novo?** Publicar a cada tique de progresso
 *   seria mandar um número que muda sozinho; publicar só em troca de faixa
 *   deixaria o convidado sem referência para se corrigir. A assinatura ignora o
 *   progresso fino e deixa passar um batimento a cada cinco segundos.
 */

import { CiderListen } from "@contracts/constants";
import type { CiderListenState, CiderListenTrack } from "@contracts/types";
import type { CiderTrack } from "../api/query";

/** Recorte do motor que a decisão do convidado precisa enxergar. */
export interface FollowSnapshot {
  videoId: string | null;
  index: number;
  queueIds: string[];
  positionMs: number;
  playing: boolean;
}

export interface FollowPlan {
  /** Copiar a fila do anfitrião (ou parar, quando ele não está tocando nada). */
  load: boolean;
  /** Estado de reprodução desejado. */
  playing: boolean;
  /** Posição desejada, em ms, já corrigida pelo tempo de viagem. */
  positionMs: number;
  /** Buscar essa posição — a diferença passou da banda de tolerância. */
  seek: boolean;
  /** Já está alinhado: nada a fazer. */
  aligned: boolean;
}

/**
 * O que fazer ao receber o estado do anfitrião.
 *
 * `receivedAt` é o relógio **local** de quando o estado chegou, e não um horário
 * do servidor: assim a correção do tempo de viagem não depende de os dois
 * computadores estarem com a hora certa — só de os dois estarem ouvindo a mesma
 * faixa, que é o que a sessão promete.
 *
 * Quando o anfitrião está pausado não há viagem nenhuma a compensar: a posição
 * publicada continua valendo, seja um segundo ou um minuto depois.
 */
export function followPlan(
  snapshot: FollowSnapshot,
  sync: CiderListenState,
  receivedAt: number,
  now: number = Date.now()
): FollowPlan {
  if (!sync.track) {
    return {
      load: true,
      playing: false,
      positionMs: 0,
      seek: false,
      aligned: false,
    };
  }

  const travel = sync.playing ? Math.max(0, now - receivedAt) : 0;
  const positionMs = Math.max(0, sync.positionMs + travel);
  const sameQueue =
    snapshot.queueIds.length === sync.queue.length &&
    snapshot.queueIds.every((id, at) => id === sync.queue[at]?.videoId);

  if (snapshot.videoId !== sync.track.videoId || snapshot.index !== sync.index || !sameQueue) {
    return { load: true, playing: sync.playing, positionMs, seek: true, aligned: false };
  }

  const seek = Math.abs(snapshot.positionMs - positionMs) > CiderListen.DRIFT_TOLERANCE_MS;
  return {
    load: false,
    playing: sync.playing,
    positionMs,
    seek,
    aligned: !seek && snapshot.playing === sync.playing,
  };
}

/** Recorte do motor que basta para montar o estado publicado. */
export interface PublishSnapshot {
  track: CiderTrack | null;
  queue: CiderTrack[];
  index: number;
  positionMs: number;
  playing: boolean;
}

/**
 * A volta: a faixa da sessão no `CiderTrack` que o motor toca.
 *
 * O que a sessão não carrega (canal, versão, pontuação de busca) volta vazio, e
 * isso é honesto: são campos da **busca** de quem compartilhou, e preenchê-los
 * com chute faria a interface mostrar informação que ninguém mandou. O endereço
 * do vídeo é derivado do id, porque é o que a interface abre quando alguém clica
 * em "Abrir no YouTube".
 */
export function trackFromListen(item: CiderListenTrack): CiderTrack {
  return {
    videoId: item.videoId,
    title: item.title,
    artist: item.artist ?? "",
    channelName: item.channelName ?? "",
    youtubeTitle: item.title,
    albumHint: null,
    artworkUrl: item.artworkUrl ?? "",
    durationMs: item.durationMs ?? 0,
    url: item.url ?? `https://www.youtube.com/watch?v=${item.videoId}`,
    version: "studio",
    score: 0,
    isAlternative: false,
    isExplicit: false,
  };
}

/** Faixa no formato trocado pela sessão — só o que o convidado reproduz. */
export function listenTrackFrom(track: CiderTrack): CiderListenTrack {
  return {
    videoId: track.videoId,
    title: track.title,
    artist: track.artist || null,
    channelName: track.channelName || null,
    artworkUrl: track.artworkUrl || null,
    durationMs: track.durationMs || 0,
    url: track.url || null,
  };
}

/**
 * O estado que o anfitrião publica.
 *
 * A janela começa na faixa atual, e não no começo da fila: o que um convidado
 * precisa é o que está tocando e o que vem depois, e um álbum de 500 faixas não
 * caberia — nem faria sentido — numa mensagem de WebSocket.
 */
export function listenStateFrom(
  snapshot: PublishSnapshot,
  limit: number = CiderListen.MAX_QUEUE
): CiderListenState {
  if (!snapshot.track || snapshot.index < 0) {
    return { track: null, playing: false, positionMs: 0, index: -1, queue: [] };
  }
  const upcoming = snapshot.queue.slice(snapshot.index, snapshot.index + Math.max(1, limit));
  return {
    track: listenTrackFrom(snapshot.track),
    playing: snapshot.playing,
    positionMs: Math.max(0, Math.round(snapshot.positionMs)),
    index: 0,
    queue: upcoming.map(listenTrackFrom),
  };
}

/**
 * Assinatura do estado: muda quando algo que o convidado precisa saber muda.
 *
 * O progresso entra arredondado em blocos de cinco segundos — é o batimento que
 * mantém a sessão alinhada sem transformar cada tique do relógio numa mensagem.
 */
export function listenStateSignature(state: CiderListenState): string {
  const bucket = state.playing ? Math.floor(state.positionMs / 5_000) : -1;
  const queue = state.queue.map((track) => track.videoId).join(",");
  return [state.track?.videoId ?? "-", state.playing ? "1" : "0", state.index, bucket, queue].join("|");
}

export type PublishPlan = "none" | "now" | "soon";

/**
 * Quando publicar. `soon` é a publicação **final**: se o estado mudou antes de o
 * intervalo mínimo passar, a mudança não pode ser engolida — ela é agendada, e
 * não descartada.
 */
export function publishPlan(
  previousSignature: string | null,
  signature: string,
  lastPublishedAt: number,
  now: number = Date.now(),
  minMs: number = CiderListen.STATE_INTERVAL_MS
): PublishPlan {
  if (previousSignature === signature) return "none";
  return now - lastPublishedAt >= minMs ? "now" : "soon";
}

/* ------------------------------------------------------------------ *
 * Reações                                                            *
 * ------------------------------------------------------------------ */

/** Uma reação subindo sobre a capa. */
export interface FloatingReaction {
  id: number;
  emoji: string;
  name: string;
  /** Quando nasceu, no relógio local — é o que a animação e a limpeza usam. */
  at: number;
  /** Deslocamento horizontal em %, para duas reações não subirem coladas. */
  drift: number;
}

let reactionId = 1;

export function makeReaction(input: {
  emoji: string;
  name: string;
  at: number;
  drift?: number;
}): FloatingReaction {
  return {
    id: reactionId++,
    emoji: input.emoji,
    name: input.name,
    at: input.at,
    drift: input.drift ?? Math.round(Math.random() * 60 - 30),
  };
}

/**
 * O que continua na tela: a reação some sozinha depois de viver o suficiente, e
 * a lista tem teto — uma sessão animada não pode virar uma parede de emojis.
 */
export function pruneReactions(
  list: FloatingReaction[],
  now: number,
  lifetime: number = CiderListen.REACTION_LIFETIME_MS,
  max: number = CiderListen.MAX_FLOATING_REACTIONS
): FloatingReaction[] {
  const alive = list.filter((reaction) => now - reaction.at < lifetime);
  return alive.length > max ? alive.slice(alive.length - max) : alive;
}

/* ------------------------------------------------------------------ *
 * Código do convite                                                  *
 * ------------------------------------------------------------------ */

/**
 * Lê o código digitado: maiúsculas, sem espaços nem hífens, e só o alfabeto
 * válido. É a mesma conta que o servidor faz (`normalizeListenCode`) — repetida
 * aqui porque o cliente não pode importar o `api/`, e porque a pergunta "esse
 * código tem cara de código?" precisa de resposta antes de a mensagem sair.
 */
export function readListenCode(raw: string): string | null {
  const value = raw.replace(/[\s-]/g, "").toUpperCase();
  if (value.length !== CiderListen.CODE_LENGTH) return null;
  for (const char of value) {
    if (!CiderListen.CODE_ALPHABET.includes(char)) return null;
  }
  return value;
}

/** Texto para compartilhar a sessão fora do app (chat, etc.). */
export function inviteMessage(code: string, hostName: string): string {
  return `${hostName} está ouvindo junto no Cider. Entre na sessão com o código ${code}.`;
}
