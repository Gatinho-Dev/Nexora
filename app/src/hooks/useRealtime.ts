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
          soundManager.play("notification");
          // Browser notification when the tab is hidden and permission granted
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            const n = event.notification;
            const title =
              n.type === "mention"
                ? `${n.actor?.name ?? "Alguém"} mencionou você`
                : n.type === "dm"
                  ? `Nova mensagem de ${n.actor?.name ?? "Alguém"}`
                  : n.type === "reply"
                    ? `${n.actor?.name ?? "Alguém"} respondeu você`
                    : "Nexora";
            new Notification(title, {
              body: n.content ?? undefined,
              icon: "/icon.svg",
            });
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
            new Notification(`Nexora Oficial: ${event.announcement.title}`, {
              body: event.announcement.content,
              icon: "/icon.svg",
            });
          }
          break;
        }
        case "server:refresh":
          utils.server.get.invalidate();
          utils.server.list.invalidate();
          break;
        case "dm:refresh":
          utils.dm.list.invalidate();
          break;
        case "friends:refresh":
          utils.friend.list.invalidate();
          break;
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
