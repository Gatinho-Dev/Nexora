import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAME_STYLE,
  NAME_EFFECTS,
  NAME_FONTS,
  hexToRgbTriplet,
  normalizeNameColor,
  normalizeNameEffectId,
  normalizeNameFontId,
  randomNameStyle,
} from "./nameStyle";

describe("catálogo de estilo do nome", () => {
  it("não tem ids repetidos nem ids vazios", () => {
    const fonts = NAME_FONTS.map(font => font.id);
    const effects = NAME_EFFECTS.map(effect => effect.id);
    expect(new Set(fonts).size).toBe(fonts.length);
    expect(new Set(effects).size).toBe(effects.length);
    expect(fonts.every(id => id.length > 0)).toBe(true);
    expect(effects.every(id => id.length > 0)).toBe(true);
  });

  it("distingue as fontes por classe, senão as prévias saem idênticas", () => {
    const classes = NAME_FONTS.map(font => font.className);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("mantém efeitos que não existediam antes desta versão", () => {
    // `outline` já podia estar salvo em um perfil antigo; perdê-lo no catálogo
    // tiraria uma escolha que o usuário já tinha feito.
    expect(NAME_EFFECTS.map(effect => effect.id)).toContain("outline");
  });
});

describe("normalizeNameFontId / normalizeNameEffectId", () => {
  it("aceita o que está no catálogo", () => {
    expect(normalizeNameFontId("pixel")).toBe("pixel");
    expect(normalizeNameEffectId("gummy")).toBe("gummy");
  });

  it("cai no padrão para valor desconhecido, em vez de reprovar no backend", () => {
    expect(normalizeNameFontId("comic-relacionado")).toBe("sans");
    expect(normalizeNameEffectId(undefined)).toBe("solid");
    expect(normalizeNameEffectId(42)).toBe("solid");
    expect(normalizeNameFontId({ evil: true })).toBe("sans");
  });

  it("o default do catálogo é o mesmo default do estado inicial", () => {
    expect(normalizeNameFontId(undefined)).toBe(DEFAULT_NAME_STYLE.font);
    expect(normalizeNameEffectId(undefined)).toBe(DEFAULT_NAME_STYLE.effect);
  });
});

describe("normalizeNameColor", () => {
  it("só aceita hexadecimal de 6 dígitos", () => {
    expect(normalizeNameColor("#ABCDEF", "#000000")).toBe("#ABCDEF");
    expect(normalizeNameColor("#fff", "#000000")).toBe("#000000");
    expect(normalizeNameColor("rgb(1,2,3)", "#000000")).toBe("#000000");
    expect(normalizeNameColor(null, "#7383FF")).toBe("#7383FF");
  });
});

describe("hexToRgbTriplet", () => {
  it("converte para o formato usado dentro de rgba()", () => {
    expect(hexToRgbTriplet("#FFFFFF")).toBe("255, 255, 255");
    expect(hexToRgbTriplet("#7383FF")).toBe("115, 131, 255");
    expect(hexToRgbTriplet("lixo")).toBe("244, 247, 251");
  });
});

describe("randomNameStyle", () => {
  it("sempre devolve valores presentes no catálogo", () => {
    for (let round = 0; round < 50; round += 1) {
      const style = randomNameStyle();
      expect(NAME_FONTS.map(font => font.id)).toContain(style.font);
      expect(NAME_EFFECTS.map(effect => effect.id)).toContain(style.effect);
      expect(style.colorA).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("respeita o injetor de índice, para o teste ser determinístico", () => {
    const style = randomNameStyle(() => 0);
    expect(style.font).toBe(NAME_FONTS[0].id);
    expect(style.effect).toBe(NAME_EFFECTS[0].id);
  });
});
