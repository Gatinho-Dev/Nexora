import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { TRPCError } from "@trpc/server";
import { useAppStore, channelKey, dmKey } from "@/store/useAppStore";
import { setCurrentView } from "@/lib/currentView";
import { MessageItem } from "./MessageItem";
import { IconHash } from "../icons/channelIcons";
import { MessageInput } from "./MessageInput";
import { useChatUIStore } from "@/store/useChatUIStore";
import {
  Loader2,
  ArrowDown,
  CheckCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "../Avatar";

type Props = {
  channelId?: number;
  conversationId?: number;
  placeholder: string;
  members?: { id: number; username: string | null; name: string | null }[];
  myId: number;
  canManageMessages?: boolean;
  canPinMessages?: boolean;
  /** Reservado para recibos de leitura (feature em desenvolvimento). */
  showReadReceipts?: boolean;
  firstUnreadMessageId?: number | null;
  channelType?: string;
  canPublish?: boolean;
  sendDisabled?: boolean;
  onOpenProfile?: (userId: number) => void;
  header: React.ReactNode;
  /** Surface kept mounted above the timeline (for example an active DM call). */
  topPanel?: React.ReactNode;
};

export function ChatArea({
  channelId,
  channelType,
  canPublish,
  conversationId,
  placeholder,
  members = [],
  myId,
  canManageMessages = false,
  canPinMessages = false,
  sendDisabled = false,
  showReadReceipts = false,
  firstUnreadMessageId = null,
  onOpenProfile,
  header,
  topPanel,
}: Props) {
  const utils = trpc.useUtils();
  const key = channelId ? channelKey(channelId) : dmKey(conversationId!);
  const messages = useAppStore(s => s.messages[key]);
  const hasMore = useAppStore(s => s.hasMore[key] ?? false);
  const typingMap = useAppStore(s => s.typing[key]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | TRPCError | false>(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const seenCountRef = useRef(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [, forceTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const setReplyingTo = useChatUIStore(s => s.setReplyingTo);
  const setEditing = useChatUIStore(s => s.setEditing);
  const unreadQuery = trpc.message.unread.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const unreadState = channelId
    ? unreadQuery.data?.channelDetails[channelId]
    : unreadQuery.data?.conversationDetails[conversationId!];
  const [localReadState, setLocalReadState] = useState(() => ({
    key,
    messageId: 0,
  }));
  const locallyReadThrough =
    localReadState.key === key ? localReadState.messageId : 0;
  const visibleUnreadState =
    unreadState && unreadState.latestMessageId > locallyReadThrough
      ? unreadState
      : null;

  const markReadThrough = useCallback(
    (lastMessageId: number) => {
      if (!lastMessageId) return;
      setLocalReadState({ key, messageId: lastMessageId });
      utils.client.message.markRead
        .mutate({ channelId, conversationId, lastMessageId })
        .then(() => {
          if (channelId) useAppStore.getState().clearUnreadChannel(channelId);
          if (conversationId) {
            useAppStore.getState().clearUnreadConversation(conversationId);
          }
          void utils.message.unread.invalidate();
        })
        .catch(() => {
          setLocalReadState({ key, messageId: 0 });
          void utils.message.unread.invalidate();
        });
    },
    [channelId, conversationId, key, utils],
  );

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
    if (!unreadQuery.isSuccess) return;
    let cancelled = false;
    const initialUnreadMessageId =
      unreadState?.firstUnreadMessageId ?? firstUnreadMessageId ?? undefined;
    // Com unread real, começamos no divisor; sem unread, no presente.
    stickToBottom.current = !initialUnreadMessageId;
    seenCountRef.current = 0;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(true);
        setLoadError(false);
        setNewBelowCount(0);
      }
    }, 0);
    setCurrentView({ channelId, conversationId });
    setReplyingTo(null);
    setEditing(null);

    utils.client.message.list
      .query({
        channelId,
        conversationId,
        limit: initialUnreadMessageId ? 100 : 50,
        around: initialUnreadMessageId,
      })
      .then(res => {
        if (cancelled) return;
        useAppStore.getState().setMessages(key, res.messages, res.hasMore);
        setLoading(false);
        requestAnimationFrame(() => {
          if (initialUnreadMessageId) {
            const boundary = document.getElementById(
              `unread-${initialUnreadMessageId}`,
            );
            boundary?.scrollIntoView({ block: "center", behavior: "auto" });
            return;
          }
          scrollToBottom(true);
        });
      })
      .catch(err => {
        if (!cancelled) {
          setLoadError(err);
          setLoading(false);
        }
      });

    return () => {
      clearTimeout(timeout);
      cancelled = true;
      setCurrentView({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, conversationId, reloadTick, unreadQuery.isSuccess]);

  // Uma conversa em segundo plano continua não lida até voltar ao foco. Só
  // marcamos como lida se o usuário já estava no presente do histórico.
  useEffect(() => {
    const markVisibleMessagesAsRead = () => {
      if (
        !stickToBottom.current ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      ) {
        return;
      }

      const last = useAppStore.getState().messages[key]?.at(-1);
      if (!last) return;
      markReadThrough(last.id);
    };

    window.addEventListener("focus", markVisibleMessagesAsRead);
    document.addEventListener("visibilitychange", markVisibleMessagesAsRead);
    return () => {
      window.removeEventListener("focus", markVisibleMessagesAsRead);
      document.removeEventListener(
        "visibilitychange",
        markVisibleMessagesAsRead,
      );
    };
  }, [key, markReadThrough]);

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
      seenCountRef.current = messages?.length ?? 0;
      setNewBelowCount(0);
      scrollToBottom();
    } else {
      const fresh = (messages?.length ?? 0) - seenCountRef.current;
      if (fresh > 0) setNewBelowCount(fresh);
      setShowScrollBottom(true);
    }
  }, [messages?.length]);

  // Uma mensagem recém-renderizada só vira lida quando o usuário realmente
  // está no presente, com a aba visível e focada.
  useEffect(() => {
    if (
      !visibleUnreadState?.latestMessageId ||
      !stickToBottom.current ||
      document.visibilityState !== "visible" ||
      !document.hasFocus()
    ) {
      return;
    }
    const frame = requestAnimationFrame(() =>
      markReadThrough(visibleUnreadState.latestMessageId),
    );
    return () => cancelAnimationFrame(frame);
  }, [markReadThrough, messages?.length, visibleUnreadState?.latestMessageId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottom.current = isAtBottom;
    setShowScrollBottom(!isAtBottom);
    if (isAtBottom) {
      seenCountRef.current = messages?.length ?? 0;
      setNewBelowCount(0);
      if (
        visibleUnreadState?.latestMessageId &&
        document.visibilityState === "visible" &&
        document.hasFocus()
      ) {
        markReadThrough(visibleUnreadState.latestMessageId);
      }
    }

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
      el.classList.add("bg-primary/10");
      setTimeout(() => el.classList.remove("bg-primary/10"), 1500);
    }
  }, []);

  const typingUsers = useMemo(() => {
    return Object.entries(typingMap ?? {})
      .filter(([userId, entry]) => entry.until > now && Number(userId) !== myId)
      .map(([, entry]) => entry.name);
  }, [typingMap, myId, now]);

  // Barra fixa logo abaixo do header, alimentada pelo read state do backend.
  const unreadBar = useMemo(() => {
    if (!visibleUnreadState) return null;
    const count = visibleUnreadState.count;
    return (
      <div className="relative flex min-h-9 items-center gap-3 border-b border-[#4654D8]/45 bg-[#4654D8] px-4 text-white shadow-[0_1px_0_rgb(255_255_255/0.08)_inset] select-none">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {count === 1 ? "1 mensagem nova" : `${count} mensagens novas`}
          {visibleUnreadState.firstUnreadAt
            ? ` desde ${formatUnreadSince(visibleUnreadState.firstUnreadAt)}`
            : ""}
        </span>
        <button
          onClick={() => markReadThrough(visibleUnreadState.latestMessageId)}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/15 active:scale-[0.98]"
        >
          Marcar como lida
        </button>
      </div>
    );
  }, [markReadThrough, visibleUnreadState]);

  // Última mensagem própria (não-evento) para o recibo "Visto por N".
  const lastOwnMessageId = useMemo(() => {
    if (!showReadReceipts || !messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.authorId === myId &&
        m.tag !== "system" &&
        m.tag !== "call"
      ) {
        return m.id;
      }
    }
    return null;
  }, [messages, myId, showReadReceipts]);

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full bg-chat relative select-text">
      {header}
      {topPanel}
      {unreadBar}

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto relative"
      >
        {loading ? (
          <SkeletonChatLoader />
        ) : loadError && (!messages || messages.length === 0) ? (
          <div className="h-full flex flex-col items-center justify-center text-muted2 gap-3 p-8 select-none">
            <div className="text-center">
              <h3 className="text-base font-bold text-foreground mb-1">
                Não foi possível carregar as mensagens
              </h3>
              <p className="text-sm text-muted2 mb-4">
                {loadError instanceof TRPCError ? loadError.message : loadError instanceof Error ? loadError.message : "Verifique sua conexão e tente novamente."}
              </p>
              <button
                onClick={() => {
                  setLoading(true);
                  setReloadTick(t => t + 1);
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Tentar de novo
              </button>
            </div>
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted2 gap-3 p-8 select-none">
            <div className="h-16 w-16 rounded-full bg-[#41434A] flex items-center justify-center">
              <div className="h-full w-full rounded-full flex items-center justify-center text-bodyx">
                <IconHash className="h-8 w-8 text-faint" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-foreground mb-1">
                Este é o começo da conversa
              </h3>
              <p className="text-sm text-muted2">
                Envie a primeira mensagem para começar a conversa.
              </p>
            </div>
          </div>
        ) : (
          <div className="pb-2">
            {loadingOlder && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
            {!hasMore && messages.length > 10 && (
              <div className="px-4 pt-8 pb-3 select-none">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <IconHash className="h-7 w-7 text-faint" />
                </div>
                <h2 className="font-bold text-xl text-foreground">
                  Bem-vindo ao começo deste canal!
                </h2>
                <p className="text-xs text-muted2 mt-1">
                  Este é o início histórico de todas as mensagens.
                </p>
              </div>
            )}
            {renderMessages(
              messages,
              myId,
              canManageMessages,
              channelType,
              canPublish,
              canPinMessages,
              jumpTo,
              onOpenProfile,
              visibleUnreadState?.firstUnreadMessageId ?? null,
            )}
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Banner */}
      {showScrollBottom && (
        <button
          onClick={() => {
            seenCountRef.current = messages?.length ?? 0;
            setNewBelowCount(0);
            scrollToBottom();
          }}
          className="absolute bottom-16 right-6 z-20 flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xl transition-colors hover:bg-primary/90"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          <span>
            {newBelowCount > 0
              ? newBelowCount === 1
                ? "1 nova mensagem"
                : `${newBelowCount} novas mensagens`
              : "Ir para o presente"}
          </span>
        </button>
      )}

      {/* Read receipts (grupos — item 12) */}
      {showReadReceipts && lastOwnMessageId != null && (
        <ReadReceipts messageId={lastOwnMessageId} />
      )}

      {/* Typing Indicator Bar */}
      <div className="h-5 px-4 text-xs font-medium text-muted2 flex items-center select-none">
        {typingUsers.length === 1 && (
          <span className="flex items-center gap-1.5 text-muted2">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            <strong className="text-primary">{typingUsers[0]}</strong> está
            digitando...
          </span>
        )}
        {typingUsers.length === 2 && (
          <span className="flex items-center gap-1.5 text-muted2">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            <strong className="text-primary">{typingUsers[0]}</strong> e{" "}
            <strong className="text-primary">{typingUsers[1]}</strong> estão
            digitando...
          </span>
        )}
        {typingUsers.length > 2 && (
          <span className="flex items-center gap-1.5 text-muted2">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
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
  channelType: string | undefined,
  canPublish: boolean | undefined,
  canPinMessages: boolean,
  jumpTo: (id: number) => void,
  onOpenProfile?: (userId: number) => void,
  unreadBoundary?: number | null,
) {
  const items: React.ReactNode[] = [];
  let lastDay = "";
  let lastAuthor = -1;
  let lastTime = 0;

  for (const msg of messages) {
    if (msg.id === unreadBoundary) {
      items.push(
        <div
          id={`unread-${msg.id}`}
          key={`unread-${msg.id}`}
          className="flex items-center gap-3 px-4 py-2 select-none"
          role="separator"
          aria-label="Novas mensagens"
        >
          <div className="h-px flex-1 bg-[#7383FF]/70" />
          <span className="text-[11px] font-semibold text-[#7383FF]">
            Novas mensagens
          </span>
          <div className="h-px flex-1 bg-[#7383FF]/70" />
        </div>,
      );
      lastAuthor = -1;
    }
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
          <span className="text-[11px] font-bold text-muted2 uppercase tracking-wider">
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
      !msg.replyTo &&
      msg.tag !== "system" &&
      msg.tag !== "call";
    items.push(
      <MessageItem
        key={msg.id}
        message={msg}
        grouped={grouped}
        myId={myId}
        canManageMessages={canManage}
        channelType={channelType}
        canPublish={canPublish}
        canPinMessages={canPinMessages}
        onJumpTo={jumpTo}
        onOpenProfile={onOpenProfile}
      />
    );
    // Eventos de sistema/chamada não participam do agrupamento visual.
    if (msg.tag !== "system" && msg.tag !== "call") {
      lastAuthor = msg.authorId;
      lastTime = date.getTime();
    }
  }
  return items;
}

function formatUnreadSince(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function SkeletonChatLoader() {
  return (
    <div className="p-4 space-y-6 animate-pulse select-none">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex gap-3 items-start">
          <div className="h-10 w-10 rounded-full bg-[#383A40] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-[#383A40]" />
            <div className="h-4 w-3/4 rounded bg-hov" />
            <div className="h-4 w-1/2 rounded bg-hov" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Visto por N" + lista de quem leu (grupos). */
function ReadReceipts({ messageId }: { messageId: number }) {
  const [open, setOpen] = useState(false);
  const receipts = trpc.group.readBy.useQuery(
    { messageId },
    { enabled: messageId > 0, staleTime: 10_000 }
  );
  const readers = receipts.data?.users ?? [];
  if (readers.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mr-1 mt-0.5 flex h-5 items-center gap-1 self-end rounded-full px-1.5 text-[10px] font-semibold text-muted2 transition-colors hover:text-bodyx"
        aria-label={`Visto por ${readers.length} pessoa(s)`}
      >
        <CheckCheck className="h-3.5 w-3.5 text-[#3BA55C]" aria-hidden />
        Visto por {readers.length}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Visto por</DialogTitle>
          </DialogHeader>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {readers.map(u => (
              <li
                key={u.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
              >
                <Avatar
                  userId={u.id}
                  name={u.name ?? u.username}
                  src={u.avatar}
                  size="xs"
                />
                <span className="truncate text-xs font-semibold text-bodyx">
                  {u.name ?? u.username ?? "Usuário"}
                </span>
                <CheckCheck
                  className="ml-auto h-3.5 w-3.5 shrink-0 text-[#3BA55C]"
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
