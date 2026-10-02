/**
 * Misturas e blocos de humor — o que o Apple Music chama de "Listen Now" e de
 * exploração por género/estado de espírito.
 *
 * Duas telas usam este catálogo, e por motivos diferentes:
 *
 * - **Início** mostra as **misturas** (Energia, Relaxamento, Foco, Boa
 *   Disposição, Melancolia) como o Apple Music mostra as mixes geradas por
 *   algoritmo;
 * - **Pesquisa** mostra os **blocos** coloridos antes de a pessoa digitar
 *   qualquer coisa, que é a exploração heurística descrita nas HIG.
 *
 * O que o Cider **não** tem é o algoritmo da Apple: não existe modelo de
 * recomendação aqui, e inventar um "personalizado" que na verdade é uma consulta
 * fixa seria mentira. A honestidade do desenho está em duas partes:
 *
 * 1. quando existe biblioteca local, a mistura nasce dos **artistas da própria
 *    pessoa** (histórico e favoritos), cruzados com o humor da mistura —
 *    "Mistura de Foco" a partir de quem você ouve é uma resposta que o
 *    navegador consegue dar de verdade;
 * 2. quando não existe, ela cai na consulta do **tema**, e a interface diz isso
 *    ("a partir do seu histórico" vs "pelo tema"), em vez de fingir
 *    personalização.
 *
 * Nada aqui faz rede: só monta as consultas. Quem as executa é `play.ts`, pelo
 * mesmo caminho de busca da tela de pesquisa.
 */

import type { CiderTrack } from "../api/query";

/** Teto de consultas por mistura: cada uma é um lote de resultados real. */
export const MIX_QUERY_LIMIT = 4;
/** Quantos artistas da pessoa entram na mistura. */
export const MIX_SEED_LIMIT = 3;

export interface MixDefinition {
  id: string;
  label: string;
  /** Frase curta: o que a mistura promete. */
  hint: string;
  /** Cor do bloco. O Apple Music usa blocos coloridos, não capas. */
  tone: string;
  /** Consulta do tema, usada quando não há biblioteca para semear. */
  query: string;
  /** Qualificador que se junta ao nome de um artista ouvido pela pessoa. */
  withArtist: string;
}

/**
 * As cinco misturas, na ordem em que aparecem.
 *
 * São as do Apple Music (Energy, Relax, Focus, Feel Good, Feeling Blue) com os
 * nomes em português — o mesmo conjunto, para a tela ser reconhecível.
 */
export const MIXES: MixDefinition[] = [
  {
    id: "energia",
    label: "Mistura de Energia",
    hint: "Para levantar o ritmo",
    tone: "#ff5f6d",
    query: "high energy electronic hits",
    withArtist: "hits",
  },
  {
    id: "relaxamento",
    label: "Mistura de Relaxamento",
    hint: "Para desacelerar",
    tone: "#5ac8fa",
    query: "chill acoustic songs",
    withArtist: "acoustic",
  },
  {
    id: "foco",
    label: "Mistura de Foco",
    hint: "Para trabalhar sem letra",
    tone: "#7b5cff",
    query: "instrumental focus music",
    withArtist: "instrumental",
  },
  {
    id: "boa-disposicao",
    label: "Mistura de Boa Disposição",
    hint: "Para o dia ficar leve",
    tone: "#ffb547",
    query: "feel good upbeat songs",
    withArtist: "feel good",
  },
  {
    id: "melancolia",
    label: "Mistura de Melancolia",
    hint: "Para quando o dia pede",
    tone: "#3d7bff",
    query: "melancholy songs playlist",
    withArtist: "sad songs",
  },
];

/**
 * Blocos de exploração antes de digitar.
 *
 * Cada bloco é um género, um humor ou uma atividade — as três taxonomias que a
 * referência usa — e carrega a consulta que executa ao ser tocado. A consulta
 * aparece no próprio bloco: a pessoa vê exatamente o que vai ser procurado, em
 * vez de um rótulo de marketing que esconde a busca.
 */
export interface MoodTile {
  id: string;
  label: string;
  tone: string;
  query: string;
}

export const MOOD_TILES: MoodTile[] = [
  { id: "energia", label: "Energia", tone: "#ff5f6d", query: "high energy hits" },
  { id: "relaxar", label: "Relaxar", tone: "#5ac8fa", query: "chill acoustic songs" },
  { id: "foco", label: "Foco", tone: "#7b5cff", query: "instrumental focus music" },
  { id: "festa", label: "Festa", tone: "#ff2d92", query: "party hits playlist" },
  { id: "danca", label: "Dança", tone: "#22d3a6", query: "dance hits 2026" },
  { id: "fitness", label: "Fitness", tone: "#ff8a3d", query: "workout motivation music" },
  { id: "estudo", label: "Estudo", tone: "#4f9dff", query: "lofi study beats" },
  { id: "dormir", label: "Dormir", tone: "#6c6cf5", query: "sleep music relaxing" },
  { id: "dirigir", label: "Dirigir", tone: "#c07bff", query: "road trip songs" },
  { id: "melancolia", label: "Melancolia", tone: "#3d7bff", query: "melancholy songs playlist" },
];

/** O que a biblioteca deste navegador pode oferecer para semear uma mistura. */
export interface MixSources {
  history: Array<{ track: CiderTrack }>;
  favorites: CiderTrack[];
}

/**
 * Os artistas mais presentes na biblioteca, do mais ouvido para o menos.
 *
 * Histórico e favoritos contam juntos: quem ouviu muito uma faixa e depois a
 * favoritou não deve valer o dobro de quem só a ouviu — o que interessa é a
 * presença do artista, não a forma como ela chegou aqui.
 */
export function mixSeedArtists(sources: MixSources, max: number = MIX_SEED_LIMIT): string[] {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const entry of [...sources.history.map((item) => item.track), ...sources.favorites]) {
    if (!entry?.videoId || seen.has(entry.videoId)) continue;
    seen.add(entry.videoId);
    const artist = (entry.artist || entry.channelName || "").trim();
    if (!artist) continue;
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, max))
    .map(([artist]) => artist);
}

/**
 * As consultas que montam a mistura.
 *
 * Os artistas da pessoa vêm **primeiro** e a consulta do tema fecha a lista: o
 * resultado é ordenado por lote, então o que entra primeiro é o que mais se
 * parece com o que ela já ouve. Sem biblioteca, sobra a consulta do tema — e um
 * único item é o mínimo honesto para uma mistura que não pode ser pessoal.
 */
export function mixQueries(
  mix: MixDefinition,
  sources: MixSources,
  limit: number = MIX_QUERY_LIMIT
): string[] {
  const cap = Math.max(1, limit);
  const queries: string[] = [];
  const push = (value: string) => {
    const query = value.trim();
    if (!query) return;
    if (queries.some((existing) => existing.toLowerCase() === query.toLowerCase())) return;
    queries.push(query);
  };

  for (const artist of mixSeedArtists(sources)) {
    if (queries.length >= cap - 1) break;
    push(`${artist} ${mix.withArtist}`);
  }
  push(mix.query);
  return queries.slice(0, cap);
}

/** `true` quando a mistura sai do que a pessoa ouviu, e não do tema. */
export function mixIsPersonalized(sources: MixSources): boolean {
  return mixSeedArtists(sources).length > 0;
}

/** Rótulo da origem da mistura — a interface diz de onde ela veio. */
export function mixSourceLabel(sources: MixSources): string {
  return mixIsPersonalized(sources) ? "A partir do seu histórico" : "Pelo tema";
}
