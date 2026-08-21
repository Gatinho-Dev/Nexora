import { useParams } from "react-router";
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
import { Phone, Video } from "lucide-react";
import { useState } from "react";

export function DMConversation() {
  const params = useParams();
  const conversationId = Number(params.conversationId);
  const me = trpc.auth.me.useQuery().data;
  const conversation = trpc.dm.get.useQuery(
    { conversationId },
    { enabled: Number.isFinite(conversationId) && conversationId > 0, retry: false },
  );
  const voiceConversationId = useAppStore((s) => s.voiceConversationId);
  const [joining, setJoining] = useState(false);

  const other = conversation.data?.otherUser;
  const inCall = voiceConversationId === conversationId;

  const startCall = async (withCamera: boolean) => {
    if (!me) return;
    setJoining(true);
    try {
      await voiceManager.join({ conversationId, myId: me.id });
      if (withCamera) await voiceManager.toggleCamera();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a chamada.");
    } finally {
      setJoining(false);
    }
  };

  const header = (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <Avatar user={other ?? null} size="xs" />
      <span className="font-semibold truncate">{other?.name ?? other?.username ?? "Conversa"}</span>
      {other?.username && (
        <span className="text-sm text-muted-foreground truncate">@{other.username}</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => startCall(false)}
          disabled={joining || inCall}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-foreground disabled:opacity-50"
          title="Iniciar chamada de voz"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          onClick={() => startCall(true)}
          disabled={joining || inCall}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-foreground disabled:opacity-50"
          title="Iniciar chamada de vídeo"
        >
          <Video className="h-5 w-5" />
        </button>
        <div className="hidden md:block">
          <NotificationsBell />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0">
      <SidebarPortal>
        <DMSidebar />
      </SidebarPortal>

      <div className="flex min-w-0 flex-1 flex-col">
        {conversation.error ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Conversa não encontrada.
          </div>
        ) : !conversation.data || !me ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="pulsar-mark h-10 w-10 animate-pulse rounded-xl" />
          </div>
        ) : inCall ? (
          <>
            {header}
            <VoiceView conversationId={conversationId} title={other?.name ?? "Chamada"} />
          </>
        ) : (
          <ChatArea
            conversationId={conversationId}
            placeholder={`Conversar com ${other?.name ?? other?.username ?? ""}`}
            members={conversation.data.members.map((m) => ({
              id: m.id,
              username: m.username,
              name: m.name,
            }))}
            myId={me.id}
            header={header}
          />
        )}
      </div>
    </div>
  );
}
