/** Preferências de notificação do servidor usadas para filtrar menções. */
export type MentionPreference = {
  userId: number;
  level: "all" | "mentions" | "none";
  mutedUntil: Date | string | null;
  suppressEveryone: boolean;
  suppressRoles: boolean;
};

/** Identifica menções exatas e cargos pelo ID, sem confundir prefixos. */
export function parseServerMentions(content: string) {
  const roleIds = new Set(
    [...content.matchAll(/@\[([^\]\n]+)\]\(role:(\d+)\)/g)]
      .map(match => Number(match[2]))
      .filter(Number.isSafeInteger),
  );
  // O nome visível de um cargo não é uma menção a um usuário.
  const withoutRoles = content.replace(/@\[([^\]\n]+)\]\(role:(\d+)\)/g, "");
  const names = [...withoutRoles.matchAll(/(?<![a-zA-Z0-9_.@-])@([a-zA-Z0-9_.-]+)/g)]
    .map(match => match[1].toLowerCase());
  return {
    roleIds,
    everyone: /(?<![a-zA-Z0-9_.@-])@everyone(?![a-zA-Z0-9_-]|\.[a-zA-Z0-9_-])/i.test(withoutRoles),
    here: /(?<![a-zA-Z0-9_.@-])@here(?![a-zA-Z0-9_-]|\.[a-zA-Z0-9_-])/i.test(withoutRoles),
    usernames: new Set(names.filter(name => name !== "everyone" && name !== "here")),
  };
}

/** Aplica supressão por tipo; menção direta não é suprimida por outras opções. */
export function filterMentionRecipients(input: {
  candidateIds: number[];
  directlyMentioned: ReadonlySet<number>;
  broadlyMentioned: ReadonlySet<number>;
  roleMentioned: ReadonlySet<number>;
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
    return input.directlyMentioned.has(userId) ||
      (input.broadlyMentioned.has(userId) && !preference?.suppressEveryone) ||
      (input.roleMentioned.has(userId) && !preference?.suppressRoles);
  });
}
