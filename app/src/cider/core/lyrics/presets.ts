/**
 * Presets visuais de letras.
 *
 * Sete modos prontos (`elegant`, `karaoke`, `glow`, `minimal`, `cinema`,
 * `classic`, `custom`) + todos os controles manuais. Cada preset vira um conjunto
 * de **variáveis CSS** aplicadas no contêiner das letras, então a interface não
 * precisa de CSS duplicado nem de classes condicionais espalhadas.
 *
 * O visual é original do Cider 2: a referência de qualidade é o padrão de players
 * musicais premium, não a cópia de uma interface proprietária.
 */

export type LyricsPresetId =
  | "elegant"
  | "karaoke"
  | "glow"
  | "minimal"
  | "cinema"
  | "classic"
  | "custom";

export type LyricsAnimation = "off" | "low" | "medium" | "high";
export type LyricsLineTransition = "off" | "smooth" | "cinematic";
export type LyricsAlignment = "left" | "center" | "right";
export type LyricsBackground = "coverBlur" | "coverColors" | "solid";

export interface LyricsStyle {
  id: LyricsPresetId;
  name: string;
  description: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  visibleLines: number;
  alignment: LyricsAlignment;
  /** 0..1 — intensidade do brilho da palavra ativa. */
  wordGlow: number;
  animation: LyricsAnimation;
  lineTransition: LyricsLineTransition;
  /** Escala máxima da palavra ativa (1.00–1.04). */
  activeScale: number;
  /** Desfoque aplicado nas linhas distantes (px). */
  blurInactivePx: number;
  inactiveOpacity: number;
  shadowIntensity: number;
  background: LyricsBackground;
  /** Intensidade do fundo derivado da capa (0..1). */
  backgroundIntensity: number;
  /** Amplitude do movimento vertical das linhas que chegam (px). */
  slideDistance: number;
  /** Palavras anteriores ficam iluminadas por quanto tempo (ms). */
  glowDecayMs: number;
}

const BASE: LyricsStyle = {
  id: "custom",
  name: "Personalizado",
  description: "Todos os controles manuais, sem preset aplicado.",
  fontFamily: "'Inter', 'Cantarell', system-ui, sans-serif",
  fontSize: 34,
  fontWeight: 600,
  lineHeight: 1.35,
  letterSpacing: -0.2,
  visibleLines: 7,
  alignment: "left",
  wordGlow: 0.6,
  animation: "high",
  lineTransition: "smooth",
  activeScale: 1.03,
  blurInactivePx: 2,
  inactiveOpacity: 0.42,
  shadowIntensity: 0.35,
  background: "coverBlur",
  backgroundIntensity: 0.5,
  slideDistance: 18,
  glowDecayMs: 700,
};

export const LYRICS_PRESETS: Record<LyricsPresetId, LyricsStyle> = {
  elegant: {
    ...BASE,
    id: "elegant",
    name: "Elegante",
    description: "Minimalista e premium: hierarquia forte, movimento discreto.",
    fontSize: 38,
    fontWeight: 650,
    lineHeight: 1.4,
    visibleLines: 7,
    wordGlow: 0.55,
    lineTransition: "smooth",
    activeScale: 1.02,
    blurInactivePx: 2.5,
    inactiveOpacity: 0.38,
    backgroundIntensity: 0.55,
  },
  karaoke: {
    ...BASE,
    id: "karaoke",
    name: "Karaokê",
    description: "Palavra por palavra bem evidente, glow contínuo na ativa.",
    fontSize: 36,
    fontWeight: 700,
    wordGlow: 0.8,
    animation: "high",
    activeScale: 1.04,
    blurInactivePx: 0.5,
    inactiveOpacity: 0.5,
    glowDecayMs: 1200,
    backgroundIntensity: 0.4,
  },
  glow: {
    ...BASE,
    id: "glow",
    name: "Glow",
    description: "Brilho mais intenso, tipo neon, com halo largo.",
    fontSize: 36,
    fontWeight: 600,
    wordGlow: 1,
    shadowIntensity: 0.6,
    activeScale: 1.035,
    backgroundIntensity: 0.65,
    background: "coverColors",
  },
  minimal: {
    ...BASE,
    id: "minimal",
    name: "Minimal",
    description: "Quase sem animação: só o essencial, leve e rápido.",
    fontSize: 32,
    fontWeight: 500,
    visibleLines: 9,
    wordGlow: 0.18,
    animation: "low",
    lineTransition: "off",
    activeScale: 1,
    blurInactivePx: 0,
    inactiveOpacity: 0.5,
    slideDistance: 0,
    backgroundIntensity: 0.2,
  },
  cinema: {
    ...BASE,
    id: "cinema",
    name: "Cinema",
    description: "Fonte grande, fundo cinematográfico e transições longas.",
    fontSize: 52,
    fontWeight: 700,
    lineHeight: 1.3,
    visibleLines: 5,
    alignment: "center",
    wordGlow: 0.65,
    lineTransition: "cinematic",
    blurInactivePx: 4,
    inactiveOpacity: 0.3,
    slideDistance: 28,
    shadowIntensity: 0.5,
    background: "coverBlur",
    backgroundIntensity: 0.8,
  },
  classic: {
    ...BASE,
    id: "classic",
    name: "Clássico",
    description: "Texto tradicional, linha a linha, sem karaokê.",
    fontSize: 30,
    fontWeight: 500,
    lineHeight: 1.5,
    visibleLines: 12,
    wordGlow: 0.1,
    animation: "off",
    lineTransition: "off",
    activeScale: 1,
    blurInactivePx: 0,
    inactiveOpacity: 0.6,
    slideDistance: 0,
    shadowIntensity: 0.15,
    backgroundIntensity: 0.25,
  },
  custom: BASE,
};

