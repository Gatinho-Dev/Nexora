/**
 * Estilo do nome exibido: catálogo de fontes, efeitos e cores.
 *
 * Fica separado dos componentes para que o estúdio de perfil e o modal de
 * estilo compartilhem exatamente a mesma lista — é o que garante que a prévia
 * do modal e o cartão final mostrem o mesmo conjunto de opções.
 *
 * As fontes usam apenas as famílias já disponíveis no tema (`font-sans`,
 * `font-serif`, `font-mono`) combinadas com utilitários de peso, tracking e
 * estilo. Nenhuma fonte nova entra no bundle, e as prévias de "Gg" continuam
 * distintas umas das outras.
 */

export type NameFont = {
  id: string;
  label: string;
  /** Classes aplicadas tanto na prévia quanto no cartão final. */
  className: string;
  /** Amostra curta usada nos tiles de seleção. */
  sample: string;
};

export const NAME_FONTS = [
  { id: "sans", label: "Padrão", className: "font-sans", sample: "Gg" },
  {
    id: "rounded",
    label: "Amigável",
    className: "font-sans tracking-wide",
    sample: "Gg",
  },
  {
    id: "serif",
    label: "Editorial",
    className: "font-serif tracking-wide",
    sample: "Gg",
  },
  {
    id: "slab",
    label: "Bloco",
    className: "font-serif font-black tracking-tight",
    sample: "Gg",
  },
  {
    id: "display",
    label: "Impacto",
    className: "font-sans font-black uppercase tracking-widest",
    sample: "Gg",
  },
  {
    id: "mono",
    label: "Código",
    className: "font-mono tracking-tight",
    sample: "Gg",
  },
  {
    id: "pixel",
    label: "Pixel",
    className: "font-mono font-bold tracking-[-0.08em]",
    sample: "Gg",
  },
  {
    id: "wide",
    label: "Espaçada",
    className: "font-sans font-light tracking-[0.35em]",
    sample: "Gg",
  },
  {
    id: "condensed",
    label: "Compacta",
    className: "font-sans font-bold tracking-[-0.06em]",
    sample: "Gg",
  },
  {
    id: "stencil",
    label: "Estêncil",
    className: "font-sans font-semibold uppercase tracking-[0.2em]",
    sample: "Gg",
  },
  {
    id: "handwritten",
    label: "Assinatura",
    className: "font-serif italic tracking-wide",
    sample: "Gg",
  },
  {
    id: "script",
    label: "Script",
    className: "font-serif italic font-light tracking-wider",
    sample: "Gg",
  },
] as const satisfies readonly NameFont[];

export type NameEffect = {
  id: string;
  label: string;
  /** Efeito precisa da segunda cor para fazer sentido. */
  usesSecondColor: boolean;
};

export const NAME_EFFECTS = [
  { id: "solid", label: "Sólido", usesSecondColor: false },
  { id: "gradient", label: "Gradiente", usesSecondColor: true },
  { id: "neon", label: "Neon", usesSecondColor: true },
  { id: "sketch", label: "Desenho", usesSecondColor: false },
  { id: "outline", label: "Contorno", usesSecondColor: false },
  { id: "pop", label: "Pop", usesSecondColor: true },
  { id: "gummy", label: "Gummy", usesSecondColor: true },
  { id: "prism", label: "Prism", usesSecondColor: true },
] as const satisfies readonly NameEffect[];

/** Uniões derivadas do catálogo — é o que limita o estado e a validação do Zod. */
export type NameFontId = (typeof NAME_FONTS)[number]["id"];
export type NameEffectId = (typeof NAME_EFFECTS)[number]["id"];

/** Cores sólidas oferecidas na paleta, além do seletor de cor livre. */
export const NAME_COLOR_SWATCHES = [
  "#F4F7FB",
  "#FFFFFF",
  "#FEC8D8",
  "#F9A8D4",
  "#C4B5FD",
  "#8B93FF",
  "#7383FF",
  "#57F287",
  "#FEE75C",
  "#F59E0B",
  "#ED4245",
  "#94A3B8",
];

/** Gradientes prontos: dois pontos para preencher as duas cores. */
export const NAME_GRADIENT_PRESETS: { label: string; from: string; to: string }[] =
  [
    { label: "Nexora", from: "#F4F7FB", to: "#7383FF" },
    { label: "Pôr do sol", from: "#FDE68A", to: "#F472B6" },
    { label: "Oceano", from: "#67E8F9", to: "#3B82F6" },
    { label: "Cacto", from: "#86EFAC", to: "#15803D" },
    { label: "Uva", from: "#DDD6FE", to: "#7C3AED" },
    { label: "Fogo", from: "#FDBA74", to: "#DC2626" },
  ];

export const DEFAULT_NAME_STYLE = {
  font: "sans" as NameFontId,
  effect: "solid" as NameEffectId,
  colorA: "#F4F7FB",
  colorB: "#7383FF",
};

export type NameStyle = {
  font: NameFontId;
  effect: NameEffectId;
  colorA: string;
  colorB: string;
};

export function getNameFont(id: string | null | undefined): (typeof NAME_FONTS)[number] {
  return NAME_FONTS.find(font => font.id === id) ?? NAME_FONTS[0];
}

export function getNameEffect(
  id: string | null | undefined,
): (typeof NAME_EFFECTS)[number] {
  return NAME_EFFECTS.find(effect => effect.id === id) ?? NAME_EFFECTS[0];
}

/**
 * Normaliza um id vindo do banco para a união do catálogo. Um perfil salvo por
 * uma versão antiga — ou adulterado — cai no padrão em vez de reprovar na
 * validação do backend quando o usuário salvar de novo.
 */
export function normalizeNameFontId(value: unknown): NameFontId {
  return (NAME_FONTS.find(font => font.id === value)?.id ?? "sans") as NameFontId;
}

export function normalizeNameEffectId(value: unknown): NameEffectId {
  return (NAME_EFFECTS.find(effect => effect.id === value)?.id ??
    "solid") as NameEffectId;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Garante uma cor utilizável: valor desconhecido cai no branco do tema. */
export function normalizeNameColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value)
    ? value
    : fallback;
}

/** `#RRGGBB` → `r, g, b`, para ser usado dentro de `rgba()`. */
export function hexToRgbTriplet(hex: string): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map(char => char + char)
          .join("")
      : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return "244, 247, 251";
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

/** Sorteia um estilo plausível para o botão "Surpreenda-me". */
export function randomNameStyle(pickIndex?: (length: number) => number): NameStyle {
  const at = (length: number) =>
    pickIndex ? pickIndex(length) : Math.floor(Math.random() * length);
  return {
    font: NAME_FONTS[at(NAME_FONTS.length)].id,
    effect: NAME_EFFECTS[at(NAME_EFFECTS.length)].id,
    colorA: NAME_COLOR_SWATCHES[at(NAME_COLOR_SWATCHES.length)],
    colorB: NAME_COLOR_SWATCHES[at(NAME_COLOR_SWATCHES.length)],
  };
}
