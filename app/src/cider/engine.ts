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
import {
  appendToQueue,
  clearManual,
  insertAfterCurrent,
  manualIndexes,
  queueFrom,
  removeAt,
  type QueueEntry,
  type QueueState,
} from "./core/queue";
import type { CiderTrack } from "./api/query";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerSnapshot {
  phase: PlayerPhase;
  error: string | null;
  positionMs: number;
  durationMs: number;
  track: CiderTrack | null;
  queue: CiderTrack[];
  /**
   * Posições da fila colocadas **à mão** ("Tocar depois"/"Adicionar à fila").
   *
   * É o que o "Limpar" tira e o que a interface preserva quando pergunta antes
   * de trocar a fila — o contexto (o álbum, a lista, a estação) não entra aqui.
   */
  manual: number[];
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
   * Acrescenta faixas ao fim da fila atual ("Adicionar à fila").
   *
   * Não há "mover para a fila" no player do YouTube: o engine é quem entrega a
   * lista completa ao player a cada troca de índice, então crescer a fila aqui
   * é suficiente e **não interrompe** a faixa que está tocando.
   */
  appendQueue(tracks: CiderTrack[]): void;
  /** Insere faixas logo depois da que está tocando ("Tocar depois"). */
  playAfter(tracks: CiderTrack[]): void;
  /**
   * Toca **o que outra pessoa está tocando**, no ponto em que ela está.
   *
   * É o único caminho do motor que aceita a posição de fora, e existe por um
   * motivo específico: numa sessão de escuta ("Ouvir junto") o convidado copia a
   * fila do anfitrião e entra no meio dela. `playQueue` só sabe começar do zero,
   * e `seekMs` depois de carregar tocaria alguns décimos da posição errada.
   *
   * `playing: false` carrega sem tocar — quem entrou numa sessão pausada não
   * deve ouvir uma batida antes de o pause chegar.
   */
  followQueue(
    tracks: CiderTrack[],
    startIndex: number,
    positionMs: number,
    playing: boolean
  ): void;
  /**
   * Tira uma faixa da fila pela posição.
   *
   * A faixa que está tocando não pode ser removida: o player do YouTube já
   * está carregando aquele id, e "remover o que toca" sem trocar de faixa
   * deixaria a interface dizendo que nada toca enquanto o áudio continua.
   */
  removeFromQueue(index: number): void;
  /**
   * "Limpar": tira só o que foi adicionado à mão e devolve quantas saíram.
   *
   * O contexto (o álbum, a lista, a estação que começou a tocar) fica — é o
   * desenho do iOS 18, e o oposto de `clearQueue`. A faixa atual nunca sai.
   */
  clearManualQueue(): number;
  /** Limpa a fila inteira e para a reprodução. */
  clearQueue(): void;
  toggle(): void;
  /**
   * Pausa e retoma **sem alternar**.
   *
   * Existem separadas do `toggle` porque uma prévia precisa exatamente disso:
   * calar o que toca e depois devolver a reprodução **como estava**. Com o
   * `toggle`, uma prévia aberta com a música já pausada a faria começar a tocar
   * ao terminar — o gesto de ouvir um trecho viraria um play.
   */
  pause(): void;
  resume(): void;
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

  let entries: QueueEntry[] = [];
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

  /** A lista que o player recebe: a fila em ordem, sem a marcação de origem. */
  function tracks(): CiderTrack[] {
    return entries.map((entry) => entry.track);
  }

  /** Aplica uma mudança da fila pura (`core/queue.ts`) ao estado do motor. */
  function apply(next: QueueState) {
    if (next.entries === entries && next.index === index) return false;
    entries = next.entries;
    index = next.index;
    // O embaralhamento vale para a fila de antes; a próxima troca de índice
    // recalcula a ordem.
    order = null;
    return true;
  }

  function snapshot(): PlayerSnapshot {
    return {
      phase,
      error,
      positionMs,
      durationMs,
      track: index >= 0 ? (entries[index]?.track ?? null) : null,
      queue: tracks(),
      manual: manualIndexes(entries),
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
    onActivity(index >= 0 ? (entries[index]?.track ?? null) : null, phase === "playing");
  }

  /**
   * Embaralhamento determinístico: a mesma faixa inicial gera a mesma ordem,
   * então pular duas vezes não joga a pessoa em um lugar novo toda vez, e a
   * fila não se reordena sozinha enquanto ela ouve.
   */
  function buildOrder(): number[] {
    const result = entries.map((_entry, position) => position);
    let seed = entries[index]?.track.videoId.length ?? 7;
    for (let position = result.length - 1; position > 0; position--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const swap = seed % (position + 1);
      [result[position], result[swap]] = [result[swap], result[position]];
    }
    return result;
  }

  function currentOrder(): number[] {
    const length = entries.length;
    if (!shuffle || length < 2) {
      order = null;
      return entries.map((_entry, position) => position);
    }
    if (!order || order.length !== length) order = buildOrder();
    return order;
  }

  function playIndex(next: number) {
    if (entries.length === 0) return;
    const bounded = ((next % entries.length) + entries.length) % entries.length;
    index = bounded;
    void player.playQueue(
      entries.map(entry => entry.track.videoId),
      bounded
    );
    announce();
    publish();
  }

  function playTrack(track: CiderTrack, list: CiderTrack[]) {
    entries = queueFrom(list).entries;
    order = null;
    playIndex(
      Math.max(
        0,
        list.findIndex(item => item.videoId === track.videoId)
      )
    );
  }

  function playQueue(list: CiderTrack[], startIndex = 0) {
    entries = queueFrom(list).entries;
    order = null;
    playIndex(startIndex);
  }

  function followQueue(
    list: CiderTrack[],
    startIndex: number,
    atMs: number,
    playing: boolean
  ) {
    // Sem faixa no anfitrião não há o que seguir: o convidado para onde o
    // anfitrião parou, em vez de continuar tocando a fila dele por conta.
    if (list.length === 0) {
      clearQueue();
      return;
    }
    entries = queueFrom(list).entries;
    order = null;
    const bounded = Math.max(0, Math.min(entries.length - 1, startIndex));
    index = bounded;
    autoplayBlocked = false;
    positionMs = Math.max(0, atMs);
    durationMs = entries[bounded]?.track.durationMs || 0;
    void player.playQueue(
      entries.map(entry => entry.track.videoId),
      bounded,
      positionMs / 1000,
      playing
    );
    announce();
    publish();
  }

  function appendQueue(list: CiderTrack[]) {
    if (list.length === 0) return;
    // Um embaralhamento antigo não pode esconder as faixas novas: a ordem é
    // recalculada na próxima troca de índice.
    if (!apply(appendToQueue({ entries, index }, list))) return;
    publish();
  }

  function playAfter(list: CiderTrack[]) {
    if (list.length === 0) return;
    const idle = index < 0 || entries.length === 0;
    if (!apply(insertAfterCurrent({ entries, index }, list))) return;
    // Sem nada tocando não existe "depois": elas são a fila nova, e precisam
    // começar a tocar — a fila pura não conhece o player.
    if (idle) playIndex(index);
    else publish();
  }

  function next() {
    if (entries.length === 0) return;
    if (repeat === "one") {
      playIndex(index);
      return;
    }
    if (repeat === "off" && index + 1 >= entries.length) {
      // Fim da fila sem repetição: para, como todo player faz.
      player.pause();
      return;
    }
    const positions = currentOrder();
    const at = positions.indexOf(index);
    playIndex(positions[(at + 1) % positions.length]);
  }

  function previous() {
    if (entries.length === 0) return;
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
    if (!apply(removeAt({ entries, index }, position))) return;
    publish();
  }

  /**
   * "Limpar": o contexto fica, o que foi adicionado à mão sai.
   *
   * Devolve quantas faixas saíram — a interface usa o número no aviso ("3
   * faixas removidas"), e zero significa que não havia nada à mão.
   */
  function clearManualQueue(): number {
    const before = entries.length;
    if (!apply(clearManual({ entries, index }))) return 0;
    publish();
    return before - entries.length;
  }

  function clearQueue() {
    player.pause();
    entries = [];
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

  function pause() {
    player.pause();
  }

  /** Volta a tocar o que já estava carregado; sem faixa, não há o que retomar. */
  function resume() {
    if (index < 0) return;
    autoplayBlocked = false;
    player.resume();
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
    followQueue,
    appendQueue,
    playAfter,
    removeFromQueue,
    clearManualQueue,
    clearQueue,
    toggle,
    pause,
    resume,
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
