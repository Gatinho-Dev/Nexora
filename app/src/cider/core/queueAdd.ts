/**
 * "Adicionar músicas à fila": o que sugerir e o que já está lá.
 *
 * A gaveta de adicionar música tem duas metades que parecem interface mas são
 * decisão de dados:
 *
 * - **o que sugerir antes de digitar** — a biblioteca deste navegador, com o que
 *   foi ouvido por último na frente do que foi favoritado há meses. Sem ordem, a
 *   lista de sugestões seria um depósito;
 * - **o que já está na fila** — pesquisar uma música que já está ali dentro e
 *   receber um "Adicionar" ativo seria mentira: a fila não recebe a mesma faixa
 *   duas vezes (ver `core/queue.ts`). A marca existe para a resposta aparecer
 *   **antes** do clique, não como um botão que não faz nada.
 *
 * Nada aqui toca no motor, no player ou no React.
 */

import type { CiderTrack } from "../api/query";

/** Quantas sugestões a gaveta mostra antes de a pessoa digitar. */
export const SUGGESTION_LIMIT = 6;

/** Ids da fila, para responder "isto já está lá?" sem percorrer a lista. */
export function queueIds(queue: CiderTrack[]): Set<string> {
  return new Set(queue.map((track) => track.videoId).filter(Boolean));
}

/**
 * As faixas que ainda **não** estão na fila.
 *
 * É a mesma pergunta em dois lugares: quantas o "Adicionar todas" realmente
 * acrescenta, e quais as sugestões que valem a pena mostrar. Uma faixa sem id
 * não entra — sem id não há o que tocar depois.
 */
export function newIn(tracks: CiderTrack[], ids: Set<string>): CiderTrack[] {
  const seen = new Set(ids);
  const out: CiderTrack[] = [];
  for (const track of tracks) {
    if (!track.videoId || seen.has(track.videoId)) continue;
    seen.add(track.videoId);
    out.push(track);
  }
  return out;
}

export interface SuggestionSources {
  /** Histórico da biblioteca, do mais recente para o mais antigo. */
  history: Array<{ track: CiderTrack }>;
  favorites: CiderTrack[];
  queue: CiderTrack[];
}

/**
 * Sugestões para a gaveta ainda vazia.
 *
 * O histórico vem inteiro na frente dos favoritos, e não intercalado: quem abre
 * esta gaveta está no meio de uma sessão de escuta, e "o que eu acabei de ouvir"
 * é a intenção mais provável. Favorito é o segundo palpite, para quem está
 * começando.
 *
 * A própria faixa que toca costuma estar no histórico e **não** é filtrada por
 * isso: a fila já a contém, então `newIn` a remove junto com o resto do que está
 * na fila — uma lista de sugestões que repete o que está tocando não sugere nada.
 */
export function queueSuggestions(
  sources: SuggestionSources,
  limit = SUGGESTION_LIMIT
): CiderTrack[] {
  const fromHistory = sources.history.map((entry) => entry.track);
  return newIn([...fromHistory, ...sources.favorites], queueIds(sources.queue)).slice(
    0,
    Math.max(0, limit)
  );
}
