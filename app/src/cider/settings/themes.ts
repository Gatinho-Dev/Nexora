/**
 * Temas do Cider: embutidos, validação e importação.
 *
 * Os seis temas embutidos são **os mesmos** do Cider 2 desktop (portados de
 * `src-tauri/src/commands/theme_cmds.rs`, com os mesmos tokens), então escolher
 * "Meia-noite" aqui dá exatamente a mesma paleta que no aplicativo.
 *
 * A validação é a mesma do núcleo nativo, e não é decorativa: um tema é **dado**
 * que vira CSS. Sem os limites abaixo, um tema salvo poderia trazer
 * `url(https://…)` e transformar a página num rastreador, ou fechar a regra com
 * `}` e reescrever o visual do site inteiro. Um tema só escreve variáveis com o
 * prefixo `--cider-` e nunca aponta para fora.
 */

/** Prefixo obrigatório das variáveis de tema. */
export const TOKEN_PREFIX = "--cider-";

const MAX_TOKENS = 400;
const MAX_TOKEN_VALUE = 180;
const MAX_CUSTOM_CSS = 64 * 1024;
const MAX_NAME = 60;

export interface AppearanceTheme {
  id: string;
  name: string;
  mode: "dark" | "light";
  description?: string;
  builtin?: boolean;
  /** Variáveis `--cider-*` que o tema sobrescreve. */
  tokens: Record<string, string>;
  customCss?: string;
  glass?: boolean;
  blur?: number;
  radiusScale?: number;
  spacingScale?: number;
  basedOn?: string;
}

/* ------------------------------------------------------------------ *
 * Temas embutidos (portados do desktop)                              *
 * ------------------------------------------------------------------ */

export const BUILTIN_THEMES: AppearanceTheme[] = [
  {
    id: "cider2-dark",
    name: "Cidra Escura",
    mode: "dark",
    description: "Tema padrão: fundo profundo, destaque âmbar-magenta.",
    builtin: true,
    tokens: {
      "--cider-bg": "#0b0a12",
      "--cider-bg-elevated": "#15131f",
      "--cider-surface": "rgba(255,255,255,0.06)",
      "--cider-surface-strong": "rgba(255,255,255,0.10)",
      "--cider-border": "rgba(255,255,255,0.12)",
      "--cider-text": "#f4f4f7",
      "--cider-text-muted": "#9a9aa8",
      "--cider-accent": "#ff5f6d",
      "--cider-accent-secondary": "#7b5cff",
    },
    glass: true,
    blur: 28,
    radiusScale: 1,
    spacingScale: 1,
  },
  {
    id: "cider2-light",
    name: "Cidra Clara",
    mode: "light",
    description: "Versão clara e arejada, para ambientes iluminados.",
    builtin: true,
    tokens: {
      "--cider-bg": "#f7f7fa",
      "--cider-bg-elevated": "#ffffff",
      "--cider-surface": "rgba(0,0,0,0.035)",
      "--cider-surface-strong": "rgba(0,0,0,0.06)",
      "--cider-border": "rgba(0,0,0,0.10)",
      "--cider-text": "#17161d",
      "--cider-text-muted": "#5f5e6c",
      "--cider-accent": "#e0414f",
      "--cider-accent-secondary": "#5a3fd6",
    },
    glass: true,
    blur: 20,
    radiusScale: 1,
    spacingScale: 1,
  },
  {
    id: "cider2-midnight",
    name: "Meia-noite",
    mode: "dark",
    description: "Azul profundo com brilho frio, ideal para uso noturno.",
    builtin: true,
    tokens: {
      "--cider-bg": "#050914",
      "--cider-bg-elevated": "#0c1424",
      "--cider-surface": "rgba(120,170,255,0.07)",
      "--cider-border": "rgba(140,180,255,0.14)",
      "--cider-text": "#e8efff",
      "--cider-text-muted": "#8fa3c4",
      "--cider-accent": "#5b9dff",
      "--cider-accent-secondary": "#9d7bff",
    },
    glass: true,
    blur: 34,
    radiusScale: 1,
    spacingScale: 1,
  },
  {
    id: "cider2-glass",
    name: "Vidro",
    mode: "dark",
    description: "Vidro fosco acentuado com transparências fortes.",
    builtin: true,
    tokens: {
      "--cider-bg": "rgba(12,10,20,0.55)",
      "--cider-bg-elevated": "rgba(22,20,34,0.45)",
      "--cider-surface": "rgba(255,255,255,0.10)",
      "--cider-border": "rgba(255,255,255,0.22)",
      "--cider-text": "#ffffff",
      "--cider-text-muted": "rgba(255,255,255,0.65)",
      "--cider-accent": "#ff8a5c",
      "--cider-accent-secondary": "#8f7bff",
    },
    glass: true,
    blur: 46,
    radiusScale: 1.15,
    spacingScale: 1.05,
  },
  {
    id: "cider2-noir",
    name: "Noir",
    mode: "dark",
    description: "Monocromático minimalista, sem desfoques.",
    builtin: true,
    tokens: {
      "--cider-bg": "#0a0a0a",
      "--cider-bg-elevated": "#141414",
      "--cider-surface": "rgba(255,255,255,0.04)",
      "--cider-border": "rgba(255,255,255,0.10)",
      "--cider-text": "#f2f2f2",
      "--cider-text-muted": "#8b8b8b",
      "--cider-accent": "#f2f2f2",
      "--cider-accent-secondary": "#a8a8a8",
    },
    glass: false,
    blur: 0,
    radiusScale: 0.55,
    spacingScale: 0.95,
  },
  {
    id: "cider2-sunset",
    name: "Pôr do sol",
    mode: "dark",
    description: "Gradientes quentes de cidra e pêssego.",
    builtin: true,
    tokens: {
      "--cider-bg": "#17100c",
      "--cider-bg-elevated": "#241a13",
      "--cider-surface": "rgba(255,190,140,0.08)",
      "--cider-border": "rgba(255,190,140,0.16)",
      "--cider-text": "#fff4ec",
      "--cider-text-muted": "#d0a894",
      "--cider-accent": "#ff9d4d",
      "--cider-accent-secondary": "#ff5f8f",
    },
    glass: true,
    blur: 24,
    radiusScale: 1.1,
    spacingScale: 1,
  },
];

