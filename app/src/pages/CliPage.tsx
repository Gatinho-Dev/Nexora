import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Github,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Link } from "react-router";
import { Seo } from "@/lib/seo";
import { CLI_RELEASES_URL, CLI_REPOSITORY_URL } from "@contracts/cliReleases";
import { useCliReleases } from "@/hooks/useCliReleases";
import {
  detectPlatform,
  refinePlatform,
  type DetectedPlatform,
} from "@/services/cli/platform";
import { CliDownloadButton } from "@/components/cli/CliDownloadButton";
import { CliFeatureGrid } from "@/components/cli/CliFeatureGrid";
import { CliInstallSection } from "@/components/cli/CliInstallSection";
import { CliSiteShell } from "@/components/cli/CliSiteShell";
import { CliTerminalPreview } from "@/components/cli/CliTerminalPreview";
import "./CliPage.css";

export default function CliPage() {
  const [platform, setPlatform] = useState<DetectedPlatform>(() =>
    detectPlatform()
  );
  const releasesQuery = useCliReleases();
  const stableRelease = releasesQuery.data?.latestStable ?? null;

  useEffect(() => {
    let active = true;
    void refinePlatform().then(nextPlatform => {
      if (active) setPlatform(nextPlatform);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Seo
        title="Nexora CLI"
        description="Baixe o Nexora CLI oficial para Linux, Windows e macOS e use o Nexora diretamente no seu terminal."
        canonicalPath="/cli"
      />
      <CliSiteShell>
        <section className="nexora-cli-hero">
          <div className="nexora-cli-shell nexora-cli-hero-grid">
            <div className="nexora-cli-hero-copy">
              <div className="nexora-cli-hero-status">
                <span className="nexora-cli-status-dot" aria-hidden="true" />
                Cliente oficial para PC
              </div>
              <h1>Nexora CLI</h1>
              <p className="nexora-cli-hero-subtitle">
                O Nexora direto no seu terminal.
              </p>
              <p className="nexora-cli-hero-description">
                Converse, navegue pelos seus servidores e acompanhe suas
                mensagens com uma experiência rápida, leve e totalmente
                integrada ao Nexora.
              </p>

              <CliDownloadButton
                release={stableRelease}
                detected={platform}
                loading={releasesQuery.isPending}
                error={releasesQuery.error ?? null}
              />

              <div className="nexora-cli-hero-meta" aria-live="polite">
                {releasesQuery.isPending ? (
                  <span>Consultando a release estável mais recente...</span>
                ) : stableRelease ? (
                  <span>
                    <span className="nexora-cli-meta-version">
                      {stableRelease.tag}
                    </span>
                    <span>·</span>
                    <span>GitHub Releases</span>
                  </span>
                ) : releasesQuery.isError ? (
                  <span>
                    Use o GitHub Releases para acessar os arquivos oficiais.
                  </span>
                ) : (
                  <span>
                    Nenhum instalador foi publicado na release estável.
                  </span>
                )}
                <span className="nexora-cli-meta-divider" aria-hidden="true" />
                <span>Linux · Windows · macOS</span>
              </div>

              {platform.isMobile && (
                <div className="nexora-cli-mobile-notice" role="note">
                  <Terminal size={17} aria-hidden="true" />
                  <span>
                    O Nexora CLI é para computador. Abra esta página no PC em
                    que ele será instalado.
                  </span>
                </div>
              )}

              {releasesQuery.isError && (
                <p className="nexora-cli-inline-error" role="status">
                  Não foi possível carregar as versões mais recentes. Você ainda
                  pode acessar os downloads oficiais no GitHub.
                </p>
              )}
              {releasesQuery.data?.stale && (
                <p className="nexora-cli-cache-notice" role="status">
                  Exibindo a última versão salva em cache enquanto o GitHub se
                  reconecta.
                </p>
              )}
            </div>

            <div className="nexora-cli-hero-preview">
              <div
                className="nexora-cli-preview-orbit orbit-one"
                aria-hidden="true"
              />
              <div
                className="nexora-cli-preview-orbit orbit-two"
                aria-hidden="true"
              />
              <CliTerminalPreview />
              <div className="nexora-cli-preview-caption">
                <span
                  className="nexora-cli-preview-caption-line"
                  aria-hidden="true"
                />
                <span>Uma TUI enxuta para o que importa: conversar.</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="nexora-cli-ribbon"
          aria-label="Plataformas suportadas"
        >
          <div className="nexora-cli-shell nexora-cli-ribbon-inner">
            <span>Rápido. Leve. Realtime.</span>
            <span className="nexora-cli-ribbon-separator" aria-hidden="true" />
            <span>Uma experiência nativa do Nexora, fora do navegador.</span>
            <span className="nexora-cli-ribbon-separator" aria-hidden="true" />
            <span>Linux · Windows · macOS</span>
          </div>
        </section>

        <section
          className="nexora-cli-section nexora-cli-why-section"
          id="por-que"
        >
          <div className="nexora-cli-shell">
            <div className="nexora-cli-section-heading">
              <p className="nexora-cli-kicker">FEITO PARA O SEU FLUXO</p>
              <h2>Por que usar o Nexora CLI?</h2>
              <p>
                A mesma conta, as mesmas conversas e a mesma experiência em um
                cliente pensado para o terminal.
              </p>
            </div>
            <CliFeatureGrid />
          </div>
        </section>

        <CliInstallSection release={stableRelease} detected={platform} />

        <section className="nexora-cli-section nexora-cli-login-section">
          <div className="nexora-cli-shell nexora-cli-login-grid">
            <div className="nexora-cli-login-visual" aria-hidden="true">
              <div className="nexora-cli-login-command">
                <span>$</span> nexora
              </div>
              <div className="nexora-cli-login-flow">
                <div>
                  <span>01</span> Terminal
                </div>
                <div>
                  <span>02</span> Navegador
                </div>
                <div>
                  <span>03</span> Nexora
                </div>
              </div>
            </div>
            <div className="nexora-cli-section-heading is-left">
              <h2>Entre sem compartilhar sua senha.</h2>
              <p>
                Execute <code>nexora</code> no terminal. O cliente abre o fluxo
                de autorização no navegador para você entrar na sua conta com
                segurança.
              </p>
              <div className="nexora-cli-login-points">
                <div>
                  <LockKeyhole size={17} aria-hidden="true" />
                  <span>O código aparece no terminal e expira.</span>
                </div>
                <div>
                  <ShieldCheck size={17} aria-hidden="true" />
                  <span>A aprovação acontece na sua conta Nexora.</span>
                </div>
                <div>
                  <MessageCircle size={17} aria-hidden="true" />
                  <span>Depois disso, volte ao terminal e continue.</span>
                </div>
              </div>
              <Link className="nexora-cli-text-link" to="/login">
                Abrir o Nexora
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="nexora-cli-section nexora-cli-update-section">
          <div className="nexora-cli-shell nexora-cli-update-grid">
            <div className="nexora-cli-section-heading is-left">
              <h2>Sempre conectado às versões oficiais.</h2>
              <p>
                O Nexora CLI verifica novas versões no GitHub Releases e informa
                quando uma nova versão está disponível. A instalação pode pedir
                confirmação do sistema, por isso a atualização não é silenciosa.
              </p>
            </div>
            <div className="nexora-cli-update-card">
              <div className="nexora-cli-update-icon">
                <RefreshCw size={20} aria-hidden="true" />
              </div>
              <div>
                <span>Canal estável</span>
                <strong>{stableRelease?.tag ?? "Consulte o GitHub"}</strong>
              </div>
              <Check
                className="nexora-cli-update-check"
                size={18}
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        <section className="nexora-cli-section nexora-cli-official-section">
          <div className="nexora-cli-shell nexora-cli-official-card">
            <div className="nexora-cli-official-mark">
              <Github size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="nexora-cli-kicker">FONTE OFICIAL</p>
              <h2>Downloads oficiais, sem espelhos.</h2>
              <p>
                Todos os instaladores do Nexora CLI são publicados nas GitHub
                Releases oficiais do Nexora. O site apenas aponta para os
                arquivos reais.
              </p>
            </div>
            <div className="nexora-cli-official-actions">
              <a href={CLI_RELEASES_URL} target="_blank" rel="noreferrer">
                Ver GitHub Releases
                <ExternalLink size={15} aria-hidden="true" />
              </a>
              <a href={CLI_REPOSITORY_URL} target="_blank" rel="noreferrer">
                Ver código-fonte
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </CliSiteShell>
    </>
  );
}
