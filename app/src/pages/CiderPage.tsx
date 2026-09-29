/**
 * Player do Cider em `/cider`.
 *
 * Reproduz pelo player oficial do YouTube no navegador, sem baixar nem
 * converter nada. O `<iframe>` fica atrás de uma capa opaca, com 16:9 de área
 * real — o YouTube não inicializa um player sem área renderizada.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CiderProvider } from "@/cider/provider";
import { useCider } from "@/cider/useCider";
import { searchTracks } from "@/cider/search";
import { useLyrics } from "@/cider/useLyrics";
import { releaseNowPlaying } from "@/cider/activity";
import type { CiderTrack } from "@/cider/api/query";
import "@/cider/styles/tokens.css";
import "@/cider/styles/app.css";
import "@/cider/styles/lyrics.css";

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function CiderPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="cider-gate">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="cider-gate">
        <div className="cider-gate-card">
          <div className="cider-brand-mark">
            <Disc3 size={18} />
          </div>
          <h1 className="cider-nowplaying-title">Cider</h1>
          <p style={{ color: "var(--cider-text-muted)", fontSize: "var(--cider-text-base)" }}>
            Entre na sua conta da Nexora para ouvir. O que você estiver ouvindo
            aparece no perfil, na lista de amigos e no chat.
          </p>
          <button
            className="cider-btn"
            data-variant="primary"
            data-size="lg"
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const lyrics = useLyrics(state.track, state.positionMs, state.phase === "playing");

  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    void engine.mount(host).catch(() => {
      /* o erro chega pelo próprio estado do player */
    });
  }, [engine]);

  // Saiu do player: a presença é limpa, senão continuaria mostrando faixa para
  // quem não está mais ouvindo.
  useEffect(() => releaseNowPlaying, []);

  const runSearch = useCallback(
    async (raw: string) => {
      const outcome = await searchTracks(raw);
      setResults(outcome.tracks);
      setSource(outcome.source);
      setSearchError(outcome.error);
    },
    []
  );

  const coverBackground = state.track?.artworkUrl
    ? `radial-gradient(120% 100% at 50% 0%, rgba(0,0,0,0.35), rgba(0,0,0,0.82)), url(${state.track.artworkUrl}) center/cover`
    : undefined;

  return (
    <div className="cider-app">
      <div className="cider-body">
        <aside className="cider-sidebar">
          <div className="cider-brand">
            <div className="cider-brand-mark">
              <Disc3 size={17} />
            </div>
            <strong style={{ fontSize: "var(--cider-text-md)" }}>Cider</strong>
            <span
              className="grow"
              style={{ color: "var(--cider-text-faint)", fontSize: "var(--cider-text-xs)" }}
            >
              em /cider
            </span>
          </div>

          <nav className="cider-nav">
            <div className="cider-nav-label">Ouvir</div>
            <button
              type="button"
              className="cider-nav-item"
              aria-current="page"
              onClick={() => setQuery("")}
            >
              <Play size={16} /> Início
            </button>
            <button
              type="button"
              className="cider-nav-item"
              onClick={() => navigate("/channels/@me/friends")}
            >
              <Disc3 size={16} /> Minha biblioteca
            </button>

            <div className="cider-nav-label">Fila</div>
            {state.queue.length === 0 ? (
              <p
                style={{
                  padding: "0 var(--cider-space-3)",
                  color: "var(--cider-text-faint)",
                  fontSize: "var(--cider-text-sm)",
                }}
              >
                Nada na fila ainda.
              </p>
            ) : (
              state.queue.map((track, position) => (
                <button
                  key={track.videoId}
                  type="button"
                  className="cider-nav-item"
                  aria-current={position === state.index ? "page" : undefined}
                  onClick={() => engine.playIndex(position)}
                >
                  <Play size={14} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {track.title}
                  </span>
                </button>
              ))
            )}
          </nav>

          <div
            style={{
              marginTop: "auto",
              paddingTop: "var(--cider-space-3)",
              borderTop: "1px solid var(--cider-border)",
              fontSize: "var(--cider-text-xs)",
              color: "var(--cider-text-faint)",
            }}
          >
            <button
              type="button"
              className="cider-btn"
              data-variant="ghost"
              data-size="sm"
              onClick={() => navigate("/channels/@me")}
            >
              <X size={14} /> Voltar ao Nexora
            </button>
          </div>
        </aside>

        <div className="cider-main">
          <header className="cider-topbar">
            <form
              className="cider-search"
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
            <span className="grow" />
            <span
              style={{ fontSize: "var(--cider-text-xs)", color: "var(--cider-text-faint)" }}
            >
              {results.length > 0 && source
                ? `${results.length} resultados · ${new URL(source).host}`
                : ""}
            </span>
            <button
              type="button"
              className="cider-btn"
              data-variant="ghost"
              data-size="sm"
              onClick={() => navigate("/channels/@me")}
            >
              Sair do Cider
            </button>
          </header>

          <div className="cider-content">
            {searchError && (
              <div className="cider-notice" data-tone="warning" style={{ marginBottom: 16 }}>
                {searchError}
              </div>
            )}

            <section className="cider-nowplaying">
              <div>
                <div className="cider-art-frame">
                  {state.track?.artworkUrl ? (
                    <img
                      className="cider-art"
                      src={state.track.artworkUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="cider-art-empty">
                      <Disc3 size={56} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "var(--cider-text-xs)",
                    color: "var(--cider-text-faint)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--cider-tracking-wide)",
                    margin: 0,
                  }}
                >
                  Tocando agora
                </p>
                <h1 className="cider-nowplaying-title">
                  {state.track?.title ?? "Nada tocando"}
                </h1>
                <p className="cider-nowplaying-artist">
                  {state.track
                    ? state.track.artist || state.track.channelName
                    : "Escolha uma música para começar"}
                </p>
                {state.track?.youtubeTitle &&
                  state.track.youtubeTitle !== state.track.title && (
                    <p className="cider-source-line">
                      no YouTube: {state.track.youtubeTitle}
                    </p>
                  )}

                {/* Player real do YouTube, atrás da capa. */}
                <div
                  className="cider-stage"
                  style={{ marginTop: "var(--cider-space-5)" }}
                >
                  <div ref={hostRef} className="cider-frame-host" />
                  <button
                    type="button"
                    className="cider-cover"
                    style={{ "--cider-cover-bg": coverBackground } as React.CSSProperties}
                    onClick={() => engine.toggle()}
                    aria-label={
                      state.phase === "playing" ? "Pausar" : "Reproduzir"
                    }
                  >
                    {state.track ? (
                      <>
                        {state.phase === "playing" ? (
                          <Pause size={40} />
                        ) : (
                          <Play size={40} />
                        )}
                        <span className="cider-cover-peek">
                          {state.phase === "playing"
                            ? "somente áudio · vídeo coberto"
                            : "tocar"}
                        </span>
                      </>
                    ) : (
                      <span
                        style={{
                          color: "var(--cider-text-faint)",
                          fontSize: "var(--cider-text-base)",
                        }}
                      >
                        Pesquise uma música para o player carregar o vídeo.
                      </span>
                    )}
                  </button>
                </div>

                <div className="cider-transport">
                  <button
                    className="cider-btn"
                    data-size="icon"
                    data-variant="ghost"
                    aria-pressed={state.shuffle}
                    aria-label="Aleatório"
                    onClick={engine.toggleShuffle}
                  >
                    <Shuffle size={17} />
                  </button>
                  <button
                    className="cider-btn"
                    data-size="icon"
                    data-variant="ghost"
                    aria-label="Anterior"
                    disabled={!state.track}
                    onClick={engine.previous}
                  >
                    <SkipBack size={19} />
                  </button>
                  <button
                    className="cider-btn"
                    data-size="icon"
                    data-variant="primary"
                    aria-label={state.phase === "playing" ? "Pausar" : "Reproduzir"}
                    disabled={!state.track}
                    onClick={engine.toggle}
                  >
                    {state.phase === "playing" ? (
                      <Pause size={19} />
                    ) : (
                      <Play size={19} />
                    )}
                  </button>
                  <button
                    className="cider-btn"
                    data-size="icon"
                    data-variant="ghost"
                    aria-label="Próxima"
                    disabled={!state.track}
                    onClick={engine.next}
                  >
                    <SkipForward size={19} />
                  </button>
                  <button
                    className="cider-btn"
                    data-size="icon"
                    data-variant="ghost"
                    aria-label="Repetir"
                    onClick={engine.cycleRepeat}
                  >
                    {state.repeat === "one" ? (
                      <Repeat1 size={17} />
                    ) : (
                      <Repeat size={17} />
                    )}
                  </button>
                </div>

                <div className="cider-progress">
                  <span className="cider-timecode">
                    {formatTime(state.positionMs)}
                  </span>
                  <input
                    className="cider-range"
                    type="range"
                    min={0}
                    max={Math.max(1, state.durationMs)}
                    value={Math.min(state.positionMs, state.durationMs || 0)}
                    aria-label="Progresso"
                    onChange={event => engine.seekMs(Number(event.target.value))}
                  />
                  <span className="cider-timecode">
                    {formatTime(state.durationMs)}
                  </span>
                </div>

                {state.autoplayBlocked && (
                  <div className="cider-notice" data-tone="warning" style={{ marginTop: 16 }}>
                    O navegador bloqueou o início automático. Clique em reproduzir — é
                    a política de autoplay e o Cider não contorna isso.
                  </div>
                )}

                {state.error && (
                  <div className="cider-notice" data-tone="danger" style={{ marginTop: 16 }}>
                    {state.error}
                  </div>
                )}

                {/* Letras em tempo real, no mesmo estilo do desktop. */}
                <div style={{ marginTop: "var(--cider-space-6)" }}>
                  {lyrics.status === "loading" && (
                    <p style={{ color: "var(--cider-text-muted)", fontSize: "var(--cider-text-base)" }}>
                      Procurando no LRCLIB…
                    </p>
                  )}
                  {lyrics.status === "empty" && (
                    <p style={{ color: "var(--cider-text-muted)", fontSize: "var(--cider-text-base)" }}>
                      Não achamos a letra dessa faixa.
                    </p>
                  )}
                  {lyrics.view}
                  {lyrics.status === "idle" && (
                    <p style={{ color: "var(--cider-text-faint)", fontSize: "var(--cider-text-base)" }}>
                      Toque uma faixa para ver a letra.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {results.length > 0 && (
              <section>
                <div className="cider-section-head">
                  <h2 className="cider-section-title">Resultados</h2>
                  <span className="grow" />
                  <button
                    type="button"
                    className="cider-btn"
                    data-size="sm"
                    onClick={() => engine.playQueue(results, 0)}
                  >
                    <Play size={13} /> Tocar tudo
                  </button>
                </div>
                <div className="cider-rows">
                  {results.map(track => (
                    <button
                      key={track.videoId}
                      type="button"
                      className="cider-row"
                      data-playing={state.track?.videoId === track.videoId}
                      onClick={() => engine.playTrack(track, results)}
                    >
                      <img
                        className="cider-row-art"
                        src={track.artworkUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <span style={{ minWidth: 0 }}>
                        <span className="cider-row-title">{track.title}</span>
                        <span className="cider-row-meta">
                          {track.artist || track.channelName}
                          {track.version !== "studio" ? ` · ${track.version}` : ""}
                        </span>
                      </span>
                      <span className="cider-row-dur">
                        {formatTime(track.durationMs)}
                      </span>
                      <ExternalLink
                        size={13}
                        style={{ color: "var(--cider-text-faint)" }}
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <CiderPlayerBar />
    </div>
  );
}

/** Barra de reprodução fixa, equivalente ao `Playbar` do desktop. */
function CiderPlayerBar() {
  const { state, engine } = useCider();

  return (
    <footer className="cider-playbar">
      <div className="cider-now-mini">
        {state.track?.artworkUrl ? (
          <img
            className="cider-now-mini-art"
            src={state.track.artworkUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="cider-now-mini-art" />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            className="cider-row-title"
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {state.track?.title ?? "Nada tocando"}
          </div>
          <div className="cider-row-meta">
            {state.track?.artist || state.track?.channelName || "escolha uma faixa"}
          </div>
        </div>
      </div>

      <div>
        <div className="cider-transport-buttons">
          <button
            className="cider-btn"
            data-size="icon"
            data-variant="ghost"
            aria-pressed={state.shuffle}
            aria-label="Aleatório"
            onClick={engine.toggleShuffle}
          >
            <Shuffle size={17} />
          </button>
          <button
            className="cider-btn"
            data-size="icon"
            data-variant="ghost"
            aria-label="Anterior"
            disabled={!state.track}
            onClick={engine.previous}
          >
            <SkipBack size={18} />
          </button>
          <button
            className="cider-btn"
            data-size="icon"
            data-variant="primary"
            aria-label={state.phase === "playing" ? "Pausar" : "Reproduzir"}
            disabled={!state.track}
            onClick={engine.toggle}
          >
            {state.phase === "playing" ? (
              <Pause size={18} />
            ) : (
              <Play size={18} />
            )}
          </button>
          <button
            className="cider-btn"
            data-size="icon"
            data-variant="ghost"
            aria-label="Próxima"
            disabled={!state.track}
            onClick={engine.next}
          >
            <SkipForward size={18} />
          </button>
          <button
            className="cider-btn"
            data-size="icon"
            data-variant="ghost"
            aria-label="Repetir"
            onClick={engine.cycleRepeat}
          >
            {state.repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>
        <div className="cider-progress" style={{ marginTop: 6 }}>
          <span className="cider-timecode">{formatTime(state.positionMs)}</span>
          <input
            className="cider-range"
            type="range"
            min={0}
            max={Math.max(1, state.durationMs)}
            value={Math.min(state.positionMs, state.durationMs || 0)}
            aria-label="Progresso"
            onChange={event => engine.seekMs(Number(event.target.value))}
          />
          <span className="cider-timecode">{formatTime(state.durationMs)}</span>
        </div>
      </div>

      <div className="cider-playbar-extras">
        <div className="cider-volume">
          <button
            className="cider-btn"
            data-size="icon"
            data-variant="ghost"
            aria-label={state.muted ? "Ativar som" : "Silenciar"}
            onClick={engine.toggleMute}
          >
            {state.muted || state.volume === 0 ? (
              <VolumeX size={17} />
            ) : (
              <Volume2 size={17} />
            )}
          </button>
          <input
            className="cider-range"
            type="range"
            min={0}
            max={100}
            value={(state.muted ? 0 : state.volume) * 100}
            aria-label="Volume"
            onChange={event => engine.setVolume(Number(event.target.value) / 100)}
          />
        </div>
      </div>
    </footer>
  );
}

