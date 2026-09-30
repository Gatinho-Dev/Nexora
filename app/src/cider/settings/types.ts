/**
 * Preferências do Cider web.
 *
 * Espelha o documento de configurações do Cider 2 desktop no que a versão web
 * consegue honrar: aparência (tema, cores, vidro, escalas), ordem/visibilidade
 * da casca, preferências de busca e privacidade local. O que dependia do núcleo
 * nativo — equalizador, arquivos locais, atalhos globais, bandeja — não existe
 * aqui e por isso **não** aparece no esquema: uma opção que não faz nada é pior
 * do que uma opção ausente.
 *
 * A persistência é local (`localStorage`), separada das preferências da
 * Nexora: o Cider é um aplicativo dentro do site, e misturar as duas chaves
 * faria um tema do Cider mexer na Nexora.
 */

import { parseThemeList, type AppearanceTheme } from "./themes";

/** Chave do `localStorage` — própria, para não colidir com a da Nexora. */
export const CIDER_SETTINGS_KEY = "nexora-cider-settings";

export type CiderDensity = "comfortable" | "compact" | "spacious";
export type CiderAnimations = "full" | "reduced" | "off";
export type CiderPerformance = "balanced" | "economy";
export type CiderSidebarPosition = "left" | "right";
export type CiderPlaybarPosition = "bottom" | "floating";
export type CiderProgressStyle = "bar" | "thin" | "wave";

export interface CiderSettings {
  // ── Aparência ────────────────────────────────────────────────
  /** `auto` | `dark` | `light` | id de tema (embutido ou do usuário). */
  theme: string;
  accent: string;
  accentSecondary: string;
  glass: boolean;
  glassBlur: number;
  transparency: number;
  shadowIntensity: number;
  borderOpacity: number;
  radiusScale: number;
  spacingScale: number;
  fontScale: number;
  /** `system` | `humanist` | `rounded` | `serif` | `mono` ou uma família livre. */
  fontFamily: string;
  density: CiderDensity;
  animations: CiderAnimations;
  animationSpeed: number;
  performance: CiderPerformance;
  reduceMotion: boolean;
  /** O destaque acompanha a paleta da capa que está tocando. */
  themeFollowCover: boolean;
  /** Brilho da capa ao fundo da casca. */
  coverAmbient: boolean;

  // ── Casca ────────────────────────────────────────────────────
  sidebarVisible: boolean;
  sidebarCollapsed: boolean;
  sidebarPosition: CiderSidebarPosition;
  sidebarShowLabels: boolean;
  sidebarResizable: boolean;
  sidebarWidth: number;
  sidebarOrder: string[];
  sidebarHidden: string[];
  playbarPosition: CiderPlaybarPosition;
  playbarOrder: string[];
  /** Itens da playbar escondidos (`lyrics`, `queue`, `volume`, `favorite`…). */
  playbarHidden: string[];
  progressStyle: CiderProgressStyle;
  showTimecodes: boolean;
  coverSize: number;

  // ── Tocando agora ────────────────────────────────────────────
  nowPlayingLyrics: boolean;
  nowPlayingVisualizer: boolean;

  // ── Busca ────────────────────────────────────────────────────
  preferOfficialAudio: boolean;
  hideAlternativeVersions: boolean;
  maxPerChannel: number;
  searchLimit: number;

  // ── Privacidade e histórico ──────────────────────────────────
  /** Desligado, nada é gravado no histórico local. */
  historyEnabled: boolean;

  // ── Guia de primeira vez ─────────────────────────────────────
  onboardingSeen: boolean;

  // ── Temas do usuário ─────────────────────────────────────────
  customThemes: AppearanceTheme[];
}

export const DEFAULT_CIDER_SETTINGS: CiderSettings = {
  theme: "cider2-dark",
  accent: "#ff5f6d",
  accentSecondary: "#7b5cff",
  glass: true,
  glassBlur: 28,
  transparency: 0.72,
  shadowIntensity: 1,
  borderOpacity: 0.12,
  radiusScale: 1,
  spacingScale: 1,
  fontScale: 1,
  fontFamily: "system",
  density: "comfortable",
  animations: "full",
  animationSpeed: 1,
  performance: "balanced",
  reduceMotion: false,
  themeFollowCover: false,
  coverAmbient: false,

  sidebarVisible: true,
  sidebarCollapsed: false,
  sidebarPosition: "left",
  sidebarShowLabels: true,
  sidebarResizable: true,
  sidebarWidth: 248,
  sidebarOrder: [],
  sidebarHidden: [],
  playbarPosition: "bottom",
  playbarOrder: [],
  playbarHidden: [],
  progressStyle: "bar",
  showTimecodes: true,
  coverSize: 56,

  nowPlayingLyrics: true,
  nowPlayingVisualizer: false,

  preferOfficialAudio: true,
  hideAlternativeVersions: false,
  maxPerChannel: 4,
  searchLimit: 25,

  historyEnabled: true,

  onboardingSeen: false,

  customThemes: [],
};

/* ------------------------------------------------------------------ *
 * Parser tolerante                                                   *
 * ------------------------------------------------------------------ */

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

export const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const text = (value: unknown, fallback: string, maxLength = 120): string =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const color = (value: unknown, fallback: string): string =>
  typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : fallback;

/** Lista de ids da casca (ordem/visibilidade), sem duplicatas e com teto. */
const idList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim().slice(0, 40));
  return Array.from(new Set(cleaned)).slice(0, 64);
};

/**
 * Lê um objeto vindo do `localStorage` (ou de um arquivo importado) e devolve
 * um documento completo. Campo inválido cai no padrão em vez de derrubar a
 * página — a configuração é conveniência, não pré-requisito.
 */
