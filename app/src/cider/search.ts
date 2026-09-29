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
import { describeSearchFailure, searchVideos } from "./api/search";

export interface SearchOutcome {
  tracks: CiderTrack[];
  source: string | null;
  error: string | null;
  /** Tentativas que falharam antes de alguma instância responder. */
  attempts: Array<{ instance: string; error: string }>;
}

/**
 * Executa o plano de consultas e devolve a lista reordenada.
 *
 * Para assim que há resultados suficientes: a consulta alternativa existe para
 * quando a primeira não acha nada decente, não para encher a lista com
 * resultados parecidos de cinco variações.
 */
export async function searchTracks(
  raw: string,
  preferences: SearchPreferences = DEFAULT_SEARCH_PREFERENCES
): Promise<SearchOutcome> {
  const text = raw.trim();
  if (!text) return { tracks: [], source: null, error: null, attempts: [] };

  const plan = buildSearchPlan(parseIntent(text));
  const collected: CiderTrack[] = [];
  const attempts: Array<{ instance: string; error: string }> = [];
  let source: string | null = null;

  for (const variant of plan) {
    const outcome = await searchVideos(variant, preferences.limit);
    attempts.push(...outcome.attempts);
    if (outcome.videos.length === 0) continue;
    if (!source) source = outcome.source;
    collected.push(
      ...outcome.videos.map(video =>
        toTrack({
          videoId: video.videoId,
          title: video.title,
          author: video.author,
          thumbnail: video.thumbnail,
          durationSeconds: video.duration,
        })
      )
    );
    if (collected.length >= 8) break;
  }

  if (collected.length === 0) {
    return { tracks: [], source: null, error: describeSearchFailure(attempts), attempts };
  }

  return {
    tracks: rerankTracks(dedupeTracks(collected), { query: text, preferences }),
    source,
    error: null,
    attempts,
  };
}
