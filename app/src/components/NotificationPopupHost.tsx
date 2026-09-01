import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BellRing, X } from "lucide-react";
import type { NotificationDTO } from "@contracts/types";
import { Avatar } from "@/components/Avatar";
import {
  NOTIFICATION_POPUP_EVENT,
  notificationCopy,
} from "@/lib/notificationDisplay";
import { trpc } from "@/providers/trpc";

type PopupItem = NotificationDTO & { popupKey: string };

const POPUP_DURATION_MS = 7_000;

export function NotificationPopupHost() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [items, setItems] = useState<PopupItem[]>([]);
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      void utils.notification.list.invalidate();
      void utils.notification.unreadCount.invalidate();
    },
  });

  useEffect(() => {
    const onNotification = (event: Event) => {
      const notification = (event as CustomEvent<NotificationDTO>).detail;
      if (!notification) return;
      const popupKey = `${notification.id}-${Date.now()}`;
      setItems(current => [
        { ...notification, popupKey },
        ...current.filter(item => item.id !== notification.id),
      ].slice(0, 3));
      window.setTimeout(() => {
        setItems(current =>
          current.filter(item => item.popupKey !== popupKey),
        );
      }, POPUP_DURATION_MS);
    };
    window.addEventListener(NOTIFICATION_POPUP_EVENT, onNotification);
    return () =>
      window.removeEventListener(NOTIFICATION_POPUP_EVENT, onNotification);
  }, []);

  const dismiss = (popupKey: string) => {
    setItems(current => current.filter(item => item.popupKey !== popupKey));
  };

  const open = (notification: PopupItem) => {
    markRead.mutate({ id: notification.id });
    dismiss(notification.popupKey);
    if (notification.conversationId) {
      navigate(`/channels/@me/${notification.conversationId}`);
      return;
    }
    if (notification.serverId && notification.channelId) {
      navigate(`/channels/${notification.serverId}/${notification.channelId}`);
      return;
    }
    if (notification.type === "friend_request") {
      navigate("/channels/@me/friends");
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3 md:left-auto md:right-4 md:w-[390px] md:items-stretch md:px-0"
    >
      {items.map(notification => {
        const copy = notificationCopy(notification);
        return (
          <article
            key={notification.popupKey}
            className="notification-liquid-glass pointer-events-auto flex w-full max-w-[390px] items-center gap-3 overflow-hidden rounded-[22px] border border-white/25 px-3 py-2.5 text-white shadow-[0_18px_55px_rgb(0_0_0/0.38),0_1px_0_rgb(255_255_255/0.22)_inset] backdrop-blur-2xl animate-in slide-in-from-top-4 fade-in duration-200"
          >
            {notification.actor ? (
              <Avatar
                userId={notification.actor.id}
                name={notification.actor.name ?? notification.actor.username}
                src={notification.actor.avatar}
                size="sm"
                showStatus={false}
              />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-white">
                <BellRing className="h-4 w-4" />
              </span>
            )}
            <button
              type="button"
              onClick={() => open(notification)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-[13px] font-bold">
                {copy.title}
              </span>
              {copy.body && (
                <span className="mt-0.5 block truncate text-[11px] text-white/75">
                  {copy.body}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => dismiss(notification.popupKey)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/65 hover:bg-white/10 hover:text-white"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </article>
        );
      })}
    </div>
  );
}
