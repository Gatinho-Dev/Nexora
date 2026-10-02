/**
 * A gaveta "Adicionar músicas à fila" — a última peça do desenho de fila do
 * iOS 18 que faltava.
 *
 * No player antigo, acrescentar música à fila exigia **sair** da fila: ir à
 * busca, achar a faixa, adicionar, voltar. A referência que o usuário pediu
 * resolve isso levando a busca para dentro da própria lista, junto de duas coisas
 * que fazem diferença: **sugestões** (a biblioteca deste navegador, o que foi
 * ouvido por último na frente) e **prévia** — ouvir um trecho antes de
 * comprometer a sessão inteira.
 *
 * Três decisões que o comportamento exigiu:
 *
 * - **a prévia cala o que toca em vez de brigar com ele.** Dois áudios ao mesmo
 *   tempo não é um recurso, é um acidente: o motor é pausado por `engine.pause()`
 *   e a prévia sobe num player próprio, montado num canto invisível do diálogo
 *   (o `<iframe>` precisa de área real, mas a cara dele é do YouTube, não nossa —
 *   o que se vê é a capa e uma barra de 30 s);
 * - **30 segundos e para.** É uma prévia, não uma segunda reprodução: sem o teto,
 *   adicionar música viraria uma forma de ouvir a música inteira sem entrar na
 *   fila — e a prévia termina devolvendo a reprodução **como estava** (se estava
 *   tocando, volta tocando; se estava pausada, não começa a tocar);
 * - **a busca é a mesma da tela de pesquisa**, pelo mesmo `runSearch`, com as
 *   mesmas preferências de ordenação. Uma busca paralela aqui responderia
 *   diferente da busca ali, e a interface passaria a ter duas verdades.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Play, Plus, Search, Square } from "lucide-react";

import type { CiderTrack } from "../api/query";
import { YouTubePlayer } from "../core/player";
import { newIn, queueIds, queueSuggestions } from "../core/queueAdd";
import { useCider } from "../useCider";
import { useCiderLibrary } from "../library";
import { currentSearchPreferences, runSearch } from "../play";
import { ciderToast, useCiderUi } from "../ui";
import { Button, Modal } from "./primitives";

/** Teto da prévia: 30 s, como o trecho de vitrine dos serviços de música. */
export const PREVIEW_MS = 30_000;

/** Espera antes de buscar enquanto a pessoa digita. */
const SEARCH_DEBOUNCE_MS = 350;

