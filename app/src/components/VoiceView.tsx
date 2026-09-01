import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
import { realtime } from "@/lib/ws";
import { Avatar } from "./Avatar";
import { UserSettingsModal } from "./modals/UserSettingsModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Video,
  VideoOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Maximize2,
  Minimize2,
  Loader2,
  Settings,
  Wifi,
  WifiOff,
  TriangleAlert,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VoiceParticipant } from "@contracts/types";

function VideoTile({
  participant,
  stream,
  isLocal,
  focused,
  onToggleFocus,
  onOpenProfile,
  speaking,
}: {
  participant: VoiceParticipant;
  stream: MediaStream | null;
  isLocal: boolean;
  focused: boolean;
  onToggleFocus: () => void;
  onOpenProfile?: (userId: number) => void;
  speaking: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const setVoiceSession = useAppStore(state => state.setVoiceSession);
  const hasVideo =
    !!stream &&
    (participant.camera || participant.screen) &&
    stream.getVideoTracks().length > 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = hasVideo ? stream : null;
    if (hasVideo) {
      video.play().catch(() => {
        if (!isLocal) setVoiceSession({ voicePlaybackBlocked: true });
      });
    }
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [hasVideo, isLocal, setVoiceSession, stream]);

  return (
    <div
      className={cn(
        "voice-participant group relative overflow-hidden rounded-[14px] bg-panel border border-white/[0.08] transition-[border-color,box-shadow,transform,opacity] duration-200",
        focused ? "col-span-full row-span-full min-h-[380px]" : "aspect-video",
        speaking && "speaking-glow border-[#3bbd72]"
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "h-full w-full",
            participant.screen ? "object-contain bg-black" : "object-cover"
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-sidebar">
          <button
            type="button"
            onClick={() => onOpenProfile?.(participant.userId)}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#2B2D31]"
            aria-label={`Abrir perfil de ${participant.name}`}
          >
            <Avatar
              userId={participant.userId}
              name={participant.name}
              src={participant.avatar}
              size="xl"
              showStatus={false}
            />
          </button>
        </div>
      )}

      {/* Participant Name & Status Overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 py-2 select-none">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-bold text-white truncate",
              speaking && "text-[#55d98b]"
            )}
          >
            {participant.name}
            {isLocal ? " (você)" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {participant.muted && <MicOff className="h-3.5 w-3.5 text-red-400" />}
          {participant.deafened && (
            <VolumeX className="h-3.5 w-3.5 text-red-400" />
          )}
          {participant.screen && (
            <MonitorUp className="h-3.5 w-3.5 text-[#23A559] animate-pulse" />
          )}
        </div>
      </div>

      {hasVideo && (
        <button
          onClick={onToggleFocus}
          className="touch-show absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
          title={focused ? "Restaurar visualização" : "Expandir stream"}
          aria-label={focused ? "Restaurar visualização" : "Expandir stream"}
        >
          {focused ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

export function VoiceView({
  channelId,
  conversationId,
  serverId,
  title,
  isStage,
  permissions = [],
  onOpenProfile,
}: {
  channelId?: number;
  conversationId?: number;
  serverId?: number;
  title: string;
  isStage?: boolean;
  permissions?: string[];
  onOpenProfile?: (userId: number) => void;
}) {
  const me = trpc.auth.me.useQuery().data;
  // Narrow selectors: the voice grid must not re-render on unrelated store
  // changes (typing ticks, unread counters, etc.).
  const roomKey = channelId ? `c:${channelId}` : `dm:${conversationId}`;
  const participantsMap = useAppStore(s => s.voiceParticipants);
  const participants = participantsMap[roomKey] ?? [];
  const voiceChannelId = useAppStore(s => s.voiceChannelId);
  const voiceConversationId = useAppStore(s => s.voiceConversationId);
  const connected = channelId
    ? voiceChannelId === channelId
    : voiceConversationId === conversationId;
  const connectedElsewhere =
    (voiceChannelId !== null && voiceChannelId !== channelId) ||
    (voiceConversationId !== null &&
      voiceConversationId !== conversationId);
  const connectionStatus = useAppStore(s => s.voiceConnectionStatus);
  const playbackBlocked = useAppStore(s => s.voicePlaybackBlocked);
  const muted = useAppStore(s => s.muted);
  const deafened = useAppStore(s => s.deafened);
  const cameraOn = useAppStore(s => s.cameraOn);
  const screenOn = useAppStore(s => s.screenOn);
  const speakingByUser = useAppStore(s => s.speakingByUser);
  const localVideo = useAppStore(s => s.localVideo);
  const remoteStreams = useAppStore(s => s.remoteStreams);
  const connectionQuality = useAppStore(s => s.voiceQuality);

  const [joining, setJoining] = useState(false);
  const [focusUserId, setFocusUserId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setSpeaker = trpc.server.stageSetSpeaker.useMutation({
    onError: e => toast.error(e.message),
  });

  // ── Stage state ─────────────────────────────────────────────
  const myParticipant = participants.find(p => p.userId === me?.id);
  const amAudience = isStage && !!myParticipant && myParticipant.speaker === false;
  const canSelfPromote =
    (isStage && permissions.includes("SPEAK")) ||
    permissions.includes("ADMINISTRATOR");
  const audience = isStage ? participants.filter(p => !p.speaker) : [];
  const raisedHands = useAppStore(s => s.stageHandsByRoom)[roomKey] ?? [];
  const setStageHands = useAppStore(s => s.setStageHands);
  const myHandRaised = raisedHands.includes(me?.id ?? -1);
  const canManageStage =
    permissions.includes("MANAGE_MESSAGES") || permissions.includes("MANAGE_CHANNELS");

  const toggleHand = () => {
    if (!me || channelId == null) return;
    realtime.send({
      t: "stage:hand",
      channelId,
      raised: !myHandRaised,
    });
    // Optimistic local echo until the broadcast arrives.
    setStageHands(
      roomKey,
      myHandRaised
        ? raisedHands.filter(id => id !== me.id)
        : [...raisedHands, me.id]
    );
  };

  const joinAsSpeaker = async () => {
    if (!me) return;
    try {
      await setSpeaker.mutateAsync({
        channelId: channelId!,
        userId: me.id,
        speaker: true,
      });
    } catch {
      /* toast handled by mutation */
    }
  };

  const stepDownFromStage = async () => {
    if (!me) return;
    try {
      await voiceManager.toggleMute(); // force local mic off before stepping down
    } catch {
      /* ignore */
    }
    await voiceManager.leave();
    try {
      await setSpeaker.mutateAsync({
        channelId: channelId!,
        userId: me.id,
        speaker: false,
      });
    } catch {
      /* toast handled by mutation */
    }
  };

  const join = async () => {
    if (!me) return;
    setJoining(true);
    try {
      await voiceManager.join({
        channelId,
        conversationId,
        serverId,
        myId: me.id,
      });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível entrar na chamada da Nexora."
      );
    } finally {
      setJoining(false);
    }
  };

  const sharingParticipant = participants.find(p => p.screen);
  
  const connectionLabel = {
    idle: "Desconectado",
    connecting: "Conectando",
    connected: "Conectado",
    reconnecting: "Reconectando",
    failed: "Falha na conexão",
  }[connectionStatus];

  if (!connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-chat p-8 text-white select-none">
        <div className="rounded-2xl bg-sidebar p-6 text-muted2 border border-black/20">
          <Headphones className="h-12 w-12" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted2">
            {participants.length > 0
              ? `${participants.length} ${participants.length === 1 ? "pessoa conectada nesta sala da Nexora" : "pessoas conectadas nesta sala da Nexora"}`
              : "Ninguém conectado por aqui ainda"}
          </p>
        </div>

        {participants.length > 0 && (
          <div className="flex -space-x-2 my-1">
            {participants.slice(0, 8).map(p => (
              <button
                key={p.userId}
                type="button"
                onClick={() => onOpenProfile?.(p.userId)}
                className="rounded-full focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                aria-label={`Abrir perfil de ${p.name}`}
              >
                <Avatar
                  userId={p.userId}
                  name={p.name}
                  src={p.avatar}
                  size="md"
                  showStatus={false}
                />
              </button>
            ))}
          </div>
        )}

        {connectedElsewhere ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted2">
              Você já está em outra chamada na Nexora.
            </p>
            <Button
              onClick={join}
              disabled={joining}
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
            >
              {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mudar para esta chamada
            </Button>
          </div>
        ) : (
          <Button
            onClick={join}
            disabled={joining || !me}
            size="lg"
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold px-6"
          >
            {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isStage ? "Entrar como audiência" : "Entrar na chamada de voz"}
          </Button>
        )}
      </div>
    );
  }

  const focused =
    focusUserId !== null
      ? participants.find(p => p.userId === focusUserId)
      : null;
  const visibleParticipants = focused ? [focused] : participants;

  return (
    <div className="flex flex-1 flex-col bg-chat min-h-0 relative select-none text-foreground">
      <div
        className="flex min-h-11 items-center justify-between border-b border-white/[0.06] bg-sidebar px-3 sm:px-4 text-foreground"
        role="status"
        aria-live="polite"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-[#aeb1bd]">
            {participants.length}{" "}
            {participants.length === 1 ? "participante" : "participantes"}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            connectionStatus === "connected"
              ? "text-[#55d98b]"
              : connectionStatus === "failed"
                ? "text-red-400"
                : "text-amber-300"
          )}
        >
          {connectionStatus === "connected" ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : connectionStatus === "failed" ? (
            <TriangleAlert className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          {connectionLabel}
          {connectionStatus === "connected" && (
            <span className="flex items-center gap-1 ml-2">
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
                {connectionQuality.level === "poor" && "Ruim"}
                {connectionQuality.level === "unknown" && "—"}
              </span>
            </span>
          )}
        </div>
      </div>

      {playbackBlocked && (
        <button
          type="button"
          onClick={() => voiceManager.resumeRemotePlayback()}
          className="flex min-h-11 items-center justify-center gap-2 border-b border-amber-300/20 bg-amber-300/10 px-4 text-xs font-semibold text-amber-100 hover:bg-amber-300/15"
          aria-label="Liberar a reprodução do áudio remoto"
        >
          <VolumeX className="h-4 w-4" />
          Clique para liberar o áudio da chamada
        </button>
      )}
      {/* Stage audience banner */}
      {isStage && amAudience && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-sidebar/60 px-4 py-2">
          <p className="text-xs font-medium text-[#aeb1bd]">
            Você está na <span className="font-bold text-white">audiência</span>
            {canSelfPromote
              ? " — você pode subir ao palco para falar."
              : " — somente palestrantes autorizados podem falar."}
          </p>
          {canSelfPromote && (
            <Button
              size="sm"
              disabled={setSpeaker.isPending}
              onClick={joinAsSpeaker}
              className="h-7 bg-[#5865F2] px-3 text-xs font-bold hover:bg-[#4752C4]"
            >
              <Mic className="mr-1 h-3.5 w-3.5" /> Subir ao palco
            </Button>
          )}
          {!canSelfPromote && (
            <Button
              size="sm"
              variant={myHandRaised ? "default" : "secondary"}
              onClick={toggleHand}
              className={cn(
                "h-7 px-3 text-xs font-bold",
                myHandRaised && "bg-[#5865F2] hover:bg-[#4752C4]"
              )}
            >
              ✋ {myHandRaised ? "Mão levantada" : "Levantar a mão"}
            </Button>
          )}
        </div>
      )}
      {/* Live Screen Share Banner */}
      {sharingParticipant && (
        <div className="flex items-center justify-between bg-[#23A559]/15 border-b border-[#23A559]/30 px-4 py-2 text-xs font-bold text-[#23A559]">
          <div className="flex items-center gap-2">
            <MonitorUp className="h-4 w-4 animate-pulse" />
            <span>
              {sharingParticipant.userId === me?.id
                ? "Você está compartilhando a tela na Nexora"
                : `${sharingParticipant.name} está compartilhando a tela`}
            </span>
            <span className="bg-[#23A559] text-black px-1.5 py-0.5 rounded font-extrabold text-[10px]">
              AO VIVO
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFocusUserId(sharingParticipant.userId)}
              className="hover:underline text-xs"
            >
              Foco
            </button>
          </div>
        </div>
      )}

      {/* Stage moderator queue */}
      {isStage && canManageStage && raisedHands.length > 0 && (
        <div className="border-b border-white/[0.06] bg-panel/60 px-4 py-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">
            ✋ Mãos levantadas ({raisedHands.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {raisedHands.map(uid => {
              const p = participants.find(x => x.userId === uid);
              return (
                <span
                  key={uid}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-2 text-xs"
                >
                  <Avatar userId={uid} name={p?.name ?? "?"} src={p?.avatar ?? null} size="xs" showStatus={false} />
                  <span className="max-w-28 truncate font-medium text-bodyx">
                    {p?.name ?? uid}
                  </span>
                  <button
                    title="Promover a palestrante"
                    onClick={() =>
                      channelId != null &&
                      setSpeaker.mutateAsync({ channelId, userId: uid, speaker: true })
                    }
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-400/10"
                  >
                    Promover
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {isStage && (
          <div className="mx-auto mb-4 max-w-3xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">
              Palestrantes
            </p>
          </div>
        )}
        <div
          className={cn(
            "grid gap-4 items-center",
            focused
              ? "h-full grid-cols-1"
              : visibleParticipants.length <= 1
                ? "mx-auto h-full max-w-3xl grid-cols-1"
                : visibleParticipants.length <= 4
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-2 lg:grid-cols-3"
          )}
        >
          {visibleParticipants.map(p => {
            if (!p) return null;
            const isLocal = p.userId === me?.id;
            if (isStage && !p.speaker) return null;
            const stream = isLocal
              ? localVideo
              : (remoteStreams[p.userId] ?? null);
            return (
              <VideoTile
                key={p.userId}
                participant={p}
                stream={stream}
                isLocal={isLocal}
                focused={!!focused}
                onToggleFocus={() => setFocusUserId(focused ? null : p.userId)}
                onOpenProfile={onOpenProfile}
                speaking={!!speakingByUser[p.userId] && !p.muted}
              />
            );
          })}
        </div>

        {/* Stage audience strip */}
        {isStage && audience.length > 0 && (
          <div className="mx-auto mt-6 max-w-3xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">
              Audiência ({audience.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {audience.map(p => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => onOpenProfile?.(p.userId)}
                  title={`Ver perfil de ${p.name}`}
                  className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 text-xs text-muted2 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Avatar
                    userId={p.userId}
                    name={p.name}
                    src={p.avatar}
                    size="xs"
                    showStatus={false}
                  />
                  <span className="max-w-32 truncate font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Interactive Call Controls Toolbar */}
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] bg-panel/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:gap-3 sm:pb-4">
          {/* Mic */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={muted ? "destructive" : "secondary"}
                size="icon"
                className="h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95"
                onClick={() => voiceManager.toggleMute()}
                disabled={amAudience}
                aria-label={
                  muted ? "Ativar microfone" : "Silenciar microfone"
                }
                title={muted ? "Ativar microfone" : "Silenciar microfone"}
              >
                {muted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {amAudience
                ? "Audiência não pode falar"
                : muted
                  ? "Ativar microfone"
                  : "Silenciar microfone"}
            </TooltipContent>
          </Tooltip>

          {/* Headphones */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={deafened ? "destructive" : "secondary"}
                size="icon"
                className="h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95"
                onClick={() => voiceManager.toggleDeafen()}
                aria-label={
                  deafened ? "Ativar áudio" : "Ensurdecer áudio"
                }
                title={deafened ? "Ativar áudio" : "Ensurdecer áudio"}
              >
                {deafened ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Headphones className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {deafened ? "Ativar áudio" : "Ensurdecer áudio"}
            </TooltipContent>
          </Tooltip>

          {/* Camera */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={cameraOn ? "default" : "secondary"}
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95",
                  cameraOn && "bg-[#5865F2] text-white hover:bg-[#4752C4]"
                )}
                onClick={() =>
                  voiceManager.toggleCamera().catch(e => toast.error(e.message))
                }
                disabled={amAudience}
                aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
                title={cameraOn ? "Desligar câmera" : "Ligar câmera"}
              >
                {cameraOn ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {cameraOn ? "Desligar câmera" : "Ligar câmera"}
            </TooltipContent>
          </Tooltip>

          {/* Screen Share — indisponível em navegadores móveis */}
          {typeof navigator !== "undefined" &&
            !!navigator.mediaDevices?.getDisplayMedia && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={screenOn ? "default" : "secondary"}
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95",
                  screenOn && "bg-[#23A559] text-black hover:bg-[#16a34a]"
                )}
                onClick={() =>
                  screenOn
                    ? voiceManager
                        .stopScreenShare()
                        .catch(e => toast.error(e.message))
                    : voiceManager
                        .startScreenShare()
                        .catch(e => toast.error(e.message))
                }
                disabled={amAudience}
                aria-label={
                  screenOn
                    ? "Parar compartilhamento"
                    : "Compartilhar tela"
                }
                title={
                  screenOn
                    ? "Parar compartilhamento"
                    : "Compartilhar tela"
                }
              >
                {screenOn ? (
                  <MonitorX className="h-5 w-5" />
                ) : (
                  <MonitorUp className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {screenOn ? "Parar compartilhamento" : "Compartilhar tela"}
            </TooltipContent>
          </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-12 w-12 rounded-2xl transition-transform active:scale-95"
                onClick={() => setSettingsOpen(true)}
                aria-label="Abrir configurações de voz e vídeo"
                title="Configurações de voz e vídeo"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Configurações de voz e vídeo
            </TooltipContent>
          </Tooltip>

          {/* Step down from stage (speakers only) */}
          {isStage && !amAudience && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-2xl transition-transform active:scale-95"
                  onClick={() => {
                    void stepDownFromStage();
                  }}
                  aria-label="Descer do palco"
                  title="Descer do palco"
                >
                  <MicOff className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Descer do palco</TooltipContent>
            </Tooltip>
          )}

          {/* Leave Call */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="h-12 w-12 rounded-2xl shadow-lg shadow-red-500/20 transition-transform active:scale-95 bg-red-600 hover:bg-red-700"
                onClick={() => voiceManager.leave()}
                aria-label="Desconectar da chamada"
                title="Desconectar da chamada"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Desconectar da chamada</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      <UserSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab="voice"
      />
    </div>
  );
}
