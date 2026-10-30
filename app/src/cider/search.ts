/**
 * Busca de faixas: monta as consultas, fala com as instâncias e reordena.
 *
 * Junta o que era `api/query.ts` (intenção, plano, rerank) com o transporte de
 * `api/search.ts` (Piped/Invidious), para quem consome o player não precisar
 * conhecer as duas camadas.
 */

import {
  buildSearchPlan,
  DEFAULT_SEARCH_PREFERENCES,
  dedupeTracks,
  parseIntent,
  rerankTracks,
  toTrack,
  type CiderTrack,
  type SearchPreferences,
} from "./api/query";
import {
  describeSearchFailure,
  searchVideos,
  type RawVideo,
  type SearchNext,
} from "./api/search";

export interface SearchOutcome {
  tracks: CiderTrack[];
  source: string | null;
  error: string | null;
  /** Tentativas que falharam antes de alguma instância responder. */
  attempts: Array<{ instance: string; error: string }>;
  /**
   * Continuação desta lista. `null` = fim: rolar mais não vai trazer nada.
   *
   * Vive aqui (e não na página) porque quem sabe paginar é o transporte; a tela
   * só guarda o que recebeu e devolve na próxima chamada.
   */
  next: SearchNext | null;
}

/** Converte os itens crus do transporte em faixas do player. */
function toTracks(videos: RawVideo[]): CiderTrack[] {
  return videos.map(video =>
    toTrack({
      videoId: video.videoId,
      title: video.title,
      author: video.author,
      thumbnail: video.thumbnail,
      durationSeconds: video.duration,
    })
  );
}

/**
 * Executa o plano de consultas e devolve a lista reordenada.
 *
 * Para assim que há resultados suficientes: a consulta alternativa existe para
 * quando a primeira não acha nada decente, não para encher a lista com
 * resultados parecidos de cinco variações.
 *
 * Com `next`, é a **página seguinte** de uma busca já feita — uma requisição só,
 * sem refazer o plano. É o que a rolagem infinita usa: cada página nova chega
 * pelo mesmo caminho (classificação incluída) e é anexada à lista exibida.
 */
export async function searchTracks(
  raw: string,
  preferences: SearchPreferences = DEFAULT_SEARCH_PREFERENCES,
  next: SearchNext | null = null
): Promise<SearchOutcome> {
  const text = raw.trim();
  if (!text) return { tracks: [], source: null, error: null, attempts: [], next: null };

  if (next) {
    const page = await searchVideos(text, preferences.limit, next);
    return {
      tracks: rerankTracks(dedupeTracks(toTracks(page.videos)), { query: text, preferences }),
      source: page.source,
      error: page.videos.length === 0 ? describeSearchFailure(page.attempts) : null,
      attempts: page.attempts,
      next: page.next,
    };
  }

  const plan = buildSearchPlan(parseIntent(text));
  const collected: CiderTrack[] = [];
  const attempts: Array<{ instance: string; error: string }> = [];
  let source: string | null = null;
  let nextCursor: SearchNext | null = null;

  for (const variant of plan) {
    const outcome = await searchVideos(variant, preferences.limit);
    attempts.push(...outcome.attempts);
    if (outcome.videos.length === 0) continue;
    if (!source) source = outcome.source;
    collected.push(...toTracks(outcome.videos));
    // A primeira instância que respondeu é quem sabe continuar a lista dela.
    if (nextCursor === null) nextCursor = outcome.next;
    if (collected.length >= 8) break;
  }

  if (collected.length === 0) {
    return {
      tracks: [],
      source: null,
      error: describeSearchFailure(attempts),
      attempts,
      next: null,
    };
  }

  return {
    tracks: rerankTracks(dedupeTracks(collected), { query: text, preferences }),
    source,
    error: null,
    attempts,
    next: nextCursor,
  };
}
