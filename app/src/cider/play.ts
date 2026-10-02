/**
 * Ações de reprodução compartilhadas pelas telas.
 *
 * Existem num módulo só — e não dentro de cada página — porque **a fila tem um
 * dono**: o motor. Se cada tela chamasse o player do seu jeito, duas telas
 * abertas em sequência criariam filas diferentes para a mesma sessão.
 *
 * Aqui também vivem as ações que misturam player + biblioteca + avisos
 * ("favoritar", "tocar estação", "estender a fila"), para a interface não
 * repetir a mesma sequência de passos em cinco lugares.
 */

import { searchTracks, type SearchOutcome } from "./search";
import type { SearchNext } from "./api/search";
import type { CiderTrack, SearchPreferences } from "./api/query";
import type { CiderEngine } from "./engine";
import { useCiderLibrary } from "./library";
import { useCiderSettings } from "./settings/store";
import { searchPreferencesOf, type CiderSettings } from "./settings/types";
import { assembleStation, radioQueries, type RadioSeed } from "./radio";
import { ciderToast, useCiderUi } from "./ui";

/**
 * Executa uma busca e registra o resultado (host que respondeu e falhas).
 *
 * Toda busca da interface passa por aqui: é o que faz o selo da topbar e a
 * tela de Diagnóstico dizerem a verdade sobre a fonte em uso.
 *
 * Com `next`, é a página seguinte de uma busca já feita — a lista exibida só
 * anexa o que chegou, então um tropeço numa página de continuação **não** vira
 * um erro de busca na tela (a lista que o usuário já vê continua válida).
 */
export async function runSearch(
  query: string,
  preferences?: SearchPreferences,
  next: SearchNext | null = null,
): Promise<SearchOutcome> {
  const outcome = await searchTracks(query, preferences ?? currentSearchPreferences(), next);
  useCiderUi.getState().setSearchMeta({
    source: outcome.source,
    attempts: outcome.attempts,
    error: outcome.error && outcome.tracks.length === 0 ? outcome.error : null,
  });
  return outcome;
}

/** Preferências de busca atuais, no formato que `searchTracks` entende. */
export function currentSearchPreferences(settings?: CiderSettings): SearchPreferences {
  const parsed = searchPreferencesOf(settings ?? useCiderSettings.getState().settings);
  return {
    preferOfficialAudio: parsed.preferOfficialAudio,
    hideAlternativeVersions: parsed.hideAlternativeVersions,
    maxPerChannel: Math.max(0, Math.round(parsed.maxPerChannel)),
    limit: Math.min(50, Math.max(5, Math.round(parsed.limit))),
  };
}

/**
 * Busca e toca a lista inteira a partir do primeiro resultado.
 *
 * Usado pelos chips de consulta (temas, sugestões, rádio): o resultado é
 * honesto — se nada voltou, sai um aviso dizendo o motivo, em vez de uma fila
 * vazia silenciosa.
 */
export async function searchAndPlay(query: string, engine: CiderEngine): Promise<boolean> {
  const outcome = await runSearch(query);
  if (outcome.tracks.length === 0) {
    ciderToast("warning", "A busca não devolveu nada", outcome.error ?? `Nenhum resultado para “${query}”.`);
    return false;
  }
  engine.playQueue(outcome.tracks, 0);
  return true;
}

/** Toca a lista a partir de `index` (a fila passa a ser exatamente esta lista). */
export function playFrom(engine: CiderEngine, tracks: CiderTrack[], index = 0): void {
  if (tracks.length === 0) return;
  engine.playQueue(tracks, Math.max(0, Math.min(tracks.length - 1, index)));
}

/** Acrescenta faixas ao fim da fila atual, sem interromper a atual. */
export function addToQueue(engine: CiderEngine, tracks: CiderTrack[]): number {
  if (tracks.length === 0) return 0;
  engine.appendQueue(tracks);
  return tracks.length;
}

/** Alterna favorito e avisa o que aconteceu. */
export function toggleFavoriteWithToast(track: CiderTrack): boolean {
  const library = useCiderLibrary.getState();
  const wasFavorite = library.favorites.some((item) => item.videoId === track.videoId);
  library.toggleFavorite(track);
  ciderToast(
    wasFavorite ? "info" : "success",
    wasFavorite ? "Removida dos favoritos" : "Adicionada aos favoritos",
    track.title,
  );
  return !wasFavorite;
}

/** Grava a reprodução no histórico, respeitando a preferência das configurações. */
export function recordPlay(track: CiderTrack): void {
  if (!useCiderSettings.getState().settings.historyEnabled) return;
  useCiderLibrary.getState().recordPlay(track);
}

export interface StationResult {
  added: number;
  queries: string[];
  error: string | null;
}

/** Roda as consultas da semente e devolve os lotes encontrados. */
async function collect(
  queries: string[],
): Promise<{ batches: CiderTrack[][]; error: string | null }> {
  const batches: CiderTrack[][] = [];
  let error: string | null = null;
  for (const query of queries) {
    const outcome = await runSearch(query);
    if (outcome.tracks.length > 0) batches.push(outcome.tracks);
    else if (!error) error = outcome.error;
  }
  return { batches, error };
}

/**
 * Estação a partir de uma semente: roda as consultas reais e monta a fila.
 *
 * A semente toca primeiro; a estação entra em seguida. Se nada for encontrado,
 * `added` é 0 e o erro explica — a tela mostra isso em vez de fingir sucesso.
 */
export async function startStation(seed: RadioSeed, engine: CiderEngine): Promise<StationResult> {
  const queries = radioQueries(seed);
  if (queries.length === 0) {
    return { added: 0, queries, error: "A semente não tem nome de artista utilizável." };
  }

  const { batches, error } = await collect(queries);
  const station = assembleStation(batches, {
    excludeVideoId: seed.track?.videoId,
    limit: 40,
    maxPerArtist: 3,
  });

  if (seed.track) {
    engine.playQueue([seed.track, ...station], 0);
    return { added: station.length, queries, error: station.length === 0 ? error : null };
  }

  if (station.length === 0) {
    return { added: 0, queries, error: error ?? "Nenhuma faixa utilizável para esta semente." };
  }
  engine.playQueue(station, 0);
  return { added: station.length, queries, error: null };
}

/** Estende a fila atual com faixas ao redor do que está tocando. */
export async function extendQueue(engine: CiderEngine): Promise<StationResult> {
  const snapshot = engine.snapshot();
  const current = snapshot.track;
  if (!current) return { added: 0, queries: [], error: "Nada tocando para estender a fila." };

  const seed: RadioSeed = { kind: "track", value: current.artist || current.channelName, track: current };
  const queries = radioQueries(seed);
  const { batches, error } = await collect(queries);
  const fresh = assembleStation(batches, {
    excludeVideoId: current.videoId,
    limit: 20,
    maxPerArtist: 2,
  });
  const added = addToQueue(engine, fresh);
  return { added, queries, error: added === 0 ? (error ?? "Nada novo encontrado para esta faixa.") : null };
}

/** Lembra a busca recente (sem duplicar). */
export function rememberSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  useCiderLibrary.getState().rememberSearch(trimmed);
}

/* A última semente da Rádio vive em memória, não no armazenamento: é o estado
   da sessão, e não uma preferência. */
let lastSeed: RadioSeed | null = null;

export function rememberSeed(seed: RadioSeed): void {
  lastSeed = seed;
}

export function lastRadioSeed(): RadioSeed | null {
  return lastSeed;
}
