/**
 * As misturas e os blocos de humor têm duas decisões que são de dados: de onde
 * a mistura tira os artistas e em que ordem as consultas saem. Nenhuma das duas
 * aparece na tela, e é justamente por isso que ficam travadas aqui — uma mistura
 * que "personaliza" sem biblioteca, ou que gasta cinco consultas de rede para
 * dizer a mesma coisa, seria invisível na revisão.
 */

import { describe, expect, it } from "vitest";

import {
  MIX_QUERY_LIMIT,
  MIXES,
  MOOD_TILES,
  mixIsPersonalized,
  mixQueries,
  mixSeedArtists,
  mixSourceLabel,
} from "./core/mixes";
import type { CiderTrack } from "./api/query";

function track(id: string, artist: string): CiderTrack {
  return {
    videoId: id,
    title: id.toUpperCase(),
    artist,
    channelName: "",
    youtubeTitle: id,
    albumHint: null,
    artworkUrl: "",
    durationMs: 200_000,
    url: `https://youtu.be/${id}`,
    version: "studio",
    score: 0,
    isAlternative: false,
    isExplicit: false,
  };
}

const empty = { history: [], favorites: [] };

describe("catálogo", () => {
  it("as cinco misturas têm id único, tom válido e consulta própria", () => {
    expect(MIXES).toHaveLength(5);
    expect(new Set(MIXES.map((mix) => mix.id)).size).toBe(MIXES.length);
    for (const mix of MIXES) {
      expect(mix.label).toBeTruthy();
      expect(mix.hint).toBeTruthy();
      expect(mix.query).toBeTruthy();
      expect(mix.tone).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("os blocos cobrem género, humor e atividade — e mostram a consulta", () => {
    expect(MOOD_TILES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(MOOD_TILES.map((tile) => tile.id)).size).toBe(MOOD_TILES.length);
    for (const tile of MOOD_TILES) {
      expect(tile.label).toBeTruthy();
      expect(tile.query).toBeTruthy();
      expect(tile.tone).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(MOOD_TILES.map((tile) => tile.id)).toEqual(
      expect.arrayContaining(["foco", "festa", "fitness", "estudo"])
    );
  });
});

describe("mixSeedArtists", () => {
  it("conta histórico e favoritos juntos, sem repetir a mesma faixa", () => {
    const artists = mixSeedArtists({
      history: [{ track: track("a", "Ana") }],
      favorites: [track("a", "Ana"), track("c", "Ana"), track("d", "Bia")],
    });
    // "a" aparece no histórico e nos favoritos, mas conta uma vez só.
    expect(artists).toEqual(["Ana", "Bia"]);
  });

  it("ignora faixa sem artista e respeita o teto", () => {
    const history = Array.from({ length: 10 }, (_item, at) => ({ track: track(`v${at}`, `Artista ${at}`) }));
    expect(mixSeedArtists({ history, favorites: [] }, 3)).toHaveLength(3);
    expect(mixSeedArtists({ history: [{ track: track("x", "") }], favorites: [] })).toEqual([]);
  });
});

describe("mixQueries", () => {
  const mix = MIXES[2]!; // Mistura de Foco

  it("sem biblioteca, sobra a consulta do tema — e a mistura não se diz pessoal", () => {
    expect(mixQueries(mix, empty)).toEqual([mix.query]);
    expect(mixIsPersonalized(empty)).toBe(false);
    expect(mixSourceLabel(empty)).toBe("Pelo tema");
  });

  it("com biblioteca, os seus artistas vêm antes do tema", () => {
    const sources = { history: [{ track: track("a", "Ana"), }], favorites: [track("b", "Bia")] };
    const queries = mixQueries(mix, sources);
    expect(queries[0]).toBe(`Ana ${mix.withArtist}`);
    expect(queries[queries.length - 1]).toBe(mix.query);
    expect(mixIsPersonalized(sources)).toBe(true);
    expect(mixSourceLabel(sources)).toBe("A partir do seu histórico");
  });

  it("não repete consulta e respeita o teto de lotes", () => {
    const history = Array.from({ length: 8 }, (_item, at) => ({ track: track(`h${at}`, `Artista ${at}`) }));
    const queries = mixQueries(mix, { history, favorites: [] });
    expect(queries.length).toBeLessThanOrEqual(MIX_QUERY_LIMIT);
    expect(new Set(queries.map((query) => query.toLowerCase())).size).toBe(queries.length);
    // O tema nunca é engolido pelos artistas: é o último e está presente.
    expect(queries).toContain(mix.query);
  });

  it("um artista não pode ocupar a lista inteira", () => {
    const history = [{ track: track("a", "Ana") }];
    const queries = mixQueries(mix, { history, favorites: [] }, 2);
    expect(queries).toEqual([`Ana ${mix.withArtist}`, mix.query]);
  });
});
