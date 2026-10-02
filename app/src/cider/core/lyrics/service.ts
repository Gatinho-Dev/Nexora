/**
 * Letras: LRCLIB com busca ampla na web como segunda fonte.
 *
 * No Cider 2 desktop o Rust buscava, com cache em SQLite e fallback via busca
 * web. Aqui a ordem é a mesma, com as duas etapas explícitas:
 *
 * 1. **LRCLIB** — gratuito e sem chave, e a única fonte daqui que entrega tempo
 *    por linha (ou seja, a única que vira karaokê). Exige um `User-Agent`
 *    identificável: sem ele a API devolve 403, e o erro apareceria como "letra
 *    indisponível" em vez de "requer identificação";
 * 2. **busca ampla na web** (`api.lyrics.ovh`, pública e sem chave, liberada
 *    para CORS) — o catálogo do LRCLIB não cobre tudo, e uma letra **sem
 *    sincronia** ainda é melhor que nenhuma. O texto entra marcado como tal, em
 *    vez de fingir um acompanhamento que a fonte não tem.
 *
 * Se nem isso achar, a interface oferece a busca no Google — o usuário nunca
 * fica sem saída, e o app nunca inventa letra.
 *
 * **404 é resposta normal**, não erro: a letra dessa faixa simplesmente não
 * existe lá. Precisa virar `null`, não uma exceção.
 */

import { stripNoise } from "../metadata";
import { parseLrc, parsePlain } from "./parser";
import { estimateWords } from "./words";
import type { LyricsLine } from "./types";

const LRCLIB = "https://lrclib.net/api";
/** Fonte de letra sem chave e com CORS liberado, usada como segunda tentativa. */
const WEB_LYRICS = "https://api.lyrics.ovh/v1";
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
  /** De onde veio a letra: o catálogo com tempo ou a busca ampla na web. */
  source: "lrclib" | "web";
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

  // 3) Segunda fonte: busca ampla na web, sem sincronia. O texto entra inteiro e
  //    marcado como não sincronizado — melhor que a tela vazia, sem mentir.
  const web = await fetchWebLyrics(query);
  if (web) return web;

  return null;
}

/**
 * Nome do artista limpo para uma consulta por URL ("Artista - Topic" → "Artista").
 *
 * A lista de créditos também sai: "ANDREA ft. OTILIA, SHAGGY, COSTI" vira
 * "ANDREA", que é como os catálogos de letra indexam. Só o `ft.`/`feat.`
 * separado por espaço dispara o corte — vírgula sozinha derrubaria banda de
 * verdade ("Earth, Wind & Fire").
 */
function cleanArtist(value: string): string {
  return value
    .split(/\s+(?:ft|feat|featuring)\.?\s+/i)[0]!
    .replace(/\s*[-–—]\s*(topic|vevo|official)\s*$/i, "")
    .replace(/\s*(vevo|official)\s*$/i, "")
    .replace(/\s*-\s*$/i, "")
    .trim();
}

/**
 * Títulos a tentar numa fonte de letras, do mais provável ao mais literal.
 *
 * O nome da publicação traz marcadores que a fonte não conhece — e o `|` é o
 * pior deles, porque `stripNoise` preserva tudo depois dele ("Passion |
 * Official Music Video 2015"). Para uma letra, o primeiro segmento é a música.
 */
function titleCandidates(value: string): string[] {
  const head = value.split(/[|·]/)[0] ?? "";
  const out = [stripNoise(head).trim(), stripNoise(value).trim()];
  return [...new Set(out.filter(Boolean))];
}

/**
 * Busca ampla fora do catálogo: tenta a letra em fontes públicas da web.
 *
 * O título passa pelo `stripNoise` porque o que chega aqui é o nome da
 * publicação ("Passion (Official Video)"), e os sites de letra não conhecem
 * esse sufixo. Quando o nome tem `|`, vale tentar também só o primeiro
 * segmento — é ele que costuma ser o nome da música.
 */
async function fetchWebLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
  const artist = cleanArtist(query.artist);
  const titles = titleCandidates(query.title);
  if (!artist || titles.length === 0) return null;

  for (const title of titles) {
    const payload = (await fetchJson(
      `${WEB_LYRICS}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    )) as { lyrics?: string } | null;
    const text = typeof payload?.lyrics === "string" ? payload.lyrics : "";
    const lines = parsePlain(text);
    if (lines.length === 0) continue;

    return {
      lines,
      synced: false,
      estimated: false,
      source: "web",
      provider: artist,
      attribution: `Letra por ${artist} · lyrics.ovh`,
    };
  }

  return null;
}

/**
 * Busca na web para conferir a letra quando nenhuma fonte automática respondeu.
 * É o último recurso da interface — um endereço de busca, não um scrape frágil.
 */
export function lyricsSearchUrl(artist: string, title: string): string {
  const term = [cleanArtist(artist), titleCandidates(title)[0] ?? title.trim(), "letra"]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(term)}`;
}

/** Superfície de teste: limpeza de nome é regra, não detalhe de formatação. */
export const __testing = { cleanArtist, titleCandidates };

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

async function request(path: string): Promise<unknown> {
  return fetchJson(`${LRCLIB}${path}`);
}

/** Um GET JSON tolerante: qualquer falha (rede, HTTP, formato) vira `null`. */
async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
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
