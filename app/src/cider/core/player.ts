/**
 * Player do YouTube para o navegador.
 *
 * Portado do motor equivalente do Cider 2 desktop, com as partes que só
 * faziam sentido no aplicativo removidas:
 *
 * - **sem host de emergência**: no WebKitGTK o `<iframe>` do YouTube não
 *   inicializava sem um elemento com área real, e o motor criava um `div` de
 *   2×2px quando a interface não tinha montado um. No navegador a página tem
 *   o elemento à vista e o player é montado direto nele;
 * - **sem contrato `EngineAdapter`**: aqui não existe fila global do aplicativo
 *   para remapear índice. A fila mora nesta classe e é pequena.
 *
 * O que **sobrevive** — e é a parte que valeu a pena portar:
 *
 * - `eventData`: os callbacks da IFrame Player API entregam `{ data, target }`,
 *   e é `data` que carrega o código. Ler o evento inteiro dá `NaN`, o que fazia
 *   o player nunca reportar "tocando" e nunca disparar o fim de faixa;
 * - o autoplay: navegadores só deixam tocar depois de um gesto do usuário, e o
 *   primeiro play de uma sessão é sempre um clique.
 */

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getDuration(): number;
  getCurrentTime(): number;
  getPlayerState(): number;
  getVideoData?(): { video_id?: string; title?: string; author?: string };
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  destroy(): void;
}

interface YTGlobal {
  Player: new (
    element: HTMLElement | string,
    options: Record<string, unknown>
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

const IFRAME_API_URL = "https://www.youtube.com/iframe_api";
/** Origem de privacidade avançada do YouTube (recomendada para embeds). */
const EMBED_HOST = "https://www.youtube-nocookie.com";

let apiPromise: Promise<YTGlobal> | null = null;

/** Carrega a IFrame Player API oficial (uma única vez por página). */
export function loadYouTubeIframeApi(): Promise<YTGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("A IFrame Player API só existe no navegador"));
  }
  const global = (window as unknown as { YT?: YTGlobal }).YT;
  if (global?.Player) return Promise.resolve(global);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTGlobal>((resolve, reject) => {
    const scope = window as unknown as {
      YT?: YTGlobal;
      onYouTubeIframeAPIReady?: () => void;
    };
    const previous = scope.onYouTubeIframeAPIReady;
    scope.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (scope.YT?.Player) resolve(scope.YT);
      else reject(new Error("A API do player carregou sem expor YT.Player"));
    };
    if (document.querySelector(`script[src="${IFRAME_API_URL}"]`)) return;
    const script = document.createElement("script");
    script.src = IFRAME_API_URL;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(
        new Error(
          "Não foi possível carregar o player. Verifique a conexão ou se o domínio da fonte está bloqueado na sua rede."
        )
      );
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Extrai o número dos callbacks da IFrame Player API.
 *
 * O YouTube **não** entrega o código cru: `onStateChange` e `onError` recebem
 * um objeto `{ data, target }`. Aplicar `Number()` no evento inteiro produz
 * `NaN` — o estado cai sempre no `default` e o erro sai como "código NaN".
 * O número cru é aceito também, por via das evoluções da API.
 */
export function eventData(payload: unknown): number {
  if (typeof payload === "number") return payload;
  if (payload !== null && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (typeof data === "number") return data;
  }
  return Number.NaN;
}

/** Mensagens de erro em português para cada código oficial do player. */
export function playbackErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return "O parâmetro do vídeo é inválido — a faixa não pôde ser carregada.";
    case 5:
      return "O player não conseguiu reproduzir esta faixa (erro de HTML5).";
    case 100:
      return "Este vídeo não está disponível: foi removido, é privado ou o autor restringiu a reprodução.";
    case 101:
    case 150:
      return "Quem publicou não permite reprodução incorporada. Use “Abrir original” para ouvir na fonte.";
    default:
      return Number.isFinite(code)
        ? `O player reportou um erro (código ${code}).`
        : "O player reportou um erro que não pôde ser identificado.";
  }
}

