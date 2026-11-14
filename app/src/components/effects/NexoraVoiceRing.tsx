import { VoiceRing, type VoiceOrbState } from "voice-ring";
import { useNexoraTheme, usePrefersReducedMotion } from "./useNexoraTheme";

/**
 * Anel de voz animado (Libraries.dev `voice-ring`) para estados de chamada.
 * Reage a `stream` real quando fornecido; caso contrário, animação ambiente.
 */
export function NexoraVoiceRing({
  size = 40,
  state = "listening",
  stream,
  className,
  label = "Atividade de voz",
}: {
  size?: number;
  state?: VoiceOrbState;
  stream?: MediaStream;
  className?: string;
  label?: string;
}) {
  const theme = useNexoraTheme();
  const reduceMotion = usePrefersReducedMotion();
  return (
    <VoiceRing
      size={size}
      state={state}
      stream={stream}
      theme={theme}
      paused={reduceMotion}
      className={className}
      role="img"
      aria-label={label}
    />
  );
}
