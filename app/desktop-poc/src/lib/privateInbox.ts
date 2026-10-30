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
