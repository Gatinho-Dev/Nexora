import type { NotificationDTO } from "@contracts/types";

export const NOTIFICATION_POPUP_EVENT = "nexora:notification-popup";

export function notificationCopy(notification: NotificationDTO): {
  title: string;
  body: string;
} {
  const actor =
    notification.actor?.name ?? notification.actor?.username ?? "Alguém";

  switch (notification.type) {
    case "mention":
      return {
        title: `${actor} mencionou você`,
        body: notification.content ?? "",
      };
    case "dm":
      return {
        title: `${actor} enviou uma mensagem`,
        body: notification.content ?? "",
      };
    case "reply":
      return {
        title: `${actor} respondeu você`,
        body: notification.content ?? "",
      };
    case "friend_request":
      return {
        title: `${actor} enviou um pedido de amizade`,
        body: "Confira o pedido na Caixa de entrada.",
      };
    case "group_added":
      return {
        title: "Você foi adicionado a um grupo",
        body: notification.content ?? "",
      };
    case "group_removed":
      return {
        title: "Você foi removido de um grupo",
        body: notification.content ?? "",
      };
    case "call_started":
      return {
        title: `${actor} iniciou uma chamada`,
        body: notification.content ?? "",
      };
    case "moderation":
      return {
        title: "Aviso da moderação",
        body: notification.content ?? "",
      };
    default:
      return {
        title: "Nova atividade no Nexora",
        body: notification.content ?? "",
      };
  }
}

export function showNotificationPopup(notification: NotificationDTO) {
  window.dispatchEvent(
    new CustomEvent<NotificationDTO>(NOTIFICATION_POPUP_EVENT, {
      detail: notification,
    }),
  );
}
