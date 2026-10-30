/**
 * Tokens editáveis no editor visual e presets de destaque.
 *
 * Portado de `src/customization/tokens.ts` do Cider 2 desktop. Ficam de fora os
 * grupos que só existiam por causa do núcleo nativo (equalizador de 10 bandas e
 * Adrenaline Audio Processor): no navegador o áudio passa pelo `iframe` do
 * YouTube e não há buffer para tratar.
 */

export type TokenKind = "color" | "number" | "slider" | "toggle" | "text" | "select";

export interface TokenDefinition {
  /** Nome da variável CSS (`--cider-*`). */
  variable: string;
  label: string;
  group: TokenGroup;
  kind: TokenKind;
  defaultValue: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export type TokenGroup =
  | "Cores da base"
  | "Destaques"
  | "Textos e bordas"
  | "Superfícies e vidro"
  | "Formas e sombras"
  | "Tipografia"
  | "Movimento";

export const TOKEN_GROUPS: TokenGroup[] = [
  "Cores da base",
  "Destaques",
  "Textos e bordas",
  "Superfícies e vidro",
  "Formas e sombras",
  "Tipografia",
  "Movimento",
];

export const DESIGN_TOKENS: TokenDefinition[] = [
  // --- Cores da base
  { variable: "--cider-bg", label: "Fundo principal", group: "Cores da base", kind: "color", defaultValue: "#0b0a12" },
  { variable: "--cider-bg-elevated", label: "Fundo elevado (barras e painéis)", group: "Cores da base", kind: "color", defaultValue: "#15131f" },
  { variable: "--cider-bg-sunken", label: "Fundo rebaixado", group: "Cores da base", kind: "color", defaultValue: "#06050b" },

  // --- Destaques
  { variable: "--cider-accent", label: "Destaque primário", group: "Destaques", kind: "color", defaultValue: "#ff5f6d" },
  { variable: "--cider-accent-secondary", label: "Destaque secundário", group: "Destaques", kind: "color", defaultValue: "#7b5cff" },
  { variable: "--cider-success", label: "Sucesso", group: "Destaques", kind: "color", defaultValue: "#22d3a6" },
  { variable: "--cider-warning", label: "Aviso", group: "Destaques", kind: "color", defaultValue: "#ffb547" },
  { variable: "--cider-danger", label: "Erro", group: "Destaques", kind: "color", defaultValue: "#ff6b6b" },

  // --- Textos e bordas
  { variable: "--cider-text", label: "Texto principal", group: "Textos e bordas", kind: "color", defaultValue: "#f4f4f7" },
  { variable: "--cider-text-muted", label: "Texto secundário", group: "Textos e bordas", kind: "color", defaultValue: "#9a9aa8" },
  { variable: "--cider-text-faint", label: "Texto discreto", group: "Textos e bordas", kind: "color", defaultValue: "#6b6b78" },
  { variable: "--cider-border", label: "Bordas", group: "Textos e bordas", kind: "text", defaultValue: "rgba(255,255,255,0.12)" },
  { variable: "--cider-border-strong", label: "Bordas em destaque", group: "Textos e bordas", kind: "text", defaultValue: "rgba(255,255,255,0.2)" },

  // --- Superfícies e vidro
  { variable: "--cider-surface", label: "Superfície", group: "Superfícies e vidro", kind: "text", defaultValue: "rgba(255,255,255,0.06)" },
  { variable: "--cider-surface-strong", label: "Superfície forte", group: "Superfícies e vidro", kind: "text", defaultValue: "rgba(255,255,255,0.1)" },
  { variable: "--cider-blur", label: "Desfoque do vidro", group: "Superfícies e vidro", kind: "slider", defaultValue: "28px", min: 0, max: 80, step: 1, unit: "px" },
  { variable: "--cider-glass-opacity", label: "Opacidade do vidro", group: "Superfícies e vidro", kind: "slider", defaultValue: "0.72", min: 0.4, max: 1, step: 0.01 },

  // --- Formas e sombras
  { variable: "--cider-radius-scale", label: "Escala de arredondamento", group: "Formas e sombras", kind: "slider", defaultValue: "1", min: 0, max: 2, step: 0.05 },
  { variable: "--cider-shadow-md", label: "Sombra média", group: "Formas e sombras", kind: "text", defaultValue: "0 6px 18px rgba(0,0,0,0.32)" },
  { variable: "--cider-shadow-lg", label: "Sombra grande", group: "Formas e sombras", kind: "text", defaultValue: "0 18px 48px rgba(0,0,0,0.42)" },
  { variable: "--cider-cover-size", label: "Tamanho da capa na barra", group: "Formas e sombras", kind: "slider", defaultValue: "56px", min: 40, max: 96, step: 2, unit: "px" },
  { variable: "--cider-sidebar-width", label: "Largura da barra lateral", group: "Formas e sombras", kind: "slider", defaultValue: "248px", min: 180, max: 380, step: 4, unit: "px" },
  { variable: "--cider-playbar-height", label: "Altura da barra de reprodução", group: "Formas e sombras", kind: "slider", defaultValue: "84px", min: 64, max: 120, step: 2, unit: "px" },

  // --- Tipografia
  { variable: "--cider-font-scale", label: "Escala da fonte", group: "Tipografia", kind: "slider", defaultValue: "1", min: 0.8, max: 1.4, step: 0.02 },
  { variable: "--cider-tracking-tight", label: "Espaçamento entre letras (títulos)", group: "Tipografia", kind: "slider", defaultValue: "-0.02em", min: -0.06, max: 0.06, step: 0.005, unit: "em" },

  // --- Movimento
  { variable: "--cider-duration-fast", label: "Duração (rápida)", group: "Movimento", kind: "slider", defaultValue: "140ms", min: 0, max: 400, step: 10, unit: "ms" },
  { variable: "--cider-duration-base", label: "Duração (padrão)", group: "Movimento", kind: "slider", defaultValue: "280ms", min: 0, max: 800, step: 10, unit: "ms" },
  { variable: "--cider-duration-slow", label: "Duração (longa)", group: "Movimento", kind: "slider", defaultValue: "480ms", min: 0, max: 1200, step: 10, unit: "ms" },
];

/** Stacks tipográficas oferecidas nas configurações. */
export const FONT_STACKS: Record<string, string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Ubuntu", sans-serif',
  rounded: '"SF Pro Rounded", "Nunito", "Quicksand", "Ubuntu", system-ui, sans-serif',
  humanist: '"Inter", "Cantarell", "Noto Sans", "DejaVu Sans", system-ui, sans-serif',
  serif: 'Georgia, "Noto Serif", "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", "Ubuntu Mono", monospace',
};

/** Cores rápidas sugeridas no editor (paleta da identidade). */
export const ACCENT_PRESETS: Array<{ name: string; accent: string; secondary: string }> = [
  { name: "Cidra", accent: "#ff5f6d", secondary: "#7b5cff" },
  { name: "Âmbar", accent: "#ffb547", secondary: "#ff7a45" },
  { name: "Menta", accent: "#22d3a6", secondary: "#3ba7ff" },
  { name: "Oceano", accent: "#3ba7ff", secondary: "#7b5cff" },
  { name: "Orquídea", accent: "#c05cff", secondary: "#ff5fa2" },
  { name: "Grafite", accent: "#9aa0b4", secondary: "#5f6b8a" },
  { name: "Rubi", accent: "#e0414f", secondary: "#8b1e3f" },
  { name: "Limão", accent: "#c8e64a", secondary: "#3fc08a" },
];

/** Valores padrão de todos os tokens, para restaurar o desenho de fábrica. */
export function defaultTokenValues(): Record<string, string> {
  return Object.fromEntries(DESIGN_TOKENS.map((token) => [token.variable, token.defaultValue]));
}

/** Lê um número de um valor de token (`"28px"` → `28`). */
export function numericToken(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
