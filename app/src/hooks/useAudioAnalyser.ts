import { useEffect, useState } from "react";

/**
 * Hook to analyze audio levels (Voice Activity Detection - VAD) for a MediaStream using Web Audio API AnalyserNode.
 * Returns boolean indicating if the user is speaking and current numeric audio volume.
 */
export function useAudioAnalyser(
  stream: MediaStream | null,
  options?: { threshold?: number }
) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const threshold = options?.threshold ?? 15; // sensitivity threshold

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      const resetFrame = requestAnimationFrame(() => {
        setIsSpeaking(false);
        setVolume(0);
      });
      return () => cancelAnimationFrame(resetFrame);
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (
      !audioTrack ||
      !audioTrack.enabled ||
      audioTrack.readyState !== "live"
    ) {
      const resetFrame = requestAnimationFrame(() => {
        setIsSpeaking(false);
        setVolume(0);
      });
      return () => cancelAnimationFrame(resetFrame);
    }

    let animationFrameId: number;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedVol = Math.round(average);

        setVolume(normalizedVol);
        setIsSpeaking(normalizedVol > threshold);

        animationFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch {
      animationFrameId = requestAnimationFrame(() => {
        setIsSpeaking(false);
        setVolume(0);
      });
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (source) source.disconnect();
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }
    };
  }, [stream, threshold]);

  return { isSpeaking, volume };
}