export type PlayerPhase = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayerHooks {
  onPhaseChange?(phase: PlayerPhase, error: string | null): void;
  /** Alias enxuto usado pelo motor, que só quer fase e erro. */
  onPhase?(phase: PlayerPhase, error: string | null): void;
  /** Fim de faixa: a fila deve avançar. */
  onEnded?(): void;
  onAutoplayBlocked?(): void;
  onTrackChanged?(videoId: string): void;
  /** Tique de ~250 ms com a posição, para a barra de progresso na UI. */
  onTime?(positionMs: number, durationMs: number): void;
}

/**
 * Player + fila.
 *
 * `play` só é aceito depois de um gesto do usuário: os navegadores bloqueiam
 * áudio sem gesto, e tentar contornar isso com volume zero é exatamente a
 * gambiarra que o navegador está tentando evitar.
 */
export class YouTubePlayer {
  private api: YTGlobal | null = null;

  private player: YTPlayer | null = null;

  private ready = false;

  private queue: string[] = [];

  private index = -1;

  private error: string | null = null;

  private volume = 0.8;

  private currentId: string | null = null;

  private startAtMs = 0;

  private pending: { videoId: string; startSeconds: number } | null = null;

  /**
   * Elemento onde o player foi montado.
   *
   * A IFrame Player API **substitui** o host pelo próprio `<iframe>`, então o
   * nó original deixa de existir. Guardar a referência é o que permite
   * distinguir "já montado neste host" de "montado num host que saiu da
   * página" — sem isso, um remonte (HMR, troca de host) reutilizaria um player
   * apontando para um nó detachado: o vídeo "toca", o som não sai.
   */
  private host: HTMLElement | null = null;

  private ticker: number | null = null;

  private hooks: PlayerHooks;

  /** `true` depois do primeiro gesto: a partir daí o autoplay é permitido. */
  private unlocked = false;

  constructor(hooks: PlayerHooks = {}) {
    this.hooks = hooks;
  }

  /**
   * Troca (ou define) os callbacks depois da construção.
   *
   * Existe porque o motor é criado antes do componente: ele precisa montar o
   * player num elemento que só existe depois do primeiro render. Sem isto, os
   * eventos de estado — fim de faixa, posição, autoplay — não chegariam a
   * ninguém.
   */
  onCallbacks(hooks: PlayerHooks): void {
    this.hooks = hooks;
  }

  get lastError(): string | null {
    return this.error;
  }

  get videoId(): string | null {
    return this.currentId;
  }

