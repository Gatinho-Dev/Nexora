/**
 * **LyricsSyncEngine** — sincroniza a letra com a reprodução.
 *
 * Princípios (nada de `setInterval` somando tempo, que sempre diverge):
 * - a **posição real** do player (`player.snapshot().positionMs`) é a única fonte
 *   de tempo; cada atualização é um cálculo puro sobre ela;
 * - pausar congela naturalmente (a posição não avança) e retomar continua de
 *   onde parou, sem reiniciar a linha;
 * - um *seek* salta direto: o motor informa `seek: true` na transição para a
 *   interface **não** tocar a animação inteira de novo;
 * - mudanças de velocidade não afetam nada aqui, porque todo o cálculo usa a
 *   posição informada pelo player.
 *
 * O motor não conhece React: devolve um `LyricsFrame` e a interface decide o que
 * renderizar/anima.
 */

import { activeWordIndex } from "./words";
import type { LyricsLine, LyricsLineView, LyricsWordView, WordState } from "./types";

export interface SyncConfig {
  /** Dentro dessa janela antes de começar, a palavra fica "approaching". */
  approachingLeadMs: number;
  /** Janela antes da linha para a linha também parecer "chegando". */
  lineApproachingLeadMs: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  approachingLeadMs: 700,
  lineApproachingLeadMs: 1_400,
};

/**
 * Espera mínima (ms) para a **contagem** aparecer.
 *
 * O fim da última palavra de uma linha quase nunca é o começo da próxima: o
 * tokenizador deixa um respiro de ~5% no fim de cada verso. Sem este piso, o
 * motor acenderia as bolinhas entre **todas** as linhas da música, o que viraria
 * piscada. Com ele, a contagem aparece só quando há espera de verdade: a
 * introdução antes da primeira linha e os intervalos instrumentais.
 */
export const COUNT_IN_MIN_MS = 2_500;

export interface LyricsTransition {
  from: number;
  to: number;
  /** `true` quando o usuário pulou (não animamos a transição linha a linha). */
  seek: boolean;
  atMs: number;
}

export interface LyricsFrame {
  positionMs: number;
  activeIndex: number;
  activeWordIndex: number;
  /** Progresso da linha ativa (0..1). */
  lineProgress: number;
  lines: LyricsLineView[];
}

export class LyricsSyncEngine {
  private lines: LyricsLine[] = [];

  private config: SyncConfig = { ...DEFAULT_SYNC_CONFIG };

  private lastIndex = -1;

  private transitionValue: LyricsTransition | null = null;

  private currentFrame: LyricsFrame = {
    positionMs: 0,
    activeIndex: -1,
    activeWordIndex: -1,
    lineProgress: 0,
    lines: [],
  };

