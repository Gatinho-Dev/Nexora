import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { getDevicePrefs, type DevicePrefs } from "@/lib/devices";

type SinkableAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function StreamActivity({
  userId,
  stream,
  prefs,
  disabled,
}: {
  userId: number;
  stream: MediaStream;
  prefs: DevicePrefs;
  disabled?: boolean;
}) {
  const setSpeaking = useAppStore(state => state.setSpeaking);
  const onSpeakingChange = useCallback(
    (speaking: boolean) => setSpeaking(userId, speaking),
    [setSpeaking, userId]
  );
  useAudioAnalyser(stream, {
    automatic: prefs.inputSensitivityMode !== "manual",
    threshold: prefs.inputSensitivity,
    disabled,
    onSpeakingChange,
  });

  useEffect(
    () => () => {
      setSpeaking(userId, false);
    },
    [setSpeaking, userId]
  );
  return null;
}

function RemoteAudio({
  userId,
  stream,
  deafened,
  outputId,
}: {
  userId: number;
  stream: MediaStream;
  deafened: boolean;
  outputId?: string;
}) {
  const audioRef = useRef<SinkableAudioElement>(null);
  const setVoiceSession = useAppStore(state => state.setVoiceSession);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = stream;

    let disposed = false;
    const play = async () => {
      try {
        if (outputId && audio.setSinkId) await audio.setSinkId(outputId);
        await audio.play();
        if (!disposed) setVoiceSession({ voicePlaybackBlocked: false });
      } catch (error) {
        if (!disposed) {
          console.warn(
            "[VOICE] Reprodução remota aguardando interação",
            userId,
            error
          );
          setVoiceSession({ voicePlaybackBlocked: true });
        }
      }
    };

    void play();
    const resume = () => void play();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    window.addEventListener("nexora:resume-voice-playback", resume);
    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      window.removeEventListener("nexora:resume-voice-playback", resume);
      audio.pause();
      audio.srcObject = null;
    };
  }, [stream, outputId, setVoiceSession, userId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = deafened;
  }, [deafened]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      aria-label={`Áudio remoto do participante ${userId}`}
    />
  );
}

export function VoiceMediaRenderer({ myUserId }: { myUserId: number }) {
  const localStream = useAppStore(state => state.localStream);
  const remoteStreams = useAppStore(state => state.remoteStreams);
  const muted = useAppStore(state => state.muted);
  const deafened = useAppStore(state => state.deafened);
  const [prefs, setPrefs] = useState(getDevicePrefs);

  useEffect(() => {
    const update = (event: Event) => {
      setPrefs((event as CustomEvent<DevicePrefs>).detail ?? getDevicePrefs());
    };
    window.addEventListener("nexora:device-preferences", update);
    return () =>
      window.removeEventListener("nexora:device-preferences", update);
  }, []);

  return (
    <div className="sr-only" aria-hidden="true">
      {localStream && (
        <StreamActivity
          userId={myUserId}
          stream={localStream}
          prefs={prefs}
          disabled={muted}
        />
      )}
      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <div key={userId}>
          <RemoteAudio
            userId={Number(userId)}
            stream={stream}
            deafened={deafened}
            outputId={prefs.audioOutputId}
          />
          <StreamActivity
            userId={Number(userId)}
            stream={stream}
            prefs={prefs}
          />
        </div>
      ))}
    </div>
  );
}