export function CiderQueueAddDialog() {
  const open = useCiderUi((state) => state.queueAddOpen);
  const setOpen = useCiderUi((state) => state.setQueueAddOpen);
  const { engine, state } = useCider();
  const history = useCiderLibrary((store) => store.history);
  const favorites = useCiderLibrary((store) => store.favorites);

  const [term, setTerm] = useState("");
  const [outcome, setOutcome] = useState<{ query: string; tracks: CiderTrack[] } | null>(null);
  const [preview, setPreview] = useState<{ track: CiderTrack; positionMs: number } | null>(null);

  const dockRef = useRef<HTMLDivElement | null>(null);
  const previewPlayer = useRef<YouTubePlayer | null>(null);
  /** Faixa que está sendo pré-ouvida (o estado do React chega um quadro depois). */
  const previewId = useRef<string | null>(null);
  /** Como devolver a reprodução ao estado de antes da prévia. */
  const restoreRef = useRef<(() => void) | null>(null);

  const ids = useMemo(() => queueIds(state.queue), [state.queue]);

  const stopPreview = useCallback(() => {
    // A limpeza da interface vem **antes** do comando ao player: se o player
    // recusar o pause (ele só responde depois do `onReady`), a prévia ainda
    // precisa sair da tela e a música voltar — a tela não pode ficar presa
    // mostrando uma prévia que já acabou.
    previewId.current = null;
    setPreview(null);
    const restore = restoreRef.current;
    restoreRef.current = null;
    previewPlayer.current?.pause();
    restore?.();
  }, []);

  // O callback do player é criado uma vez; o `stop` do momento vive num ref para
  // o fim da prévia não chamar uma versão antiga da função.
  const stopRef = useRef(stopPreview);
  useEffect(() => {
    stopRef.current = stopPreview;
  }, [stopPreview]);

  /** Cria (uma vez) e monta o player da prévia no canto invisível do diálogo. */
  const ensurePlayer = useCallback(async (): Promise<YouTubePlayer | null> => {
    if (!previewPlayer.current) {
      previewPlayer.current = new YouTubePlayer({
        onTime: (positionMs) => {
          if (positionMs >= PREVIEW_MS) {
            stopRef.current();
            return;
          }
          setPreview((current) => (current ? { ...current, positionMs } : current));
        },
        onEnded: () => stopRef.current(),
        onPhase: (phase, error) => {
          if (phase !== "error") return;
          ciderToast("warning", "A prévia não pôde tocar", error ?? undefined);
          stopRef.current();
        },
        onAutoplayBlocked: () => stopRef.current(),
      });
    }
    const dock = dockRef.current;
    if (!dock) return null;
    await previewPlayer.current.mount(dock);
    return previewPlayer.current;
  }, []);

  const startPreview = useCallback(
    (track: CiderTrack) => {
      if (previewId.current === track.videoId) {
        stopPreview();
        return;
      }
      previewId.current = track.videoId;
      // Uma prévia só: trocar de faixa não empilha "como estava" duas vezes.
      if (!restoreRef.current) {
        const wasPlaying = state.phase === "playing";
        engine.pause();
        restoreRef.current = () => {
          if (wasPlaying) engine.resume();
        };
      }
      setPreview({ track, positionMs: 0 });
      void ensurePlayer().then((player) => {
        if (!player) return;
        player.setVolume(state.muted ? 0 : state.volume);
        void player.playQueue([track.videoId], 0);
      });
    },
    [engine, ensurePlayer, state.muted, state.phase, state.volume, stopPreview]
  );

  /**
   * Fechar é um caminho só (o ✕, o Esc, o clique fora) e ele limpa tudo:
   * um diálogo fechado não pode deixar um segundo player tocando sozinho nem a
   * busca da próxima abertura já preenchida.
   */
  const close = useCallback(() => {
    stopPreview();
    setTerm("");
    setOutcome(null);
    setOpen(false);
  }, [setOpen, stopPreview]);

  useEffect(() => () => {
    previewPlayer.current?.dispose();
    previewPlayer.current = null;
  }, []);

  // Busca com espera: cada tecla digitada não precisa virar uma consulta à
  // fonte — a última é a que interessa.
  useEffect(() => {
    if (!open) return undefined;
    const query = term.trim();
    if (!query || outcome?.query === query) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      void runSearch(query, currentSearchPreferences())
        .then((result) => {
          if (alive) setOutcome({ query, tracks: result.tracks });
        })
        .catch(() => {
          if (alive) setOutcome({ query, tracks: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, term, outcome]);

  const suggestions = useMemo(
    () => queueSuggestions({ history, favorites, queue: state.queue }),
    [history, favorites, state.queue]
  );

  const query = term.trim();
  // O resultado guarda **qual consulta o produziu**, e "carregando" é derivado
  // disso: existe uma consulta e ainda não existe o resultado dela. Sem bandeira
  // própria não há como o indicador ficar girando depois que a resposta chegou.
  const matched = outcome?.query === query ? outcome : null;
  const results = useMemo(() => matched?.tracks ?? [], [matched]);
  const searching = query !== "" && matched === null;
  const addable = useMemo(() => newIn(results, ids), [results, ids]);

  const add = useCallback(
    (tracks: CiderTrack[], title: string) => {
      const snapshot = engine.snapshot();
      const fresh = newIn(tracks, queueIds(snapshot.queue));
      if (fresh.length === 0) {
        ciderToast("info", "Já estava na fila", title);
        return;
      }
      // Sem nada tocando não existe "depois": o `playAfter` do motor faz delas a
      // fila nova — marcadas como **à mão** (é o que o "Limpar" tira) e já
      // começando a tocar. Usar o `playQueue` aqui as marcaria como contexto, e
      // quem tivesse adicionado as cinco músicas à mão não poderia limpá-las.
      if (snapshot.index < 0) {
        engine.playAfter(fresh);
        ciderToast(
          "success",
          "Tocando agora",
          fresh.length === 1 ? fresh[0]!.title : `${fresh.length} faixas na fila`
        );
        return;
      }
      engine.appendQueue(fresh);
      ciderToast(
        "success",
        fresh.length === 1 ? "Adicionada à fila" : `${fresh.length} faixas adicionadas`,
        title
      );
    },
    [engine]
  );

  if (!open) return null;

  return (
    <Modal open title="Adicionar músicas à fila" wide onClose={close}>
      <div className="queue-add">
        <form
          className="search-field"
          onSubmit={(event) => event.preventDefault()}
          style={{ minWidth: 0 }}
        >
          <Search size={16} />
          <input
            type="search"
            value={term}
            autoFocus
            aria-label="Buscar músicas para adicionar à fila"
            placeholder="Nome da música, artista, album:…"
            onChange={(event) => setTerm(event.target.value)}
          />
          {searching ? <Loader2 size={16} className="cider-spin" /> : null}
        </form>

        {/* A área da prévia é fixa: o `<iframe>` precisa de área real para
            inicializar, e um bloco que aparece e some faria o diálogo inteiro
            pular a cada prévia. */}
        <div className="preview-area" data-active={preview ? "true" : "false"}>
          <div className="preview-dock" ref={dockRef} aria-hidden="true" />
          {preview ? (
            <div className="preview-tile">
              {preview.track.artworkUrl ? (
                <img src={preview.track.artworkUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="preview-art-fallback" aria-hidden="true">
                  {preview.track.title.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="preview-info">
                <span className="preview-label">Prévia de 30 s</span>
                <span className="preview-title truncate" title={preview.track.title}>
                  {preview.track.title}
                </span>
                <div
                  className="preview-progress"
                  role="progressbar"
                  aria-label="Progresso da prévia"
                  aria-valuemin={0}
                  aria-valuemax={30}
                  aria-valuenow={Math.min(30, Math.round(preview.positionMs / 1000))}
                >
                  <span
                    style={{
                      width: `${Math.min(100, (preview.positionMs / PREVIEW_MS) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <Button size="sm" icon={<Square size={13} />} onClick={stopPreview}>
                Parar
              </Button>
            </div>
          ) : (
            <p className="xsmall faint preview-hint">
              Toque no ▶ de uma faixa para ouvir um trecho de 30 s antes de adicionar. O que está
              tocando fica pausado e volta depois.
            </p>
          )}
        </div>

        {query ? (
          <div className="queue-add-list">
            <div className="queue-section-label">
              Resultado para “{query}” {results.length > 0 ? `· ${results.length}` : ""}
            </div>
            {searching && results.length === 0 ? (
              <p className="inline muted small">
                <Loader2 size={14} className="cider-spin" /> Buscando…
              </p>
            ) : null}
            {!searching && results.length === 0 && matched ? (
              <p className="small muted">
                Nada encontrado. Vale tentar o título exato da música, ou o nome do artista.
              </p>
            ) : null}
            {results.map((track) => (
              <AddRow
                key={track.videoId}
                track={track}
                inQueue={ids.has(track.videoId)}
                previewing={preview?.track.videoId === track.videoId}
                onPreview={() => startPreview(track)}
                onAdd={() => add([track], track.title)}
              />
            ))}
            {addable.length > 1 ? (
              <Button
                className="queue-add-all"
                icon={<Plus size={14} />}
                onClick={() => add(results, `${addable.length} faixas de “${query}”`)}
              >
                Adicionar todas as {addable.length} que ainda não estão na fila
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="queue-add-list">
            <div className="queue-section-label">Da sua biblioteca</div>
            {suggestions.length === 0 ? (
              <p className="small muted">
                Ainda não há histórico nem favoritos neste navegador. A busca acima encontra
                qualquer faixa.
              </p>
            ) : (
              suggestions.map((track) => (
                <AddRow
                  key={track.videoId}
                  track={track}
                  inQueue={ids.has(track.videoId)}
                  previewing={preview?.track.videoId === track.videoId}
                  onPreview={() => startPreview(track)}
                  onAdd={() => add([track], track.title)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Uma linha da gaveta.
 *
 * O toque no ▶ é **prévia**, não reprodução: a linha é irmã da capa no
 * repertório de gestos do Cider (lá a capa toca), e por isso o rótulo acessível
 * diz exatamente o que vai acontecer — nada de um botão que parece tocar e
 * apenas sussurra.
 */
function AddRow({
  track,
  inQueue,
  previewing,
  onPreview,
  onAdd,
}: {
  track: CiderTrack;
  inQueue: boolean;
  previewing: boolean;
  onPreview: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="queue-add-row" data-in-queue={inQueue ? "true" : "false"}>
      <span className="queue-add-art">
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="queue-add-art-fallback" aria-hidden="true">
            {track.title.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="queue-add-text">
        <span className="queue-title truncate" title={track.title}>
          {inQueue ? <span className="queue-tag">na fila</span> : null}
          {track.title}
        </span>
        <span className="queue-artist truncate">{track.artist || track.channelName}</span>
      </span>
      <span className="queue-add-actions">
        <button
          type="button"
          className="btn icon"
          onClick={onPreview}
          aria-label={`${previewing ? "Parar a" : "Ouvir a"} prévia de ${track.title}`}
          title={previewing ? "Parar a prévia" : "Ouvir 30 segundos"}
        >
          {previewing ? <Square size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          className="btn icon"
          disabled={inQueue}
          onClick={onAdd}
          aria-label={inQueue ? `${track.title} já está na fila` : `Adicionar ${track.title} à fila`}
          title={inQueue ? "Já está na fila" : "Adicionar à fila"}
        >
          {inQueue ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </span>
    </div>
  );
}
