/**
 * Temporização por palavra (estimada).
 *
 * O LRCLIB normalmente entrega **um timestamp por linha**. Para o karaokê
 * palavra a palavra o Cider 2 distribui a duração da linha entre as palavras com
 * uma heurística musical — e marca cada palavra com `estimated: true`, porque
 * isso não é uma sincronização oficial palavra a palavra.
 *
 * Heurística (documentada em `docs/LYRICS.md`):
 * - palavras longas recebem mais tempo;
 * - artigos, preposições e conjunções curtas recebem menos;
 * - pontuação acrescenta respiro (`.` `,` `!` `?` `…`);
 * - o fim da linha (`.`, `!`, `?`) ganha um intervalo maior;
 * - nenhuma palavra fica com menos de ~90 ms (evita "piscar").
 *
 * Quando a fonte trouxer tempos reais por palavra, elas devem chegar com
 * `estimated: false` e este módulo não é usado.
 */

import type { LyricsLine, LyricsWord } from "./types";

/** Palavras funcionais (recebem menos tempo). */
const SHORT_WORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "e",
  "é",
  "que",
  "the",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "my",
  "me",
  "i",
  "it",
  "is",
  "you",
]);

export interface WordTimingOptions {
  /** Duração usada quando a linha não tem próxima (última linha). */
  fallbackLineMs?: number;
  /** Duração mínima por palavra. */
  minWordMs?: number;
}

const DEFAULTS: Required<WordTimingOptions> = {
  fallbackLineMs: 2600,
  minWordMs: 90,
};

interface Token {
  text: string;
  punctuation: string;
  spaceBefore: boolean;
}

/**
 * Separa a linha em palavras preservando pontuação e espaços.
 *
 * "I   wanna dance, with somebody!" →
 * `I`, `wanna`, `dance,`, `with`, `somebody!`
 */
export function tokenizeLine(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\S+/g;
  let match = pattern.exec(text);
  let previousEnd = 0;
  while (match) {
    const raw = match[0];
    const spaceBefore = previousEnd > 0;
    const punctuationMatch = /([.,!?;:…"')\]]+)$/.exec(raw);
    const punctuation = punctuationMatch?.[1] ?? "";
    tokens.push({
      text: raw.slice(0, raw.length - punctuation.length),
      punctuation,
      spaceBefore,
    });
    previousEnd = (match.index ?? 0) + raw.length;
    match = pattern.exec(text);
  }
  return tokens;
}

/** Peso relativo de cada palavra dentro da linha. */
export function wordWeight(text: string, punctuation: string): number {
  const cleaned = text.toLowerCase();
  const letters = cleaned.replace(/[^\p{L}\p{N}]/gu, "").length;
  let weight = 0.55 + Math.min(letters, 12) * 0.11;
  if (SHORT_WORDS.has(cleaned)) weight *= 0.6;
  if (letters > 7) weight += 0.25;
  if (/[,.…]/.test(punctuation)) weight += 0.2;
  if (/[!?]/.test(punctuation)) weight += 0.35;
  return Math.max(0.2, weight);
}

/** Distribui o intervalo entre as palavras, todas marcadas como estimadas. */
export function distributeWords(
  text: string,
  startTimeMs: number,
  endTimeMs: number,
  options: WordTimingOptions = {},
): LyricsWord[] {
  const config = { ...DEFAULTS, ...options };
  const tokens = tokenizeLine(text);
  if (tokens.length === 0) return [];

  const usable = Math.max(
    config.minWordMs * tokens.length,
    endTimeMs - startTimeMs > 0 ? endTimeMs - startTimeMs : config.fallbackLineMs,
  );
  const weights = tokens.map((token) => wordWeight(token.text, token.punctuation));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  // Um pedaço do intervalo fica como respiro final (a frase termina "no ar").
  const tailGap = tokens[tokens.length - 1]?.punctuation ? usable * 0.12 : usable * 0.05;
  const speakable = Math.max(config.minWordMs * tokens.length, usable - tailGap);

  const words: LyricsWord[] = [];
  let cursor = startTimeMs;
  tokens.forEach((token, index) => {
    const share = totalWeight > 0 ? (weights[index]! / totalWeight) * speakable : speakable / tokens.length;
    const duration = Math.max(config.minWordMs, Math.round(share));
    words.push({
      text: token.text || token.punctuation,
      punctuation: token.punctuation || undefined,
      spaceBefore: token.spaceBefore,
      startTimeMs: cursor,
      endTimeMs: cursor + duration,
      estimated: true,
    });
    cursor += duration;
  });
  return words;
}

/**
 * Preenche `words` em todas as linhas sincronizadas que ainda não têm.
 * Linhas sem tempo (espaço instrumental) ficam como estão.
 */
export function estimateWords(
  lines: LyricsLine[],
  options: WordTimingOptions = {},
): LyricsLine[] {
  const config = { ...DEFAULTS, ...options };
  return lines.map((line, index) => {
    if (line.startTimeMs === null) return line;
    if (line.words && line.words.length > 0) return line;
    const nextStart = line.endTimeMs ?? lines[index + 1]?.startTimeMs ?? null;
    const end = nextStart !== null && nextStart > line.startTimeMs ? nextStart : line.startTimeMs + config.fallbackLineMs;
    return { ...line, words: distributeWords(line.text, line.startTimeMs, end, config) };
  });
}

/** Índice da palavra ativa numa linha (ou -1). */
export function activeWordIndex(words: LyricsWord[] | undefined, positionMs: number): number {
  if (!words || words.length === 0) return -1;
  let low = 0;
  let high = words.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const word = words[middle]!;
    if (word.startTimeMs <= positionMs) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}
