/**
 * Correspondência de letras (lado da interface).
 *
 * O núcleo Rust já escolhe a melhor letra para a reprodução automática
 * (`src-tauri/src/lyrics/matcher.rs`). Este módulo repete os **mesmos pesos** para
 * que a interface possa:
 *
 * - mostrar a confiança da correspondência de forma transparente;
 * - ordenar/revalidar resultados da busca manual;
 * - avisar quando a versão é diferente (ex.: vídeo ao vivo × letra de estúdio).
 *
 * Pesos: título 45, artista 35, álbum 10, duração 10 — mais penalidade de 25
 * quando a versão da gravação difere.
 */

import {
  VERSION_BLOCKING,
  VERSION_LABELS,
  detectVersion,
  stripNoise,
  titleSimilarity,
  type VersionKind,
} from "../metadata";

export const ACCEPT_THRESHOLD = 62;

export interface LyricsRecordInput {
  title: string;
  artist: string;
  album?: string | null;
  durationMs: number;
}

export interface LyricsRecordCandidate {
  /** Campos opcionais de propósito: o LRCLIB pode omitir álbum e até artista. */
  trackName?: string;
  artistName?: string;
  albumName?: string | null;
  durationSec?: number | null;
  instrumental?: boolean;
  hasSynced?: boolean;
}

export interface RecordScore {
  score: number;
  accepted: boolean;
  reasons: string[];
  versionWarning: string | null;
  durationDeltaMs: number | null;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}& ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pontuação de 0 a 100 de um candidato de letra. */
