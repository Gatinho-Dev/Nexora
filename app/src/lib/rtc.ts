import { realtime } from "./ws";
import { getDevicePrefs } from "./devices";
import { useAppStore } from "@/store/useAppStore";
import { soundManager } from "./sound";
import type { VoiceParticipant } from "@contracts/types";
import { apiUrl } from "./endpoints";

type SignalData = {
  description?: { type: RTCSdpType; sdp?: string };
  candidate?: RTCIceCandidateInit | null;
};

type Peer = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  videoSender: RTCRtpSender | null;
};

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/**
 * Mesh WebRTC manager for Nexora voice/video/screen-share.
 * One RTCPeerConnection per remote participant, signaling over the app WS.
 * Implements perfect negotiation pattern & audio feedback cues.
 */
class VoiceManager {
  private peers = new Map<number, Peer>();
  private iceServers: RTCIceServer[] = DEFAULT_ICE;
  private myId = 0;
  private roomKey: string | null = null; // "c:<id>" | "dm:<id>"
  private cameraTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private screenAudioTrack: MediaStreamTrack | null = null;
  private knownParticipantIds = new Set<number>();

  get inCall() {
    return this.roomKey !== null;
  }

  async join(target: {
    channelId?: number;
    conversationId?: number;
    serverId?: number;
    myId: number;
  }) {
    const roomKey = target.channelId
      ? `c:${target.channelId}`
      : `dm:${target.conversationId}`;
    if (this.roomKey === roomKey) return;
    await this.leave();

    this.myId = target.myId;
    this.roomKey = roomKey;
    this.knownParticipantIds.clear();

    console.log("[VOICE] Joining voice room", roomKey);

    // ICE config fetch (STUN default, TURN via server env)
    try {
      const cfg = await fetch(apiUrl("/api/rtc-config"), {
        credentials: "include",
      }).then(r => r.json());
      if (Array.isArray(cfg.iceServers) && cfg.iceServers.length > 0) {
        this.iceServers = cfg.iceServers;
      }
    } catch {
      // keep default STUN
    }

    let stream: MediaStream;
    try {
      const prefs = getDevicePrefs();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(prefs.audioInputId
            ? { deviceId: { ideal: prefs.audioInputId } }
            : {}),
        },
        video: false,
      });
    } catch (err) {
      this.roomKey = null;
      console.error("[VOICE] Microphone permission error", err);
      throw new Error(
        "Nexora precisa de acesso ao microfone para chamadas de voz."
      );
    }

    useAppStore.getState().setVoiceSession({
      voiceChannelId: target.channelId ?? null,
      voiceConversationId: target.conversationId ?? null,
      voiceServerId: target.serverId ?? null,
      localStream: stream,
      localVideo: null,
      muted: false,
      deafened: false,
      cameraOn: false,
      screenOn: false,
    });

    realtime.send({
      t: "voice:join",
      channelId: target.channelId,
      conversationId: target.conversationId,
    });

    soundManager.play("join");
  }

  /** Reconcile peer connections with the latest participant list. */
  syncParticipants(participants: VoiceParticipant[]) {
    if (!this.roomKey) return;
    const others = participants.filter(p => p.userId !== this.myId);
    const currentOthersIds = new Set(others.map(o => o.userId));

    // Play participant join sound if a new person enters
    for (const id of currentOthersIds) {
      if (!this.knownParticipantIds.has(id)) {
        if (this.knownParticipantIds.size > 0) {
          soundManager.play("participant-join");
        }
        this.knownParticipantIds.add(id);
      }
    }

    // Play participant leave sound if someone exits
    for (const id of this.knownParticipantIds) {
      if (!currentOthersIds.has(id)) {
        this.knownParticipantIds.delete(id);
        soundManager.play("participant-leave");
      }
    }

    for (const p of others) {
      if (!this.peers.has(p.userId)) this.createPeer(p.userId);
    }
    for (const [id, peer] of [...this.peers]) {
      if (!others.some(o => o.userId === id)) {
        peer.pc.close();
        this.peers.delete(id);
        useAppStore.getState().setRemoteStream(id, null);
      }
    }
  }

  private createPeer(userId: number): Peer {
    console.log("[WEBRTC] Creating RTCPeerConnection for user", userId);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      videoSender: null,
    };
    this.peers.set(userId, peer);

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.signal(userId, {
          description:
            pc.localDescription!.toJSON() as SignalData["description"],
        });
      } catch (err) {
        console.error("[WEBRTC] Negotiation error", err);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onicecandidate = e => {
      this.signal(userId, {
        candidate: e.candidate ? e.candidate.toJSON() : null,
      });
    };

    pc.ontrack = e => {
      console.log("[WEBRTC] Track received from user", userId, e.track.kind);
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      useAppStore.getState().setRemoteStream(userId, stream);
    };

    // Attach local audio
    const local = useAppStore.getState().localStream;
    if (local) {
      for (const track of local.getAudioTracks()) pc.addTrack(track, local);
    }
    // Attach current video track if camera/screen already on
    const videoTrack = this.screenTrack ?? this.cameraTrack;
    if (videoTrack) {
      const videoStream =
        useAppStore.getState().localVideo ?? new MediaStream([videoTrack]);
      peer.videoSender = pc.addTrack(videoTrack, videoStream);
    }
    return peer;
  }

  async handleSignal(from: number, data: SignalData) {
    if (!this.roomKey) return;
    const peer = this.peers.get(from) ?? this.createPeer(from);
    const pc = peer.pc;
    const polite = this.myId < from;

    try {
      if (data.description) {
        const description = data.description;
        const offerCollision =
          description.type === "offer" &&
          (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !polite && offerCollision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          this.signal(from, {
            description:
              pc.localDescription!.toJSON() as SignalData["description"],
          });
        }
      } else if (data.candidate !== undefined) {
        try {
          await pc.addIceCandidate(data.candidate ?? undefined);
        } catch (err) {
          if (!peer.ignoreOffer) throw err;
        }
      }
    } catch (err) {
      console.error("[WEBRTC] Signal handling error", err);
    }
  }

  private signal(to: number, data: SignalData) {
    if (!this.roomKey) return;
    const [kind, id] = this.roomKey.split(":");
    realtime.send({
      t: "signal",
      to,
      channelId: kind === "c" ? Number(id) : undefined,
      conversationId: kind === "dm" ? Number(id) : undefined,
      data,
    });
  }

  // ── Media controls ──────────────────────────────────────────
  toggleMute() {
    const store = useAppStore.getState();
    const muted = !store.muted;
    store.localStream?.getAudioTracks().forEach(t => (t.enabled = !muted));
    store.setVoiceSession({ muted });
    realtime.send({ t: "voice:state", muted });
    soundManager.play(muted ? "mute" : "unmute");
  }

  toggleDeafen() {
    const store = useAppStore.getState();
    const deafened = !store.deafened;
    if (deafened) {
      store.localStream?.getAudioTracks().forEach(t => (t.enabled = false));
      store.setVoiceSession({ deafened: true, muted: true });
      realtime.send({ t: "voice:state", deafened: true, muted: true });
      soundManager.play("deafen");
    } else {
      store.localStream?.getAudioTracks().forEach(t => (t.enabled = true));
      store.setVoiceSession({ deafened: false, muted: false });
      realtime.send({ t: "voice:state", deafened: false, muted: false });
      soundManager.play("undeafen");
    }
  }

  async toggleCamera() {
    if (this.cameraTrack) {
      this.stopCameraTrack();
      realtime.send({ t: "voice:state", camera: false });
      useAppStore.getState().setVoiceSession({ cameraOn: false });
      return;
    }
    try {
      const prefs = getDevicePrefs();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          ...(prefs.videoInputId
            ? { deviceId: { ideal: prefs.videoInputId } }
            : {}),
        },
        audio: false,
      });
      this.cameraTrack = stream.getVideoTracks()[0] ?? null;
      if (!this.cameraTrack) return;
      await this.publishVideoTrack(this.cameraTrack);
      this.refreshLocalVideo();
      useAppStore.getState().setVoiceSession({ cameraOn: true });
      realtime.send({ t: "voice:state", camera: true });
    } catch (err) {
      console.error("[VOICE] Camera error", err);
      throw new Error("Nexora não conseguiu acessar a câmera.");
    }
  }

  async startScreenShare() {
    if (this.screenTrack) return;
    let stream: MediaStream;
    try {
      console.log("[SCREEN] Requesting getDisplayMedia stream...");
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30 },
        } as MediaTrackConstraints,
        audio: true, // system/tab audio capture
      });
    } catch (err) {
      console.warn("[SCREEN] Screen share cancelled or rejected", err);
      return;
    }
    this.screenTrack = stream.getVideoTracks()[0] ?? null;
    const audioTrack = stream.getAudioTracks()[0] ?? null;
    if (!this.screenTrack) {
      audioTrack?.stop();
      return;
    }

    // Auto cleanup when user stops share via browser standard UI
    this.screenTrack.onended = () => {
      console.log("[SCREEN] Browser screen share stopped by user");
      this.stopScreenShare().catch(() => {});
    };

    await this.publishVideoTrack(this.screenTrack);
    if (audioTrack) {
      this.publishAudioTrack(audioTrack);
    }
    this.refreshLocalVideo();
    useAppStore.getState().setVoiceSession({ screenOn: true });
    realtime.send({ t: "voice:state", screen: true });
    soundManager.play("screen-start");
  }

  private publishAudioTrack(track: MediaStreamTrack) {
    this.screenAudioTrack = track;
    for (const peer of this.peers.values()) {
      const sender = peer.pc
        .getSenders()
        .find(s => s.track?.kind === "audio" && s.track !== this.cameraTrack);
      if (sender) {
        sender.replaceTrack(track).catch(() => {});
      } else {
        peer.pc.addTrack(track);
      }
    }
  }

  async stopScreenShare() {
    if (!this.screenTrack) return;
    this.screenTrack.stop();
    this.screenTrack = null;
    this.screenAudioTrack?.stop();
    this.screenAudioTrack = null;

    // Fall back to camera track if camera was enabled
    for (const peer of this.peers.values()) {
      if (peer.videoSender) {
        if (this.cameraTrack) {
          await peer.videoSender.replaceTrack(this.cameraTrack);
        } else {
          peer.pc.removeTrack(peer.videoSender);
          peer.videoSender = null;
        }
      }
      const audioSenders = peer.pc
        .getSenders()
        .filter(s => s.track?.kind === "audio" && s.track !== this.cameraTrack);
      for (const sender of audioSenders) {
        peer.pc.removeTrack(sender);
      }
    }
    this.refreshLocalVideo();
    useAppStore.getState().setVoiceSession({ screenOn: false });
    realtime.send({ t: "voice:state", screen: false });
    soundManager.play("screen-stop");
  }

  private stopCameraTrack() {
    this.cameraTrack?.stop();
    this.cameraTrack = null;
    if (!this.screenTrack) {
      for (const peer of this.peers.values()) {
        if (peer.videoSender) {
          peer.pc.removeTrack(peer.videoSender);
          peer.videoSender = null;
        }
      }
    } else {
      for (const peer of this.peers.values()) {
        if (peer.videoSender)
          peer.videoSender.replaceTrack(this.screenTrack).catch(() => {});
      }
    }
    this.refreshLocalVideo();
  }

  /** Publish (or replace) the video track on all peer connections. */
  private async publishVideoTrack(track: MediaStreamTrack) {
    const videoStream = new MediaStream([track]);
    for (const peer of this.peers.values()) {
      if (peer.videoSender) {
        await peer.videoSender.replaceTrack(track);
      } else {
        peer.videoSender = peer.pc.addTrack(track, videoStream);
      }
    }
  }

  private refreshLocalVideo() {
    const track = this.screenTrack ?? this.cameraTrack;
    useAppStore
      .getState()
      .setVoiceSession({ localVideo: track ? new MediaStream([track]) : null });
  }

  async leave() {
    if (!this.roomKey) return;
    soundManager.play("leave");
    realtime.send({ t: "voice:leave" });
    this.teardown();
  }

  teardown() {
    console.log("[VOICE] Tearing down voice session");
    for (const peer of this.peers.values()) peer.pc.close();
    this.peers.clear();
    this.cameraTrack?.stop();
    this.screenTrack?.stop();
    this.screenAudioTrack?.stop();
    this.cameraTrack = null;
    this.screenTrack = null;
    this.screenAudioTrack = null;
    const store = useAppStore.getState();
    store.localStream?.getTracks().forEach(t => t.stop());
    store.resetVoice();
    this.roomKey = null;
    this.knownParticipantIds.clear();
  }
}

export const voiceManager = new VoiceManager();
