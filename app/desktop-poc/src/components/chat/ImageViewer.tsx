import { useEffect, useRef, useState } from "react";
import { X, Download } from "lucide-react";

/**
 * Visualizador fullscreen de imagem (mobile-first): pinch-zoom, duplo toque,
 * arrastar quando ampliado e fechar por botão/backdrop. Sem dependências.
 */
export function ImageViewer({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const pinch = useRef<{
    startDist: number;
    startScale: number;
    startOffset: { x: number; y: number };
    lastCenter: { x: number; y: number };
    pointers: Map<number, { x: number; y: number }>;
    lastTapTime: number;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pinch.current ?? {
      startDist: 0,
      startScale: scale,
      startOffset: offset,
      lastCenter: { x: e.clientX, y: e.clientY },
      pointers: new Map(),
      lastTapTime: 0,
    };
    p.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.pointers.size === 2) {
      const [a, b] = [...p.pointers.values()];
      p.startDist = dist(a, b);
      p.startScale = scale;
      p.startOffset = offset;
    }
    if (p.pointers.size === 1) {
      const now = Date.now();
      if (now - p.lastTapTime < 280) {
        // Duplo toque: alterna zoom 1x ↔ 2.5x no ponto tocado.
        if (scale > 1) reset();
        else setScale(2.5);
        p.lastTapTime = 0;
      } else {
        p.lastTapTime = now;
      }
    }
    pinch.current = p;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pinch.current;
    if (!p || !p.pointers.has(e.pointerId)) return;
    p.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.pointers.size >= 2 && p.startDist > 0) {
      const [a, b] = [...p.pointers.values()];
      const nextScale = Math.min(
        6,
        Math.max(1, p.startScale * (dist(a, b) / p.startDist))
      );
      setScale(nextScale);
      if (nextScale === 1) setOffset({ x: 0, y: 0 });
    } else if (p.pointers.size === 1 && scale > 1) {
      const dx = e.clientX - p.lastCenter.x;
      const dy = e.clientY - p.lastCenter.y;
      p.lastCenter = { x: e.clientX, y: e.clientY };
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    } else if (p.pointers.size === 1) {
      p.lastCenter = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = pinch.current;
    if (!p) return;
    p.pointers.delete(e.pointerId);
    if (p.pointers.size < 2) p.startDist = 0;
    if (p.pointers.size === 0) pinch.current = null;
    if (scale === 1) setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Imagem: ${alt}`}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 animate-in fade-in duration-150"
      onClick={() => {
        if (scale === 1) onClose();
      }}
    >
      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+10px)] z-10 flex gap-2">
        <a
          href={src}
          download={alt}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          aria-label="Baixar imagem"
          title="Baixar"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors active:bg-white/20"
        >
          <Download className="h-5 w-5" />
        </a>
        <button
          onClick={onClose}
          aria-label="Fechar visualizador"
          title="Fechar"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors active:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!loaded && (
        <div
          className="absolute h-8 w-8 animate-pulse rounded-full bg-white/20"
          aria-hidden
        />
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        draggable={false}
        className="max-h-full max-w-full select-none touch-none transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {scale > 1 && (
        <button
          onClick={e => {
            e.stopPropagation();
            reset();
          }}
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm active:bg-white/20"
        >
          Ver em tamanho normal
        </button>
      )}
    </div>
  );
}
