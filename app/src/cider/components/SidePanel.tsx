/**
 * Painel lateral: fila e letras.
 *
 * Os dois painéis existiam no desktop e continuam sendo os mesmos: a fila com
 * "tocando agora" e "a seguir", e as letras em tempo real. O painel de
 * dispositivos de áudio ficou de fora — no navegador não há dispositivo de
 * saída para escolher, e um painel vazio seria pior que a ausência dele.
 */

import { ExternalLink, ListMusic, Loader2, MicVocal, Trash2, X } from "lucide-react";

import { useCider } from "../useCider";
import { useLyrics } from "../useLyrics";
import { useCiderUi } from "../ui";
import { timecode } from "../format";
import { clearManualQueue } from "../play";
import { Button, EmptyState, IconButton } from "./primitives";

export function CiderSidePanel() {
  const panel = useCiderUi((state) => state.panel);
  const setPanel = useCiderUi((state) => state.setPanel);
  if (!panel) return null;

  return (
    <section
      className="side-panel"
      data-panel={panel}
      aria-label={panel === "queue" ? "Fila de reprodução" : "Letras"}
    >
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
  const manual = new Set(state.manual);

  return (
    <div className="stack">
      {/*
        * Dois botões, duas coisas diferentes:
        *
        * - **Limpar** tira só o que foi adicionado à mão (o desenho do iOS 18) e
        *   deixa o contexto — o álbum, a lista, a estação — seguindo;
        * - o segundo **para tudo** e esvazia a fila, que é o que a lixeira fazia
        *   sozinha. Sem separar os dois, "limpar" seria sempre o gesto destrutivo
        *   e o contexto que a pessoa estava ouvindo iria junto.
        */}
      <div className="spread">
        <span className="xsmall faint uppercase">
          {state.index + 1} de {state.queue.length}
        </span>
        <div className="inline">
          <Button
            size="sm"
            variant="ghost"
            disabled={manual.size === 0}
            title="Tira da fila só o que você adicionou à mão"
            onClick={() => clearManualQueue(engine)}
          >
            Limpar{manual.size > 0 ? ` (${manual.size})` : ""}
          </Button>
          <IconButton label="Parar e limpar tudo" onClick={engine.clearQueue}>
            <Trash2 size={14} />
          </IconButton>
        </div>
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
            const byHand = manual.has(position);
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
                  {/* A marca vem antes do título: depois dele o truncamento
                      comeria justamente a informação nova. */}
                  <span className="queue-title truncate">
                    {byHand ? (
                      <span className="queue-tag" title="Adicionada à mão — sai com “Limpar”">
                        à mão
                      </span>
                    ) : null}
                    {track.title}
                  </span>
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
  const lyrics = useLyrics(state.track, state.positionMs, state.phase === "playing", "panel");

  if (!state.track) {
    return (
      <EmptyState
        icon={<MicVocal size={22} />}
        title="Nada tocando"
        message="As letras aparecem aqui quando uma faixa estiver carregada."
      />
    );
  }

  if (lyrics.status === "loading") {
    return (
      <p className="muted small lyrics-status">
        <Loader2 size={14} className="cider-spin" /> Procurando a letra…
      </p>
    );
  }

  if (lyrics.status === "empty") {
    return (
      <div className="lyrics-empty stack gap-3">
        <p className="muted small">
          As fontes automáticas não têm a letra desta faixa. O Cider não inventa letra — mas a busca
          na web resolve em um clique.
        </p>
        {lyrics.searchUrl ? (
          <a className="btn" href={lyrics.searchUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Procurar a letra no Google
          </a>
        ) : null}
      </div>
    );
  }

  return <>{lyrics.view}</>;
}
