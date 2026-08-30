export const OPEN_SETTINGS_EVENT = "nexora:open-settings";

export type SettingsTabPayload =
  | "account"
  | "profile"
  | "security"
  | "standing"
  | "privacy"
  | "sensitive"
  | "my-reports"
  | "appeals"
  | "connections"
  | "appearance"
  | "accessibility"
  | "voice"
  | "notifications"
  | "shortcuts"
  | "language"
  | "advanced";

/** Abre as configurações do usuário de qualquer lugar (ex.: YouSheet mobile). */
export function openUserSettings(tab: SettingsTabPayload = "account") {
  window.dispatchEvent(
    new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { tab } })
  );
}
