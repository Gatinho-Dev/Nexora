import type { ReactNode } from "react";
import { MetalFx, type MetalFxPreset } from "metal-fx";
import { useNexoraTheme } from "./useNexoraTheme";

/**
 * Miolo do CTA de metal: importa `metal-fx` de verdade (carregado via lazy
 * pelo `MetalCta`, fora do chunk principal). Sem WebGL2 a lib renderiza o
 * filho puro — nunca quebra.
 */
export function MetalCtaInner({
  children,
  preset = "chromatic",
}: {
  children: ReactNode;
  preset?: MetalFxPreset;
}) {
  const theme = useNexoraTheme();
  return (
    <MetalFx variant="button" preset={preset} theme={theme}>
      {children}
    </MetalFx>
  );
}
