/**
 * Biblioteca local do Cider web: histórico, favoritos, playlists e buscas.
 *
 * O desktop tinha SQLite; aqui o equivalente é o `localStorage`, e a limitação
 * é dita na interface em vez de escondida: **a biblioteca é deste navegador**.
 * Nada é enviado para lugar nenhum, e trocar de máquina começa do zero.
 *
 * As transições são funções puras (`pushHistory`, `withFavoriteToggled`, …) para
 * poderem ser testadas sem DOM nem armazenamento. A store zustand é só a
 * casca que persiste e notifica a interface.
 */

import { create } from "zustand";
import type { CiderTrack } from "./api/query";

export interface HistoryEntry {
  track: CiderTrack;
  /** Quando a faixa começou a tocar (epoch ms). */
  playedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tracks: CiderTrack[];
}

export interface RecentSearch {
  query: string;
  at: number;
}

export interface CiderLibrary {
  history: HistoryEntry[];
  favorites: CiderTrack[];
  playlists: Playlist[];
  searches: RecentSearch[];
}

export const LIBRARY_KEY = "nexora-cider-library";

/** Tetos: sem eles o `localStorage` estoura e a aba fica lenta. */
export const HISTORY_LIMIT = 400;
export const FAVORITES_LIMIT = 600;
export const PLAYLISTS_LIMIT = 80;
export const PLAYLIST_TRACKS_LIMIT = 500;
export const SEARCHES_LIMIT = 20;

export const EMPTY_LIBRARY: CiderLibrary = {
  history: [],
  favorites: [],
  playlists: [],
  searches: [],
};

/* ------------------------------------------------------------------ *
 * Leitura tolerante                                                  *
 * ------------------------------------------------------------------ */

function parseStoredTrack(raw: unknown): CiderTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<CiderTrack>;
  if (typeof item.videoId !== "string" || !item.videoId) return null;
  if (typeof item.title !== "string" || !item.title) return null;
  return {
    videoId: item.videoId,
    title: item.title,
    artist: typeof item.artist === "string" ? item.artist : "",
    channelName: typeof item.channelName === "string" ? item.channelName : "",
    youtubeTitle: typeof item.youtubeTitle === "string" ? item.youtubeTitle : item.title,
    albumHint: typeof item.albumHint === "string" ? item.albumHint : null,
    artworkUrl: typeof item.artworkUrl === "string" ? item.artworkUrl : "",
    durationMs: Number.isFinite(item.durationMs) ? Number(item.durationMs) : 0,
    url: typeof item.url === "string" ? item.url : `https://www.youtube.com/watch?v=${item.videoId}`,
    version: (item.version ?? "studio") as CiderTrack["version"],
    score: Number.isFinite(item.score) ? Number(item.score) : 0,
    isAlternative: Boolean(item.isAlternative),
    isExplicit: Boolean(item.isExplicit),
  };
}

/** Lê a biblioteca guardada, descartando o que estiver corrompido. */
export function parseLibrary(raw: unknown): CiderLibrary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_LIBRARY;
  const source = raw as Record<string, unknown>;

  const history: HistoryEntry[] = Array.isArray(source.history)
    ? source.history
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const item = entry as { track?: unknown; playedAt?: unknown };
          const track = parseStoredTrack(item.track);
          if (!track) return null;
          return { track, playedAt: Number(item.playedAt) || 0 } satisfies HistoryEntry;
        })
        .filter((entry): entry is HistoryEntry => entry !== null)
        .slice(0, HISTORY_LIMIT)
    : [];

  const favorites = Array.isArray(source.favorites)
    ? source.favorites
        .map(parseStoredTrack)
        .filter((track): track is CiderTrack => track !== null)
        .slice(0, FAVORITES_LIMIT)
    : [];

  const playlists: Playlist[] = Array.isArray(source.playlists)
    ? source.playlists
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const item = entry as Partial<Playlist>;
          if (typeof item.id !== "string" || typeof item.name !== "string") return null;
          const tracks = Array.isArray(item.tracks)
            ? item.tracks
                .map(parseStoredTrack)
                .filter((track): track is CiderTrack => track !== null)
                .slice(0, PLAYLIST_TRACKS_LIMIT)
            : [];
          return {
            id: item.id,
            name: item.name,
            createdAt: Number(item.createdAt) || 0,
            updatedAt: Number(item.updatedAt) || 0,
            tracks,
          } satisfies Playlist;
        })
        .filter((playlist): playlist is Playlist => playlist !== null)
        .slice(0, PLAYLISTS_LIMIT)
    : [];

  const searches: RecentSearch[] = Array.isArray(source.searches)
    ? source.searches
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const item = entry as Partial<RecentSearch>;
          if (typeof item.query !== "string" || !item.query.trim()) return null;
          return { query: item.query.trim().slice(0, 160), at: Number(item.at) || 0 };
        })
        .filter((entry): entry is RecentSearch => entry !== null)
        .slice(0, SEARCHES_LIMIT)
    : [];

  return { history, favorites, playlists, searches };
}

