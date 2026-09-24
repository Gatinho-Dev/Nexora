import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildResponse,
  clearCliReleasesCache,
  getCliReleases,
  parseCliAsset,
  type GithubAsset,
  type GithubRelease,
} from "./cliReleases";

const repository = "Gatinho-Dev/Nexora";

beforeEach(() => {
  clearCliReleasesCache();
});

afterEach(() => {
  vi.useRealTimers();
});

function asset(
  name: string,
  overrides: Partial<GithubAsset> = {}
): GithubAsset {
  return {
    id: Math.floor(Math.random() * 100000),
    name,
    browser_download_url: `https://github.com/${repository}/releases/download/v1.2.3/${name}`,
    size: 1024,
    content_type: "application/octet-stream",
    ...overrides,
  };
}

function release(overrides: Partial<GithubRelease> = {}): GithubRelease {
  return {
    id: 1,
    tag_name: "v1.2.3",
    name: "v1.2.3",
    draft: false,
    prerelease: false,
    created_at: "2026-09-20T10:00:00Z",
    published_at: "2026-09-20T10:00:00Z",
    html_url: `https://github.com/${repository}/releases/tag/v1.2.3`,
    body: "**Correções** para a TUI.",
    assets: [],
    ...overrides,
  };
}

describe("parseCliAsset", () => {
  it("normalizes the Linux deb package", () => {
    const parsed = parseCliAsset(asset("nexora-cli_1.2.3_amd64.deb"));
    expect(parsed).toMatchObject({
      platform: "linux",
      architecture: "x64",
      format: "deb",
      label: "Debian / Ubuntu",
    });
  });

  it("normalizes the Windows executable", () => {
    const parsed = parseCliAsset(asset("NexoraCLI-1.2.3-x64.exe"));
    expect(parsed).toMatchObject({
      platform: "windows",
      architecture: "x64",
      format: "exe",
      label: "Windows",
    });
  });

  it("normalizes the canonical macOS asset names", () => {
    expect(parseCliAsset(asset("nexora-cli-macos-arm64.tar.gz"))).toMatchObject(
      {
        platform: "macos",
        architecture: "arm64",
        label: "Apple Silicon",
      }
    );
  });

  it("infers macOS for legacy architecture-only tarballs", () => {
    const linux = asset("nexora-cli-linux-x64.tar.gz");
    const mac = asset("nexora-cli-1.2.3-x64.tar.gz");
    const parsed = parseCliAsset(mac, [linux, mac]);
    expect(parsed).toMatchObject({
      platform: "macos",
      architecture: "x64",
      format: "tar.gz",
      label: "Intel",
    });
  });

  it("ignores checksums and non-official URLs", () => {
    expect(parseCliAsset(asset("checksums-sha256.txt"))).toBeNull();
    expect(
      parseCliAsset(
        asset("nexora-cli-linux-x64.tar.gz", {
          browser_download_url:
            "https://example.com/nexora-cli-linux-x64.tar.gz",
        })
      )
    ).toBeNull();
  });
});

describe("getCliReleases", () => {
  it("reuses the in-memory release cache", async () => {
    let calls = 0;
    const payload = [
      release({ assets: [asset("nexora-cli_1.2.3_amd64.deb")] }),
    ];
    const fetcher = async () => {
      calls += 1;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ETag: "release-1" },
      });
    };

    const first = await getCliReleases(fetcher);
    const second = await getCliReleases(fetcher);

    expect(first.latestStable?.tag).toBe("v1.2.3");
    expect(second.latestStable?.tag).toBe("v1.2.3");
    expect(calls).toBe(1);
  });

  it("serves stale data when GitHub becomes unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    const payload = [
      release({ assets: [asset("nexora-cli_1.2.3_amd64.deb")] }),
    ];
    await getCliReleases(
      async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ETag: "release-1" },
        })
    );

    vi.setSystemTime(new Date("2026-09-23T10:06:00Z"));
    const result = await getCliReleases(
      async () => new Response("unavailable", { status: 503 })
    );

    expect(result.stale).toBe(true);
    expect(result.latestStable?.tag).toBe("v1.2.3");
  });
});

describe("buildResponse", () => {
  it("uses the newest stable release with assets and keeps prereleases out of latest", () => {
    const stable = release({
      id: 2,
      tag_name: "v1.2.3",
      published_at: "2026-09-22T10:00:00Z",
      assets: [asset("nexora-cli_1.2.3_amd64.deb")],
    });
    const beta = release({
      id: 3,
      tag_name: "v1.3.0-beta.1",
      prerelease: true,
      published_at: "2026-09-23T10:00:00Z",
      assets: [asset("nexora-cli-1.3.0-beta.1-linux-x64.tar.gz")],
    });
    const webOnly = release({
      id: 4,
      tag_name: "v9.0.0",
      name: "Nexora Web",
      published_at: "2026-09-24T10:00:00Z",
      assets: [asset("nexora-web-9.0.0.zip")],
    });
    const result = buildResponse([webOnly, beta, stable], Date.now(), false);
    expect(result.latestStable?.tag).toBe("v1.2.3");
    expect(result.releases.map(item => item.tag)).toEqual([
      "v1.3.0-beta.1",
      "v1.2.3",
    ]);
    expect(result.releases[1]?.assets[0]?.platform).toBe("linux");
  });

  it("does not expose a draft release", () => {
    const result = buildResponse(
      [
        release({
          draft: true,
          assets: [asset("nexora-cli-linux-x64.tar.gz")],
        }),
      ],
      Date.now(),
      false
    );
    expect(result.releases).toHaveLength(0);
    expect(result.latestStable).toBeNull();
  });
});
