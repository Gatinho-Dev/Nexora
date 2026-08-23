import { useEffect, useRef, useState } from "react";
import { calculateRms, manualVadThreshold } from "@/lib/voice/vadMath";

type AudioAnalyserOptions = {
  threshold?: number;
  automatic?: boolean;
  attackMs?: number;
  releaseMs?: number;
  hangoverMs?: number;
  disabled?: boolean;
  onSpeakingChange?: (speaking: boolean) => void;
};

/**
 * Low-churn VAD for local or remote streams. RMS sampling stays outside React;
 * state changes only on voice transitions and the public meter is throttled.
 */
export function useAudioAnalyser(
  stream: MediaStream | null,
  options: AudioAnalyserOptions = {}
) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const callbackRef = useRef(options.onSpeakingChange);

  useEffect(() => {
    callbackRef.current = options.onSpeakingChange;
  }, [options.onSpeakingChange]);

  const {
    threshold = 28,
    automatic = true,
    attackMs = 120,
    releaseMs = 180,
    hangoverMs = 360,
    disabled = false,
  } = options;

  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track || disabled || track.readyState !== "live") {
      const resetFrame = requestAnimationFrame(() => {
        setIsSpeaking(false);
        setVolume(0);
        callbackRef.current?.(false);
      });
      return () => cancelAnimationFrame(resetFrame);
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const context = new AudioContextClass({ latencyHint: "interactive" });
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.35;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    let speaking = false;
    let aboveSince = 0;
    let belowSince = 0;
    let lastVoiceAt = 0;
    let lastMeterAt = 0;
    let noiseFloor = 0.008;

    const publishSpeaking = (next: boolean) => {
      if (speaking === next) return;
      speaking = next;
      setIsSpeaking(next);
      callbackRef.current?.(next);
    };

    const tick = (now: number) => {
      analyser.getFloatTimeDomainData(samples);
      const rms = calculateRms(samples);
      const meter = Math.min(100, Math.round(rms * 700));

      if (!speaking && rms < noiseFloor * 2.2) {
        noiseFloor = noiseFloor * 0.985 + rms * 0.015;
      }
      noiseFloor = Math.max(0.0025, Math.min(noiseFloor, 0.035));

      const manualOpen = manualVadThreshold(threshold);
      const openThreshold = automatic
        ? Math.max(0.012, noiseFloor * 2.8)
        : manualOpen;
      const closeThreshold = automatic
        ? Math.max(0.008, noiseFloor * 1.7)
        : openThreshold * 0.68;

      if (rms >= openThreshold && track.enabled && !track.muted) {
        belowSince = 0;
        lastVoiceAt = now;
        if (!aboveSince) aboveSince = now;
        if (!speaking && now - aboveSince >= attackMs) publishSpeaking(true);
      } else if (rms <= closeThreshold || !track.enabled || track.muted) {
        aboveSince = 0;
        if (!belowSince) belowSince = now;
        if (
          speaking &&
          now - belowSince >= releaseMs &&
          now - lastVoiceAt >= hangoverMs
        ) {
          publishSpeaking(false);
        }
      }

      if (now - lastMeterAt >= 100) {
        lastMeterAt = now;
        setVolume(meter);
      }
      frame = requestAnimationFrame(tick);
    };

    if (context.state === "suspended") context.resume().catch(() => {});
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      publishSpeaking(false);
      source.disconnect();
      analyser.disconnect();
      if (context.state !== "closed") context.close().catch(() => {});
    };
  }, [stream, threshold, automatic, attackMs, releaseMs, hangoverMs, disabled]);

  return { isSpeaking, volume };
}
