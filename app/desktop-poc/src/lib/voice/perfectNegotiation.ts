export function shouldIgnoreOffer({
  descriptionType,
  makingOffer,
  signalingState,
  polite,
}: {
  descriptionType: RTCSdpType;
  makingOffer: boolean;
  signalingState: RTCSignalingState;
  polite: boolean;
}): boolean {
  const offerCollision =
    descriptionType === "offer" &&
    (makingOffer || signalingState !== "stable");
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
