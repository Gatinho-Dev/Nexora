/**
 * Normalização de metadados no front-end.
 *
 * O núcleo Rust já normaliza tudo que vem da YouTube Data API v3
 * (`src-tauri/src/youtube/metadata.rs`). Este módulo é o **espelho** usado pela
 * interface para o que ela precisa decidir sozinha: rótulos de versão, tipo de
 * publicação, ordenação de resultados, agrupamento em "álbuns" e o texto de
 * exibição. Ele é puro e testado, e a regra é a mesma dos dois lados:
 *
 * - o título original do YouTube nunca é alterado nem descartado;
 * - heurística é sempre marcada como heurística.
 */

/**
 * Normaliza texto para comparação: tira acento, baixa a caixa e apara espaços.
 *
 * "Sem Acento" e "sem acento" têm de colidir no ranking, senão a busca por
 * "the weeknd" não encontra "The Wknd" e afins.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type VersionKind =
  | "studio"
  | "live"
  | "acoustic"
  | "remix"
  | "radio-edit"
  | "extended"
  | "sped-up"
  | "slowed"
  | "nightcore"
  | "instrumental"
  | "karaoke"
  | "cover";

export const VERSION_LABELS: Record<VersionKind, string> = {
  studio: "versão de estúdio",
  live: "ao vivo",
  acoustic: "acústico",
  remix: "remix",
  "radio-edit": "edição de rádio",
  extended: "extended",
  "sped-up": "acelerado",
  slowed: "desacelerado",
  nightcore: "nightcore",
  instrumental: "instrumental",
  karaoke: "karaokê",
  cover: "cover",
};

/**
 * Versões cujo **texto cantado** muda de verdade em relação ao estúdio.
 *
 * Quando o vídeo e a letra são de versões diferentes desse conjunto, a letra não
 * deve ser aceita: as linhas não acompanham a gravação (ver `lyrics/matcher.ts`).
 */
export const VERSION_BLOCKING: VersionKind[] = [
  "live",
  "acoustic",
  "remix",
  "cover",
  "instrumental",
  "karaoke",
  "nightcore",
  "sped-up",
  "slowed",
];

/** Versões que mudam a gravação (e portanto a letra). */
export const RECORDING_CHANGING: VersionKind[] = [
  "live",
  "acoustic",
  "remix",
  "radio-edit",
  "extended",
  "sped-up",
  "slowed",
  "nightcore",
  "instrumental",
  "karaoke",
  "cover",
];

/** Termos que descrevem a publicação do vídeo, não a música. */
export const NOISE_TERMS: string[] = [
  "official audio",
  "official video",
  "official music video",
  "official visualizer",
  "official lyric video",
  "official",
  "audio",
  "video",
  "lyric video",
  "lyrics video",
  "lyrics",
  "letra",
  "clipe oficial",
  "videoclipe",
  "visualizer",
  "visualiser",
  "hd",
  "hq",
  "4k",
  "8k",
  "1080p",
  "720p",
  "remastered",
  "remaster",
  "mastered",
  "topic",
  "explicit",
  "clean",
  "full album",
  "album completo",
  "music video",
  "m/v",
  "mv",
  "pv",
  "free download",
  "download",
];

const VERSION_PATTERNS: Array<[RegExp, VersionKind]> = [
  [/\bnightcore\b/, "nightcore"],
  [/\bsped\s*up\b|\bspeed\s*up\b|\baccelerated\b/, "sped-up"],
  [/\bslowed\s*\+?\s*reverb\b|\bslowed\b|\bslow\s*version\b/, "slowed"],
  [/\bremix\b|\bbootleg\b|\bmashup\b|\bvip\s*mix\b/, "remix"],
  [/\bkaraoke\b|\bplayback\b/, "karaoke"],
  [/\binstrumental\b/, "instrumental"],
  [/\blive\b|\bao\s*vivo\b|\bconcert\b|\btour\b/, "live"],
  [/\bacoustic\b|\bacústico\b|\bunplugged\b/, "acoustic"],
  [/\bradio\s*edit\b|\bradio\s*version\b/, "radio-edit"],
  [/\bextended\s*(mix|version|edit)?\b/, "extended"],
  [/\bcover\b|\bcover\s+by\b|\breaction\b/, "cover"],
];

function isNoise(term: string): boolean {
  return NOISE_TERMS.includes(term.trim());
}

