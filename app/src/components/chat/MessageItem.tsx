import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import type { MessageDTO } from "@contracts/types";
import { Avatar } from "../Avatar";
import { MessageContent } from "./MessageContent";
import { useChatUIStore } from "@/store/useChatUIStore";
import { CornerUpLeft, Pencil, Trash2, SmilePlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

function formatTime(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatFullDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  message: MessageDTO;
  grouped: boolean; // same author as previous within 5 min
  myId: number;
  canManageMessages: boolean;
  onJumpTo: (messageId: number) => void;
};

export function MessageItem({ message, grouped, myId, canManageMessages, onJumpTo }: Props) {
  const utils = trpc.useUtils();
  const setReplyingTo = useChatUIStore((s) => s.setReplyingTo);
  const setEditing = useChatUIStore((s) => s.setEditing);
  const editing = useChatUIStore((s) => s.editing);
  const [editText, setEditText] = useState(message.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emojiBarOpen, setEmojiBarOpen] = useState(false);

  const isMine = message.authorId === myId;
  const isEditing = editing?.id === message.id;

  const edit = trpc.message.edit.useMutation({
    onSuccess: () => setEditing(null),
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.message.delete.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const addReaction = trpc.message.addReaction.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const removeReaction = trpc.message.removeReaction.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const toggleReaction = (emoji: string) => {
    const existing = message.reactions.find((r) => r.emoji === emoji);
    if (existing?.userIds.includes(myId)) {
      removeReaction.mutate({ messageId: message.id, emoji });
    } else {
      addReaction.mutate({ messageId: message.id, emoji });
    }
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "group relative px-4 hover:bg-hover/60 transition-colors",
        grouped ? "py-0.5" : "pt-3 pb-0.5 mt-1",
      )}
    >
      {/* Reply reference */}
      {message.replyTo && (
        <button
          className="flex items-center gap-2 text-xs text-muted-foreground mb-1 ml-12 hover:text-foreground transition-colors"
          onClick={() => onJumpTo(message.replyTo!.id)}
        >
          <CornerUpLeft className="h-3 w-3" />
          <span className="font-semibold">@{message.replyTo.author.name ?? message.replyTo.author.username}</span>
          <span className="truncate max-w-md opacity-80">{message.replyTo.content}</span>
        </button>
      )}

      <div className="flex gap-3">
        {/* Avatar / gutter */}
        <div className="w-10 shrink-0">
          {!grouped ? (
            <Avatar
              userId={message.authorId}
              name={message.author.name ?? message.author.username}
              src={message.author.avatar}
              size="md"
            />
          ) : (
            <div className="h-full flex items-start justify-center">
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {!grouped && (
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm">
                {message.author.name ?? message.author.username}
              </span>
              <span className="text-[11px] text-muted-foreground" title={formatFullDate(message.createdAt)}>
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}

          {/* Content or edit box */}
          {isEditing ? (
            <div className="mt-1">
              <textarea
                className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={Math.min(6, editText.split("\n").length + 1)}
                value={editText}
                autoFocus
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editText.trim()) edit.mutate({ messageId: message.id, content: editText });
                  }
                  if (e.key === "Escape") setEditing(null);
                }}
              />
              <div className="flex items-center gap-2 mt-1 text-xs">
                <button
                  className="flex items-center gap-1 text-online hover:underline"
                  onClick={() => editText.trim() && edit.mutate({ messageId: message.id, content: editText })}
                >
                  <Check className="h-3 w-3" /> Salvar
                </button>
                <button
                  className="flex items-center gap-1 text-muted-foreground hover:underline"
                  onClick={() => setEditing(null)}
                >
                  <X className="h-3 w-3" /> Cancelar
                </button>
                <span className="text-muted-foreground">Esc para cancelar • Enter para salvar</span>
              </div>
            </div>
          ) : (
            <>
              {message.content && (
                <div className="text-sm">
                  <MessageContent content={message.content} />
                  {message.editedAt && (
                    <span className="text-[10px] text-muted-foreground ml-1" title={formatFullDate(message.editedAt)}>
                      (editado)
                    </span>
                  )}
                </div>
              )}

              {/* Attachments */}
              {message.attachments.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {message.attachments.map((att) => (
                    <AttachmentView key={att.id} att={att} />
                  ))}
                </div>
              )}

              {/* Reactions */}
              {message.reactions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {message.reactions.map((r) => {
                    const mine = r.userIds.includes(myId);
                    return (
                      <button
                        key={r.emoji}
                        onClick={() => toggleReaction(r.emoji)}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-colors",
                          mine
                            ? "bg-primary/20 border-primary/50"
                            : "bg-secondary border-border hover:border-primary/40",
                        )}
                        title={r.userIds.length + " reação(ões)"}
                      >
                        <span>{r.emoji}</span>
                        <span className="font-semibold">{r.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hover actions */}
      {!isEditing && (
        <div className="absolute -top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border rounded-md shadow-md p-0.5">
          <div className="relative">
            <ActionBtn title="Reagir" onClick={() => setEmojiBarOpen((v) => !v)}>
              <SmilePlus className="h-4 w-4" />
            </ActionBtn>
            {emojiBarOpen && (
              <div className="absolute bottom-8 right-0 z-20 flex gap-0.5 bg-popover border border-border rounded-md shadow-lg p-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="p-1 rounded hover:bg-hover text-base"
                    onClick={() => {
                      toggleReaction(emoji);
                      setEmojiBarOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ActionBtn title="Responder" onClick={() => setReplyingTo(message)}>
            <CornerUpLeft className="h-4 w-4" />
          </ActionBtn>
          {isMine && (
            <ActionBtn
              title="Editar"
              onClick={() => {
                setEditText(message.content);
                setEditing(message);
              }}
            >
              <Pencil className="h-4 w-4" />
            </ActionBtn>
          )}
          {(isMine || canManageMessages) && (
            <ActionBtn title="Excluir" danger onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </ActionBtn>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md bg-secondary p-3 text-sm">
            <span className="font-semibold">{message.author.name ?? message.author.username}: </span>
            {message.content.slice(0, 200)}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => del.mutate({ messageId: message.id })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded transition-colors",
        danger
          ? "text-muted-foreground hover:text-destructive"
          : "text-muted-foreground hover:text-foreground hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

function AttachmentView({ att }: { att: MessageDTO["attachments"][number] }) {
  if (att.mimeType.startsWith("image/")) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer">
        <img
          src={att.url}
          alt={att.filename}
          className="max-h-72 max-w-full sm:max-w-md rounded-md border border-border object-contain bg-secondary"
          loading="lazy"
        />
      </a>
    );
  }
  if (att.mimeType.startsWith("video/")) {
    return (
      <video src={att.url} controls className="max-h-72 max-w-full sm:max-w-md rounded-md border border-border" />
    );
  }
  if (att.mimeType.startsWith("audio/")) {
    return (
      <div className="rounded-md border border-border bg-secondary p-2 w-72">
        <div className="text-xs text-muted-foreground truncate mb-1">{att.filename}</div>
        <audio src={att.url} controls className="w-full h-8" />
      </div>
    );
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm hover:bg-hover transition-colors"
    >
      <span className="text-lg">📄</span>
      <div className="min-w-0">
        <div className="truncate font-medium chat-link">{att.filename}</div>
        <div className="text-[11px] text-muted-foreground">{formatSize(att.size)}</div>
      </div>
    </a>
  );
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
