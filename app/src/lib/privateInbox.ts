import type { ConversationDTO } from "@contracts/types";

export function organizePrivateInbox(conversations: ConversationDTO[]) {
  const directMessages = conversations.filter(
    conversation => !conversation.isRequest,
  );
  return {
    pinned: directMessages.filter(conversation => !!conversation.pinnedAt),
    recent: directMessages.filter(conversation => !conversation.pinnedAt),
    requests: conversations.filter(
      conversation => conversation.isRequest && !conversation.isSpam,
    ),
    spam: conversations.filter(conversation => conversation.isSpam),
  };
}

export function resolveConversationUnread(
  realtimeUnread: number | undefined,
  persistedUnread: number,
) {
  return realtimeUnread ?? persistedUnread;
}

export function isConversationMutedAt(
  conversation: Pick<
    ConversationDTO,
    "mutedForever" | "mutedUntil"
  >,
  timestamp: number,
) {
  return (
    conversation.mutedForever === true ||
    (!!conversation.mutedUntil &&
      new Date(conversation.mutedUntil).getTime() > timestamp)
  );
}

/** Instante que ordena uma conversa na lista: última mensagem, ou última atividade. */
export function conversationActivityAt(conversation: ConversationDTO): number {
  const candidate =
    conversation.lastMessage?.createdAt ??
    conversation.updatedAt ??
    conversation.pinnedAt;
  if (!candidate) return 0;
  const time = new Date(candidate).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Uma linha da lista de mensagens diretas. Os comunicados oficiais entram como
 * um item do mesmo tipo, para ordenar junto das conversas de verdade.
 */
export type PrivateInboxEntry =
  | { kind: "conversation"; conversation: ConversationDTO }
  | { kind: "official"; activityAt: number; unread: number; preview: string };

/** Estado dos comunicados oficiais usado para posicioná-los na lista. */
export type OfficialInboxState = {
  activityAt: number;
  unread: number;
  preview: string;
};

/**
 * Monta a lista de mensagens diretas na ordem em que o Discord apresenta.
 *
 * - Conversas fixadas vêm primeiro, como já era.
 * - Comunicados oficiais com aviso novo flutuam para o topo: um aviso de
 *   segurança não pode ficar preso no meio da lista.
 * - Sem aviso novo, a conversa oficial perde para qualquer DM em que você tenha
 *   conversado por último, então ela desce sozinha conforme você usa o produto.
 */
export function buildPrivateInboxEntries(
  conversations: ConversationDTO[],
  official: OfficialInboxState | null,
): { pinned: PrivateInboxEntry[]; recent: PrivateInboxEntry[] } {
  const { pinned, recent } = organizePrivateInbox(conversations);
  const pinnedEntries: PrivateInboxEntry[] = pinned.map(conversation => ({
    kind: "conversation",
    conversation,
  }));
  const recentEntries: PrivateInboxEntry[] = recent.map(conversation => ({
    kind: "conversation",
    conversation,
  }));

  if (official) {
    const entry: PrivateInboxEntry = { kind: "official", ...official };
    if (official.unread > 0) return { pinned: [entry, ...pinnedEntries], recent: recentEntries };
    recentEntries.push(entry);
  }

  const byActivity = (a: PrivateInboxEntry, b: PrivateInboxEntry) => {
    const left =
      a.kind === "official" ? a.activityAt : conversationActivityAt(a.conversation);
    const right =
      b.kind === "official" ? b.activityAt : conversationActivityAt(b.conversation);
    return right - left;
  };

  return { pinned: pinnedEntries, recent: recentEntries.sort(byActivity) };
}
