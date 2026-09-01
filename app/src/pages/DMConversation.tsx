import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { DMSidebar } from "@/components/DMSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { DMCallPanel } from "@/components/voice/DMCallPanel";
import { SidebarPortal } from "@/components/SidebarPortal";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Avatar } from "@/components/Avatar";
import { GroupAvatar } from "@/components/groups/GroupAvatar";
import { groupDisplayName } from "@/lib/groupDisplayName";
import { GroupInfoModal } from "@/components/groups/GroupInfoModal";
import { GroupSearchModal } from "@/components/groups/GroupSearchModal";
import { voiceManager } from "@/lib/rtc";
import { soundManager } from "@/lib/sound";
import { toast } from "sonner";
import {
  ArrowLeft,
  Info,
  Phone,
  Search,
  UserPlus,
  UsersRound,
  Video,
  MoreVertical,
  LogOut,
  Settings,
  UserX,
  Ban,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppOutletContext } from "@/lib/appOutletContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { PinnedMessagesPopover } from "@/components/private/PinnedMessagesPopover";

export function DMConversation() {
  const navigate = useNavigate();
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const params = useParams();
  const conversationId = Number(params.conversationId);
  const isMobile = useIsMobile();
  const me = trpc.auth.me.useQuery().data;
  const conversation = trpc.dm.get.useQuery(
    { conversationId },
    {
      enabled: Number.isFinite(conversationId) && conversationId > 0,
      retry: false,
    }
  );
  const voiceConversationId = useAppStore(s => s.voiceConversationId);
  const [joining, setJoining] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [callCompact, setCallCompact] = useState(isMobile);

  const isGroup = conversation.data?.isGroup === true;
  const other = conversation.data?.otherUser;
  const dmDisplayName =
    conversation.data?.friendNickname ??
    other?.name ??
    other?.username ??
    "Conversa";
  const inCall = voiceConversationId === conversationId;
  const ongoingParticipants =
    useAppStore(s => s.voiceParticipants[`dm:${conversationId}`])?.filter(
      p => p.userId !== me?.id
    ) ?? [];
  const isRequest = !isGroup && conversation.data?.isRequest === true;
  const utils = trpc.useUtils();
  const startGroupCallNotify = trpc.group.startCall.useMutation();
  const startDmCallNotify = trpc.dm.notifyCallStart.useMutation();
  const createInviteMutation = trpc.group.createInvite.useMutation({
    onSuccess: data => {
      const url = `${window.location.origin}${data.url}`;
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Link de convite copiado!"))
        .catch(() => toast(`Convite: ${url}`));
    },
    onError: e => toast.error(e.message),
  });
  const requestAction = trpc.dm.requestAction.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.dm.list.invalidate(),
        utils.dm.get.invalidate({ conversationId }),
        utils.friend.list.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message),
  });

  // Sai da tela quando o usuário sai/é removido/exclui o grupo.
  useEffect(() => {
    const onLeft = () => {
      navigate("/channels/@me");
    };
    window.addEventListener("nexora:left-group", onLeft);
    return () => window.removeEventListener("nexora:left-group", onLeft);
  }, [navigate]);

  const startCall = async (withCamera: boolean, initiated = true) => {
    if (!me) return;
    setJoining(true);
    try {
      await voiceManager.join({
        conversationId,
        myId: me.id,
        initiated,
        video: withCamera,
      });
      useAppStore.getState().setIncomingCall(null);
      soundManager.stopRingtone();
      if (withCamera) await voiceManager.toggleCamera();
      if (initiated && voiceManager.currentRoomKey === `dm:${conversationId}`) {
        await (isGroup ? startGroupCallNotify : startDmCallNotify)
          .mutateAsync({ conversationId, video: withCamera })
          .catch(error => {
            console.error("[VOICE] Falha ao avisar participantes", error);
            toast.error(
              "A chamada começou, mas não foi possível avisar todos."
            );
          });
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível iniciar a chamada."
      );
    } finally {
      setJoining(false);
    }
  };

  const groupName = isGroup ? groupDisplayName(conversation.data ?? {}) : "";
  const myRole = conversation.data?.myRole ?? null;
  const isManager = myRole === "owner" || myRole === "admin";

  const header = (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-panel px-3 text-foreground sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {isMobile && (
          <button
            onClick={() => navigate("/channels/@me")}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted2 hover:bg-white/[0.06] hover:text-white md:hidden"
            aria-label="Voltar para mensagens"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {isGroup ? (
          <>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Informações do grupo ${groupName}`}
            >
              <GroupAvatar
                users={conversation.data?.members}
                src={conversation.data?.avatarUrl}
                name={groupName}
                size="xs"
              />
            </button>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="min-w-0 text-left focus-visible:outline-none"
              aria-label={`Abrir informações do grupo ${groupName}`}
            >
              <span className="block truncate font-bold text-sm leading-tight">
                {groupName}
              </span>
              <span className="block truncate text-[11px] text-muted2 leading-tight">
                {conversation.data?.memberCount ?? 0} participante
                {(conversation.data?.memberCount ?? 0) === 1 ? "" : "s"}
              </span>
            </button>
          </>
        ) : (
          <>
            {other?.id ? (
              <button
                type="button"
                onClick={() => onOpenProfile(other.id)}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ver perfil de ${dmDisplayName}`}
                title="Ver perfil"
              >
                <Avatar
                  userId={other.id}
                  name={other.name ?? other.username}
                  src={other.avatar}
                  size="xs"
                  showStatus
                />
              </button>
            ) : null}
            <span className="truncate font-bold text-sm">
              {dmDisplayName}
            </span>
            {other?.username && (
              <span className="hidden truncate text-xs text-muted2 font-medium sm:inline">
                @{other.username}
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted2 transition-colors hover:bg-hov hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Buscar na conversa"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Buscar na conversa</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PinnedMessagesPopover
          conversationId={conversationId}
          canUnpin={!isGroup || isManager}
        />

        {!isGroup && ongoingParticipants.length > 0 && !inCall && (
          <button
            onClick={() => void startCall(false, false)}
            disabled={joining}
            className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--presence-online)/0.15)] px-2.5 py-1.5 text-xs font-bold text-[hsl(var(--presence-online))] transition-colors hover:bg-[hsl(var(--presence-online)/0.25)] disabled:opacity-50"
            title="Entrar na chamada em andamento"
          >
            <Phone className="h-3.5 w-3.5" />
            Entrar ({ongoingParticipants.length})
          </button>
        )}

        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() =>
                  inCall ? setCallCompact(false) : void startCall(false)
                }
                disabled={joining}
                aria-label={
                  inCall ? "Expandir chamada" : "Iniciar chamada de voz"
                }
                className="rounded-lg p-1.5 text-muted2 hover:bg-hov hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Phone className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {inCall ? "Expandir chamada" : "Iniciar chamada de voz"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() =>
                  inCall ? setCallCompact(false) : void startCall(true)
                }
                disabled={joining}
                aria-label={
                  inCall ? "Expandir chamada" : "Iniciar chamada de vídeo"
                }
                className="rounded-lg p-1.5 text-muted2 hover:bg-hov hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Video className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {inCall ? "Expandir chamada" : "Iniciar chamada de vídeo"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isGroup ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-lg p-1.5 text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors"
                aria-label="Mais opções do grupo"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 border-border bg-panel text-xs text-foreground"
            >
              <DropdownMenuItem
                className="cursor-pointer hover:bg-hov"
                onClick={() => setInfoOpen(true)}
              >
                <Info className="mr-2 h-3.5 w-3.5 text-muted2" /> Informações do
                grupo
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer hover:bg-hov"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="mr-2 h-3.5 w-3.5 text-muted2" /> Buscar no
                grupo
              </DropdownMenuItem>
              {isManager && (
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-hov"
                  onClick={() =>
                    createInviteMutation.mutate({ conversationId })
                  }
                >
                  <UserPlus className="mr-2 h-3.5 w-3.5 text-primary" /> Gerar
                  link de convite
                </DropdownMenuItem>
              )}
              {myRole !== "owner" && (
                <DropdownMenuItem
                  className="cursor-pointer text-red-400 hover:bg-red-500/10 focus:text-red-300"
                  onClick={() => setInfoOpen(true)}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sair do grupo
                </DropdownMenuItem>
              )}
              {isManager && (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-hov"
                    onClick={() => setInfoOpen(true)}
                  >
                    <Settings className="mr-2 h-3.5 w-3.5 text-muted2" /> Editar
                    grupo
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {!isMobile && <NotificationsBell onOpenProfile={onOpenProfile} />}
      </div>
    </div>
  );

  const requestBanner = isRequest ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/[0.07] px-4 py-2.5 text-xs">
      <UserPlus className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-bodyx">
        <span className="font-bold">
          {other?.name ?? other?.username ?? "Alguém"}
        </span>{" "}
        está fora da sua lista. Aceite para manter a conversa na caixa
        principal.
      </p>
      <button
        type="button"
        onClick={() =>
          requestAction.mutate({ conversationId, action: "accept" })
        }
        disabled={requestAction.isPending}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Check className="h-3.5 w-3.5" /> Aceitar
      </button>
      <button
        type="button"
        onClick={() => {
          requestAction.mutate(
            { conversationId, action: "ignore" },
            { onSuccess: () => navigate("/channels/@me/requests") }
          );
        }}
        disabled={requestAction.isPending}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-muted2 transition-colors hover:bg-hov hover:text-foreground"
      >
        <UserX className="h-3.5 w-3.5" /> Ignorar
      </button>
      <button
        type="button"
        onClick={() => {
          const name = other?.name ?? other?.username ?? "esta pessoa";
          if (!window.confirm(`Bloquear ${name}?`)) return;
          requestAction.mutate(
            { conversationId, action: "block" },
            { onSuccess: () => navigate("/channels/@me/requests") }
          );
        }}
        disabled={requestAction.isPending}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        <Ban className="h-3.5 w-3.5" /> Bloquear
      </button>
    </div>
  ) : null;

  return (
    <div className="flex flex-1 min-h-0">
      <SidebarPortal>
        <DMSidebar onOpenProfile={onOpenProfile} />
      </SidebarPortal>

      <div className="flex min-w-0 flex-1 flex-col">
        {conversation.error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-chat text-xs text-muted2">
            <UsersRound className="h-8 w-8 text-faint" aria-hidden />
            Conversa não encontrada ou você não participa mais dela.
          </div>
        ) : !conversation.data || !me ? (
          <div className="flex flex-1 items-center justify-center bg-chat">
            <NexoraAppIcon className="h-10 w-10 animate-pulse" />
          </div>
        ) : (
          <ChatArea
            key={conversationId}
            conversationId={conversationId}
            placeholder={
              isGroup
                ? `Conversar em ${groupName}`
                : `Conversar com @${other?.username ?? ""}`
            }
            members={conversation.data.members.map(m => ({
              id: m.id,
              username: m.username,
              name: m.name,
            }))}
            myId={me.id}
            canManageMessages={!isGroup ? false : isManager}
            canPinMessages={!isGroup || isManager}
            showReadReceipts={isGroup}
            firstUnreadMessageId={conversation.data.firstUnreadMessageId}
            onOpenProfile={onOpenProfile}
            header={
              <>
                {header}
                {requestBanner}
              </>
            }
            topPanel={
              inCall ? (
                <DMCallPanel
                  conversationId={conversationId}
                  title={isGroup ? groupName : dmDisplayName}
                  compact={callCompact}
                  onCompactChange={setCallCompact}
                  onOpenProfile={onOpenProfile}
                />
              ) : null
            }
          />
        )}
      </div>

      {isGroup && (
        <GroupInfoModal
          open={infoOpen}
          onOpenChange={setInfoOpen}
          conversationId={conversationId}
          onOpenProfile={userId => {
            setInfoOpen(false);
            onOpenProfile(userId);
          }}
        />
      )}

      <GroupSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        conversationId={conversationId}
        members={
          conversation.data?.members.map(m => ({
            id: m.id,
            name: m.name,
            username: m.username,
            avatar: m.avatar,
          })) ?? []
        }
      />

    </div>
  );
}
