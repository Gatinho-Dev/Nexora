import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { DMSidebar } from "@/components/DMSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { VoiceView } from "@/components/VoiceView";
import { SidebarPortal } from "@/components/SidebarPortal";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Avatar } from "@/components/Avatar";
import {
  CreateGroupModal,
} from "@/components/groups/CreateGroupModal";
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
  Trash2,
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
  const [createOpen, setCreateOpen] = useState(false);

  const isGroup = conversation.data?.isGroup === true;
  const other = conversation.data?.otherUser;
  const inCall = voiceConversationId === conversationId;
  const ongoingParticipants = useAppStore(
    s => s.voiceParticipants[`dm:${conversationId}`]
  )?.filter(p => p.userId !== me?.id) ?? [];
  const isRequest = !isGroup && conversation.data?.isRequest === true;
  const utils = trpc.useUtils();
  const startCallNotify = trpc.group.startCall.useMutation();
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
  const deleteRequest = trpc.dm.delete.useMutation({
    onSuccess: () => {
      utils.dm.list.invalidate();
      navigate("/channels/@me/requests");
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

  const startCall = async (withCamera: boolean) => {
    if (!me) return;
    setJoining(true);
    try {
      await voiceManager.join({ conversationId, myId: me.id });
      useAppStore.getState().setIncomingCall(null);
      soundManager.stopRingtone();
      if (withCamera) await voiceManager.toggleCamera();
      // Avisa os outros participantes (DM 1:1 toca o telefone deles;
      // grupos recebem a notificação de chamada).
      startCallNotify.mutate({ conversationId });
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
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-3 sm:px-4 bg-sidebar text-white select-none shadow-sm">
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
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
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
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                aria-label={`Ver perfil de ${other.name ?? other.username ?? "usuário"}`}
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
              {other?.name ?? other?.username ?? "Conversa"}
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
        {isGroup && (
          <>
            {/* Busca dentro do grupo (desktop: botão; mobile: menu ⋮) */}
            {!isMobile && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSearchOpen(true)}
                      className="hidden rounded-lg p-1.5 text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors lg:block"
                    >
                      <Search className="h-4 w-4" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Buscar no grupo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}

        {!isGroup && ongoingParticipants.length > 0 && !inCall && (
          <button
            onClick={() => void startCall(false)}
            disabled={joining}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
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
                onClick={() => startCall(false)}
                disabled={joining || inCall}
                aria-label="Iniciar chamada de voz"
                className="rounded-lg p-1.5 text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Phone className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Iniciar chamada de voz</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => startCall(true)}
                disabled={joining || inCall}
                aria-label="Iniciar chamada de vídeo"
                className="rounded-lg p-1.5 text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Video className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Iniciar chamada de vídeo</TooltipContent>
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
            <DropdownMenuContent align="end" className="w-52 bg-panel text-xs text-white">
              <DropdownMenuItem
                className="cursor-pointer hover:bg-white/10"
                onClick={() => setInfoOpen(true)}
              >
                <Info className="mr-2 h-3.5 w-3.5 text-muted2" /> Informações do grupo
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer hover:bg-white/10"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="mr-2 h-3.5 w-3.5 text-muted2" /> Buscar no grupo
              </DropdownMenuItem>
              {isManager && (
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-white/10"
                  onClick={() => createInviteMutation.mutate({ conversationId })}
                >
                  <UserPlus className="mr-2 h-3.5 w-3.5 text-primary" /> Gerar link de convite
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
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-white/10"
                    onClick={() => setInfoOpen(true)}
                  >
                    <Settings className="mr-2 h-3.5 w-3.5 text-muted2" /> Editar grupo
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
    <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-sidebar px-4 py-2.5 text-xs select-none">
      <UserPlus className="h-4 w-4 shrink-0 text-[#5865F2]" />
      <p className="min-w-0 flex-1 text-bodyx">
        <span className="font-bold">
          {other?.name ?? other?.username ?? "Alguém"}
        </span>{" "}
        está fora da sua lista de amigos. Responda para aceitar a conversa.
      </p>
      <button
        onClick={() => deleteRequest.mutate({ conversationId })}
        disabled={deleteRequest.isPending}
        className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 font-semibold text-red-400 transition-colors hover:bg-red-500/20"
      >
        <Trash2 className="h-3.5 w-3.5" /> Excluir
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
        ) : inCall ? (
          <>
            {header}
            <VoiceView
              conversationId={conversationId}
              title={isGroup ? groupName : (other?.name ?? "Chamada")}
              onOpenProfile={onOpenProfile}
            />
          </>
        ) : (
          <ChatArea
            conversationId={conversationId}
            placeholder={
              isGroup ? `Conversar em ${groupName}` : `Conversar com @${other?.username ?? ""}`
            }
            members={conversation.data.members.map(m => ({
              id: m.id,
              username: m.username,
              name: m.name,
            }))}
            myId={me.id}
            canManageMessages={!isGroup ? false : isManager}
            showReadReceipts={isGroup}
            onOpenProfile={onOpenProfile}
            header={
              <>
                {header}
                {requestBanner}
              </>
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

      {isGroup && (
        <GroupSearchModal
          open={searchOpen}
          onOpenChange={setSearchOpen}
          conversationId={conversationId}
          members={conversation.data?.members.map(m => ({
            id: m.id,
            name: m.name,
            username: m.username,
            avatar: m.avatar,
          })) ?? []}
        />
      )}

      <CreateGroupModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
