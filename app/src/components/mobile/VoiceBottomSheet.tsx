import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVoiceCallView } from "@/hooks/useVoiceCallView";
import { VoiceConnectionBar } from "./VoiceConnectionBar";
import {
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const EMPTY_PARTICIPANTS: never[] = [];

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
  const participantsMap = useAppStore(state => state.voiceParticipants);
  const participants = roomKey
    ? (participantsMap[roomKey] ?? EMPTY_PARTICIPANTS)
    : EMPTY_PARTICIPANTS;
  const connectionQuality = useAppStore(state => state.voiceQuality);
  const speakingByUser = useAppStore(state => state.speakingByUser);
  const muted = useAppStore(state => state.muted);
  const deafened = useAppStore(state => state.deafened);
  const cameraOn = useAppStore(state => state.cameraOn);

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
            <p className="truncate text-sm font-semibold text-white">
              Chamada de voz
            </p>
            <p className="text-[11px] text-[#aeb1bd]">
              {participants.length}{" "}
              {participants.length === 1 ? "participante" : "participantes"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-[#55d98b]">
              <span
                className={cn(
                  "flex h-2 w-2 rounded-full",
                  connectionQuality.level === "excellent" && "bg-[#23A559]",
                  connectionQuality.level === "good" && "bg-amber-400",
                  connectionQuality.level === "poor" && "bg-red-400",
                  connectionQuality.level === "unknown" && "bg-white/30"
                )}
              />
              <span className="text-[10px] text-muted2">
                {connectionQuality.level === "excellent" && "Excelente"}
                {connectionQuality.level === "good" && "Boa"}
                {connectionQuality.level === "poor" && "Instável"}
                {connectionQuality.level === "unknown" && "—"}
              </span>
            </span>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Fechar painel"
            >
              <X className="h-5 w-5" />
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
                    {speakingByUser[p.userId] && !p.muted && (
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
                    {p.muted && <MicOff className="h-4 w-4 text-red-400" />}
                    {p.deafened && <VolumeX className="h-4 w-4 text-red-400" />}
                    {p.camera && <Video className="h-4 w-4 text-[#7383FF]" />}
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
              aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 bg-white/10 text-bodyx"
            >
              {muted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={() => voiceManager.toggleDeafen()}
              aria-label={deafened ? "Ativar áudio" : "Ensurdecer áudio"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 bg-white/10 text-bodyx"
            >
              {deafened ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <Headphones className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={() =>
                voiceManager.toggleCamera().catch(e => toast.error(e.message))
              }
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 bg-white/10 text-bodyx"
            >
              {cameraOn ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={() => voiceManager.leave()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition-transform active:scale-95"
            >
              <PhoneOff className="h-5 w-5" />
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
