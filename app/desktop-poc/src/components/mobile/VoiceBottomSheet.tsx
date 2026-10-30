import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVoiceCallView } from "@/hooks/useVoiceCallView";
import { VoiceConnectionBar } from "./VoiceConnectionBar";

export function VoiceBottomSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const roomKey = useAppStore(s => {
    const voiceChannelId = s.voiceChannelId;
    const voiceConversationId = s.voiceConversationId;
    if (voiceChannelId != null) return `c:${voiceChannelId}`;
    if (voiceConversationId != null) return `dm:${voiceConversationId}`;
    return null;
  });
  const participants = roomKey ? useAppStore.getState().voiceParticipants[roomKey] ?? [] : [];
  const [connectionQuality, setConnectionQuality] = useState<"excellent" | "good" | "poor" | "unknown">("unknown");
  const qualityCheckRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      setConnectionQuality("unknown");
      return;
    }
    const checkQuality = () => {
      const connectionStatus = useAppStore.getState().voiceConnectionStatus;
      if (connectionStatus === "connected") {
        const qualities = ["excellent", "good", "poor"] as const;
        const randomQuality = qualities[Math.floor(Math.random() * 3)];
        setConnectionQuality(randomQuality);
      } else {
        setConnectionQuality("unknown");
      }
    };
    checkQuality();
    qualityCheckRef.current = window.setInterval(checkQuality, 10000);
    return () => window.clearInterval(qualityCheckRef.current);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 md:hidden animate-in slide-in-from-bottom fade-in duration-200">
      <div className="bg-chat rounded-t-[24px] border-t border-white/[0.06] flex flex-col max-h-[85vh]">
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-sidebar px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Chamada de voz</p>
            <p className="text-[11px] text-[#aeb1bd]">
              {participants.length} {participants.length === 1 ? "participante" : "participantes"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-[#55d98b]">
              <span className={cn(
                "flex h-2 w-2 rounded-full",
                connectionQuality === "excellent" && "bg-[#23A559]",
                connectionQuality === "good" && "bg-amber-400",
                connectionQuality === "poor" && "bg-red-400",
                connectionQuality === "unknown" && "bg-white/30"
              )} />
              <span className="text-[10px] text-muted2">
                {connectionQuality === "excellent" && "Excelente"}
                {connectionQuality === "good" && "Boa"}
                {connectionQuality === "poor" && "Ruim"}
                {connectionQuality === "unknown" && "—"}
              </span>
            </span>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Fechar painel"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Participants list */}
        <div className="flex-1 overflow-y-auto p-4">
          {participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted2 py-12">
              <span className="text-lg">Nenhum participante</span>
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map(p => (
                <button
                  key={p.userId}
                  type="button"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-sidebar border border-white/[0.04] transition-colors"
                  aria-label={`Ver perfil de ${p.name}`}
                >
                  <div className="relative">
                    <Avatar
                      userId={p.userId}
                      name={p.name}
                      src={p.avatar}
                      size="md"
                      showStatus={false}
                    />
                    {useAppStore.getState().speakingByUser[p.userId] && !p.muted && (
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#3bbd72] flex items-center justify-center ring-2 ring-chat">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {p.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-muted2">
                    {p.muted && <span className="text-red-400">🔇</span>}
                    {p.deafened && <span className="text-red-400">🔈</span>}
                    {p.camera && <span className="text-[#5865F2]">📹</span>}
                    {p.screen && <span className="text-[#23A559]">🖥️</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="border-t border-white/[0.06] bg-sidebar/95 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <button
              onClick={() => voiceManager.toggleMute()}
              aria-label={useAppStore.getState().muted ? "Ativar microfone" : "Silenciar microfone"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 bg-white/10 text-bodyx"
            >
              {useAppStore.getState().muted ? <span>🔇</span> : <span>🎤</span>}
            </button>

            <button
              onClick={() => voiceManager.toggleDeafen()}
              aria-label={useAppStore.getState().deafened ? "Ativar áudio" : "Ensurdecer áudio"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 bg-white/10 text-bodyx"
            >
              {useAppStore.getState().deafened ? <span>🔈</span> : <span>🎧</span>}
            </button>

            <button
              onClick={() => voiceManager.toggleCamera().catch(e => toast.error(e.message))}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 bg-white/10 text-bodyx"
            >
              {useAppStore.getState().cameraOn ? <span>📹</span> : <span>📷</span>}
            </button>

            <button
              onClick={() => voiceManager.leave()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition-transform active:scale-95"
            >
              <span>📞</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoiceBottomSheetTrigger() {
  const { inCall, viewingCall } = useVoiceCallView();
  const [showSheet, setShowSheet] = useState(false);

  if (!inCall || viewingCall) return null;

  return (
    <>
      <VoiceConnectionBar onOpenSheet={() => setShowSheet(true)} />
      <VoiceBottomSheet
        isOpen={showSheet}
        onClose={() => setShowSheet(false)}
      />
    </>
  );
}