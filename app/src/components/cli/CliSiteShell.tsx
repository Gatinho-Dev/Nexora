import { useState, type ReactNode } from "react";
import { ArrowRight, Github, Menu, X } from "lucide-react";
import { Link } from "react-router";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { CLI_RELEASES_URL } from "@contracts/cliReleases";

type CliSiteShellProps = {
  children: ReactNode;
  active?: "cli" | "releases";
};

const navigation = [
  { label: "Visão geral", to: "/cli" },
  { label: "Instalação", to: "/cli#instalacao" },
  { label: "Versões", to: "/cli/releases" },
];

export function CliSiteShell({ children, active = "cli" }: CliSiteShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="nexora-cli-page">
      <a className="nexora-cli-skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="nexora-cli-header">
        <div className="nexora-cli-shell nexora-cli-header-row">
          <Link
            className="nexora-cli-brand"
            to="/"
            aria-label="Nexora"
            onClick={() => setMenuOpen(false)}
          >
            <NexoraAppIcon className="nexora-cli-brand-icon" decorative />
            <span>Nexora</span>
          </Link>

          <nav className="nexora-cli-nav" aria-label="Navegação do Nexora CLI">
            {navigation.map(item => (
              <Link
                key={item.to}
                className={
                  active === "releases" && item.label === "Versões"
                    ? "is-active"
                    : active === "cli" && item.label === "Visão geral"
                      ? "is-active"
                      : undefined
                }
                to={item.to}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="nexora-cli-header-actions">
            <Link className="nexora-cli-login-link" to="/login">
              Entrar
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <button
              className="nexora-cli-menu-button"
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(value => !value)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="nexora-cli-mobile-nav" aria-label="Navegação móvel">
            <div className="nexora-cli-shell">
              {navigation.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                Entrar no Nexora
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main id="conteudo">{children}</main>

      <footer className="nexora-cli-footer">
        <div className="nexora-cli-shell nexora-cli-footer-row">
          <div className="nexora-cli-footer-brand">
            <NexoraAppIcon className="nexora-cli-footer-icon" decorative />
            <span>Nexora CLI</span>
          </div>
          <p>Cliente oficial para o seu computador.</p>
          <a href={CLI_RELEASES_URL} target="_blank" rel="noreferrer">
            <Github size={16} aria-hidden="true" />
            GitHub Releases
          </a>
        </div>
      </footer>
    </div>
  );
}
