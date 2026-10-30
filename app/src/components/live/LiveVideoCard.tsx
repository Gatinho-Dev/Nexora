import { useEffect, useRef } from "react";
import { Crown, MicOff, MonitorUp, UserX, VideoOff } from "lucide-react";
import type { LiveParticipant } from "@contracts/live";

/**
 * Card de participante do Nexora Live: vídeo (ou avatar com iniciais),
 * indicadores de mic/cam/tela, anel verde de VAD (fala real) e remoção
 * pelo host. O áudio remoto é reproduzido aqui, imperceptível.
 */

function initialsOf(nickname: string): string {
  const parts = nickname.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nickname.slice(0, 2).toUpperCase();
}

function participantColor(sessionId: string): string {
  let hash = 0;
  for (const ch of sessionId) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hues = [222, 262, 172, 22, 322, 42, 192, 92];
  return `hsl(${hues[Math.abs(hash) % hues.length]} 70% 45%)`;
}

type Props = {
  participant: LiveParticipant;
  /** Vídeo remoto/recebido (câmera ou tela). Nulo = avatar. */
  videoStream: MediaStream | null;
  /** Áudio remoto — só para outros participantes. */
  audioStream?: MediaStream | null;
  /** VAD real: pessoa está falando agora. */
  speaking: boolean;
  /** Silencia o <video> (necessário para o próprio preview). */
  videoMuted: boolean;
  spotlight?: boolean;
  isSelf?: boolean;
  /** Câmera do participante está ligada mas o vídeo ainda não chegou. */
  videoPending?: boolean;
  onKick?: () => void;
};

export function LiveVideoCard({
  participant,
  videoStream,
  audioStream,
  speaking,
  videoMuted,
  spotlight = false,
  isSelf = false,
  videoPending = false,
  onKick,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const hasVideo =
    !!videoStream && videoStream.getVideoTracks().some(t => t.readyState === "live");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== videoStream) {
      video.srcObject = videoStream;
    }
    if (videoStream) void video.play().catch(() => {});
  }, [videoStream, hasVideo]);

  // Áudio remoto: elemento imperceptível que toca a stream.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioStream && audio.srcObject !== audioStream) {
      audio.srcObject = audioStream;
    }
    if (audioStream) void audio.play().catch(() => {});
  }, [audioStream]);

  const classes = [
    "live-card",
    spotlight ? "live-card--spotlight" : "",
    speaking ? "live-card--speaking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure
      className={classes}
      aria-label={`${participant.nickname}${participant.isHost ? " (host)" : ""}${speaking ? " (falando)" : ""}`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          className="live-card__video"
          autoPlay
          playsInline
          muted={videoMuted}
        />
      ) : (
        <div className="live-card__placeholder">
          <div
            className="live-card__avatar"
            style={{ background: participantColor(participant.sessionId) }}
            aria-hidden
          >
            {initialsOf(participant.nickname)}
          </div>
          {videoPending && (
            <span className="live-card__pending" role="status">
              conectando vídeo…
            </span>
          )}
        </div>
      )}

      {/* Áudio remoto (não renderiza para si mesmo). */}
      {!isSelf && audioStream && <audio ref={audioRef} autoPlay />}

      <figcaption className="live-card__info">
        <span className="live-card__nick">
          {participant.isHost && (
            <Crown size={13} aria-label="Host da sala" className="live-card__crown" />
          )}
          {participant.nickname}
          {isSelf && <span className="live-card__self"> (você)</span>}
        </span>
        <span className="live-card__badges">
          {participant.screen && (
            <span className="live-badge live-badge--screen">
              <MonitorUp size={12} aria-hidden />
              tela
            </span>
          )}
          {participant.muted ? (
            <MicOff size={14} aria-label="Microfone desativado" className="live-badge live-badge--warn" />
          ) : (
            <span
              className={`live-card__voice ${speaking ? "live-card__voice--on" : ""}`}
              aria-hidden
            >
              <span />
              <span />
              <span />
            </span>
          )}
          {!participant.camera && !participant.screen && (
            <VideoOff size={14} aria-label="Câmera desativada" className="live-badge" />
          )}
        </span>
      </figcaption>

      {onKick && (
        <button
          type="button"
          className="live-card__kick"
          onClick={onKick}
          aria-label={`Remover ${participant.nickname} da sala`}
          title={`Remover ${participant.nickname}`}
        >
          <UserX size={14} />
        </button>
      )}
    </figure>
  );
}
