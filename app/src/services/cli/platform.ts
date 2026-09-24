export type DetectedPlatform = {
  os: "linux" | "windows" | "macos" | "unknown";
  architecture: "x64" | "arm64" | "unknown";
  isMobile: boolean;
};

type UserAgentData = {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, string>>;
};

type NavigatorWithHints = Navigator & {
  userAgentData?: UserAgentData;
};

function getNavigator(): NavigatorWithHints | null {
  return typeof navigator === "undefined"
    ? null
    : (navigator as NavigatorWithHints);
}

function mobileFromText(value: string): boolean {
  return /android|iphone|ipad|ipod|mobile|tablet/i.test(value);
}

function osFromText(value: string): DetectedPlatform["os"] {
  if (/android|iphone|ipad|ipod/i.test(value)) return "unknown";
  if (/windows|win32|win64/i.test(value)) return "windows";
  if (/macintosh|mac os x|macos|darwin/i.test(value)) return "macos";
  if (/linux/i.test(value)) return "linux";
  return "unknown";
}

function architectureFromText(value: string): DetectedPlatform["architecture"] {
  if (/aarch64|arm64|armv8|apple silicon|silicon/i.test(value)) {
    return "arm64";
  }
  if (/x86[_-]?64|amd64|x64|win64|intel/i.test(value)) return "x64";
  return "unknown";
}

function normalizeOs(value: string | undefined): DetectedPlatform["os"] {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (normalized === "windows") return "windows";
  if (normalized === "macos" || normalized === "mac os x") return "macos";
  if (normalized === "linux") return "linux";
  return "unknown";
}

function normalizeArchitecture(
  value: string | undefined,
  bitness?: string
): DetectedPlatform["architecture"] {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (
    normalized === "arm64" ||
    normalized === "aarch64" ||
    (normalized === "arm" && bitness === "64")
  ) {
    return "arm64";
  }
  if (normalized === "x86" || normalized === "x64" || normalized === "amd64") {
    return "x64";
  }
  return "unknown";
}

export function detectPlatform(): DetectedPlatform {
  const currentNavigator = getNavigator();
  if (!currentNavigator) {
    return { os: "unknown", architecture: "unknown", isMobile: false };
  }
  const userAgent = currentNavigator.userAgent ?? "";
  const userAgentData = currentNavigator.userAgentData;
  const dataPlatform = normalizeOs(userAgentData?.platform);
  const os = dataPlatform !== "unknown" ? dataPlatform : osFromText(userAgent);
  const userAgentArchitecture = architectureFromText(userAgent);
  const architecture =
    os === "macos" && /intel mac/i.test(userAgent)
      ? "unknown"
      : userAgentArchitecture !== "unknown"
        ? userAgentArchitecture
        : normalizeArchitecture(userAgentData?.platform);
  return {
    os,
    architecture,
    isMobile: mobileFromText(`${userAgent} ${userAgentData?.platform ?? ""}`),
  };
}

export async function refinePlatform(): Promise<DetectedPlatform> {
  const base = detectPlatform();
  const currentNavigator = getNavigator();
  const getHighEntropyValues =
    currentNavigator?.userAgentData?.getHighEntropyValues;
  if (!getHighEntropyValues) return base;

  try {
    const hints = await getHighEntropyValues.call(
      currentNavigator?.userAgentData,
      ["architecture", "bitness", "platform"]
    );
    const hintedOs = normalizeOs(hints.platform);
    const hintedArchitecture = normalizeArchitecture(
      hints.architecture,
      hints.bitness
    );
    return {
      os: hintedOs === "unknown" ? base.os : hintedOs,
      architecture:
        hintedArchitecture === "unknown"
          ? base.architecture
          : hintedArchitecture,
      isMobile: base.isMobile,
    };
  } catch {
    return base;
  }
}
