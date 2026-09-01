export function shouldIgnoreOffer({
  descriptionType,
  makingOffer,
  signalingState,
  isSettingRemoteAnswerPending = false,
  polite,
}: {
  descriptionType: RTCSdpType;
  makingOffer: boolean;
  signalingState: RTCSignalingState;
  isSettingRemoteAnswerPending?: boolean;
  polite: boolean;
}): boolean {
  const readyForOffer =
    !makingOffer &&
    (signalingState === "stable" || isSettingRemoteAnswerPending);
  const offerCollision = descriptionType === "offer" && !readyForOffer;
  return !polite && offerCollision;
}

/**
 * In perfect negotiation, an ignored offer and all of its candidates form one
 * discarded ICE generation. Mixing those candidates into the accepted SDP can
 * leave the peer connection permanently checking or failed.
 */
export function shouldIgnoreCandidate(ignoreOffer: boolean): boolean {
  return ignoreOffer;
}
