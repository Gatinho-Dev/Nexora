/**
 * Nome de exibição do grupo na lista (fallback gerado no cliente,
 * espelhando buildFallbackGroupName do backend — item 3/37).
 */
export function groupDisplayName(
  conv: {
    isGroup?: boolean;
    name?: string | null;
    members?: Array<{ id: number; name: string | null; username: string | null }>;
  },
): string {
  if (!conv.isGroup) return "";
  if (conv.name?.trim()) return conv.name.trim();
  const names = (conv.members ?? [])
    .slice(0, 5)
    .map(m => m.name ?? m.username ?? "Usuário");
  if (names.length === 0) return "Grupo";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} e ${names[2]}`;
  return `${names[0]}, ${names[1]}, ${names[2]} e +${names.length - 3}`;
}
