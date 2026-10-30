import { describe, expect, it, vi } from "vitest";
import { addRemoteTrack, removeRemoteTracksOfKind } from "./remoteStream";

function streamWith(initial: MediaStreamTrack[]) {
  const tracks = [...initial];
  return {
    tracks,
    addTrack: vi.fn((track: MediaStreamTrack) => tracks.push(track)),
    removeTrack: vi.fn((track: MediaStreamTrack) => {
      const index = tracks.indexOf(track);
      if (index >= 0) tracks.splice(index, 1);
    }),
    getTracks: vi.fn(() => tracks),
  };
}

describe("addRemoteTrack", () => {
  it("replaces a stale camera track when a screen track arrives", () => {
    const microphone = { id: "mic", kind: "audio" } as MediaStreamTrack;
    const camera = { id: "camera", kind: "video" } as MediaStreamTrack;
    const screen = { id: "screen", kind: "video" } as MediaStreamTrack;
    const remote = streamWith([microphone, camera]);

    addRemoteTrack(remote, screen);

    expect(remote.removeTrack).toHaveBeenCalledWith(camera);
    expect(remote.tracks).toEqual([microphone, screen]);
  });

  it("keeps multiple audio sources and ignores duplicate events", () => {
    const microphone = { id: "mic", kind: "audio" } as MediaStreamTrack;
    const screenAudio = {
      id: "screen-audio",
      kind: "audio",
    } as MediaStreamTrack;
    const remote = streamWith([microphone]);

    addRemoteTrack(remote, screenAudio);
    addRemoteTrack(remote, screenAudio);

    expect(remote.removeTrack).not.toHaveBeenCalled();
    expect(remote.tracks).toEqual([microphone, screenAudio]);
  });

  it("removes stale visual tracks when the participant stops publishing", () => {
    const microphone = { id: "mic", kind: "audio" } as MediaStreamTrack;
    const screen = { id: "screen", kind: "video" } as MediaStreamTrack;
    const remote = streamWith([microphone, screen]);

    expect(removeRemoteTracksOfKind(remote, "video")).toBe(1);
    expect(remote.tracks).toEqual([microphone]);
  });
});