export function parseCiderSettings(raw: unknown): CiderSettings {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  return {
    theme: text(source.theme, DEFAULT_CIDER_SETTINGS.theme, 80),
    accent: color(source.accent, DEFAULT_CIDER_SETTINGS.accent),
    accentSecondary: color(source.accentSecondary, DEFAULT_CIDER_SETTINGS.accentSecondary),
    glass: bool(source.glass, DEFAULT_CIDER_SETTINGS.glass),
    glassBlur: clamp(source.glassBlur, 0, 80, DEFAULT_CIDER_SETTINGS.glassBlur),
    transparency: clamp(source.transparency, 0.4, 1, DEFAULT_CIDER_SETTINGS.transparency),
    shadowIntensity: clamp(source.shadowIntensity, 0, 2, DEFAULT_CIDER_SETTINGS.shadowIntensity),
    borderOpacity: clamp(source.borderOpacity, 0, 0.6, DEFAULT_CIDER_SETTINGS.borderOpacity),
    radiusScale: clamp(source.radiusScale, 0, 2, DEFAULT_CIDER_SETTINGS.radiusScale),
    spacingScale: clamp(source.spacingScale, 0.6, 2, DEFAULT_CIDER_SETTINGS.spacingScale),
    fontScale: clamp(source.fontScale, 0.8, 1.4, DEFAULT_CIDER_SETTINGS.fontScale),
    fontFamily: text(source.fontFamily, DEFAULT_CIDER_SETTINGS.fontFamily, 180),
    density: oneOf(source.density, ["comfortable", "compact", "spacious"] as const, DEFAULT_CIDER_SETTINGS.density),
    animations: oneOf(source.animations, ["full", "reduced", "off"] as const, DEFAULT_CIDER_SETTINGS.animations),
    animationSpeed: clamp(source.animationSpeed, 0.25, 3, DEFAULT_CIDER_SETTINGS.animationSpeed),
    performance: oneOf(source.performance, ["balanced", "economy"] as const, DEFAULT_CIDER_SETTINGS.performance),
    reduceMotion: bool(source.reduceMotion, DEFAULT_CIDER_SETTINGS.reduceMotion),
    themeFollowCover: bool(source.themeFollowCover, DEFAULT_CIDER_SETTINGS.themeFollowCover),
    coverAmbient: bool(source.coverAmbient, DEFAULT_CIDER_SETTINGS.coverAmbient),

    sidebarVisible: bool(source.sidebarVisible, DEFAULT_CIDER_SETTINGS.sidebarVisible),
    sidebarCollapsed: bool(source.sidebarCollapsed, DEFAULT_CIDER_SETTINGS.sidebarCollapsed),
    sidebarPosition: oneOf(source.sidebarPosition, ["left", "right"] as const, DEFAULT_CIDER_SETTINGS.sidebarPosition),
    sidebarShowLabels: bool(source.sidebarShowLabels, DEFAULT_CIDER_SETTINGS.sidebarShowLabels),
    sidebarResizable: bool(source.sidebarResizable, DEFAULT_CIDER_SETTINGS.sidebarResizable),
    sidebarWidth: clamp(source.sidebarWidth, 180, 380, DEFAULT_CIDER_SETTINGS.sidebarWidth),
    sidebarOrder: idList(source.sidebarOrder),
    sidebarHidden: idList(source.sidebarHidden),
    playbarPosition: oneOf(source.playbarPosition, ["bottom", "floating"] as const, DEFAULT_CIDER_SETTINGS.playbarPosition),
    playbarOrder: idList(source.playbarOrder),
    playbarHidden: idList(source.playbarHidden),
    progressStyle: oneOf(source.progressStyle, ["bar", "thin", "wave"] as const, DEFAULT_CIDER_SETTINGS.progressStyle),
    showTimecodes: bool(source.showTimecodes, DEFAULT_CIDER_SETTINGS.showTimecodes),
    coverSize: clamp(source.coverSize, 40, 96, DEFAULT_CIDER_SETTINGS.coverSize),

    nowPlayingLyrics: bool(source.nowPlayingLyrics, DEFAULT_CIDER_SETTINGS.nowPlayingLyrics),
    nowPlayingVisualizer: bool(source.nowPlayingVisualizer, DEFAULT_CIDER_SETTINGS.nowPlayingVisualizer),

    preferOfficialAudio: bool(source.preferOfficialAudio, DEFAULT_CIDER_SETTINGS.preferOfficialAudio),
    hideAlternativeVersions: bool(source.hideAlternativeVersions, DEFAULT_CIDER_SETTINGS.hideAlternativeVersions),
    maxPerChannel: clamp(source.maxPerChannel, 0, 20, DEFAULT_CIDER_SETTINGS.maxPerChannel),
    searchLimit: clamp(source.searchLimit, 5, 50, DEFAULT_CIDER_SETTINGS.searchLimit),

    historyEnabled: bool(source.historyEnabled, DEFAULT_CIDER_SETTINGS.historyEnabled),

    onboardingSeen: bool(source.onboardingSeen, DEFAULT_CIDER_SETTINGS.onboardingSeen),

    // A lista passa pela validação de temas (e não pelo parser genérico): um
    // tema corrompido é descartado em vez de derrubar as configurações.
    customThemes: parseThemeList(source.customThemes),
  };
}

/** Preferências de busca no formato que `searchTracks` entende. */
export function searchPreferencesOf(settings: CiderSettings) {
  return {
    preferOfficialAudio: settings.preferOfficialAudio,
    hideAlternativeVersions: settings.hideAlternativeVersions,
    maxPerChannel: Math.round(settings.maxPerChannel),
    limit: Math.round(settings.searchLimit),
  };
}
