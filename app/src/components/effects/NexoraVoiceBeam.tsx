import type { CSSProperties, ReactNode } from "react";
import { VoiceBeam, type VoiceBeamLevel } from "voice-glow";
import { useNexoraTheme, usePrefersReducedMotion } from "./useNexoraTheme";

/**
 * Feixe de voz na borda inferior (Libraries.dev `voice-glow`).
 * Aceita `level` (0..1 ou getter amostrado pelo driver) e/ou `stream`
 * (MediaStream real, analisado pela própria lib).
 */
export function NexoraVoiceBeam({
  children,
  className,
  style,
  level,
  stream,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  level?: VoiceBeamLevel;
  stream?: MediaStream;
}) {
  const theme = useNexoraTheme();
  const reduceMotion = usePrefersReducedMotion();
  if (reduceMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <VoiceBeam
      type="default"
      theme={theme}
      colorVariant="ocean"
      level={level}
      stream={stream}
      className={className}
      style={style}
    >
      {children}
    </VoiceBeam>
  );
}
