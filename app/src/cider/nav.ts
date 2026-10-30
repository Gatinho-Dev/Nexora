/**
 * Catálogo de destinos da navegação do Cider web.
 *
 * Mesma lista de conceitos do desktop (`src/lib/nav.ts`), com a diferença que
 * os destinos que dependiam do núcleo nativo ficaram de fora: "Arquivos locais"
 * não existe no navegador, e um item de menu que não leva a lugar nenhum é
 * mentira. Os demais mantêm rótulo, agrupamento e ordem do aplicativo.
 */

import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  Compass,
  Disc3,
  Heart,
  Home,
  Library,
  ListMusic,
  Music,
  Radio,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

/** Raiz de todas as telas do Cider dentro da Nexora. */
export const CIDER_BASE = "/cider";

export type CiderNavId =
  | "home"
  | "browse"
  | "search"
  | "radio"
  | "library"
  | "albums"
  | "artists"
  | "songs"
  | "playlists"
  | "history"
  | "favorites"
  | "nowPlaying"
  | "settings"
  | "diagnostics"
  | "stats";

export type NavGroup = "Descobrir" | "Biblioteca" | "Sistema";

export interface CiderNavItem {
  id: CiderNavId;
  label: string;
  /** Caminho absoluto dentro da Nexora. */
  path: string;
  /** Rótulo do `aria-current` quando o caminho é exato. */
  icon: ComponentType<{ size?: number | string }>;
  group: NavGroup;
}

export const CIDER_NAV_ITEMS: CiderNavItem[] = [
  { id: "home", label: "Início", path: CIDER_BASE, icon: Home, group: "Descobrir" },
  { id: "browse", label: "Explorar", path: `${CIDER_BASE}/explorar`, icon: Compass, group: "Descobrir" },
  { id: "search", label: "Pesquisa", path: `${CIDER_BASE}/pesquisa`, icon: Search, group: "Descobrir" },
  { id: "radio", label: "Rádio", path: `${CIDER_BASE}/radio`, icon: Sparkles, group: "Descobrir" },

  { id: "library", label: "Biblioteca", path: `${CIDER_BASE}/biblioteca`, icon: Library, group: "Biblioteca" },
  { id: "albums", label: "Álbuns", path: `${CIDER_BASE}/albuns`, icon: Disc3, group: "Biblioteca" },
  { id: "artists", label: "Artistas", path: `${CIDER_BASE}/artistas`, icon: UserRound, group: "Biblioteca" },
  { id: "songs", label: "Músicas", path: `${CIDER_BASE}/musicas`, icon: Music, group: "Biblioteca" },
  { id: "playlists", label: "Playlists", path: `${CIDER_BASE}/playlists`, icon: ListMusic, group: "Biblioteca" },
  { id: "history", label: "Histórico", path: `${CIDER_BASE}/historico`, icon: Clock, group: "Biblioteca" },
  { id: "favorites", label: "Favoritos", path: `${CIDER_BASE}/favoritos`, icon: Heart, group: "Biblioteca" },
  { id: "nowPlaying", label: "Tocando agora", path: `${CIDER_BASE}/tocando-agora`, icon: Radio, group: "Biblioteca" },

  { id: "settings", label: "Configurações", path: `${CIDER_BASE}/configuracoes`, icon: Settings, group: "Sistema" },
  { id: "diagnostics", label: "Diagnóstico", path: `${CIDER_BASE}/diagnostico`, icon: Activity, group: "Sistema" },
  { id: "stats", label: "Estatísticas", path: `${CIDER_BASE}/estatisticas`, icon: BarChart3, group: "Sistema" },
];

export const CIDER_NAV_GROUPS: NavGroup[] = ["Descobrir", "Biblioteca", "Sistema"];

export function navItem(id: string): CiderNavItem | undefined {
  return CIDER_NAV_ITEMS.find((item) => item.id === id);
}

/** Item ativo para um caminho (o mais específico vence). */
export function navItemForPath(pathname: string): CiderNavItem | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const matches = CIDER_NAV_ITEMS.filter((item) => {
    const base = item.path.replace(/\/+$/, "") || "/";
    return normalized === base || normalized.startsWith(`${base}/`);
  });
  return matches.sort((a, b) => b.path.length - a.path.length)[0];
}

/** Título exibido na topbar. */
export function routeTitle(pathname: string): string {
  const item = navItemForPath(pathname);
  if (item) return item.label;
  return "Cider 2";
}

/** Ordem/visibilidade configuradas, aplicadas sobre o catálogo. */
export function orderedNavItems(order: string[], hidden: string[]): CiderNavItem[] {
  const ids = order.length > 0 ? order : CIDER_NAV_ITEMS.map((item) => item.id);
  return ids
    .filter((id) => !hidden.includes(id))
    .map((id) => navItem(id))
    .filter((item): item is CiderNavItem => Boolean(item));
}
