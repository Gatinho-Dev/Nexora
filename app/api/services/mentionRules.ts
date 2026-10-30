/** Preferências de notificação do servidor usadas para filtrar menções. */
export type MentionPreference = {
  userId: number;
  level: "all" | "mentions" | "none";
  mutedUntil: Date | string | null;
  suppressEveryone: boolean;
};

/**
 * Decide quem recebe a notificação de menção, sem acesso a banco.
 * - `level: none` e silenciamento temporário bloqueiam tudo.
 * - `suppressEveryone` bloqueia só `@everyone`; menção direta sempre notifica.
 */
export function filterMentionRecipients(input: {
  candidateIds: number[];
  directlyMentioned: ReadonlySet<number>;
  preferences: ReadonlyMap<number, MentionPreference>;
  now: number;
}): number[] {
  return input.candidateIds.filter(userId => {
    const preference = input.preferences.get(userId);
    if (preference?.level === "none") return false;
    if (
      preference?.mutedUntil &&
      new Date(preference.mutedUntil).getTime() > input.now
    ) {
      return false;
    }
    if (!input.directlyMentioned.has(userId) && preference?.suppressEveryone) {
      return false;
    }
    return true;
  });
}
