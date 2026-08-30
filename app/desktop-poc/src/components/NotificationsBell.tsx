import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  Bell,
  AtSign,
  MessageSquare,
  UserPlus,
  Reply,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "./Avatar";
import type { NotificationDTO } from "@contracts/types";
import { useState } from "react";

function notificationText(n: NotificationDTO): string {
  const actor = n.actor?.name ?? n.actor?.username ?? "Alguém";
  switch (n.type) {
    case "mention":
      return `${actor} mencionou você`;
    case "dm":
      return `${actor} enviou uma mensagem direta`;
    case "friend_request":
      return `${actor} enviou um pedido de amizade`;
    case "reply":
      return `${actor} respondeu sua mensagem`;
    case "group_added":
      return "Você foi adicionado a um grupo";
    case "group_removed":
      return "Você foi removido de um grupo";
    case "call_started":
      return `${actor} iniciou uma chamada`;
    case "moderation":
      return "Aviso da moderação";
    default:
      return "Nova notificação";
  }
}

function NotificationIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0 text-[#5865F2]";
  switch (type) {
    case "mention":
      return <AtSign className={cls} />;
    case "dm":
      return <MessageSquare className={cls} />;
    case "friend_request":
      return <UserPlus className={cls} />;
    case "reply":
      return <Reply className={cls} />;
    default:
      return <Bell className={cls} />;
  }
}

export function NotificationsBell({
  onOpenProfile,
}: {
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const unread = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const list = trpc.notification.list.useQuery(undefined, { enabled: open });

  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const openNotification = (n: NotificationDTO) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    setOpen(false);
    if (n.type === "friend_request") {
      navigate("/channels/@me");
      return;
    }
    if (n.conversationId) {
      navigate(`/channels/@me/${n.conversationId}`);
      return;
    }
    if (n.serverId && n.channelId) {
      navigate(`/channels/${n.serverId}/${n.channelId}`);
    }
  };

  const count = unread.data?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted2 hover:bg-white/10 hover:text-white"
          title="Notificações"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0 bg-sidebar border-white/10 text-white shadow-2xl rounded-2xl select-none"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-white">
            Notificações
          </p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-[#5865F2] hover:bg-white/5"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {list.isLoading ? (
            <p className="p-4 text-xs text-muted2">
              Carregando notificações...
            </p>
          ) : list.data?.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted2">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            <div className="p-1">
              {list.data?.map(n => (
                <div
                  key={n.id}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="mt-0.5">
                    {n.actor ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onOpenProfile?.(n.actor!.id);
                        }}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                        aria-label={`Ver perfil de ${n.actor.name ?? n.actor.username ?? "usuário"}`}
                        title="Ver perfil"
                      >
                        <Avatar
                          userId={n.actor.id}
                          name={n.actor.name ?? n.actor.username}
                          src={n.actor.avatar}
                          size="sm"
                          showStatus={false}
                        />
                      </button>
                    ) : (
                      <NotificationIcon type={n.type} />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none"
                    aria-label={notificationText(n)}
                  >
                    <p className="text-xs font-semibold text-white">
                      {notificationText(n)}
                      {!n.isRead && (
                        <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#5865F2] align-middle" />
                      )}
                    </p>
                    {n.content && (
                      <p className="mt-0.5 truncate text-[11px] text-muted2">
                        {n.content}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted2/60">
                      {new Date(n.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