export function isBuiltinTheme(id: string): boolean {
  return BUILTIN_THEMES.some((theme) => theme.id === id);
}

/** Reserva o vocabulário de `appearance.theme`. */
export const THEME_PREFERENCES = ["auto", "dark", "light"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Todos os temas disponíveis: embutidos + do usuário. */
export function allThemes(custom: AppearanceTheme[]): AppearanceTheme[] {
  return [...BUILTIN_THEMES, ...custom];
}

/** Resolve o tema ativo a partir da preferência (`auto`/`dark`/`light`/id). */
export function findTheme(themes: AppearanceTheme[], preference: string): AppearanceTheme | undefined {
  return themes.find((theme) => theme.id === preference);
}

/* ------------------------------------------------------------------ *
 * Validação (mesmas regras do núcleo nativo)                         *
 * ------------------------------------------------------------------ */

const FORBIDDEN_TOKEN_VALUES = ["url(", "@import", "expression(", "javascript:", "</style", "\\u003c"];
const FORBIDDEN_CSS = ["@import", "url(", "expression(", "javascript:", "</style"];

/** Valida o valor de uma variável de tema. Lança com mensagem em pt-BR. */
export function validateTokenValue(value: string): void {
  const trimmed = value.trim();
  if (trimmed.length > MAX_TOKEN_VALUE) {
    throw new Error("Valor de token grande demais");
  }
  const lower = trimmed.toLowerCase();
  for (const forbidden of FORBIDDEN_TOKEN_VALUES) {
    if (lower.includes(forbidden)) {
      throw new Error(`Valor de tema contém construção não permitida: ${forbidden}`);
    }
  }
  if (trimmed.includes(";") || trimmed.includes("}") || trimmed.includes("{")) {
    throw new Error("Valores de token não podem conter `;`, `{` ou `}`");
  }
}

/** Limpa CSS personalizado, removendo carregamento de recursos externos. */
export function sanitizeCustomCss(css: string): string {
  if (css.length > MAX_CUSTOM_CSS) {
    throw new Error("CSS personalizado grande demais (máx. 64 KB)");
  }
  const lower = css.toLowerCase();
  for (const forbidden of FORBIDDEN_CSS) {
    if (lower.includes(forbidden)) {
      throw new Error(`CSS personalizado não pode conter ${forbidden} (evita requisições externas)`);
    }
  }
  return css;
}

const TOKEN_KEY_PATTERN = /^--cider-[a-z0-9_-]+$/;

/**
 * Valida e normaliza um tema (vindo da interface ou de um JSON importado).
 * Devolve o tema pronto para uso; lança se algo estiver fora dos limites.
 */
export function normalizeTheme(theme: unknown): AppearanceTheme {
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
    throw new Error("O tema precisa ser um objeto JSON");
  }
  const object = theme as Record<string, unknown>;

  const id = typeof object.id === "string" ? object.id.trim() : "";
  if (!id) throw new Error("O tema precisa de um id");
  if (id.length > 64 || !/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error("Id do tema aceita apenas letras, números, ponto, hífen e underscore");
  }

  const name = typeof object.name === "string" ? object.name.trim() : "";
  if (!name) throw new Error("O tema precisa de um nome");
  if (name.length > MAX_NAME) throw new Error("Nome do tema muito longo");

  const mode: "dark" | "light" = object.mode === "light" ? "light" : "dark";

  const tokens: Record<string, string> = {};
  const rawTokens = object.tokens;
  if (rawTokens !== undefined && rawTokens !== null) {
    if (typeof rawTokens !== "object" || Array.isArray(rawTokens)) {
      throw new Error("Os tokens do tema precisam ser um objeto");
    }
    const entries = Object.entries(rawTokens as Record<string, unknown>);
    if (entries.length > MAX_TOKENS) throw new Error("Tokens de tema demais");
    for (const [key, value] of entries) {
      if (!key.startsWith(TOKEN_PREFIX)) {
        throw new Error(`Tokens de tema precisam começar com ${TOKEN_PREFIX} (recebido: ${key})`);
      }
      if (!TOKEN_KEY_PATTERN.test(key)) {
        throw new Error(`Nome de token inválido: ${key}`);
      }
      if (typeof value !== "string") {
        throw new Error(`O token ${key} precisa ser texto`);
      }
      validateTokenValue(value);
      tokens[key] = value.trim();
    }
  }

  const customCss = typeof object.customCss === "string" && object.customCss.trim()
    ? sanitizeCustomCss(object.customCss)
    : "";

  return {
    id,
    name,
    mode,
    description: typeof object.description === "string" ? object.description.slice(0, 200) : "",
    builtin: false,
    tokens,
    customCss,
    glass: typeof object.glass === "boolean" ? object.glass : true,
    blur: Math.min(80, Math.max(0, Number(object.blur ?? 28) || 0)),
    radiusScale: Math.min(2, Math.max(0, Number(object.radiusScale ?? 1) || 0)),
    spacingScale: Math.min(2, Math.max(0.6, Number(object.spacingScale ?? 1) || 0)),
    basedOn: typeof object.basedOn === "string" ? object.basedOn : "cider2-dark",
  };
}