  /** Monta o player dentro de `host` e carrega a API oficial. */
  async mount(host: HTMLElement): Promise<void> {
    if (this.player && this.host?.isConnected && this.host === host) return;
    if (this.player) {
      // Host trocado ou fora do documento: recria do zero.
      try {
        this.player.destroy();
      } catch {
        // O player já pode estar destruído; recriar é o que importa.
      }
      this.player = null;
      // `ready` falso já silencia o ticker antigo: ele checa o estado a cada
      // 250 ms e não reporta nada enquanto o player novo não montar.
      this.ready = false;
      this.host = null;
    }
    if (!host.isConnected) {
      throw new Error("O elemento do player não está na página.");
    }
    this.api = await loadYouTubeIframeApi();
    this.host = host;

    await new Promise<void>((resolve, reject) => {
      try {
        this.player = new this.api!.Player(host, {
          width: "100%",
          height: "100%",
          host: EMBED_HOST,
          playerVars: {
            // Controles próprios: a UI do Cider é o controle, e o player fica
            // atrás da capa. `enablejsapi` é o que permite comandá-lo.
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
            disablekb: 1,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.ready = true;
              this.player?.setVolume(Math.round(this.volume * 100));
              if (this.pending) {
                const pending = this.pending;
                this.pending = null;
                this.loadVideo(pending.videoId, pending.startSeconds);
              }
              this.startTicker();
              resolve();
            },
            onStateChange: (payload: unknown) => this.handleState(eventData(payload)),
            onError: (payload: unknown) => this.handleError(eventData(payload)),
          },
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Toca uma lista de ids do YouTube, começando em `startIndex`. */
  async playQueue(
    videoIds: string[],
    startIndex: number,
    startTimeMs = 0
  ): Promise<void> {
    if (videoIds.length === 0) throw new Error("A fila está vazia.");
    this.queue = videoIds;
    this.index = Math.max(0, Math.min(videoIds.length - 1, startIndex));
    await this.changeIndex(this.index, startTimeMs);
  }

  async changeIndex(index: number, startTimeMs = 0): Promise<void> {
    const videoId = this.queue[index];
    if (!videoId) return;
    this.index = index;
    this.startAtMs = startTimeMs;
    // O primeiro play da sessão precisa vir de um clique. Marcamos aqui porque
    // `playQueue` só é chamado a partir de um handler de clique.
    this.unlocked = true;
    this.loadVideo(videoId, startTimeMs);
  }

  private loadVideo(videoId: string, startSeconds: number): void {
    if (!this.player || !this.ready) {
      this.pending = { videoId, startSeconds };
      return;
    }
    this.currentId = videoId;
    this.startAtMs = startSeconds * 1000;
    this.setPhase("loading", null);
    try {
      this.player.loadVideoById({
        videoId,
        startSeconds: Math.max(0, Math.floor(startSeconds)),
      });
      this.hooks.onTrackChanged?.(videoId);
    } catch (error) {
      this.handleError(5);
      console.warn("[cider] falha ao carregar vídeo:", error);
    }
  }

  private handleState(state: number): void {
    const api = this.api;
    if (!api) return;
    switch (state) {
      case api.PlayerState.PLAYING:
        this.setPhase("playing", null);
        break;
      case api.PlayerState.PAUSED:
        this.setPhase("paused", null);
        break;
      case api.PlayerState.BUFFERING:
        this.setPhase("loading", null);
        break;
      case api.PlayerState.CUED:
        this.setPhase("paused", null);
        break;
      case api.PlayerState.ENDED:
        this.setPhase("idle", null);
        this.hooks.onEnded?.();
        break;
      default:
        break;
    }
  }

  private handleError(code: number): void {
    const message = playbackErrorMessage(code);
    this.setPhase("error", message);
  }

  private setPhase(phase: PlayerPhase, error: string | null): void {
    this.error = error;
    this.hooks.onPhaseChange?.(phase, error);
    this.hooks.onPhase?.(phase, error);
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  resume(): void {
    if (!this.unlocked) {
      this.hooks.onAutoplayBlocked?.();
      return;
    }
    this.player?.playVideo();
  }

  seekToMs(ms: number): void {
    if (!this.player) return;
    this.player.seekTo(Math.max(0, ms / 1000), true);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.player?.setVolume(Math.round(this.volume * 100));
  }

  /** Posição considerando um `startSeconds` inicial (evita a barra em 0). */
  positionMs(): number {
    if (!this.player || !this.ready || !this.player.getCurrentTime) return 0;
    return Math.max(0, Math.round((this.player.getCurrentTime() || 0) * 1000));
  }

  durationMs(): number {
    if (!this.player || !this.ready || !this.player.getDuration) return 0;
    return Math.max(0, Math.round((this.player.getDuration() || 0) * 1000));
  }

  /** Início real da faixa em epoch ms, para a barra de progresso na Nexora. */
  startedAtMs(): number {
    return Date.now() - Math.max(0, this.positionMs() - this.startAtMs);
  }

  endsAtMs(): number {
    const duration = this.durationMs();
    if (duration <= 0) return 0;
    return this.startedAtMs() + duration;
  }

  private startTicker(): void {
    if (this.ticker !== null) return;
    this.ticker = window.setInterval(() => {
      if (!this.ready) return;
      this.hooks.onTime?.(this.positionMs(), this.durationMs());
    }, 250);
  }

  dispose(): void {
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    try {
      this.player?.destroy();
    } catch {
      // O player pode já ter sido removido junto com o DOM.
    }
    this.player = null;
    this.ready = false;
    this.queue = [];
    this.index = -1;
    this.currentId = null;
  }
}
