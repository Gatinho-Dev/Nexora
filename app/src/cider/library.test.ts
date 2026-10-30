import { describe, expect, it } from "vitest";

import type { CiderTrack } from "./api/query";
import {
  EMPTY_LIBRARY,
  HISTORY_LIMIT,
  albumKeyOf,
  groupAlbums,
  groupArtists,
  isFavorite,
  knownTracks,
  parseLibrary,
  pushHistory,
  withClearedHistory,
  withFavoriteToggled,
  withNewPlaylist,
  withSearchRemembered,
  withSearchesForgotten,
  withTrackRemoved,
  withTracksAdded,
} from "./library";

function track(id: string, overrides: Partial<CiderTrack> = {}): CiderTrack {
  return {
    videoId: id,
    title: `Faixa ${id}`,
    artist: "Artista",
    channelName: "Canal",
    youtubeTitle: `Faixa ${id} (Official Audio)`,
    albumHint: null,
    artworkUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
    durationMs: 180_000,
    url: `https://www.youtube.com/watch?v=${id}`,
    version: "studio",
    score: 0,
    isAlternative: false,
    isExplicit: false,
    ...overrides,
  };
}

describe("Cider · biblioteca local", () => {
  it("não repete a mesma faixa em sequência no histórico", () => {
    const first = pushHistory(EMPTY_LIBRARY, track("a"), 1000);
    const again = pushHistory(first, track("a"), 2000);
    expect(again.history).toHaveLength(1);
    expect(again.history[0]?.playedAt).toBe(1000);

    // Faixa diferente entra normalmente.
    const second = pushHistory(again, track("b"), 3000);
    expect(second.history.map((entry) => entry.track.videoId)).toEqual(["b", "a"]);
  });

  it("mantém o histórico dentro do teto", () => {
    let library = EMPTY_LIBRARY;
    for (let index = 0; index < HISTORY_LIMIT + 25; index += 1) {
      library = pushHistory(library, track(`t${index}`), index);
    }
    expect(library.history).toHaveLength(HISTORY_LIMIT);
    expect(library.history[0]?.track.videoId).toBe(`t${HISTORY_LIMIT + 24}`);
  });

  it("alterna favorito pelo videoId, sem duplicar", () => {
    const withFavorite = withFavoriteToggled(EMPTY_LIBRARY, track("a"));
    expect(isFavorite(withFavorite, "a")).toBe(true);

    const twice = withFavoriteToggled(withFavorite, track("a"));
    expect(isFavorite(twice, "a")).toBe(false);
    expect(twice.favorites).toHaveLength(0);
  });

  it("cria playlist, adiciona faixas sem duplicar e remove uma", () => {
    const { library, playlist } = withNewPlaylist(EMPTY_LIBRARY, "Viagem", 500);
    const added = withTracksAdded(library, playlist.id, [track("a"), track("b")], 600);
    expect(added.added).toBe(2);

    const again = withTracksAdded(added.library, playlist.id, [track("b"), track("c")], 700);
    expect(again.added).toBe(1);
    expect(again.library.playlists[0]?.tracks.map((item) => item.videoId)).toEqual(["a", "b", "c"]);

    const removed = withTrackRemoved(again.library, playlist.id, "b", 800);
    expect(removed.playlists[0]?.tracks.map((item) => item.videoId)).toEqual(["a", "c"]);
  });

  it("não duplica busca recente e mantém a mais nova na frente", () => {
    let library = withSearchRemembered(EMPTY_LIBRARY, "the weeknd", 1);
    library = withSearchRemembered(library, "dua lipa", 2);
    library = withSearchRemembered(library, "THE WEEKND", 3);
    expect(library.searches.map((entry) => entry.query)).toEqual(["THE WEEKND", "dua lipa"]);

    expect(withSearchesForgotten(library).searches).toEqual([]);
  });

  it("apaga o histórico inteiro sem mexer nos favoritos", () => {
    const withFavorite = withFavoriteToggled(EMPTY_LIBRARY, track("a"));
    const withHistory = pushHistory(withFavorite, track("a"), 10);
    const cleared = withClearedHistory(withHistory);
    expect(cleared.history).toEqual([]);
    expect(cleared.favorites).toHaveLength(1);
  });

  it("ignora faixa corrompida no armazenamento", () => {
    const parsed = parseLibrary({
      history: [{ track: { title: "sem id" }, playedAt: 1 }, { track: track("ok"), playedAt: 2 }],
      favorites: [{ videoId: "x" }, track("y")],
      playlists: [{ id: "p", name: "P", tracks: [track("z")] }, { name: "sem id" }],
      searches: [{ query: "" }, { query: "boa", at: 5 }],
    });
    expect(parsed.history.map((entry) => entry.track.videoId)).toEqual(["ok"]);
    expect(parsed.favorites.map((item) => item.videoId)).toEqual(["y"]);
    expect(parsed.playlists.map((item) => item.id)).toEqual(["p"]);
    expect(parsed.searches.map((entry) => entry.query)).toEqual(["boa"]);
  });

  it("agrupa por álbum (palpite) e por artista", () => {
    const a = track("a", { artist: "Ana", channelName: "Ana", albumHint: "Disco Um" });
    const b = track("b", { artist: "Ana", channelName: "Ana", albumHint: "Disco Um" });
    const c = track("c", { artist: "Beto", channelName: "Beto" });

    const albums = groupAlbums([a, b, c]);
    expect(albums.map((group) => group.title)).toEqual(["Disco Um", "Beto"]);
    expect(albums[0]?.tracks).toHaveLength(2);
    expect(albumKeyOf(c)).toBe("Beto");

    const artists = groupArtists([a, c]);
    expect(artists.map((group) => group.name)).toEqual(["Ana", "Beto"]);
  });

  it("junta favoritos e histórico em faixas conhecidas, sem repetir", () => {
    const withFavorite = withFavoriteToggled(EMPTY_LIBRARY, track("a"));
    const withHistory = pushHistory(pushHistory(withFavorite, track("a"), 1), track("b"), 2);
    expect(knownTracks(withHistory).map((item) => item.videoId)).toEqual(["a", "b"]);
  });
});
