/**
 * Mini-player do Cider, para fora de `/cider`.
 *
 * Existe por um motivo concreto: o `<iframe>` do YouTube continua tocando
 * quando o usuário sai do player para o Nexora, mas sem nenhum controle na tela
 * ele não teria como pausar. Esta barra é só uma janela para o mesmo motor —
 * ela não cria player novo, não duplica estado e não tem fila própria.
 */

import { useCider } from "./useCider";
import {
  Disc3,
  ExternalLink,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function CiderMiniBar() {
  const { state, engine } = useCider();
  const navigate = useNavigate();
  const location = useLocation();

  // Dentro do próprio Cider a playbar já faz esse papel.
  if (location.pathname.startsWith("/cider")) return null;
  if (!state.track) return null;

  const progress =
    state.durationMs > 0 ? (state.positionMs / state.durationMs) * 100 : 0;

  return (
    <div className="cider-minibar" role="region" aria-label="Cider tocando">
      <button
        type="button"
        onClick={() => navigate("/cider")}
        style={{
          border: 0,
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          flex: 1,
          textAlign: "left",
        }}
        title="Abrir o Cider"
      >
        {state.track.artworkUrl ? (
          <img
            className="cider-minibar-art"
            src={state.track.artworkUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="cider-minibar-art">
            <Disc3 size={18} />
          </div>
        )}
        <div className="cider-minibar-meta">
          <div
            style={{
              fontSize: "var(--cider-text-base)",
              fontWeight: "var(--cider-weight-semibold)",
              color: "var(--cider-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {state.track.title}
          </div>
          <div
            style={{
              fontSize: "var(--cider-text-xs)",
              color: "var(--cider-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {state.track.artist || state.track.channelName}
          </div>
          <div className="cider-minibar-progress">
            <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--cider-text-faint)",
              fontVariantNumeric: "tabular-nums",
              marginTop: 2,
            }}
          >
            <span>{formatTime(state.positionMs)}</span>
            <span>{formatTime(state.durationMs)}</span>
          </div>
        </div>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
        <button
          className="cider-btn"
          data-size="icon"
          data-variant="ghost"
          aria-label="Anterior"
          onClick={engine.previous}
        >
          <SkipBack size={16} />
        </button>
        <button
          className="cider-btn"
          data-size="icon"
          data-variant="primary"
          aria-label={state.phase === "playing" ? "Pausar" : "Reproduzir"}
          onClick={engine.toggle}
        >
          {state.phase === "playing" ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
        </button>
        <button
          className="cider-btn"
          data-size="icon"
          data-variant="ghost"
          aria-label="Próxima"
          onClick={engine.next}
        >
          <SkipForward size={16} />
        </button>
        <button
          className="cider-btn"
          data-size="icon"
          data-variant="ghost"
          aria-label={state.muted ? "Ativar som" : "Silenciar"}
          onClick={engine.toggleMute}
        >
          {state.muted || state.volume === 0 ? (
            <VolumeX size={16} />
          ) : (
            <Volume2 size={16} />
          )}
        </button>
        <a
          href={state.track.url}
          target="_blank"
          rel="noopener noreferrer"
          className="cider-btn"
          data-size="icon"
          data-variant="ghost"
          aria-label="Abrir no YouTube"
        >
          <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}
