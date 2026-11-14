import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { ImageGenerationHandle } from "img-fx";

const ImageGeneration = lazy(() =>
  import("img-fx").then(module => ({ default: module.ImageGeneration }))
);

function LoadingPulse() {
  return (
    <div
      className="h-8 w-8 animate-pulse rounded-full bg-white/20"
      aria-hidden
    />
  );
}

/**
 * Revelação "materializando" a foto (Libraries.dev `img-fx`): shader de
 * mosaico gera a imagem uma vez e a mantém visível. Usado na abertura do
 * visualizador fullscreen; depois chama `onRevealed` e o <img> interativo
 * (zoom/pan) assume.
 */
export function MosaicReveal({
  src,
  borderRadius = 12,
  onRevealed,
}: {
  src: string;
  borderRadius?: number;
  onRevealed: () => void;
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const ref = useRef<ImageGenerationHandle>(null);

  useEffect(() => {
    let live = true;
    const probe = new Image();
    probe.onload = () => {
      if (!live) return;
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const scale = Math.min(
        1,
        vw / probe.naturalWidth,
        vh / probe.naturalHeight
      );
      setDims({
        w: Math.max(1, Math.round(probe.naturalWidth * scale)),
        h: Math.max(1, Math.round(probe.naturalHeight * scale)),
      });
    };
    probe.onerror = () => {
      if (live) onRevealed();
    };
    probe.src = src;
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    if (!dims) return;
    const frame = requestAnimationFrame(() => {
      ref.current?.triggerReveal({ hold: "manual" });
    });
    return () => cancelAnimationFrame(frame);
  }, [dims]);

  if (!dims) return <LoadingPulse />;

  return (
    <Suspense fallback={<LoadingPulse />}>
      <ImageGeneration
        ref={ref}
        preset="pixels-organic"
        images={[src]}
        theme="auto"
        revealInitialDelay={0}
        borderRadius={borderRadius}
        onCycle={event => {
          if (event.phase === "visible") onRevealed();
        }}
      >
        <div
          style={{ width: dims.w, height: dims.h, borderRadius }}
        />
      </ImageGeneration>
    </Suspense>
  );
}
