import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore, channelKey, dmKey } from "@/store/useAppStore";
import { setCurrentView } from "@/lib/currentView";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";
import { useChatUIStore } from "@/store/useChatUIStore";
import { Hash, Loader2 } from "lucide-react";

type Props = {
  channelId?: number;
  conversationId?: number;
  placeholder: string;
  members?: { id: number; username: string | null; name: string | null }[];
  myId: number;
  canManageMessages?: boolean;
  sendDisabled?: boolean;
  header: React.ReactNode;
};

export function ChatArea({
  channelId,
  conversationId,
  placeholder,
  members = [],
  myId,
  canManageMessages = false,
  sendDisabled = false,
  header,
}: Props) {
  const utils = trpc.useUtils();
  const key = channelId ? channelKey(channelId) : dmKey(conversationId!);
  const messages = useAppStore((s) => s.messages[key]);
  const hasMore = useAppStore((s) => s.hasMore[key] ?? false);
  const typingMap = useAppStore((s) => s.typing[key]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [, forceTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const setReplyingTo = useChatUIStore((s) => s.setReplyingTo);
  const setEditing = useChatUIStore((s) => s.setEditing);

  // Load messages + track current view
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCurrentView({ channelId, conversationId });
    setReplyingTo(null);
    setEditing(null);

    utils.client.message.list
      .query({ channelId, conversationId, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        useAppStore.getState().setMessages(key, res.messages, res.hasMore);
        setLoading(false);
        const last = res.messages.at(-1);
        if (last) {
          utils.client.message.markRead
            .mutate({ channelId, conversationId, lastMessageId: last.id })
            .catch(() => {});
        }
        if (channelId) useAppStore.getState().clearUnreadChannel(channelId);
        if (conversationId) useAppStore.getState().clearUnreadConversation(conversationId);
        requestAnimationFrame(() => scrollToBottom(true));
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      setCurrentView({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, conversationId]);

  // Typing indicator expiry tick
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll on new messages when near bottom
  useEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [messages?.length]);

  const scrollToBottom = (instant = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: instant ? "auto" : "smooth" });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;

    if (el.scrollTop < 80 && hasMore && !loadingOlder && messages && messages.length > 0) {
      setLoadingOlder(true);
      const prevHeight = el.scrollHeight;
      utils.client.message.list
        .query({ channelId, conversationId, before: messages[0].id, limit: 50 })
        .then((res) => {
          useAppStore.getState().prependMessages(key, res.messages, res.hasMore);
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight - prevHeight;
          });
        })
        .finally(() => setLoadingOlder(false));
    }
  };

  const jumpTo = useCallback(
    (messageId: number) => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("bg-primary/10");
        setTimeout(() => el.classList.remove("bg-primary/10"), 1500);
      }
    },
    [],
  );

  const typingUsers = Object.entries(typingMap ?? {})
    .filter(([userId, entry]) => entry.until > Date.now() && Number(userId) !== myId)
    .map(([, entry]) => entry.name);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-chat">
      {header}

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-8">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
              <Hash className="h-8 w-8" />
            </div>
            <p className="text-sm">Nenhuma mensagem ainda. Diga olá! 👋</p>
          </div>
        ) : (
          <div className="pb-2">
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!hasMore && messages.length > 10 && (
              <div className="px-4 pt-6 pb-2">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                  <Hash className="h-6 w-6" />
                </div>
                <p className="font-bold text-lg">Este é o começo desta conversa.</p>
              </div>
            )}
            {renderMessages(messages, myId, canManageMessages, jumpTo)}
          </div>
        )}
      </div>

      {/* Typing indicator */}
      <div className="h-5 px-4 text-xs text-muted-foreground">
        {typingUsers.length === 1 && <span>{typingUsers[0]} está digitando...</span>}
        {typingUsers.length === 2 && (
          <span>
            {typingUsers[0]} e {typingUsers[1]} estão digitando...
          </span>
        )}
        {typingUsers.length > 2 && <span>Várias pessoas estão digitando...</span>}
      </div>

      <MessageInput
        channelId={channelId}
        conversationId={conversationId}
        placeholder={placeholder}
        members={members}
        disabled={sendDisabled}
      />
    </div>
  );
}

function renderMessages(
  messages: NonNullable<ReturnType<typeof useAppStore.getState>["messages"][string]>,
  myId: number,
  canManage: boolean,
  jumpTo: (id: number) => void,
) {
  const items: React.ReactNode[] = [];
  let lastDay = "";
  let lastAuthor = -1;
  let lastTime = 0;

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    const day = date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (day !== lastDay) {
      items.push(
        <div key={`day-${msg.id}`} className="flex items-center gap-3 px-4 py-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold text-muted-foreground">{day}</span>
          <div className="h-px flex-1 bg-border" />
        </div>,
      );
      lastDay = day;
      lastAuthor = -1;
    }

    const grouped =
      lastAuthor === msg.authorId && date.getTime() - lastTime < 5 * 60 * 1000 && !msg.replyTo;
    items.push(
      <MessageItem
        key={msg.id}
        message={msg}
        grouped={grouped}
        myId={myId}
        canManageMessages={canManage}
        onJumpTo={jumpTo}
      />,
    );
    lastAuthor = msg.authorId;
    lastTime = date.getTime();
  }
  return items;
}
