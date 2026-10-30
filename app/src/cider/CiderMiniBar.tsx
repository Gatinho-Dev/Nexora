/**
 * Janela flutuante do Cider, para fora de `/cider`.
 *
 * Existe por um motivo concreto: o `<iframe>` continua tocando quando o usuário
 * sai do player para a Nexora (ele mora no dock, acima do roteador), mas sem
 * nenhum controle na tela não haveria como pausar. É a única superfície de
 * controle fora de `/cider`; sem faixa carregada não aparece, porque um player
 * vazio não tem o que controlar.
 *
 * Três decisões que valem explicação:
 *
 * 1. **Arrastável, com posição lembrada.** A janela nasce no canto inferior
 *    direito, mas o usuário pode levá-la para onde quiser — e a posição fica
 *    salva, porque reposicionar a cada navegação seria pior do que não deixar
 *    arrastar.
 * 2. **O arrasto ignora os controles.** `pointerdown` em cima de um botão não
 *    inicia o movimento; sem isso, todo clique em "pausar" virava um arrasto de
 *    2 px que às vezes cancelava a própria ação.
 * 3. **"Encerrar o Cider" para tudo de verdade**: para o som, limpa a fila e
 *    tira a faixa do perfil (`releaseNowPlaying`). É o único jeito de a pessoa
 *    dizer "não estou mais ouvindo" sem depender do intervalo de publicação.
 */

