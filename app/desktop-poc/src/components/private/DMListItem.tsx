import { useState } from "react";
import { useNavigate } from "react-router";
import { BellOff, MoreHorizontal, Phone, Pin, PinOff, Users, X } from "lucide-react";
import type { ConversationDTO } from "@contracts/types";
import { Avatar } from "@/components/Avatar";
import { GroupAvatar } from "@/components/groups/GroupAvatar";
import { groupDisplayName } from "@/lib/groupDisplayName";
import { cn } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { UnreadIndicator } from "./UnreadIndicator";
import { DMConversationMenu } from "./DMConversationMenu";
import {
  isConversationMutedAt,
  resolveConversationUnread,
} from "@/lib/privateInbox";

export function DMListItem({
  conversation,
  active,
  isFriend,
  onOpenProfile,
}: {
  conversation: ConversationDTO;
  active: boolean;
  isFriend: boolean;
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [renderedAt] = useState(() => Date.now());
  const realtimeUnread = useAppStore(
    state => state.unreadConversations[conversation.id],
  );
  const voiceCount = useAppStore(
    state => state.voiceParticipants[`dm:${conversation.id}`]?.length ?? 0,
  );
  const unread = resolveConversationUnread(
    realtimeUnread,
    conversation.unreadCount,
  );
  const isGroup = conversation.isGroup;
  const other = conversation.otherUser;
  const displayName = isGroup
    ? groupDisplayName(conversation)
    : (conversation.friendNickname ??
      other?.name ??
      other?.username ??
      "Conversa");
  const isMuted = isConversationMutedAt(conversation, renderedAt);

  const pin = trpc.dm.setPinned.useMutation({
    onSuccess: () => utils.dm.list.invalidate(),
    onError: error => toast.error(error.message),
  });
  const close = trpc.dm.close.useMutation({
    onSuccess: async () => {
      await utils.dm.list.invalidate();
      if (active) navigate("/channels/@me");
      toast.success("Conversa fechada. O histórico foi preservado.");
    },
    onError: error => toast.error(error.message),
  });

  const row = (
    <div
      className={cn(
        "group relative flex min-h-12 w-full items-center rounded-lg pr-1 text-left transition-colors duration-150 [contain-intrinsic-size:48px] [content-visibility:auto]",
        active
          ? "bg-act text-foreground"
          : unread > 0
            ? "bg-white/[0.035] text-foreground hover:bg-hov"
            : "text-muted2 hover:bg-hov hover:text-bodyx",
      )}
      data-unread={unread > 0 ? "true" : "false"}
      data-selected={active ? "true" : "false"}
    >
      <UnreadIndicator visible={unread > 0} className="self-stretch" />

      <button
        type="button"
        onClick={() => navigate(`/channels/@me/${conversation.id}`)}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1.5 pl-1 focus-visible:outline-none"
        aria-current={active ? "page" : undefined}
        aria-label={`${unread > 0 ? `${unread} não lida${unread === 1 ? "" : "s"}. ` : ""}Abrir ${displayName}`}
      >
        {isGroup ? (
          <GroupAvatar
            users={conversation.members}
            src={conversation.avatarUrl}
            name={displayName}
            size="sm"
          />
        ) : other ? (
          <Avatar
            userId={other.id}
            name={other.name ?? other.username}
            src={other.avatar}
            size="sm"
            showStatus
            statusOverride={other.status ?? "offline"}
          />
        ) : (
          <Avatar name="Conversa" size="sm" />
        )}

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 truncate text-[13px] leading-4",
              unread > 0 ? "font-bold text-foreground" : "font-semibold",
            )}
          >
            {isGroup && <Users className="h-3 w-3 shrink-0 text-faint" aria-hidden />}
            <span className="truncate" title={displayName}>{displayName}</span>
            {isMuted && <BellOff className="h-3 w-3 shrink-0 text-faint" aria-label="Silenciada" />}
          </span>
          <span
            className={cn(
              "mt-0.5 block truncate text-[11px] leading-3.5",
              unread > 0 ? "text-bodyx" : "text-faint",
            )}
          >
            {conversation.lastMessage
              ? conversation.lastMessage.content || "Anexo enviado"
              : isGroup
                ? `${conversation.memberCount ?? 0} participantes`
                : `@${other?.username ?? "usuário"}`}
          </span>
        </span>
      </button>

      <span className="ml-1 flex w-[76px] shrink-0 items-center justify-end gap-0.5">
        {voiceCount > 0 && (
          <span
            className="mr-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/15 px-1 text-emerald-400"
            title="Chamada em andamento"
            aria-label="Chamada em andamento"
          >
            <Phone className="h-3 w-3" />
          </span>
        )}
        {conversation.pinnedAt && (
          <Pin className="h-3.5 w-3.5 text-primary group-hover:hidden" aria-label="Conversa fixada" />
        )}
        {isGroup && unread > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--mention-badge)] px-1 text-[10px] font-bold text-white group-hover:hidden">
            {unread > 99 ? "99+" : unread}
          </span>
        )}

        <span className="hidden items-center gap-0.5 group-hover:flex group-focus-within:flex">
          <button
            type="button"
            onClick={() =>
              pin.mutate({
                conversationId: conversation.id,
                pinned: !conversation.pinnedAt,
              })
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted2 hover:bg-black/10 hover:text-foreground"
            aria-label={conversation.pinnedAt ? "Desafixar conversa" : "Fixar conversa"}
            title={conversation.pinnedAt ? "Desafixar" : "Fixar"}
          >
            {conversation.pinnedAt ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => close.mutate({ conversationId: conversation.id })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted2 hover:bg-black/10 hover:text-foreground"
            aria-label="Fechar mensagem direta"
            title="Fechar DM"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <DMConversationMenu
            conversation={conversation}
            mode="dropdown"
            onOpenProfile={onOpenProfile}
            isFriend={isFriend}
          >
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted2 hover:bg-black/10 hover:text-foreground"
              aria-label="Mais ações da conversa"
              title="Mais ações"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DMConversationMenu>
        </span>
      </span>
    </div>
  );

  return (
    <DMConversationMenu
      conversation={conversation}
      mode="context"
      onOpenProfile={onOpenProfile}
      isFriend={isFriend}
    >
      {row}
    </DMConversationMenu>
  );
}
