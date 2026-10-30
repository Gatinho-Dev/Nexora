/**
 * Store das preferências do Cider (zustand).
 *
 * É a **fonte única de verdade** da aparência e do comportamento do player web.
 * Toda escrita persiste em `localStorage` e reaplica a aparência no `<html>`, na
 * mesma ordem: primeiro o estado, depois o DOM.
 *
 * A chave é própria (`nexora-cider-settings`) e o prefixo das variáveis é
 * `--cider-`: o Cider é um aplicativo rodando dentro do site da Nexora, e o
 * tema dele não pode mexer no tema da hospedeira.
 */

import { useEffect } from "react";
import { create } from "zustand";

import { applyCiderAppearance, type AppliedAppearance } from "./apply";
import {
  allThemes,
  createCustomTheme,
  exportThemeJson,
  importThemeJson,
  normalizeTheme,
  type AppearanceTheme,
} from "./themes";
import {
  CIDER_SETTINGS_KEY,
  DEFAULT_CIDER_SETTINGS,
  parseCiderSettings,
  type CiderSettings,
} from "./types";

function readStorage(): Partial<CiderSettings> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CIDER_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Partial<CiderSettings>) : null;
  } catch {
    return null;
  }
}

function writeStorage(settings: CiderSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CIDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Modo privado ou cota cheia: a sessão continua, só não persiste.
  }
}

/** Lê o documento inicial: o `localStorage` com o parser tolerante por cima. */
export function initialCiderSettings(): CiderSettings {
  return parseCiderSettings(readStorage() ?? DEFAULT_CIDER_SETTINGS);
}

/**
 * Aplica um patch e devolve o documento resultante.
 *
 * Exportada porque a regra é testável sem DOM: recebe o documento atual e
 * devolve o próximo, sem tocar na store.
 */
export function mergeCiderSettings(current: CiderSettings, partial: Partial<CiderSettings>): CiderSettings {
  return { ...current, ...partial };
}

/**
 * Remove um tema do usuário. Se ele estava ativo, a preferência volta para o
 * tema embutido padrão — apagar um tema não pode deixar a interface sem tema.
 */
export function settingsWithoutTheme(current: CiderSettings, id: string): CiderSettings {
  const customThemes = current.customThemes.filter((theme) => theme.id !== id);
  const theme = current.theme === id ? DEFAULT_CIDER_SETTINGS.theme : current.theme;
  return { ...current, customThemes, theme };
}

interface CiderSettingsState {
  settings: CiderSettings;
  /** Temas disponíveis: embutidos + do usuário. */
  themes: AppearanceTheme[];
  appearance: AppliedAppearance | null;
  hydrated: boolean;
  patch: (partial: Partial<CiderSettings>) => CiderSettings;
  replace: (settings: CiderSettings) => void;
  reset: () => void;
  selectTheme: (id: string) => void;
  createTheme: (input: Parameters<typeof createCustomTheme>[0]) => AppearanceTheme;
  saveTheme: (theme: AppearanceTheme) => AppearanceTheme;
  deleteTheme: (id: string) => void;
  importTheme: (text: string) => AppearanceTheme;
  exportTheme: (id: string) => string;
  apply: () => AppliedAppearance | null;
}

const initial = initialCiderSettings();

export const useCiderSettings = create<CiderSettingsState>((set, get) => ({
  settings: initial,
  themes: allThemes(initial.customThemes),
  appearance: null,
  hydrated: false,

  patch: (partial) => {
    const next = mergeCiderSettings(get().settings, partial);
    set({ settings: next, themes: allThemes(next.customThemes), hydrated: true });
    writeStorage(next);
    get().apply();
    return next;
  },

  replace: (settings) => {
    const parsed = parseCiderSettings(settings);
    set({ settings: parsed, themes: allThemes(parsed.customThemes), hydrated: true });
    writeStorage(parsed);
    get().apply();
  },

  reset: () => {
    // Os temas criados pelo usuário **e** a biblioteca ficam: "restaurar o
    // padrão" é sobre preferências, não sobre apagar o trabalho de quem já
    // ajustou a aparência.
    const next = {
      ...DEFAULT_CIDER_SETTINGS,
      customThemes: get().settings.customThemes,
      onboardingSeen: true,
    };
    set({ settings: next, themes: allThemes(next.customThemes), hydrated: true });
    writeStorage(next);
    get().apply();
  },

  selectTheme: (id) => {
    get().patch({ theme: id });
  },

  createTheme: (input) => {
    const theme = createCustomTheme(input);
    get().patch({ customThemes: [...get().settings.customThemes, theme] });
    return theme;
  },

  saveTheme: (theme) => {
    const saved = normalizeTheme(theme);
    const existing = get().settings.customThemes;
    const customThemes = existing.some((entry) => entry.id === saved.id)
      ? existing.map((entry) => (entry.id === saved.id ? saved : entry))
      : [...existing, saved];
    get().patch({ customThemes, theme: saved.id });
    return saved;
  },

  deleteTheme: (id) => {
    const next = settingsWithoutTheme(get().settings, id);
    // Reaproveita o caminho comum para persistir e aplicar de uma vez.
    set({ settings: next, themes: allThemes(next.customThemes) });
    writeStorage(next);
    get().apply();
  },

  importTheme: (text) => {
    const theme = importThemeJson(text);
    get().patch({ customThemes: [...get().settings.customThemes, theme] });
    return theme;
  },

  exportTheme: (id) => {
    const theme = get().themes.find((entry) => entry.id === id);
    if (!theme) throw new Error("Tema não encontrado");
    return exportThemeJson(theme);
  },

  apply: () => {
    const { settings, themes } = get();
    const appearance = applyCiderAppearance(settings, themes);
    set({ appearance });
    return appearance;
  },
}));

/** Atalho para escrever uma preferência fora de componentes React. */
export function setCiderSetting<K extends keyof CiderSettings>(
  key: K,
  value: CiderSettings[K],
): CiderSettings {
  return useCiderSettings.getState().patch({ [key]: value } as Partial<CiderSettings>);
}

/** Aparência aplicada no momento (ou `null` antes do primeiro `apply`). */
export function currentAppearance(): AppliedAppearance | null {
  return useCiderSettings.getState().appearance;
}

/**
 * Aplica a aparência salva ao `<html>` e mantém o modo automático vivo.
 *
 * Chamado uma vez, no provider que vive acima do roteador: assim o tema vale
 * também para o mini-player, que aparece fora de `/cider`.
 */
export function useCiderAppearanceSync(): void {
  const hydrated = useCiderSettings((state) => state.hydrated);

  useEffect(() => {
    useCiderSettings.getState().apply();
  }, [hydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      // Fora do modo automático nada muda; dentro dele, a aparência segue o
      // sistema sem exigir recarregar a página.
      if (useCiderSettings.getState().settings.theme === "auto") {
        useCiderSettings.getState().apply();
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
}
