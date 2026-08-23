import { useNavigate, useOutletContext, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { DMSidebar } from "@/components/DMSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { VoiceView } from "@/components/VoiceView";
import { SidebarPortal } from "@/components/SidebarPortal";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Avatar } from "@/components/Avatar";
import { voiceManager } from "@/lib/rtc";
import { toast } from "sonner";
import { Phone, Video, UserPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AppOutletContext } from "@/lib/appOutletContext";
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

  const other = conversation.data?.otherUser;
  const inCall = voiceConversationId === conversationId;
  const isRequest = conversation.data?.isRequest === true;
  const utils = trpc.useUtils();
  const deleteRequest = trpc.dm.delete.useMutation({
    onSuccess: () => {
      utils.dm.list.invalidate();
      navigate("/channels/@me/requests");
    },
    onError: e => toast.error(e.message),
  });

  const startCall = async (withCamera: boolean) => {
    if (!me) return;
    setJoining(true);
    try {
      await voiceManager.join({ conversationId, myId: me.id });
      if (withCamera) await voiceManager.toggleCamera();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível iniciar a chamada."
      );
    } finally {
      setJoining(false);
    }
  };

  const header = (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4 bg-[#2B2D31] text-white select-none shadow-sm">
      <div className="flex items-center gap-2.5 min-w-0">
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
        <span className="font-bold text-sm truncate">
          {other?.name ?? other?.username ?? "Conversa"}
        </span>
        {other?.username && (
          <span className="text-xs text-[#B5BAC1] truncate font-medium">
            @{other.username}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => startCall(false)}
                disabled={joining || inCall}
                className="rounded-lg p-1.5 text-[#B5BAC1] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
              >
                <Phone className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Iniciar chamada de voz
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => startCall(true)}
                disabled={joining || inCall}
                className="rounded-lg p-1.5 text-[#B5BAC1] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
              >
                <Video className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Iniciar chamada de vídeo
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="hidden md:block">
          <NotificationsBell onOpenProfile={onOpenProfile} />
        </div>
      </div>
    </div>
  );

  const requestBanner = isRequest ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-[#2B2D31] px-4 py-2.5 text-xs select-none">
      <UserPlus className="h-4 w-4 shrink-0 text-[#5865F2]" />
      <p className="min-w-0 flex-1 text-[#DBDEE1]">
        <span className="font-bold">
          {other?.name ?? other?.username ?? "Alguém"}
        </span>{" "}
        está fora da sua lista de amigos. Responda para aceitar a conversa.
      </p>
      <button
        onClick={() =>
          deleteRequest.mutate({ conversationId })
        }
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
          <div className="flex flex-1 items-center justify-center text-xs text-[#B5BAC1] bg-[#313338]">
            Conversa não encontrada.
          </div>
        ) : !conversation.data || !me ? (
          <div className="flex flex-1 items-center justify-center bg-[#313338]">
            <NexoraAppIcon className="h-10 w-10 animate-pulse" />
          </div>
        ) : inCall ? (
          <>
            {header}
            <VoiceView
              conversationId={conversationId}
              title={other?.name ?? "Chamada"}
              onOpenProfile={onOpenProfile}
            />
          </>
        ) : (
          <ChatArea
            conversationId={conversationId}
            placeholder={`Conversar com @${other?.username ?? ""}`}
            members={conversation.data.members.map(m => ({
              id: m.id,
              username: m.username,
              name: m.name,
            }))}
            myId={me.id}
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
    </div>
  );
}
