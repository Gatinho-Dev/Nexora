import {
  Apple,
  Check,
  Download,
  ExternalLink,
  FolderDown,
  Monitor,
  PackageCheck,
  Terminal,
} from "lucide-react";
import type { CliRelease, CliReleaseAsset } from "@contracts/cliReleases";
import {
  formatAssetName,
  formatBytes,
  groupCliAssets,
  platformNames,
} from "@/services/cli/downloads";

type CliReleaseCardProps = {
  release: CliRelease;
  latest?: boolean;
};

function formatReleaseDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ReleasePlatformIcon({
  platform,
}: {
  platform: CliReleaseAsset["platform"];
}) {
  if (platform === "macos") return <Apple size={15} aria-hidden="true" />;
  if (platform === "windows") return <Monitor size={15} aria-hidden="true" />;
  if (platform === "linux") return <Terminal size={15} aria-hidden="true" />;
  return <FolderDown size={15} aria-hidden="true" />;
}

export function CliReleaseCard({
  release,
  latest = false,
}: CliReleaseCardProps) {
  const groups = groupCliAssets(release.assets);
  return (
    <article className={`nexora-cli-release-card${latest ? " is-latest" : ""}`}>
      <div className="nexora-cli-release-card-header">
        <div>
          <div className="nexora-cli-release-version-row">
            <h2>{release.tag}</h2>
            {latest && (
              <span className="nexora-cli-latest-badge">
                <Check size={12} aria-hidden="true" /> Latest
              </span>
            )}
            {release.prerelease && (
              <span className="nexora-cli-prerelease-badge">Pré-release</span>
            )}
          </div>
          <p className="nexora-cli-release-date">
            {formatReleaseDate(release.publishedAt)}
          </p>
        </div>
        <a
          className="nexora-cli-release-github"
          href={release.htmlUrl}
          target="_blank"
          rel="noreferrer"
        >
          Ver no GitHub
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>

      {release.notes && (
        <p className="nexora-cli-release-notes">{release.notes}</p>
      )}

      {groups.length > 0 ? (
        <div className="nexora-cli-release-platforms">
          {groups.map(group => (
            <section
              className="nexora-cli-release-platform"
              key={group.platform}
            >
              <div className="nexora-cli-release-platform-title">
                <span>
                  <ReleasePlatformIcon platform={group.platform} />
                  {platformNames[group.platform]}
                </span>
                <span>
                  {group.assets.length}{" "}
                  {group.assets.length === 1 ? "download" : "downloads"}
                </span>
              </div>
              <div className="nexora-cli-release-assets">
                {group.assets.map(asset => (
                  <a
                    className="nexora-cli-release-asset"
                    key={asset.id}
                    href={asset.downloadUrl}
                    download
                    aria-label={`Baixar ${asset.name}`}
                  >
                    <span>
                      <strong>{formatAssetName(asset)}</strong>
                      <small>
                        {asset.name} · {formatBytes(asset.size)}
                      </small>
                    </span>
                    <Download size={15} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="nexora-cli-release-empty">
          <PackageCheck size={18} aria-hidden="true" />
          <span>Nenhum instalador foi anexado a esta versão.</span>
        </div>
      )}
    </article>
  );
}
