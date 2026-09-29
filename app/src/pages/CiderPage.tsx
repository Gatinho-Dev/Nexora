/**
 * Player do Cider em `/cider`.
 *
 * Reproduz pelo **player oficial do YouTube** no navegador. Não há download,
 * extração nem conversão de áudio: o iframe do YouTube reproduz e a página
 * comanda por `enablejsapi`. O `document.title` e a capa ficam escondidos atrás
 * da capa da própria interface, porque aqui quem manda é o Cider.
 *
 * O áudio do player **não** passa pelo equalizador: o navegador não dá acesso
 * ao buffer do iframe. O DSP só vale para arquivos locais, que esta versão não
 * carrega — a constante está exposta para a interface não prometer o que não
 * acontece.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronRight,
  Disc3,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { YouTubePlayer, type PlayerPhase } from "@/cider/core/player";
import {
  buildSearchPlan,
  dedupeTracks,
  DEFAULT_SEARCH_PREFERENCES,
  parseIntent,
  rerankTracks,
  toTrack,
  type CiderTrack,
  type SearchPreferences,
} from "@/cider/api/query";
import { describeSearchFailure, searchVideos } from "@/cider/api/search";
import { publishNowPlaying, resetNowPlaying } from "@/cider/activity";
import { fetchLyrics } from "@/cider/core/lyrics/service";
import type { LyricsLine } from "@/cider/core/lyrics/types";

/** A busca fala com instâncias públicas; o texto sai daqui. */
const UNAFFILIATED =
  "Cider 2 é um cliente independente, não afiliado ao YouTube ou ao Google. " +
  "O conteúdo é exibido pelo player oficial do YouTube.";

type LyricsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; lines: LyricsLine[]; synced: boolean }
  | { status: "empty" };