export function scoreRecord(
  input: LyricsRecordInput,
  record: LyricsRecordCandidate,
): RecordScore {
  const reasons: string[] = [];
  const title = normalize(stripNoise(input.title ?? ""));
  const recordTitle = normalize(record.trackName ?? "");
  const artist = normalize(input.artist ?? "");
  const recordArtist = normalize(record.artistName ?? "");

  // Título (45)
  let titleScore = 0;
  if (!title || !recordTitle) {
    titleScore = 0;
  } else if (title === recordTitle) {
    reasons.push("título idêntico");
    titleScore = 45;
  } else if (recordTitle.includes(title) || title.includes(recordTitle)) {
    reasons.push("título contido no registro");
    titleScore = 40;
  } else {
    const similarity = titleSimilarity(title, recordTitle);
    if (similarity >= 0.8) {
      reasons.push(`título muito parecido (${Math.round(similarity * 100)}%)`);
      titleScore = 34;
    } else if (similarity >= 0.5) {
      reasons.push(`título parcialmente parecido (${Math.round(similarity * 100)}%)`);
      titleScore = 22;
    } else {
      reasons.push("título diferente");
      titleScore = 0;
    }
  }

  // Artista (35)
  let artistScore: number;
  if (!artist || !recordArtist) {
    artistScore = 12;
  } else if (artist === recordArtist) {
    reasons.push("artista idêntico");
    artistScore = 35;
  } else if (recordArtist.includes(artist) || artist.includes(recordArtist)) {
    reasons.push("artista contido no registro");
    artistScore = 28;
  } else {
    const firstInput = artist.split(" ")[0] ?? "";
    const firstRecord = recordArtist.split(" ")[0] ?? "";
    const overlap = titleSimilarity(artist, recordArtist);
    if (firstInput && firstInput === firstRecord) {
      reasons.push("artista principal coincide");
      artistScore = 20;
    } else if (overlap >= 0.5) {
      reasons.push(`artista parecido (${Math.round(overlap * 100)}%)`);
      artistScore = 15;
    } else {
      reasons.push("artista diferente");
      artistScore = 0;
    }
  }

  // Álbum (10) — normalmente desconhecido no vídeo do YouTube: neutro.
  let albumScore = 5;
  if (input.album?.trim() && record.albumName?.trim()) {
    const similarity = titleSimilarity(input.album, record.albumName);
    if (similarity >= 0.8) {
      reasons.push("álbum confere");
      albumScore = 10;
    } else {
      albumScore = similarity >= 0.5 ? 6 : 0;
    }
  }

  // Duração (10)
  let durationDeltaMs: number | null = null;
  let durationScore = 5;
  if (input.durationMs > 0 && record.durationSec && record.durationSec > 0) {
    durationDeltaMs = Math.round(input.durationMs - record.durationSec * 1000);
    const seconds = Math.abs(durationDeltaMs) / 1000;
    if (seconds <= 2) {
      reasons.push("duração praticamente igual");
      durationScore = 10;
    } else if (seconds <= 6) {
      reasons.push(`duração próxima (${seconds.toFixed(0)} s de diferença)`);
      durationScore = 8;
    } else if (seconds <= 12) {
      reasons.push(`duração com ${seconds.toFixed(0)} s de diferença`);
      durationScore = 5;
    } else if (seconds <= 25) {
      reasons.push(`duração com ${seconds.toFixed(0)} s de diferença`);
      durationScore = 2;
    } else {
      reasons.push(`duração muito diferente (${seconds.toFixed(0)} s)`);
      durationScore = 0;
    }
  }

  let score = titleScore + artistScore + albumScore + durationScore;

  // Versão: remix/live/acoustic não devem trocar entre si — nas duas direções.
  // (Uma letra de gravação ao vivo não serve para o áudio de estúdio, e
  // vice-versa: as linhas não acompanham a gravação.)
  const inputVersion = detectVersion(input.title ?? "");
  const recordVersion: VersionKind = detectVersion(record.trackName ?? "");
  let versionWarning: string | null = null;
  if (inputVersion !== recordVersion) {
    const blocking =
      VERSION_BLOCKING.includes(inputVersion) || VERSION_BLOCKING.includes(recordVersion);
    if (blocking) {
      versionWarning =
        recordVersion === "studio"
          ? `A letra encontrada é da versão de estúdio, mas o vídeo é ${VERSION_LABELS[inputVersion]} — as linhas podem não acompanhar esta gravação.`
          : inputVersion === "studio"
            ? `A letra encontrada é de ${VERSION_LABELS[recordVersion]}, não da versão de estúdio do vídeo.`
            : `Versões diferentes: o vídeo é ${VERSION_LABELS[inputVersion]} e a letra é ${VERSION_LABELS[recordVersion]}.`;
      // Não basta descontar: uma letra de outra gravação não deve passar do
      // limiar nem com título, artista, álbum e duração perfeitos.
      score = Math.min(score - 45, ACCEPT_THRESHOLD - 1);
      reasons.push("versão incompatível (recusada)");
    } else {
      score -= 10;
      reasons.push("versão possivelmente diferente (-10)");
    }
  } else if (inputVersion !== "studio") {
    reasons.push(`versão confere (${inputVersion})`);
    score += 5;
  }

  const clamped = Math.max(0, Math.min(100, score));
  return {
    score: clamped,
    accepted: clamped >= ACCEPT_THRESHOLD,
    reasons,
    versionWarning,
    durationDeltaMs,
  };
}

/** Ordena candidatos (sincronizado ganha um pequeno bônus na proximidade). */
export function rankRecords(
  input: LyricsRecordInput,
  records: LyricsRecordCandidate[],
): Array<{ index: number; record: LyricsRecordCandidate; score: RecordScore }> {
  return records
    .map((record, index) => ({ index, record, score: scoreRecord(input, record) }))
    .sort((a, b) => {
      // Letra sincronizada vale um pequeno bônus, mas nunca passa na frente de
      // uma correspondência melhor: o bônus só desempata escores próximos.
      const aTotal = a.score.score + (a.record.hasSynced ? 4 : 0);
      const bTotal = b.score.score + (b.record.hasSynced ? 4 : 0);
      return bTotal - aTotal || a.index - b.index;
    });
}

/** Melhor candidato aceito (ou `null` quando nada passa do limiar). */
export function bestRecord(
  input: LyricsRecordInput,
  records: LyricsRecordCandidate[],
): { index: number; record: LyricsRecordCandidate; score: RecordScore } | null {
  const ranked = rankRecords(input, records);
  const first = ranked[0];
  // `accepted` já embute o limiar; usamos o mesmo critério aqui para não
  // divergir (um candidato sincronizado com escore baixo continua recusado).
  return first && first.score.accepted ? first : null;
}
