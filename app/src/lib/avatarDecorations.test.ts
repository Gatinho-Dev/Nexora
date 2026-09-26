import { describe, expect, it } from "vitest";
import {
  AVATAR_DECORATION_FRAMES,
  AVATAR_DECORATION_SECTIONS,
  AVATAR_DECORATIONS,
  DEFAULT_AVATAR_DECORATION,
  getAvatarDecoration,
  getAvatarDecorationsBySection,
  normalizeAvatarDecorationId,
} from "./avatarDecorations";

describe("avatarDecorations", () => {
  it("mantém os ids únicos e a decoração padrão como Nenhuma", () => {
    const ids = AVATAR_DECORATIONS.map(decoration => decoration.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(AVATAR_DECORATIONS[0].id).toBe(DEFAULT_AVATAR_DECORATION);
  });

  it("usa apenas seções do catálogo", () => {
    const sections = AVATAR_DECORATION_SECTIONS.map(section => section.id);
    for (const decoration of AVATAR_DECORATIONS) {
      expect(sections).toContain(decoration.section);
    }
  });

  it("agrupa as decorações preservando a ordem do catálogo", () => {
    const owned = getAvatarDecorationsBySection("owned").map(item => item.id);
    const premium = getAvatarDecorationsBySection("premium").map(item => item.id);

    expect(owned).toEqual(["none", "sparkles", "crown", "orbit"]);
    expect(premium).toEqual([
      "rainbow",
      "catEars",
      "headphones",
      "bloom",
      "pixels",
      "leaves",
    ]);
    expect(owned.length + premium.length).toBe(AVATAR_DECORATIONS.length);
  });

  it("tem rótulo e nota para todas as decorações", () => {
    for (const decoration of AVATAR_DECORATIONS) {
      expect(decoration.label.length).toBeGreaterThan(0);
      expect(decoration.note.length).toBeGreaterThan(0);
    }
  });

  it("resolve molduras só para frames com classe definida", () => {
    const defined = new Set<string>([
      "none",
      "gradient",
      ...Object.keys(AVATAR_DECORATION_FRAMES),
    ]);
    for (const decoration of AVATAR_DECORATIONS) {
      expect(defined).toContain(decoration.frame);
    }
  });

  it("cai na decoração padrão para id desconhecido", () => {
    expect(getAvatarDecoration("crown").id).toBe("crown");
    expect(getAvatarDecoration("inexistente").id).toBe(DEFAULT_AVATAR_DECORATION);
    expect(getAvatarDecoration(null).id).toBe(DEFAULT_AVATAR_DECORATION);
    expect(normalizeAvatarDecorationId(undefined)).toBe(DEFAULT_AVATAR_DECORATION);
    expect(normalizeAvatarDecorationId(42)).toBe(DEFAULT_AVATAR_DECORATION);
    expect(normalizeAvatarDecorationId("leaves")).toBe("leaves");
  });
});