/** Remove marcadores de publicação preservando versões reais (`(Live)`). */
export function stripNoise(title: string): string {
  const bracketed = /[([{]([^)\]}]*)[)\]}]/g;
  let without = "";
  let last = 0;
  for (const match of title.matchAll(bracketed)) {
    const whole = match[0];
    const inner = normalizeText(match[1] ?? "");
    const start = match.index ?? 0;
    // Mantemos o bloco quando ele carrega informação real (versão, remix…).
    const keep =
      inner.length === 0 || !(isNoise(inner) || inner.split(" ").every((token) => isNoise(token)));
    without += title.slice(last, start);
    without += keep ? whole : " ";
    last = start + whole.length;
  }
  without += title.slice(last);

  const tokens = without.split(/\s+/).filter(Boolean);
  while (tokens.length > 0 && isNoise(normalizeText(tokens[tokens.length - 1]!))) {
    tokens.pop();
  }
  const joined = tokens.join(" ").replace(/^[\s\-|·]+|[\s\-|·]+$/g, "");
  return joined || title.trim();
}

export function detectVersion(title: string): VersionKind {
  const normalized = normalizeText(title);
  for (const [pattern, kind] of VERSION_PATTERNS) {
    if (pattern.test(normalized)) return kind;
  }
  return "studio";
}

export function versionLabel(kind: VersionKind): string {
  return VERSION_LABELS[kind];
}

export function channelLooksLikeTopic(channel: string): boolean {
  return normalizeText(channel).endsWith("topic");
}

export function channelToArtist(channel: string): string {
  const trimmed = channel.trim();
  if (channelLooksLikeTopic(trimmed)) {
    return trimmed.replace(/\s*-\s*topic\s*$/i, "").trim();
  }
  if (trimmed.endsWith("VEVO")) return trimmed.slice(0, -4).trim();
  return trimmed.replace(/\s+official\s*$/i, "").trim();
}

/** Divide `Artista - Música`, com cuidado com hífens dentro do título. */
export function splitArtistTitle(title: string): { artist: string; track: string } | null {
  const separators = /\s+[-–—]\s+|\s+\|\s+|\s+\/\/\s+/g;
  for (const match of title.matchAll(separators)) {
    const start = match.index ?? 0;
    const left = title.slice(0, start).trim();
    const right = title.slice(start + match[0].length).trim();
    if (left.length >= 2 && right.length >= 2 && left.length <= 80 && right.length <= 120) {
      return { artist: left, track: right };
    }
  }
  return null;
}

/** Tipo de publicação exibido no resultado da busca. */
export function publicationKind(channel: string, title: string): string {
  const haystack = normalizeText(`${channel} ${title}`);
  if (channelLooksLikeTopic(channel)) return "Tema do artista (áudio oficial)";
  if (haystack.includes("official audio") || haystack.includes("official visualizer")) {
    return "Áudio oficial";
  }
  if (haystack.includes("official music video") || haystack.includes("vevo")) {
    return "Videoclipe oficial";
  }
  if (haystack.includes("official") || haystack.includes("topic")) return "Canal oficial";
  if (haystack.includes("lyric")) return "Lyric video";
  if (haystack.includes("live") || haystack.includes("ao vivo")) return "Ao vivo";
  if (haystack.includes("remix")) return "Remix";
  if (haystack.includes("cover")) return "Cover";
  return "Publicação avulsa";
}

/** `m:ss` ou `h:mm:ss` a partir dos milissegundos. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Similaridade simples por tokens (Jaccard + contenção). */
export function titleSimilarity(left: string, right: string): number {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  const containment = a.includes(b) || b.includes(a) ? 0.75 : 0;
  return Math.max(jaccard, containment);
}

export function explicitHint(title: string): boolean {
  return /\b(explicit|parental\s+advisory)\b/i.test(title);
}

/** Duração plausível de uma faixa (Shorts e álbuns completos ficam de fora). */
export function plausibleDuration(durationMs: number): boolean {
  return durationMs <= 0 || (durationMs >= 45_000 && durationMs <= 20 * 60_000);
}

export function looksLikeMusic(input: {
  title: string;
  channel: string;
  durationMs: number;
}): boolean {
  if (!plausibleDuration(input.durationMs)) return false;
  return /\b(official|topic|vevo|lyrics?|audio|music video|remix|acoustic|live)\b/i.test(
    `${input.channel} ${input.title}`,
  );
}

export interface ScoreInput {
  title: string;
  channel: string;
  durationMs: number;
  embeddable?: boolean | null;
  live?: boolean;
}

/**
 * Pontuação de 0 a 100 usada para ordenar resultados (mesmos pesos do núcleo:
 * título 40, artista/canal 20, tipo 15, versão 10, duração 10, disponibilidade 5).
 */
