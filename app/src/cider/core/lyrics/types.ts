/**
 * Tipos do sistema de letras.
 *
 * Modelo de dados alinhado ao que o LRCLIB devolve (timestamps por linha) e ao
 * que o `LyricsSyncEngine` precisa (palavras com tempo estimado ou real).
 *
 * `estimated: true` significa **temporização calculada pelo Cider 2** a partir do
 * intervalo da linha — nunca uma sincronização palavra a palavra oficial. Quando
 * a fonte trouxer timestamps reais por palavra, eles vêm com `estimated: false`.
 */

export interface LyricsWord {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  /** `true` quando o tempo foi estimado a partir da linha. */
  estimated: boolean;
  /** Espaço antes da palavra no texto original (para reconstruir a linha). */
  spaceBefore?: boolean;
  /** Pontuação final (`.,!?`) mantida junto da palavra. */
  punctuation?: string;
}

export interface LyricsLine {
  /** `null` em letras não sincronizadas. */
  startTimeMs: number | null;
  endTimeMs?: number | null;
  text: string;
  words?: LyricsWord[];
  /** Instrumental/intervalo sem letra. */
  instrumental?: boolean;
}

export type LyricsKind = "synced" | "plain" | "instrumental" | "unavailable" | "link";

export interface LyricsSource {
  id?: number | null;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  durationSec?: number | null;
  url?: string | null;
}

export interface LyricsMatchInfo {
  score: number;
  threshold: number;
  reasons: string[];
  versionWarning?: string | null;
  durationDeltaMs?: number | null;
}

export interface LyricsAlternative {
  trackName: string;
  artistName: string;
  albumName?: string | null;
  durationSec?: number | null;
  hasSynced: boolean;
  score: number;
  reasons: string[];
}

export interface LyricsSearchHit {
  title: string;
  link: string;
  snippet: string;
  score: number;
  reasons: string[];
}

export interface LyricsFallbackInfo {
  provider: string;
  providerLabel?: string;
  enabled: boolean;
  accepted: boolean;
  hits: LyricsSearchHit[];
  best?: (LyricsSearchHit & { preview: string }) | null;
  reason: string;
  attempts?: Array<{ query: string; hits?: number; error?: string }>;
  copyright?: string;
}

export interface LyricsRequestInfo {
  title: string;
  artist: string;
  durationMs: number;
  videoId?: string | null;
}

/** Documento final consumido pela interface. */
export interface LyricsDocument {
  kind: LyricsKind;
  provider: string;
  lines: LyricsLine[];
  plainText?: string;
  source?: LyricsSource | null;
  match?: LyricsMatchInfo | null;
  alternates?: LyricsAlternative[];
  fallback?: LyricsFallbackInfo | null;
  attempts?: Array<{ stage: string; result?: unknown; error?: string }>;
  reason: string;
  cached?: boolean;
  requested?: LyricsRequestInfo;
  attribution?: string;
  /** LRC bruto (usado por "copiar/exportar" e por depuração). */
  raw?: string | null;
}

export type WordState = "upcoming" | "approaching" | "active" | "past";

export interface LyricsWordView {
  word: LyricsWord;
  state: WordState;
  /** Progresso dentro da palavra (0..1) quando ela é a ativa. */
  progress: number;
}

export interface LyricsLineView {
  index: number;
  text: string;
  startTimeMs: number | null;
  /** `active` é a linha cantada; as demais usam o estado da palavra. */
  state: WordState;
  /** Progresso da linha inteira (0..1) — usado no fallback sem palavras. */
  progress: number;
  /**
   * Progresso da **espera** por esta linha (0..1), quando ela é a próxima a ser
   * cantada e a espera é longa o bastante para valer a contagem — é o que
   * desenha as três bolinhas antes de a voz entrar (`sync.ts`). Ausente em todas
   * as outras linhas.
   */
  countIn?: number;
  words: LyricsWordView[];
  instrumental: boolean;
}
