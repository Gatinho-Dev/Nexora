/**
 * Intenção de busca, plano de consultas e reordenação.
 *
 * Partes puras portadas do Cider 2 desktop. A única diferença é o fim: lá o
 * plano era entregue ao Rust pelo IPC; aqui cada variante vai direto para o
 * navegador (`./search`), que fala com as instâncias Piped.
 */

import {
  detectVersion,
  explicitHint,
  scoreCandidate,
  stripNoise,
  type ScoreInput,
  type VersionKind,
} from "../core/metadata";

/* ------------------------------------------------------------------ *
 * Intenção                                                           *
 * ------------------------------------------------------------------ */

export type SearchIntentKind = "song" | "artist" | "album" | "any";

export interface SearchIntent {
  kind: SearchIntentKind;
  /** Texto sem o prefixo (`artist: Dua Lipa` → `Dua Lipa`). */
  term: string;
  /** Consulta refinada (pode acrescentar termos de música). */
  refined: string;
}

const PREFIXES: Array<[RegExp, SearchIntentKind]> = [
  [/^artist:\s*/i, "artist"],
  [/^artista:\s*/i, "artist"],
  [/^@\s*/, "artist"],
  [/^album:\s*/i, "album"],
  [/^álbum:\s*/i, "album"],
  [/^#\s*/, "album"],
  [/^song:\s*/i, "song"],
  [/^música:\s*/i, "song"],
  [/^track:\s*/i, "song"],
];

/** Interpreta a intenção do usuário sem exigir prefixo. */
export function parseIntent(input: string): SearchIntent {
  const trimmed = input.trim();
  for (const [pattern, kind] of PREFIXES) {
    if (pattern.test(trimmed)) {
      const term = trimmed.replace(pattern, "").trim();
      return { kind, term, refined: refine(term, kind) };
    }
  }
  return { kind: "any", term: trimmed, refined: refine(trimmed, "any") };
}

function refine(term: string, kind: SearchIntentKind): string {
  switch (kind) {
    case "artist":
      return `${term} topic`;
    case "album":
      return `${term} full album`;
    default:
      return term;
  }
}

/**
 * Plano de consultas: a primeira é a preferida, as outras são alternativas.
 *
 * A alternativa existe por um motivo concreto: muito canal oficial publica
 * como "Música - Artista", então inverter a ordem de um "Artista - Música"
 * encontra o vídeo certo que a busca original não achou.
 */
export function buildSearchPlan(intent: SearchIntent): string[] {
  const variants = [intent.refined];
  const cleaned = stripNoise(intent.term);
  if (cleaned !== intent.term && cleaned.trim()) variants.push(cleaned);
  if (intent.kind === "song" || intent.kind === "any") {
    const parts = cleaned.split(/\s+[-–—]\s+/);
    if (parts.length === 2 && parts[0] && parts[1]) {
      variants.push(`${parts[1]} ${parts[0]}`);
    }
  }
  return Array.from(new Set(variants.map(value => value.trim()).filter(Boolean)));
}

/* ------------------------------------------------------------------ *
 * Faixa                                                              *
 * ------------------------------------------------------------------ */

/** Faixa vinda da busca, já com os campos que a UI usa. */
export interface CiderTrack {
  videoId: string;
  /** Título exibido, limpo e separado em artista/faixa quando possível. */
  title: string;
  artist: string;
  channelName: string;
  /** Título original do YouTube, imutável. */
  youtubeTitle: string;
  albumHint: string | null;
  artworkUrl: string;
  durationMs: number;
  url: string;
  version: VersionKind;
  score: number;
  /** Versão acelerada, karaokê ou cover — escondido se o usuário não pediu. */
  isAlternative: boolean;
  isExplicit: boolean;
}

export interface SearchPreferences {
  preferOfficialAudio: boolean;
  hideAlternativeVersions: boolean;
  maxPerChannel: number;
  limit: number;
}

export const DEFAULT_SEARCH_PREFERENCES: SearchPreferences = {
  preferOfficialAudio: true,
  hideAlternativeVersions: false,
  maxPerChannel: 4,
  limit: 25,
};

/* ------------------------------------------------------------------ *
 * Reordenação                                                        *
 * ------------------------------------------------------------------ */

/** Título heurístico: "Artista - Música (Official Video)" → "Música". */
export function displayTitle(title: string): { title: string; artist: string } {
  const cleaned = stripNoise(title);
  const dashParts = cleaned.split(/\s+[-–—]\s+/);
  if (dashParts.length === 2 && dashParts[0] && dashParts[1]) {
    // O canal oficial escreve "Artista - Música"; a busca de álbum escreve
    // "Música - Artista". O lado com menos palavras costuma ser o título.
    const [left, right] =
      dashParts[0].split(/\s+/).length <= dashParts[1].split(/\s+/).length
        ? [dashParts[0], dashParts[1]]
        : [dashParts[1], dashParts[0]];
    return { artist: left, title: right };
  }
  return { artist: "", title: cleaned };
}

/** Remove duplicatas pelo `videoId`, mantendo o item de maior pontuação. */
export function dedupeTracks(items: CiderTrack[]): CiderTrack[] {
  const byId = new Map<string, CiderTrack>();
  for (const item of items) {
    const existing = byId.get(item.videoId);
    if (!existing || item.score > existing.score) byId.set(item.videoId, item);
  }
  return Array.from(byId.values());
}

export interface RerankContext {
  query: string;
  preferences: SearchPreferences;
  /** Id da faixa que está tocando: nunca deve virar "próxima". */
  excludeVideoId?: string;
}

/**
 * Reordena resultados com a pontuação local e as preferências do usuário.
 *
 * Determinístico de propósito: empate resolve por pontuação e depois pela
 * posição original, então a mesma busca devolve a mesma lista — o que evita a
 * lista "pular" quando o usuário rola para cima para clicar em algo.
 */
export function rerankTracks(
  items: CiderTrack[],
  context: RerankContext
): CiderTrack[] {
  const queryVersion = detectVersion(context.query);
  const wantedVersion: VersionKind | null = queryVersion === "studio" ? null : queryVersion;

  const scored = items
    .filter(item => item.videoId && item.videoId !== context.excludeVideoId)
    .map((item, index) => {
      const localScore = scoreCandidate(context.query, {
        title: item.youtubeTitle,
        channel: item.channelName,
        durationMs: item.durationMs,
      } satisfies ScoreInput);
      let score = item.score * 0.4 + localScore * 0.6;

      if (wantedVersion && item.version === wantedVersion) score += 40;
      // "Official Audio" e "Official Video" caem em `studio` no
      // `detectVersion`: o sufixo é ruído de publicação, não uma versão da
      // gravação. Então `studio` já é o sinal de faixa oficial.
      if (context.preferences.preferOfficialAudio && item.version === "studio") {
        score += 25;
      }
      // Diversidade: um canal só pode ocupar algumas posições do topo.
      return { item, score, index };
    })
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map(entry => entry.item);

  if (context.preferences.hideAlternativeVersions) {
    // Só esconde alternativas se sobrar música de verdade na lista.
    const hasReal = scored.some(item => !item.isAlternative);
    if (hasReal) return scored.filter(item => !item.isAlternative);
  }

  return capPerChannel(scored, context.preferences.maxPerChannel);
}

/** Mantém no máximo `max` itens por canal, preservando a ordem pontuada. */
export function capPerChannel(items: CiderTrack[], max: number): CiderTrack[] {
  if (max <= 0) return items;
  const seen = new Map<string, number>();
  const kept: CiderTrack[] = [];
  for (const item of items) {
    const count = seen.get(item.channelName) ?? 0;
    if (count >= max) continue;
    seen.set(item.channelName, count + 1);
    kept.push(item);
  }
  return kept;
}

/**
 * Versões que **não são** a gravação de estúdio: se o usuário não pediu
 * explicitamente, escondê-las deixa a lista limpa sem perder a faixa oficial.
 */
const ALTERNATIVE_VERSIONS: ReadonlySet<VersionKind> = new Set<VersionKind>([
  "live",
  "acoustic",
  "remix",
  "sped-up",
  "slowed",
  "nightcore",
  "karaoke",
  "cover",
  "instrumental",
]);

/**
 * Converte um item cru da busca numa faixa.
 *
 * `isAlternative` é derivado da versão detectada — sem isso a preferência
 * "esconder versões alternativas" nunca filtrava nada, porque o campo ficava
 * `false` em toda faixa.
 */
export function toTrack(input: {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  durationSeconds: number;
}): CiderTrack {
  const youtubeTitle = input.title;
  const { title, artist } = displayTitle(youtubeTitle);
  const version = detectVersion(youtubeTitle);
  return {
    videoId: input.videoId,
    title,
    artist: artist || input.author,
    channelName: input.author,
    youtubeTitle,
    albumHint: null,
    artworkUrl: input.thumbnail,
    durationMs: Math.max(0, Math.round(input.durationSeconds * 1000)),
    url: `https://www.youtube.com/watch?v=${input.videoId}`,
    version,
    score: 0,
    isAlternative: ALTERNATIVE_VERSIONS.has(version),
    isExplicit: explicitHint(youtubeTitle),
  };
}
