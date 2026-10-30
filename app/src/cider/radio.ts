/**
 * Rádio: uma estação a partir de uma semente.
 *
 * O YouTube não publica "rádio" nem "recomendação" sem conta e sem API oficial.
 * Então a estação aqui é honesta: a semente é uma faixa/artista que o usuário
 * ouviu ou favoritou, e a estação é o resultado de **consultas reais** ao redor
 * dela. Se a busca não achar nada, a rádio diz isso em vez de inventar faixas.
 *
 * O planejamento é puro (`radioQueries`, `assembleStation`) para poder ser
 * testado sem rede: a página só executa as consultas e junta os lotes.
 */

import type { CiderTrack } from "./api/query";

export interface RadioSeed {
  kind: "track" | "artist";
  /** Artista (ou nome do canal) que nomeia a estação. */
  value: string;
  /** Faixa usada como ponto de partida, quando a semente é uma faixa. */
  track?: CiderTrack;
}

/**
 * Consultas da estação, em ordem de preferência.
 *
 * São três porque uma só devolve o mesmo canal inteiro: variando entre o
 * artista puro, o canal "Topic" (áudio oficial) e as coletâneas, a fila fica
 * diversa sem depender de nenhum serviço de recomendação.
 */
export function radioQueries(seed: RadioSeed): string[] {
  const artist = seed.value.trim();
  if (!artist) return [];
  const queries = [`${artist}`, `${artist} topic`, `${artist} greatest hits`];
  if (seed.kind === "track" && seed.track?.title) {
    // Uma quarta consulta usa a própria faixa: serve para quando o canal do
    // artista não publica nada, e é o único caso em que o título entra.
    queries.push(`${seed.track.title}`);
  }
  return Array.from(new Set(queries));
}

export interface StationOptions {
  /** Faixa que já está tocando: não deve aparecer de novo na fila. */
  excludeVideoId?: string;
  limit?: number;
  /** Teto por canal, para um único publicador não dominar a estação. */
  maxPerArtist?: number;
}

/**
 * Junta os lotes de resultados numa fila de estação.
 *
 * A ordem dos lotes é a ordem das consultas: o artista primeiro, as variações
 * depois. O corte por canal vem do mesmo princípio do ranking da busca — a
 * estação não pode ser uma discografia de um canal só.
 */
export function assembleStation(batches: CiderTrack[][], options: StationOptions = {}): CiderTrack[] {
  const limit = options.limit ?? 40;
  const maxPerArtist = options.maxPerArtist ?? 3;
  const seenVideos = new Set<string>();
  const perArtist = new Map<string, number>();
  const station: CiderTrack[] = [];

  for (const batch of batches) {
    for (const track of batch) {
      if (station.length >= limit) return station;
      if (!track.videoId || track.videoId === options.excludeVideoId) continue;
      if (seenVideos.has(track.videoId)) continue;
      const artist = (track.artist || track.channelName || "").toLowerCase();
      const count = perArtist.get(artist) ?? 0;
      if (count >= maxPerArtist) continue;
      seenVideos.add(track.videoId);
      perArtist.set(artist, count + 1);
      station.push(track);
    }
  }

  return station;
}

/** Sementes sugeridas a partir da biblioteca, com quem tocou mais primeiro. */
export function suggestedSeeds(tracks: CiderTrack[], max = 12): RadioSeed[] {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    const artist = (track.artist || track.channelName || "").trim();
    if (!artist) continue;
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([value]) => ({ kind: "artist", value }) satisfies RadioSeed);
}
