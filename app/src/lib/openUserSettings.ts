export const OPEN_SETTINGS_EVENT = "nexora:open-settings";

/**
 * Abas que podem ser abertas por deep link (`openUserSettings`).
 * Mantido em paridade com o `Tab` do `UserSettingsModal`.
 */
export type SettingsTabPayload =
  | "account"
  | "profile"
  | "identity"
  | "friend-requests"
  | "family"
  | "devices"
  | "security"
  | "standing"
  | "privacy"
  | "sensitive"
  | "my-reports"
  | "appeals"
  | "connections"
  | "support"
  | "appearance"
  | "accessibility"
  | "voice"
  | "notifications"
  | "shortcuts"
  | "language"
  | "activity-privacy"
  | "registered-games"
  | "advanced";

/** Abre as configurações do usuário de qualquer lugar (ex.: YouSheet mobile). */
export function openUserSettings(tab: SettingsTabPayload = "account") {
  window.dispatchEvent(
    new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { tab } })
  );
}
