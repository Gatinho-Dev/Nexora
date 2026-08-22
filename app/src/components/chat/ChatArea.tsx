import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore, channelKey, dmKey } from "@/store/useAppStore";
import { setCurrentView } from "@/lib/currentView";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";
import { useChatUIStore } from "@/store/useChatUIStore";
import { Hash, Loader2, ArrowDown } from "lucide-react";

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
  const messages = useAppStore(s => s.messages[key]);
  const hasMore = useAppStore(s => s.hasMore[key] ?? false);
  const typingMap = useAppStore(s => s.typing[key]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [, forceTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const setReplyingTo = useChatUIStore(s => s.setReplyingTo);
  const setEditing = useChatUIStore(s => s.setEditing);

  const scrollToBottom = (instant = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: instant ? "auto" : "smooth",
    });
    setShowScrollBottom(false);
  };

  // Load messages + track current view
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, 0);
    setCurrentView({ channelId, conversationId });
    setReplyingTo(null);
    setEditing(null);

    utils.client.message.list
      .query({ channelId, conversationId, limit: 50 })
      .then(res => {
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
        if (conversationId)
          useAppStore.getState().clearUnreadConversation(conversationId);
        requestAnimationFrame(() => scrollToBottom(true));
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      cancelled = true;
      setCurrentView({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, conversationId]);

  // Typing indicator expiry tick
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      forceTick(t => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll on new messages when near bottom
  useEffect(() => {
    if (stickToBottom.current) {
      scrollToBottom();
    } else {
      setShowScrollBottom(true);
    }
  }, [messages?.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottom.current = isAtBottom;
    setShowScrollBottom(!isAtBottom);

    if (
      el.scrollTop < 80 &&
      hasMore &&
      !loadingOlder &&
      messages &&
      messages.length > 0
    ) {
      setLoadingOlder(true);
      const prevHeight = el.scrollHeight;
      utils.client.message.list
        .query({ channelId, conversationId, before: messages[0].id, limit: 50 })
        .then(res => {
          useAppStore
            .getState()
            .prependMessages(key, res.messages, res.hasMore);
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight - prevHeight;
          });
        })
        .finally(() => setLoadingOlder(false));
    }
  };

  const jumpTo = useCallback((messageId: number) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-[#5865F2]/20");
      setTimeout(() => el.classList.remove("bg-[#5865F2]/20"), 1500);
    }
  }, []);

  const typingUsers = useMemo(() => {
    return Object.entries(typingMap ?? {})
      .filter(([userId, entry]) => entry.until > now && Number(userId) !== myId)
      .map(([, entry]) => entry.name);
  }, [typingMap, myId, now]);

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full bg-[#313338] relative select-text">
      {header}

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto relative"
      >
        {loading ? (
          <SkeletonChatLoader />
        ) : !messages || messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#B5BAC1] gap-3 p-8 select-none">
            <div className="h-16 w-16 rounded-full bg-[#41434A] flex items-center justify-center">
              <div className="h-full w-full rounded-full flex items-center justify-center text-[#DBDEE1]">
                <Hash className="h-8 w-8" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white mb-1">
                Este é o começo da conversa
              </h3>
              <p className="text-sm text-[#B5BAC1]">
                Envie a primeira mensagem para começar a conversa.
              </p>
            </div>
          </div>
        ) : (
          <div className="pb-2">
            {loadingOlder && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#5865F2]" />
              </div>
            )}
            {!hasMore && messages.length > 10 && (
              <div className="px-4 pt-8 pb-3 select-none">
                <div className="h-12 w-12 rounded-2xl bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center mb-3">
                  <Hash className="h-6 w-6" />
                </div>
                <h2 className="font-bold text-xl text-white">
                  Bem-vindo ao começo deste canal!
                </h2>
                <p className="text-xs text-[#B5BAC1] mt-1">
                  Este é o início histórico de todas as mensagens.
                </p>
              </div>
            )}
            {renderMessages(messages, myId, canManageMessages, jumpTo)}
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Banner */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-16 right-6 z-20 flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-3.5 py-2 rounded-full text-xs font-semibold shadow-xl transition-colors"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          <span>Novas mensagens</span>
        </button>
      )}

      {/* Typing Indicator Bar */}
      <div className="h-5 px-4 text-xs font-medium text-[#B5BAC1] flex items-center select-none">
        {typingUsers.length === 1 && (
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5865F2] animate-ping" />
            <strong className="text-[#5865F2]">{typingUsers[0]}</strong> está
            digitando...
          </span>
        )}
        {typingUsers.length === 2 && (
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5865F2] animate-ping" />
            <strong className="text-[#5865F2]">{typingUsers[0]}</strong> e{" "}
            <strong className="text-[#5865F2]">{typingUsers[1]}</strong> estão
            digitando...
          </span>
        )}
        {typingUsers.length > 2 && (
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5865F2] animate-ping" />
            Várias pessoas estão digitando na Nexora...
          </span>
        )}
      </div>

      <MessageInput
        channelId={channelId}
        conversationId={conversationId}
        placeholder={placeholder}
        members={members}
        disabled={sendDisabled}
      />
    </main>
  );
}

function renderMessages(
  messages: NonNullable<
    ReturnType<typeof useAppStore.getState>["messages"][string]
  >,
  myId: number,
  canManage: boolean,
  jumpTo: (id: number) => void
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
        <div
          key={`day-${msg.id}`}
          className="flex items-center gap-3 px-4 py-3 select-none"
        >
          <div className="h-px flex-1 bg-[#3F4147]" />
          <span className="text-[11px] font-bold text-[#B5BAC1] uppercase tracking-wider">
            {day}
          </span>
          <div className="h-px flex-1 bg-[#3F4147]" />
        </div>
      );
      lastDay = day;
      lastAuthor = -1;
    }

    const grouped =
      lastAuthor === msg.authorId &&
      date.getTime() - lastTime < 5 * 60 * 1000 &&
      !msg.replyTo;
    items.push(
      <MessageItem
        key={msg.id}
        message={msg}
        grouped={grouped}
        myId={myId}
        canManageMessages={canManage}
        onJumpTo={jumpTo}
      />
    );
    lastAuthor = msg.authorId;
    lastTime = date.getTime();
  }
  return items;
}

function SkeletonChatLoader() {
  return (
    <div className="p-4 space-y-6 animate-pulse select-none">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex gap-3 items-start">
          <div className="h-10 w-10 rounded-full bg-[#383A40] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-[#383A40]" />
            <div className="h-4 w-3/4 rounded bg-[#35373C]" />
            <div className="h-4 w-1/2 rounded bg-[#35373C]" />
          </div>
        </div>
      ))}
    </div>
  );
}
