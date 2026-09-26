/**
 * Decorações de avatar: catálogo compartilhado pelo modal "Mudar decoração de
 * avatar", pelo estúdio de perfil e pelo renderizador do avatar.
 *
 * A lista mora aqui — e não dentro de um componente — para que a grade do
 * modal, a prévia grande e o avatar que aparece no perfil e na lista de
 * mensagens mostrem sempre exatamente o mesmo conjunto de decorações, na mesma
 * ordem e com os mesmos rótulos.
 *
 * Como o Nexora não tem planos pagos, a divisão é apenas editorial: as
 * decorações básicas ficam em "Suas decorações" e as de coleção em
 * "Exclusivo do Nexora". Nenhuma delas é bloqueada atrás de pagamento.
 */

export type AvatarDecorationSectionId = "owned" | "premium";

export type AvatarDecorationFrame =
  | "none"
  | "violet"
  | "amber"
  | "cyan"
  | "pink"
  | "emerald"
  | "gradient"
  | "dashed";

export type AvatarDecorationOrnament =
  | "none"
  | "sparkles"
  | "crown"
  | "orbit"
  | "ears"
  | "headset"
  | "bloom"
  | "pixels"
  | "leaves";

export type AvatarDecoration = {
  id: string;
  label: string;
  section: AvatarDecorationSectionId;
  frame: AvatarDecorationFrame;
  ornament: AvatarDecorationOrnament;
  /** Linha de apoio da prévia, no lugar da data de aquisição do Discord. */
  note: string;
};

export const AVATAR_DECORATION_SECTIONS = [
  { id: "owned", label: "Suas decorações" },
  { id: "premium", label: "Exclusivo do Nexora" },
] as const satisfies readonly {
  id: AvatarDecorationSectionId;
  label: string;
}[];

export const AVATAR_DECORATIONS = [
  {
    id: "none",
    label: "Nenhuma",
    section: "owned",
    frame: "none",
    ornament: "none",
    note: "Avatar sem nenhuma moldura",
  },
  {
    id: "sparkles",
    label: "Faíscas",
    section: "owned",
    frame: "violet",
    ornament: "sparkles",
    note: "Um brilho roxo no seu avatar",
  },
  {
    id: "crown",
    label: "Coroa",
    section: "owned",
    frame: "amber",
    ornament: "crown",
    note: "A coroa de sempre",
  },
  {
    id: "orbit",
    label: "Órbita",
    section: "owned",
    frame: "cyan",
    ornament: "orbit",
    note: "Um planeta girando ao redor",
  },
  {
    id: "rainbow",
    label: "Arco-íris",
    section: "premium",
    frame: "gradient",
    ornament: "none",
    note: "Um anel de cor em movimento",
  },
  {
    id: "catEars",
    label: "Orelhas de gato",
    section: "premium",
    frame: "none",
    ornament: "ears",
    note: "Miau! Orelhas e bigodes no avatar",
  },
  {
    id: "headphones",
    label: "Fones",
    section: "premium",
    frame: "none",
    ornament: "headset",
    note: "Tocando a sua Playlist Favorita",
  },
  {
    id: "bloom",
    label: "Flores",
    section: "premium",
    frame: "pink",
    ornament: "bloom",
    note: "Um jardim em volta do avatar",
  },
  {
    id: "pixels",
    label: "Pixel",
    section: "premium",
    frame: "dashed",
    ornament: "pixels",
    note: "Tudo em blocos, do jeito antigo",
  },
  {
    id: "leaves",
    label: "Folhas",
    section: "premium",
    frame: "emerald",
    ornament: "leaves",
    note: "Folhas esverdeadas no seu perfil",
  },
] as const satisfies readonly AvatarDecoration[];

export type AvatarDecorationId = (typeof AVATAR_DECORATIONS)[number]["id"];

export const DEFAULT_AVATAR_DECORATION: AvatarDecorationId = "none";

/** Classes da moldura por tipo — o quadro em gradiente é aplicado por estilo. */
export const AVATAR_DECORATION_FRAMES: Record<
  Exclude<AvatarDecorationFrame, "none" | "gradient">,
  string
> = {
  violet: "ring-2 ring-violet-300/90",
  amber: "ring-2 ring-amber-300/90",
  cyan: "ring-2 ring-cyan-300/90 ring-offset-4 ring-offset-transparent",
  pink: "ring-2 ring-pink-300/90",
  emerald: "ring-2 ring-emerald-300/90",
  dashed: "outline outline-2 outline-offset-2 outline-dashed outline-fuchsia-300/90",
};

/** Anel em gradiente: precisa de máscara radial, então vive no CSS inline. */
export const AVATAR_DECORATION_GRADIENT =
  "conic-gradient(from 200deg, #f472b6, #facc15, #38bdf8, #a78bfa, #f472b6)";

export const AVATAR_DECORATION_GRADIENT_MASK =
  "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))";

export function getAvatarDecoration(
  id: string | null | undefined,
): (typeof AVATAR_DECORATIONS)[number] {
  return AVATAR_DECORATIONS.find(decoration => decoration.id === id) ??
    AVATAR_DECORATIONS[0];
}

/** Decorações de uma seção, na ordem do catálogo. */
export function getAvatarDecorationsBySection(
  section: AvatarDecorationSectionId,
): readonly AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter(decoration => decoration.section === section);
}

/**
 * Normaliza um id vindo do banco para a união do catálogo. Um perfil salvo por
 * uma versão antiga — ou adulterado — cai em "Nenhuma" em vez de reprovar na
 * validação do backend quando o usuário salvar o perfil de novo.
 */
export function normalizeAvatarDecorationId(value: unknown): AvatarDecorationId {
  return (getAvatarDecoration(value as string).id ??
    DEFAULT_AVATAR_DECORATION) as AvatarDecorationId;
}
