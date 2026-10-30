import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVoiceDropGrace, VOICE_DROP_GRACE_MS } from "./voiceDropGrace";

describe("voice drop grace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the seat when the user rejoins before the grace period ends", () => {
    const grace = createVoiceDropGrace();
    const onExpire = vi.fn();

    grace.schedule(1, onExpire);
    vi.advanceTimersByTime(VOICE_DROP_GRACE_MS - 1_000);
    // Um rejoin no mesmo room chama cancel antes do prazo.
    grace.cancel(1);
    vi.advanceTimersByTime(VOICE_DROP_GRACE_MS);

    expect(onExpire).not.toHaveBeenCalled();
    expect(grace.isPending(1)).toBe(false);
  });

  it("removes the seat once the grace period expires without a rejoin", () => {
    const grace = createVoiceDropGrace();
    const onExpire = vi.fn();

    grace.schedule(1, onExpire);
    vi.advanceTimersByTime(VOICE_DROP_GRACE_MS - 1);
    expect(onExpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(grace.isPending(1)).toBe(false);
  });

  it("restarts the window when the socket drops again, without double removal", () => {
    const grace = createVoiceDropGrace();
    const onExpire = vi.fn();

    grace.schedule(1, onExpire);
    vi.advanceTimersByTime(VOICE_DROP_GRACE_MS - 1_000);
    grace.schedule(1, onExpire);
    vi.advanceTimersByTime(VOICE_DROP_GRACE_MS - 1_000);
    expect(onExpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("tracks each user independently", () => {
    const grace = createVoiceDropGrace();
    const first = vi.fn();
    const second = vi.fn();

    grace.schedule(1, first);
    grace.schedule(2, second);
    grace.cancel(1);
    vi.advanceTimersByTime(VOICE_DROP_GRACE_MS);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cancel on an intentional leave clears a pending drop immediately", () => {
    const grace = createVoiceDropGrace();
    const onExpire = vi.fn();

    grace.schedule(1, onExpire);
    grace.cancel(1);

    expect(grace.isPending(1)).toBe(false);
    vi.advanceTimersByTime(VOICE_DROP_GRACE_MS * 2);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
