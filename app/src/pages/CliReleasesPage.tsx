import {
  ArrowLeft,
  ExternalLink,
  Github,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router";
import { Seo } from "@/lib/seo";
import { CLI_RELEASES_URL, CLI_REPOSITORY_URL } from "@contracts/cliReleases";
import { useCliReleases } from "@/hooks/useCliReleases";
import { CliReleaseCard } from "@/components/cli/CliReleaseCard";
import { CliSiteShell } from "@/components/cli/CliSiteShell";

export default function CliReleasesPage() {
  const releasesQuery = useCliReleases();
  const releases = releasesQuery.data?.releases ?? [];
  const latestTag = releasesQuery.data?.latestStable?.tag;

  return (
    <>
      <Seo
        title="Nexora CLI Releases"
        description="Consulte as versões publicadas e baixe os artefatos oficiais do Nexora CLI para Linux, Windows e macOS."
        canonicalPath="/cli/releases"
      />
      <CliSiteShell active="releases">
        <section className="nexora-cli-releases-hero">
          <div className="nexora-cli-shell">
            <Link className="nexora-cli-back-link" to="/cli">
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar para o Nexora CLI
            </Link>
            <p className="nexora-cli-kicker">CENTRAL DE VERSÕES</p>
            <h1>Releases do Nexora CLI</h1>
            <p>
              Todas as versões publicadas, com os artefatos reais disponíveis
              nas GitHub Releases oficiais.
            </p>
            <div className="nexora-cli-releases-actions">
              <a href={CLI_RELEASES_URL} target="_blank" rel="noreferrer">
                <Github size={16} aria-hidden="true" />
                Abrir GitHub Releases
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <a href={CLI_REPOSITORY_URL} target="_blank" rel="noreferrer">
                Código-fonte
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="nexora-cli-section nexora-cli-releases-section">
          <div className="nexora-cli-shell">
            {releasesQuery.isPending ? (
              <div className="nexora-cli-releases-loading" aria-busy="true">
                <div className="nexora-cli-loading-bar" />
                <div className="nexora-cli-loading-card" />
                <div className="nexora-cli-loading-card" />
                <span role="status">Carregando downloads...</span>
              </div>
            ) : releasesQuery.isError ? (
              <div className="nexora-cli-releases-error" role="alert">
                <div className="nexora-cli-releases-error-icon">
                  <RefreshCw size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2>Não foi possível carregar as versões mais recentes.</h2>
                  <p>
                    Você ainda pode acessar os downloads oficiais no GitHub.
                  </p>
                </div>
                <a href={CLI_RELEASES_URL} target="_blank" rel="noreferrer">
                  Abrir GitHub Releases
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </div>
            ) : releases.length === 0 ? (
              <div className="nexora-cli-releases-empty">
                <Loader2 size={20} aria-hidden="true" />
                <h2>Nenhuma versão publicada.</h2>
                <p>
                  Quando o CLI ganhar uma release, ela aparecerá aqui
                  automaticamente.
                </p>
              </div>
            ) : (
              <>
                <div className="nexora-cli-releases-toolbar">
                  <div>
                    <span className="nexora-cli-release-count">
                      {releases.length}{" "}
                      {releases.length === 1 ? "versão" : "versões"}
                    </span>
                    {latestTag && <span>Latest estável: {latestTag}</span>}
                  </div>
                  {releasesQuery.data?.stale && (
                    <span className="nexora-cli-cache-badge">
                      Dados em cache
                    </span>
                  )}
                </div>
                <div className="nexora-cli-release-list">
                  {releases.map(release => (
                    <CliReleaseCard
                      key={release.id}
                      release={release}
                      latest={release.tag === latestTag}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </CliSiteShell>
    </>
  );
}
