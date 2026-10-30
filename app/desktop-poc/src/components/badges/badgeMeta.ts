export const RARITY_COLORS: Record<string, string> = {
  COMMON: "#B5BAC1",
  UNCOMMON: "#3BA55C",
  RARE: "#5865F2",
  EPIC: "#9B59B6",
  LEGENDARY: "#F0B232",
  EXCLUSIVE: "#ED4245",
};

export const RARITY_LABELS: Record<string, string> = {
  COMMON: "Comum",
  UNCOMMON: "Incomum",
  RARE: "Rara",
  EPIC: "Épica",
  LEGENDARY: "Lendária",
  EXCLUSIVE: "Exclusiva",
};

export function badgeIconUrl(icon: string): string {
  return `/badges/${icon}.svg`;
}
