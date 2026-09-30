/**
 * Cider — motor de reprodução.
 *
 * Reproduz pelo **player oficial do YouTube** no navegador. Nenhum áudio é
 * baixado, extraído ou convertido: o `iframe` do YouTube reproduz e esta
 * interface o comanda por `enablejsapi`. A capa fica por cima do vídeo, porque
 * aqui quem manda é o Cider.
 *
 * O `<iframe>` precisa de **área real** — 16:9 de verdade, nunca `display:none`
 * nem 0×0, senão ele não inicializa. Quem esconde o vídeo é a capa opaca.
 *
 * O motor vive **fora** do roteador de propósito: o áudio precisa continuar
 * quando o usuário sai de `/cider` para o Nexora, e o que desmonta um `<iframe>`
 * é a página, não a rota. O `CiderMiniBar` só observa o estado.
 *
 * O áudio não passa pelo equalizador: o navegador não dá acesso ao buffer do
 * iframe.
 */

import { YouTubePlayer, type PlayerPhase } from "./core/player";
import type { CiderTrack } from "./api/query";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerSnapshot {
  phase: PlayerPhase;
  error: string | null;
  positionMs: number;
  durationMs: number;
  track: CiderTrack | null;
  queue: CiderTrack[];
  index: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplayBlocked: boolean;
}

