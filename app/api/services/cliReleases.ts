import { z } from "zod";
import {
  CLI_RELEASES_URL,
  CLI_REPOSITORY_NAME,
  CLI_REPOSITORY_OWNER,
  type CliArchitecture,
  type CliAssetFormat,
  type CliPlatform,
  type CliRelease,
  type CliReleaseAsset,
  type CliReleasesResponse,
} from "@contracts/cliReleases";

const githubAssetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  browser_download_url: z.string().url(),
  size: z.number().int().nonnegative(),
  content_type: z.string().nullable(),
});

const githubReleaseSchema = z.object({
  id: z.number().int(),
  tag_name: z.string(),
  name: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  created_at: z.string(),
  published_at: z.string().nullable(),
  html_url: z.string().url(),
  body: z.string().nullable(),
  assets: z.array(githubAssetSchema),
});

const githubReleasesSchema = z.array(githubReleaseSchema);
type GithubAsset = z.infer<typeof githubAssetSchema>;
type GithubRelease = z.infer<typeof githubReleaseSchema>;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const repository = `${CLI_REPOSITORY_OWNER}/${CLI_REPOSITORY_NAME}`;

type CacheEntry = {
  data: CliReleasesResponse;
  etag: string | null;
  fetchedAt: number;
};

let cache: CacheEntry | null = null;
let inFlight: Promise<CliReleasesResponse> | null = null;

function isOfficialReleaseAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["github.com", "www.github.com"].includes(url.hostname.toLowerCase()) &&
      url.pathname.startsWith(`/${repository}/releases/download/`)
    );
  } catch {
    return false;
  }
}

function isOfficialReleaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["github.com", "www.github.com"].includes(url.hostname.toLowerCase()) &&
      url.pathname.startsWith(`/${repository}/releases/tag/`)
    );
  } catch {
    return false;
  }
}

function cleanReleaseNotes(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 4000) : null;
}

function versionFromTag(tag: string): string {
  const match = tag.match(/(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)/);
  return match?.[1] ?? tag.replace(/^cli[-_]?/i, "");
}

function formatFromName(name: string): CliAssetFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz";
  if (lower.endsWith(".deb")) return "deb";
  if (lower.endsWith(".rpm")) return "rpm";
  if (lower.endsWith(".appimage")) return "appimage";
  if (lower.endsWith(".exe")) return "exe";
  if (lower.endsWith(".msi")) return "msi";
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".dmg")) return "dmg";
  if (lower.endsWith(".pkg")) return "pkg";
  if (lower.endsWith("/nexora") || lower.endsWith("\\nexora")) return "binary";
  return "other";
}

function architectureFromName(name: string): CliArchitecture {
  const lower = name.toLowerCase();
  if (/(aarch64|arm64|arm-v|apple silicon|silicon)/.test(lower)) {
    return "arm64";
  }
  if (/(x86[_-]?64|amd64|x64|win64|intel)/.test(lower)) return "x64";
  return "unknown";
}

function platformFromName(name: string): CliPlatform {
  const lower = name.toLowerCase();
  if (/(macos|mac-os|mac os|osx|darwin|apple|dmg|pkg)/.test(lower)) {
    return "macos";
  }
  if (/(windows|win32|win64|mingw|msvc|\.exe$|\.msi$)/.test(lower)) {
    return "windows";
  }
  if (
    /(linux|debian|ubuntu|fedora|arch|musl|appimage|\.deb$|\.rpm$)/.test(lower)
  ) {
    return "linux";
  }
  return "unknown";
}

function isLegacyMacArchive(name: string): boolean {
  return /nexora-cli-[\d.]+-(x64|arm64)\.tar\.gz$/i.test(name);
}

function isCliAsset(name: string, format: CliAssetFormat): boolean {
  if (format === "other") return false;
  if (/nexora[-_]?web/i.test(name)) return false;
  return /nexora/i.test(name);
}

function assetLabel(
  platform: CliPlatform,
  architecture: CliArchitecture,
  format: CliAssetFormat
): string {
  if (platform === "linux") {
    if (format === "deb") return "Debian / Ubuntu";
    if (format === "rpm") return "Linux RPM";
    if (format === "appimage") return "AppImage";
    return "Linux";
  }
  if (platform === "windows") return "Windows";
  if (platform === "macos") {
    if (architecture === "arm64") return "Apple Silicon";
    if (architecture === "x64") return "Intel";
    return "macOS";
  }
  return "Outro formato";
}

