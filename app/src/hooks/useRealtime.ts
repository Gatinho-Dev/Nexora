import { useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { realtime } from "@/lib/ws";
import { getCurrentView } from "@/lib/currentView";
import { useAppStore, channelKey, dmKey } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
import { soundManager } from "@/lib/sound";
import type { WSServerEvent } from "@contracts/types";

/** Connects the realtime socket and routes events to stores/queries. */
export function useRealtime(myUserId: number | undefined) {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!myUserId) return;
    realtime.connect();

    const offConnect = realtime.onConnect(connected => {
      useAppStore.getState().setWsConnected(connected);
      voiceManager.handleRealtimeConnection(connected);
      if (connected) {
        // Recover anything missed while disconnected
        utils.message.unread.invalidate();
        utils.server.list.invalidate();
        utils.server.get.invalidate();
        utils.dm.list.invalidate();
        utils.friend.list.invalidate();
        utils.notification.unreadCount.invalidate();
        utils.notification.list.invalidate();
        utils.official.unreadCount.invalidate();
        utils.official.list.invalidate();
      }
    });

    const off = realtime.on((event: WSServerEvent) => {
      const store = useAppStore.getState();
      const view = getCurrentView();

      switch (event.t) {
        case "message:new": {
          const msg = event.message;
          store.addMessage(msg);
          const isMine = msg.authorId === myUserId;
          if (msg.channelId) {
            if (view.channelId === msg.channelId) {
              utils.client.message.markRead
                .mutate({ channelId: msg.channelId, lastMessageId: msg.id })
                .catch(() => {});
            } else if (!isMine) {
              store.bumpUnreadChannel(msg.channelId);
            }
          } else if (msg.conversationId) {
            utils.dm.list.invalidate();
            if (view.conversationId === msg.conversationId) {
              utils.client.message.markRead
                .mutate({
                  conversationId: msg.conversationId,
                  lastMessageId: msg.id,
                })
                .catch(() => {});
            } else if (!isMine) {
              store.bumpUnreadConversation(msg.conversationId);
              soundManager.play("dm-message");
            }
          }
          break;
        }
        case "message:update":
          store.updateMessage(event.message);
          break;
        case "message:delete":
          store.removeMessage(
            event.channelId
              ? channelKey(event.channelId)
              : dmKey(event.conversationId!),
            event.id
          );
          break;
        case "reaction":
          store.setReactions(
            event.channelId
              ? channelKey(event.channelId)
              : dmKey(event.conversationId!),
            event.messageId,
            event.reactions
          );
          break;
        case "typing": {
          const key = event.channelId
            ? channelKey(event.channelId)
            : dmKey(event.conversationId!);
          store.setTyping(
            key,
            event.user.id,
            event.user.name ?? event.user.username ?? "Alguém"
          );
          break;
        }
        case "presence":
          store.setPresence(event.userId, event.status);
          break;
        case "voice:participants": {
          const roomKey = event.channelId
            ? `c:${event.channelId}`
            : `dm:${event.conversationId}`;
          store.setVoiceParticipants(roomKey, event.participants);
          voiceManager.syncParticipants(roomKey, event.participants);
          break;
        }
        case "voice:ready": {
          const roomKey = event.channelId
            ? `c:${event.channelId}`
            : `dm:${event.conversationId}`;
          voiceManager.handleVoiceReady(roomKey, event.voiceSessionId);
          break;
        }
        case "voice:denied": {
          voiceManager.handleVoiceDenied(event.reason);
          break;
        }
        case "signal": {
          const roomKey = event.channelId
            ? `c:${event.channelId}`
            : `dm:${event.conversationId}`;
          voiceManager.handleSignal(roomKey, event.from, event.data as never);
          break;
        }
        case "notification": {
          utils.notification.unreadCount.invalidate();
          utils.notification.list.invalidate();
          const n = event.notification;
          if (n.type === "call_started" && n.conversationId) {
            const storeState = useAppStore.getState();
            const notInThatRoom =
              storeState.voiceConversationId !== n.conversationId &&
              storeState.voiceChannelId === null;
            if (notInThatRoom) {
              soundManager.startRingtone();
              storeState.setIncomingCall({
                conversationId: n.conversationId,
                actorName:
                  n.actor?.name ?? n.actor?.username ?? "Alguém",
                actorAvatar: n.actor?.avatar ?? null,
                notificationId: n.id,
                video: false,
              });
              break;
            }
          }
          soundManager.play("notification");
          // Browser notification when the tab is hidden and permission granted
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            const actorName = n.actor?.name ?? "Alguém";
            const title =
              n.type === "mention"
                ? `${actorName} mencionou você`
                : n.type === "dm"
                  ? `Nova mensagem de ${actorName}`
                  : n.type === "reply"
                    ? `${actorName} respondeu você`
                    : n.type === "group_added"
                      ? "Você foi adicionado a um grupo"
                      : n.type === "group_removed"
                        ? "Você foi removido de um grupo"
                        : n.type === "friend_request"
                          ? `${actorName} enviou um pedido de amizade`
                          : n.type === "call_started"
                            ? `${actorName} iniciou uma chamada`
                            : "Nexora";
            const desktopNotification = new Notification(title, {
              body: n.content ?? undefined,
              icon: "/icon.svg",
              tag: `nexora-${n.id}`,
            });
            desktopNotification.onclick = () => {
              window.focus();
              desktopNotification.close();
            };
          }
          break;
        }
        case "official:announcement": {
          utils.official.list.invalidate();
          utils.official.unreadCount.invalidate();
          soundManager.play("notification");
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            const desktopNotification = new Notification(
              `Nexora Oficial: ${event.announcement.title}`,
              {
                body: event.announcement.content,
                icon: "/icon.svg",
              }
            );
            desktopNotification.onclick = () => {
              window.focus();
              desktopNotification.close();
            };
          }
          break;
        }
        case "poll:update": {
          // Mescla a enquete atualizada na mensagem do store (todos os
          // visualizadores do canal/conversa recebem o mesmo evento).
          const roomKey = event.channelId
            ? channelKey(event.channelId)
            : dmKey(event.conversationId!);
          const current = useAppStore.getState().messages[roomKey];
          const target = current?.find(m => m.id === event.messageId);
          if (target) {
            store.updateMessage({ ...target, poll: event.poll });
          }
          break;
        }
        case "server:refresh":
          utils.server.get.invalidate();
          utils.server.list.invalidate();
          break;
        case "dm:refresh":
          utils.dm.list.invalidate();
          utils.dm.get.invalidate();
          break;
        case "group:update":
          // Atualiza listas e o grupo aberto (renome, membros, etc).
          utils.dm.list.invalidate();
          utils.group.get.invalidate({ conversationId: event.conversationId });
          break;
        case "friends:refresh":
          utils.friend.list.invalidate();
          break;
        case "stage:hands": {
          const key =
            event.channelId != null ? `c:${event.channelId}` : undefined;
          if (key) {
            useAppStore.getState().setStageHands(key, event.userIds);
          }
          break;
        }
      }
    });

    return () => {
      off();
      offConnect();
      voiceManager.cleanupVoiceSession();
      realtime.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId]);
}
