import { describe, expect, it } from "vitest";

import {
  applyCiderAppearance,
  resolveMode,
  scaleShadow,
  scopedCustomCss,
  type AppearanceRoot,
} from "./apply";
import { DESIGN_TOKENS } from "./designTokens";
import {
  BUILTIN_THEMES,
  createCustomTheme,
  importThemeJson,
  normalizeTheme,
  parseThemeList,
  sanitizeCustomCss,
  validateTokenValue,
} from "./themes";
import {
  DEFAULT_CIDER_SETTINGS,
  clamp,
  parseCiderSettings,
  searchPreferencesOf,
} from "./types";
import { mergeCiderSettings, settingsWithoutTheme } from "./store";

/** Raiz falsa: captura as variáveis escritas, como o `<html>` faria. */
function fakeRoot() {
  const props = new Map<string, string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty: (name: string, value: string) => {
        props.set(name, value);
      },
      removeProperty: (name: string) => {
        props.delete(name);
      },
    },
  };
  return { root: root as AppearanceRoot, props };
}

describe("Cider · preferências", () => {
  it("cai nos padrões quando o documento é lixo", () => {
    const parsed = parseCiderSettings("nada disso");
    expect(parsed.theme).toBe(DEFAULT_CIDER_SETTINGS.theme);
    expect(parsed.sidebarWidth).toBe(DEFAULT_CIDER_SETTINGS.sidebarWidth);
  });

  it("limita valores fora da faixa em vez de aceitar qualquer número", () => {
    const parsed = parseCiderSettings({ fontScale: 9, sidebarWidth: 9999, transparency: -3 });
    expect(parsed.fontScale).toBe(1.4);
    expect(parsed.sidebarWidth).toBe(380);
    expect(parsed.transparency).toBe(0.4);
  });

  it("descarta tema de usuário inválido sem perder o resto do documento", () => {
    const parsed = parseCiderSettings({
      theme: "custom-1",
      customThemes: [
        { id: "ok", name: "Bom", mode: "dark", tokens: { "--cider-bg": "#000000" } },
        { id: "ruim", name: "Ruim", tokens: { "background": "#ffffff" } },
      ],
    });
    expect(parsed.theme).toBe("custom-1");
    expect(parsed.customThemes.map((theme) => theme.id)).toEqual(["ok"]);
  });

  it("traduz as preferências de busca para o formato que a busca entende", () => {
    const parsed = parseCiderSettings({ searchLimit: 18, maxPerChannel: 2 });
    expect(searchPreferencesOf(parsed)).toEqual({
      preferOfficialAudio: true,
      hideAlternativeVersions: false,
      maxPerChannel: 2,
      limit: 18,
    });
  });

  it("mantém a média de arredondamento dentro dos limites", () => {
    expect(clamp("12", 0, 10, 5)).toBe(10);
    expect(clamp("abc", 0, 10, 5)).toBe(5);
  });
});

