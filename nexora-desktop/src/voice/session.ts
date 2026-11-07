import { addRemoteTrack, removeRemoteTracksOfKind } from "./remoteStream";
import { shouldIgnoreCandidate, shouldIgnoreOffer } from "./perfectNegotiation";

/**
 * Sess\u00e3o de voz do Desktop. A sinaliza\u00e7\u00e3o trafega pelo WebSocket autenticado do
 * processo principal (IPC validado); o \u00e1udio/v\u00eddeo \u00e9 WebRTC ponto a ponto. Segue o
 * mesmo protocolo do cliente web: quem tem o ID menor n\u00e3o \u00e9 "polite".
 */

export type VoiceRoom = { channelId: number } | { conversationId: number };

export type VoiceParticipant = {
  userId: number;
  muted?: boolean;
  deafened?: boolean;
  camera?: boolean;
  screen?: boolean;
};

type SignalData = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

type Peer = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  remoteStream: MediaStream;
};

export type VoiceSessionEvents = {
  onParticipants: (participants: VoiceParticipant[]) => void;
  onRemoteStream: (userId: number, stream: MediaStream | null) => void;
  onError: (message: string) => void;
};

const bridge = () => window.nexora;

export class VoiceSession {
  private localStream: MediaStream | null = null;
  private peers = new Map<number, Peer>();
  private voiceSessionId: string | null = null;
  private room: VoiceRoom | null = null;
  private participants: VoiceParticipant[] = [];
  private iceServers: RTCIceServer[] = [];
  private closed = false;
  private muted = false;

  constructor(
    private readonly myId: number,
    private readonly events: VoiceSessionEvents,
  ) {}

  get active() {
    return this.room !== null;
  }

  get isMuted() {
    return this.muted;
  }

  /** Entra na sala. O microfone \u00e9 pedido antes de qualquer await de rede. */
  async join(room: VoiceRoom, options: { initiated?: boolean; video?: boolean } = {}) {
    if (this.room) await this.leave();
    this.closed = false;
    this.room = room;
    const micPromise = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    try {
      const [stream, iceServers] = await Promise.all([micPromise, bridge().voiceIceServers()]);
      if (this.closed) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      this.localStream = stream;
      this.iceServers = iceServers as RTCIceServer[];
      await bridge().voiceSend({ t: "voice:join", ...roomFields(room), ...options });
    } catch (error) {
      await this.leave();
      throw error;
    }
  }

  /** Recebe eventos `voice:*` e `signal` vindos do servidor. */
  handleEvent(event: { t: string } & Record<string, unknown>) {
    if (!this.room) return;
    switch (event.t) {
      case "voice:ready": {
        if (!matchesRoom(event, this.room)) return;
        this.voiceSessionId = String(event.voiceSessionId ?? "") || null;
        return;
      }
      case "voice:denied": {
        if (!matchesRoom(event, this.room)) return;
        this.events.onError(String(event.reason ?? "Entrada negada."));
        void this.leave();
        return;
      }
      case "voice:participants": {
        if (!matchesRoom(event, this.room)) return;
        this.syncParticipants(Array.isArray(event.participants) ? (event.participants as VoiceParticipant[]) : []);
        return;
      }
      case "signal": {
        if (!matchesRoom(event, this.room) || typeof event.from !== "number") return;
        void this.handleSignal(event.from, event.data as SignalData);
        return;
      }
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.localStream?.getAudioTracks().forEach(track => (track.enabled = !this.muted));
    void this.sendState({ muted: this.muted });
    return this.muted;
  }

  async leave() {
    if (!this.room && !this.localStream) return;
    this.closed = true;
    const sessionId = this.voiceSessionId;
    this.room = null;
    this.voiceSessionId = null;
    this.participants = [];
    for (const id of [...this.peers.keys()]) this.destroyPeer(id);
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.muted = false;
    if (sessionId) await bridge().voiceSend({ t: "voice:leave", voiceSessionId: sessionId }).catch(() => undefined);
    else await bridge().voiceSend({ t: "voice:leave" }).catch(() => undefined);
  }

  private syncParticipants(participants: VoiceParticipant[]) {
    this.participants = participants;
    const others = participants.filter(p => p.userId !== this.myId);
    const current = new Set(others.map(p => p.userId));
    for (const p of others) {
      if (!this.peers.has(p.userId)) this.createPeer(p.userId);
    }
    for (const id of [...this.peers.keys()]) {
      if (!current.has(id)) this.destroyPeer(id);
    }
    this.events.onParticipants(participants);
  }

  private createPeer(userId: number): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
      remoteStream: new MediaStream(),
    };
    this.peers.set(userId, peer);

