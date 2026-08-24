import { memo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { ImageViewer } from "./ImageViewer";
import { PollMessage } from "./poll/PollMessage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IconChannelForum as IconThread,
  IconChannelStage as IconMegaphone,
} from "../icons/figmaChannelIcons";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MessageDTO } from "@contracts/types";
import { Avatar } from "../Avatar";
import { MessageContent } from "./MessageContent";
import { useChatUIStore } from "@/store/useChatUIStore";
import {
  CornerUpLeft,
  Pencil,
  Trash2,
  SmilePlus,
  Check,
  X,
  MoreHorizontal,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { formatSize } from "@/lib/formatSize";
import { SensitiveMedia } from "../safety/SensitiveMedia";
import { useAppStore } from "@/store/useAppStore";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  channelType?: string;
  canPublish?: boolean;
  message: MessageDTO;
  grouped: boolean;
  myId: number;
  canManageMessages: boolean;
  onJumpTo: (messageId: number) => void;
  onOpenProfile?: (userId: number) => void;
};

function MessageItemBase({
  message,
  grouped,
  myId,
  canManageMessages,
  channelType,
  canPublish,
  onJumpTo,
  onOpenProfile,
}: Props) {
  const setReplyingTo = useChatUIStore(s => s.setReplyingTo);
  const setEditing = useChatUIStore(s => s.setEditing);
  const editing = useChatUIStore(s => s.editing);
  const [editText, setEditText] = useState(message.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emojiBarOpen, setEmojiBarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStart = () => {
    pressTimer.current = setTimeout(() => setSheetOpen(true), 480);
  };
  const onTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };
  const [threadDialog, setThreadDialog] = useState(false);
  const utils = trpc.useUtils();
  const createThread = trpc.threads.create.useMutation({
    onSuccess: data => {
      utils.threads.list.invalidate({ channelId: message.channelId ?? 0 });
      setThreadDialog(false);
      if (message.channelId)
        window.open(
          `${window.location.origin}/channels/${window.location.pathname.split("/")[2]}/${message.channelId}/t/${data.id}`,
          "_self"
        );
    },
    onError: e => toast.error(e.message),
  });
  const publishMsg = trpc.announce.publish.useMutation({
    onSuccess: r =>
      toast.success(`Publicado em ${r.published} servidor(es) seguidor(es).`),
    onError: e => toast.error(e.message),
  });

  const isMine = message.authorId === myId;
  const isEditing = editing?.id === message.id;
  const isSystem = message.tag === "system";

  // Eventos administrativos de grupo (item 36): estilo discreto e centralizado.
  if (isSystem) {
    return (
      <div
        id={`msg-${message.id}`}
        className="flex items-center gap-3 px-4 py-1.5 select-none"
        role="note"
      >
        <div className="h-px flex-1 bg-white/[0.07]" />
        <span className="max-w-[70%] truncate text-center text-[11px] font-medium text-muted2">
          {message.content}
        </span>
        <span
          className="text-[10px] text-faint"
          title={formatFullDate(message.createdAt)}
        >
          {formatTime(message.createdAt)}
        </span>
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>
    );
  }

  const edit = trpc.message.edit.useMutation({
    onSuccess: () => setEditing(null),
    onError: e => toast.error(e.message),
  });
  const del = trpc.message.delete.useMutation({
    onError: e => toast.error(e.message),
  });
  const addReaction = trpc.message.addReaction.useMutation({
    onError: e => toast.error(e.message),
  });
  const removeReaction = trpc.message.removeReaction.useMutation({
    onError: e => toast.error(e.message),
  });

  const toggleReaction = (emoji: string) => {
    const existing = message.reactions.find(r => r.emoji === emoji);
    if (existing?.userIds.includes(myId)) {
      removeReaction.mutate({ messageId: message.id, emoji });
    } else {
      addReaction.mutate({ messageId: message.id, emoji });
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    toast.success("Texto copiado!");
  };

  const copyId = () => {
    navigator.clipboard.writeText(String(message.id));
    toast.success("ID da mensagem copiado!");
  };

  return (
    <div
      id={`msg-${message.id}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchEnd}
      onContextMenu={e => {
        // Long-press nativo do mobile abre o mesmo menu de ações.
        if (window.matchMedia("(hover: none)").matches) {
          e.preventDefault();
          setSheetOpen(true);
        }
      }}
      className={cn(
        "group relative px-4 hover:bg-white/[0.03] transition-colors rounded-lg",
        grouped ? "py-0.5" : "pt-3 pb-0.5 mt-1"
      )}
    >
      {/* Inline Reply quote preview */}
      {message.replyTo && (
        <button
          type="button"
          className="flex max-w-[calc(100%_-_3rem)] items-center gap-2 mb-1 ml-12 text-left text-xs text-muted2 hover:text-white transition-colors"
          onClick={() => onJumpTo(message.replyTo!.id)}
          aria-label="Ir para a mensagem respondida"
        >
          <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
          <span className="font-semibold text-white/90">
            @{message.replyTo.author.name ?? message.replyTo.author.username}
          </span>
          <span className="truncate max-w-md opacity-80">
            {message.replyTo.content}
          </span>
        </button>
      )}

      <div className="flex gap-3">
        {/* Avatar / time column */}
        <div className="w-10 shrink-0 select-none">
          {!grouped ? (
            <button
              type="button"
              onClick={() => onOpenProfile?.(message.authorId)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
              aria-label={`Ver perfil de ${message.author.name ?? message.author.username ?? "usuário"}`}
              title="Ver perfil"
            >
              <Avatar
                userId={message.authorId}
                name={message.author.name ?? message.author.username}
                src={message.author.avatar}
                size="md"
              />
            </button>
          ) : (
            <div className="h-full flex items-start justify-center">
              <span className="text-[10px] text-muted2 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5 font-mono">
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {!grouped && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <button
                type="button"
                onClick={() => onOpenProfile?.(message.authorId)}
                className="rounded-sm text-sm font-bold text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
              >
                {message.author.name ?? message.author.username}
              </button>
              <span
                className="text-[11px] text-muted2 font-medium"
                title={formatFullDate(message.createdAt)}
              >
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}

          {/* Edit mode or content */}
          {isEditing ? (
            <div className="mt-1">
              <textarea
                className="w-full rounded-lg bg-sidebar border border-[#5865F2] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#5865F2] resize-none"
                rows={Math.min(6, editText.split("\n").length + 1)}
                value={editText}
                autoFocus
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editText.trim())
                      edit.mutate({ messageId: message.id, content: editText });
                  }
                  if (e.key === "Escape") setEditing(null);
                }}
              />
              <div className="flex items-center justify-between mt-1 text-xs text-muted2">
                <span>ESC para cancelar • ENTER para salvar</span>
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1 text-white hover:underline font-medium"
                    onClick={() => setEditing(null)}
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button
                    className="flex items-center gap-1 text-[#5865F2] font-bold hover:underline"
                    onClick={() =>
                      editText.trim() &&
                      edit.mutate({ messageId: message.id, content: editText })
                    }
                  >
                    <Check className="h-3.5 w-3.5" /> Salvar
                  </button>
                </div>
              </div>
            </div>
          ) : message.poll ? (
            <PollMessageView message={message} canManage={canManageMessages} myId={myId} />
          ) : message.tag === "sticker" ? (
            <img
              src={`/stickers/${message.content}.svg`}
              alt={`Sticker ${message.content}`}
              loading="lazy"
              className="h-40 w-40 select-none"
            />
          ) : (
            <>
              {message.content && (
                <div className="text-sm text-[#F2F3F5] leading-relaxed">
                  <MessageContent content={message.content} />
                  {message.editedAt && (
                    <span
                      className="text-[10px] text-muted2 ml-1.5 font-normal select-none"
                      title={formatFullDate(message.editedAt)}
                    >
                      (editado)
                    </span>
                  )}
                </div>
              )}

              {!grouped && message.threadId != null && !message.replyToId && (
            <a
              href={`/channels/${window.location.pathname.split("/")[2]}/${message.channelId}/t/${message.threadId}`}
              className="mb-1 ml-12 inline-flex items-center gap-1.5 rounded-lg bg-[#5865F2]/10 px-2 py-1 text-[11px] font-bold text-[#8ea1ff] hover:bg-[#5865F2]/20"
            >
              🧵 ver thread #{message.threadId}
            </a>
          )}

          {/* Attachments */}
              {message.attachments.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {message.attachments.map(att => (
                    <AttachmentView key={att.id} att={att} />
                  ))}
                </div>
              )}

              {/* Reactions list */}
              {message.reactions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 select-none">
                  {message.reactions.map(r => {
                    const mine = r.userIds.includes(myId);
                    return (
                      <button
                        key={r.emoji}
                        onClick={() => toggleReaction(r.emoji)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs border transition-[color,background-color,border-color,box-shadow,transform,opacity] active:scale-95",
                          mine
                            ? "bg-[#5865F2]/20 border-[#5865F2]/60 text-white font-bold"
                            : "bg-sidebar border-white/10 text-muted2 hover:border-white/20 hover:text-white"
                        )}
                        title={r.userIds.length + " reação(ões)"}
                      >
                        <span>{r.emoji}</span>
                        <span>{r.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Hover Action Toolbar */}
      {!isEditing && (
        <div className="msg-actions absolute -top-3.5 right-4 opacity-0 group-hover:opacity-100 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 flex items-center gap-0.5 bg-sidebar border border-white/10 rounded-lg shadow-xl p-0.5 z-10 select-none">
          <TooltipProvider delayDuration={150}>
            {/* Quick Emoji Reaction button */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setEmojiBarOpen(v => !v)}
                    className="p-1.5 rounded-md text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors"
                  >
                    <SmilePlus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Adicionar reação</TooltipContent>
              </Tooltip>

              {emojiBarOpen && (
                <div className="absolute bottom-9 right-0 z-30 flex gap-1 bg-panel border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in zoom-in-95 duration-100">
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-base transition-transform hover:scale-125"
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

            {/* Reply Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setReplyingTo(message)}
                  className="p-1.5 rounded-md text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors"
                >
                  <CornerUpLeft className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Responder</TooltipContent>
            </Tooltip>

            {/* Create thread (text channels only, top-level msgs) */}
            {channelType === "TEXT" && !message.threadId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setThreadDialog(true)}
                    className="p-1.5 rounded-md text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors"
                  >
                    <IconThread className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Criar thread</TooltipContent>
              </Tooltip>
            )}

            {/* Publish (announcement channels) */}
            {canPublish && channelType === "ANNOUNCEMENT" && !message.replyToId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => publishMsg.mutate({ messageId: message.id })}
                    className="p-1.5 rounded-md text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors"
                  >
                    <IconMegaphone className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Publicar nos seguidores</TooltipContent>
              </Tooltip>
            )}

            {/* More options dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-md text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 bg-panel border-white/10 text-white text-xs"
              >
                <DropdownMenuItem
                  onClick={copyText}
                  className="hover:bg-white/10 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 mr-2 text-muted2" /> Copiar
                  texto
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={copyId}
                  className="hover:bg-white/10 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 mr-2 text-muted2" /> Copiar ID
                </DropdownMenuItem>
                {isMine && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditText(message.content);
                      setEditing(message);
                    }}
                    className="hover:bg-white/10 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2 text-[#5865F2]" />{" "}
                    Editar
                  </DropdownMenuItem>
                )}
                {(isMine || canManageMessages) && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      onClick={() => setConfirmDelete(true)}
                      className="text-red-400 focus:text-red-300 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {/* Mobile long-press action sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute inset-x-3 bottom-3 space-y-1 rounded-2xl border border-white/10 bg-panel p-2 shadow-2xl pb-[calc(env(safe-area-inset-bottom)+8px)] animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Reações rápidas */}
            <div className="flex items-center justify-between gap-1 px-1 pb-1.5">
              {["👍", "❤️", "😂", "😮", "😢", "🔥"].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleReaction(emoji);
                    setSheetOpen(false);
                  }}
                  aria-label={`Reagir com ${emoji}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-xl transition-transform active:scale-90 hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Mais reações"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-muted2 transition-transform active:scale-90 hover:bg-white/10"
                  >
                    ＋
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="end"
                  className="w-72 p-2 bg-sidebar border-white/10"
                  onClickCapture={() => setSheetOpen(false)}
                >
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {[
                      ["Rostos", ["😀", "😄", "😁", "🤣", "😂", "🙂", "😉", "😊", "😍", "😘", "😜", "🤔", "🤨", "😐", "🙄", "😏", "😮", "😲", "😳", "🥺", "😢", "😭", "😤", "😠", "🥳", "😎"]],
                      ["Gestos", ["👍", "👎", "👌", "✌️", "🤞", "👏", "🙌", "🙏", "💪", "🫶", "👋"]],
                      ["Símbolos", ["❤️", "💜", "🖤", "💔", "💯", "✨", "🔥", "🎉", "⭐", "🚀"]],
                    ].map(([label, list]) => (
                      <div key={label as string}>
                        <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-faint">
                          {label as string}
                        </p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {(list as string[]).map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => {
                                toggleReaction(emoji);
                                setSheetOpen(false);
                              }}
                              aria-label={`Reagir com ${emoji}`}
                              className="rounded p-1 text-xl transition-transform active:scale-90 hover:bg-white/10"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="h-px bg-white/[0.06]" />
            {[
              {
                label: "Responder",
                run: () => setReplyingTo(message),
              },
              {
                label: "Reagir ❤️",
                run: () => toggleReaction("❤️"),
              },
              ...(channelType === "TEXT" && !message.threadId
                ? [
                    {
                      label: "Criar thread",
                      run: () => setThreadDialog(true),
                    },
                  ]
                : []),
              ...(canPublish && channelType === "ANNOUNCEMENT"
                ? [
                    {
                      label: "Publicar nos seguidores",
                      run: () => publishMsg.mutate({ messageId: message.id }),
                    },
                  ]
                : []),
              {
                label: "Copiar texto",
                run: () => {
                  navigator.clipboard.writeText(message.content).catch(() => {});
                  toast.success("Texto copiado.");
                },
              },
              ...(isMine
                ? [
                    {
                      label: "Editar",
                      run: () => setEditing(message),
                    },
                  ]
                : []),
              ...((isMine || canManageMessages)
                ? [
                    {
                      label: "Excluir",
                      danger: true,
                      run: () => setConfirmDelete(true),
                    },
                  ]
                : []),
            ].map(item => (
              <button
                key={item.label}
                onClick={() => {
                  item.run();
                  setSheetOpen(false);
                }}
                className={cn(
                  "min-h-[44px] w-full rounded-lg px-4 text-left text-sm font-semibold transition-colors",
                  (item as { danger?: boolean }).danger
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-bodyx hover:bg-white/5"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ThreadDialog
        open={threadDialog}
        onOpenChange={setThreadDialog}
        pending={createThread.isPending}
        onCreate={(n, priv) =>
          createThread.mutate({
            channelId: message.channelId!,
            name: n,
            private: priv,
            seedMessageId: message.id,
          })
        }
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-sidebar border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem</AlertDialogTitle>
            <AlertDialogDescription className="text-muted2">
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-panel border border-white/5 p-3 text-xs text-[#F2F3F5]">
            <span className="font-bold text-[#5865F2]">
              {message.author.name ?? message.author.username}:{" "}
            </span>
            {message.content.slice(0, 200)}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 text-white hover:bg-white/10 border-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
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

function AttachmentView({ att }: { att: MessageDTO["attachments"][number] }) {
  if (att.mimeType.startsWith("image/")) {
    return <SpoilerableImage att={att} />;
  }
  if (att.mimeType.startsWith("video/")) {
    return (
      <video
        src={att.url}
        controls
        className="max-h-72 max-w-full sm:max-w-md rounded-xl border border-white/10 bg-black"
      />
    );
  }
  if (att.mimeType.startsWith("audio/")) {
    return (
      <div className="rounded-xl border border-white/10 bg-sidebar p-2.5 w-72">
        <div className="text-xs font-medium text-muted2 truncate mb-1.5">
          {att.filename}
        </div>
        <audio src={att.url} controls className="w-full h-8" />
      </div>
    );
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-sidebar px-3.5 py-2.5 text-xs text-white hover:bg-white/5 transition-colors"
    >
      <span className="text-xl">📄</span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-[#5865F2] hover:underline">
          {att.filename}
        </div>
        <div className="text-[11px] text-muted2">{formatSize(att.size)}</div>
      </div>
    </a>
  );
}

function SpoilerableImage({ att }: { att: MessageDTO["attachments"][number] }) {
  const [revealed, setRevealed] = useState(!att.spoiler);
  const [viewerOpen, setViewerOpen] = useState(false);
  const mediaPref = useAppStore(s => s.sensitiveMediaPref);

  // Content-safety pipeline takes precedence over user spoiler marks.
  if (
    att.moderationStatus === "processing" ||
    att.moderationStatus === "blocked" ||
    att.sensitive
  ) {
    return (
      <SensitiveMedia
        src={att.url}
        alt={att.filename}
        moderationStatus={
          att.moderationStatus === "approved" || att.moderationStatus === "review_required"
            ? "processing"
            : att.moderationStatus
        }
        adultOnly={att.adultOnly}
        pref={mediaPref}
      />
    );
  }

  if (!att.spoiler || revealed) {
    return (
      <>
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className="group/img relative block overflow-hidden rounded-xl border border-white/10"
          aria-label={`Abrir imagem ${att.filename} em tela cheia`}
        >
          <img
            src={att.url}
            alt={att.filename}
            className="max-h-72 max-w-full sm:max-w-md rounded-xl object-contain bg-sidebar transition-transform duration-200 group-hover/img:scale-[1.02]"
            loading="lazy"
          />
        </button>
        {viewerOpen && (
          <ImageViewer
            src={att.url}
            alt={att.filename}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      title="Contém spoiler — clique para revelar"
      aria-label={`Revelar imagem com spoiler: ${att.filename}`}
      className={cn(
        "relative flex h-48 w-full sm:w-72 items-center justify-center overflow-hidden rounded-xl border border-white/10",
        "transition-all duration-200 hover:border-white/25"
      )}
    >
      <img
        src={att.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110"
        loading="lazy"
      />
      <span className="relative z-10 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-bold tracking-[0.2em] text-white">
        SPOILER
      </span>
    </button>
  );
}

export const MessageItem = memo(MessageItemBase);

/** Enquete embutida: votar/encerrar com atualização via realtime (poll:update). */
function PollMessageView({
  message,
  canManage,
  myId,
}: {
  message: MessageDTO;
  canManage: boolean;
  myId: number;
}) {
  const vote = trpc.poll.vote.useMutation();
  const close = trpc.poll.close.useMutation();
  const poll = message.poll;
  if (!poll) return null;
  const canClose = message.authorId === myId || canManage;

  return (
    <PollMessage
      poll={poll}
      busy={vote.isPending || close.isPending}
      canClose={canClose}
      onVote={answerIds =>
        vote.mutate({ messageId: message.id, answerIds })
      }
      onClose={() => close.mutate({ messageId: message.id })}
    />
  );
}

function ThreadDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string, priv: boolean) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [priv, setPriv] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova thread</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate(name.trim(), priv);
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="Nome da thread"
            maxLength={100}
          />
          <label className="flex items-center gap-2 text-xs text-muted2">
            <input
              type="checkbox"
              checked={priv}
              onChange={e => setPriv(e.target.checked)}
              className="accent-[#5865F2]"
            />
            Thread privada
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || pending}>
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
