/**
 * Nexora SoundManager - Pure Web Audio API Sound Synthesizer Engine.
 * Provides custom, discrete, zero-latency audio feedback for Nexora events.
 */

export type SoundEvent =
  | "join"
  | "leave"
  | "mute"
  | "unmute"
  | "deafen"
  | "undeafen"
  | "participant-join"
  | "participant-leave"
  | "incoming-call"
  | "call-connected"
  | "call-ended"
  | "screen-start"
  | "screen-stop"
  | "notification"
  | "dm-message";

export type SoundPreferences = {
  enabled: boolean;
  masterVolume: number; // 0 to 100
  events: Record<SoundEvent, boolean>;
};

const STORAGE_KEY = "nexora-sound-prefs";

const DEFAULT_PREFS: SoundPreferences = {
  enabled: true,
  masterVolume: 80,
  events: {
    join: true,
    leave: true,
    mute: true,
    unmute: true,
    deafen: true,
    undeafen: true,
    "participant-join": true,
    "participant-leave": true,
    "incoming-call": true,
    "call-connected": true,
    "call-ended": true,
    "screen-start": true,
    "screen-stop": true,
    notification: true,
    "dm-message": true,
  },
};

class SoundManagerService {
  private ctx: AudioContext | null = null;
  private prefs: SoundPreferences = DEFAULT_PREFS;
  private loopIntervalId: number | null = null;

  constructor() {
    this.loadPrefs();
  }

  private loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.prefs = {
          ...DEFAULT_PREFS,
          ...parsed,
          events: { ...DEFAULT_PREFS.events, ...(parsed.events || {}) },
        };
      }
    } catch {
      this.prefs = DEFAULT_PREFS;
    }
  }

  public savePrefs(newPrefs: Partial<SoundPreferences>) {
    this.prefs = {
      ...this.prefs,
      ...newPrefs,
      events: { ...this.prefs.events, ...(newPrefs.events || {}) },
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore write errors
    }
  }

  public getPrefs(): SoundPreferences {
    return { ...this.prefs, events: { ...this.prefs.events } };
  }

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public play(event: SoundEvent) {
    if (!this.prefs.enabled) return;
    if (this.prefs.events[event] === false) return;
    if (this.prefs.masterVolume <= 0) return;

    try {
      const ctx = this.getAudioContext();
      const volume = (this.prefs.masterVolume / 100) * 0.25; // comfortable master scale

      switch (event) {
        case "join":
          this.playChime(ctx, [440, 660], 0.12, volume, "sine");
          break;
        case "leave":
          this.playChime(ctx, [520, 330], 0.14, volume, "sine");
          break;
        case "mute":
          this.playClick(ctx, 220, 0.06, volume);
          break;
        case "unmute":
          this.playClick(ctx, 480, 0.06, volume);
          break;
        case "deafen":
          this.playChime(ctx, [300, 200], 0.1, volume, "triangle");
          break;
        case "undeafen":
          this.playChime(ctx, [200, 380], 0.1, volume, "triangle");
          break;
        case "participant-join":
          this.playChime(ctx, [587.33, 880], 0.08, volume * 0.7, "sine");
          break;
        case "participant-leave":
          this.playChime(ctx, [783.99, 440], 0.08, volume * 0.7, "sine");
          break;
        case "call-connected":
          this.playChime(ctx, [523.25, 659.25, 783.99], 0.09, volume, "sine");
          break;
        case "call-ended":
          this.playChime(ctx, [659.25, 523.25, 392], 0.1, volume, "sine");
          break;
        case "screen-start":
          this.playChime(ctx, [440, 880], 0.09, volume, "triangle");
          break;
        case "screen-stop":
          this.playChime(ctx, [880, 440], 0.09, volume, "triangle");
          break;
        case "dm-message":
          this.playChime(ctx, [659.25, 880], 0.08, volume * 0.8, "sine");
          break;
        case "notification":
          this.playChime(ctx, [587.33, 783.99], 0.07, volume * 0.75, "sine");
          break;
        case "incoming-call":
          this.playChime(ctx, [440, 554.37, 659.25], 0.12, volume, "sine");
          break;
      }
    } catch {
      // ignore audio context failures
    }
  }

  public startRingtone() {
    this.stopRingtone();
    this.play("incoming-call");
    this.loopIntervalId = window.setInterval(() => {
      this.play("incoming-call");
    }, 2000);
  }

  public stopRingtone() {
    if (this.loopIntervalId !== null) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }
  }

  private playChime(
    ctx: AudioContext,
    freqs: number[],
    stepDuration: number,
    volume: number,
    type: OscillatorType = "sine",
  ) {
    const now = ctx.currentTime;
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + idx * stepDuration);

      gain.gain.setValueAtTime(0, now + idx * stepDuration);
      gain.gain.linearRampToValueAtTime(volume, now + idx * stepDuration + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * stepDuration + stepDuration * 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * stepDuration);
      osc.stop(now + idx * stepDuration + stepDuration * 1.5);
    });
  }

  private playClick(ctx: AudioContext, freq: number, duration: number, volume: number) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }
}

export const soundManager = new SoundManagerService();
