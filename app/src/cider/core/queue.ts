/**
 * A fila do motor, como **dados puros**.
 *
 * A fila do Cider tem duas origens, e é essa distinção que sustenta o desenho de
 * fila do Apple Music (iOS 18):
 *
 * - **contexto** — o álbum, a lista, o resultado de busca ou a estação que
 *   começou a tocar. É o que o "Limpar" **preserva**;
 * - **à mão** — o que a pessoa colocou ali de propósito ("Tocar depois" e
 *   "Adicionar à fila"). É o que o "Limpar" **tira**.
 *
 * O motor precisa da distinção, não só a interface: sem ela, "Limpar" seria
 * sinônimo de "parar e esvaziar" e jogaria fora justamente o álbum que a pessoa
 * estava ouvindo.
 *
 * Aqui não há player, nem React, nem DOM: cada função recebe a fila, devolve a
 * fila nova e o **índice ajustado** — porque inserir ou remover entradas desloca
 * a faixa que está tocando, e deixar esse deslocamento para quem chama seria
 * convidar a interface a mostrar a faixa errada como "tocando agora".
 */

import type { CiderTrack } from "../api/query";

export interface QueueEntry {
  track: CiderTrack;
  /** `true` quando a entrada foi colocada na fila à mão. */
  manual: boolean;
}

/** A fila e onde está o play. */
export interface QueueState {
  entries: QueueEntry[];
  /** Índice da faixa atual, ou `-1` quando nada toca. */
  index: number;
}

/** Começa uma fila nova: tudo o que veio do contexto, nada à mão. */
export function queueFrom(tracks: CiderTrack[]): QueueState {
  return { entries: tracks.map((track) => ({ track, manual: false })), index: 0 };
}

/**
 * Só o que ainda não está na fila.
 *
 * O player recebe a lista inteira a cada troca de índice: repetir o mesmo vídeo
 * faria a fila andar em círculos ao apertar "próxima".
 */
function fresh(entries: QueueEntry[], tracks: CiderTrack[]): CiderTrack[] {
  const known = new Set(entries.map((entry) => entry.track.videoId));
  return tracks.filter((track) => track.videoId && !known.has(track.videoId));
}

/**
 * "Adicionar à fila": no **fim absoluto**, depois de tudo o que já estava
 * marcado à mão. É o "vai tocar em algum momento, depois de tudo".
 */
export function appendToQueue(
  state: QueueState,
  tracks: CiderTrack[]
): QueueState {
  const added = fresh(state.entries, tracks);
  if (added.length === 0) return state;
  return {
    index: state.index,
    entries: [...state.entries, ...added.map((track) => ({ track, manual: true }))],
  };
}

/**
 * "Tocar depois": logo **depois da faixa atual**.
 *
 * O Apple Music coloca a faixa no fim do álbum atual ("Reproduzir Depois"),
 * empurrando o resto para a fila. Aqui ela entra imediatamente depois da que
 * toca: a nossa fila quase sempre é o resultado de uma busca ou uma estação, e
 * nesses casos "no fim do álbum" e "no fim da fila" seriam o mesmo lugar — as
 * duas ações ficariam indistinguíveis, que é exatamente o problema que o iOS 18
 * corrigiu.
 *
 * Sem nada tocando, a fila nova começa por elas.
 */
export function insertAfterCurrent(
  state: QueueState,
  tracks: CiderTrack[]
): QueueState {
  // Sem nada tocando não existe "depois": elas são a fila nova. E também é
  // "à mão", porque foi a pessoa que as pediu.
  if (state.index < 0 || state.entries.length === 0) {
    const start = fresh(state.entries, tracks);
    if (start.length === 0) return state;
    return { entries: start.map((track) => ({ track, manual: true })), index: 0 };
  }

  const current = state.entries[state.index]!;
  // Pedir "depois" da faixa que já está tocando não quer dizer nada: ela é o
  // "agora".
  const wanted = new Map<string, CiderTrack>();
  for (const track of tracks) {
    if (!track.videoId) continue;
    if (track.videoId === current.track.videoId) continue;
    if (!wanted.has(track.videoId)) wanted.set(track.videoId, track);
  }
  if (wanted.size === 0) return state;

  // O que já estava na fila **muda de lugar** em vez de aparecer duas vezes: o
  // player recebe a lista inteira a cada troca de índice, e um vídeo repetido
  // deixaria "próxima" andando em círculos. A marca de "à mão" da entrada
  // original é preservada: uma faixa do álbum que a pessoa puxou para a frente
  // continua sendo do álbum no "Limpar".
  const existing = new Map(state.entries.map((entry) => [entry.track.videoId, entry]));
  const kept = state.entries.filter((entry) => !wanted.has(entry.track.videoId));
  const anchor = kept.indexOf(current);
  const added = [...wanted].map(
    ([videoId, track]) => existing.get(videoId) ?? { track, manual: true }
  );
  return {
    index: anchor,
    entries: [...kept.slice(0, anchor + 1), ...added, ...kept.slice(anchor + 1)],
  };
}

/** Tira a faixa de uma posição. A que está tocando não sai (o áudio continuaria). */
export function removeAt(state: QueueState, position: number): QueueState {
  if (position < 0 || position >= state.entries.length) return state;
  if (position === state.index) return state;
  return {
    index: state.index > position ? state.index - 1 : state.index,
    entries: state.entries.filter((_entry, at) => at !== position),
  };
}

/**
 * "Limpar": saem as entradas **à mão**, fica o contexto.
 *
 * A faixa que está tocando nunca sai — nem quando ela mesma foi colocada à mão:
 * o áudio já está carregado, e tirá-la da fila faria a interface dizer que nada
 * toca enquanto a música continua.
 */
export function clearManual(state: QueueState): QueueState {
  if (!state.entries.some((entry) => entry.manual)) return state;
  const current = state.index >= 0 ? state.entries[state.index] : undefined;
  const entries = state.entries.filter(
    (entry, at) => !entry.manual || at === state.index
  );
  return { entries, index: current ? entries.indexOf(current) : -1 };
}

/** Posições, na ordem da fila, das entradas colocadas à mão. */
export function manualIndexes(entries: QueueEntry[]): number[] {
  const out: number[] = [];
  entries.forEach((entry, position) => {
    if (entry.manual) out.push(position);
  });
  return out;
}

/**
 * Quantas faixas colocadas à mão **seriam perdidas** ao tocar `next`.
 *
 * É a conta que decide se a interface pergunta antes de trocar a fila ("tocar
 * isto limpará a sua fila"). Só conta o que realmente sai: tocar de novo a
 * mesma lista, ou uma que já inclui o que estava à mão, não perde nada e por
 * isso não merece uma pergunta.
 */
export function manualLosses(
  queue: CiderTrack[],
  manual: number[],
  next: CiderTrack[]
): number {
  const keeping = new Set(next.map((track) => track.videoId));
  return manual.filter((position) => {
    const track = queue[position];
    return track ? !keeping.has(track.videoId) : false;
  }).length;
}
