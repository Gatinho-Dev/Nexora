/**
 * Letras: busca o documento e exibe com destaque por palavra.
 *
 * O arquivo tem duas metades porque elas têm ritmos distintos:
 *
 * - `useLyricsDocument` roda **uma vez por faixa** (busca no LRCLIB);
 * - `useLyricsTimeline` roda **a cada quadro** (posição e palavra ativa).
 *
 * Misturar os dois fazia o estado da letra piscar toda vez que a posição do
 * player mudava, porque uma Atualização de 250 ms disparava a busca de novo.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LyricsView } from "./core/lyrics/LyricsView";
import { LYRICS_PRESETS, lyricsCssVariables } from "./core/lyrics/presets";
import { fetchLyrics, lyricsSearchUrl } from "./core/lyrics/service";
import { LyricsTimeline } from "./lyricsTimeline";
import type { LyricsDocument } from "./core/lyrics/types";
import type { CiderTrack } from "./api/query";
import { useCiderSettings } from "./settings/store";

/**
 * Cores da letra, por modo.
 *
 * A palavra cantada fica no **tom do texto do tema** — quase branca no escuro,
 * quase preta no claro — e o acento do Cider entra só no halo em volta. É o que
 * dá a leitura do Apple Music (letra neutra, sem neon) sem perder a identidade
 * do Cider, e é o que mantém a letra legível nos dois temas.
 */
const ACTIVE_COLOR: Record<string, string> = { dark: "#f7f7fa", light: "#101014" };
const INACTIVE_COLOR: Record<string, string> = { dark: "#9a9aa8", light: "#8e8e96" };

/**
 * Preset de exibição.
 *
 * "karaoke" é o mais próximo do efeito do Apple Music: brilho alto (0.8),
 * decaimento longo (1.2 s, para a palavra cantada continuar acesa depois de
 * passar), escala 1.04 e pouco blur nas inativas. É o mesmo preset do Cider 2
 * desktop, então a aparência não muda entre as duas versões.
 */
const STYLE = LYRICS_PRESETS.karaoke;

export interface LoadedLyrics {
  lines: LyricsDocument["lines"];
  synced: boolean;
  estimated: boolean;
  attribution: string;
  /** `web` quando a letra veio da busca ampla, e não do catálogo com tempo. */
  source: "lrclib" | "web";
}

/**
 * Busca a letra da faixa e guarda **para qual faixa** ela vale.
 *
 * O `videoId` é a chave: trocar de faixa invalida o resultado anterior sem
 * precisar de efeito para "limpar", porque o valor já é derivado da chave.
 */
function useLyricsDocument(track: CiderTrack | null): {
  data: LoadedLyrics | null;
  pending: boolean;
} {
  const videoId = track?.videoId ?? null;
  const [loaded, setLoaded] = useState<{
    videoId: string | null;
    data: LoadedLyrics | null;
  }>({ videoId: null, data: null });

  useEffect(() => {
    if (!videoId || loaded.videoId === videoId) return;
    let cancelled = false;
    void fetchLyrics({
      artist: track?.artist || track?.channelName || "",
      title: track?.title || "",
      durationSeconds: Math.round((track?.durationMs ?? 0) / 1000),
    })
      .then(found => {
        if (cancelled) return;
        setLoaded({
          videoId,
          data: found
            ? {
                lines: found.lines,
                synced: found.synced,
                estimated: found.estimated,
                attribution: found.attribution,
                source: found.source,
              }
            : null,
        });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ videoId, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [
    videoId,
    loaded.videoId,
    track?.artist,
    track?.channelName,
    track?.title,
    track?.durationMs,
  ]);

  return {
    data: loaded.videoId === videoId ? loaded.data : null,
    pending: videoId !== null && loaded.videoId !== videoId,
  };
}

/**
 * Motor de sincronia como fonte externa.
 *
 * O objeto é criado uma vez e sobrevive à troca de faixa: só as linhas mudam.
 * `useSyncExternalStore` é o que mantém a interpolação a 60 fps sem exigir um
 * re-render do React por quadro.
 */
function useLyricsTimeline(
  lines: LyricsDocument["lines"] | null,
  positionMs: number,
  isPlaying: boolean
) {
  const [timeline] = useState(() => new LyricsTimeline());
  const frame = useSyncExternalStore(
    timeline.subscribe,
    timeline.getFrame,
    timeline.getFrame
  );

  useEffect(() => {
    timeline.setLines(lines ?? []);
  }, [timeline, lines]);

  useEffect(() => {
    timeline.setPosition(positionMs);
  }, [timeline, positionMs]);

  useEffect(() => {
    timeline.setPlaying(isPlaying);
  }, [timeline, isPlaying]);

  return lines ? frame : undefined;
}

export function useLyrics(
  track: CiderTrack | null,
  positionMs: number,
  isPlaying: boolean,
  variant: "inline" | "panel" | "fullscreen" | "immersive" = "inline"
) {
  const { data, pending } = useLyricsDocument(track);
  const views = useLyricsTimeline(data?.lines ?? null, positionMs, isPlaying);
  const mode = useCiderSettings((store) => store.appearance?.mode === "light" ? "light" : "dark");
  const accent = useCiderSettings((store) => store.settings.accent);

  const view = useMemo(() => {
    if (!data) return null;
    return (
      <LyricsView
        lines={data.lines}
        views={views}
        style={STYLE}
        activeColor={ACTIVE_COLOR[mode]}
        inactiveColor={INACTIVE_COLOR[mode]}
        glowColor={accent}
        cssVars={lyricsCssVariables(STYLE)}
        attribution={data.attribution}
        estimated={data.estimated}
        synced={data.synced}
        variant={variant}
      />
    );
  }, [data, views, mode, accent, variant]);

  const videoId = track?.videoId ?? null;
  return {
    status: !videoId
      ? ("idle" as const)
      : pending
        ? ("loading" as const)
        : data
          ? ("ready" as const)
          : ("empty" as const),
    view,
    /** De onde veio a letra (para o rodapé do painel dizer a verdade). */
    source: data?.source ?? null,
    /** `true` quando a letra não acompanha o tempo (veio da busca ampla). */
    unsynced: data ? !data.synced : false,
    /** Último recurso: busca a letra na web, para o estado vazio nunca ser beco. */
    searchUrl: track ? lyricsSearchUrl(track.artist || track.channelName, track.title) : null,
  };
}
