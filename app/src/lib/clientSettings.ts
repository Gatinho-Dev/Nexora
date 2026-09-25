/**
 * Preferências locais do Modal de Configurações (paridade Discord).
 *
 * Este módulo é apenas o esquema: ele descreve TODOS os campos graváveis do
 * modal, seus defaults e um parser tolerante. A fonte única de verdade em
 * runtime vive em `useSettingsStore` (Zustand) e é sincronizada com o backend
 * por `useClientSettingsSync` (debounce de 500 ms).
 *
 * O payload inteiro é gravado sob a chave `clientSettings` no blob JSON de
 * `userPreferences` (ver `advanced.profile.updatePreferences`), então nenhuma
 * migration de banco é necessária para adicionar uma nova preferência.
 */

/** Nível de filtro de mídia explícita, independente por contexto. */
export type ExplicitMediaLevel = "block" | "blur" | "allow";

/** Política de bloqueio automático de mensagens diretas. */
export type SpamFilterLevel = "all" | "unknown" | "none";

/** Quem pode enviar pedidos de amizade. */
export type FriendRequestPolicy = "everyone" | "mutuals" | "servers";

/** Detecção automática de atividade de voz (VAD) vs. tecla fixa. */
export type VoiceInputMode = "activity" | "ptt";

export type ClientSettings = {
  // ── Privacidade e segurança ──────────────────────────────────
  explicitMediaFriends: ExplicitMediaLevel;
  explicitMediaUnknown: ExplicitMediaLevel;
  explicitMediaServers: ExplicitMediaLevel;
  spamFilter: SpamFilterLevel;
  friendRequests: FriendRequestPolicy;
  telemetryImprovement: boolean;
  telemetryPersonalization: boolean;
  readReceiptsOverride: boolean;

  // ── Aparência e acessibilidade ───────────────────────────────
  systemContrast: boolean;
  linkEmbeds: boolean;
  showStickers: boolean;
  convertEmoticons: boolean;
  messageGrouping: boolean;

  // ── Voz e vídeo (DSP) ───────────────────────────────────────
  voiceInputMode: VoiceInputMode;
  inputVolume: number;
  outputVolume: number;
  attenuation: number;
  bypassProcessing: boolean;

  // ── Notificações, texto e imagens ────────────────────────────
  suppressSoundWhenFocused: boolean;
  notificationFlash: boolean;
  messagePreview: boolean;

  // ── Avançado ─────────────────────────────────────────────────
  hardwareAcceleration: boolean;
  developerMode: boolean;
  hideCriticalData: boolean;

  // ── Atividade (Rich Presence) ────────────────────────────────
  shareGameActivity: boolean;
  registeredGames: string[];
  gameOverlay: boolean;
};

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  explicitMediaFriends: "blur",
  explicitMediaUnknown: "blur",
  explicitMediaServers: "allow",
  spamFilter: "unknown",
  friendRequests: "everyone",
  telemetryImprovement: true,
  telemetryPersonalization: false,
  readReceiptsOverride: true,

  systemContrast: false,
  linkEmbeds: true,
  showStickers: true,
  convertEmoticons: false,
  messageGrouping: true,

  voiceInputMode: "activity",
  inputVolume: 100,
  outputVolume: 100,
  attenuation: 60,
  bypassProcessing: false,

  suppressSoundWhenFocused: true,
  notificationFlash: true,
  messagePreview: true,

  hardwareAcceleration: true,
  developerMode: false,
  hideCriticalData: false,

  shareGameActivity: true,
  registeredGames: [],
  gameOverlay: false,
};

/** Catálogo exibido na aba "Jogos registrados" (paridade com o scan local). */
export type CatalogGame = {
  id: string;
  name: string;
  executables: string[];
  detected?: boolean;
};

export const REGISTERED_GAME_CATALOG: CatalogGame[] = [
  { id: "counter-strike-2", name: "Counter-Strike 2", executables: ["cs2.exe"] },
  { id: "valorant", name: "VALORANT", executables: ["VALORANT-Win64-Shipping.exe"] },
  { id: "league-of-legends", name: "League of Legends", executables: ["League of Legends.exe"] },
  { id: "minecraft", name: "Minecraft", executables: ["javaw.exe", "minecraft.exe"] },
  { id: "fortnite", name: "Fortnite", executables: ["FortniteClient-Win64-Shipping.exe"] },
  { id: "roblox", name: "Roblox", executables: ["RobloxPlayerBeta.exe"] },
];

const EXPLICIT_MEDIA_LEVELS: ExplicitMediaLevel[] = ["block", "blur", "allow"];
const SPAM_FILTER_LEVELS: SpamFilterLevel[] = ["all", "unknown", "none"];
const FRIEND_REQUEST_POLICIES: FriendRequestPolicy[] = ["everyone", "mutuals", "servers"];
const VOICE_INPUT_MODES: VoiceInputMode[] = ["activity", "ptt"];

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Entradas livres digitadas pelo usuário ("custom:NexoraTest.exe"). */
export const CUSTOM_GAME_PREFIX = "custom:";

