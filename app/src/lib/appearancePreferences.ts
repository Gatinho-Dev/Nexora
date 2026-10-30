import { setTheme, type Theme } from "@/lib/theme";

export type MessageDensity = "cozy" | "compact";

export type AppearancePreferences = {
  theme: Theme;
  messageDensity: MessageDensity;
  uiScale: number;
  messageTextSize: number;
  messageSpacing: number;
};

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: "dark",
  messageDensity: "cozy",
  uiScale: 100,
  messageTextSize: 14,
  messageSpacing: 50,
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export function parseAppearancePreferences(data: Record<string, unknown> | null | undefined): AppearancePreferences {
  const raw = data?.appearance;
  const appearance = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const theme = appearance.theme === "light" || appearance.theme === "system" || appearance.theme === "dark"
    ? appearance.theme
    : DEFAULT_APPEARANCE_PREFERENCES.theme;
  return {
    theme,
    messageDensity: appearance.messageDensity === "compact" ? "compact" : "cozy",
    uiScale: clamp(appearance.uiScale, 75, 150, 100),
    messageTextSize: clamp(appearance.messageTextSize, 12, 24, 14),
    messageSpacing: clamp(appearance.messageSpacing, 0, 100, 50),
  };
}

export function applyAppearancePreferences(preferences: AppearancePreferences) {
  const root = document.documentElement;
  setTheme(preferences.theme);
  root.style.setProperty("--nexora-ui-scale", String(preferences.uiScale / 100));
  root.style.setProperty("--nexora-message-font-size", `${preferences.messageTextSize}px`);
  root.style.setProperty("--nexora-message-spacing", String(preferences.messageSpacing / 100));
  root.classList.toggle("nexora-density-compact", preferences.messageDensity === "compact");
  root.classList.toggle("nexora-density-cozy", preferences.messageDensity === "cozy");
}
