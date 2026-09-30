import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type WheelEvent,
} from "react";
import { estimateWords } from "./words";
import type { LyricsLine, LyricsWordView, WordState } from "./types";
import type { LyricsStyle } from "./presets";

/**
 * Uma palavra da letra, com o estado que decide cor, glow, escala e blur.
 *
 * O truque do efeito é que **nada de CSS animando sozinho**: cada quadro vem
 * do motor com a posição real do player, e o `text-shadow` é calculado a
 * partir do progresso. Por isso a palavra "acende" em vez de piscar, e um seek
 * não deixa nada preso no meio.
 */
function AnimatedWord({
  view,
  style,
  activeColor,
  inactiveColor,
  onSeek,
}: {
  view: LyricsWordView;
  style: LyricsStyle;
  activeColor: string;
  inactiveColor: string;
  onSeek?: (ms: number) => void;
}) {
  const { word, state, progress } = view;

  const computed = useMemo(() => {
    const glow = Math.max(0, Math.min(1, style.wordGlow));
    const shadowStrength = style.shadowIntensity;
    const base = {
      opacity: 1,
      color: inactiveColor,
      textShadow: "none",
      filter: "none",
      fontWeight: style.fontWeight,
      transform: "translate3d(0,0,0) scale(1)",
    } as const;

    switch (state) {
      case "upcoming":
        return {
          ...base,
          opacity: Math.max(0.18, style.inactiveOpacity * 0.7),
          filter:
            style.blurInactivePx > 0
              ? `blur(${(style.blurInactivePx * 0.7).toFixed(1)}px)`
              : "none",
          transform: `translate3d(0,${(style.slideDistance * 0.5).toFixed(0)}px,0) scale(1)`,
        };
      case "approaching":
        return {
          ...base,
          opacity: Math.min(0.85, style.inactiveOpacity + 0.25),
          filter:
            style.blurInactivePx > 0
              ? `blur(${(style.blurInactivePx * 0.35).toFixed(1)}px)`
              : "none",
          transform: `translate3d(0,${(style.slideDistance * 0.2).toFixed(0)}px,0) scale(1)`,
        };
      case "active": {
        // A cor acende conforme a palavra é cantada: `progress` é real, não
        // temporizador, então acompanha a velocidade e pausa junto.
        const mix = interpolateHex(
          inactiveColor,
          activeColor,
          Math.min(1, 0.35 + progress * 0.65)
        );
        const scale = 1 + (style.activeScale - 1) * Math.max(0.35, progress);
        const halo = glow * 18 * Math.max(0.4, progress);
        return {
          ...base,
          opacity: 1,
          color: mix,
          transform: `translate3d(0,0,0) scale(${scale.toFixed(3)})`,
          textShadow:
            halo > 0.5
              ? `0 0 ${halo.toFixed(1)}px ${withAlpha(
                  activeColor,
                  glow * 0.55
                )}, 0 0 ${(halo * 2.2).toFixed(1)}px ${withAlpha(activeColor, glow * 0.28)}`
              : `0 1px ${Math.round(shadowStrength * 6)}px rgba(0,0,0,${(
                  0.35 * shadowStrength
                ).toFixed(2)})`,
          filter: "none",
          fontWeight: Math.min(800, style.fontWeight + 60),
        };
      }
      case "past":
      default: {
        // A duração da transição desta palavra vem do `transition` definido uma
        // única vez no `<span>` abaixo. Um `transitionDuration` aqui seria
        // sobrescrito pelo atalho (e faria o React avisar sobre misturar
        // atalho com longhand no mesmo objeto de estilo).
        return {
          ...base,
          opacity: Math.max(style.inactiveOpacity + 0.12, 0.5),
          color: interpolateHex(inactiveColor, activeColor, glow * 0.35),
          textShadow:
            glow > 0.3
              ? `0 0 ${(glow * 5).toFixed(1)}px ${withAlpha(activeColor, glow * 0.14)}`
              : "none",
          filter:
            style.blurInactivePx > 0
              ? `blur(${(style.blurInactivePx * 0.2).toFixed(1)}px)`
              : "none",
        };
      }
    }
  }, [state, progress, style, activeColor, inactiveColor]);

  const transitionMs =
    style.animation === "off"
      ? 0
      : style.animation === "low"
        ? 140
        : style.animation === "medium"
          ? 220
          : 300;

  return (
    <span
      className="lyrics-word"
      data-state={state}
      data-estimated={word.estimated ? "true" : "false"}
      style={
        {
          ...computed,
          display: "inline-block",
          whiteSpace: "pre",
          transition: `color ${transitionMs}ms ease-out, opacity ${transitionMs}ms ease-out, filter ${transitionMs}ms ease-out, transform ${transitionMs}ms cubic-bezier(0.22,1,0.36,1), text-shadow ${transitionMs}ms ease-out`,
          willChange:
            state === "active" || state === "approaching"
              ? "transform, opacity, filter"
              : undefined,
        } as CSSProperties
      }
      onClick={
        onSeek
          ? event => {
              event.stopPropagation();
              onSeek(word.startTimeMs);
            }
          : undefined
      }
    >
      {word.spaceBefore ? " " : ""}
      {word.text}
      {word.punctuation ? (
        <span className="lyrics-punctuation">{word.punctuation}</span>
      ) : null}
    </span>
  );
}

