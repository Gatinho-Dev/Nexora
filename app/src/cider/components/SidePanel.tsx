/**
 * Painel lateral: fila e letras.
 *
 * Os dois painéis existiam no desktop e continuam sendo os mesmos: a fila com
 * "tocando agora" e "a seguir", e as letras em tempo real. O painel de
 * dispositivos de áudio ficou de fora — no navegador não há dispositivo de
 * saída para escolher, e um painel vazio seria pior que a ausência dele.
 */

import { ListMusic, MicVocal, Trash2, X } from "lucide-react";

import { useCider } from "../useCider";
import { useLyrics } from "../useLyrics";
import { useCiderUi } from "../ui";
import { timecode } from "../format";
import { Button, EmptyState, IconButton } from "./primitives";

export function CiderSidePanel() {
  const panel = useCiderUi((state) => state.panel);
  const setPanel = useCiderUi((state) => state.setPanel);
  if (!panel) return null;

  return (
    <section className="side-panel" aria-label={panel === "queue" ? "Fila de reprodução" : "Letras"}>
      <div className="panel-head">
        <h3>
          {panel === "queue" ? (
            <span className="inline">
              <ListMusic size={17} /> Fila de reprodução
            </span>
          ) : (
            <span className="inline">
              <MicVocal size={17} /> Letras
            </span>
          )}
        </h3>
        <IconButton label="Fechar painel" onClick={() => setPanel(null)}>
          <X size={16} />
        </IconButton>
      </div>
      <div className="panel-body">
        {panel === "queue" ? <QueuePanel /> : <LyricsPanel />}
      </div>
    </section>
  );
}

function QueuePanel() {
  const { state, engine } = useCider();
  const current = state.track;

  if (!current) {
    return (
      <EmptyState
        icon={<ListMusic size={22} />}
        title="Fila vazia"
        message="Pesquise uma música ou abra um tema em Explorar para começar uma fila."
      />
    );
  }

  const upcoming = state.queue.slice(state.index + 1);

  return (
    <div className="stack">
      <div className="spread">
        <span className="xsmall faint uppercase">
          {state.index + 1} de {state.queue.length}
        </span>
        <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={engine.clearQueue}>
          Limpar fila
        </Button>
      </div>

      <div className="queue-section-label">Tocando agora</div>
      <div className="queue-item" aria-current="true">
        <span className="queue-index">▶</span>
        <span className="queue-text">
          <span className="queue-title truncate" title={current.title}>
            {current.title}
          </span>
          <span className="queue-artist truncate">{current.artist || current.channelName}</span>
        </span>
        <span className="queue-actions">
          <span className="xsmall faint tabular">{timecode(state.durationMs || current.durationMs)}</span>
        </span>
      </div>

      {upcoming.length === 0 ? (
        <p className="small muted">Nada depois desta faixa. Use “Estender a fila” em Tocando agora.</p>
      ) : (
        <>
          <div className="queue-section-label">A seguir</div>
          {upcoming.map((track, offset) => {
            const position = state.index + 1 + offset;
            return (
              <div className="queue-item" key={`${track.videoId}-${position}`}>
                <button
                  type="button"
                  className="queue-index"
                  style={{ border: 0, background: "none", cursor: "pointer" }}
                  onClick={() => engine.playIndex(position)}
                  aria-label={`Tocar ${track.title}`}
                  title="Tocar agora"
                >
                  {offset + 1}
                </button>
                <button
                  type="button"
                  className="queue-text"
                  style={{ border: 0, background: "none", textAlign: "left", cursor: "pointer", color: "inherit" }}
                  onClick={() => engine.playIndex(position)}
                  title={track.title}
                >
                  <span className="queue-title truncate">{track.title}</span>
                  <span className="queue-artist truncate">{track.artist || track.channelName}</span>
                </button>
                <span className="queue-actions">
                  <IconButton
                    label="Remover da fila"
                    onClick={() => engine.removeFromQueue(position)}
                  >
                    <X size={14} />
                  </IconButton>
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function LyricsPanel() {
  const { state } = useCider();
  const lyrics = useLyrics(state.track, state.positionMs, state.phase === "playing");

  if (!state.track) {
    return (
      <EmptyState
        icon={<MicVocal size={22} />}
        title="Nada tocando"
        message="As letras aparecem aqui quando uma faixa estiver carregada."
      />
    );
  }

  if (lyrics.status === "loading") return <p className="muted small">Procurando no LRCLIB…</p>;
  if (lyrics.status === "empty") {
    return (
      <p className="muted small">
        Não encontramos a letra desta faixa no LRCLIB. O Cider não inventa letra: quando a fonte não
        tem, ele diz que não tem.
      </p>
    );
  }
  if (!lyrics.view) return null;

  return <div className="lyrics-scope">{lyrics.view}</div>;
}
