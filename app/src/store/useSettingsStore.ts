import { create } from "zustand";
import {
  DEFAULT_CLIENT_SETTINGS,
  parseClientSettings,
  type ClientSettings,
} from "@/lib/clientSettings";

/**
 * Fonte única de verdade das preferências locais do Modal de Configurações.
 *
 * Regras de arquitetura:
 *  - Qualquer aba lê e escreve AQUI (nunca em `useState` local), então trocar
 *    de aba desmonta a árvore e o controle volta já com o valor persistido.
 *  - A escrita é local e síncrona (espelho em localStorage) para a UI responder
 *    no mesmo frame; o envio ao backend é responsabilidade de
 *    `useClientSettingsSync`, que aplica o debounce de 500 ms.
 */

const STORAGE_KEY = "nexora-client-settings";

type SettingsState = {
  settings: ClientSettings;
  /** `true` depois que o servidor (ou o cache local) entregou o estado real. */
  hydrated: boolean;
  /** Aplica um patch parcial e devolve o objeto resultante. */
  patch: (partial: Partial<ClientSettings>) => ClientSettings;
  /** Substitui o objeto inteiro (hidratação do servidor). */
  hydrate: (raw: unknown) => void;
  /** Restaura todos os defaults (usado por "Redefinir configurações"). */
  reset: () => void;
};

function readCache(): Partial<ClientSettings> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<ClientSettings>) : null;
  } catch {
    return null;
  }
}

function writeCache(settings: ClientSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Modo privado / cota cheia: o servidor continua sendo a fonte de verdade.
  }
}

const initialSettings = (): ClientSettings =>
  parseClientSettings(readCache() ?? DEFAULT_CLIENT_SETTINGS);

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: initialSettings(),
  hydrated: false,
  patch: partial => {
    const next = { ...get().settings, ...partial };
    set({ settings: next });
    writeCache(next);
    return next;
  },
  hydrate: raw => {
    const next = parseClientSettings(
      raw && typeof raw === "object" && !Array.isArray(raw) ? raw : DEFAULT_CLIENT_SETTINGS,
    );
    set({ settings: next, hydrated: true });
    writeCache(next);
  },
  reset: () => {
    set({ settings: { ...DEFAULT_CLIENT_SETTINGS } });
    writeCache({ ...DEFAULT_CLIENT_SETTINGS });
  },
}));

/**
 * Atalho para uso fora de componentes: `setSetting("bypassProcessing", true)`.
 */
export function setSetting<K extends keyof ClientSettings>(
  key: K,
  value: ClientSettings[K],
): ClientSettings {
  return useSettingsStore.getState().patch({ [key]: value } as Partial<ClientSettings>);
}