  setConfig(partial: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  setLines(lines: LyricsLine[]): void {
    this.lines = lines;
    this.lastIndex = -1;
    this.transitionValue = null;
    this.currentFrame = this.compute(0);
  }

  get linesValue(): LyricsLine[] {
    return this.lines;
  }

  get frame(): LyricsFrame {
    return this.currentFrame;
  }

  /** Última mudança de linha (consumida pela interface para animar). */
  get transition(): LyricsTransition | null {
    return this.transitionValue;
  }

  reset(): void {
    this.lines = [];
    this.lastIndex = -1;
    this.transitionValue = null;
    this.currentFrame = this.compute(0);
  }

  /** Atualiza a posição e devolve o quadro atual. */
  update(positionMs: number): LyricsFrame {
    this.currentFrame = this.compute(Math.max(0, positionMs));
    return this.currentFrame;
  }

  private compute(positionMs: number): LyricsFrame {
    const lines = this.lines;
    if (lines.length === 0) {
      return { positionMs, activeIndex: -1, activeWordIndex: -1, lineProgress: 0, lines: [] };
    }

    const activeIndex = findActiveLine(lines, positionMs);
    if (activeIndex !== this.lastIndex) {
      const seek = this.lastIndex >= 0 && Math.abs(activeIndex - this.lastIndex) > 1;
      this.transitionValue = { from: this.lastIndex, to: activeIndex, seek, atMs: positionMs };
      this.lastIndex = activeIndex;
    }

    const countIn = this.countIn(lines, positionMs);
    const activeWord = activeWordIndex(lines[activeIndex]?.words, positionMs);
    const views: LyricsLineView[] = lines.map((line, index) =>
      this.viewOf(line, index, positionMs, activeIndex, countIn),
    );

    return {
      positionMs,
      activeIndex,
      activeWordIndex: activeWord,
      lineProgress: progressWithin(lineDuration(lines, activeIndex), positionMs, lines[activeIndex]?.startTimeMs ?? null),
      lines: views,
    };
  }

  /**
   * A espera pela próxima linha **cantada** — as três bolinhas.
   *
   * Quem espera o intervalo não quer saber quando o silêncio começa, e sim
   * quando a voz volta: por isso a linha esperada é a próxima com palavras (as
   * instrumentais ficam de fora) e a espera começa no fim do último trecho
   * cantado, não no fim da linha anterior.
   *
   * Devolve `null` fora da espera, quando ela é curta demais para valer uma
   * contagem (`COUNT_IN_MIN_MS`), quando não há próxima linha a cantar ou quando
   * a letra não tem tempo (nesse caso não há espera para medir).
   */
  private countIn(
    lines: LyricsLine[],
    positionMs: number,
  ): { index: number; progress: number } | null {
    const index = findPendingLine(lines, positionMs);
    if (index < 0) return null;
    const start = lines[index]!.startTimeMs;
    if (start === null) return null;
    const from = waitStartBefore(lines, index);
    if (positionMs < from) return null;
    const waitMs = start - from;
    if (waitMs < COUNT_IN_MIN_MS) return null;
    return { index, progress: progressWithin(waitMs, positionMs, from) };
  }

  private viewOf(
    line: LyricsLine,
    index: number,
    positionMs: number,
    activeIndex: number,
    countIn: { index: number; progress: number } | null,
  ): LyricsLineView {
    const start = line.startTimeMs;
    const end = line.endTimeMs ?? null;
    const state: WordState =
      activeIndex === -1
        ? start !== null && start - positionMs <= this.config.lineApproachingLeadMs
          ? "approaching"
          : "upcoming"
        : index < activeIndex
          ? "past"
          : index > activeIndex
            ? start !== null && start - positionMs <= this.config.lineApproachingLeadMs
              ? "approaching"
              : "upcoming"
            : "active";

    const words: LyricsWordView[] = (line.words ?? []).map((word) => {
      let wordState: WordState;
      if (positionMs >= word.endTimeMs) wordState = "past";
      else if (positionMs >= word.startTimeMs) wordState = "active";
      else if (word.startTimeMs - positionMs <= this.config.approachingLeadMs) wordState = "approaching";
      else wordState = "upcoming";
      const progress =
        wordState === "active"
          ? Math.max(0, Math.min(1, (positionMs - word.startTimeMs) / Math.max(1, word.endTimeMs - word.startTimeMs)))
          : wordState === "past"
            ? 1
            : 0;
      return { word, state: wordState, progress };
    });

    return {
      index,
      text: line.text,
      startTimeMs: start,
      state,
      progress:
        state === "active"
          ? progressWithin(end === null ? null : end - (start ?? 0), positionMs, start)
          : state === "past"
            ? 1
            : 0,
      countIn: countIn?.index === index ? countIn.progress : undefined,
      words,
      instrumental: Boolean(line.instrumental) || line.text.trim().length === 0,
    };
  }
}

/**
 * Próxima linha **com palavra** a ser cantada (a que está sendo esperada).
 *
 * As linhas instrumentais (`♪`) são puladas de propósito: durante um intervalo,
 * a contagem vai até a **voz voltar**, e não até o silêncio começar.
 */
export function findPendingLine(lines: LyricsLine[], positionMs: number): number {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const start = line.startTimeMs;
    if (start === null || start <= positionMs) continue;
    if (!line.words || line.words.length === 0) continue;
    return index;
  }
  return -1;
}

/**
 * Quando a espera pela linha começou.
 *
 * É o fim da última palavra **cantada** antes dela (o respiro depois do último
 * verso), nunca antes do começo da linha anterior: quem espera a voz voltar
 * depois de um intervalo instrumental está esperando desde que o intervalo
 * começou, não desde a faixa começar.
 *
 * Devolve `0` quando nada foi cantado antes — é a introdução, e a espera vale
 * desde o início da faixa.
 */
function waitStartBefore(lines: LyricsLine[], index: number): number {
  const previousStart = lines[index - 1]?.startTimeMs ?? 0;
  let sungEnd = 0;
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const words = lines[previous]?.words;
    if (!words || words.length === 0) continue;
    sungEnd = words.reduce((end, word) => Math.max(end, word.endTimeMs), 0);
    break;
  }
  return Math.max(sungEnd, previousStart);
}

function lineDuration(lines: LyricsLine[], index: number): number | null {
  const line = lines[index];
  if (!line || line.startTimeMs === null) return null;
  const end = line.endTimeMs ?? lines[index + 1]?.startTimeMs ?? null;
  return end === null ? null : end - line.startTimeMs;
}

function progressWithin(durationMs: number | null, positionMs: number, startMs: number | null): number {
  if (startMs === null) return 0;
  const duration = durationMs && durationMs > 0 ? durationMs : 4_000;
  return Math.max(0, Math.min(1, (positionMs - startMs) / duration));
}

/** Busca binária pela linha ativa (devolve -1 antes da primeira). */
export function findActiveLine(lines: LyricsLine[], positionMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const time = lines[middle]!.startTimeMs;
    if (time === null) return result;
    if (time <= positionMs) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

/**
 * Janela de linhas visível ao redor da linha ativa.
 *
 * Mantém a lista renderizada pequena (desempenho) mesmo com letras longas: só as
 * linhas próximas existem no DOM.
 */
export function visibleWindow(
  total: number,
  activeIndex: number,
  visibleLines: number,
): { start: number; end: number } {
  if (total === 0) return { start: 0, end: 0 };
  const half = Math.max(1, Math.floor(visibleLines / 2));
  const anchor = activeIndex < 0 ? 0 : activeIndex;
  const start = Math.max(0, anchor - half);
  const end = Math.min(total, start + Math.max(1, visibleLines));
  return { start, end: Math.max(end, Math.min(total, start + 1)) };
}
