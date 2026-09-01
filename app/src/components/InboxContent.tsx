import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  AtSign,
  BellRing,
  Check,
  CheckCheck,
  Inbox,
  MessageSquare,
  Reply,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { NotificationDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { notificationCopy } from "@/lib/notificationDisplay";

type InboxTab = "unread" | "mentions";

function NotificationTypeIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  if (type === "mention") return <AtSign className={className} />;
  if (type === "reply") return <Reply className={className} />;
  if (type === "friend_request") return <UserPlus className={className} />;
  if (type === "dm") return <MessageSquare className={className} />;
  return <BellRing className={className} />;
}

function notificationTime(value: string | Date) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InboxContent({
  onClose,
  onOpenProfile,
  compact = false,
}: {
  onClose: () => void;
  onOpenProfile?: (userId: number) => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<InboxTab>("unread");
  const list = trpc.notification.list.useQuery();
  const friends = trpc.friend.list.useQuery();
  const clearUnreadConversation = useAppStore(
    state => state.clearUnreadConversation,
  );

  const incomingRequests = useMemo(
    () =>
      (friends.data ?? []).filter(
        friend =>
          friend.status === "PENDING" && friend.direction === "incoming",
      ),
    [friends.data],
  );
  const items = useMemo(() => {
    const notifications = list.data ?? [];
    return tab === "mentions"
      ? notifications.filter(notification => notification.type === "mention")
      : notifications.filter(
          notification =>
            !notification.isRead &&
            !(
              notification.type === "friend_request" &&
              incomingRequests.some(
                request => request.user.id === notification.actor?.id,
              )
            ),
        );
  }, [incomingRequests, list.data, tab]);

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.notification.list.invalidate(),
        utils.notification.unreadCount.invalidate(),
      ]);
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.notification.list.invalidate(),
        utils.notification.unreadCount.invalidate(),
      ]);
    },
  });
  const refreshFriends = async () => {
    await Promise.all([
      utils.friend.list.invalidate(),
      utils.notification.list.invalidate(),
      utils.notification.unreadCount.invalidate(),
    ]);
  };
  const accept = trpc.friend.accept.useMutation({
    onSuccess: () => void refreshFriends(),
    onError: error => toast.error(error.message),
  });
  const decline = trpc.friend.decline.useMutation({
    onSuccess: () => void refreshFriends(),
    onError: error => toast.error(error.message),
  });

  const markActorRequestRead = (userId: number) => {
    const notification = list.data?.find(
      item =>
        item.type === "friend_request" &&
        item.actor?.id === userId &&
        !item.isRead,
    );
    if (notification) markRead.mutate({ id: notification.id });
  };

  const openNotification = (notification: NotificationDTO) => {
    if (!notification.isRead) markRead.mutate({ id: notification.id });
    if (notification.conversationId) {
      clearUnreadConversation(notification.conversationId);
      navigate(`/channels/@me/${notification.conversationId}`);
      onClose();
      return;
    }
    if (notification.serverId && notification.channelId) {
      navigate(
        `/channels/${notification.serverId}/${notification.channelId}${notification.messageId ? `?message=${notification.messageId}` : ""}`,
      );
      onClose();
      return;
    }
    if (notification.type === "friend_request") {
      navigate("/channels/@me/friends");
      onClose();
    }
  };

  return (
    <section
      aria-label="Caixa de entrada"
      className="flex min-h-0 flex-1 flex-col bg-panel text-foreground"
    >
      <header
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-border px-4 py-3",
          compact && "pr-14",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Inbox className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold">Caixa de entrada</h2>
          <p className="truncate text-[11px] text-muted2">
            Mensagens, menções e pedidos em um só lugar
          </p>
        </div>
        {(list.data?.some(notification => !notification.isRead) ?? false) && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-hov px-2.5 text-[11px] font-semibold text-bodyx transition-colors hover:bg-act disabled:opacity-50"
            title="Marcar todas como lidas"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span className={cn(compact && "sr-only")}>Marcar como lidas</span>
          </button>
        )}
      </header>

      {incomingRequests.length > 0 && (
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold text-bodyx">
              <UserPlus className="h-3.5 w-3.5 text-primary" /> Pedidos de
              amizade
            </p>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
              {incomingRequests.length}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {incomingRequests.map(request => (
              <div
                key={request.friendshipId}
                className="flex min-w-[230px] items-center gap-2.5 rounded-xl border border-border bg-chat/55 p-2.5"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(request.user.id)}
                  className="rounded-full"
                  aria-label={`Ver perfil de ${request.user.name ?? request.user.username ?? "usuário"}`}
                >
                  <Avatar
                    userId={request.user.id}
                    name={request.user.name ?? request.user.username}
                    src={request.user.avatar}
                    size="sm"
                    showStatus
                    statusOverride={request.user.status}
                  />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {request.user.name ?? request.user.username}
                  </span>
                  <span className="block truncate text-[10px] text-muted2">
                    @{request.user.username}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    markActorRequestRead(request.user.id);
                    accept.mutate({ friendshipId: request.friendshipId });
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white hover:bg-primary/90"
                  aria-label="Aceitar pedido"
                  title="Aceitar"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markActorRequestRead(request.user.id);
                    decline.mutate({ friendshipId: request.friendshipId });
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-hov text-muted2 hover:bg-destructive/15 hover:text-destructive"
                  aria-label="Recusar pedido"
                  title="Recusar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-2 border-b border-border px-3">
        {(
          [
            ["unread", "Não lidas"],
            ["mentions", "Menções"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative h-11 text-xs font-semibold text-muted2 transition-colors hover:text-foreground",
              tab === id && "text-primary",
            )}
          >
            {label}
            {tab === id && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {list.isLoading ? (
          <div className="space-y-2 p-2" aria-label="Carregando Caixa de entrada">
            {[1, 2, 3].map(item => (
              <div
                key={item}
                className="h-20 animate-pulse rounded-xl bg-white/[0.05]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              {tab === "mentions" ? (
                <AtSign className="h-5 w-5" />
              ) : (
                <Inbox className="h-5 w-5" />
              )}
            </span>
            <p className="text-sm font-bold text-bodyx">
              {tab === "mentions" ? "Nenhuma menção" : "Tudo em dia"}
            </p>
            <p className="max-w-72 text-xs leading-5 text-muted2">
              {tab === "mentions"
                ? "Quando alguém mencionar você, a mensagem aparecerá aqui."
                : "Você não tem mensagens ou atividades não lidas."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map(notification => {
              const copy = notificationCopy(notification);
              return (
                <li
                  key={notification.id}
                  className="group rounded-xl border border-border bg-chat/55 p-3 transition-colors hover:bg-hov/70"
                >
                  <div className="flex items-start gap-3">
                    {notification.actor ? (
                      <button
                        type="button"
                        onClick={() => onOpenProfile?.(notification.actor!.id)}
                        className="rounded-full"
                        aria-label={`Ver perfil de ${notification.actor.name ?? notification.actor.username ?? "usuário"}`}
                      >
                        <Avatar
                          userId={notification.actor.id}
                          name={
                            notification.actor.name ??
                            notification.actor.username
                          }
                          src={notification.actor.avatar}
                          size="sm"
                          showStatus={false}
                        />
                      </button>
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                        <NotificationTypeIcon type={notification.type} />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-foreground">
                          {copy.title}
                        </span>
                        <span className="shrink-0 text-primary">
                          <NotificationTypeIcon type={notification.type} />
                        </span>
                      </span>
                      {copy.body && (
                        <span className="mt-1 block line-clamp-2 text-xs leading-4 text-muted2">
                          {copy.body}
                        </span>
                      )}
                      <span className="mt-1.5 block text-[10px] text-faint">
                        {notificationTime(notification.createdAt)}
                      </span>
                    </button>
                    {!notification.isRead && (
                      <button
                        type="button"
                        onClick={() => markRead.mutate({ id: notification.id })}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-hov text-muted2 opacity-70 transition-colors hover:bg-act hover:text-foreground group-hover:opacity-100"
                        aria-label="Marcar como lida"
                        title="Marcar como lida"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
