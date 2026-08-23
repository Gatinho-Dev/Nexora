import * as React from "react";

/**
 * Tracks the software keyboard via visualViewport so the composer stays
 * visible and the bottom navigation never floats above the keyboard.
 */
export function useKeyboardOffset(enabled = true): number {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Keyboard height ≈ layout viewport height − visual viewport height,
      // adjusted by the visual viewport's own top offset.
      const kb = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      setOffset(Math.round(kb));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return offset;
}
