import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPlatform, refinePlatform } from "./platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectPlatform", () => {
  it("detects Linux x64 from the user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    });
    expect(detectPlatform()).toEqual({
      os: "linux",
      architecture: "x64",
      isMobile: false,
    });
  });

  it("does not recommend a desktop build on Android", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile)",
      userAgentData: { platform: "Android" },
    });
    expect(detectPlatform()).toEqual({
      os: "unknown",
      architecture: "unknown",
      isMobile: true,
    });
  });

  it("uses high entropy hints for Apple Silicon", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      userAgentData: {
        platform: "macOS",
        getHighEntropyValues: async () => ({
          architecture: "arm",
          bitness: "64",
          platform: "macOS",
        }),
      },
    });
    expect(await refinePlatform()).toEqual({
      os: "macos",
      architecture: "arm64",
      isMobile: false,
    });
  });
});