/* ------------------------------------------------------------------ *
 * Transições puras                                                   *
 * ------------------------------------------------------------------ */

/**
 * Registra uma reprodução no topo do histórico.
 *
 * Repetir a mesma faixa seguidamente (recarregar o player, pausar e voltar) não
 * cria uma linha nova a cada evento: só entra quando a faixa muda. Sem isso o
 * histórico virava uma lista da mesma música.
 */
export function pushHistory(state: CiderLibrary, track: CiderTrack, at: number): CiderLibrary {
  if (state.history[0]?.track.videoId === track.videoId) return state;
  const entry: HistoryEntry = { track, playedAt: at };
  return { ...state, history: [entry, ...state.history].slice(0, HISTORY_LIMIT) };
}

export function isFavorite(state: CiderLibrary, videoId: string): boolean {
  return state.favorites.some((track) => track.videoId === videoId);
}

export function withFavoriteToggled(state: CiderLibrary, track: CiderTrack): CiderLibrary {    if (isFavorite(state, track.videoId)) {
    return { ...state, favorites: state.favorites.filter((item) => item.videoId !== track.videoId) };
  }
  return { ...state, favorites: [track, ...state.favorites].slice(0, FAVORITES_LIMIT) };
}

export function withNewPlaylist(
  state: CiderLibrary,
  name: string,
  at: number,
): { library: CiderLibrary; playlist: Playlist } {
  const playlist: Playlist = {
    id: `pl-${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim().slice(0, 80) || "Nova playlist",
    createdAt: at,
    updatedAt: at,
    tracks: [],
  };
  return {
    library: { ...state, playlists: [...state.playlists, playlist].slice(0, PLAYLISTS_LIMIT) },
    playlist,
  };
}

export function withRenamedPlaylist(state: CiderLibrary, id: string, name: string, at: number): CiderLibrary {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return state;
  return {
    ...state,
    playlists: state.playlists.map((playlist) =>
      playlist.id === id ? { ...playlist, name: trimmed, updatedAt: at } : playlist,
    ),
  };
}

export function withDeletedPlaylist(state: CiderLibrary, id: string): CiderLibrary {
  return { ...state, playlists: state.playlists.filter((playlist) => playlist.id !== id) };
}

/** Acrescenta faixas à playlist sem duplicar; devolve quantas entraram. */
export function withTracksAdded(
  state: CiderLibrary,
  id: string,
  tracks: CiderTrack[],
  at: number,
): { library: CiderLibrary; added: number } {
  let added = 0;
  const playlists = state.playlists.map((playlist) => {
    if (playlist.id !== id) return playlist;
    const known = new Set(playlist.tracks.map((track) => track.videoId));
    const fresh = tracks.filter((track) => {
      if (known.has(track.videoId)) return false;
      known.add(track.videoId);
      return true;
    });
    added = fresh.length;
    if (fresh.length === 0) return playlist;
    return {
      ...playlist,
      tracks: [...playlist.tracks, ...fresh].slice(0, PLAYLIST_TRACKS_LIMIT),
      updatedAt: at,
    };
  });
  return { library: { ...state, playlists }, added };
}

export function withTrackRemoved(
  state: CiderLibrary,
  id: string,
  videoId: string,
  at: number,
): CiderLibrary {
  return {
    ...state,
    playlists: state.playlists.map((playlist) =>
      playlist.id === id
        ? { ...playlist, tracks: playlist.tracks.filter((track) => track.videoId !== videoId), updatedAt: at }
        : playlist,
    ),
  };
}

/** Guarda uma busca recente (sem repetir, mais nova primeiro). */
export function withSearchRemembered(state: CiderLibrary, query: string, at: number): CiderLibrary {
  const trimmed = query.trim().slice(0, 160);
  if (!trimmed) return state;
  const searches = [
    { query: trimmed, at },
    ...state.searches.filter((entry) => entry.query.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, SEARCHES_LIMIT);
  return { ...state, searches };
}

export function withSearchesForgotten(state: CiderLibrary): CiderLibrary {
  return { ...state, searches: [] };
}

export function withClearedHistory(state: CiderLibrary): CiderLibrary {
  return { ...state, history: [] };
}

export function withHistoryEntryRemoved(
  state: CiderLibrary,
  videoId: string,
  playedAt: number,
): CiderLibrary {
  return {
    ...state,
    history: state.history.filter(
      (entry) => !(entry.track.videoId === videoId && entry.playedAt === playedAt),
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Agrupamentos da biblioteca                                         *
 * ------------------------------------------------------------------ */

/** Chave de álbum: o palpite de álbum do vídeo ou o canal que o publicou. */
export function albumKeyOf(track: CiderTrack): string {
  return (track.albumHint?.trim() || track.channelName || track.artist || "Sem álbum").trim();
}

export interface AlbumGroup {
  key: string;
  title: string;
  artworkUrl: string;
  tracks: CiderTrack[];
}

export function groupAlbums(tracks: CiderTrack[]): AlbumGroup[] {
  const groups = new Map<string, AlbumGroup>();
  for (const track of tracks) {
    const key = albumKeyOf(track);
    const group = groups.get(key);
    if (group) {
      group.tracks.push(track);
      continue;
    }
    groups.set(key, { key, title: key, artworkUrl: track.artworkUrl, tracks: [track] });
  }
  return Array.from(groups.values()).sort((a, b) => b.tracks.length - a.tracks.length);
}

export interface ArtistGroup {
  key: string;
  name: string;
  artworkUrl: string;
  tracks: CiderTrack[];
}

export function groupArtists(tracks: CiderTrack[]): ArtistGroup[] {
  const groups = new Map<string, ArtistGroup>();
  for (const track of tracks) {
    const name = (track.artist || track.channelName || "Artista desconhecido").trim();
    const key = name.toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.tracks.push(track);
      continue;
    }
    groups.set(key, { key, name, artworkUrl: track.artworkUrl, tracks: [track] });
  }
  return Array.from(groups.values()).sort((a, b) => b.tracks.length - a.tracks.length);
}

/** Faixas conhecidas (favoritos + histórico), sem repetir, para semear a rádio. */
export function knownTracks(library: CiderLibrary): CiderTrack[] {
  const seen = new Set<string>();
  const result: CiderTrack[] = [];
  for (const track of [...library.favorites, ...library.history.map((entry) => entry.track)]) {
    if (seen.has(track.videoId)) continue;
    seen.add(track.videoId);
    result.push(track);
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Store                                                              *
 * ------------------------------------------------------------------ */

function readStorage(): CiderLibrary {
  if (typeof localStorage === "undefined") return EMPTY_LIBRARY;
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? parseLibrary(JSON.parse(raw)) : EMPTY_LIBRARY;
  } catch {
    return EMPTY_LIBRARY;
  }
}

function writeStorage(library: CiderLibrary): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  } catch {
    // Cota cheia: a sessão continua funcionando, só não persiste.
  }
}

interface CiderLibraryState extends CiderLibrary {
  hydrated: boolean;
  patch: (next: CiderLibrary) => void;
  recordPlay: (track: CiderTrack, at?: number) => void;
  toggleFavorite: (track: CiderTrack) => void;
  addToPlaylist: (id: string, tracks: CiderTrack[]) => number;
  createPlaylist: (name: string) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  removeFromPlaylist: (id: string, videoId: string) => void;
  rememberSearch: (query: string) => void;
  forgetSearches: () => void;
  clearHistory: () => void;
  removeHistoryEntry: (videoId: string, playedAt: number) => void;
}

const initial = readStorage();

export const useCiderLibrary = create<CiderLibraryState>((set, get) => ({
  ...initial,
  hydrated: true,

  patch: (next) => {
    set({ ...next, hydrated: true });
    writeStorage(next);
  },

  recordPlay: (track, at = Date.now()) => {
    // Desligado nas configurações, nada é gravado — e a decisão é da interface,
    // que consulta a preferência antes de chamar.
    get().patch(pushHistory(currentLibrary(get()), track, at));
  },

  toggleFavorite: (track) => {
    get().patch(withFavoriteToggled(currentLibrary(get()), track));
  },

  addToPlaylist: (id, tracks) => {
    const { library, added } = withTracksAdded(currentLibrary(get()), id, tracks, Date.now());
    get().patch(library);
    return added;
  },

  createPlaylist: (name) => {
    const { library, playlist } = withNewPlaylist(currentLibrary(get()), name, Date.now());
    get().patch(library);
    return playlist;
  },

  renamePlaylist: (id, name) => {
    get().patch(withRenamedPlaylist(currentLibrary(get()), id, name, Date.now()));
  },

  deletePlaylist: (id) => {
    get().patch(withDeletedPlaylist(currentLibrary(get()), id));
  },

  removeFromPlaylist: (id, videoId) => {
    get().patch(withTrackRemoved(currentLibrary(get()), id, videoId, Date.now()));
  },

  rememberSearch: (query) => {
    get().patch(withSearchRemembered(currentLibrary(get()), query, Date.now()));
  },

  forgetSearches: () => {
    get().patch(withSearchesForgotten(currentLibrary(get())));
  },

  clearHistory: () => {
    get().patch(withClearedHistory(currentLibrary(get())));
  },

  removeHistoryEntry: (videoId, playedAt) => {
    get().patch(withHistoryEntryRemoved(currentLibrary(get()), videoId, playedAt));
  },
}));

function currentLibrary(state: CiderLibraryState): CiderLibrary {
  return {
    history: state.history,
    favorites: state.favorites,
    playlists: state.playlists,
    searches: state.searches,
  };
}

/** Acesso direto (fora de componentes) para registrar reprodução no motor. */
export function libraryState(): CiderLibrary {
  return currentLibrary(useCiderLibrary.getState());
}
