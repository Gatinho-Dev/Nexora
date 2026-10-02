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
  CirclePower,
  Expand,
  Heart,
  ListMusic,
  MicVocal,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Radio,
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
import { PlayableCover } from "./PlayableCover";
import { releaseNowPlaying } from "../activity";
import { requestFromListen, useCiderListen } from "../listen";
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
          placeholder="Buscar músicas, artistas ou álbuns"
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
            ? `Última busca respondida por ${sourceHost}.`
            : lastSearchError
              ? lastSearchError
              : "Nenhuma busca nesta sessão ainda."
        }
      >
        <span className="dot" />
        Fonte
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

/**
 * Slots da playbar, na ordem padrão.
 *
 * É a ordem da pílula: transporte, faixa, ações. Antes era a lista única do
 * desktop (capa primeiro), que na pílula jogaria a capa para o canto esquerdo,
 * antes dos botões.
 */
const DEFAULT_PLAYBAR_ORDER = [
  "shuffle",
  "previous",
  "play",
  "next",
  "repeat",
  "cover",
  "favorite",
  "progress",
  "more",
  "lyrics",
  "queue",
  "volume",
];

/*
 * A pílula tem três blocos, como a do Apple Music: controles à esquerda, o que
 * está tocando no meio e as ações à direita. Cada slot pertence a um bloco, e a
 * ordem escolhida pelo usuário vale **dentro** dele — assim uma playbar
 * personalizada continua fazendo sentido, em vez de virar uma fila única.
 *
 * A barra de progresso, que antes era uma linha **fora** da pílula, agora é um
 * slot do bloco do meio: no Apple Music ela corre por baixo da capa e do título,
 * dentro do mesmo retângulo, e o desenho de "tudo numa cápsula só" dependia
 * disso.
 */
const PILL_SLOTS = {
  transport: ["shuffle", "previous", "play", "next", "repeat"],
  now: ["cover", "favorite", "progress"],
  actions: ["more", "lyrics", "queue", "volume"],
} as const;

