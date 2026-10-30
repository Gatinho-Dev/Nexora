import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Apple,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FolderDown,
  Loader2,
  Monitor,
  Terminal,
} from "lucide-react";
import { Link } from "react-router";
import {
  CLI_RELEASES_URL,
  type CliRelease,
  type CliReleaseAsset,
} from "@contracts/cliReleases";
import {
  formatAssetName,
  formatBytes,
  getRecommendedAsset,
  groupCliAssets,
  platformNames,
  supportedCliPlatforms,
} from "@/services/cli/downloads";
import type { DetectedPlatform } from "@/services/cli/platform";

type CliDownloadButtonProps = {
  release: CliRelease | null;
  detected: DetectedPlatform;
  loading: boolean;
  error: Error | null;
};

function PlatformGlyph({
  platform,
}: {
  platform: CliReleaseAsset["platform"];
}) {
  if (platform === "macos") return <Apple size={16} aria-hidden="true" />;
  if (platform === "windows") return <Monitor size={16} aria-hidden="true" />;
  if (platform === "linux") return <Terminal size={16} aria-hidden="true" />;
  return <FolderDown size={16} aria-hidden="true" />;
}

function menuItemLabel(asset: CliReleaseAsset): string {
  return `${asset.name}, ${formatAssetName(asset)}, ${formatBytes(asset.size)}`;
}

export function CliDownloadButton({
  release,
  detected,
  loading,
  error,
}: CliDownloadButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const menuId = `cli-download-menu-${useId().replace(/:/g, "")}`;
  const assets = release?.assets ?? [];
  const groups = groupCliAssets(assets);
  const recommended = getRecommendedAsset(release, detected);
  const hasAssets = groups.some(group => group.assets.length > 0);
  const missingPlatforms = supportedCliPlatforms.filter(
    platform => !groups.some(group => group.platform === platform)
  );
  const hasError = Boolean(error);
  const primaryLabel = recommended
    ? `Baixar para ${platformNames[detected.os]}`
    : "Escolher download";

  useEffect(() => {
    if (!open) return;
    const firstItem = itemRefs.current.find(item => item !== null);
    firstItem?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [open]);

  const focusMenuItem = (step: 1 | -1) => {
    const items = itemRefs.current.filter(
      (item): item is HTMLAnchorElement => item !== null
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(
      document.activeElement as HTMLAnchorElement
    );
    const nextIndex =
      currentIndex < 0
        ? step === 1
          ? 0
          : items.length - 1
        : (currentIndex + step + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(1);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(-1);
    }
  };

  const openMenu = () => {
    if (hasAssets && !hasError) setOpen(value => !value);
  };

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="nexora-cli-download-control is-disabled" aria-busy="true">
        <div className="nexora-cli-download-main">
          <Download size={18} aria-hidden="true" />
          <span>
            <strong>Baixar Nexora CLI</strong>
            <small>Carregando versão mais recente...</small>
          </span>
        </div>
        <div className="nexora-cli-download-arrow" aria-hidden="true">
          <Loader2 size={17} className="nexora-cli-spin" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <a
        className="nexora-cli-download-fallback"
        href={CLI_RELEASES_URL}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink size={18} aria-hidden="true" />
        <span>
          <strong>Abrir GitHub Releases</strong>
          <small>As versões oficiais continuam disponíveis no GitHub.</small>
        </span>
      </a>
    );
  }

  if (!hasAssets) {
    return (
      <div
        className="nexora-cli-download-control is-disabled"
        aria-disabled="true"
      >
        <div className="nexora-cli-download-main">
          <Download size={18} aria-hidden="true" />
          <span>
            <strong>Nenhum instalador disponível</strong>
            <small>Confira as versões oficiais no GitHub.</small>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="nexora-cli-download-control" ref={rootRef}>
      {recommended ? (
        <a
          className="nexora-cli-download-main"
          href={recommended.downloadUrl}
          download
          aria-label={`${primaryLabel}, ${recommended.name}`}
        >
          <Download size={18} aria-hidden="true" />
          <span>
            <strong>{primaryLabel}</strong>
            <small>
              {release?.tag} · {formatAssetName(recommended)}
            </small>
          </span>
        </a>
      ) : (
        <button
          className="nexora-cli-download-main"
          type="button"
          onClick={openMenu}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
        >
          <Download size={18} aria-hidden="true" />
          <span>
            <strong>{primaryLabel}</strong>
            <small>Escolha uma plataforma</small>
          </span>
        </button>
      )}

      <button
        className="nexora-cli-download-arrow"
        type="button"
        ref={triggerRef}
        aria-label="Abrir opções de download"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={openMenu}
      >
        <ChevronDown size={18} className={open ? "is-open" : undefined} />
      </button>

      {open && (
        <div
          className="nexora-cli-download-menu"
          id={menuId}
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="nexora-cli-download-menu-heading">
            <div>
              <strong>Baixar Nexora CLI</strong>
              <span>Artefatos oficiais da release estável</span>
            </div>
            <span className="nexora-cli-menu-version">{release?.tag}</span>
          </div>

          <div className="nexora-cli-download-menu-groups">
            {groups.map(group => (
              <section
                className="nexora-cli-download-group"
                key={group.platform}
              >
                <div className="nexora-cli-download-group-title">
                  <span>
                    <PlatformGlyph platform={group.platform} />
                    {platformNames[group.platform]}
                  </span>
                  {recommended?.platform === group.platform && (
                    <span className="nexora-cli-recommended-badge">
                      <Check size={11} aria-hidden="true" /> recomendado
                    </span>
                  )}
                </div>
                {group.assets.map((asset, index) => {
                  const itemIndex =
                    groups
                      .slice(0, groups.indexOf(group))
                      .reduce(
                        (total, current) => total + current.assets.length,
                        0
                      ) + index;
                  const isRecommended = recommended?.id === asset.id;
                  return (
                    <a
                      className={`nexora-cli-download-item${isRecommended ? " is-recommended" : ""}`}
                      key={asset.id}
                      ref={element => {
                        itemRefs.current[itemIndex] = element;
                      }}
                      href={asset.downloadUrl}
                      download
                      role="menuitem"
                      aria-label={menuItemLabel(asset)}
                      onClick={closeMenu}
                    >
                      <span className="nexora-cli-download-item-copy">
                        <strong>{formatAssetName(asset)}</strong>
                        <small>
                          {asset.name} · {formatBytes(asset.size)}
                        </small>
                      </span>
                      {isRecommended ? (
                        <Check
                          size={16}
                          className="nexora-cli-download-item-check"
                          aria-hidden="true"
                        />
                      ) : (
                        <Download size={15} aria-hidden="true" />
                      )}
                    </a>
                  );
                })}
              </section>
            ))}
          </div>

          {missingPlatforms.length > 0 && (
            <p className="nexora-cli-menu-note">
              Algumas plataformas não têm um instalador nesta release.
            </p>
          )}
          <Link
            className="nexora-cli-menu-releases"
            to="/cli/releases"
            role="menuitem"
            onClick={closeMenu}
          >
            Ver todas as versões
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
