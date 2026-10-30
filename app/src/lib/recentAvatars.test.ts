import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_AVATARS,
  loadRecentAvatars,
  rememberAvatar,
} from "./recentAvatars";

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set("nexora-recent-avatars", initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    read: () => data.get("nexora-recent-avatars"),
  };
}

describe("recentAvatars", () => {
  it("começa vazio quando não há nada guardado", () => {
    expect(loadRecentAvatars(fakeStorage())).toEqual([]);
  });

  it("descarta dado corrompido em vez de quebrar", () => {
    expect(loadRecentAvatars(fakeStorage("{{"))).toEqual([]);
    expect(loadRecentAvatars(fakeStorage('{"url":"a"}'))).toEqual([]);
    expect(loadRecentAvatars(fakeStorage('["a", 7, null, "  ", "b"]'))).toEqual([
      "a",
      "b",
    ]);
  });

  it("não explode sem storage (SSR, modo privado)", () => {
    expect(loadRecentAvatars(null)).toEqual([]);
    expect(rememberAvatar("https://cdn/a.png", null)).toEqual([
      "https://cdn/a.png",
    ]);
  });

  it("mantém o mais novo no topo sem repetir", () => {
    const storage = fakeStorage();
    rememberAvatar("https://cdn/a.png", storage);
    rememberAvatar("https://cdn/b.png", storage);
    const next = rememberAvatar("https://cdn/a.png", storage);
    expect(next).toEqual(["https://cdn/a.png", "https://cdn/b.png"]);
  });

  it("ignora url vazia", () => {
    const storage = fakeStorage();
    expect(rememberAvatar("   ", storage)).toEqual([]);
  });

  it("limpa a lista para o limite configurado", () => {
    const storage = fakeStorage();
    for (let index = 0; index < MAX_RECENT_AVATARS + 4; index += 1) {
      rememberAvatar(`https://cdn/${index}.png`, storage);
    }
    const recents = loadRecentAvatars(storage);
    expect(recents).toHaveLength(MAX_RECENT_AVATARS);
    expect(recents[0]).toBe(`https://cdn/${MAX_RECENT_AVATARS + 3}.png`);
  });

  it("respeita o limite informado", () => {
    const storage = fakeStorage();
    rememberAvatar("https://cdn/a.png", storage, 1);
    expect(rememberAvatar("https://cdn/b.png", storage, 1)).toEqual([
      "https://cdn/b.png",
    ]);
  });
});
