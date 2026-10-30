import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Ban,
  BellOff,
  BellRing,
  CheckCheck,
  Copy,
  MessageSquareOff,
  NotebookPen,
  Phone,
  Pin,
  PinOff,
  User,
  UserMinus,
} from "lucide-react";
import type { ConversationDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { voiceManager } from "@/lib/rtc";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isConversationMutedAt } from "@/lib/privateInbox";

type MenuMode = "context" | "dropdown";
type EditMode = "note" | "nickname" | null;

const muteDurations = [
  [15, "15 minutos"],
  [60, "1 hora"],
  [180, "3 horas"],
  [480, "8 horas"],
  [1440, "24 horas"],
] as const;

export function DMConversationMenu({
  conversation,
  mode,
  children,
  onOpenProfile,
  isFriend = false,
}: {
  conversation: ConversationDTO;
  mode: MenuMode;
  children: React.ReactNode;
  onOpenProfile?: (userId: number) => void;
  isFriend?: boolean;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery().data;
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [note, setNote] = useState(conversation.privateNote ?? "");
  const [nickname, setNickname] = useState(conversation.friendNickname ?? "");
  const [renderedAt] = useState(() => Date.now());
  const other = conversation.otherUser;
  const isMuted = isConversationMutedAt(conversation, renderedAt);

  const refresh = async () => {
    await Promise.all([
      utils.dm.list.invalidate(),
      utils.dm.get.invalidate({ conversationId: conversation.id }),
    ]);
  };

  const pin = trpc.dm.setPinned.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const mute = trpc.dm.mute.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const groupMute = trpc.group.mute.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const groupNotifications = trpc.group.setNotifications.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const close = trpc.dm.close.useMutation({
    onSuccess: async () => {
      await refresh();
      navigate("/channels/@me");
      toast.success("Conversa removida da lista. O histórico foi preservado.");
    },
    onError: error => toast.error(error.message),
  });
  const markRead = trpc.message.markRead.useMutation({
    onSuccess: async () => {
      await utils.message.unread.invalidate();
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const markUnread = trpc.dm.markUnread.useMutation({
    onSuccess: async () => {
      await utils.message.unread.invalidate();
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const requestAction = trpc.dm.requestAction.useMutation({
    onSuccess: async () => {
      await Promise.all([refresh(), utils.friend.list.invalidate()]);
      navigate("/channels/@me");
    },
    onError: error => toast.error(error.message),
  });
  const removeFriend = trpc.friend.remove.useMutation({
    onSuccess: async () => {
      await utils.friend.list.invalidate();
      toast.success("Amizade desfeita. O histórico da conversa foi preservado.");
    },
    onError: error => toast.error(error.message),
  });
  const saveDetails = trpc.dm.updatePrivateDetails.useMutation({
    onSuccess: async () => {
      await refresh();
      setEditMode(null);
      toast.success("Informação privada salva.");
    },
    onError: error => toast.error(error.message),
  });
  const callNotify = trpc.group.startCall.useMutation({
    onError: error => toast.error(error.message),
  });

  const setMute = (minutes: number | null, forever = false) => {
    if (conversation.isGroup) {
      if (forever) {
        groupNotifications.mutate({
          conversationId: conversation.id,
          level: "muted",
        });
      } else {
        groupMute.mutate({ conversationId: conversation.id, minutes });
      }
      return;
    }
    mute.mutate({ conversationId: conversation.id, minutes, forever });
  };

  const unmute = () => {
    if (conversation.isGroup) {
      groupNotifications.mutate({
        conversationId: conversation.id,
        level: "all",
      });
      return;
    }
    setMute(null, false);
  };

  const startCall = async () => {
    if (!me) return;
    try {
      await voiceManager.join({ conversationId: conversation.id, myId: me.id });
      callNotify.mutate({ conversationId: conversation.id });
      navigate(`/channels/@me/${conversation.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a chamada.",
      );
    }
  };

  const copyId = (value: number, label: string) => {
    void navigator.clipboard
      .writeText(String(value))
      .then(() => toast.success(`${label} copiado.`))
      .catch(() => toast.error(`Não foi possível copiar o ${label.toLowerCase()}.`));
  };

  const commonItems = mode === "context" ? (
    <>
      {conversation.unreadCount > 0 && conversation.lastMessage ? (
        <ContextMenuItem
          onSelect={() =>
            markRead.mutate({
              conversationId: conversation.id,
              lastMessageId: conversation.lastMessage!.id,
            })
          }
        >
          <CheckCheck /> Marcar como lida
        </ContextMenuItem>
      ) : (
        <ContextMenuItem onSelect={() => markUnread.mutate({ conversationId: conversation.id })}>
          <MessageSquareOff /> Marcar como não lida
        </ContextMenuItem>
      )}
      <ContextMenuItem
        onSelect={() =>
          pin.mutate({
            conversationId: conversation.id,
            pinned: !conversation.pinnedAt,
          })
        }
      >
        {conversation.pinnedAt ? <PinOff /> : <Pin />}
        {conversation.pinnedAt ? "Desafixar" : "Fixar"}
      </ContextMenuItem>
      <ContextMenuSeparator />
      {other && (
        <ContextMenuItem onSelect={() => onOpenProfile?.(other.id)}>
          <User /> Perfil
        </ContextMenuItem>
      )}
      <ContextMenuItem onSelect={() => void startCall()}>
        <Phone /> Iniciar chamada
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => setEditMode("note")}>
        <NotebookPen /> Adicionar nota
      </ContextMenuItem>
      {other && (
        <ContextMenuItem onSelect={() => setEditMode("nickname")}>
          <NotebookPen /> Apelido de amigo
        </ContextMenuItem>
      )}
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          {isMuted ? <BellRing /> : <BellOff />}
          {isMuted ? "Reativar notificações" : "Silenciar"}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-44 rounded-lg border-white/10 bg-popover/95 p-1 shadow-xl backdrop-blur-xl">
          {isMuted ? (
            <ContextMenuItem onSelect={unmute}>Reativar</ContextMenuItem>
          ) : (
            <>
              {muteDurations.map(([minutes, label]) => (
                <ContextMenuItem key={minutes} onSelect={() => setMute(minutes)}>
                  {label}
                </ContextMenuItem>
              ))}
              <ContextMenuItem onSelect={() => setMute(null, true)}>
                Até eu reativar
              </ContextMenuItem>
            </>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => close.mutate({ conversationId: conversation.id })}>
        <MessageSquareOff /> Fechar mensagem direta
      </ContextMenuItem>
      {isFriend && other && (
        <ContextMenuItem
          variant="destructive"
          onSelect={() => {
            if (window.confirm(`Desfazer amizade com ${other.name ?? other.username}?`)) {
              removeFriend.mutate({ userId: other.id });
            }
          }}
        >
          <UserMinus /> Desfazer amizade
        </ContextMenuItem>
      )}
      {other && (
        <ContextMenuItem
          variant="destructive"
          onSelect={() => {
            if (window.confirm(`Bloquear ${other.name ?? other.username}?`)) {
              requestAction.mutate({ conversationId: conversation.id, action: "block" });
            }
          }}
        >
          <Ban /> Bloquear
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      {other && (
        <ContextMenuItem onSelect={() => copyId(other.id, "ID do usuário")}>
          <Copy /> Copiar ID do usuário
        </ContextMenuItem>
      )}
      <ContextMenuItem onSelect={() => copyId(conversation.id, "ID da conversa")}>
        <Copy /> Copiar ID da conversa
      </ContextMenuItem>
    </>
  ) : null;

  const dropdownItems = mode === "dropdown" ? (
    <>
      <DropdownMenuItem
        onSelect={() =>
          pin.mutate({
            conversationId: conversation.id,
            pinned: !conversation.pinnedAt,
          })
        }
      >
        {conversation.pinnedAt ? <PinOff /> : <Pin />}
        {conversation.pinnedAt ? "Desafixar" : "Fixar"}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void startCall()}>
        <Phone /> Iniciar chamada
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setEditMode("note")}>
        <NotebookPen /> Adicionar nota
      </DropdownMenuItem>
      {other && (
        <DropdownMenuItem onSelect={() => setEditMode("nickname")}>
          <NotebookPen /> Apelido privado
        </DropdownMenuItem>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {isMuted ? <BellRing /> : <BellOff />}
          {isMuted ? "Reativar" : "Silenciar"}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-44 rounded-lg border-white/10 bg-popover/95 p-1 shadow-xl backdrop-blur-xl">
          {isMuted ? (
            <DropdownMenuItem onSelect={unmute}>Reativar</DropdownMenuItem>
          ) : (
            <>
              {muteDurations.map(([minutes, label]) => (
                <DropdownMenuItem key={minutes} onSelect={() => setMute(minutes)}>
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => setMute(null, true)}>
                Até eu reativar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => close.mutate({ conversationId: conversation.id })}>
        <MessageSquareOff /> Fechar DM
      </DropdownMenuItem>
      {other && (
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            if (window.confirm(`Bloquear ${other.name ?? other.username}?`)) {
              requestAction.mutate({ conversationId: conversation.id, action: "block" });
            }
          }}
        >
          <Ban /> Bloquear
        </DropdownMenuItem>
      )}
    </>
  ) : null;

  return (
    <>
      {mode === "context" ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
          <ContextMenuContent className="w-60 rounded-xl border-white/10 bg-popover/95 p-1.5 text-xs shadow-xl backdrop-blur-xl">
            {commonItems}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl border-white/10 bg-popover/95 p-1.5 text-xs shadow-xl backdrop-blur-xl">
            {dropdownItems}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={editMode !== null} onOpenChange={open => !open && setEditMode(null)}>
        <DialogContent className="border-white/10 bg-popover text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editMode === "nickname" ? "Apelido privado" : "Nota privada"}
            </DialogTitle>
            <DialogDescription className="text-muted2">
              Visível apenas para você nesta conta.
            </DialogDescription>
          </DialogHeader>
          {editMode === "nickname" ? (
            <Input
              value={nickname}
              onChange={event => setNickname(event.target.value)}
              maxLength={64}
              aria-label="Apelido privado"
              placeholder={other?.name ?? other?.username ?? "Apelido"}
            />
          ) : (
            <Textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              maxLength={500}
              rows={5}
              aria-label="Nota privada"
              placeholder="Escreva uma lembrança sobre esta pessoa ou conversa"
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditMode(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                saveDetails.mutate({
                  conversationId: conversation.id,
                  ...(editMode === "nickname"
                    ? { friendNickname: nickname }
                    : { privateNote: note }),
                })
              }
              disabled={saveDetails.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
