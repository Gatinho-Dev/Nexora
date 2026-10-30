import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Headphones,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Settings,
  TriangleAlert,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { voiceManager } from "@/lib/rtc";
import { openUserSettings } from "@/lib/openUserSettings";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import type { VoiceParticipant } from "@contracts/types";

const EMPTY_PARTICIPANTS: VoiceParticipant[] = [];

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function CallVideo({
  stream,
  local,
  label,
}: {
  stream: MediaStream;
  local: boolean;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const setVoiceSession = useAppStore(state => state.setVoiceSession);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      if (!local) setVoiceSession({ voicePlaybackBlocked: true });
    });
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [local, setVoiceSession, stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={local}
      aria-label={label}
      className={cn("h-full w-full object-cover", local && "scale-x-[-1]")}
    />
  );
}

function Control({
  label,
  active,
  destructive,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full border text-foreground transition-[background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        destructive
          ? "border-red-400/20 bg-red-500 text-white hover:bg-red-400"
          : active
            ? "border-[#7383FF]/55 bg-[#4654D8] text-white hover:bg-[#5362e4]"
            : "border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.1]"
      )}
    >
      {children}
    </button>
  );
}

export function DMCallPanel({
  conversationId,
  title,
  compact,
  onCompactChange,
  onOpenProfile,
}: {
  conversationId: number;
  title: string;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
  onOpenProfile?: (userId: number) => void;
}) {
  const me = trpc.auth.me.useQuery().data;
  const participants = useAppStore(
    state =>
      state.voiceParticipants[`dm:${conversationId}`] ?? EMPTY_PARTICIPANTS
  );
  const phase = useAppStore(state => state.voiceCallPhase);
  const connectionStatus = useAppStore(state => state.voiceConnectionStatus);
  const startedAt = useAppStore(state => state.voiceCallStartedAt);
  const connectedAt = useAppStore(state => state.voiceCallConnectedAt);
  const deadlineAt = useAppStore(state => state.voiceCallDeadlineAt);
  const quality = useAppStore(state => state.voiceQuality);
  const muted = useAppStore(state => state.muted);
  const deafened = useAppStore(state => state.deafened);
  const cameraOn = useAppStore(state => state.cameraOn);
  const screenOn = useAppStore(state => state.screenOn);
  const playbackBlocked = useAppStore(state => state.voicePlaybackBlocked);
  const deviceError = useAppStore(state => state.voiceDeviceError);
  const speaking = useAppStore(state => state.speakingByUser);
  const localVideo = useAppStore(state => state.localVideo);
  const remoteStreams = useAppStore(state => state.remoteStreams);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleParticipants = useMemo(() => {
    if (participants.some(participant => participant.userId === me?.id)) {
      return participants;
    }
    if (!me) return participants;
    return [
      {
        userId: me.id,
        name: me.name ?? me.username ?? "Você",
        avatar: me.avatar,
        muted,
        deafened,
        camera: cameraOn,
        screen: screenOn,
        speaker: true,
      },
      ...participants,
    ];
  }, [cameraOn, deafened, me, muted, participants, screenOn]);
  const hasVideo =
    cameraOn ||
    screenOn ||
    participants.some(user => user.camera || user.screen);
  const phaseLabel = {
    idle: "Preparando",
    creating: "Preparando dispositivos",
    ringing: "Chamando",
    connecting: "Conectando",
    connected: "Conectado",
    reconnecting: "Reconectando",
    ended: "Chamada encerrada",
    failed: "Falha na conexão",
  }[phase];
  const elapsedFrom = connectedAt ?? startedAt;
  const duration = elapsedFrom
    ? formatClock((now - elapsedFrom) / 1_000)
    : "0:00";
  const unansweredLeft =
    phase === "ringing" && deadlineAt
      ? formatClock((deadlineAt - now) / 1_000)
      : null;
  const qualityLabel = {
    excellent: "Excelente",
    good: "Boa",
    poor: "Instável",
    unknown: "Aguardando dados",
  }[quality.level];
  const qualityDetails = [
    quality.rttMs == null ? null : `${quality.rttMs} ms`,
    quality.packetLossPercent == null
      ? null
      : `${quality.packetLossPercent}% perda`,
    quality.candidateType ? quality.candidateType.toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const toggleCamera = () =>
    void voiceManager
      .toggleCamera()
      .catch(error =>
        toast.error(
          error instanceof Error ? error.message : "Câmera indisponível."
        )
      );
  const toggleShare = () =>
    void (
      screenOn
        ? voiceManager.stopScreenShare()
        : voiceManager.startScreenShare()
    ).catch(error =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível compartilhar a tela."
      )
    );

  return (
    <section
      aria-label={`Chamada em ${title}`}
      className="relative shrink-0 overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(120deg,hsl(var(--panel))_0%,rgba(22,24,39,0.98)_58%,rgba(70,84,216,0.13)_100%)] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.035)_inset]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7383FF]/55 to-transparent" />
      <div className="flex min-h-14 items-center gap-3 px-3 sm:px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#7383FF]/25 bg-[#4654D8]/14 text-[#9aa5ff]">
          <Headphones className="h-4.5 w-4.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold">{title}</p>
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                phase === "connected"
                  ? "bg-[hsl(var(--presence-online))]"
                  : phase === "failed"
                    ? "bg-red-400"
                    : "bg-amber-300"
              )}
            />
          </div>
          <p className="truncate text-[11px] text-muted2" aria-live="polite">
            {phaseLabel}
            {phase === "connected" ? ` · ${duration}` : ""}
            {unansweredLeft ? ` · encerra em ${unansweredLeft}` : ""}
            {visibleParticipants.length
              ? ` · ${visibleParticipants.length} ${visibleParticipants.length === 1 ? "participante" : "participantes"}`
              : ""}
          </p>
        </div>

        {!compact && connectionStatus === "connected" && (
          <div
            className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-black/15 px-2.5 py-1.5 text-[11px] text-muted2 sm:flex"
            title={
              qualityDetails || "As métricas aparecerão após receber áudio."
            }
          >
            {quality.level === "poor" ? (
              <WifiOff className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-[hsl(var(--presence-online))]" />
            )}
            {qualityLabel}
          </div>
        )}

        {compact && (
          <div className="hidden -space-x-2 sm:flex" aria-hidden>
            {visibleParticipants.slice(0, 4).map(participant => (
              <Avatar
                key={participant.userId}
                userId={participant.userId}
                name={participant.name}
                src={participant.avatar}
                size="xs"
                showStatus={false}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {compact && (
            <>
              <Control
                label={muted ? "Ativar microfone" : "Silenciar microfone"}
                active={muted}
                onClick={() => voiceManager.toggleMute()}
              >
                {muted ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Control>
              <Control
                label="Desconectar da chamada"
                destructive
                onClick={() => void voiceManager.leave()}
              >
                <PhoneOff className="h-4 w-4" />
              </Control>
            </>
          )}
          <button
            type="button"
            onClick={() => onCompactChange(!compact)}
            aria-label={compact ? "Expandir chamada" : "Recolher chamada"}
            title={compact ? "Expandir chamada" : "Recolher chamada"}
            className="grid h-11 w-11 place-items-center rounded-full text-muted2 transition-colors hover:bg-white/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
          >
            {compact ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!compact && (
        <>
          {(deviceError || playbackBlocked) && (
            <div className="flex min-h-10 items-center justify-between gap-3 border-y border-amber-300/15 bg-amber-300/[0.07] px-4 py-2 text-xs text-amber-100">
              <span className="flex min-w-0 items-center gap-2">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {deviceError ?? "O navegador bloqueou o áudio remoto."}
                </span>
              </span>
              {playbackBlocked && (
                <button
                  type="button"
                  onClick={() => voiceManager.resumeRemotePlayback()}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/15"
                >
                  Liberar áudio
                </button>
              )}
            </div>
          )}

          <div
            className={cn(
              "overflow-y-auto px-3 py-3 sm:px-4",
              hasVideo ? "max-h-[42vh]" : "max-h-52"
            )}
          >
            <div
              className={cn(
                "mx-auto grid max-w-5xl gap-2.5",
                hasVideo
                  ? visibleParticipants.length <= 1
                    ? "max-w-2xl grid-cols-1"
                    : "grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              )}
            >
              {visibleParticipants.map(participant => {
                const isLocal = participant.userId === me?.id;
                const stream = isLocal
                  ? localVideo
                  : (remoteStreams[participant.userId] ?? null);
                const isSpeaking =
                  !!speaking[participant.userId] && !participant.muted;
                return (
                  <button
                    type="button"
                    key={participant.userId}
                    onClick={() => onOpenProfile?.(participant.userId)}
                    className={cn(
                      "group relative min-w-0 overflow-hidden border bg-black/15 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]",
                      hasVideo
                        ? "aspect-video rounded-2xl"
                        : "flex min-h-24 flex-col items-center justify-center rounded-2xl px-2 py-3",
                      isSpeaking
                        ? "border-[hsl(var(--presence-online)/0.8)] shadow-[0_0_0_2px_hsl(var(--presence-online)/0.12)]"
                        : "border-white/[0.07] hover:border-white/[0.14]"
                    )}
                    aria-label={`Abrir perfil de ${participant.name}`}
                  >
                    {hasVideo && stream?.getVideoTracks().length ? (
                      <CallVideo
                        stream={stream}
                        local={isLocal}
                        label={`Vídeo de ${participant.name}`}
                      />
                    ) : (
                      <div
                        className={cn(
                          "relative rounded-full",
                          hasVideo && "absolute inset-0 grid place-items-center"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-full transition-shadow",
                            isSpeaking &&
                              "shadow-[0_0_0_3px_hsl(var(--presence-online)),0_0_20px_hsl(var(--presence-online)/0.25)]"
                          )}
                        >
                          <Avatar
                            userId={participant.userId}
                            name={participant.name}
                            src={participant.avatar}
                            size={hasVideo ? "lg" : "md"}
                            showStatus={false}
                          />
                        </div>
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex min-w-0 items-center gap-1.5",
                        hasVideo
                          ? "absolute inset-x-2 bottom-2 rounded-lg bg-black/50 px-2 py-1 backdrop-blur-sm"
                          : "mt-2 max-w-full"
                      )}
                    >
                      <span className="truncate text-xs font-semibold">
                        {isLocal ? "Você" : participant.name}
                      </span>
                      {participant.muted && (
                        <MicOff className="h-3 w-3 shrink-0 text-red-300" />
                      )}
                      {participant.deafened && (
                        <VolumeX className="h-3 w-3 shrink-0 text-red-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] bg-black/[0.08] px-3 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
            <Control
              label={muted ? "Ativar microfone" : "Silenciar microfone"}
              active={muted}
              onClick={() => voiceManager.toggleMute()}
            >
              {muted ? (
                <MicOff className="h-4.5 w-4.5" />
              ) : (
                <Mic className="h-4.5 w-4.5" />
              )}
            </Control>
            <Control
              label={deafened ? "Ativar áudio" : "Desativar áudio"}
              active={deafened}
              onClick={() => voiceManager.toggleDeafen()}
            >
              {deafened ? (
                <VolumeX className="h-4.5 w-4.5" />
              ) : (
                <Volume2 className="h-4.5 w-4.5" />
              )}
            </Control>
            <Control
              label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
              active={cameraOn}
              onClick={toggleCamera}
            >
              {cameraOn ? (
                <Video className="h-4.5 w-4.5" />
              ) : (
                <VideoOff className="h-4.5 w-4.5" />
              )}
            </Control>
            {typeof navigator !== "undefined" &&
              !!navigator.mediaDevices?.getDisplayMedia && (
                <div className="hidden sm:block">
                  <Control
                    label={
                      screenOn ? "Parar compartilhamento" : "Compartilhar tela"
                    }
                    active={screenOn}
                    onClick={toggleShare}
                  >
                    {screenOn ? (
                      <MonitorX className="h-4.5 w-4.5" />
                    ) : (
                      <MonitorUp className="h-4.5 w-4.5" />
                    )}
                  </Control>
                </div>
              )}
            <Control
              label="Configurações de voz"
              onClick={() => openUserSettings("voice")}
            >
              <Settings className="h-4.5 w-4.5" />
            </Control>
            <Control
              label="Desconectar da chamada"
              destructive
              onClick={() => void voiceManager.leave()}
            >
              <PhoneOff className="h-4.5 w-4.5" />
            </Control>
          </div>
        </>
      )}
    </section>
  );
}
