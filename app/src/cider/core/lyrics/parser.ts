/**
 * Parser de LRC (robusto e tolerante).
 *
 * Aceita o formato como ele realmente aparece nas fontes:
 * - `[00:12.30]texto` (centésimos), `[00:12.345]texto` (milissegundos),
 *   `[00:12]texto` (sem fração) e `[00:12:30]texto` (dois-pontos);
 * - **vários timestamps por linha** (`[00:12.30][01:20.00]refrão`), gerando uma
 *   linha por timestamp;
 * - tags de metadados (`[ar:]`, `[ti:]`, `[al:]`, `[by:]`, `[offset:]`,
 *   `[length:]`, `[re:]`, `[ve:]`);
 * - linhas vazias (viram "♪" na interface) e texto sem nenhum timestamp
 *   (documento não sincronizado).
 *
 * O `offset` da tag é **invalidado** por um ajuste do usuário (prioridade do
 * ajuste manual), e o resultado é sempre ordenado por tempo.
 */

import type { LyricsLine } from "./types";

export const LRC_LINE = /^\s*((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)\s*(.*)$/;
export const LRC_TAG = /^\s*\[(ar|ti|al|by|offset|re|ve|length|tool|encoding):(.*)\]\s*$/i;
const LRC_TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Converte uma marca de tempo em milissegundos.
 *
 * A fração é interpretada pelo número de dígitos: `12.3` = 300 ms (décimos),
 * `12.30` = 300 ms (centésimos implícitos do LRC), `12.300` = 300 ms.
 */
export function parseTimestamp(minutes: string, seconds: string, fraction?: string): number {
  const min = Number.parseInt(minutes, 10);
  const sec = Number.parseInt(seconds, 10);
  let millis = 0;
  if (fraction) {
    const padded = fraction.length === 1 ? `${fraction}00` : fraction.length === 2 ? `${fraction}0` : fraction;
    millis = Number.parseInt(padded.slice(0, 3), 10);
  }
  const safe = (value: number) => (Number.isFinite(value) ? value : 0);
  return safe(min) * 60_000 + safe(sec) * 1000 + safe(millis);
}

export interface LrcParseResult {
  lines: LyricsLine[];
  /** Offset declarado pela própria letra (ms). */
  offsetMs: number;
  tags: Record<string, string>;
  /** `true` quando pelo menos uma linha tem tempo. */
  synced: boolean;
}

/** Analisa um documento LRC. */
export function parseLrc(text: string, options: { offsetMs?: number } = {}): LrcParseResult {
  const lines: LyricsLine[] = [];
  const tags: Record<string, string> = {};
  let declaredOffset = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const tag = LRC_TAG.exec(rawLine);
    if (tag) {
      const key = (tag[1] ?? "").toLowerCase();
      const value = (tag[2] ?? "").trim();
      tags[key] = value;
      if (key === "offset") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) declaredOffset = parsed;
      }
      continue;
    }
    const match = LRC_LINE.exec(rawLine);
    if (!match) {
      const plain = rawLine.trim();
      // Linha sem timestamp em um documento sincronizado costuma ser espaço
      // instrumental: preservamos para o karaokê respirar.
      if (plain) lines.push({ startTimeMs: null, text: plain });
      continue;
    }
    const stamps = match[1] ?? "";
    const content = (match[2] ?? "").trim();
    LRC_TIMESTAMP.lastIndex = 0;
    let stamp = LRC_TIMESTAMP.exec(stamps);
    while (stamp) {
      lines.push({
        startTimeMs: parseTimestamp(stamp[1] ?? "0", stamp[2] ?? "0", stamp[3]),
        text: content,
      });
      stamp = LRC_TIMESTAMP.exec(stamps);
    }
  }

  const synced = lines.some((line) => line.startTimeMs !== null);
  if (synced) {
    lines.sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));
    // O fim de cada linha é o início da próxima (última linha fica em aberto).
    for (let index = 0; index < lines.length; index += 1) {
      const next = lines[index + 1];
      if (next && next.startTimeMs !== null) {
        lines[index]!.endTimeMs = next.startTimeMs;
      }
    }
  }

  const effectiveOffset = options.offsetMs ?? declaredOffset;
  return {
    lines: effectiveOffset ? applyOffset(lines, effectiveOffset) : lines,
    offsetMs: effectiveOffset,
    tags,
    synced,
  };
}

/** Aplica um deslocamento (positivo atrasa a letra? não: adianta o tempo). */
export function applyOffset(lines: LyricsLine[], offsetMs: number): LyricsLine[] {
  if (!offsetMs) return lines;
  // Nunca deixamos tempo negativo: um offset grande para trás (o usuário
  // ajustando a sincronia) não pode tornar as primeiras linhas inalcançáveis.
  const shift = (value: number) => Math.max(0, value + offsetMs);
  return lines.map((line) => ({
    ...line,
    startTimeMs: line.startTimeMs === null ? null : shift(line.startTimeMs),
    endTimeMs:
      line.endTimeMs === null || line.endTimeMs === undefined ? line.endTimeMs : shift(line.endTimeMs),
    words: line.words?.map((word) => ({
      ...word,
      startTimeMs: shift(word.startTimeMs),
      endTimeMs: shift(word.endTimeMs),
    })),
  }));
}

/** Texto corrido (sem timestamps) vira linhas sem tempo. */
export function parsePlain(text: string): LyricsLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ startTimeMs: null, text: line }));
}

/** Índice da linha ativa (busca binária). `-1` antes da primeira linha. */
export function activeLineIndex(lines: LyricsLine[], positionMs: number): number {
  if (lines.length === 0) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const time = lines[middle]!.startTimeMs;
    if (time === null) return -1;
    if (time <= positionMs) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

/** Progresso da linha (0..1), usado quando a fonte não traz palavras. */
export function lineProgress(lines: LyricsLine[], index: number, positionMs: number): number {
  const current = lines[index];
  if (!current || current.startTimeMs === null) return 0;
  const end =
    current.endTimeMs ?? lines[index + 1]?.startTimeMs ?? current.startTimeMs + 4000;
  const span = Math.max(250, end - current.startTimeMs);
  return Math.max(0, Math.min(1, (positionMs - current.startTimeMs) / span));
}

/** Exporta um documento de volta para LRC (usado em "copiar letra"). */
export function toLrc(lines: LyricsLine[], tags: Record<string, string> = {}): string {
  const header = Object.entries(tags).map(([key, value]) => `[${key}:${value}]`);
  const body = lines.map((line) => {
    if (line.startTimeMs === null) return line.text;
    const totalSeconds = Math.floor(line.startTimeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((line.startTimeMs % 1000) / 10);
    const pad = (value: number, size = 2) => value.toString().padStart(size, "0");
    return `[${pad(minutes)}:${pad(seconds)}.${pad(centis)}]${line.text}`;
  });
  return [...header, ...body].join("\n");
}
