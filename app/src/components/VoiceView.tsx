import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { Avatar } from "./Avatar";
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
}: {
  participant: VoiceParticipant;
  stream: MediaStream | null;
  isLocal: boolean;
  focused: boolean;
  onToggleFocus: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isSpeaking } = useAudioAnalyser(stream);
  const hasVideo =
    !!stream &&
    (participant.camera || participant.screen) &&
    stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-[#2B2D31] border border-white/10 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 shadow-xl",
        focused ? "col-span-full row-span-full min-h-[380px]" : "aspect-video",
        isSpeaking && "speaking-glow border-[#23A559]"
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "h-full w-full",
            participant.screen ? "object-contain bg-black" : "object-cover"
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#2B2D31]">
          <Avatar
            userId={participant.userId}
            name={participant.name}
            src={participant.avatar}
            size="xl"
            showStatus={false}
          />
        </div>
      )}

      {/* Participant Name & Status Overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 py-2 select-none">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-bold text-white truncate",
              isSpeaking && "text-[#23A559]"
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
          className="absolute top-3 right-3 rounded-lg bg-black/60 backdrop-blur-xs p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
          title={focused ? "Restaurar visualização" : "Expandir stream"}
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
}: {
  channelId?: number;
  conversationId?: number;
  serverId?: number;
  title: string;
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
              <Avatar
                key={p.userId}
                userId={p.userId}
                name={p.name}
                src={p.avatar}
                size="md"
                showStatus={false}
              />
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
            Entrar na chamada de voz
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
    <div className="flex flex-1 flex-col bg-[#313338] min-h-0 relative select-none">
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
        <div
          className={cn(
            "grid gap-4 h-full items-center",
            focused
              ? "grid-cols-1"
              : visibleParticipants.length <= 1
                ? "grid-cols-1 max-w-3xl mx-auto"
                : visibleParticipants.length <= 4
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-2 lg:grid-cols-3"
          )}
        >
          {visibleParticipants.map(p => {
            if (!p) return null;
            const isLocal = p.userId === me?.id;
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
              />
            );
          })}
        </div>
      </div>

      {/* Floating Interactive Call Controls Toolbar */}
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center justify-center gap-3 pb-6 pt-3 bg-gradient-to-t from-[#313338] via-[#313338]/80 to-transparent">
          {/* Mic */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={store.muted ? "destructive" : "secondary"}
                size="icon"
                className="h-12 w-12 rounded-2xl shadow-lg transition-transform active:scale-95"
                onClick={() => voiceManager.toggleMute()}
              >
                {store.muted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {store.muted ? "Ativar microfone" : "Silenciar microfone"}
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

          {/* Leave Call */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="h-12 w-12 rounded-2xl shadow-lg shadow-red-500/20 transition-transform active:scale-95 bg-red-600 hover:bg-red-700"
                onClick={() => voiceManager.leave()}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Desconectar da chamada</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
