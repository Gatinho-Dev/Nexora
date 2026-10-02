/**
 * Modo imersivo: capa grande, letras ao lado e controles no rodapé.
 *
 * O desktop tinha quatro arranjos (capa, letras, visualizador e canvas). Aqui
 * ficaram dois — capa e letras —, porque o visualizador precisaria analisar o
 * áudio, e o áudio está dentro de um `<iframe>` de outra origem: o navegador não
 * dá acesso às amostras. Um visualizador que não reage ao som seria enfeite
 * mentiroso; ele aparece em Tocando agora com o aviso de que não há sinal.
 */

import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";

import { useCider } from "../useCider";
import { useLyrics } from "../useLyrics";
import { useCiderUi } from "../ui";
import { CoverArt } from "./CoverArt";
import { IconButton, ProgressSlider } from "./primitives";
import { timecode } from "../format";

export function CiderImmersive() {
  const immersive = useCiderUi((state) => state.immersive);
  const layout = useCiderUi((state) => state.immersiveLayout);
  const setImmersive = useCiderUi((state) => state.setImmersive);
  const setLayout = useCiderUi((state) => state.setImmersiveLayout);
  const { state, engine } = useCider();
  const lyrics = useLyrics(state.track, state.positionMs, state.phase === "playing", "immersive");

  if (!immersive) return null;

  const current = state.track;
  const playing = state.phase === "playing";
  const muted = state.muted || state.volume === 0;
  const duration = state.durationMs || current?.durationMs || 0;
  const showLyrics = layout === "lyrics";

  return (
    <div className="immersive" role="dialog" aria-modal="true" aria-label="Modo imersivo">
      {current?.artworkUrl ? (
        <div className="immersive-bg" style={{ backgroundImage: `url(${current.artworkUrl})` }} aria-hidden="true" />
      ) : null}
      <div className="immersive-scrim" aria-hidden="true" />

      <div className="immersive-topbar">
        <span className="badge accent">{current ? current.title : "Nada tocando"}</span>
        <div className="inline">
          <div className="segmented" role="group" aria-label="Arranjo do modo imersivo">
            <button type="button" aria-pressed={!showLyrics} onClick={() => setLayout("cover")}>
              Capa
            </button>
            <button type="button" aria-pressed={showLyrics} onClick={() => setLayout("lyrics")}>
              Letras
            </button>
          </div>
          <IconButton label="Sair do modo imersivo" onClick={() => setImmersive(false)}>
            <X size={18} />
          </IconButton>
        </div>
      </div>

      <div className="immersive-content" data-layout="auto">
        {current?.artworkUrl ? (
          <img className="immersive-cover" src={current.artworkUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <CoverArt title="Cider 2" className="immersive-cover" />
        )}
        {showLyrics ? (
          lyrics.view ? (
            <div className="immersive-lyrics">{lyrics.view}</div>
          ) : (
            <div className="stack gap-3" style={{ maxWidth: 380 }}>
              <p className="muted">
                {lyrics.status === "loading"
                  ? "Procurando a letra…"
                  : "As fontes automáticas não têm a letra desta faixa."}
              </p>
              {lyrics.status !== "loading" && lyrics.searchUrl ? (
                <a
                  className="btn"
                  href={lyrics.searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Procurar a letra no Google
                </a>
              ) : null}
            </div>
          )
        ) : (
          <div className="stack" style={{ maxWidth: 420 }}>
            <h2 style={{ fontSize: "var(--cider-text-2xl)" }}>{current?.title ?? "Cider 2"}</h2>
            <p className="muted">
              {current ? current.artist || current.channelName : "Pesquise uma música para começar."}
            </p>
            {current ? <p className="xsmall faint tabular">{timecode(duration)}</p> : null}
          </div>
        )}
      </div>

      <div className="immersive-controls">
        <div className="transport-buttons">
          <IconButton label="Reprodução aleatória" active={state.shuffle} onClick={engine.toggleShuffle}>
            <Shuffle size={18} />
          </IconButton>
          <IconButton label="Faixa anterior" onClick={engine.previous}>
            <SkipBack size={20} />
          </IconButton>
          <IconButton label={playing ? "Pausar" : "Reproduzir"} tone="play" onClick={engine.toggle} disabled={!current}>
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </IconButton>
          <IconButton label="Próxima faixa" onClick={engine.next} disabled={!current}>
            <SkipForward size={20} />
          </IconButton>
          <IconButton label="Repetição" active={state.repeat !== "off"} onClick={engine.cycleRepeat}>
            {state.repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </IconButton>
          <IconButton
            label={muted ? "Reativar som" : "Silenciar"}
            onClick={() => engine.setVolume(state.volume > 0 ? 0 : 0.85)}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </IconButton>
        </div>
        <div className="progress-row" style={{ maxWidth: 720 }}>
          <span className="timecode">{timecode(state.positionMs)}</span>
          <ProgressSlider positionMs={state.positionMs} durationMs={duration} onSeek={engine.seekMs} />
          <span className="timecode right">{timecode(duration)}</span>
        </div>
      </div>
    </div>
  );
}
