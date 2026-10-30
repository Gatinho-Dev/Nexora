import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCode,
  resolveRobloxIdentity,
  revokeToken,
} from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("usa os endpoints v1 publicados pelo discovery do Roblox", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token-valido",
            refresh_token: "refresh-token-valido",
            expires_in: 900,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeCode({ code: "codigo", codeVerifier: "verificador" });
    await expect(revokeToken("access-token-valido")).resolves.toBe(true);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://apis.roblox.com/oauth/v1/token"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://apis.roblox.com/oauth/v1/token/revoke"
    );
    const tokenInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(
      new URLSearchParams(String(tokenInit.body)).has("client_secret")
    ).toBe(false);
    expect(
      new Headers(tokenInit.headers).get("Authorization")?.startsWith("Basic ")
    ).toBe(true);
  });

  it("confirma o sub OAuth mesmo quando o profile scope só devolve a identidade", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sub: "1516563360", picture: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1516563360,
            name: "RobloxPlayer",
            displayName: "Jogador Roblox",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveRobloxIdentity("access-token-valido")).resolves.toEqual(
      {
        providerUserId: "1516563360",
        username: "RobloxPlayer",
        displayName: "Jogador Roblox",
        avatarUrl: null,
        profileUrl: "https://www.roblox.com/users/1516563360/profile",
      }
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://users.roblox.com/v1/users/1516563360"
    );
  });

  it("mantém a conta confirmada se a consulta pública de nome falhar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sub: "261" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockRejectedValueOnce(new Error("rede indisponível"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveRobloxIdentity("access-token-valido")).resolves.toEqual(
      {
        providerUserId: "261",
        username: "roblox-261",
        displayName: null,
        avatarUrl: null,
        profileUrl: "https://www.roblox.com/users/261/profile",
      }
    );
  });
});
