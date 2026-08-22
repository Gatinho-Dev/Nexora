export type Theme = "dark" | "light" | "system";

const KEY = "nexora-theme";

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "dark"; // dark default
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark =
    theme === "dark" || theme === "system" || (theme === "light" && systemDark);
  root.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#313338" : "#f8fafc");
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function initTheme() {
  applyTheme(getTheme());
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getTheme() === "system") applyTheme("system");
    });
  document.documentElement.classList.add("dark");
}
