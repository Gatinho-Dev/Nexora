import { Suspense, lazy, type ReactNode } from "react";
import type { MetalFxPreset } from "metal-fx";
import { usePrefersReducedMotion } from "./useNexoraTheme";

const LazyMetalCta = lazy(() =>
  import("./MetalCtaInner").then(module => ({ default: module.MetalCtaInner }))
);

/**
 * CTA com anel de metal líquido (Libraries.dev `metal-fx`), código dividido
 * para fora do chunk principal. Com movimento reduzido, vira o botão puro.
 */
export function MetalCta({
  children,
  preset = "chromatic",
}: {
  children: ReactNode;
  preset?: MetalFxPreset;
}) {
  const reduceMotion = usePrefersReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <Suspense fallback={children}>
      <LazyMetalCta preset={preset}>{children}</LazyMetalCta>
    </Suspense>
  );
}