describe("Cider · temas", () => {
  it("os seis temas embutidos são os mesmos do desktop, com ids únicos", () => {
    const ids = BUILTIN_THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "cider2-dark",
      "cider2-light",
      "cider2-midnight",
      "cider2-glass",
      "cider2-noir",
      "cider2-sunset",
    ]);
    // Todo tema embutido escreve apenas o próprio prefixo.
    for (const theme of BUILTIN_THEMES) {
      for (const key of Object.keys(theme.tokens)) {
        expect(key.startsWith("--cider-")).toBe(true);
      }
    }
  });

  it("recusa token que não seja do prefixo do Cider", () => {
    expect(() =>
      normalizeTheme({ id: "x", name: "x", tokens: { "--nexora-bg": "#000" } }),
    ).toThrow(/--cider-/);
  });

  it("recusa valor que carrega recurso externo ou fecha a regra CSS", () => {
    expect(() => validateTokenValue("url(https://exemplo.com/x.png)")).toThrow(/url\(/);
    expect(() => validateTokenValue("red; color: black")).toThrow(/;/);
    expect(() => normalizeTheme({ id: "x", name: "x", tokens: { "--cider-bg": "}" } })).toThrow(
      /\}/,
    );
    expect(() => sanitizeCustomCss(".a { background: url(x.png) }")).toThrow(/url\(/);
    expect(() => sanitizeCustomCss("@import 'x.css';")).toThrow(/@import/);
  });

  it("um tema importado nunca sobrescreve um embutido", () => {
    const text = JSON.stringify({
      id: "cider2-dark",
      name: "Falso",
      tokens: { "--cider-bg": "#123456" },
    });
    const imported = importThemeJson(text);
    expect(imported.id).not.toBe("cider2-dark");
    expect(imported.id.startsWith("custom-")).toBe(true);
  });

  it("ignora tema corrompido na lista guardada", () => {
    const list = parseThemeList([
      { id: "bom", name: "Bom", tokens: { "--cider-bg": "#101010" } },
      { id: "cider2-noir", name: "Embutido", tokens: {} },
      { nome: "sem id" },
    ]);
    expect(list.map((theme) => theme.id)).toEqual(["bom"]);
  });

  it("cria tema do usuário com id próprio e tokens validados", () => {
    const theme = createCustomTheme({
      name: "Meu tema",
      mode: "dark",
      tokens: { "--cider-accent": "#00ff00" },
    });
    expect(theme.id.startsWith("custom-")).toBe(true);
    expect(theme.tokens["--cider-accent"]).toBe("#00ff00");
    expect(theme.builtin).toBe(false);
  });
});

