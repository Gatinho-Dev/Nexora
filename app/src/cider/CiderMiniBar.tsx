/**
 * Mini-player do Cider, para fora de `/cider`.
 *
 * Existe por um motivo concreto: o `<iframe>` continua tocando quando o usuário
 * sai do player para o Nexora (ele mora no dock, acima do roteador), mas sem
 * nenhum controle na tela não haveria como pausar.
 *
 * Ele divide o canto inferior direito com o dock do player (que é invisível, veja
 * `AudioDock.tsx`) e é a única superfície de controle fora de `/cider`. Sem
 * faixa carregada não aparece: um player vazio não tem o que controlar.
 */

import {
  Disc3,
  ExternalLink,
  Heart,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { useCider } from "./useCider";
import { useCiderLibrary } from "./library";
import { useCiderUi } from "./ui";
import { toggleFavoriteWithToast } from "./play";

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function CiderMiniBar() {
  const { state, engine } = useCider();
  const navigate = useNavigate();
  const location = useLocation();
  const favorites = useCiderLibrary((store) => store.favorites);
  const togglePanel = useCiderUi((store) => store.togglePanel);

  // Dentro do próprio Cider a playbar já faz esse papel.
  if (location.pathname.startsWith("/cider")) return null;
  if (!state.track) return null;

  const track = state.track;
  const playing = state.phase === "playing";
  const progress = state.durationMs > 0 ? (state.positionMs / state.durationMs) * 100 : 0;
  const muted = state.muted || state.volume === 0;
  const isFavorite = favorites.some((item) => item.videoId === track.videoId);

  return (
    <div className="cider-minibar" role="region" aria-label="Cider tocando">
      <div className="cider-minibar-art">
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <Disc3 size={20} />
        )}
      </div>

      <div className="cider-minibar-meta">
        <button
          type="button"
          className="cider-minibar-title"
          onClick={() => navigate("/cider/tocando-agora")}
          title="Abrir o Cider"
        >
          {track.title}
        </button>
        <span className="cider-minibar-artist">
          {track.artist || track.channelName}
          {state.error ? ` · ${state.error}` : ""}
        </span>
        <div className="cider-minibar-progress">
          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <div className="cider-minibar-times">
          <span>{formatTime(state.positionMs)}</span>
          <span>{formatTime(state.durationMs || track.durationMs)}</span>
        </div>
      </div>

      <div className="cider-minibar-actions">
        <button
          type="button"
          className="btn icon"
          aria-label="Anterior"
          title="Anterior"
          onClick={engine.previous}
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className="btn icon play"
          aria-label={playing ? "Pausar" : "Reproduzir"}
          title={playing ? "Pausar" : "Reproduzir"}
          onClick={engine.toggle}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" className="btn icon" aria-label="Próxima" title="Próxima" onClick={engine.next}>
          <SkipForward size={16} />
        </button>
        <button
          type="button"
          className="btn icon"
          aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
          title={isFavorite ? "Remover dos favoritos" : "Favoritar"}
          aria-pressed={isFavorite}
          onClick={() => toggleFavoriteWithToast(track)}
          data-on={isFavorite ? "true" : "false"}
        >
          <Heart size={15} />
        </button>
        <button
          type="button"
          className="btn icon"
          aria-label="Abrir a fila"
          title="Abrir a fila"
          onClick={() => {
            togglePanel("queue");
            navigate("/cider");
          }}
        >
          <ListMusic size={15} />
        </button>
        <button
          type="button"
          className="btn icon"
          aria-label={muted ? "Ativar som" : "Silenciar"}
          title={muted ? "Ativar som" : "Silenciar"}
          onClick={engine.toggleMute}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <a
          className="btn icon"
          href={track.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir no YouTube"
          title="Abrir no YouTube"
        >
          <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}
