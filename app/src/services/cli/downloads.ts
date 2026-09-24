import type {
  CliArchitecture,
  CliAssetFormat,
  CliPlatform,
  CliRelease,
  CliReleaseAsset,
} from "@contracts/cliReleases";
import type { DetectedPlatform } from "@/services/cli/platform";

export const supportedCliPlatforms: CliPlatform[] = [
  "linux",
  "windows",
  "macos",
];

export const platformNames: Record<CliPlatform, string> = {
  linux: "Linux",
  windows: "Windows",
  macos: "macOS",
  unknown: "Outros formatos",
};

export const platformOrder: Record<CliPlatform, number> = {
  linux: 0,
  windows: 1,
  macos: 2,
  unknown: 3,
};

const formatPriority: Record<CliAssetFormat, number> = {
  deb: 0,
  rpm: 1,
  appimage: 2,
  exe: 0,
  msi: 1,
  zip: 2,
  dmg: 0,
  pkg: 1,
  "tar.gz": 3,
  binary: 4,
  other: 5,
};

export type CliAssetGroup = {
  platform: CliPlatform;
  assets: CliReleaseAsset[];
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatArchitecture(architecture: CliArchitecture): string {
  if (architecture === "x64") return "x64";
  if (architecture === "arm64") return "ARM64";
  return "arquitetura detectada";
}

export function formatAssetName(asset: CliReleaseAsset): string {
  const architecture =
    asset.architecture === "unknown"
      ? ""
      : ` · ${formatArchitecture(asset.architecture)}`;
  return `${asset.label}${architecture}`;
}

export function groupCliAssets(assets: CliReleaseAsset[]): CliAssetGroup[] {
  const groups = new Map<CliPlatform, CliReleaseAsset[]>();
  for (const asset of assets) {
    const current = groups.get(asset.platform) ?? [];
    current.push(asset);
    groups.set(asset.platform, current);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => platformOrder[left] - platformOrder[right])
    .map(([platform, platformAssets]) => ({
      platform,
      assets: platformAssets.sort((left, right) => {
        const formatDifference =
          formatPriority[left.format] - formatPriority[right.format];
        if (formatDifference !== 0) return formatDifference;
        return left.name.localeCompare(right.name);
      }),
    }));
}

export function getRecommendedAsset(
  release: CliRelease | null,
  detected: DetectedPlatform
): CliReleaseAsset | null {
  if (!release || detected.isMobile || detected.os === "unknown") return null;
  const platformAssets = release.assets.filter(
    asset => asset.platform === detected.os
  );
  if (platformAssets.length === 0) return null;

  const knownArchitectures = [
    ...new Set(
      platformAssets
        .map(asset => asset.architecture)
        .filter(
          (architecture): architecture is CliArchitecture =>
            architecture !== "unknown"
        )
    ),
  ];
  const architecture =
    detected.architecture !== "unknown"
      ? detected.architecture
      : knownArchitectures.length === 1
        ? knownArchitectures[0]
        : "unknown";
  if (architecture === "unknown" && knownArchitectures.length > 1) return null;

  const matching = platformAssets.filter(
    asset => architecture === "unknown" || asset.architecture === architecture
  );
  return (
    matching.sort((left, right) => {
      const formatDifference =
        formatPriority[left.format] - formatPriority[right.format];
      if (formatDifference !== 0) return formatDifference;
      return left.name.localeCompare(right.name);
    })[0] ?? null
  );
}

export function hasPlatformAssets(
  assets: CliReleaseAsset[],
  platform: CliPlatform
): boolean {
  return assets.some(asset => asset.platform === platform);
}

export function getReleaseInstallCommand(
  asset: CliReleaseAsset | null
): string | null {
  if (!asset) return null;
  if (asset.platform === "linux" && asset.format === "deb") {
    return `sudo apt install ./${asset.name}`;
  }
  if (asset.platform === "macos" && asset.format === "tar.gz") {
    return "tar -xzf <arquivo>.tar.gz";
  }
  return null;
}
