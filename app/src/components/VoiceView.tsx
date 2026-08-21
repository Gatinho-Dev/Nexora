import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { voiceManager } from "@/lib/rtc";
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
  const hasVideo = !!stream && (participant.camera || participant.screen) && stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg bg-black/60 border border-border",
        focused ? "col-span-full row-span-full min-h-[320px]" : "aspect-video",
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn("h-full w-full", participant.screen ? "object-contain" : "object-cover")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar
            user={{ id: participant.userId, name: participant.name, avatar: participant.avatar }}
            size="xl"
            showStatus={false}
          />
        </div>
      )}

      {/* Nome + indicadores */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-1.5">
        <span className="text-xs font-medium text-white truncate">{participant.name}{isLocal ? " (você)" : ""}</span>
        <div className="ml-auto flex items-center gap-1">
          {participant.muted && <MicOff className="h-3.5 w-3.5 text-red-400" />}
          {participant.deafened && <VolumeX className="h-3.5 w-3.5 text-red-400" />}
          {participant.screen && <MonitorUp className="h-3.5 w-3.5 text-green-400" />}
        </div>
      </div>

      {hasVideo && (
        <button
          onClick={onToggleFocus}
          className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
          title={focused ? "Restaurar" : "Expandir"}
        >
          {focused ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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
    (store.voiceConversationId !== null && store.voiceConversationId !== conversationId);

  const [joining, setJoining] = useState(false);
  const [focusUserId, setFocusUserId] = useState<number | null>(null);

  const join = async () => {
    if (!me) return;
    setJoining(true);
    try {
      await voiceManager.join({ channelId, conversationId, serverId, myId: me.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível entrar na chamada de voz.");
    } finally {
      setJoining(false);
    }
  };

  const sharingParticipant = participants.find((p) => p.screen);

  if (!connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[var(--chat-bg)] p-8">
        <div className="rounded-full bg-primary/10 p-6">
          <Headphones className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {participants.length > 0
              ? `${participants.length} ${participants.length === 1 ? "pessoa conectada" : "pessoas conectadas"}`
              : "Ninguém por aqui ainda"}
          </p>
        </div>
        {participants.length > 0 && (
          <div className="flex -space-x-2">
            {participants.slice(0, 8).map((p) => (
              <Avatar
                key={p.userId}
                user={{ id: p.userId, name: p.name, avatar: p.avatar }}
                size="md"
                showStatus={false}
              />
            ))}
          </div>
        )}
        {connectedElsewhere ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">Você já está em outra chamada.</p>
            <Button onClick={join} disabled={joining}>
              {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mudar para esta chamada
            </Button>
          </div>
        ) : (
          <Button onClick={join} disabled={joining || !me} size="lg">
            {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar na chamada de voz
          </Button>
        )}
      </div>
    );
  }

  const focused = focusUserId !== null ? participants.find((p) => p.userId === focusUserId) : null;
  const visibleParticipants = focused ? [focused] : participants;

  return (
    <div className="flex flex-1 flex-col bg-black/40 min-h-0">
      {sharingParticipant && (
        <div className="flex items-center gap-2 bg-green-600/20 px-4 py-1.5 text-xs text-green-400">
          <MonitorUp className="h-3.5 w-3.5" />
          {sharingParticipant.userId === me?.id
            ? "Você está compartilhando a tela"
            : `${sharingParticipant.name} está compartilhando a tela`}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div
          className={cn(
            "grid gap-3 h-full",
            focused
              ? "grid-cols-1"
              : visibleParticipants.length <= 1
                ? "grid-cols-1 max-w-2xl mx-auto"
                : visibleParticipants.length <= 4
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-2 lg:grid-cols-3",
          )}
        >
          {visibleParticipants.map((p) => {
            if (!p) return null;
            const isLocal = p.userId === me?.id;
            const stream = isLocal ? store.localVideo : (store.remoteStreams[p.userId] ?? null);
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

      {/* Controles */}
      <div className="flex items-center justify-center gap-2 pb-6 pt-2">
        <Button
          variant={store.muted ? "destructive" : "secondary"}
          size="icon"
          className="h-11 w-11 rounded-full"
          title={store.muted ? "Ativar microfone" : "Silenciar"}
          onClick={() => voiceManager.toggleMute()}
        >
          {store.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          variant={store.deafened ? "destructive" : "secondary"}
          size="icon"
          className="h-11 w-11 rounded-full"
          title={store.deafened ? "Ativar áudio" : "Ensurdecer"}
          onClick={() => voiceManager.toggleDeafen()}
        >
          {store.deafened ? <VolumeX className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </Button>
        <Button
          variant={store.cameraOn ? "default" : "secondary"}
          size="icon"
          className="h-11 w-11 rounded-full"
          title={store.cameraOn ? "Desligar câmera" : "Ligar câmera"}
          onClick={() => voiceManager.toggleCamera().catch((e) => toast.error(e.message))}
        >
          {store.cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={store.screenOn ? "default" : "secondary"}
          size="icon"
          className="h-11 w-11 rounded-full"
          title={store.screenOn ? "Parar compartilhamento" : "Compartilhar tela"}
          onClick={() =>
            store.screenOn
              ? voiceManager.stopScreenShare().catch((e) => toast.error(e.message))
              : voiceManager.startScreenShare().catch((e) => toast.error(e.message))
          }
        >
          {store.screenOn ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="h-11 w-11 rounded-full"
          title="Desconectar"
          onClick={() => voiceManager.leave()}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
