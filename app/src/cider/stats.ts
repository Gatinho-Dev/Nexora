/**
 * Estatísticas de escuta, derivadas do histórico local.
 *
 * São números reais do que ficou gravado no navegador — nada é estimado a partir
 * de catálogo. A duração usada é a do vídeo, porque é o que o player conhece: se
 * a faixa foi interrompida no meio, o tempo conta cheio, e isso é explicado na
 * tela em vez de ser escondido.
 */

import type { HistoryEntry } from "./library";
import type { CiderTrack } from "./api/query";

export interface ArtistRank {
  name: string;
  plays: number;
  minutes: number;
  artworkUrl: string;
  tracks: CiderTrack[];
}

export interface SongRank {
  track: CiderTrack;
  plays: number;
}

export interface DayBucket {
  /** Data no formato `AAAA-MM-DD`. */
  date: string;
  plays: number;
  minutes: number;
}

export interface ListeningStats {
  plays: number;
  minutes: number;
  uniqueSongs: number;
  uniqueArtists: number;
  topArtists: ArtistRank[];
  topSongs: SongRank[];
  byDay: DayBucket[];
}

const DAY_MS = 86_400_000;

function dayKey(at: number): string {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Deriva os números do histórico.
 *
 * `days` limita o gráfico diário (o resto dos totais continua sendo de todo o
 * histórico): um gráfico de dois anos em 180 px não diz nada.
 */
export function deriveStats(history: HistoryEntry[], now = Date.now(), days = 14): ListeningStats {
  const songs = new Map<string, SongRank>();
  const artists = new Map<string, ArtistRank>();
  const buckets = new Map<string, DayBucket>();

  let plays = 0;
  let totalMs = 0;

  for (const entry of history) {
    const track = entry.track;
    const minutes = Math.max(0, track.durationMs) / 60_000;
    plays += 1;
    totalMs += Math.max(0, track.durationMs);

    const song = songs.get(track.videoId);
    if (song) song.plays += 1;
    else songs.set(track.videoId, { track, plays: 1 });

    const artistName = (track.artist || track.channelName || "Artista desconhecido").trim();
    const artistKey = artistName.toLowerCase();
    const artist = artists.get(artistKey);
    if (artist) {
      artist.plays += 1;
      artist.minutes += minutes;
    } else {
      artists.set(artistKey, {
        name: artistName,
        plays: 1,
        minutes,
        artworkUrl: track.artworkUrl,
        tracks: [track],
      });
    }

    const key = dayKey(entry.playedAt);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.plays += 1;
      bucket.minutes += minutes;
    } else {
      buckets.set(key, { date: key, plays: 1, minutes });
    }
  }

  const windowStart = now - (days - 1) * DAY_MS;
  const byDay: DayBucket[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const at = windowStart + offset * DAY_MS;
    const key = dayKey(at);
    byDay.push(buckets.get(key) ?? { date: key, plays: 0, minutes: 0 });
  }

  return {
    plays,
    minutes: totalMs / 60_000,
    uniqueSongs: songs.size,
    uniqueArtists: artists.size,
    topArtists: Array.from(artists.values())
      .sort((a, b) => b.plays - a.plays || b.minutes - a.minutes)
      .slice(0, 10),
    topSongs: Array.from(songs.values())
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 12),
    byDay,
  };
}

/** `12,4 h` / `8 min` — formato curto para os cartões de estatística. */
export function formatDuration(minutes: number): string {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1).replace(".", ",")} h`;
  if (minutes >= 1) return `${Math.round(minutes)} min`;
  return `${Math.round(minutes * 60)} s`;
}

/** `dd/mm` para os rótulos do gráfico diário. */
export function shortDayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}