    this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream as MediaStream));

    pc.ontrack = event => {
      addRemoteTrack(peer.remoteStream, event.track);
      this.events.onRemoteStream(userId, peer.remoteStream);
      event.track.onended = () => {
        if (removeRemoteTracksOfKind(peer.remoteStream, event.track.kind) >= 0) {
          this.events.onRemoteStream(userId, peer.remoteStream.getTracks().length ? peer.remoteStream : null);
        }
      };
    };
    pc.onicecandidate = event => {
      this.signal(userId, { candidate: event.candidate ? event.candidate.toJSON() : null });
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) this.signal(userId, { description: pc.localDescription.toJSON() });
      } catch (error) {
        console.error("[VOICE] negocia\u00e7\u00e3o", error);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();
    };
    return peer;
  }

  private destroyPeer(userId: number) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.onnegotiationneeded = null;
    peer.pc.close();
    this.peers.delete(userId);
    this.events.onRemoteStream(userId, null);
  }

  private async handleSignal(from: number, data: SignalData) {
    const peer = this.peers.get(from) ?? this.createPeer(from);
    const pc = peer.pc;
    const polite = this.myId < from;
    try {
      if (data.description) {
        peer.isSettingRemoteAnswerPending = data.description.type === "answer";
        peer.ignoreOffer = shouldIgnoreOffer({
          descriptionType: data.description.type as RTCSdpType,
          makingOffer: peer.makingOffer,
          signalingState: pc.signalingState,
          isSettingRemoteAnswerPending: peer.isSettingRemoteAnswerPending,
          polite,
        });
        if (peer.ignoreOffer) {
          peer.pendingCandidates = [];
          return;
        }
        await pc.setRemoteDescription(data.description);
        peer.isSettingRemoteAnswerPending = false;
        while (peer.pendingCandidates.length) {
          await pc.addIceCandidate(peer.pendingCandidates.shift() ?? null);
        }
        if (data.description.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription) this.signal(from, { description: pc.localDescription.toJSON() });
        }
      } else if (data.candidate !== undefined) {
        if (shouldIgnoreCandidate(peer.ignoreOffer)) return;
        if (!pc.remoteDescription) peer.pendingCandidates.push(data.candidate as RTCIceCandidateInit);
        else if (data.candidate) await pc.addIceCandidate(data.candidate);
      }
    } catch (error) {
      peer.isSettingRemoteAnswerPending = false;
      if (!peer.ignoreOffer) console.error("[VOICE] sinaliza\u00e7\u00e3o", from, error);
    }
  }

  private signal(to: number, data: SignalData) {
    if (!this.room) return;
    void bridge()
      .voiceSend({
        t: "signal",
        to,
        ...roomFields(this.room),
        voiceSessionId: this.voiceSessionId ?? undefined,
        data,
      })
      .catch(() => undefined);
  }

  private sendState(patch: { muted?: boolean }) {
    return bridge().voiceSend({ t: "voice:state", ...patch, voiceSessionId: this.voiceSessionId ?? undefined }).catch(() => undefined);
  }
}

function roomFields(room: VoiceRoom) {
  return "channelId" in room ? { channelId: room.channelId } : { conversationId: room.conversationId };
}

function matchesRoom(event: Record<string, unknown>, room: VoiceRoom) {
  return "channelId" in room
    ? event.channelId === room.channelId
    : event.conversationId === room.conversationId;
}
