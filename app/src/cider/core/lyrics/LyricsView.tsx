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

/** Conjunto vazio reaproveitado: a maioria das linhas não tem palavra esticada. */
const NO_EMPHASIS: ReadonlySet<number> = new Set<number>();

/**
 * Palavras "esticadas" de uma linha — as que merecem o halo extra.
 *
 * O critério não é a palavra em si, e sim o **tempo**: se ela dura bem mais que
 * as vizinhas da mesma linha, a pessoa está segurando a nota. É o que faz o
 * "relate" da Sabrina Carpenter brilhar enquanto é esticado, sem nenhuma lista
 * de palavras escolhidas a dedo (que envelheceria a cada música nova).
 *
 * Os dois pisos existem para não marcar qualquer coisa: a linha precisa ter ao
 * menos duas palavras (senão não há com o que comparar) e a palavra precisa
 * passar de 600 ms de duração.
 */
function emphasisWords(line: LyricsLine | undefined): ReadonlySet<number> {
  const words = line?.words ?? [];
  if (words.length < 2) return NO_EMPHASIS;
  const durations = words.map((word) => Math.max(0, word.endTimeMs - word.startTimeMs));
  const mean = durations.reduce((total, value) => total + value, 0) / durations.length;
  const threshold = Math.max(600, mean * 1.7);
  const marked = new Set<number>();
  durations.forEach((duration, index) => {
    if (duration >= threshold) marked.add(index);
  });
  return marked.size > 0 ? marked : NO_EMPHASIS;
}

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
  glowColor,
  emphasis,
  onSeek,
}: {
  view: LyricsWordView;
  style: LyricsStyle;
  activeColor: string;
  inactiveColor: string;
  /** Cor do halo da palavra ativa; sem ele, o halo usa a própria cor ativa. */
  glowColor?: string;
  /** `true` quando a palavra é cantada devagar (ver `emphasisWords`). */
  emphasis?: boolean;
  onSeek?: (ms: number) => void;
}) {
  const { word, state, progress } = view;
  const halo = glowColor ?? activeColor;
  // O halo é multiplicado na palavra esticada; a cor nunca muda, para a letra
  // continuar sendo letra e não um letreiro de neon.
  const glowStrength = emphasis ? Math.min(1, style.wordGlow * 1.25 + 0.3) : Math.min(1, style.wordGlow);

  const computed = useMemo(() => {
    const glow = Math.max(0, glowStrength);
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
        // A palavra **se enche** da esquerda para a direita conforme é cantada:
        // um degradê duro no ponto do progresso, recortado pelas letras
        // (`background-clip: text`). Antes a palavra só trocava de cor de uma
        // vez, e o efeito parecia um interruptor; agora acompanha a voz.
        //
        // `progress` é a posição real do player, não um temporizador: pausar
        // congela o preenchimento no lugar e um seek o move junto.
        const fill = Math.min(1, Math.max(0, progress));
        const fillPercent = (fill * 100).toFixed(2);
        const mix = interpolateHex(
          inactiveColor,
          activeColor,
          Math.min(1, 0.3 + fill * 0.7)
        );
        const scale = 1 + (style.activeScale - 1) * Math.max(0.35, fill);
        const haloSize = glow * (emphasis ? 24 : 18) * Math.max(0.4, fill);
        // A palavra cantada sobe um pouquinho — "bem pouquinho" mesmo: 1,6 px
        // (2,4 px quando é esticada). Mais que isso o texto dança e a leitura
        // fica desconfortável.
        const lift = -(emphasis ? 2.4 : 1.6) * fill;
        return {
          ...base,
          opacity: 1,
          color: "transparent",
          backgroundImage: `linear-gradient(90deg, ${mix} 0 ${fillPercent}%, ${inactiveColor} ${fillPercent}% 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          transform: `translate3d(0, ${lift.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
          textShadow:
            haloSize > 0.5
              ? `0 0 ${haloSize.toFixed(1)}px ${withAlpha(
                  halo,
                  glow * 0.55
                )}, 0 0 ${(haloSize * 2.4).toFixed(1)}px ${withAlpha(halo, glow * 0.3)}`
              : `0 1px ${Math.round(shadowStrength * 6)}px rgba(0,0,0,${(
                  0.35 * shadowStrength
                ).toFixed(2)})`,
          filter: "none",
          fontWeight: Math.min(800, style.fontWeight + (emphasis ? 80 : 60)),
        };
      }
      case "past":
      default: {
        // A duração da transição desta palavra vem do `transition` definido uma
        // única vez no `<span>` abaixo. Um `transitionDuration` aqui seria
        // sobrescrito pelo atalho (e faria o React avisar sobre misturar
        // atalho com longhand no mesmo objeto de estilo).
        //
        // A palavra esticada continua com o halo aceso depois de passar: é o
        // que faz o brilho do "relate" durar o tempo da nota e não o do
        // quadro em que ela foi cantada.
        return {
          ...base,
          opacity: Math.max(style.inactiveOpacity + 0.12, 0.5),
          color: interpolateHex(inactiveColor, activeColor, glow * (emphasis ? 0.5 : 0.35)),
          textShadow:
            glow > 0.3
              ? `0 0 ${(glow * (emphasis ? 9 : 5)).toFixed(1)}px ${withAlpha(
                  halo,
                  glow * (emphasis ? 0.24 : 0.14)
                )}`
              : "none",
          filter:
            style.blurInactivePx > 0
              ? `blur(${(style.blurInactivePx * 0.2).toFixed(1)}px)`
              : "none",
        };
      }
    }
  }, [state, progress, style, activeColor, inactiveColor, halo, glowStrength, emphasis]);

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
      data-emphasis={emphasis ? "true" : undefined}
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
  glowColor,
  onSeek,
  cssVars,
  attribution,
  estimated,
  synced = true,
  variant = "inline",
}: {
  lines: LyricsLine[];
  views?: Array<{ state: WordState; progress: number; words: LyricsWordView[] }>;
  style: LyricsStyle;
  activeColor: string;
  inactiveColor: string;
  /** Cor do halo da palavra ativa (o acento do Cider, por padrão a cor ativa). */
  glowColor?: string;
  onSeek?: (ms: number) => void;
  cssVars: Record<string, string>;
  attribution?: string;
  estimated: boolean;
  /** `false` quando a letra não tem marcação de tempo (veio da busca ampla). */
  synced?: boolean;
  /** Onde a letra está sendo desenhada: cada lugar tem sua medida. */
  variant?: "inline" | "panel" | "fullscreen" | "immersive";
}) {
  // Linhas sem tempo por palavra recebem estimativa: é o que faz o karaokê
  // funcionar mesmo quando a fonte só manda o tempo da linha.
  //
  // `estimateWords` trabalha no array inteiro de propósito — o fim de uma linha
  // é o começo da próxima, e estimar linha a linha deixaria a última sem
  // duração e todas com respiro errado.
  const resolved = useMemo(() => estimateWords(lines), [lines]);
  // As palavras "esticadas" são derivadas das linhas resolvidas: dependem das
  // durações (estimadas ou não), que só existem depois de `estimateWords`.
  const emphasisLines = useMemo(
    () => resolved.map((line) => emphasisWords(line)),
    [resolved]
  );

  const { containerRef, registerLine, onWheel, resumeAutoscroll } = useLyricsScroll(
    views?.findIndex(view => view.state === "active") ?? -1,
    style.animation
  );

  return (
    <div className="lyrics-scope" data-variant={variant} style={cssVars as CSSProperties}>
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
                      glowColor={glowColor}
                      emphasis={emphasisLines[index]?.has(wordIndex) ?? false}
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
          {!synced
            ? "Letra sem marcação de tempo: ela aparece inteira, sem acompanhar a música."
            : estimated
              ? "Sincronia por palavra estimada a partir dos tempos de linha."
              : "Sincronia por palavra vinda da fonte."}
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
