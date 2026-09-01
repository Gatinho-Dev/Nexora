import { useEffect } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
import { soundManager } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { PhoneOff, Phone, Video } from "lucide-react";
import { toast } from "sonner";

const RING_TIMEOUT_MS = 120_000;

/**
 * Chamada recebida em DM/grupo: toque + banner com Aceitar/Recusar.
 * Montado uma vez no AppLayout; reage ao evento WS `notification` do tipo
 * `call_started` (o toque toca em useRealtime).
 */
export function IncomingCallToast() {
  const navigate = useNavigate();
  const call = useAppStore(s => s.incomingCall);
  const setIncomingCall = useAppStore(s => s.setIncomingCall);
  const voiceConversationId = useAppStore(s => s.voiceConversationId);
  const me = trpc.auth.me.useQuery().data;

  const dismiss = () => {
    soundManager.stopRingtone();
    setIncomingCall(null);
  };

  // Atender em outro lugar (ou a chamada começou por mim) → para o toque.
  useEffect(() => {
    if (!call) return;
    if (voiceConversationId === call.conversationId) {
      dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceConversationId]);

  useEffect(() => {
    if (!call) return;
    const timeout = setTimeout(dismiss, RING_TIMEOUT_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.conversationId]);

  useEffect(() => {
    return () => soundManager.stopRingtone();
  }, []);

  const markRead = trpc.notification.markRead.useMutation();

  const accept = async (withVideo = false) => {
    if (!call || !me) return;
    const target = call;
    dismiss();
    try {
      await voiceManager.join({
        conversationId: target.conversationId,
        myId: me.id,
        initiated: false,
        video: withVideo,
      });
      if (withVideo) await voiceManager.toggleCamera();
      if (target.notificationId) {
        markRead.mutate({ id: target.notificationId });
      }
      navigate(`/channels/@me/${target.conversationId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível atender a chamada."
      );
    }
  };

  const decline = () => {
    if (!call) return;
    voiceManager.declineCall(call.conversationId);
    if (call.notificationId) {
      markRead.mutate({ id: call.notificationId });
    }
    dismiss();
  };

  if (!call) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-[70] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-sidebar/95 p-3 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-top">
        <Avatar
          userId={0}
          name={call.actorName}
          src={call.actorAvatar ?? undefined}
          size="sm"
          showStatus={false}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{call.actorName}</p>
          <p className="text-xs text-muted2">
            {call.video ? "Chamada de vídeo" : "Chamada de voz"} entrando…
          </p>
        </div>
        <button
          onClick={decline}
          aria-label="Recusar chamada"
          title="Recusar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/90 text-white transition-colors hover:bg-red-500"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
        <button
          onClick={() => void accept(false)}
          aria-label="Aceitar chamada"
          title="Aceitar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-white transition-colors hover:bg-emerald-500"
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          onClick={() => void accept(true)}
          aria-label="Aceitar com vídeo"
          title="Aceitar com vídeo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4654D8] text-white transition-colors hover:bg-[#5868ea]"
        >
          <Video className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