export function scoreCandidate(query: string, candidate: ScoreInput): number {
  const normalizedQuery = normalizeText(query);
  const cleaned = stripNoise(candidate.title);
  const artist = channelToArtist(candidate.channel);
  const queryVersion = detectVersion(query);
  const candidateVersion = detectVersion(candidate.title);

  const direct = titleSimilarity(normalizedQuery, cleaned);
  const full = titleSimilarity(normalizedQuery, candidate.title);
  const withoutArtist = titleSimilarity(normalizedQuery, cleaned.replace(artist, " "));
  const titleScore = Math.round(Math.max(direct, full, withoutArtist * 0.95) * 40);

  const artistScore =
    artist && normalizedQuery.includes(normalizeText(artist))
      ? 20
      : Math.round(
          Math.max(titleSimilarity(normalizedQuery, artist), titleSimilarity(normalizedQuery, candidate.channel)) * 20,
        );

  const haystack = normalizeText(`${candidate.channel} ${candidate.title}`);
  let kindScore = 0;
  if (channelLooksLikeTopic(candidate.channel)) kindScore = 15;
  else if (haystack.includes("official audio") || haystack.includes("official music video")) kindScore = 13;
  else if (haystack.includes("official") || haystack.includes("vevo")) kindScore = 11;
  else if (haystack.includes("lyric")) kindScore = 8;
  else if (haystack.includes("music video")) kindScore = 7;
  else if (haystack.includes("visualizer")) kindScore = 5;

  const wanted = RECORDING_CHANGING.includes(queryVersion);
  const got = RECORDING_CHANGING.includes(candidateVersion);
  const versionScore = !wanted && !got ? 8 : wanted && got ? (queryVersion === candidateVersion ? 10 : 6) : wanted && !got ? 2 : 0;

  const durationScore =
    candidate.durationMs <= 0
      ? 3
      : !plausibleDuration(candidate.durationMs)
        ? 0
        : candidate.durationMs < 90_000
          ? 5
          : candidate.durationMs <= 12 * 60_000
            ? 10
            : 6;

  const availability =
    (candidate.embeddable === true ? 5 : candidate.embeddable === false ? 0 : 3) -
    (candidate.live ? 1 : 0);

  return Math.max(
    0,
    Math.min(100, titleScore + artistScore + kindScore + versionScore + durationScore + Math.max(0, availability)),
  );
}

/**
 * Agrupa faixas em "álbuns" inferidos.
 *
 * O YouTube não tem álbuns: agrupamos por artista + nome-base do álbum quando
 * aparece no título/descrição, e marcamos o resultado como inferido para a
 * interface deixar claro que a organização é do Cider 2.
 */
/**
 * Nome de álbum que aparece entre parênteses/colchetes no título do vídeo.
 *
 * Só aceitamos blocos que **não** são ruído de publicação (`Official Audio`,
 * `4K`…) e que não descrevem uma versão (`Live`, `Remix`…): assim
 * `Faixa (After Hours)` vira álbum, e `Faixa (Official Audio)` continua sem
 * álbum identificado.
 */
export function albumHintFromTitle(title: string): string | null {
  const blocks = /[([{]([^)\]}]*)[)\]}]/g;
  for (const match of title.matchAll(blocks)) {
    const inner = (match[1] ?? "").trim();
    if (inner.length < 3) continue;
    const normalized = normalizeText(inner);
    if (isNoise(normalized)) continue;
    if (detectVersion(inner) !== "studio") continue;
    if (/^(?::?\d{2,4}|hq|hdr|dolby|atmos|spatial)$/.test(normalized)) continue;
    return inner;
  }
  return null;
}

export function groupIntoInferredAlbums(
  tracks: Array<{ id: string; title: string; artist: string; artworkUrl?: string }>,
): Array<{ id: string; title: string; artist: string; artworkUrl?: string; trackIds: string[]; inferred: true }> {
  const groups = new Map<string, { id: string; title: string; artist: string; artworkUrl?: string; trackIds: string[] }>();
  for (const track of tracks) {
    const album = albumHintFromTitle(track.title);
    // Sem álbum identificado, agrupamos pelo artista/canal — e a interface diz
    // que o agrupamento é do Cider 2, não uma entidade do YouTube.
    const title = album ?? track.artist;
    const key = `${normalizeText(track.artist)}|${normalizeText(title)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.trackIds.push(track.id);
      continue;
    }
    groups.set(key, {
      id: `inferred:${key}`,
      title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
      trackIds: [track.id],
    });
  }
  return Array.from(groups.values()).map((group) => ({ ...group, inferred: true as const }));
}
