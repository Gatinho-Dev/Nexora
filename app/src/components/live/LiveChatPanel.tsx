import { useEffect, useRef, useState, type FormEvent } from "react";
import { SendHorizontal, X } from "lucide-react";
import type { LiveChatMessage } from "@contracts/live";
import { LIVE_CHAT_MAX_LENGTH } from "@contracts/live";

/**
 * Chat lateral da sala Nexora Live. No desktop fica ao lado do grid; no
 * celular vira painel sobreposto (via CSS). Enter envia; Shift+Enter quebra
 * linha. Mensagens vivem só na sessão da sala.
 */

function timeOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type Props = {
  chat: LiveChatMessage[];
  mySessionId: string;
  onSend(content: string): void;
  onClose(): void;
};

export function LiveChatPanel({ chat, mySessionId, onSend, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll apenas se o usuário está no fim (não rouba o scroll manual).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [chat.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    onSend(content);
    setDraft("");
  }

  return (
    <aside className="live-chat" aria-label="Chat da sala">
      <header className="live-chat__header">
        <h2>Chat</h2>
        <button
          type="button"
          className="live-icon-btn"
          onClick={onClose}
          aria-label="Fechar chat"
          title="Fechar chat"
        >
          <X size={18} />
        </button>
      </header>

      <div className="live-chat__list" ref={listRef}>
        {chat.length === 0 && (
          <p className="live-chat__empty">
            Nenhuma mensagem ainda. Diga oi!
          </p>
        )}
        {chat.map(message => {
          const mine = message.sessionId === mySessionId;
          return (
            <div
              key={message.id}
              className={`live-chat__msg ${mine ? "live-chat__msg--mine" : ""}`}
            >
              <div className="live-chat__msg-head">
                <span className="live-chat__nick">{message.nickname}</span>
                <time className="live-chat__time" dateTime={message.createdAt}>
                  {timeOf(message.createdAt)}
                </time>
              </div>
              <p className="live-chat__text">{message.content}</p>
            </div>
          );
        })}
      </div>

      <form className="live-chat__form" onSubmit={submit}>
        <textarea
          id="live-chat-input"
          className="live-chat__input"
          value={draft}
          onChange={e => setDraft(e.target.value.slice(0, LIVE_CHAT_MAX_LENGTH))}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const content = draft.trim();
              if (content) {
                onSend(content);
                setDraft("");
              }
            }
          }}
          placeholder="Enviar mensagem…"
          rows={1}
          autoComplete="off"
          maxLength={LIVE_CHAT_MAX_LENGTH}
          aria-label="Mensagem"
        />
        <button
          type="submit"
          className="live-icon-btn live-chat__send"
          disabled={!draft.trim()}
          aria-label="Enviar mensagem"
          title="Enviar mensagem"
        >
          <SendHorizontal size={18} />
        </button>
      </form>
    </aside>
  );
}
