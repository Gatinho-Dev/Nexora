import { useEffect, useState, type CSSProperties } from "react";
import { Liquid } from "liquid-gooey";
import { usePrefersReducedMotion } from "./useNexoraTheme";

const BLOBS = [
  { left: "4%", top: "12%", size: 220, dx: 70, dy: 46, speed: 0.16, phase: 0 },
  { left: "58%", top: "2%", size: 170, dx: 60, dy: 58, speed: 0.12, phase: 1.7 },
  { left: "78%", top: "52%", size: 240, dx: 76, dy: 52, speed: 0.14, phase: 3.4 },
  { left: "28%", top: "58%", size: 150, dx: 56, dy: 64, speed: 0.18, phase: 5.1 },
];

/**
 * Fundo decorativo de gosma animada (Libraries.dev `liquid-gooey`) para a
 * hero da landing. Deriva na rAF; some com `prefers-reduced-motion`.
 */
export function GooeyBackdrop({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setTime((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        ...style,
      }}
    >
      <Liquid
        fill="rgba(99, 102, 241, 0.4)"
        shadow="0 0 60px 10px rgba(99, 102, 241, 0.35)"
        blur={10}
        contrast={18}
        waviness={28}
        filterPadding={64}
        style={{ position: "absolute", inset: 0 }}
      >
        {BLOBS.map((blob, index) => (
          <Liquid.Item
            key={index}
            x={Math.sin(time * blob.speed + blob.phase) * blob.dx}
            y={Math.cos(time * blob.speed * 0.8 + blob.phase) * blob.dy}
            transition="smooth"
          >
            <div
              style={{
                position: "absolute",
                left: blob.left,
                top: blob.top,
                width: blob.size,
                height: blob.size,
                borderRadius: "50%",
              }}
            />
          </Liquid.Item>
        ))}
      </Liquid>
    </div>
  );
}
