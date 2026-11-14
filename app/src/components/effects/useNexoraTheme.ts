import { useEffect, useState } from "react";

function readTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Tema visual do app Nexora (classe `.dark` no <html>, Tailwind class-based).
 * Bibliotecas Libraries.dev com theme="auto" leem prefers-color-scheme do
 * sistema — aqui passamos o tema explícito para acompanhar o app.
 */
export function useNexoraTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">(readTheme);
  useEffect(() => {
    const update = () => setTheme(readTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function isWebGL2Supported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}
