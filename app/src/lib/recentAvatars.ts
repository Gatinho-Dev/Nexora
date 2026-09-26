/**
 * Avatares Recentes: os últimos uploads de avatar do usuário neste navegador.
 *
 * O modal "Selecione uma imagem" lista esses uploads para o usuário trocar de
 * foto sem procurar o arquivo de novo. A lista é local (o upload já tem URL
 * própria no storage do servidor) e sobrevive a recarregar a página.
 */

const RECENT_KEY = "nexora-recent-avatars";

export const MAX_RECENT_AVATARS = 6;

type RecentStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): RecentStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/**
 * Lê a lista guardada, tolerando dado corrompido: JSON inválido, valores que
 * não são lista ou URLs vazias viram lista vazia em vez de quebrar o modal.
 */
export function loadRecentAvatars(
  storage: RecentStorage | null = browserStorage(),
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map(item => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Coloca `url` no topo da lista, sem repetir e limitada a
 * `MAX_RECENT_AVATARS` entradas. Devolve a lista resultante.
 */
export function rememberAvatar(
  url: string,
  storage: RecentStorage | null = browserStorage(),
  limit: number = MAX_RECENT_AVATARS,
): string[] {
  const trimmed = url.trim();
  if (!trimmed) return loadRecentAvatars(storage);
  const next = [trimmed, ...loadRecentAvatars(storage).filter(item => item !== trimmed)].slice(
    0,
    Math.max(1, limit),
  );
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Modo privado / cota estourada: a lista é apenas um conveniência.
  }
  return next;
}
