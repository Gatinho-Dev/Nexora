import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "./client";

describe("Roblox OAuth authorization URL", () => {
  it("solicita seleção de conta e consentimento no mesmo prompt", () => {
    const result = buildAuthorizeUrl({
      state: "state-seguro",
      codeVerifier: "verificador-pkce-com-tamanho-suficiente-1234567890",
      nonce: "nonce-seguro",
    });
    const url = new URL(result.url);
    expect(url.origin).toBe("https://apis.roblox.com");
    expect(url.pathname).toBe("/oauth/v1/authorize");
    const prompts = url.searchParams.getAll("prompt");
    expect(prompts).toHaveLength(1);
    expect(new Set(prompts[0].split(" "))).toEqual(
      new Set(["select_account", "consent"])
    );
    expect(url.searchParams.get("state")).toBe("state-seguro");
    expect(url.searchParams.get("scope")).toBe("openid profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(result.challenge);
  });
});