import {
  Disc3,
  ExternalLink,
  GripHorizontal,
  Heart,
  ListMusic,
  Pause,
  Play,
  Power,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { releaseNowPlaying } from "./activity";
import { useCider } from "./useCider";
import { useCiderLibrary } from "./library";
import { useCiderUi } from "./ui";
import { toggleFavoriteWithToast } from "./play";

const POSITION_KEY = "cider:minibar-position";
/** Folga mínima entre a janela e a borda da tela, para ela nunca sair de vista. */
const EDGE = 10;

type Position = { x: number; y: number };

function readStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    // Posição salva corrompida não pode impedir o player de aparecer.
    return null;
  }
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function CiderMiniBar() {
  const { state, engine } = useCider();
  const navigate = useNavigate();
  const location = useLocation();
  const favorites = useCiderLibrary((store) => store.favorites);
  const barRef = useRef<HTMLDivElement | null>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  // A posição salva é lida no inicializador do `useState`, e não num efeito:
  // um efeito chamaria `setState` logo depois do primeiro render e a janela
  // apareceria no canto antes de pular para onde o usuário a deixou.
  const [position, setPosition] = useState<Position | null>(readStoredPosition);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event: PointerEvent) => {
      const element = barRef.current;
      const offset = grab.current;
      if (!element || !offset) return;
      const rect = element.getBoundingClientRect();
      const maxX = Math.max(EDGE, window.innerWidth - rect.width - EDGE);
      const maxY = Math.max(EDGE, window.innerHeight - rect.height - EDGE);
      setPosition({
        x: Math.min(maxX, Math.max(EDGE, event.clientX - offset.dx)),
        y: Math.min(maxY, Math.max(EDGE, event.clientY - offset.dy)),
      });
    };
    const onUp = () => {
      setDragging(false);
      grab.current = null;
      setPosition((value) => {
        if (value) {
          try {
            localStorage.setItem(POSITION_KEY, JSON.stringify(value));
          } catch {
            // Modo privado sem `localStorage`: a janela volta para o canto na
            // próxima navegação, e nada quebra.
          }
        }
        return value;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  // Dentro do próprio Cider a playbar já faz esse papel.
  if (location.pathname.startsWith("/cider")) return null;
  if (!state.track) return null;

  const track = state.track;
  const playing = state.phase === "playing";
  const progress = state.durationMs > 0 ? (state.positionMs / state.durationMs) * 100 : 0;
  const muted = state.muted || state.volume === 0;
  const isFavorite = favorites.some((item) => item.videoId === track.videoId);

  const stopPlayback = () => {
    engine.clearQueue();
    // `clearQueue` já avisa o motor para publicar "parei"; `releaseNowPlaying`
    // zera o throttle do módulo de presença, para a faixa sair do perfil na
    // hora, mesmo que a última publicação tenha sido há poucos segundos.
    releaseNowPlaying();
  };

  return (
    <div
      className="cider-minibar"
      ref={barRef}
      role="region"
      aria-label="Cider tocando"
      data-dragging={dragging ? "true" : "false"}
      data-placed={position ? "true" : "false"}
      style={position ? { left: position.x, top: position.y } : undefined}
      onPointerDown={(event) => {
        // Arrastar só pela moldura: qualquer controle (botão, link, slider)
        // mantém o clique inteiro para si.
        if ((event.target as HTMLElement).closest("button, a, input")) return;
        const element = barRef.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        grab.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
        setDragging(true);
      }}
    >
      <span className="cider-minibar-grip" aria-hidden="true">
        <GripHorizontal size={14} />
      </span>

      <button
        type="button"
        className="cider-minibar-art"
        onClick={() => navigate("/cider/tocando-agora")}
        title="Abrir o Cider"
        aria-label="Abrir o Cider"
      >
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <Disc3 size={20} />
        )}
      </button>

      <div className="cider-minibar-meta">
        <button
          type="button"
          className="cider-minibar-title truncate"
          onClick={() => navigate("/cider/tocando-agora")}
          title="Abrir o Cider"
        >
          {track.title}
        </button>
        <span className="cider-minibar-artist truncate">
          {track.artist || track.channelName}
          {state.error ? ` · ${state.error}` : ""}
        </span>
        <div className="cider-minibar-progress" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <div className="cider-minibar-times tabular">
          <span>{formatTime(state.positionMs)}</span>
          <span>{formatTime(state.durationMs || track.durationMs)}</span>
        </div>
      </div>

      <div className="cider-minibar-actions">
        <button
          type="button"
          className="cider-minibar-btn"
          aria-label="Faixa anterior"
          title="Faixa anterior"
          onClick={engine.previous}
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className="cider-minibar-btn play"
          aria-label={playing ? "Pausar" : "Reproduzir"}
          title={playing ? "Pausar" : "Reproduzir"}
          onClick={engine.toggle}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          className="cider-minibar-btn"
          aria-label="Próxima faixa"
          title="Próxima faixa"
          onClick={engine.next}
        >
          <SkipForward size={16} />
        </button>
        <button
          type="button"
          className="cider-minibar-btn"
          aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
          title={isFavorite ? "Remover dos favoritos" : "Favoritar"}
          aria-pressed={isFavorite}
          data-on={isFavorite ? "true" : "false"}
          onClick={() => toggleFavoriteWithToast(track)}
        >
          <Heart size={15} />
        </button>
        <button
          type="button"
          className="cider-minibar-btn"
          aria-label="Abrir a fila"
          title="Abrir a fila"
          onClick={() => {
            useCiderUi.getState().togglePanel("queue");
            navigate("/cider");
          }}
        >
          <ListMusic size={15} />
        </button>
        <button
          type="button"
          className="cider-minibar-btn"
          aria-label={muted ? "Ativar som" : "Silenciar"}
          title={muted ? "Ativar som" : "Silenciar"}
          onClick={engine.toggleMute}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <a
          className="cider-minibar-btn"
          href={track.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir o original em uma aba nova"
          title="Abrir o original em uma aba nova"
        >
          <ExternalLink size={15} />
        </a>
        <button
          type="button"
          className="cider-minibar-btn danger"
          aria-label="Encerrar o Cider e parar a música"
          title="Encerrar o Cider (para a música e sai do perfil)"
          onClick={stopPlayback}
        >
          <Power size={15} />
        </button>
      </div>
    </div>
  );
}