/**
 * Bloco de letras com destaque por palavra e rolagem automática.
 *
 * Duas coisas que a primeira versão daqui não tinha, e que faziam a letra
 * aparecer "toda junto":
 *
 * - **máscara de gradiente** no topo e na base, que é o que faz a coluna
 *   parecer um rolo contínuo em vez de uma lista;
 * - **autoscroll** centrando a linha ativa. Sem ele, todas as linhas ficam
 *   empilhadas no topo do container e a letra vira um bloco só.
 *
 * O autoscroll é por **evento**, não por posição: `scrollTo` só é chamado
 * quando a linha ativa muda, para não brigar com a rolagem do usuário.
 */
export function LyricsView({
  lines,
  views,
  style,
  activeColor,
  inactiveColor,
  onSeek,
  cssVars,
  attribution,
  estimated,
}: {
  lines: LyricsLine[];
  views?: Array<{ state: WordState; progress: number; words: LyricsWordView[] }>;
  style: LyricsStyle;
  activeColor: string;
  inactiveColor: string;
  onSeek?: (ms: number) => void;
  cssVars: Record<string, string>;
  attribution?: string;
  estimated: boolean;
}) {
  // Linhas sem tempo por palavra recebem estimativa: é o que faz o karaokê
  // funcionar mesmo quando a fonte só manda o tempo da linha.
  //
  // `estimateWords` trabalha no array inteiro de propósito — o fim de uma linha
  // é o começo da próxima, e estimar linha a linha deixaria a última sem
  // duração e todas com respiro errado.
  const resolved = useMemo(() => estimateWords(lines), [lines]);

  const { containerRef, registerLine, onWheel, resumeAutoscroll } = useLyricsScroll(
    views?.findIndex(view => view.state === "active") ?? -1,
    style.animation
  );

  return (
    <div className="lyrics-scope" style={cssVars as CSSProperties}>
      <div
        className="lyrics-lines"
        data-align={style.alignment}
        ref={containerRef}
        onWheel={onWheel}
        aria-live="off"
      >
        <div className="lyrics-spacer" />
        {resolved.map((line, index) => {
          const view = views?.[index];
          const state = view?.state ?? "upcoming";
          return (
            <p
              key={`${line.startTimeMs ?? "x"}-${index}`}
              ref={element => registerLine(index, element)}
              className="lyrics-line"
              data-state={state}
              data-instrumental={
                line.instrumental || !line.text.trim() ? "true" : undefined
              }
              onClick={
                onSeek && line.startTimeMs !== null
                  ? () => {
                      resumeAutoscroll();
                      onSeek(line.startTimeMs!);
                    }
                  : undefined
              }
              title={
                onSeek && line.startTimeMs !== null
                  ? "Clique para pular para este trecho"
                  : undefined
              }
            >
              {line.words && line.words.length > 0 && view
                ? view.words.map((wordView, wordIndex) => (
                    <AnimatedWord
                      key={`${wordIndex}-${wordView.word.startTimeMs}`}
                      view={wordView}
                      style={style}
                      activeColor={activeColor}
                      inactiveColor={inactiveColor}
                      onSeek={onSeek}
                    />
                  ))
                : (
                    <span className="lyrics-plainline">
                      {line.text || "♪"}
                      {state === "active" && (view?.progress ?? 0) > 0 ? (
                        <span
                          className="progress-mask"
                          style={{ width: `${(view?.progress ?? 0) * 100}%` }}
                          aria-hidden="true"
                        >
                          {line.text || "♪"}
                        </span>
                      ) : null}
                    </span>
                  )}
            </p>
          );
        })}
        <div className="lyrics-spacer" />
      </div>
      <div className="lyrics-footer xsmall faint">
        <span>
          {estimated
            ? "Sincronização por palavra estimada pelo Cider 2 a partir dos tempos de linha."
            : "Destaque por linha (estimativa por palavra desligada)."}
        </span>
        {attribution ? <span className="truncate"> · {attribution}</span> : null}
      </div>
    </div>
  );
}