export function parseCliAsset(
  raw: GithubAsset,
  releaseAssets: GithubAsset[] = [raw]
): CliReleaseAsset | null {
  if (!isOfficialReleaseAssetUrl(raw.browser_download_url)) return null;
  const format = formatFromName(raw.name);
  if (!isCliAsset(raw.name, format)) return null;

  const architecture = architectureFromName(raw.name);
  let platform = platformFromName(raw.name);
  if (
    platform === "unknown" &&
    format === "tar.gz" &&
    architecture !== "unknown" &&
    isLegacyMacArchive(raw.name) &&
    !releaseAssets.some(asset => platformFromName(asset.name) === "macos")
  ) {
    const hasLinuxAsset = releaseAssets.some(
      asset => platformFromName(asset.name) === "linux"
    );
    if (hasLinuxAsset) platform = "macos";
  }

  return {
    id: raw.id,
    name: raw.name,
    downloadUrl: raw.browser_download_url,
    size: raw.size,
    contentType: raw.content_type,
    platform,
    architecture,
    format,
    label: assetLabel(platform, architecture, format),
  };
}

function normalizeRelease(raw: GithubRelease): CliRelease | null {
  if (!isOfficialReleaseUrl(raw.html_url) || raw.draft) return null;
  const assets = raw.assets
    .map(asset => parseCliAsset(asset, raw.assets))
    .filter((asset): asset is CliReleaseAsset => asset !== null);
  const isNamedCliRelease = /cli/i.test(`${raw.tag_name} ${raw.name ?? ""}`);
  if (assets.length === 0 && !isNamedCliRelease) return null;

  const publishedAt = raw.published_at ?? raw.created_at;
  return {
    id: raw.id,
    tag: raw.tag_name,
    version: versionFromTag(raw.tag_name),
    name: raw.name?.trim() || raw.tag_name,
    publishedAt,
    createdAt: raw.created_at,
    htmlUrl: raw.html_url,
    notes: cleanReleaseNotes(raw.body),
    prerelease: raw.prerelease,
    assets,
  };
}

function buildResponse(
  releases: GithubRelease[],
  fetchedAt: number,
  stale: boolean
): CliReleasesResponse {
  const normalized = releases
    .map(normalizeRelease)
    .filter((release): release is CliRelease => release !== null)
    .sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
    );
  const latestStable =
    normalized.find(
      release => !release.prerelease && release.assets.length > 0
    ) ?? null;

  return {
    repository,
    fetchedAt: new Date(fetchedAt).toISOString(),
    stale,
    releases: normalized,
    latestStable,
    fallbackUrl: CLI_RELEASES_URL,
  };
}

export function clearCliReleasesCache(): void {
  cache = null;
  inFlight = null;
}

export async function getCliReleases(
  fetcher: Fetcher = fetch
): Promise<CliReleasesResponse> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { ...cache.data, stale: false };
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "nexora-web-cli-releases",
      };
      const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
      if (token) headers.Authorization = `Bearer ${token}`;
      if (cache?.etag) headers["If-None-Match"] = cache.etag;

      const response = await fetcher(
        `https://api.github.com/repos/${repository}/releases?per_page=100`,
        { headers, signal: controller.signal }
      );
      if (response.status === 304 && cache) {
        const fetchedAt = Date.now();
        const data = {
          ...cache.data,
          fetchedAt: new Date(fetchedAt).toISOString(),
          stale: false,
        };
        cache = { ...cache, data, fetchedAt };
        return data;
      }
      if (!response.ok) {
        throw new Error(`GitHub respondeu com status ${response.status}`);
      }
      const parsed = githubReleasesSchema.parse(await response.json());
      const data = buildResponse(parsed, Date.now(), false);
      cache = {
        data,
        etag: response.headers.get("etag"),
        fetchedAt: Date.now(),
      };
      return data;
    } catch (error) {
      if (cache && Date.now() - cache.fetchedAt <= MAX_STALE_MS) {
        return { ...cache.data, stale: true };
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      inFlight = null;
    }
  })();

  return inFlight;
}

export { buildResponse, githubReleasesSchema };
export type { GithubAsset, GithubRelease };
