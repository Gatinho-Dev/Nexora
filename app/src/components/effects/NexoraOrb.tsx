import { ThinkingOrb, type OrbSize, type OrbState } from "thinking-orbs";
import { useNexoraTheme, usePrefersReducedMotion } from "./useNexoraTheme";

/**
 * Orbe de "pensando" (Libraries.dev `thinking-orbs`) para estados de
 * carregamento e digitação. Congela com `prefers-reduced-motion`.
 */
export function NexoraOrb({
  state = "working",
  size = 64,
  label = "Carregando",
  speed = 1,
  className,
}: {
  state?: OrbState;
  size?: OrbSize;
  label?: string;
  speed?: number;
  className?: string;
}) {
  const theme = useNexoraTheme();
  const reduceMotion = usePrefersReducedMotion();
  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme={theme}
      speed={speed}
      paused={reduceMotion}
      className={className}
      role="img"
      aria-label={label}
    />
  );
}