/**
 * Rolagem automática das letras.
 *
 * Separate do componente porque precisa guardar duas coisas que o render não
 * pode ler — o elemento de cada linha e a última rolagem feita — e porque a
 * única decisão que o render toma (qual linha está ativa) vem do motor.
 */
function useLyricsScroll(activeIndex: number, animation: LyricsStyle["animation"]) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef(new Map<number, HTMLParagraphElement>());
  const lastScrollKey = useRef<string | null>(null);
  const autoscroll = useRef(true);
  // "seek" é o salto grande do usuário, que não deve ser animado: rolar do
  // início ao fim em 400 ms parece travamento, não transição. O índice
  // anterior vive em estado, porque ler um ref no render é o que a regra de
  // hooks proíbe — e a detecção precisa acontecer na mesma passagem do render.
  const [previousIndex, setPreviousIndex] = useState(-1);
  const seek = previousIndex >= 0 && Math.abs(activeIndex - previousIndex) > 1;
  if (previousIndex !== activeIndex) setPreviousIndex(activeIndex);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeIndex < 0 || !autoscroll.current) return;
    const element = lineRefs.current.get(activeIndex);
    if (!element) return;
    // Só rola quando a linha muda: rolar a cada quadro brigaria com o
    // usuário e ainda assim gastaria CPU à toa.
    const key = `${activeIndex}:${seek ? "seek" : "step"}`;
    if (lastScrollKey.current === key) return;
    lastScrollKey.current = key;
    const target =
      element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
    container.scrollTo({
      top: Math.max(0, target),
      behavior: animation === "off" || seek ? "auto" : "smooth",
    });
  }, [activeIndex, animation, seek]);

  const registerLine = (index: number, element: HTMLParagraphElement | null) => {
    if (element) lineRefs.current.set(index, element);
    else lineRefs.current.delete(index);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    // Rolagem manual desliga o autoscroll até a linha seguinte: assim a letra
    // não "puxa" de volta enquanto a pessoa lê de cima.
    const container = containerRef.current;
    if (!container) return;
    const atTop = container.scrollTop <= 1;
    const atBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
    autoscroll.current = event.deltaY < 0 ? atTop : atBottom;
  };

  const resumeAutoscroll = () => {
    autoscroll.current = true;
  };

  return { containerRef, registerLine, onWheel, resumeAutoscroll };
}

/** Interpola dois `#rrggbb` por canal. */
function interpolateHex(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return to;
  const t = Math.max(0, Math.min(1, amount));
  const channel = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${channel(a[0], b[0])} ${channel(a[1], b[1])} ${channel(a[2], b[2])})`;
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  const a = Math.max(0, Math.min(1, alpha));
  if (!rgb) return `rgba(255,255,255,${a.toFixed(3)})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a.toFixed(3)})`;
}
