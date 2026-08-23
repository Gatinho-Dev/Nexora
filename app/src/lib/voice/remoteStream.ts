/**
 * Adds an incoming WebRTC track to the participant stream used by the UI.
 *
 * A peer only publishes one visual source at a time (camera or screen). Some
 * browsers keep the receiver track from a removed sender in `live` state, so
 * waiting for `track.onended` leaves a stale camera beside a later screen
 * share. Keep audio tracks additive, but replace the previous visual track as
 * soon as the new one arrives.
 */
export function addRemoteTrack(
  remoteStream: Pick<MediaStream, "addTrack" | "getTracks" | "removeTrack">,
  track: MediaStreamTrack
) {
  if (track.kind === "video") {
    for (const existing of remoteStream.getTracks()) {
      if (existing.kind === "video" && existing.id !== track.id) {
        remoteStream.removeTrack(existing);
      }
    }
  }

  if (!remoteStream.getTracks().some(existing => existing.id === track.id)) {
    remoteStream.addTrack(track);
  }
}

export function removeRemoteTracksOfKind(
  remoteStream: Pick<MediaStream, "getTracks" | "removeTrack">,
  kind: MediaStreamTrack["kind"]
) {
  let removed = 0;
  for (const track of remoteStream.getTracks()) {
    if (track.kind === kind) {
      remoteStream.removeTrack(track);
      removed += 1;
    }
  }
  return removed;
}