export const isCustomGameId = (id: string) => id.startsWith(CUSTOM_GAME_PREFIX);

function parseRegisteredGames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(REGISTERED_GAME_CATALOG.map(game => game.id));
  return value.filter(
    (id): id is string =>
      typeof id === "string" &&
      id.length <= 64 &&
      (known.has(id) ||
        (isCustomGameId(id) && id.slice(CUSTOM_GAME_PREFIX.length).trim().length > 0)),
  );
}

/**
 * Converte o blob desconhecido vindo do servidor em preferências válidas.
 * Campos ausentes ou corrompidos caem no default — nunca quebram o modal.
 */
export function parseClientSettings(raw: unknown): ClientSettings {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    explicitMediaFriends: oneOf(
      source.explicitMediaFriends,
      EXPLICIT_MEDIA_LEVELS,
      DEFAULT_CLIENT_SETTINGS.explicitMediaFriends,
    ),
    explicitMediaUnknown: oneOf(
      source.explicitMediaUnknown,
      EXPLICIT_MEDIA_LEVELS,
      DEFAULT_CLIENT_SETTINGS.explicitMediaUnknown,
    ),
    explicitMediaServers: oneOf(
      source.explicitMediaServers,
      EXPLICIT_MEDIA_LEVELS,
      DEFAULT_CLIENT_SETTINGS.explicitMediaServers,
    ),
    spamFilter: oneOf(source.spamFilter, SPAM_FILTER_LEVELS, DEFAULT_CLIENT_SETTINGS.spamFilter),
    friendRequests: oneOf(
      source.friendRequests,
      FRIEND_REQUEST_POLICIES,
      DEFAULT_CLIENT_SETTINGS.friendRequests,
    ),
    telemetryImprovement: bool(
      source.telemetryImprovement,
      DEFAULT_CLIENT_SETTINGS.telemetryImprovement,
    ),
    telemetryPersonalization: bool(
      source.telemetryPersonalization,
      DEFAULT_CLIENT_SETTINGS.telemetryPersonalization,
    ),
    readReceiptsOverride: bool(
      source.readReceiptsOverride,
      DEFAULT_CLIENT_SETTINGS.readReceiptsOverride,
    ),

    systemContrast: bool(source.systemContrast, DEFAULT_CLIENT_SETTINGS.systemContrast),
    linkEmbeds: bool(source.linkEmbeds, DEFAULT_CLIENT_SETTINGS.linkEmbeds),
    showStickers: bool(source.showStickers, DEFAULT_CLIENT_SETTINGS.showStickers),
    convertEmoticons: bool(source.convertEmoticons, DEFAULT_CLIENT_SETTINGS.convertEmoticons),
    messageGrouping: bool(source.messageGrouping, DEFAULT_CLIENT_SETTINGS.messageGrouping),

    voiceInputMode: oneOf(
      source.voiceInputMode,
      VOICE_INPUT_MODES,
      DEFAULT_CLIENT_SETTINGS.voiceInputMode,
    ),
    inputVolume: clamp(source.inputVolume, 0, 200, DEFAULT_CLIENT_SETTINGS.inputVolume),
    outputVolume: clamp(source.outputVolume, 0, 200, DEFAULT_CLIENT_SETTINGS.outputVolume),
    attenuation: clamp(source.attenuation, 0, 100, DEFAULT_CLIENT_SETTINGS.attenuation),
    bypassProcessing: bool(source.bypassProcessing, DEFAULT_CLIENT_SETTINGS.bypassProcessing),

    suppressSoundWhenFocused: bool(
      source.suppressSoundWhenFocused,
      DEFAULT_CLIENT_SETTINGS.suppressSoundWhenFocused,
    ),
    notificationFlash: bool(source.notificationFlash, DEFAULT_CLIENT_SETTINGS.notificationFlash),
    messagePreview: bool(source.messagePreview, DEFAULT_CLIENT_SETTINGS.messagePreview),

    hardwareAcceleration: bool(
      source.hardwareAcceleration,
      DEFAULT_CLIENT_SETTINGS.hardwareAcceleration,
    ),
    developerMode: bool(source.developerMode, DEFAULT_CLIENT_SETTINGS.developerMode),
    hideCriticalData: bool(source.hideCriticalData, DEFAULT_CLIENT_SETTINGS.hideCriticalData),

    shareGameActivity: bool(
      source.shareGameActivity,
      DEFAULT_CLIENT_SETTINGS.shareGameActivity,
    ),
    registeredGames: parseRegisteredGames(source.registeredGames),
    gameOverlay: bool(source.gameOverlay, DEFAULT_CLIENT_SETTINGS.gameOverlay),
  };
}

/** Chave usada dentro do blob `userPreferences.data`. */
export const CLIENT_SETTINGS_KEY = "clientSettings";
