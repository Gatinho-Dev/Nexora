import { describe, expect, it } from "vitest";

import type { CiderTrack } from "./api/query";
import { assembleStation, radioQueries, suggestedSeeds } from "./radio";
import { deriveStats, formatDuration, shortDayLabel } from "./stats";

function track(id: string, overrides: Partial<CiderTrack> = {}): CiderTrack {
  return {
    videoId: id,
    title: `Faixa ${id}`,
    artist: "Ana",
    channelName: "Ana",
    youtubeTitle: "Faixa",
    albumHint: null,
    artworkUrl: "",
    durationMs: 120_000,
    url: `https://www.youtube.com/watch?v=${id}`,
    version: "studio",
    score: 0,
    isAlternative: false,
    isExplicit: false,
    ...overrides,
  };
}

describe("Cider · rádio", () => {
  it("monta consultas reais ao redor da semente, sem repetir", () => {
    const queries = radioQueries({ kind: "artist", value: "Ana" });
    expect(queries).toEqual(["Ana", "Ana topic", "Ana greatest hits"]);

    const withTrack = radioQueries({ kind: "track", value: "Ana", track: track("a", { title: "Sol" }) });
    expect(withTrack).toContain("Sol");
    expect(new Set(withTrack).size).toBe(withTrack.length);
  });

  it("sem semente não há consulta nem estação inventada", () => {
    expect(radioQueries({ kind: "artist", value: "   " })).toEqual([]);
    expect(assembleStation([[]])).toEqual([]);
  });

  it("junta os lotes na ordem das consultas, sem repetir faixa", () => {
    const station = assembleStation([
      [track("a"), track("b")],
      [track("b"), track("c")],
    ]);
    expect(station.map((item) => item.videoId)).toEqual(["a", "b", "c"]);
  });

  it("não deixa um canal dominar a estação e respeita os limites", () => {
    const flooded = [
      track("a1", { artist: "Mesmo", channelName: "Mesmo" }),
      track("a2", { artist: "Mesmo", channelName: "Mesmo" }),
      track("a3", { artist: "Mesmo", channelName: "Mesmo" }),
      track("a4", { artist: "Mesmo", channelName: "Mesmo" }),
      track("b1", { artist: "Outro", channelName: "Outro" }),
    ];
    const station = assembleStation([flooded], { maxPerArtist: 2 });
    expect(station.map((item) => item.videoId)).toEqual(["a1", "a2", "b1"]);

    const limited = assembleStation([[track("x"), track("y"), track("z")]], { limit: 2 });
    expect(limited.map((item) => item.videoId)).toEqual(["x", "y"]);
  });

  it("não repete a faixa que já está tocando", () => {
    const station = assembleStation([[track("a"), track("b")]], { excludeVideoId: "a" });
    expect(station.map((item) => item.videoId)).toEqual(["b"]);
  });

  it("sugere sementes pelo artista mais ouvido", () => {
    const seeds = suggestedSeeds([
      track("a", { artist: "Ana" }),
      track("b", { artist: "Ana" }),
      track("c", { artist: "Beto" }),
    ]);
    expect(seeds[0]).toEqual({ kind: "artist", value: "Ana" });
    expect(seeds.map((seed) => seed.value)).toEqual(["Ana", "Beto"]);
  });
});

describe("Cider · estatísticas", () => {
  const now = new Date("2026-03-10T12:00:00Z").getTime();

  it("conta reproduções, minutos e únicos", () => {
    const long = track("a", { durationMs: 180_000 });
    const stats = deriveStats(
      [
        { track: long, playedAt: now },
        { track: long, playedAt: now - 86_400_000 },
        { track: track("b", { artist: "Beto", durationMs: 120_000 }), playedAt: now },
      ],
      now,
    );
    expect(stats.plays).toBe(3);
    expect(stats.minutes).toBeCloseTo(8, 5);
    expect(stats.uniqueSongs).toBe(2);
    expect(stats.uniqueArtists).toBe(2);
    expect(stats.topSongs[0]).toEqual({ track: long, plays: 2 });
    expect(stats.topArtists[0]?.plays).toBe(2);
  });

  it("preenche os dias sem escuta com zero", () => {
    const stats = deriveStats([{ track: track("a"), playedAt: now }], now, 3);
    expect(stats.byDay).toHaveLength(3);
    expect(stats.byDay[2]?.plays).toBe(1);
    expect(stats.byDay[0]?.plays).toBe(0);
  });

  it("formata durações e rótulos curtos em pt-BR", () => {
    expect(formatDuration(8)).toBe("8 min");
    expect(formatDuration(150)).toBe("2,5 h");
    expect(formatDuration(0.4)).toBe("24 s");
    expect(shortDayLabel("2026-03-10")).toBe("10/03");
  });
});
