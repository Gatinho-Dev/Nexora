import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
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
  const hasVideo =
    !!stream &&
    (participant.camera || participant.screen) &&
    stream.getVideoTracks().length > 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = hasVideo ? stream : null;
    if (hasVideo) video.play().catch(() => {});
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream, hasVideo]);

  return (
    <div
      className={cn(
        "voice-participant group relative overflow-hidden rounded-[14px] bg-[#292a31] border border-white/[0.08] transition-[border-color,box-shadow,transform,opacity] duration-200",
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
        <div className="flex h-full w-full items-center justify-center bg-[#2B2D31]">
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
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
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
  const store = useAppStore();
  const roomKey = channelId ? `c:${channelId}` : `dm:${conversationId}`;
  const participants = store.voiceParticipants[roomKey] ?? [];
  const connected = channelId
    ? store.voiceChannelId === channelId
    : store.voiceConversationId === conversationId;
  const connectedElsewhere =
    (store.voiceChannelId !== null && store.voiceChannelId !== channelId) ||
    (store.voiceConversationId !== null &&
      store.voiceConversationId !== conversationId);

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
    isStage && permissions.includes("SPEAK") || permissions.includes("ADMINISTRATOR");
  const audience = isStage ? participants.filter(p => !p.speaker) : [];

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
  const connectionStatus = store.voiceConnectionStatus;
  const connectionLabel = {
    idle: "Desconectado",
    connecting: "Conectando",
    connected: "Conectado",
    reconnecting: "Reconectando",
    failed: "Falha na conexão",
  }[connectionStatus];

  if (!connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#313338] p-8 text-white select-none">
        <div className="rounded-2xl bg-[#2B2D31] p-6 text-[#B5BAC1] border border-black/20">
          <Headphones className="h-12 w-12" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {title}
          </h2>
          <p className="mt-1 text-xs text-[#B5BAC1]">
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
            <p className="text-xs text-[#B5BAC1]">
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
    <div className="flex flex-1 flex-col bg-[#303139] min-h-0 relative select-none">
      <div
        className="flex min-h-11 items-center justify-between border-b border-white/[0.06] bg-[#2b2c33] px-3 sm:px-4"
        role="status"
        aria-live="polite"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
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
        </div>
      </div>

      {store.voicePlaybackBlocked && (
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#2b2c33]/60 px-4 py-2">
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

      {/* Video Grid */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {isStage && (
          <div className="mx-auto mb-4 max-w-3xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#949BA4]">
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
              ? store.localVideo
              : (store.remoteStreams[p.userId] ?? null);
            return (
              <VideoTile
                key={p.userId}
                participant={p}
                stream={stream}
                isLocal={isLocal}
                focused={!!focused}
                onToggleFocus={() => setFocusUserId(focused ? null : p.userId)}
                onOpenProfile={onOpenProfile}
                speaking={!!store.speakingByUser[p.userId] && !p.muted}
              />
            );
          })}
        </div>

        {/* Stage audience strip */}
        {isStage && audience.length > 0 && (
          <div className="mx-auto mt-6 max-w-3xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#949BA4]">
              Audiência ({audience.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {audience.map(p => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => onOpenProfile?.(p.userId)}
                  title={`Ver perfil de ${p.name}`}
                  className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 text-xs text-[#B5BAC1] transition-colors hover:bg-white/10 hover:text-white"
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
        <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] bg-[#292a31]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:gap-3 sm:pb-4">
          {/* Mic */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={store.muted ? "destructive" : "secondary"}
                size="icon"
                className="h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95"
                onClick={() => voiceManager.toggleMute()}
                disabled={amAudience}
                aria-label={
                  store.muted ? "Ativar microfone" : "Silenciar microfone"
                }
                title={store.muted ? "Ativar microfone" : "Silenciar microfone"}
              >
                {store.muted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {amAudience
                ? "Audiência não pode falar"
                : store.muted
                  ? "Ativar microfone"
                  : "Silenciar microfone"}
            </TooltipContent>
          </Tooltip>

          {/* Headphones */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={store.deafened ? "destructive" : "secondary"}
                size="icon"
                className="h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95"
                onClick={() => voiceManager.toggleDeafen()}
                aria-label={
                  store.deafened ? "Ativar áudio" : "Ensurdecer áudio"
                }
                title={store.deafened ? "Ativar áudio" : "Ensurdecer áudio"}
              >
                {store.deafened ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Headphones className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {store.deafened ? "Ativar áudio" : "Ensurdecer áudio"}
            </TooltipContent>
          </Tooltip>

          {/* Camera */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={store.cameraOn ? "default" : "secondary"}
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95",
                  store.cameraOn && "bg-[#5865F2] text-white hover:bg-[#4752C4]"
                )}
                onClick={() =>
                  voiceManager.toggleCamera().catch(e => toast.error(e.message))
                }
                disabled={amAudience}
                aria-label={store.cameraOn ? "Desligar câmera" : "Ligar câmera"}
                title={store.cameraOn ? "Desligar câmera" : "Ligar câmera"}
              >
                {store.cameraOn ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {store.cameraOn ? "Desligar câmera" : "Ligar câmera"}
            </TooltipContent>
          </Tooltip>

          {/* Screen Share */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={store.screenOn ? "default" : "secondary"}
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95",
                  store.screenOn && "bg-[#23A559] text-black hover:bg-[#16a34a]"
                )}
                onClick={() =>
                  store.screenOn
                    ? voiceManager
                        .stopScreenShare()
                        .catch(e => toast.error(e.message))
                    : voiceManager
                        .startScreenShare()
                        .catch(e => toast.error(e.message))
                }
                disabled={amAudience}
                aria-label={
                  store.screenOn
                    ? "Parar compartilhamento"
                    : "Compartilhar tela"
                }
                title={
                  store.screenOn
                    ? "Parar compartilhamento"
                    : "Compartilhar tela"
                }
              >
                {store.screenOn ? (
                  <MonitorX className="h-5 w-5" />
                ) : (
                  <MonitorUp className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {store.screenOn ? "Parar compartilhamento" : "Compartilhar tela"}
            </TooltipContent>
          </Tooltip>

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
