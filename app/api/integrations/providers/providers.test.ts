import { describe, expect, it } from "vitest";
import { githubProvider } from "./github";
import { spotifyProvider } from "./spotify";
import { twitchProvider } from "./twitch";
import { youtubeProvider } from "./youtube";

const authorizationInput = {
  state: "state-seguro",
  codeChallenge: "challenge-pkce",
  nonce: "nonce-seguro",
};

describe("external provider authorization", () => {
  it("Spotify mantém state, PKCE e somente scopes de leitura necessários", () => {
    const url = new URL(spotifyProvider.buildAuthorizeUrl(authorizationInput));
    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.searchParams.get("state")).toBe("state-seguro");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-pkce");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).not.toContain("user-library");
  });

  it("YouTube usa conta Google somente para o canal e não inventa presença", () => {
    const url = new URL(youtubeProvider.buildAuthorizeUrl(authorizationInput));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/youtube.readonly"
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(youtubeProvider.fetchPresence).toBeUndefined();
  });

  it("Twitch pede autorização sem scopes de watching", () => {
    const url = new URL(twitchProvider.buildAuthorizeUrl(authorizationInput));
    expect(url.origin).toBe("https://id.twitch.tv");
    expect(url.searchParams.get("state")).toBe("state-seguro");
    expect(url.searchParams.get("scope")).toBe("");
  });

  it("GitHub não solicita acesso a repositórios privados", () => {
    const url = new URL(githubProvider.buildAuthorizeUrl(authorizationInput));
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("state")).toBe("state-seguro");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(githubProvider.fetchPresence).toBeUndefined();
  });
});
