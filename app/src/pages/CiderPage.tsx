/**
 * Player do Cider em `/cider`.
 *
 * Reproduz pelo player oficial do YouTube no navegador, sem baixar nem
 * converter nada. O `<iframe>` fica atrás de uma capa opaca, com 16:9 de área
 * real — o YouTube não inicializa um player sem área renderizada.
 *
 * A casca usa **as mesmas classes do Cider 2 desktop** (`.app`, `.sidebar`,
 * `.topbar`, `.playbar`, `.now-playing-page`) e os CSS copiados do projeto, de
 * modo que a aparência é a do aplicativo e não uma aproximação.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Disc3,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CiderProvider } from "@/cider/provider";
import { useCider } from "@/cider/useCider";
import { searchTracks } from "@/cider/search";
import { useLyrics } from "@/cider/useLyrics";
import { releaseNowPlaying } from "@/cider/activity";
import type { CiderTrack } from "@/cider/api/query";

import "@/cider/styles/tokens.css";
import "@/cider/styles/base.css";
import "@/cider/styles/layout.css";
import "@/cider/styles/components.css";
import "@/cider/styles/pages.css";
import "@/cider/styles/youtube.css";
import "@/cider/styles/lyrics.css";
import "@/cider/styles/bridge.css";

function timecode(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export default function CiderPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="cider-root grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="cider-root grid place-items-center" style={{ padding: 24 }}>
        <div className="stack" style={{ maxWidth: 420, textAlign: "center" }}>
          <div className="inline justify-center gap-2">
            <Disc3 size={26} style={{ color: "var(--cider-accent)" }} />
            <h1 className="now-playing-title" style={{ fontSize: "var(--cider-text-xl)" }}>
              Cider
            </h1>
          </div>
          <p className="muted">
            Entre na sua conta da Nexora para ouvir. O que você estiver ouvindo
            aparece no perfil, na lista de amigos e no chat.
          </p>
          <button
            className="btn primary lg"
            onClick={() => navigate("/login?redirect=%2Fcider")}
          >
            Entrar para ouvir
          </button>
        </div>
      </div>
    );
  }

  return (
    <CiderProvider>
      <CiderShell />
    </CiderProvider>
  );
}

function CiderShell() {
  const navigate = useNavigate();
  const { state, engine } = useCider();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CiderTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const lyrics = useLyrics(state.track, state.positionMs, state.phase === "playing");

  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    void engine.mount(host);
  }, [engine]);

  useEffect(() => releaseNowPlaying, []);

  const runSearch = async (raw: string) => {
    setSearching(true);
    const outcome = await searchTracks(raw);
    setResults(outcome.tracks);
    setSource(outcome.source);
    setError(outcome.error);
    setSearching(false);
  };

  const playing = state.phase === "playing";

  return (
    <div className="cider-root app">
      <div className="app-body" data-sidebar="normal">
        <aside className="sidebar" aria-label="Navegação do Cider">
          <div className="sidebar-brand">
            <Disc3 size={22} style={{ color: "var(--cider-accent)" }} />
            <span className="name">
              Cider <span className="faint">web</span>
            </span>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-group-label">Ouvir</div>
            <button
              type="button"
              className="nav-item"
              aria-current="page"
              onClick={() => setResults([])}
            >
              <Play size={16} />
              <span className="label">Descobrir</span>
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => navigate("/cider")}
            >
              <Shuffle size={16} />
              <span className="label">Fila atual</span>
            </button>

            <div className="sidebar-group-label">
              Na fila {state.queue.length > 0 && `· ${state.queue.length}`}
            </div>
            {state.queue.length === 0 ? (
              <p className="xsmall faint" style={{ padding: "4px 10px" }}>
                Pesquise para adicionar faixas.
              </p>
            ) : (
              state.queue.map((track, position) => (
                <button
                  key={track.videoId}
                  type="button"
                  className="nav-item"
                  aria-current={position === state.index ? "page" : undefined}
                  onClick={() => engine.playIndex(position)}
                  title={track.title}
                >
                  <Play size={13} />
                  <span className="label truncate">{track.title}</span>
                </button>
              ))
            )}
          </nav>

          <div className="sidebar-footer">
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => navigate("/channels/@me")}
            >
              Voltar ao Nexora
            </button>
          </div>
        </aside>

        <div className="main-column">
          <header className="topbar">
            <form
              className="search-field"
              onSubmit={event => {
                event.preventDefault();
                void runSearch(query);
              }}
            >
              <ImageIcon size={15} />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar no YouTube — artist:, album: ou @ refinam"
                aria-label="Buscar"
              />
            </form>
            <div className="grow" />
            {searching ? <Loader2 size={15} className="animate-spin" /> : null}
            {results.length > 0 && source ? (
              <span className="xsmall faint">
                {results.length} resultados · {new URL(source).host}
              </span>
            ) : null}
            <button
              type="button"
              className="connection-pill"
              data-state="on"
              onClick={() => navigate("/channels/@me")}
            >
              <span className="dot" />
              Nexora
            </button>
          </header>

          <main className="content" id="cider-content">
            {error ? (
              <div className="notice" data-tone="warning" style={{ marginBottom: 16 }}>
                <div>{error}</div>
              </div>
            ) : null}

            <div className="page now-playing-page">
              <header className="now-playing-head">
                <div
                  className="now-playing-art"
                  style={{ background: "var(--cider-bg-sunken)" }}
                >
                  {state.track?.artworkUrl ? (
                    <img
                      src={state.track.artworkUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div className="grid place-items-center" style={{ height: "100%" }}>
                      <Disc3 size={72} style={{ color: "var(--cider-text-faint)" }} />
                    </div>
                  )}
                </div>

                <div className="now-playing-info stack">
                  <span className="xsmall faint uppercase">YouTube · player oficial</span>
                  <h1 className="now-playing-title">
                    {state.track?.title ?? "Nada tocando"}
                  </h1>
                  <p className="now-playing-artist">
                    {state.track
                      ? state.track.artist || state.track.channelName
                      : "Escolha uma música"}
                  </p>
                  {state.track?.youtubeTitle &&
                  state.track.youtubeTitle !== state.track.title ? (
                    <p className="xsmall faint">
                      Título original do vídeo:{" "}
                      <span title={state.track.youtubeTitle}>
                        {state.track.youtubeTitle}
                      </span>
                    </p>
                  ) : null}

                  {/* Player real do YouTube, atrás da capa opaca. */}
                  <div className="youtube-dock" data-mode="audio" data-cover="true">
                    <div className="youtube-dock-surface">
                      <div ref={hostRef} className="youtube-frame-host" data-covered="true" />
                      <div className="youtube-cover" data-empty={state.track ? undefined : "true"}>
                        {state.track ? (
                          <button
                            type="button"
                            className="btn play lg"
                            onClick={() => engine.toggle()}
                            aria-label={playing ? "Pausar" : "Reproduzir"}
                          >
                            {playing ? <Pause size={22} /> : <Play size={22} />}
                          </button>
                        ) : (
                          <span className="small muted">
                            Pesquise uma música para o player carregar o vídeo.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="now-playing-progress">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, state.durationMs)}
                      value={Math.min(state.positionMs, state.durationMs || 0)}
                      aria-label="Progresso"
                      onChange={event => engine.seekMs(Number(event.target.value))}
                    />
                    <div className="between xsmall faint tabular">
                      <span>{timecode(state.positionMs)}</span>
                      <span>{timecode(state.durationMs)}</span>
                    </div>
                  </div>

                  <div className="now-playing-controls">
                    <button
                      className="btn icon"
                      aria-pressed={state.shuffle}
                      aria-label="Embaralhar"
                      onClick={engine.toggleShuffle}
                    >
                      <Shuffle size={18} />
                    </button>
                    <button
                      className="btn icon"
                      aria-label="Faixa anterior"
                      onClick={engine.previous}
                    >
                      <SkipBack size={20} />
                    </button>
                    <button
                      className="btn play"
                      aria-label={playing ? "Pausar" : "Reproduzir"}
                      onClick={engine.toggle}
                    >
                      {playing ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                    <button
                      className="btn icon"
                      aria-label="Próxima faixa"
                      onClick={engine.next}
                    >
                      <SkipForward size={20} />
                    </button>
                    <button
                      className="btn icon"
                      aria-label="Repetição"
                      aria-pressed={state.repeat !== "off"}
                      onClick={engine.cycleRepeat}
                    >
                      {state.repeat === "one" ? (
                        <Repeat1 size={18} />
                      ) : (
                        <Repeat size={18} />
                      )}
                    </button>
                  </div>

                  <div className="now-playing-volume inline">
                    <button
                      className="btn icon"
                      aria-label={state.muted ? "Ativar som" : "Silenciar"}
                      onClick={engine.toggleMute}
                    >
                      {state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((state.muted ? 0 : state.volume) * 100)}
                      aria-label="Volume"
                      onChange={event => engine.setVolume(Number(event.target.value) / 100)}
                    />
                    <span className="xsmall faint tabular">
                      {Math.round((state.muted ? 0 : state.volume) * 100)}%
                    </span>
                  </div>

                  {state.autoplayBlocked ? (
                    <div className="notice" data-tone="warning">
                      <div>
                        O navegador bloqueou o início automático. Clique em
                        reproduzir — é a política de autoplay e o Cider não
                        contorna isso.
                      </div>
                    </div>
                  ) : null}

                  {state.error ? (
                    <div className="notice" data-tone="danger">
                      <div>{state.error}</div>
                    </div>
                  ) : null}
                </div>
              </header>

              {lyrics.status === "ready" ? (
                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">Letras</h2>
                  </div>
                  {lyrics.view}
                </section>
              ) : null}

              {lyrics.status === "loading" ? (
                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">Letras</h2>
                  </div>
                  <p className="muted">Procurando no LRCLIB…</p>
                </section>
              ) : null}

              {lyrics.status === "empty" ? (
                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">Letras</h2>
                  </div>
                  <p className="muted">Não achamos a letra dessa faixa.</p>
                </section>
              ) : null}

              {results.length > 0 ? (
                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">Resultados</h2>
                    <span className="grow" />
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => engine.playQueue(results, 0)}
                    >
                      <Play size={13} /> Tocar tudo
                    </button>
                  </div>
                  <ul className="track-list">
                    {results.map(track => (
                      <li key={track.videoId}>
                        <button
                          type="button"
                          className="track-row yt-row"
                          onClick={() => engine.playTrack(track, results)}
                        >
                          <img
                            className="cover-thumb"
                            src={track.artworkUrl}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <span className="stack" style={{ minWidth: 0 }}>
                            <span className="truncate">{track.title}</span>
                            <span className="xsmall faint truncate">
                              {track.artist || track.channelName}
                              {track.version !== "studio" ? ` · ${track.version}` : ""}
                            </span>
                          </span>
                          <span className="grow" />
                          <span className="xsmall faint tabular">
                            {timecode(track.durationMs)}
                          </span>
                          <ExternalLink size={13} className="faint" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="notice" data-tone="info">
                <div>
                  <strong>Privacidade e atribuição</strong>
                  <br />
                  YouTube é a fonte deste conteúdo: o título original do vídeo é
                  preservado e "Abrir no YouTube" leva ao vídeo. O Cider 2 não
                  baixa, não converte e não hospeda este vídeo.
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <CiderPlaybar />
    </div>
  );
}

/** Playbar fixa, com a mesma estrutura do desktop. */
function CiderPlaybar() {
  const { state, engine } = useCider();
  const playing = state.phase === "playing";

  return (
    <footer className="playbar" aria-label="Reprodução">
      <div className="now-playing">
        {state.track?.artworkUrl ? (
          <img
            className="cover-thumb"
            src={state.track.artworkUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="cover-thumb" />
        )}
        <div className="meta grow">
          <div className="title truncate">{state.track?.title ?? "Nada tocando"}</div>
          <div className="artist truncate">
            {state.track?.artist || state.track?.channelName || "escolha uma faixa"}
          </div>
          {state.error ? (
            <div className="xsmall truncate" style={{ color: "var(--cider-danger)" }}>
              {state.error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="transport">
        <div className="transport-buttons">
          <button
            className="btn icon"
            aria-pressed={state.shuffle}
            aria-label="Embaralhar"
            onClick={engine.toggleShuffle}
          >
            <Shuffle size={17} />
          </button>
          <button className="btn icon" aria-label="Anterior" onClick={engine.previous}>
            <SkipBack size={18} />
          </button>
          <button
            className="btn play"
            aria-label={playing ? "Pausar" : "Reproduzir"}
            onClick={engine.toggle}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="btn icon" aria-label="Próxima" onClick={engine.next}>
            <SkipForward size={18} />
          </button>
          <button
            className="btn icon"
            aria-label="Repetição"
            aria-pressed={state.repeat !== "off"}
            onClick={engine.cycleRepeat}
          >
            {state.repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>
        <div className="progress-row">
          <span className="timecode">{timecode(state.positionMs)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, state.durationMs)}
            value={Math.min(state.positionMs, state.durationMs || 0)}
            aria-label="Progresso"
            onChange={event => engine.seekMs(Number(event.target.value))}
          />
          <span className="timecode right">{timecode(state.durationMs)}</span>
        </div>
      </div>

      <div className="playbar-extras">
        <div className="volume-control">
          <button
            className="btn icon"
            aria-label={state.muted ? "Ativar som" : "Silenciar"}
            onClick={engine.toggleMute}
          >
            {state.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((state.muted ? 0 : state.volume) * 100)}
            aria-label="Volume"
            onChange={event => engine.setVolume(Number(event.target.value) / 100)}
          />
        </div>
      </div>
    </footer>
  );
}
