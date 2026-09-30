/**
 * Aplicação da aparência: traduz as preferências + o tema ativo em variáveis
 * CSS e atributos no elemento `<html>`.
 *
 * Portado de `src/customization/apply.ts` do Cider 2 desktop, com duas
 * diferenças obrigatórias para viver dentro do site:
 *
 * 1. **Só `--cider-*`.** Um tema é dado que vira CSS; escrever uma variável
 *    qualquer (`--background`, por exemplo) dentro de um tema salvo reescreveria
 *    a Nexora inteira. O filtro do prefixo é a trava.
 * 2. **Raiz injetável.** Os testes rodam em Node (sem DOM), então a função
 *    recebe o elemento raiz — em produção é o `<html>`.
 *
 * A função é idempotente: as variáveis do tema anterior são removidas antes de
 * escrever as novas, então trocar de tema não acumula estado.
 */

import { FONT_STACKS } from "./designTokens";
import type { AppearanceTheme } from "./themes";
import type { CiderSettings } from "./types";

/** Superfície mínima usada da raiz (o `<html>` real satisfaz). */
export interface AppearanceRoot {
  dataset: Record<string, string | undefined>;
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
}

export interface AppliedAppearance {
  /** Modo realmente aplicado (o "automático" segue o sistema). */
  mode: "dark" | "light";
  /** Nome do tema em uso (para exibir na interface). */
  themeName: string;
  /** `true` quando o tema veio de um tema salvo (embutido ou do usuário). */
  custom: boolean;
  /** Modo automático ativo. */
  auto: boolean;
}

const CUSTOM_CSS_ID = "cider2-theme-css";

/** Variáveis aplicadas pelo tema atual (limpas antes do próximo). */
let appliedThemeKeys: string[] = [];

/** Durações base, usadas quando o usuário escolhe uma velocidade diferente. */
const BASE_DURATIONS = { fast: 140, base: 280, slow: 480 };

function rootOf(root?: AppearanceRoot): AppearanceRoot | null {
  if (root) return root;
  if (typeof document === "undefined") return null;
  return document.documentElement;
}

/** Multiplica a opacidade de todas as sombras `rgba()` de um valor de sombra. */
export function scaleShadow(shadow: string, factor: number): string {
  if (factor === 1) return shadow;
  const clamped = Math.max(0, Math.min(2, factor));
  return shadow.replace(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/g,
    (_match, r: string, g: string, b: string, a?: string) => {
      const alpha = (a === undefined ? 1 : Number(a)) * clamped;
      return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
    },
  );
}

/** Resolve o modo final a partir da preferência e do tema. */
export function resolveMode(
  preference: string,
  themeMode?: "dark" | "light",
  matchesLight?: boolean,
): "dark" | "light" {
  if (preference === "dark" || preference === "light") return preference;
  if (preference === "auto") {
    if (matchesLight !== undefined) return matchesLight ? "light" : "dark";
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    return "dark";
  }
  return themeMode ?? "dark";
}

function fontStack(value: string): string | undefined {
  if (!value) return undefined;
  const preset = FONT_STACKS[value];
  if (preset) return preset;
  // Família personalizada: aceita lista separada por vírgulas.
  return value.includes(",") ? value : `"${value}", ${FONT_STACKS.system}`;
}

