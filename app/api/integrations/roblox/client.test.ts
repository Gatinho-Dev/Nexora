import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "./client";

describe("Roblox OAuth authorization URL", () => {
  it("solicita seleção de conta uma única vez e mantém PKCE/state", () => {
    const result = buildAuthorizeUrl({
      state: "state-seguro",
      codeVerifier: "verificador-pkce-com-tamanho-suficiente-1234567890",
      nonce: "nonce-seguro",
    });
    const url = new URL(result.url);
    expect(url.origin).toBe("https://apis.roblox.com");
    expect(url.pathname).toBe("/oauth/v1/authorize");
    expect(url.searchParams.getAll("prompt")).toEqual(["select_account"]);
    expect(url.searchParams.get("state")).toBe("state-seguro");
    expect(url.searchParams.get("scope")).toBe("openid profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(result.challenge);
  });
});
