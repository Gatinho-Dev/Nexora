import { z } from "zod";

export const CLI_REPOSITORY_OWNER = "Gatinho-Dev";
export const CLI_REPOSITORY_NAME = "Nexora";
export const CLI_REPOSITORY_URL = `https://github.com/${CLI_REPOSITORY_OWNER}/${CLI_REPOSITORY_NAME}`;
export const CLI_RELEASES_URL = `${CLI_REPOSITORY_URL}/releases`;

export const cliPlatformSchema = z.enum([
  "linux",
  "windows",
  "macos",
  "unknown",
]);
export const cliArchitectureSchema = z.enum(["x64", "arm64", "unknown"]);
export const cliAssetFormatSchema = z.enum([
  "deb",
  "rpm",
  "appimage",
  "exe",
  "msi",
  "zip",
  "tar.gz",
  "dmg",
  "pkg",
  "binary",
  "other",
]);

export const cliReleaseAssetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  downloadUrl: z.string().url(),
  size: z.number().int().nonnegative(),
  contentType: z.string().nullable(),
  platform: cliPlatformSchema,
  architecture: cliArchitectureSchema,
  format: cliAssetFormatSchema,
  label: z.string(),
});

export const cliReleaseSchema = z.object({
  id: z.number().int(),
  tag: z.string(),
  version: z.string(),
  name: z.string(),
  publishedAt: z.string(),
  createdAt: z.string(),
  htmlUrl: z.string().url(),
  notes: z.string().nullable(),
  prerelease: z.boolean(),
  assets: z.array(cliReleaseAssetSchema),
});

export const cliReleasesResponseSchema = z.object({
  repository: z.string(),
  fetchedAt: z.string(),
  stale: z.boolean(),
  releases: z.array(cliReleaseSchema),
  latestStable: cliReleaseSchema.nullable(),
  fallbackUrl: z.string().url(),
});

export type CliPlatform = z.infer<typeof cliPlatformSchema>;
export type CliArchitecture = z.infer<typeof cliArchitectureSchema>;
export type CliAssetFormat = z.infer<typeof cliAssetFormatSchema>;
export type CliReleaseAsset = z.infer<typeof cliReleaseAssetSchema>;
export type CliRelease = z.infer<typeof cliReleaseSchema>;
export type CliReleasesResponse = z.infer<typeof cliReleasesResponseSchema>;
export type CliOperatingSystem = CliPlatform;