export default function CiderPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CiderTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const [queue, setQueue] = useState<CiderTrack[]>([]);
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<PlayerPhase>("idle");
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const [preferences] = useState<SearchPreferences>(DEFAULT_SEARCH_PREFERENCES);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  // Espelho da fila para os callbacks do player, que são criados uma vez e
  // precisam do valor atual sem depender da lista de dependências.
  const queueRef = useRef<CiderTrack[]>([]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const current = index >= 0 ? (queue[index] ?? null) : null;

  /* ---------------------------------------------------------------- *
   * Montagem do player                                               *
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const player = new YouTubePlayer({
      onPhaseChange: (next, error) => {
        setPhase(next);
        setPlayerError(error);
        if (next === "playing") setAutoplayBlocked(false);
      },
      onTime: (position, duration) => {
        setPositionMs(position);
        setDurationMs(duration);
      },
      onEnded: () => {
        setIndex(previous => {
          if (previous < 0 || previous + 1 >= queueRef.current.length) return previous;
          return previous + 1;
        });
      },
    });
    playerRef.current = player;

    let disposed = false;
    player
      .mount(host)
      .then(() => setPlayerError(null))
      .catch((error: unknown) => {
        if (disposed) return;
        setPlayerError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      disposed = true;
      player.dispose();
      playerRef.current = null;
      // Ao sair da página, a presença é limpa: não faz sentido continuar
      // mostrando faixa para quem fechou o player.
      publishNowPlaying(null, { playing: false, positionMs: 0, durationMs: 0, volume: 0 });
      resetNowPlaying();
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * Publicação da presença                                            *
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (!user) return;
    publishNowPlaying(phase === "playing" ? current : current, {
      playing: phase === "playing",
      positionMs,
      durationMs,
      volume,
    });
  }, [user, current, phase, positionMs, durationMs, volume]);

  /* ---------------------------------------------------------------- *
   * Letra                                                            *
   * ---------------------------------------------------------------- */

  // O estado da letra fica **marcado com a faixa**: assim trocar de faixa já
  // nasce em "carregando" por derivação, sem `setState` dentro do efeito.
  const [lyricsResult, setLyricsResult] = useState<{
    videoId: string;
    state: LyricsState;
  } | null>(null);

  useEffect(() => {
    const track = current;
    if (!track) return;
    let cancelled = false;
    void fetchLyrics({
      artist: track.artist || track.channelName,
      title: track.title,
      durationSeconds: Math.round(track.durationMs / 1000),
    }).then(result => {
      if (cancelled) return;
      setLyricsResult({
        videoId: track.videoId,
        state: result
          ? { status: "ready", lines: result.lines, synced: result.synced }
          : { status: "empty" },
      });
    });
    return () => {
      cancelled = true;
    };
    // As faixas vêm do estado `results` e mantêm a mesma referência entre
    // renders, então `[current]` só muda de verdade quando a faixa muda.
  }, [current]);

  const lyrics: LyricsState = useMemo(() => {
    if (!current) return { status: "idle" };
    if (lyricsResult?.videoId !== current.videoId) return { status: "loading" };
    return lyricsResult.state;
  }, [current, lyricsResult]);

  /* ---------------------------------------------------------------- *
   * Busca                                                            *
   * ---------------------------------------------------------------- */

  const runSearch = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setSearching(true);
      setError(null);
      try {
        const plan = buildSearchPlan(parseIntent(text));
        const collected: CiderTrack[] = [];
        let firstSource: string | null = null;
        const attempts = [];

        // Para quando já há resultados suficientes: a alternativa só existe
        // para o caso de a primeira busca não achar nada decente.
        for (const variant of plan) {
          const outcome = await searchVideos(variant, preferences.limit);
          attempts.push(...outcome.attempts);
          if (outcome.videos.length === 0) continue;
          if (!firstSource) firstSource = outcome.source;
          collected.push(
            ...outcome.videos.map(video =>
              toTrack({
                videoId: video.videoId,
                title: video.title,
                author: video.author,
                thumbnail: video.thumbnail,
                durationSeconds: video.duration,
              })
            )
          );
          if (collected.length >= 8) break;
        }

        if (collected.length === 0) {
          setResults([]);
          setError(describeSearchFailure(attempts));
          setSource(null);
          return;
        }

        const ranked = rerankTracks(dedupeTracks(collected), {
          query: text,
          preferences,
        });
        setResults(ranked);
        setSource(firstSource);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [preferences]
  );

  /* ---------------------------------------------------------------- *
   * Controles                                                        *
   * ---------------------------------------------------------------- */

  const playTrack = useCallback((track: CiderTrack, list: CiderTrack[]) => {
    const queueIds = list.map(item => item.videoId);
    const position = Math.max(0, list.findIndex(item => item.videoId === track.videoId));
    setQueue(list);
    setIndex(position);
    void playerRef.current?.playQueue(queueIds, position);
  }, []);

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (phase === "playing") player.pause();
    else player.resume();
  }, [phase]);

  const seekToIndex = useCallback(
    (next: number) => {
      const list = queueRef.current;
      if (next < 0 || next >= list.length) return;
      setIndex(next);
      void playerRef.current?.playQueue(
        list.map(item => item.videoId),
        next
      );
    },
    []
  );

  useEffect(() => {
    if (index < 0) return;
    const track = queueRef.current[index];
    if (!track) return;
    // A nova faixa precisa de um clique para começar: o autoplay só é aceito
    // depois do primeiro gesto da sessão.
    void playerRef.current?.playQueue(
      queueRef.current.map(item => item.videoId),
      index
    );
  }, [index]);

  const totalLabel = useMemo(
    () => `${queue.length} ${queue.length === 1 ? "faixa" : "faixas"} na fila`,
    [queue.length]
  );

  /* ---------------------------------------------------------------- *
   * Guarda de login                                                  *
   * ---------------------------------------------------------------- */

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Disc3 className="h-10 w-10 text-white/60" />
        <h1 className="text-xl font-bold text-white">Cider</h1>
        <p className="max-w-md text-sm text-muted2">
          Entre na sua conta da Nexora para tocar. O que você estiver ouvindo
          aparece no seu perfil, na lista de amigos e no chat.
        </p>
        <Button onClick={() => navigate("/login?redirect=%2Fcider")}>
          Entrar para ouvir
        </Button>
      </div>
    );
  }

  /* ---------------------------------------------------------------- *
   * Player                                                           *
   * ---------------------------------------------------------------- */

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-3">
        <Disc3 className="h-5 w-5 text-white/70" />
        <h1 className="text-sm font-black tracking-tight">Cider</h1>
        <span className="text-xs text-muted2">em /cider</span>
        <div className="grow" />
        <span className="text-xs text-muted2">{UNAFFILIATED}</span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        {/* Busca */}
        <form
          onSubmit={event => {
            event.preventDefault();
            void runSearch(query);
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar no YouTube — use artist: ou album: para refinar"
            aria-label="Buscar"
            className="flex-1"
          />
          <Button type="submit" disabled={searching || !query.trim()}>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar
          </Button>
        </form>

        {error && (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            {error}
          </p>
        )}

        {/* Player */}
        <section className="mt-6 grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              {current?.artworkUrl ? (
                <img
                  src={current.artworkUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Disc3 className="h-14 w-14 text-white/15" />
                </div>
              )}
              {/*
                O iframe precisa existir e ter área. Sem `display:none`, porque
                o player do YouTube não inicializa fora do layout.
              */}
              <div
                ref={hostRef}
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-[2px] opacity-[0.01]"
              />
            </div>

            <div className="mt-3">
              <p className="truncate text-sm font-bold">{current?.title ?? "Nada tocando"}</p>
              <p className="truncate text-xs text-muted2">
                {current ? current.artist || current.channelName : "escolha uma faixa"}
              </p>
              {current?.youtubeTitle && current.youtubeTitle !== current.title && (
                <p className="truncate text-[11px] text-white/35" title={current.youtubeTitle}>
                  no YouTube: {current.youtubeTitle}
                </p>
              )}
            </div>

            <Slider
              value={[Math.min(100, Math.max(0, progress))]}
              onValueChange={([next]) => {
                playerRef.current?.seekToMs(((next ?? 0) / 100) * durationMs);
              }}
              max={100}
              step={0.1}
              className="mt-4"
              aria-label="Progresso"
            />
            <div className="mt-1 flex justify-between text-[11px] tabular text-muted2">
              <span>{formatTime(positionMs)}</span>
              <span>{formatTime(durationMs)}</span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => seekToIndex(Math.max(0, index - 1))}
                disabled={index <= 0}
                aria-label="Faixa anterior"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={toggle}
                disabled={!current}
                aria-label={phase === "playing" ? "Pausar" : "Reproduzir"}
              >
                {phase === "playing" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => seekToIndex(Math.min(queue.length - 1, index + 1))}
                disabled={index < 0 || index + 1 >= queue.length}
                aria-label="Próxima faixa"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  const next = muted ? volume || 0.8 : 0;
                  setMuted(!muted);
                  playerRef.current?.setVolume(next);
                }}
                aria-label={muted ? "Ativar som" : "Silenciar"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[(muted ? 0 : volume) * 100]}
                onValueChange={([next]) => {
                  const level = (next ?? 0) / 100;
                  setVolume(level);
                  setMuted(level === 0);
                  playerRef.current?.setVolume(level);
                }}
                max={100}
                step={1}
                className="flex-1"
                aria-label="Volume"
              />
            </div>

            {autoplayBlocked && (
              <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                O navegador bloqueou o início automático. Clique em reproduzir — é a
                política de autoplay e o Cider não contorna isso.
              </p>
            )}
            {playerError && (
              <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                {playerError}
              </p>
            )}
          </div>

          {/* Letra */}
          <section className="min-h-[320px] rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-white/50">
              Letra
            </h2>
            {lyrics.status === "loading" && (
              <p className="mt-4 text-sm text-muted2">Procurando no LRCLIB…</p>
            )}
            {lyrics.status === "empty" && (
              <p className="mt-4 text-sm text-muted2">
                Não achamos a letra dessa faixa.
              </p>
            )}
            {lyrics.status === "ready" && (
              <div
                className={`mt-4 max-h-[420px] space-y-1 overflow-y-auto text-sm ${
                  lyrics.synced ? "text-white/80" : "text-muted2"
                }`}
              >
                {lyrics.lines.map((line, i) => (
                  <p
                    key={`${line.startTimeMs ?? "t"}-${i}`}
                    className={
                      lyrics.synced && line.startTimeMs !== null && line.startTimeMs <= positionMs
                        ? "font-semibold text-white"
                        : ""
                    }
                  >
                    {line.text || "♪"}
                  </p>
                ))}
              </div>
            )}
            {lyrics.status === "idle" && (
              <p className="mt-4 text-sm text-muted2">
                Toque uma faixa para ver a letra.
              </p>
            )}
          </section>
        </section>

        {/* Resultados */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-white/50">
              Resultados
            </h2>
            {source && (
              <span className="text-[11px] text-white/30">
                via {new URL(source).host}
              </span>
            )}
            <div className="grow" />
            {queue.length > 0 && <span className="text-[11px] text-white/40">{totalLabel}</span>}
          </div>

          {results.length === 0 ? (
            <p className="mt-4 text-sm text-muted2">
              {searching ? "Procurando…" : "Busque acima para ouvir."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {results.map(track => (
                <li key={track.videoId}>
                  <button
                    type="button"
                    onClick={() => playTrack(track, results)}
                    className={`flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-white/[0.04] ${
                      current?.videoId === track.videoId ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <img
                      src={track.artworkUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{track.title}</span>
                      <span className="block truncate text-xs text-muted2">
                        {track.artist || track.channelName} · {formatTime(track.durationMs)}
                        {track.version !== "studio" && ` · ${track.version}`}
                      </span>
                    </span>
                    {current?.videoId === track.videoId ? (
                      <RotateCcw className="h-4 w-4 shrink-0 text-white/40" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
                    )}
                    <a
                      href={track.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={event => event.stopPropagation()}
                      className="shrink-0 p-1 text-white/25 hover:text-white/60"
                      aria-label="Abrir no YouTube"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
