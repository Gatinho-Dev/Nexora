import { describe, expect, it } from "vitest";
import type { CliRelease, CliReleaseAsset } from "@contracts/cliReleases";
import { getRecommendedAsset, groupCliAssets } from "./downloads";

function makeAsset(
  id: number,
  platform: CliReleaseAsset["platform"],
  architecture: CliReleaseAsset["architecture"],
  format: CliReleaseAsset["format"],
  name = `nexora-${id}`
): CliReleaseAsset {
  return {
    id,
    name,
    downloadUrl: `https://github.com/Gatinho-Dev/Nexora/releases/download/v1.0.0/${name}`,
    size: 1024,
    contentType: null,
    platform,
    architecture,
    format,
    label:
      platform === "macos"
        ? architecture === "arm64"
          ? "Apple Silicon"
          : "Intel"
        : platform === "linux"
          ? "Linux"
          : platform === "windows"
            ? "Windows"
            : "Outro formato",
  };
}

function makeRelease(assets: CliReleaseAsset[]): CliRelease {
  return {
    id: 1,
    tag: "v1.0.0",
    version: "1.0.0",
    name: "v1.0.0",
    publishedAt: "2026-09-23T00:00:00Z",
    createdAt: "2026-09-23T00:00:00Z",
    htmlUrl: "https://github.com/Gatinho-Dev/Nexora/releases/tag/v1.0.0",
    notes: null,
    prerelease: false,
    assets,
  };
}

describe("CLI download selection", () => {
  it("prioritizes deb for Linux x64", () => {
    const release = makeRelease([
      makeAsset(1, "linux", "x64", "tar.gz"),
      makeAsset(2, "linux", "x64", "deb"),
      makeAsset(3, "linux", "arm64", "tar.gz"),
    ]);
    expect(
      getRecommendedAsset(release, {
        os: "linux",
        architecture: "x64",
        isMobile: false,
      })?.format
    ).toBe("deb");
  });

  it("does not recommend a desktop build for mobile", () => {
    const release = makeRelease([makeAsset(1, "linux", "x64", "deb")]);
    expect(
      getRecommendedAsset(release, {
        os: "linux",
        architecture: "x64",
        isMobile: true,
      })
    ).toBeNull();
  });

  it("does not guess when an OS has multiple architectures", () => {
    const release = makeRelease([
      makeAsset(1, "macos", "x64", "tar.gz"),
      makeAsset(2, "macos", "arm64", "tar.gz"),
    ]);
    expect(
      getRecommendedAsset(release, {
        os: "macos",
        architecture: "unknown",
        isMobile: false,
      })
    ).toBeNull();
  });

  it("groups every available platform for the menu", () => {
    const groups = groupCliAssets([
      makeAsset(1, "linux", "x64", "deb"),
      makeAsset(2, "windows", "x64", "exe"),
      makeAsset(3, "macos", "arm64", "tar.gz"),
    ]);
    expect(groups.map(group => group.platform)).toEqual([
      "linux",
      "windows",
      "macos",
    ]);
  });
});