export const PRESET_ORDER: LyricsPresetId[] = [
  "elegant",
  "karaoke",
  "glow",
  "minimal",
  "cinema",
  "classic",
  "custom",
];

/** Configurações de letras do documento (subconjunto usado aqui). */
export interface LyricsSettings {
  preset?: LyricsPresetId;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  visibleLines?: number;
  alignment?: LyricsAlignment;
  wordGlow?: LyricsAnimation | number;
  animation?: LyricsAnimation;
  lineTransition?: LyricsLineTransition;
  glowIntensity?: number;
  shadowIntensity?: number;
  backgroundIntensity?: number;
  inactiveOpacity?: number;
  activeColor?: string;
  color?: string;
}

const ANIMATION_SCALE: Record<LyricsAnimation, number> = {
  off: 0,
  low: 0.4,
  medium: 0.75,
  high: 1,
};

/**
 * Resolve o estilo final: preset escolhido + ajustes manuais do usuário.
 * `preset: custom` começa da base e aplica todos os valores salvos.
 */
export function resolveLyricsStyle(settings: LyricsSettings): LyricsStyle {
  const preset = LYRICS_PRESETS[settings.preset ?? "elegant"] ?? LYRICS_PRESETS.elegant;
  const style: LyricsStyle = { ...preset };

  const animations = settings.animation ?? preset.animation;
  style.animation = animations;
  const factor = ANIMATION_SCALE[animations];

  if (typeof settings.fontSize === "number") style.fontSize = settings.fontSize;
  if (settings.fontFamily && settings.fontFamily !== "system") style.fontFamily = settings.fontFamily;
  if (typeof settings.fontWeight === "number") style.fontWeight = settings.fontWeight;
  if (typeof settings.lineHeight === "number") style.lineHeight = settings.lineHeight;
  if (typeof settings.letterSpacing === "number") style.letterSpacing = settings.letterSpacing;
  if (typeof settings.visibleLines === "number") style.visibleLines = settings.visibleLines;
  if (settings.alignment) style.alignment = settings.alignment;
  if (settings.lineTransition) style.lineTransition = settings.lineTransition;

  if (typeof settings.wordGlow === "number") style.wordGlow = settings.wordGlow;
  else if (settings.wordGlow) style.wordGlow = ANIMATION_SCALE[settings.wordGlow] * 0.8;
  if (typeof settings.glowIntensity === "number") style.wordGlow = settings.glowIntensity;
  if (typeof settings.shadowIntensity === "number") style.shadowIntensity = settings.shadowIntensity;
  if (typeof settings.backgroundIntensity === "number") {
    style.backgroundIntensity = settings.backgroundIntensity;
  }
  if (typeof settings.inactiveOpacity === "number") style.inactiveOpacity = settings.inactiveOpacity;

  // Movimento e desfoque acompanham a intensidade das animações.
  style.activeScale = 1 + (style.activeScale - 1) * factor;
  style.blurInactivePx = style.blurInactivePx * factor;
  style.slideDistance = style.slideDistance * factor;
  if (animations === "off") {
    style.lineTransition = "off";
    style.wordGlow = Math.min(style.wordGlow, 0.25);
  }
  return style;
}

/** Força a redução de movimento (acessibilidade: `Reduce Motion`). */
export function reduceMotionStyle(style: LyricsStyle): LyricsStyle {
  return {
    ...style,
    animation: "off",
    lineTransition: "off",
    activeScale: 1,
    blurInactivePx: 0,
    slideDistance: 0,
    wordGlow: Math.min(style.wordGlow, 0.2),
  };
}

/** Variáveis CSS aplicadas no contêiner das letras. */
export function lyricsCssVariables(style: LyricsStyle): Record<string, string> {
  return {
    "--lyrics-size": `${style.fontSize}px`,
    "--lyrics-family": style.fontFamily,
    "--lyrics-weight": String(style.fontWeight),
    "--lyrics-line-height": String(style.lineHeight),
    "--lyrics-letter-spacing": `${style.letterSpacing}em`,
    "--lyrics-glow": String(Math.max(0, Math.min(1, style.wordGlow))),
    "--lyrics-scale": style.activeScale.toFixed(3),
    "--lyrics-blur": `${style.blurInactivePx.toFixed(1)}px`,
    "--lyrics-inactive-opacity": String(style.inactiveOpacity),
    "--lyrics-shadow": String(style.shadowIntensity),
    "--lyrics-bg-intensity": String(style.backgroundIntensity),
    "--lyrics-slide": `${style.slideDistance.toFixed(0)}px`,
    "--lyrics-decay": `${style.glowDecayMs}ms`,
    "--lyrics-align": style.alignment,
    "--lyrics-transition": style.lineTransition,
    "--lyrics-animation": style.animation,
  };
}
