import type { CSSProperties, ReactNode } from "react";
import {
  BorderBeam,
  type BorderBeamColorVariant,
  type BorderBeamSize,
} from "border-beam";
import { useNexoraTheme, usePrefersReducedMotion } from "./useNexoraTheme";

/**
 * Feixe de borda animado (Libraries.dev `border-beam`) nos tons do Nexora.
 * Sem movimento reduzido ou sem JS do efeito: renderiza só o filho.
 */
export function NexoraBeam({
  children,
  size = "pulse-inner",
  colorVariant = "ocean",
  className,
  style,
}: {
  children: ReactNode;
  size?: BorderBeamSize;
  colorVariant?: BorderBeamColorVariant;
  className?: string;
  style?: CSSProperties;
}) {
  const theme = useNexoraTheme();
  const reduceMotion = usePrefersReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <BorderBeam
      size={size}
      colorVariant={colorVariant}
      theme={theme}
      className={className}
      style={style}
    >
      {children}
    </BorderBeam>
  );
}
