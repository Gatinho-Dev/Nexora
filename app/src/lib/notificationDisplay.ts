import type {
  NotificationDTO,
  OfficialAnnouncementDTO,
} from "@contracts/types";

export const NOTIFICATION_POPUP_EVENT = "nexora:notification-popup";

/** Tipo sintético dos comunicados oficiais dentro da Caixa de entrada. */
export const OFFICIAL_NOTIFICATION_TYPE = "official";

/**
 * Converte um comunicado oficial em uma notificação da Caixa de entrada.
 *
 * Não gravamos uma linha por usuário no banco: a leitura de comunicados já é
 * rastreada por `official_announcement_reads`, e derivar a partir dessa fonte
 * faz avisos publicados no passado também aparecerem — o que uma linha criada
 * só no momento da publicação não faria.
 */
export function toOfficialNotification(
  announcement: OfficialAnnouncementDTO,
): NotificationDTO {
  return {
    id: -announcement.id,
    type: OFFICIAL_NOTIFICATION_TYPE,
    actor: null,
    serverId: null,
    channelId: null,
    conversationId: null,
    messageId: null,
    content: announcement.title,
    isRead: announcement.isRead,
    createdAt: announcement.publishedAt,
  };
}

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
    case OFFICIAL_NOTIFICATION_TYPE:
      return {
        title: "Nexora: comunicação oficial",
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
