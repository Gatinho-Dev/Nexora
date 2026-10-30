/**
 * Motor de sincronia das letras, como fonte externa.
 *
 * A sincronia é inerentemente **imperativa e fora do React**: o player reporta
 * a posição 4× por segundo, e entre um reporte e outro a posição anda
 * sozinha. Guardar isso em `useState` obrigaria a copiar o estado a cada quadro
 * e ainda assim atrasaria a palavra acesa em um tique.
 *
 * A solução idiomática é `useSyncExternalStore`: o objeto abaixo é dono do
 * motor, interpola a posição com `requestAnimationFrame` e avisa os inscritos.
 * O React lê um snapshot imutável, e a interpolação continua rodando a 60 fps
 * mesmo quando nada re-renderiza.
 */

import { LyricsSyncEngine } from "./core/lyrics/sync";
import type { LyricsLine } from "./core/lyrics/types";

export type LyricsFrameView = ReturnType<LyricsSyncEngine["update"]>["lines"];

export class LyricsTimeline {
  private engine = new LyricsSyncEngine();

  private listeners = new Set<() => void>();

  /** Último quadro calculado. Substituído (nunca mutado) a cada `setPosition`. */
  private frame: LyricsFrameView = this.engine.update(0).lines;

  /** Posição crua mais recente vinda do player, e o instante em que chegou. */
  private anchor = { position: 0, at: 0 };

  private raf: number | null = null;

  private playing = false;

  private lines: LyricsLine[] = [];

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getFrame = (): LyricsFrameView => this.frame;

  setLines(lines: LyricsLine[]): void {
    this.lines = lines;
    this.engine.setLines(lines);
  }

  /** `true` enquanto o player está tocando; controla a interpolação. */
  setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.playing = playing;
    if (playing) this.start();
    else this.stop();
  }

  setPosition(positionMs: number): void {
    this.anchor = { position: positionMs, at: performance.now() };
    this.emit();
  }

  private start(): void {
    if (this.raf !== null) return;
    const tick = () => {
      this.emit();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.raf === null) return;
    cancelAnimationFrame(this.raf);
    this.raf = null;
    this.emit();
  }

  private emit(): void {
    if (this.lines.length === 0) {
      this.frame = [];
      for (const listener of this.listeners) listener();
      return;
    }
    // Interpola entre reportes do player: sem isto o destaque por palavra dá
    // saltos visíveis de 250 ms. Na pausa, congela na última posição.
    const position = this.playing
      ? this.anchor.position + (performance.now() - this.anchor.at)
      : this.anchor.position;
    this.frame = this.engine.update(Math.max(0, position)).lines;
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
  }
}
