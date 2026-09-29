/**
 * Letras: LRCLIB direto do navegador.
 *
 * No Cider 2 desktop o Rust buscava, com cache em SQLite e fallback via busca
 * web. Aqui vai direto ao LRCLIB por `fetch`. Duas coisas continuam valendo:
 *
 * - **LRCLIB é gratuito e sem chave**, mas exige um `User-Agent` identificável.
 *   Sem ele a API devolve 403, e o erro aparece como "letra indisponível" em vez
 *   de "requer identificação";
 * - **404 é resposta normal**, não erro: a letra dessa faixa simplesmente não
 *   existe lá. Precisa virar `null`, não uma exceção.
 */

import { parseLrc, parsePlain } from "./parser";
import { estimateWords } from "./words";
import type { LyricsLine } from "./types";

const LRCLIB = "https://lrclib.net/api";
/**
 * Identifica a origem da requisição, como o LRCLIB pede. Nada de dado
 * pessoal: é a mesma string que o Cider 2 desktop usava.
 */
const USER_AGENT = "NexoraCider/1.0 (+https://nexorachat.cloud)";

export interface LyricsQuery {
  artist: string;
  title: string;
  /** Duração em segundos; o LRCLIB usa para desambiguar versões. */
  durationSeconds?: number;
  album?: string;
}

export interface LyricsResult {
  lines: LyricsLine[];
  /** `true` quando a fonte tinha marcação de tempo, e não só texto. */
  synced: boolean;
  /**
   * `true` quando **toda** linha ganhou tempos estimados por palavra. O LRCLIB
   * só marca o tempo da linha, então isso é o normal — e a interface avisa,
   * em vez de fingir que a fonte mandou karaokê.
   */
  estimated: boolean;
  source: "lrclib";
  provider: string;
  attribution: string;
}

export async function fetchLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
  const artist = query.artist.trim();
  const title = query.title.trim();
  if (!artist || !title) return null;

  // 1) Consulta exata por artista + título, com duração como desempate.
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  if (query.durationSeconds && query.durationSeconds > 0) {
    params.set("duration", String(Math.round(query.durationSeconds)));
  }
  const exact = (await request(`/get?${params.toString()}`)) as LrclibTrack | null;
  if (exact) return toResult(exact);

  // 2) Busca ampla: pega quando a faixa veio do YouTube com título sujo
  //    ("Artista - Música (Official Video)") e o nome está só perto.
  const search = (await request(
    `/search?${new URLSearchParams({ q: `${artist} ${title}` }).toString()}`
  )) as LrclibTrack[] | null;
  const hit = Array.isArray(search)
    ? search.find(candidate => plausible(candidate, artist, title, query.durationSeconds))
    : undefined;
  if (hit) return toResult(hit);

  return null;
}

interface LrclibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number | null;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

async function request(url: string): Promise<unknown> {
  try {
    const response = await fetch(`${LRCLIB}${url}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Sem rede: letra é um recurso opcional, não deve derrubar a página.
    return null;
  }
}

function plausible(
  track: LrclibTrack,
  artist: string,
  title: string,
  durationSeconds?: number
): boolean {
  if (track.instrumental) return false;
  if (!track.syncedLyrics && !track.plainLyrics) return false;
  if (durationSeconds && track.duration) {
    // Durações muito diferentes são outra gravação (remix, live, extended).
    const delta = Math.abs(track.duration - durationSeconds);
    if (delta > 12) return false;
  }
  const sameTitle = normalize(track.trackName).includes(normalize(title));
  const sameArtist = normalize(track.artistName).includes(normalize(artist));
  return sameTitle && sameArtist;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toResult(track: LrclibTrack | null): LyricsResult | null {
  if (!track) return null;
  const parsed = track.syncedLyrics
    ? parseLrc(track.syncedLyrics)
    : { lines: parsePlain(track.plainLyrics ?? ""), synced: false };
  if (parsed.lines.length === 0) return null;

  // A fonte quase sempre manda tempo só por linha; o destaque por palavra vem
  // de estimativa, e a interface precisa poder dizer isso com honestidade.
  const lines = estimateWords(parsed.lines);
  const estimated =
    lines.length > 0 &&
    lines.every(line => {
      const words = line.words;
      if (!words || words.length === 0) return true;
      return words.every(word => word.estimated);
    });

  return {
    lines,
    synced: parsed.synced,
    estimated,
    source: "lrclib",
    provider: track.artistName,
    attribution: `Letra por ${track.artistName} · LRCLIB`,
  };
}