export function CiderPlaybar() {
  const navigate = useNavigate();
  const { state, engine } = useCider();
  const settings = useCiderSettings((state) => state.settings);
  const favorites = useCiderLibrary((state) => state.favorites);
  const panel = useCiderUi((state) => state.panel);
  const togglePanel = useCiderUi((state) => state.togglePanel);
  const setLyricsScreen = useCiderUi((state) => state.setLyricsScreen);
  const setListenOpen = useCiderUi((state) => state.setListenOpen);
  const listenSession = useCiderListen((store) => store.session);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // O menu fecha ao clicar fora — inclusive no iframe do player, que engole o
  // clique. Sem o `pointerdown` fora, ele ficava aberto por cima da interface
  // enquanto a pessoa ouvia.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const visible = useMemo(() => {
    const order = settings.playbarOrder.length > 0 ? settings.playbarOrder : DEFAULT_PLAYBAR_ORDER;
    return order.filter((slot) => !settings.playbarHidden.includes(slot));
  }, [settings.playbarOrder, settings.playbarHidden]);

  const group = (slots: readonly string[]) => visible.filter((slot) => slots.includes(slot));

  const current = state.track;
  const playing = state.phase === "playing";
  /*
   * Numa sessão de escuta, quem tem a fila é o anfitrião: os controles do
   * convidado viram **pedidos**. Sem isso, apertar "próxima" aqui só afastaria
   * o convidado do grupo até o próximo estado do anfitrião o puxar de volta —
   * que é um botão que parece quebrado por não ter dono.
   */
  const listeningGuest = listenSession?.me.role === "guest" ? listenSession : null;
  const listenHostName = listeningGuest
    ? (listeningGuest.members.find((member) => member.userId === listeningGuest.hostId)?.name ??
      "o anfitrião")
    : null;
  const nextTrack = () => (listeningGuest ? requestFromListen("next") : engine.next());
  const previousTrack = () =>
    listeningGuest ? requestFromListen("previous") : engine.previous();
  const togglePlay = () => (listeningGuest ? requestFromListen("toggle") : engine.toggle());
  const isFavorite = current ? favorites.some((track) => track.videoId === current.videoId) : false;
  const duration = state.durationMs || current?.durationMs || 0;
  const muted = state.muted || state.volume === 0;

  const repeatLabel =
    state.repeat === "off" ? "Repetir: desligado" : state.repeat === "all" ? "Repetir: fila" : "Repetir: faixa";
  // O Apple Music conta o que **falta**, não o que já tocou ("-2:50").
  const remaining = Math.max(0, duration - state.positionMs);

  // Cada botão já sai com a própria `key`: a playbar desenha os três blocos com
  // `map`, e envolver cada um num `<Fragment key>` faria o React avisar a cada
  // quadro — o plugin de inspeção do projeto injeta uma prop extra em todo
  // elemento, e `Fragment` só aceita `key` e `children`.
  const transportButton = (slot: string) => {
    switch (slot) {
      case "shuffle":
        return (
          <IconButton
            key="shuffle"
            label={listeningGuest ? "Na sessão, quem manda na fila é o anfitrião" : "Reprodução aleatória"}
            active={!listeningGuest && state.shuffle}
            disabled={!!listeningGuest}
            onClick={engine.toggleShuffle}
          >
            <Shuffle size={17} />
          </IconButton>
        );
      case "previous":
        return (
          <IconButton
            key="previous"
            label={listeningGuest ? "Pedir a faixa anterior" : "Faixa anterior"}
            onClick={previousTrack}
            disabled={!current}
          >
            <SkipBack size={20} />
          </IconButton>
        );
      case "play":
        return (
          <IconButton
            key="play"
            label={playing ? "Pausar" : "Reproduzir"}
            tone="play"
            onClick={togglePlay}
            disabled={!current}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </IconButton>
        );
      case "next":
        return (
          <IconButton
            key="next"
            label={listeningGuest ? "Pedir a próxima faixa" : "Próxima faixa"}
            onClick={nextTrack}
            disabled={!current}
          >
            <SkipForward size={20} />
          </IconButton>
        );
      case "repeat":
        return (
          <IconButton
            key="repeat"
            label={listeningGuest ? "Na sessão, quem manda na fila é o anfitrião" : repeatLabel}
            active={!listeningGuest && state.repeat !== "off"}
            disabled={!!listeningGuest}
            onClick={engine.cycleRepeat}
          >
            {state.repeat === "one" ? <Repeat1 size={17} /> : <Repeat size={17} />}
          </IconButton>
        );
      default:
        return null;
    }
  };

  const actionButton = (slot: string) => {
    switch (slot) {
      case "lyrics":
        return (
          <IconButton
            key="lyrics"
            label="Letras"
            active={panel === "lyrics"}
            onClick={() => togglePanel("lyrics")}
          >
            <MicVocal size={18} />
          </IconButton>
        );
      case "queue":
        return (
          <IconButton
            key="queue"
            label="Fila de reprodução"
            active={panel === "queue"}
            onClick={() => togglePanel("queue")}
          >
            <ListMusic size={18} />
          </IconButton>
        );
      case "more":
        return (
          <div key="more" className="pill-more" ref={menuRef}>
            <IconButton
              label="Mais opções"
              active={menuOpen}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <MoreHorizontal size={18} />
            </IconButton>
            {menuOpen ? (
              <div className="pill-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setLyricsScreen(true);
                  }}
                >
                  <MicVocal size={16} /> Letra em tela cheia
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/cider/tocando-agora");
                  }}
                >
                  <Expand size={16} /> Abrir Tocando agora
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!current}
                  onClick={() => {
                    setMenuOpen(false);
                    if (current) toggleFavoriteWithToast(current);
                  }}
                >
                  <Heart size={16} /> {isFavorite ? "Remover dos favoritos" : "Favoritar"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setListenOpen(true);
                  }}
                >
                  <Radio size={16} /> {listenSession ? "Sessão de escuta" : "Ouvir junto"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!current}
                  onClick={() => {
                    setMenuOpen(false);
                    // Mesma ação do "Encerrar Cider" da janela flutuante:
                    // para o som, limpa a fila e tira a faixa do perfil.
                    engine.clearQueue();
                    releaseNowPlaying();
                  }}
                >
                  <CirclePower size={16} /> Encerrar o Cider
                </button>
              </div>
            ) : null}
          </div>
        );
      case "volume":
        return (
          <div key="volume" className="volume-control">
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
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <footer
      className="playbar"
      data-position={settings.playbarPosition}
      aria-label="Barra de reprodução"
    >
      {/*
        * Uma cápsula só, com tudo dentro: transporte à esquerda, a faixa no
        * meio (capa, título e a barra de progresso correndo por baixo dela) e
        * as ações à direita. A linha de progresso **não** é mais um rodapé
        * separado — no Apple Music ela vive dentro do mesmo retângulo, e era
        * isso que fazia a barra parecer três blocos em vez de um player.
        */}
      <div className="playbar-pill">
        <div className="pill-transport">{group(PILL_SLOTS.transport).map(transportButton)}</div>

        <div className="pill-now">
          {group(PILL_SLOTS.now).includes("cover") ? (
            <PlayableCover
              className="pill-cover"
              imageClassName="cover"
              url={current?.artworkUrl}
              title={current?.title ?? "Cider 2"}
              disabled={!current}
              // Clicar na capa do que está tocando abre a letra em tela cheia —
              // é o gesto do Apple Music, e o mesmo que as setas anunciam.
              onExpand={() => setLyricsScreen(true)}
            />
          ) : null}
          <div className="meta grow">
            <div className="title truncate" title={current?.title}>
              {current ? current.title : "Nada tocando"}
            </div>
            <div className="artist truncate">
              {current
                ? [current.artist || current.channelName, current.albumHint].filter(Boolean).join(" — ")
                : "Escolha algo para ouvir"}
            </div>
            {listenHostName ? (
              <div className="xsmall truncate listen-following">Ouvindo junto com {listenHostName}</div>
            ) : null}
            {state.error ? (
              <div className="xsmall truncate" style={{ color: "var(--cider-danger)" }} title={state.error}>
                {state.error}
              </div>
            ) : null}
          </div>
          {group(PILL_SLOTS.now).includes("favorite") ? (
            <IconButton
              label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
              active={isFavorite}
              disabled={!current}
              onClick={() => current && toggleFavoriteWithToast(current)}
            >
              <Heart size={17} />
            </IconButton>
          ) : null}
          {group(PILL_SLOTS.now).includes("progress") ? (
            <div className="pill-progress">
              {settings.showTimecodes ? (
                <span className="pill-time tabular">{timecode(state.positionMs)}</span>
              ) : null}
              <ProgressSlider
                positionMs={state.positionMs}
                durationMs={duration}
                style={settings.progressStyle}
                onSeek={(ms) => (listeningGuest ? requestFromListen("seek", ms) : engine.seekMs(ms))}
              />
              {settings.showTimecodes ? (
                <span className="pill-time right tabular">{`-${timecode(remaining)}`}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="pill-actions">{group(PILL_SLOTS.actions).map(actionButton)}</div>
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