/** Aplica tudo que é visual e devolve um resumo do que passou a valer. */
export function applyCiderAppearance(
  settings: CiderSettings,
  themes: AppearanceTheme[],
  root?: AppearanceRoot,
): AppliedAppearance {
  const target = rootOf(root);
  const activeTheme = themes.find((theme) => theme.id === settings.theme);
  const mode = resolveMode(settings.theme, activeTheme?.mode);
  const auto = settings.theme === "auto";

  const summary: AppliedAppearance = {
    mode,
    themeName: activeTheme?.name ?? (auto ? "Automático" : settings.theme === "light" ? "Claro" : "Escuro"),
    custom: Boolean(activeTheme),
    auto,
  };

  if (!target) return summary;

  const { dataset, style } = target;
  dataset.themeMode = mode;
  dataset.theme = activeTheme ? activeTheme.id : settings.theme;
  dataset.density = settings.density;
  dataset.animations = settings.animations;
  dataset.performance = settings.performance;
  dataset.reduceMotion = String(
    settings.reduceMotion ||
      (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true),
  );
  dataset.glass = settings.glass ? "on" : "off";
  dataset.coverAmbient = settings.coverAmbient ? "on" : "off";

  const setVar = (name: string, value: string | number | undefined) => {
    if (value === undefined) return;
    style.setProperty(name, String(value));
  };

  // --- Cores e vidro -------------------------------------------------
  setVar("--cider-accent", settings.accent);
  setVar("--cider-accent-secondary", settings.accentSecondary);
  setVar("--cider-transparency", settings.transparency);
  setVar("--cider-glass-opacity", settings.glass ? settings.transparency : 1);
  setVar("--cider-blur", settings.glass ? `${settings.glassBlur}px` : "0px");
  setVar("--cider-border-opacity", settings.borderOpacity);

  const shadowIntensity = settings.shadowIntensity;
  setVar("--cider-shadow-md", scaleShadow("0 6px 18px rgba(0, 0, 0, 0.32)", shadowIntensity));
  setVar("--cider-shadow-lg", scaleShadow("0 18px 48px rgba(0, 0, 0, 0.42)", shadowIntensity));
  setVar("--cider-shadow-xl", scaleShadow("0 32px 72px rgba(0, 0, 0, 0.5)", shadowIntensity));

  // --- Escalas -------------------------------------------------------
  setVar("--cider-radius-scale", settings.radiusScale);
  setVar("--cider-space-scale", settings.spacingScale);
  setVar("--cider-font-scale", settings.fontScale);
  const stack = fontStack(settings.fontFamily);
  setVar("--cider-font", stack);

  // --- Métricas de layout --------------------------------------------
  setVar("--cider-sidebar-width", `${settings.sidebarWidth}px`);
  setVar("--cider-cover-size", `${settings.coverSize}px`);

  // --- Movimento -----------------------------------------------------
  // As regras de acessibilidade (animações reduzidas/desligadas) vivem no CSS;
  // só mexemos nas durações quando a velocidade escolhida não é a padrão.
  if (settings.animations === "full" && settings.animationSpeed !== 1 && settings.animationSpeed > 0) {
    setVar("--cider-duration-fast", `${Math.round(BASE_DURATIONS.fast / settings.animationSpeed)}ms`);
    setVar("--cider-duration-base", `${Math.round(BASE_DURATIONS.base / settings.animationSpeed)}ms`);
    setVar("--cider-duration-slow", `${Math.round(BASE_DURATIONS.slow / settings.animationSpeed)}ms`);
  } else {
    // Sem velocidade personalizada, quem manda é o CSS (que já trata
    // animações reduzidas/desligadas e a preferência do sistema).
    for (const name of ["--cider-duration-fast", "--cider-duration-base", "--cider-duration-slow"]) {
      style.removeProperty(name);
    }
  }

  // --- Tokens do tema -------------------------------------------------
  for (const key of appliedThemeKeys) style.removeProperty(key);
  appliedThemeKeys = [];

  if (activeTheme) {
    for (const [key, value] of Object.entries(activeTheme.tokens ?? {})) {
      // Filtro de segurança: um tema só escreve o próprio prefixo.
      if (!key.startsWith("--cider-") || !value) continue;
      style.setProperty(key, value);
      appliedThemeKeys.push(key);
    }
    if (typeof activeTheme.blur === "number" && settings.glass) {
      setVar("--cider-blur", `${activeTheme.blur}px`);
      appliedThemeKeys.push("--cider-blur");
    }
    if (activeTheme.glass === false) {
      setVar("--cider-blur", "0px");
      setVar("--cider-glass-opacity", 1);
      appliedThemeKeys.push("--cider-blur", "--cider-glass-opacity");
    }
  }

  // --- CSS personalizado do tema --------------------------------------
  applyStyleBlock(CUSTOM_CSS_ID, scopedCustomCss(activeTheme?.customCss ?? ""));

  return summary;
}

/**
 * Subárvores onde o CSS de um tema pode agir.
 *
 * O tema é aplicado no `<html>` porque o mini-player vive fora de `/cider` — e
 * por isso o CSS personalizado de um tema importado cairia no site inteiro: um
 * `button { … }` solto reescreveria a Nexora.
 */
const CUSTOM_CSS_SCOPE = ".cider-root, .cider-minibar, .cider-audio-dock";

/**
 * Prende o CSS do tema à subárvore do Cider.
 *
 * Feito com `@scope` em vez de reescrever cada seletor à mão: prefixar strings
 * quebraria em `@media`, `:is(...)` e listas com vírgula, e um erro ali viraria
 * CSS inválido. Navegador que não entende `@scope` ignora o bloco inteiro — o
 * tema perde o CSS extra, mas nada escapa para a Nexora.
 */
export function scopedCustomCss(css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return "";
  return `@scope (${CUSTOM_CSS_SCOPE}) {\n${trimmed}\n}`;
}

function applyStyleBlock(id: string, css: string): void {
  if (typeof document === "undefined") return;
  let element = document.getElementById(id) as HTMLStyleElement | null;
  if (!css.trim()) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("style");
    element.id = id;
    element.setAttribute("data-cider", "user-style");
    document.head.appendChild(element);
  }
  element.textContent = css;
}

/** Aplica o tom da capa atual (modo "cores da capa"). */
export function applyAccentFromCover(accent: string, secondary: string, root?: AppearanceRoot): void {
  const target = rootOf(root);
  if (!target) return;
  target.style.setProperty("--cider-accent", accent);
  target.style.setProperty("--cider-accent-secondary", secondary);
}

/** Reverte o destaque para os valores configurados. */
export function clearCoverAccent(settings: CiderSettings, root?: AppearanceRoot): void {
  const target = rootOf(root);
  if (!target) return;
  target.style.setProperty("--cider-accent", settings.accent);
  target.style.setProperty("--cider-accent-secondary", settings.accentSecondary);
}

export const __testing = { BASE_DURATIONS };
