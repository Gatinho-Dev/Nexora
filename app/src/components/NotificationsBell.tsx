import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Bell, AtSign, MessageSquare, UserPlus, Reply, Check } from "lucide-react";
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
    default:
      return "Nova notificação";
  }
}

function NotificationIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0 text-primary";
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

export function NotificationsBell() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const unread = trpc.notification.unreadCount.useQuery(undefined, { refetchInterval: 60_000 });
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
    if (!n.isRead) markRead.mutate({ notificationId: n.id });
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
        <Button variant="ghost" size="icon" className="relative" title="Notificações">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {list.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : list.data?.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            <div className="p-1">
              {list.data?.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--hover-bg)]"
                >
                  <div className="mt-0.5">
                    {n.actor ? (
                      <Avatar user={n.actor} size="sm" showStatus={false} />
                    ) : (
                      <NotificationIcon type={n.type} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {notificationText(n)}
                      {!n.isRead && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />}
                    </p>
                    {n.content && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.content}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