export interface CiderEngine {
  /** Monta o `<iframe>` do YouTube dentro de `host`. */
  mount(host: HTMLElement): Promise<void>;
  playTrack(track: CiderTrack, list: CiderTrack[]): void;
  playIndex(index: number): void;
  playQueue(queue: CiderTrack[], startIndex?: number): void;
  /**
   * Acrescenta faixas ao fim da fila atual.
   *
   * Não há "mover para a fila" no player do YouTube: o engine é quem entrega a
   * lista completa ao player a cada troca de índice, então crescer a fila aqui
   * é suficiente e **não interrompe** a faixa que está tocando.
   */
  appendQueue(tracks: CiderTrack[]): void;
  /**
   * Tira uma faixa da fila pela posição.
   *
   * A faixa que está tocando não pode ser removida: o player do YouTube já
   * está carregando aquele id, e "remover o que toca" sem trocar de faixa
   * deixaria a interface dizendo que nada toca enquanto o áudio continua.
   */
  removeFromQueue(index: number): void;
  /** Limpa a fila e para a reprodução. */
  clearQueue(): void;
  toggle(): void;
  next(): void;
  previous(): void;
  seekMs(ms: number): void;
  setVolume(value: number): void;
  toggleMute(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void;
  snapshot(): PlayerSnapshot;
  /** Registra quem recebe as mudanças de faixa. */
  onActivity(
    callback: (track: CiderTrack | null, playing: boolean) => void
  ): void;
  dispose(): void;
}

export function createCiderEngine(): CiderEngine {
  const player = new YouTubePlayer();
  const listeners = new Set<(snapshot: PlayerSnapshot) => void>();
  let onActivity: (track: CiderTrack | null, playing: boolean) => void = () => undefined;

  let queue: CiderTrack[] = [];
  let index = -1;
  let volume = 0.8;
  let muted = false;
  let shuffle = false;
  let repeat: RepeatMode = "off";
  let autoplayBlocked = false;
  let phase: PlayerPhase = "idle";
  let error: string | null = null;
  let positionMs = 0;
  let durationMs = 0;
  /** Fila resultante do último embaralhamento, para não re-sortear a cada skip. */
  let order: number[] | null = null;

  function snapshot(): PlayerSnapshot {
    return {
      phase,
      error,
      positionMs,
      durationMs,
      track: index >= 0 ? (queue[index] ?? null) : null,
      queue,
      index,
      volume,
      muted,
      shuffle,
      repeat,
      autoplayBlocked,
    };
  }

  function publish() {
    const value = snapshot();
    for (const listener of listeners) listener(value);
  }

  function announce() {
    onActivity(index >= 0 ? (queue[index] ?? null) : null, phase === "playing");
  }

  /**
   * Embaralhamento determinístico: a mesma faixa inicial gera a mesma ordem,
   * então pular duas vezes não joga a pessoa em um lugar novo toda vez, e a
   * fila não se reordena sozinha enquanto ela ouve.
   */
  function buildOrder(): number[] {
    const result = queue.map((_, position) => position);
    let seed = queue[index]?.videoId.length ?? 7;
    for (let position = result.length - 1; position > 0; position--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const swap = seed % (position + 1);
      [result[position], result[swap]] = [result[swap], result[position]];
    }
    return result;
  }

  function currentOrder(): number[] {
    if (!shuffle || queue.length < 2) {
      order = null;
      return queue.map((_, position) => position);
    }
    if (!order || order.length !== queue.length) order = buildOrder();
    return order;
  }

  function playIndex(next: number) {
    if (queue.length === 0) return;
    const bounded = ((next % queue.length) + queue.length) % queue.length;
    index = bounded;
    void player.playQueue(
      queue.map(item => item.videoId),
      bounded
    );
    announce();
    publish();
  }

  function playTrack(track: CiderTrack, list: CiderTrack[]) {
    queue = list;
    order = null;
    playIndex(
      Math.max(
        0,
        list.findIndex(item => item.videoId === track.videoId)
      )
    );
  }

  function playQueue(list: CiderTrack[], startIndex = 0) {
    queue = list;
    order = null;
    playIndex(startIndex);
  }

  function appendQueue(tracks: CiderTrack[]) {
    if (tracks.length === 0) return;
    // Um embaralhamento antigo não pode esconder as faixas novas: a ordem é
    // recalculada na próxima troca de índice.
    const known = new Set(queue.map((item) => item.videoId));
    const fresh = tracks.filter((item) => item.videoId && !known.has(item.videoId));
    if (fresh.length === 0) return;
    queue = [...queue, ...fresh];
    order = null;
    publish();
  }

  function next() {
    if (queue.length === 0) return;
    if (repeat === "one") {
      playIndex(index);
      return;
    }
    if (repeat === "off" && index + 1 >= queue.length) {
      // Fim da fila sem repetição: para, como todo player faz.
      player.pause();
      return;
    }
    const positions = currentOrder();
    const at = positions.indexOf(index);
    playIndex(positions[(at + 1) % positions.length]);
  }

  function previous() {
    if (queue.length === 0) return;
    // Como em qualquer player: voltar nos primeiros 3s recomeça a faixa.
    if (positionMs > 3000) {
      player.seekToMs(0);
      positionMs = 0;
      publish();
      return;
    }
    const positions = currentOrder();
    const at = positions.indexOf(index);
    playIndex(positions[(at - 1 + positions.length) % positions.length]);
  }

  function removeFromQueue(position: number) {
    if (position < 0 || position >= queue.length) return;
    if (position === index) return;
    queue = queue.filter((_item, at) => at !== position);
    if (position < index) index -= 1;
    order = null;
    publish();
  }

  function clearQueue() {
    player.pause();
    queue = [];
    index = -1;
    order = null;
    durationMs = 0;
    positionMs = 0;
    announce();
    publish();
  }

  function toggle() {
    if (phase === "playing") {
      player.pause();
    } else {
      autoplayBlocked = false;
      player.resume();
    }
    publish();
  }

  function seekMs(ms: number) {
    player.seekToMs(ms);
    positionMs = ms;
    publish();
  }

  function setVolume(value: number) {
    volume = Math.max(0, Math.min(1, value));
    if (volume > 0) muted = false;
    player.setVolume(muted ? 0 : volume);
    publish();
  }

  function toggleMute() {
    muted = !muted;
    player.setVolume(muted ? 0 : volume);
    publish();
  }

  function toggleShuffle() {
    shuffle = !shuffle;
    order = null;
    publish();
  }

  function cycleRepeat() {
    repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    publish();
  }

  player.onCallbacks({
    onPhase: (next, nextError) => {
      phase = next;
      error = nextError;
      if (next === "playing") autoplayBlocked = false;
      announce();
      publish();
    },
    onEnded: () => next(),
    onTime: (position, duration) => {
      // O iframe do YouTube continua carregado depois de limpar a fila e segue
      // reportando o tempo do último vídeo. Sem esta guarda a barra de
      // reprodução ficava com o relógio congelado (ex.: 0:33 / 4:55) por cima
      // de "Nada tocando". O desktop tem a mesma guarda no seu ticker.
      if (index < 0) return;
      positionMs = position;
      durationMs = duration;
      publish();
    },
    onAutoplayBlocked: () => {
      autoplayBlocked = true;
      publish();
    },
  });

  player.setVolume(volume);

  return {
    onActivity(callback) {
      onActivity = callback;
    },
    mount: host => player.mount(host),
    playTrack,
    playIndex,
    playQueue,
    appendQueue,
    removeFromQueue,
    clearQueue,
    toggle,
    next,
    previous,
    seekMs,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot,
    dispose: () => {
      player.dispose();
      listeners.clear();
    },
  };
}
