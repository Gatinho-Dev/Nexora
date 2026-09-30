/**
 * Casca do Cider: barra lateral, barra superior e barra de reprodução.
 *
 * Estrutura de DOM e classes iguais às do Cider 2 desktop (`Shell.tsx`), de modo
 * que o CSS copiado desenhe a mesma aparência. O que muda é o transporte da
 * navegação: aqui os destinos são rotas do `react-router` (endereço
 * compartilhável, botão voltar do navegador), e não uma união de rotas interna.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Heart,
  ListMusic,
  MicVocal,
  Menu,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useCider } from "../useCider";
import { useCiderSettings } from "../settings/store";
import { useCiderUi } from "../ui";
import { CIDER_NAV_GROUPS, orderedNavItems, routeTitle } from "../nav";
import { useCiderHistory } from "../history";
import { useCiderLibrary } from "../library";
import { toggleFavoriteWithToast } from "../play";
import { CoverArt } from "./CoverArt";
import { timecode } from "../format";
import { IconButton, ProgressSlider } from "./primitives";

/* ------------------------------------------------------------------ *
 * Barra lateral                                                      *
 * ------------------------------------------------------------------ */

export function CiderSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useCiderSettings((state) => state.settings);
  const appearance = useCiderSettings((state) => state.appearance);
  const patch = useCiderSettings((state) => state.patch);
  const playlists = useCiderLibrary((state) => state.playlists);
  const setSidebarOpen = useCiderUi((state) => state.setSidebarOpen);

  const items = useMemo(
    () => orderedNavItems(settings.sidebarOrder, settings.sidebarHidden),
    [settings.sidebarOrder, settings.sidebarHidden],
  );

  const grouped = useMemo(
    () =>
      CIDER_NAV_GROUPS.map((group) => ({
        group,
        items: items.filter((item) => item.group === group),
      })).filter((entry) => entry.items.length > 0),
    [items],
  );

  // Redimensionamento: acompanha o ponteiro localmente e grava só no fim do
  // arrasto (uma escrita de configuração por gesto, não por pixel).
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  useEffect(() => {
    if (dragWidth === null) return undefined;
    const onMove = (event: PointerEvent) => setDragWidth(Math.max(180, Math.min(380, event.clientX)));
    const onUp = (event: PointerEvent) => {
      const value = Math.max(180, Math.min(380, event.clientX));
      setDragWidth(null);
      patch({ sidebarWidth: Math.round(value) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragWidth, patch]);

  const activePath = location.pathname.replace(/\/+$/, "") || "/";

  return (
    <aside
      className="sidebar"
      data-collapsed={settings.sidebarCollapsed || !settings.sidebarShowLabels}
      aria-label="Navegação principal"
    >
      <div className="sidebar-brand">
        <img src="/cider/logo.svg" alt="" width={30} height={30} />
        <span className="name">
          Cider<span>2</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        {grouped.map(({ group, items: groupItems }) => (
          <div key={group}>
            <div className="sidebar-group-label">{group}</div>
            {groupItems.map((item) => {
              const Icon = item.icon;
              const base = item.path.replace(/\/+$/, "") || "/";
              const active = activePath === base || activePath.startsWith(`${base}/`);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="nav-item"
                  aria-current={active ? "page" : undefined}
                  title={settings.sidebarCollapsed ? item.label : undefined}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon size={19} />
                  <span className="label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}

        {playlists.length > 0 ? (
          <div>
            <div className="sidebar-group-label">Minhas playlists</div>
            {playlists.slice(0, 12).map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="nav-item"
                aria-current={
                  activePath === `/cider/playlists/${playlist.id}` ? "page" : undefined
                }
                onClick={() => {
                  navigate(`/cider/playlists/${playlist.id}`);
                  setSidebarOpen(false);
                }}
              >
                <ListMusic size={18} />
                <span className="label truncate">{playlist.name}</span>
              </button>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-detail small">
          {appearance
            ? `${appearance.themeName} · ${appearance.mode === "light" ? "claro" : "escuro"}`
            : "aplicando tema…"}
        </div>
        <div className="inline">
          <IconButton
            label={settings.sidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            onClick={() => patch({ sidebarCollapsed: !settings.sidebarCollapsed })}
          >
            {settings.sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </IconButton>
          <button type="button" className="link xsmall" onClick={() => navigate("/channels/@me")}>
            Voltar ao Nexora
          </button>
        </div>
      </div>

      {settings.sidebarResizable && !settings.sidebarCollapsed ? (
        <div
          className="sidebar-resizer"
          style={{ right: -4, width: dragWidth === null ? 8 : "100%" }}
          onPointerDown={(event) => setDragWidth(Math.max(180, Math.min(380, event.clientX)))}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar barra lateral"
        />
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Barra superior                                                     *
 * ------------------------------------------------------------------ */

export function CiderTopbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { backPath, forwardPath } = useCiderHistory();
  const setPalette = useCiderUi((state) => state.setPalette);
  const setImmersive = useCiderUi((state) => state.setImmersive);
  const setSidebarOpen = useCiderUi((state) => state.setSidebarOpen);
  const searchSource = useCiderUi((state) => state.searchSource);
  const lastSearchError = useCiderUi((state) => state.lastSearchError);

  const [term, setTerm] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const content = document.querySelector(".cider-root .content");
    if (!content) return undefined;
    const onScroll = () => setScrolled(content.scrollTop > 4);
    content.addEventListener("scroll", onScroll);
    return () => content.removeEventListener("scroll", onScroll);
  }, []);

  // Atalhos locais: `/` foca a busca e Ctrl+K abre a paleta (registrada no
  // `CiderApp`). São os mesmos caminhos de teclado do desktop onde faz sentido
  // num site — não há atalho global de sistema aqui.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    const trimmed = term.trim();
    navigate(trimmed ? `/cider/pesquisa?q=${encodeURIComponent(trimmed)}` : "/cider/pesquisa");
  };

  const sourceHost = searchSource ? safeHost(searchSource) : null;

  return (
    <header className="topbar" data-scrolled={scrolled ? "true" : "false"} data-translucent="true">
      <div className="inline">
        <IconButton label="Abrir navegação" className="only-narrow" onClick={() => setSidebarOpen(true)}>
          <Menu size={18} />
        </IconButton>
        <IconButton label="Voltar" disabled={!backPath} onClick={() => backPath && navigate(backPath)}>
          <ChevronLeft size={19} />
        </IconButton>
        <IconButton
          label="Avançar"
          disabled={!forwardPath}
          onClick={() => forwardPath && navigate(forwardPath)}
        >
          <ChevronRight size={19} />
        </IconButton>
        <span className="topbar-title">{routeTitle(location.pathname)}</span>
      </div>

      <div className="grow" />

      <div className="search-field">
        <Search size={16} />
        <input
          ref={searchRef}
          type="search"
          value={term}
          placeholder="Buscar no YouTube — artist:, album: ou @ refinam"
          aria-label="Buscar"
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </div>

      <button
        type="button"
        className="connection-pill"
        data-state={sourceHost ? "connected" : lastSearchError ? "offline" : "expired"}
        onClick={() => navigate("/cider/diagnostico")}
        title={
          sourceHost
            ? `Última busca respondida por ${sourceHost}. A busca usa instâncias comunitárias Piped/Invidious.`
            : lastSearchError
              ? lastSearchError
              : "Nenhuma busca nesta sessão ainda. A fonte é uma instância comunitária Piped/Invidious."
        }
      >
        <span className="dot" />
        {sourceHost ?? "Piped/Invidious"}
      </button>

      <IconButton label="Paleta de comandos" onClick={() => setPalette(true)}>
        <Search size={18} />
      </IconButton>
      <IconButton label="Modo imersivo" onClick={() => setImmersive(true)}>
        <Expand size={18} />
      </IconButton>
      <IconButton label="Configurações" onClick={() => navigate("/cider/configuracoes")}>
        <Settings size={18} />
      </IconButton>
    </header>
  );
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Barra de reprodução                                                *
 * ------------------------------------------------------------------ */

/** Slots da playbar, na ordem padrão do desktop. */
const DEFAULT_PLAYBAR_ORDER = [
  "cover",
  "favorite",
  "shuffle",
  "previous",
  "play",
  "next",
  "repeat",
  "progress",
  "volume",
  "lyrics",
  "queue",
];

export function CiderPlaybar() {
  const navigate = useNavigate();
  const { state, engine } = useCider();
  const settings = useCiderSettings((state) => state.settings);
  const favorites = useCiderLibrary((state) => state.favorites);
  const panel = useCiderUi((state) => state.panel);
  const togglePanel = useCiderUi((state) => state.togglePanel);

  const active = useMemo(() => {
    const order = settings.playbarOrder.length > 0 ? settings.playbarOrder : DEFAULT_PLAYBAR_ORDER;
    return order.filter((slot) => !settings.playbarHidden.includes(slot));
  }, [settings.playbarOrder, settings.playbarHidden]);

  const has = (slot: string) => active.includes(slot);

  const current = state.track;
  const playing = state.phase === "playing";
  const isFavorite = current ? favorites.some((track) => track.videoId === current.videoId) : false;
  const duration = state.durationMs || current?.durationMs || 0;
  const muted = state.muted || state.volume === 0;

  const repeatLabel =
    state.repeat === "off" ? "Repetir: desligado" : state.repeat === "all" ? "Repetir: fila" : "Repetir: faixa";

  return (
    <footer
      className="playbar"
      data-position={settings.playbarPosition}
      aria-label="Barra de reprodução"
    >
      <div className="now-playing">
        {has("cover") ? (
          <button
            type="button"
            onClick={() => navigate("/cider/tocando-agora")}
            style={{ border: 0, padding: 0, background: "none", cursor: "pointer" }}
            aria-label="Abrir Tocando agora"
          >
            <CoverArt
              url={current?.artworkUrl}
              title={current?.title ?? "Cider 2"}
              className="cover"
            />
          </button>
        ) : null}
        <div className="meta grow">
          <div className="title truncate" title={current?.title}>
            {current ? current.title : "Nada tocando"}
          </div>
          <div className="artist truncate">
            {current
              ? [current.artist || current.channelName, current.albumHint].filter(Boolean).join(" · ")
              : "Escolha algo para ouvir"}
          </div>
          {state.error ? (
            <div className="xsmall truncate" style={{ color: "var(--cider-danger)" }} title={state.error}>
              {state.error}
            </div>
          ) : null}
        </div>
        {has("favorite") ? (
          <IconButton
            label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
            active={isFavorite}
            disabled={!current}
            onClick={() => current && toggleFavoriteWithToast(current)}
          >
            <Heart size={18} />
          </IconButton>
        ) : null}
      </div>

      <div className="transport">
        <div className="transport-buttons">
          {has("shuffle") ? (
            <IconButton label="Reprodução aleatória" active={state.shuffle} onClick={engine.toggleShuffle}>
              <Shuffle size={17} />
            </IconButton>
          ) : null}
          {has("previous") ? (
            <IconButton label="Faixa anterior" onClick={engine.previous}>
              <SkipBack size={19} />
            </IconButton>
          ) : null}
          {has("play") ? (
            <IconButton
              label={playing ? "Pausar" : "Reproduzir"}
              tone="play"
              onClick={engine.toggle}
              disabled={!current}
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </IconButton>
          ) : null}
          {has("next") ? (
            <IconButton label="Próxima faixa" onClick={engine.next} disabled={!current}>
              <SkipForward size={19} />
            </IconButton>
          ) : null}
          {has("repeat") ? (
            <IconButton label={repeatLabel} active={state.repeat !== "off"} onClick={engine.cycleRepeat}>
              {state.repeat === "one" ? <Repeat1 size={17} /> : <Repeat size={17} />}
            </IconButton>
          ) : null}
        </div>

        {has("progress") ? (
          <div className="progress-row">
            {settings.showTimecodes ? <span className="timecode">{timecode(state.positionMs)}</span> : null}
            <ProgressSlider
              positionMs={state.positionMs}
              durationMs={duration}
              style={settings.progressStyle}
              onSeek={engine.seekMs}
            />
            {settings.showTimecodes ? (
              <span className="timecode right">{timecode(duration)}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="playbar-extras">
        {has("lyrics") ? (
          <IconButton label="Letras" active={panel === "lyrics"} onClick={() => togglePanel("lyrics")}>
            <MicVocal size={17} />
          </IconButton>
        ) : null}
        {has("queue") ? (
          <IconButton label="Fila de reprodução" active={panel === "queue"} onClick={() => togglePanel("queue")}>
            <ListMusic size={17} />
          </IconButton>
        ) : null}
        {has("volume") ? (
          <div className="volume-control">
            <IconButton
              label={muted ? "Reativar som" : "Silenciar"}
              onClick={() => engine.setVolume(state.volume > 0 ? 0 : 0.85)}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </IconButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : state.volume}
              aria-label="Volume"
              className="volume-range"
              onChange={(event) => engine.setVolume(Number(event.target.value))}
              style={{ width: 92 }}
            />
          </div>
        ) : null}
        <button
          type="button"
          className="connection-pill"
          data-state="connected"
          onClick={() => navigate("/cider/diagnostico")}
          title="Onde o áudio está sendo reproduzido"
        >
          navegador · iframe do YouTube
        </button>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * Fundo ambiente                                                     *
 * ------------------------------------------------------------------ */

/** Brilho da capa atual ao fundo (Configurações → Aparência). */
export function CiderAmbient() {
  const { state } = useCider();
  const enabled = useCiderSettings((state) => state.settings.coverAmbient);
  const cover = state.track?.artworkUrl ?? null;
  if (!enabled || !cover) return null;
  return <div className="app-ambient on" style={{ backgroundImage: `url(${cover})` }} aria-hidden="true" />;
}