/**
 * Lê a lista de temas do usuário guardada no `localStorage`.
 *
 * Um tema corrompido é descartado em silêncio (com aviso no console) em vez de
 * derrubar a leitura da lista inteira: o usuário perde um tema, não a página.
 */
export function parseThemeList(raw: unknown): AppearanceTheme[] {
  if (!Array.isArray(raw)) return [];
  const kept: AppearanceTheme[] = [];
  for (const entry of raw) {
    try {
      const theme = normalizeTheme(entry);
      if (!isBuiltinTheme(theme.id)) kept.push(theme);
    } catch (error) {
      console.warn("[cider] tema ignorado:", error);
    }
  }
  return kept;
}

/** Cria um tema novo a partir do editor visual. */
export function createCustomTheme(input: {
  name: string;
  mode: "dark" | "light";
  tokens: Record<string, string>;
  basedOn?: string;
  description?: string;
}): AppearanceTheme {
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return normalizeTheme({
    id,
    name: input.name,
    mode: input.mode,
    tokens: input.tokens,
    description: input.description ?? "Tema criado no editor visual.",
    basedOn: input.basedOn,
  });
}

/** Exporta um tema para JSON (pronto para compartilhar). */
export function exportThemeJson(theme: AppearanceTheme): string {
  return JSON.stringify(
    {
      id: theme.id,
      name: theme.name,
      mode: theme.mode,
      description: theme.description ?? "",
      tokens: theme.tokens,
      customCss: theme.customCss ?? "",
      glass: theme.glass ?? true,
      blur: theme.blur ?? 28,
      radiusScale: theme.radiusScale ?? 1,
      spacingScale: theme.spacingScale ?? 1,
      basedOn: theme.basedOn ?? "cider2-dark",
    },
    null,
    2,
  );
}

/** Importa um tema de um texto JSON. */
export function importThemeJson(text: string): AppearanceTheme {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido");
  }
  const theme = normalizeTheme(parsed);
  if (isBuiltinTheme(theme.id)) {
    // Um tema importado não pode sobrescrever um embutido; ganha um id próprio.
    return normalizeTheme({ ...theme, id: `custom-${theme.id}` });
  }
  return theme;
}