describe("Cider · aplicação da aparência", () => {
  it("leva todas as variáveis do editor ao elemento raiz", () => {
    // Se uma variável do editor não chegar ao <html>, o controle não faz nada.
    const { root, props } = fakeRoot();
    const theme = normalizeTheme({
      id: "probe",
      name: "Sondagem",
      mode: "dark",
      tokens: Object.fromEntries(DESIGN_TOKENS.map((token) => [token.variable, token.defaultValue])),
    });

    applyCiderAppearance({ ...DEFAULT_CIDER_SETTINGS, theme: "probe" }, [theme], root);

    const missing = DESIGN_TOKENS.map((token) => token.variable).filter(
      (variable) => !props.has(variable),
    );
    expect(missing).toEqual([]);
    expect(root.dataset.themeMode).toBe("dark");
    expect(root.dataset.theme).toBe("probe");
  });

  it("não escreve variável fora do prefixo do Cider (protege a Nexora)", () => {
    const { root, props } = fakeRoot();
    applyCiderAppearance(
      { ...DEFAULT_CIDER_SETTINGS, theme: "t" },
      [
        normalizeTheme({
          id: "t",
          name: "T",
          tokens: { "--cider-bg": "#000000" },
        }),
      ],
      root,
    );
    expect(props.has("--cider-bg")).toBe(true);
    expect(props.has("--background")).toBe(false);
    expect(props.has("--foreground")).toBe(false);
  });

  it("prende o CSS do tema à subárvore do Cider, sem reescrever seletores", () => {
    // O tema vale para o site inteiro (o mini-player vive fora de `/cider`), mas
    // um `button { … }` de um tema importado não pode reescrever a Nexora.
    expect(scopedCustomCss("")).toBe("");

    const scoped = scopedCustomCss(".topbar { color: red }\n@media (max-width: 900px){ .x { a: b } }");
    expect(scoped.startsWith("@scope (")).toBe(true);
    expect(scoped).toContain(".cider-root");
    expect(scoped).toContain(".cider-minibar");
    expect(scoped).toContain(".cider-audio-dock");
    // O CSS original entra intacto: nada de prefixar seletor na mão.
    expect(scoped).toContain(".topbar { color: red }");
    expect(scoped).toContain("@media (max-width: 900px){ .x { a: b } }");
    expect(scoped.endsWith("}")).toBe(true);
  });

  it("remove as variáveis do tema anterior ao trocar de tema", () => {
    const { root, props } = fakeRoot();
    const first = normalizeTheme({ id: "a", name: "A", tokens: { "--cider-bg": "#111111" } });
    const second = normalizeTheme({ id: "b", name: "B", tokens: { "--cider-bg": "#222222" } });

    applyCiderAppearance({ ...DEFAULT_CIDER_SETTINGS, theme: "a" }, [first, second], root);
    expect(props.get("--cider-bg")).toBe("#111111");

    applyCiderAppearance({ ...DEFAULT_CIDER_SETTINGS, theme: "b" }, [first, second], root);
    expect(props.get("--cider-bg")).toBe("#222222");
  });

  it("resolve o modo automático pelo sistema e pelo tema", () => {
    // `auto` segue o sistema, nunca o modo do tema — e sem `window` (Node) o
    // reserva é escuro, para não piscar branco em quem nunca escolheu nada.
    expect(resolveMode("auto", undefined, true)).toBe("light");
    expect(resolveMode("auto", undefined, false)).toBe("dark");
    expect(resolveMode("auto", "light")).toBe("dark");
    expect(resolveMode("auto", undefined)).toBe("dark");
    expect(resolveMode("light", "dark")).toBe("light");
  });

  it("identifica o modo escuro/claro e o nome do tema ativo", () => {
    const { root } = fakeRoot();
    const light = applyCiderAppearance(
      { ...DEFAULT_CIDER_SETTINGS, theme: "cider2-light" },
      BUILTIN_THEMES,
      root,
    );
    expect(light.mode).toBe("light");
    expect(light.themeName).toBe("Cidra Clara");
    expect(light.custom).toBe(true);

    const plain = applyCiderAppearance({ ...DEFAULT_CIDER_SETTINGS, theme: "dark" }, BUILTIN_THEMES, root);
    expect(plain.auto).toBe(false);
    expect(plain.custom).toBe(false);
    expect(plain.themeName).toBe("Escuro");
    expect(root.dataset.theme).toBe("dark");
  });

  it("escala a opacidade das sombras sem mexer nas cores", () => {
    const scaled = scaleShadow("0 6px 18px rgba(0, 0, 0, 0.32)", 0.5);
    expect(scaled).toContain("rgba(0, 0, 0, 0.16)");
    expect(scaleShadow("0 1px 2px rgba(0,0,0,0.5)", 1)).toBe("0 1px 2px rgba(0,0,0,0.5)");
  });

  it("leva a densidade, as animações e o vidro para o <html>", () => {
    const { root } = fakeRoot();
    applyCiderAppearance(
      { ...DEFAULT_CIDER_SETTINGS, density: "compact", animations: "off", glass: false },
      BUILTIN_THEMES,
      root,
    );
    expect(root.dataset.density).toBe("compact");
    expect(root.dataset.animations).toBe("off");
    expect(root.dataset.glass).toBe("off");
  });
});

describe("Cider · transições de estado das preferências", () => {
  it("faz merge parcial preservando o resto do documento", () => {
    const next = mergeCiderSettings(DEFAULT_CIDER_SETTINGS, { fontScale: 1.2 });
    expect(next.fontScale).toBe(1.2);
    expect(next.theme).toBe(DEFAULT_CIDER_SETTINGS.theme);
  });

  it("volta ao tema padrão quando o tema ativo é apagado", () => {
    const settings = {
      ...DEFAULT_CIDER_SETTINGS,
      theme: "custom-1",
      customThemes: [
        { id: "custom-1", name: "Um", mode: "dark" as const, tokens: {} },
        { id: "custom-2", name: "Dois", mode: "dark" as const, tokens: {} },
      ],
    };
    const next = settingsWithoutTheme(settings, "custom-1");
    expect(next.theme).toBe(DEFAULT_CIDER_SETTINGS.theme);
    expect(next.customThemes.map((theme) => theme.id)).toEqual(["custom-2"]);

    const untouched = settingsWithoutTheme({ ...settings, theme: "custom-2" }, "custom-1");
    expect(untouched.theme).toBe("custom-2");
  });
});
