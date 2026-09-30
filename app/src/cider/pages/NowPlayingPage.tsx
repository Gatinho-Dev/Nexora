/**
 * Tocando agora.
 *
 * A tela de foco do aplicativo, como no desktop: capa grande, controles
 * completos, caminho do áudio explícito e as letras ao lado. A diferença de
 * mecânica do desktop é que **não há arquivo local nem equalizador** — o áudio
 * é sempre o `iframe` do YouTube, e a página diz isso em vez de exibir um botão
 * de DSP que não faria nada.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  Expand,
  ExternalLink,
  Heart,
  Info,
  ListMusic,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useCider } from "../useCider";
import { useCiderLibrary } from "../library";
import { useCiderSettings } from "../settings/store";
import { useLyrics } from "../useLyrics";
import { useCiderUi } from "../ui";
import { extendQueue, playFrom, toggleFavoriteWithToast } from "../play";
import { AddToPlaylistButton } from "../components/AddToPlaylist";
import { CoverArt } from "../components/CoverArt";
import { Button, IconButton, Notice, ProgressSlider, SectionHeader } from "../components/primitives";
import { timecode } from "../format";
import { TrackList } from "../components/TrackList";

export function CiderNowPlayingPage() {
  const navigate = useNavigate();
  const { state, engine } = useCider();
  const settings = useCiderSettings((store) => store.settings);
  const favorites = useCiderLibrary((store) => store.favorites);
  const togglePanel = useCiderUi((store) => store.togglePanel);
  const setImmersive = useCiderUi((store) => store.setImmersive);
  const lyrics = useLyrics(state.track, state.positionMs, state.phase === "playing");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = state.track;
  const playing = state.phase === "playing";
  const muted = state.muted || state.volume === 0;
  const duration = state.durationMs || current?.durationMs || 0;
  const upcoming = useMemo(() => state.queue.slice(state.index + 1), [state.index, state.queue]);
  const isFavorite = current ? favorites.some((track) => track.videoId === current.videoId) : false;

  if (!current) {
    return (
      <div className="page stack gap-4">
        <SectionHeader title="Tocando agora" />
        <p className="muted small">Nada tocando. Pesquise uma música para o player carregar o vídeo.</p>
        <div className="inline">
          <Button variant="primary" onClick={() => navigate("/cider/pesquisa")}>
            Pesquisar
          </Button>
          <Button variant="ghost" onClick={() => navigate("/cider/explorar")}>
            Explorar por tema
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page now-playing-page">
      <header className="now-playing-head">
        <CoverArt url={current.artworkUrl} title={current.title} className="now-playing-art" />

        <div className="now-playing-info stack">
          <span className="xsmall faint uppercase">YouTube · player oficial</span>
          <h1 className="now-playing-title">{current.title}</h1>
          <p className="now-playing-artist">{current.artist || current.channelName}</p>

          {current.youtubeTitle && current.youtubeTitle !== current.title ? (
            <p className="xsmall faint">
              Título original do vídeo: <span title={current.youtubeTitle}>{current.youtubeTitle}</span>
            </p>
          ) : null}

          <p className="xsmall faint">
            {[current.version !== "studio" ? current.version : null, current.isExplicit ? "conteúdo explícito" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {/* O vídeo fica no dock global, atrás de uma camada opaca: aqui a capa
              é a superfície do player, como no modo de áudio do desktop. */}
          <div className="card tight inline" style={{ justifyContent: "space-between", gap: 12 }}>
            <div className="inline" style={{ minWidth: 0 }}>
              <IconButton
                label={playing ? "Pausar" : "Reproduzir"}
                tone="play"
                onClick={engine.toggle}
              >
                {playing ? <Pause size={20} /> : <Play size={20} />}
              </IconButton>
              <div className="stack tight" style={{ minWidth: 0 }}>
                <span className="small semibold">Superfície do player</span>
                <span className="xsmall faint">
                  O vídeo oficial está montado atrás desta camada opaca — o Cider é audio-first e
                  nunca exibe o vídeo.
                </span>
              </div>
            </div>
            <span className="badge">{state.phase}</span>
          </div>

          {settings.nowPlayingVisualizer ? (
            <div className="visualizer" data-active="false" style={{ height: 120 }} aria-hidden="true" />
          ) : null}

          <div className="now-playing-progress">
            <ProgressSlider
              positionMs={state.positionMs}
              durationMs={duration}
              style={settings.progressStyle}
              onSeek={engine.seekMs}
            />
            <div className="between xsmall faint tabular">
              <span>{timecode(state.positionMs)}</span>
              <span>{timecode(duration)}</span>
            </div>
          </div>

          <div className="now-playing-controls">
            <IconButton
              label="Reprodução aleatória"
              active={state.shuffle}
              onClick={engine.toggleShuffle}
            >
              <Shuffle size={18} />
            </IconButton>
            <IconButton label="Faixa anterior" onClick={engine.previous}>
              <SkipBack size={20} />
            </IconButton>
            <IconButton label={playing ? "Pausar" : "Reproduzir"} tone="play" onClick={engine.toggle}>
              {playing ? <Pause size={24} /> : <Play size={24} />}
            </IconButton>
            <IconButton label="Próxima faixa" onClick={engine.next}>
              <SkipForward size={20} />
            </IconButton>
            <IconButton
              label={
                state.repeat === "off"
                  ? "Repetir: desligado"
                  : state.repeat === "all"
                    ? "Repetir: fila"
                    : "Repetir: faixa"
              }
              active={state.repeat !== "off"}
              onClick={engine.cycleRepeat}
            >
              {state.repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </IconButton>
          </div>

          <div className="now-playing-volume inline">
            <IconButton
              label={muted ? "Ativar som" : "Silenciar"}
              onClick={() => engine.setVolume(state.volume > 0 ? 0 : 0.85)}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </IconButton>
            {/* `.volume-range` é a classe do controle de volume do desktop:
                sem ela o navegador desenha o slider nativo (azul), fora do
                tema. O `bridge.css` cuida só do tamanho aqui. */}
            <input
              type="range"
              className="volume-range"
              min={0}
              max={100}
              value={Math.round((muted ? 0 : state.volume) * 100)}
              aria-label="Volume"
              onChange={(event) => engine.setVolume(Number(event.target.value) / 100)}
            />
            <span className="xsmall faint tabular">{Math.round((muted ? 0 : state.volume) * 100)}%</span>
          </div>

          <div className="inline wrap">
            <Button
              icon={<Heart size={16} />}
              onClick={() => toggleFavoriteWithToast(current)}
            >
              {isFavorite ? "Favoritado" : "Favoritar"}
            </Button>
            <AddToPlaylistButton tracks={[current]} />
            <Button icon={<MicVocal size={16} />} onClick={() => togglePanel("lyrics")}>
              Letras no painel
            </Button>
            <Button icon={<Expand size={16} />} onClick={() => setImmersive(true)}>
              Modo imersivo
            </Button>
            <Button icon={<Activity size={16} />} onClick={() => navigate("/cider/diagnostico")}>
              Diagnóstico do player
            </Button>
            <a className="btn" href={current.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> Abrir no YouTube
            </a>
          </div>

          <p className="xsmall faint">
            Faixa {state.index + 1} de {state.queue.length} ·{" "}
            <button
              type="button"
              className="link"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setMessage(null);
                void extendQueue(engine)
                  .then((result) =>
                    setMessage(
                      result.added > 0
                        ? `${result.added} faixa(s) relacionadas adicionadas à fila.`
                        : result.error ?? "Nada novo encontrado.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              estender a fila com faixas relacionadas
            </button>
          </p>

          {message ? <p className="xsmall faint">{message}</p> : null}

          {state.autoplayBlocked ? (
            <Notice tone="warning" title="O navegador bloqueou o início automático">
              Clique em reproduzir — é a política de autoplay do navegador, e o Cider não tenta
              contorná-la.
            </Notice>
          ) : null}

          {state.error ? (
            <Notice tone="danger" title="O player reportou um problema">
              {state.error} Se o problema for de incorporação (códigos 101/150), o autor do vídeo
              não permite tocar fora do YouTube — a lista continua valendo, e "Abrir no YouTube" leva
              ao vídeo.
            </Notice>
          ) : null}
        </div>
      </header>

      {upcoming.length > 0 ? (
        <section className="section">
          <SectionHeader
            title="A seguir"
            action={
              <button type="button" className="link xsmall" onClick={() => togglePanel("queue")}>
                Abrir a fila
              </button>
            }
          />
          <TrackList
            tracks={upcoming.slice(0, 6)}
            favorites={favorites.map((track) => track.videoId)}
            showAlbum={false}
            onPlay={(index) => engine.playIndex(state.index + 1 + index)}
            onAddToQueue={(track) => engine.appendQueue([track])}
          />
          <div className="inline mt-2">
            <Button
              size="sm"
              icon={<Sparkles size={14} />}
              onClick={() => playFrom(engine, state.queue.slice(state.index), 0)}
            >
              Tocar o restante da fila
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<ListMusic size={14} />}
              onClick={() => togglePanel("queue")}
            >
              Ver a fila completa
            </Button>
          </div>
        </section>
      ) : null}

      {settings.nowPlayingLyrics ? (
        <section className="section">
          <SectionHeader
            title="Letras"
            action={
              <button
                type="button"
                className="link xsmall"
                onClick={() => navigate("/cider/configuracoes/aparencia")}
              >
                Ajustar a aparência
              </button>
            }
          />
          {lyrics.status === "loading" ? <p className="muted small">Procurando no LRCLIB…</p> : null}
          {lyrics.status === "empty" ? (
            <p className="muted small">Não achamos a letra desta faixa no LRCLIB.</p>
          ) : null}
          {lyrics.status === "ready" ? <div className="lyrics-scope">{lyrics.view}</div> : null}
        </section>
      ) : null}

      <Notice tone="info" title="Privacidade e atribuição">
        YouTube é a fonte deste conteúdo: o título original do vídeo é preservado e "Abrir no
        YouTube" leva ao vídeo. O Cider não baixa, não converte e não hospeda este vídeo.{" "}
        <Info size={13} />
      </Notice>
    </div>
  );
}
