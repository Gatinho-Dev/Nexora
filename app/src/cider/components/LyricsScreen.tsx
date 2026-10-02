/**
 * Tela cheia de letras — a que abre ao clicar na capa do que está tocando.
 *
 * É a leitura do Apple Music, com o material do Cider: a capa num bloco à
 * esquerda com os controles logo abaixo, a letra grande à direita, o fundo
 * sendo a própria capa muito desfocada e o ✕ no canto superior esquerdo.
 *
 * Três decisões que valem explicação:
 *
 * 1. **Nada de rota própria.** É uma sobreposição controlada pelo estado da
 *    interface (`useCiderUi.lyricsScreen`). Se fosse uma rota, abrir a letra
 *    sairia do Cider e o áudio dependeria de o provedor continuar montado —
 *    justamente o que a arquitetura evita.
 * 2. **O fundo é a capa desfocada**, não um gradiente inventado: a cor vem da
 *    música que está tocando.
 * 3. **A letra pede o documento com `variant="fullscreen"`**, que é o único
 *    lugar onde ela tem tamanho de leitura em vez de tamanho de painel.
 */

import {
  Heart,
  MicVocal,
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
import { timecode } from "../format";
import { useCiderLibrary } from "../library";
import { toggleFavoriteWithToast } from "../play";
import { useCider } from "../useCider";
import { useCiderUi } from "../ui";
import { useLyrics } from "../useLyrics";
import { CoverArt } from "./CoverArt";
import { ProgressSlider } from "./primitives";

export function CiderLyricsScreen() {
  const open = useCiderUi((state) => state.lyricsScreen);
  const setLyricsScreen = useCiderUi((state) => state.setLyricsScreen);
  const { state, engine } = useCider();
  const favorites = useCiderLibrary((store) => store.favorites);
  const lyrics = useLyrics(state.track, state.positionMs, state.phase === "playing", "fullscreen");

  if (!open) return null;

  const current = state.track;
  const playing = state.phase === "playing";
  const muted = state.muted || state.volume === 0;
  const duration = state.durationMs || current?.durationMs || 0;
  const remaining = Math.max(0, duration - state.positionMs);
  const isFavorite = current ? favorites.some((track) => track.videoId === current.videoId) : false;

  return (
    <div
      className="lyrics-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Letra em tela cheia"
      data-empty={current ? "false" : "true"}
    >
      {current?.artworkUrl ? (
        <div
          className="lyrics-screen-bg"
          style={{ backgroundImage: `url(${current.artworkUrl})` }}
          aria-hidden="true"
        />
      ) : null}
      <div className="lyrics-screen-scrim" aria-hidden="true" />

      <button
        type="button"
        className="lyrics-screen-close"
        onClick={() => setLyricsScreen(false)}
        aria-label="Fechar"
        title="Fechar (Esc)"
      >
        <X size={22} />
      </button>

      <div className="lyrics-screen-body">
        <div className="lyrics-screen-left">
          <div className="lyrics-screen-art">
            {current?.artworkUrl ? (
              <img src={current.artworkUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <CoverArt title="Cider 2" className="cover" />
            )}
          </div>

          <div className="lyrics-screen-meta">
            <div className="lyrics-screen-text">
              <div className="lyrics-screen-title truncate" title={current?.title}>
                {current ? current.title : "Nada tocando"}
              </div>
              <div className="lyrics-screen-artist truncate">
                {current
                  ? [current.artist || current.channelName, current.albumHint].filter(Boolean).join(" — ")
                  : "Escolha uma música para ouvir"}
              </div>
            </div>
            <div className="lyrics-screen-tools">
              <button
                type="button"
                className="lyrics-screen-tool"
                aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
                title={isFavorite ? "Remover dos favoritos" : "Favoritar"}
                aria-pressed={isFavorite}
                data-on={isFavorite ? "true" : "false"}
                disabled={!current}
                onClick={() => current && toggleFavoriteWithToast(current)}
              >
                <Heart size={17} />
              </button>
              <button
                type="button"
                className="lyrics-screen-tool"
                aria-label="Painel de letras"
                title="Painel de letras"
                onClick={() => {
                  setLyricsScreen(false);
                  useCiderUi.getState().setPanel("lyrics");
                }}
              >
                <MicVocal size={17} />
              </button>
            </div>
          </div>

          <div className="lyrics-screen-progress">
            <ProgressSlider
              positionMs={state.positionMs}
              durationMs={duration}
              onSeek={engine.seekMs}
            />
            <div className="lyrics-screen-times xsmall tabular">
              <span>{timecode(state.positionMs)}</span>
              <span>-{timecode(remaining)}</span>
            </div>
          </div>

          <div className="lyrics-screen-transport">
            <button
              type="button"
              className="lyrics-screen-tool"
              aria-label="Reprodução aleatória"
              aria-pressed={state.shuffle}
              onClick={engine.toggleShuffle}
            >
              <Shuffle size={18} />
            </button>
            <button
              type="button"
              className="lyrics-screen-tool"
              aria-label="Faixa anterior"
              disabled={!current}
              onClick={engine.previous}
            >
              <SkipBack size={20} />
            </button>
            <button
              type="button"
              className="lyrics-screen-tool big"
              aria-label={playing ? "Pausar" : "Reproduzir"}
              disabled={!current}
              onClick={engine.toggle}
            >
              {playing ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              type="button"
              className="lyrics-screen-tool"
              aria-label="Próxima faixa"
              disabled={!current}
              onClick={engine.next}
            >
              <SkipForward size={20} />
            </button>
            <button
              type="button"
              className="lyrics-screen-tool"
              aria-label="Repetição"
              aria-pressed={state.repeat !== "off"}
              onClick={engine.cycleRepeat}
            >
              {state.repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>

          <div className="lyrics-screen-volume">
            <button
              type="button"
              className="lyrics-screen-tool"
              aria-label={muted ? "Reativar som" : "Silenciar"}
              onClick={() => engine.setVolume(state.volume > 0 ? 0 : 0.85)}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
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
        </div>

        <div className="lyrics-screen-right">
          {lyrics.view ? (
            lyrics.view
          ) : (
            <div className="lyrics-screen-message">
              {lyrics.status === "loading"
                ? "Procurando a letra…"
                : current
                  ? "As fontes automáticas não têm a letra desta faixa."
                  : "Coloque algo para tocar e a letra aparece aqui."}
              {lyrics.status !== "loading" && lyrics.searchUrl ? (
                <a className="btn" href={lyrics.searchUrl} target="_blank" rel="noopener noreferrer">
                  Procurar a letra no Google
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
