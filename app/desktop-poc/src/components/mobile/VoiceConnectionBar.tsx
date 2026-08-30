import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
import { useVoiceCallView } from "@/hooks/useVoiceCallView";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  PhoneOff,
  Signal,
  SignalHigh,
  TriangleAlert,
  ChevronUp,
} from "lucide-react";

/**
 * Barra persistente de chamada (mobile): aparece sempre que o usuário está
 * conectado a uma chamada e NÃO está na tela dela — garante retorno rápido
 * e controles essenciais enquanto navega pelo app.
 */
export function VoiceConnectionBar({ onOpenSheet }: { onOpenSheet?: () => void }) {
  const voiceChannelId = useAppStore(s => s.voiceChannelId);
  const voiceConversationId = useAppStore(s => s.voiceConversationId);
  const muted = useAppStore(s => s.muted);
  const connectionStatus = useAppStore(s => s.voiceConnectionStatus);
  const participantsMap = useAppStore(s => s.voiceParticipants);
  const { inCall, viewingCall } = useVoiceCallView();

  const roomKey =
    voiceChannelId != null
      ? `c:${voiceChannelId}`
      : voiceConversationId != null
        ? `dm:${voiceConversationId}`
        : null;
  const participantCount = useMemo(
    () => (roomKey ? participantsMap[roomKey]?.length ?? 0 : 0),
    [participantsMap, roomKey]
  );

  if (!inCall || viewingCall) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden animate-in slide-in-from-bottom fade-in duration-200">
      <div className="flex items-center gap-2.5 border-t border-black/20 bg-rail px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <button
          onClick={() => onOpenSheet?.()}
          aria-label="Abrir painel da chamada"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 text-left transition-colors active:bg-white/[0.06]"
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              connectionStatus === "connected"
                ? "bg-[#23A559]/15 text-[#3BA55C]"
                : connectionStatus === "connecting"
                  ? "bg-amber-400/15 text-amber-300"
                  : "bg-red-500/15 text-red-400"
            )}
          >
            {connectionStatus === "connected" ? (
              <SignalHigh className="h-4 w-4" />
            ) : connectionStatus === "connecting" ? (
              <TriangleAlert className="h-4 w-4" />
            ) : (
              <Signal className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-white">
              {connectionStatus === "connected"
                ? "Conectado"
                : connectionStatus === "connecting"
                  ? "Conectando…"
                  : connectionStatus === "reconnecting"
                    ? "Reconectando…"
                    : "Chamada"}
            </span>
            <span className="block truncate text-[11px] font-medium text-muted2">
              {participantCount > 0
                ? `${participantCount} participante${participantCount === 1 ? "" : "s"} · toque para voltar`
                : "Toque para voltar à chamada"}
            </span>
          </span>
          <ChevronUp
            className="h-4 w-4 shrink-0 text-muted2"
            aria-hidden
          />
        </button>

        <button
          onClick={() => voiceManager.toggleMute()}
          aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}
          aria-pressed={muted}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
            muted
              ? "bg-red-500/90 text-white"
              : "bg-white/10 text-bodyx"
          )}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <button
          onClick={() => void voiceManager.leave()}
          aria-label="Desconectar da chamada"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition-transform active:scale-95"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
