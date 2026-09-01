import { realtime } from "./ws";
import { getDevicePrefs } from "./devices";
import { useAppStore } from "@/store/useAppStore";
import { soundManager } from "./sound";
import type { VoiceParticipant } from "@contracts/types";
import { apiUrl } from "./endpoints";
import {
  createAudioProcessingSession,
  microphoneConstraints,
  type AudioProcessingSession,
} from "./voice/audioProcessing";
import {
  shouldIgnoreCandidate,
  shouldIgnoreOffer,
} from "./voice/perfectNegotiation";
import {
  serializeRtcStats,
  summarizeVoiceQuality,
  type VoiceStatsSample,
} from "./voice/rtcStats";
import { addRemoteTrack, removeRemoteTracksOfKind } from "./voice/remoteStream";

type SignalData = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

type JoinTarget = {
  channelId?: number;
  conversationId?: number;
  serverId?: number;
  myId: number;
  initiated?: boolean;
  video?: boolean;
};

type Peer = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: (RTCIceCandidateInit | null)[];
  remoteStream: MediaStream;
  microphoneSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  screenAudioSender: RTCRtpSender | null;
  restartAttempts: number;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
};

type CallMetric =
  | "callInitiatedAt"
  | "mediaRequestStartedAt"
  | "mediaReadyAt"
  | "offerCreatedAt"
  | "offerSentAt"
  | "answerReceivedAt"
  | "iceConnectedAt"
  | "firstRemoteAudioAt"
  | "callConnectedAt";

const DEFAULT_ICE: RTCIceServer[] = [
  {
    urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
  },
];

const DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_VOICE_DEBUG === "true";

declare global {
  interface Window {
    __NEXORA_VOICE_DEBUG__?: () => Promise<unknown>;
  }
}

function roomKeyOf(target: Pick<JoinTarget, "channelId" | "conversationId">) {
  if (target.channelId) return `c:${target.channelId}`;
  if (target.conversationId) return `dm:${target.conversationId}`;
  throw new Error("Canal de voz inválido.");
}

function iceServersFromClientEnv(): RTCIceServer[] {
  const servers: RTCIceServer[] = [];
  const stunUrls = (import.meta.env.VITE_STUN_URL as string | undefined)
    ?.split(",")
    .map(url => url.trim())
    .filter(Boolean);
  if (stunUrls?.length) servers.push({ urls: stunUrls });

  const turnUrl = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim();
  const username = (
    import.meta.env.VITE_TURN_USERNAME as string | undefined
  )?.trim();
  const credential = (
    import.meta.env.VITE_TURN_CREDENTIAL as string | undefined
  )?.trim();
  if (turnUrl && username && credential) {
    servers.push({ urls: turnUrl, username, credential });
  }
  return servers;
}

function keybindFromEvent(event: KeyboardEvent) {
  const key = event.key === " " ? "Space" : event.key;
  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.altKey) modifiers.push("Alt");
  if (event.metaKey) modifiers.push("Meta");
  return [...modifiers, key].join("+");
}

/**
 * Single WebRTC implementation used by every Nexora voice surface.
 * It owns capture, processing, peer negotiation, reconnection and cleanup.
 */
class VoiceManager {
  private peers = new Map<number, Peer>();
  private iceServers: RTCIceServer[] = DEFAULT_ICE;
  private myId = 0;
  private roomKey: string | null = null;
  private target: JoinTarget | null = null;
  private voiceSessionId: string | null = null;
  private audioSession: AudioProcessingSession | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private screenAudioTrack: MediaStreamTrack | null = null;
  private knownParticipantIds = new Set<number>();
  private mutedBeforeDeafen = false;
  private reconnectDeadline: ReturnType<typeof setTimeout> | null = null;
  private cleaningUp = false;
  private initialJoinSent = false;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private previousInbound = new Map<
    number,
    { bytesReceived: number; timestamp: number }
  >();
  private metrics: Partial<Record<CallMetric, number>> = {};
  private joinGeneration = 0;
  private pushToTalkPressed = false;
  private joinAck: {
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const cleanup = () => this.teardown("page-exit");
      window.addEventListener("pagehide", cleanup);
      window.addEventListener("beforeunload", cleanup);
      window.addEventListener("keydown", event => {
        if (!event.repeat) this.handlePushToTalk(event, true);
      });
      window.addEventListener("keyup", event => {
        this.handlePushToTalk(event, false);
      });
      window.addEventListener("blur", () => this.releasePushToTalk());
      if (DEBUG) {
        window.__NEXORA_VOICE_DEBUG__ = () => this.getDebugStats();
      }
    }
  }

  get inCall() {
    return this.roomKey !== null;
  }

  get currentRoomKey() {
    return this.roomKey;
  }

  private log(...args: unknown[]) {
    if (DEBUG) console.debug("[VOICE]", ...args);
  }

  private markMetric(metric: CallMetric) {
    if (this.metrics[metric] != null) return;
    this.metrics[metric] = Date.now();
    if (DEBUG) {
      this.log("metric", metric, {
        at: this.metrics[metric],
        sinceInitiatedMs:
          metric === "callInitiatedAt"
            ? 0
            : this.metrics.callInitiatedAt
              ? this.metrics[metric]! - this.metrics.callInitiatedAt
              : null,
      });
    }
  }

  private async loadIceServers() {
    const clientServers = iceServersFromClientEnv();
    try {
      const response = await fetch(apiUrl("/api/rtc-config"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config = (await response.json()) as { iceServers?: RTCIceServer[] };
      this.iceServers = config.iceServers?.length
        ? config.iceServers
        : clientServers.length
          ? clientServers
          : DEFAULT_ICE;
    } catch (error) {
      this.iceServers = clientServers.length ? clientServers : DEFAULT_ICE;
      this.log("ICE config fallback", error);
    }
  }

  async join(target: JoinTarget) {
    const nextRoomKey = roomKeyOf(target);
    if (this.roomKey === nextRoomKey) return;
    await this.leave();
    const joinGeneration = ++this.joinGeneration;

    this.myId = target.myId;
    this.roomKey = nextRoomKey;
    this.target = target;
    this.initialJoinSent = false;
    this.knownParticipantIds.clear();
    this.metrics = {};
    this.markMetric("callInitiatedAt");
    useAppStore.getState().setVoiceSession({
      voiceChannelId: target.channelId ?? null,
      voiceConversationId: target.conversationId ?? null,
      voiceServerId: target.serverId ?? null,
      voiceConnectionStatus: "connecting",
      voiceCallPhase: target.conversationId ? "creating" : "connecting",
      voiceCallStartedAt: this.metrics.callInitiatedAt ?? Date.now(),
      voiceCallConnectedAt: null,
      voiceCallDeadlineAt: null,
      voiceCallEndReason: null,
      voiceCallId: null,
      voiceDeviceError: null,
      voicePlaybackBlocked: false,
    });
    this.log("joining", nextRoomKey);

    try {
      // Microfone ANTES de qualquer await de rede: no iOS Safari o
      // getUserMedia precisa rodar dentro da ativação do toque do usuário.
      const prefs = getDevicePrefs();
      const iceConfigPromise = this.loadIceServers();
      this.markMetric("mediaRequestStartedAt");
      let rawStream: MediaStream;
      try {
        rawStream = await navigator.mediaDevices.getUserMedia({
          audio: microphoneConstraints(prefs),
          video: false,
        });
      } catch (error) {
        // OverconstrainedError/NotFoundError: cai para o áudio padrão
        // (dispositivo salvo pode não existir neste aparelho).
        if (
          error instanceof DOMException &&
          (error.name === "OverconstrainedError" ||
            error.name === "NotFoundError")
        ) {
          this.log(
            "constraints incompatíveis; usando áudio padrão",
            error.name
          );
          rawStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } else {
          throw error;
        }
      }
      this.markMetric("mediaReadyAt");
      if (
        joinGeneration !== this.joinGeneration ||
        this.roomKey !== nextRoomKey
      ) {
        rawStream.getTracks().forEach(track => track.stop());
        throw new Error("A chamada foi cancelada.");
      }
      await iceConfigPromise;
      const rawTrack = rawStream.getAudioTracks()[0];
      if (!rawTrack || rawTrack.readyState !== "live") {
        rawStream.getTracks().forEach(track => track.stop());
        throw new Error("O navegador não entregou uma faixa de áudio ativa.");
      }

      this.log("local microphone", {
        tracks: rawStream.getAudioTracks().length,
        enabled: rawTrack.enabled,
        muted: rawTrack.muted,
        readyState: rawTrack.readyState,
      });
      this.audioSession = await createAudioProcessingSession(rawStream, prefs);
      const localStream = this.audioSession.outputStream;
      const outputTrack = localStream.getAudioTracks()[0];
      if (!outputTrack || outputTrack.readyState !== "live") {
        await this.audioSession.close();
        this.audioSession = null;
        throw new Error("O processamento de áudio não gerou uma faixa válida.");
      }
      this.bindMicrophoneEnded(outputTrack);
      const startsMuted = !!prefs.pushToTalkKeybind;
      outputTrack.enabled = !startsMuted;

      useAppStore.getState().setVoiceSession({
        localStream,
        localVideo: null,
        muted: startsMuted,
        deafened: false,
        cameraOn: false,
        screenOn: false,
        voiceCallPhase: "connecting",
      });

      realtime.connect();
      await realtime.waitUntilConnected(10_000);
      if (!this.sendJoin()) {
        throw new Error("O canal em tempo real ainda não está disponível.");
      }
      await this.waitForJoinAck();
      if (startsMuted) this.sendState({ muted: true });
      if (target.conversationId && target.initiated) {
        useAppStore.getState().setVoiceSession({ voiceCallPhase: "ringing" });
      }
      soundManager.play("join");
    } catch (error) {
      this.teardown("join-failed");
      console.error("[VOICE] Falha ao entrar", error);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new Error(
          "Nexora precisa de acesso ao microfone para chamadas de voz. Libere a permissão nas configurações do navegador."
        );
      }
      if (error instanceof DOMException && error.name === "NotFoundError") {
        throw new Error("Nenhum microfone foi encontrado neste aparelho.");
      }
      if (error instanceof DOMException && error.name === "NotReadableError") {
        throw new Error(
          "O microfone está ocupado por outro aplicativo ou não pôde ser iniciado."
        );
      }
      if (error instanceof DOMException && error.name === "SecurityError") {
        throw new Error(
          "O navegador bloqueou o microfone por uma restrição de segurança."
        );
      }
      throw error;
    }
  }

  private sendJoin() {
    if (!this.target) return false;
    const sent = realtime.send({
      t: "voice:join",
      channelId: this.target.channelId,
      conversationId: this.target.conversationId,
      initiated: !this.initialJoinSent && this.target.initiated === true,
      video: this.target.video === true,
    });
    if (sent) this.initialJoinSent = true;
    return sent;
  }

  private bindMicrophoneEnded(track: MediaStreamTrack) {
    track.onended = () => {
      if (this.cleaningUp || !this.inCall) return;
      const store = useAppStore.getState();
      store.setVoiceSession({
        voiceDeviceError:
          "O microfone foi desconectado. Tentando usar o dispositivo padrão…",
      });
      void this.switchAudioInput(undefined)
        .then(() =>
          useAppStore.getState().setVoiceSession({ voiceDeviceError: null })
        )
        .catch(() =>
          useAppStore.getState().setVoiceSession({
            muted: true,
            voiceDeviceError:
              "Microfone indisponível. Escolha outro dispositivo nas configurações de voz.",
          })
        );
    };
  }

  private waitForJoinAck(timeoutMs = 10_000) {
    if (this.joinAck) {
      clearTimeout(this.joinAck.timer);
      this.joinAck.reject(new Error("A entrada anterior foi substituída."));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.joinAck = null;
        reject(
          new Error(
            "O servidor não confirmou a entrada. Verifique sua permissão no canal."
          )
        );
      }, timeoutMs);
      this.joinAck = { resolve, reject, timer };
    });
  }

  syncParticipants(roomKey: string, participants: VoiceParticipant[]) {
    if (!this.roomKey || roomKey !== this.roomKey) return;
    const selfIsPresent = participants.some(p => p.userId === this.myId);
    const others = participants.filter(p => p.userId !== this.myId);
    if (selfIsPresent) {
      const current = useAppStore.getState();
      const connected = !this.target?.conversationId || others.length > 0;
      current.setVoiceSession({
        voiceConnectionStatus: connected ? "connected" : "connecting",
        voiceCallPhase: connected
          ? "connected"
          : this.target?.initiated
            ? "ringing"
            : "connecting",
        ...(connected && current.voiceCallConnectedAt == null
          ? { voiceCallConnectedAt: Date.now() }
          : {}),
      });
      if (connected) this.markMetric("callConnectedAt");
    }
    const currentIds = new Set(others.map(participant => participant.userId));
    for (const id of currentIds) {
      if (!this.knownParticipantIds.has(id)) {
        if (this.knownParticipantIds.size > 0)
          soundManager.play("participant-join");
        this.knownParticipantIds.add(id);
      }
    }
    for (const id of [...this.knownParticipantIds]) {
      if (!currentIds.has(id)) {
        this.knownParticipantIds.delete(id);
        soundManager.play("participant-leave");
      }
    }

    for (const participant of others) {
      if (!this.peers.has(participant.userId)) {
        this.createPeer(participant.userId);
      }
      const peer = this.peers.get(participant.userId);
      if (
        peer &&
        !participant.camera &&
        !participant.screen &&
        removeRemoteTracksOfKind(peer.remoteStream, "video") > 0
      ) {
        useAppStore
          .getState()
          .setRemoteStream(
            participant.userId,
            peer.remoteStream.getTracks().length ? peer.remoteStream : null
          );
      }
    }
    for (const [id] of [...this.peers]) {
      if (!currentIds.has(id)) this.destroyPeer(id);
    }
    this.updateAggregateConnectionState();
  }

  handleVoiceReady(roomKey: string, voiceSessionId: string) {
    if (!this.roomKey || roomKey !== this.roomKey) return;
    this.voiceSessionId = voiceSessionId;
    if (this.joinAck) {
      clearTimeout(this.joinAck.timer);
      this.joinAck.resolve();
      this.joinAck = null;
    }
  }

  /** Servidor recusou a entrada — falha rápida com motivo claro. */
  handleVoiceDenied(reason: string) {
    if (!this.joinAck) return;
    clearTimeout(this.joinAck.timer);
    const reject = this.joinAck.reject;
    this.joinAck = null;
    void this.leave();
    reject(new Error(reason));
  }

  private createPeer(userId: number): Peer {
    this.log("creating peer", userId, this.iceServers);
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 4,
    });
    const peer: Peer = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
      remoteStream: new MediaStream(),
      microphoneSender: null,
      videoSender: null,
      screenAudioSender: null,
      restartAttempts: 0,
      disconnectTimer: null,
    };
    this.peers.set(userId, peer);
    this.startStatsMonitor();

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          if (pc.localDescription.type === "offer") {
            this.markMetric("offerCreatedAt");
          }
          this.signal(userId, { description: pc.localDescription.toJSON() });
          if (pc.localDescription.type === "offer") {
            this.markMetric("offerSentAt");
          }
        }
      } catch (error) {
        console.error("[VOICE] Falha de negociação", userId, error);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onicecandidate = event => {
      this.signal(userId, {
        candidate: event.candidate ? event.candidate.toJSON() : null,
      });
    };

    pc.ontrack = event => {
      const tracks = event.streams.length
        ? event.streams.flatMap(stream => stream.getTracks())
        : [event.track];
      for (const track of tracks) {
        addRemoteTrack(peer.remoteStream, track);
        if (track.kind === "audio") this.markMetric("firstRemoteAudioAt");
        track.onended = () => {
          peer.remoteStream.removeTrack(track);
          useAppStore
            .getState()
            .setRemoteStream(
              userId,
              peer.remoteStream.getTracks().length ? peer.remoteStream : null
            );
        };
      }
      this.log("remote track", userId, event.track.kind, {
        audio: peer.remoteStream.getAudioTracks().length,
        video: peer.remoteStream.getVideoTracks().length,
      });
      useAppStore.getState().setRemoteStream(userId, peer.remoteStream);
    };

    pc.onsignalingstatechange = () =>
      this.log("signaling", userId, pc.signalingState);
    pc.onicegatheringstatechange = () =>
      this.log("ice gathering", userId, pc.iceGatheringState);
    pc.oniceconnectionstatechange = () =>
      this.log("ice connection", userId, pc.iceConnectionState);
    pc.onconnectionstatechange = () => {
      this.log("connection", userId, pc.connectionState);
      if (pc.connectionState === "connected") {
        this.markMetric("iceConnectedAt");
        this.markMetric("callConnectedAt");
        peer.restartAttempts = 0;
        if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
        peer.disconnectTimer = null;
      } else if (pc.connectionState === "disconnected") {
        if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
        peer.disconnectTimer = setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            void this.restartIce(userId);
          }
        }, 2_500);
      } else if (pc.connectionState === "failed") {
        void this.restartIce(userId);
      }
      this.updateAggregateConnectionState();
    };

    const localStream = useAppStore.getState().localStream;
    const microphoneTrack = localStream?.getAudioTracks()[0];
    if (microphoneTrack && localStream) {
      peer.microphoneSender = pc.addTrack(microphoneTrack, localStream);
    }
    const videoTrack = this.screenTrack ?? this.cameraTrack;
    if (videoTrack) {
      peer.videoSender = pc.addTrack(videoTrack, new MediaStream([videoTrack]));
    }
    if (this.screenAudioTrack) {
      peer.screenAudioSender = pc.addTrack(
        this.screenAudioTrack,
        new MediaStream([this.screenAudioTrack])
      );
    }
    return peer;
  }

  async handleSignal(roomKey: string, from: number, data: SignalData) {
    if (!this.roomKey || roomKey !== this.roomKey || from === this.myId) return;
    const peer = this.peers.get(from) ?? this.createPeer(from);
    const pc = peer.pc;
    const polite = this.myId < from;

    try {
      if (data.description) {
        peer.isSettingRemoteAnswerPending = data.description.type === "answer";
        peer.ignoreOffer = shouldIgnoreOffer({
          descriptionType: data.description.type,
          makingOffer: peer.makingOffer,
          signalingState: pc.signalingState,
          isSettingRemoteAnswerPending: peer.isSettingRemoteAnswerPending,
          polite,
        });
        if (peer.ignoreOffer) {
          // Perfect negotiation: candidates that belong to an ignored offer
          // must be ignored as well. Queueing them here poisons the accepted
          // description with candidates from another ICE generation (ufrag).
          peer.pendingCandidates = [];
          this.log("ignored colliding offer", from, pc.signalingState);
          return;
        }

        await pc.setRemoteDescription(data.description);
        peer.isSettingRemoteAnswerPending = false;
        if (data.description.type === "answer") {
          this.markMetric("answerReceivedAt");
        }
        while (peer.pendingCandidates.length) {
          await pc.addIceCandidate(peer.pendingCandidates.shift() ?? null);
        }
        if (data.description.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription) {
            this.signal(from, { description: pc.localDescription.toJSON() });
          }
        }
      } else if (data.candidate !== undefined) {
        if (shouldIgnoreCandidate(peer.ignoreOffer)) {
          this.log("ignored candidate for colliding offer", from);
          return;
        }
        if (!pc.remoteDescription) {
          peer.pendingCandidates.push(data.candidate);
        } else {
          await pc.addIceCandidate(data.candidate);
        }
      }
    } catch (error) {
      peer.isSettingRemoteAnswerPending = false;
      if (!peer.ignoreOffer) {
        console.error("[VOICE] Falha ao tratar signaling", from, error);
      }
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
      voiceSessionId: this.voiceSessionId ?? undefined,
      data,
    });
  }

  private sendState(
    patch: Partial<
      Pick<VoiceParticipant, "muted" | "deafened" | "camera" | "screen">
    >
  ) {
    realtime.send({
      t: "voice:state",
      ...patch,
      voiceSessionId: this.voiceSessionId ?? undefined,
    });
  }

  private async restartIce(userId: number) {
    const peer = this.peers.get(userId);
    if (!peer || !this.roomKey) return;
    if (peer.restartAttempts >= 4) {
      useAppStore.getState().setVoiceSession({
        voiceConnectionStatus: "failed",
        voiceCallPhase: "failed",
      });
      return;
    }
    peer.restartAttempts += 1;
    useAppStore.getState().setVoiceSession({
      voiceConnectionStatus: "reconnecting",
      voiceCallPhase: "reconnecting",
    });
    const delay = [500, 1_000, 2_000, 4_000][peer.restartAttempts - 1];
    if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
    peer.disconnectTimer = setTimeout(async () => {
      try {
        peer.pc.restartIce();
        if (peer.pc.signalingState === "stable") {
          const offer = await peer.pc.createOffer({ iceRestart: true });
          await peer.pc.setLocalDescription(offer);
          this.signal(userId, { description: offer });
        }
      } catch (error) {
        console.error("[VOICE] ICE restart falhou", userId, error);
        if (peer.pc.connectionState !== "connected") {
          void this.restartIce(userId);
        }
      }
    }, delay);
  }

  private updateAggregateConnectionState() {
    if (!this.roomKey) return;
    const states = [...this.peers.values()].map(
      peer => peer.pc.connectionState
    );
    const status =
      states.length === 0 || states.every(state => state === "connected")
        ? "connected"
        : states.some(state => state === "failed")
          ? "failed"
          : states.some(state => state === "disconnected")
            ? "reconnecting"
            : "connecting";
    useAppStore.getState().setVoiceSession({
      voiceConnectionStatus: status,
      voiceCallPhase:
        status === "reconnecting"
          ? "reconnecting"
          : status === "failed"
            ? "failed"
            : status === "connected"
              ? "connected"
              : useAppStore.getState().voiceCallPhase,
    });
  }

  toggleMute() {
    const store = useAppStore.getState();
    if (!store.localStream || store.deafened) return;
    const muted = !store.muted;
    store.localStream
      .getAudioTracks()
      .forEach(track => (track.enabled = !muted));
    store.setVoiceSession({ muted });
    this.sendState({ muted });
    soundManager.play(muted ? "mute" : "unmute");
  }

  private handlePushToTalk(event: KeyboardEvent, pressed: boolean) {
    const keybind = getDevicePrefs().pushToTalkKeybind;
    if (!keybind || keybindFromEvent(event) !== keybind || !this.inCall) return;
    event.preventDefault();
    if (pressed === this.pushToTalkPressed) return;
    const store = useAppStore.getState();
    if (store.deafened) return;
    this.pushToTalkPressed = pressed;
    store.localStream?.getAudioTracks().forEach(track => {
      track.enabled = pressed;
    });
    store.setVoiceSession({ muted: !pressed });
    this.sendState({ muted: !pressed });
  }

  private releasePushToTalk() {
    if (!this.pushToTalkPressed || !this.inCall) return;
    this.pushToTalkPressed = false;
    const store = useAppStore.getState();
    store.localStream?.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
    store.setVoiceSession({ muted: true });
    this.sendState({ muted: true });
  }

  toggleDeafen() {
    const store = useAppStore.getState();
    const deafened = !store.deafened;
    if (deafened) {
      this.mutedBeforeDeafen = store.muted;
      store.localStream?.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      store.setVoiceSession({ deafened: true, muted: true });
      this.sendState({ deafened: true, muted: true });
      soundManager.play("deafen");
    } else {
      const muted = this.mutedBeforeDeafen;
      store.localStream?.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      store.setVoiceSession({ deafened: false, muted });
      this.sendState({ deafened: false, muted });
      soundManager.play("undeafen");
    }
  }

  async switchAudioInput(deviceId?: string) {
    if (!this.inCall) return;
    const prefs = { ...getDevicePrefs(), audioInputId: deviceId };
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: microphoneConstraints(prefs),
      video: false,
    });
    const nextSession = await createAudioProcessingSession(rawStream, prefs);
    const nextTrack = nextSession.outputStream.getAudioTracks()[0];
    if (!nextTrack) {
      await nextSession.close();
      throw new Error("O novo microfone não entregou áudio.");
    }
    nextTrack.enabled = !useAppStore.getState().muted;
    await Promise.all(
      [...this.peers.values()].map(peer =>
        peer.microphoneSender?.replaceTrack(nextTrack)
      )
    );
    const previousSession = this.audioSession;
    previousSession?.outputStream.getAudioTracks().forEach(track => {
      track.onended = null;
    });
    this.audioSession = nextSession;
    this.bindMicrophoneEnded(nextTrack);
    useAppStore
      .getState()
      .setVoiceSession({ localStream: nextSession.outputStream });
    await previousSession?.close();
  }

  async reconfigureAudioProcessing() {
    await this.switchAudioInput(getDevicePrefs().audioInputId);
  }

  async toggleCamera() {
    if (this.cameraTrack) {
      await this.stopCamera();
      return;
    }
    const prefs = getDevicePrefs();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          ...(prefs.videoInputId
            ? { deviceId: { ideal: prefs.videoInputId } }
            : {}),
        },
      });
      this.cameraTrack = stream.getVideoTracks()[0] ?? null;
      if (!this.cameraTrack) throw new Error("A câmera não entregou vídeo.");
      this.cameraTrack.onended = () => void this.stopCamera();
      if (!this.screenTrack) await this.publishVideoTrack(this.cameraTrack);
      this.refreshLocalVideo();
      useAppStore.getState().setVoiceSession({ cameraOn: true });
      this.sendState({ camera: true });
    } catch (error) {
      console.error("[VOICE] Falha na câmera", error);
      throw new Error("Nexora não conseguiu acessar a câmera.");
    }
  }

  async switchVideoInput(deviceId?: string) {
    if (!this.cameraTrack) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    const nextTrack = stream.getVideoTracks()[0];
    if (!nextTrack) throw new Error("A nova câmera não entregou vídeo.");
    const previous = this.cameraTrack;
    this.cameraTrack = nextTrack;
    if (!this.screenTrack) await this.publishVideoTrack(nextTrack);
    previous.stop();
    this.refreshLocalVideo();
  }

  private async stopCamera() {
    const track = this.cameraTrack;
    this.cameraTrack = null;
    track?.stop();
    if (!this.screenTrack) {
      for (const peer of this.peers.values()) {
        if (peer.videoSender) {
          await peer.videoSender.replaceTrack(null);
          peer.pc.removeTrack(peer.videoSender);
          peer.videoSender = null;
        }
      }
    }
    this.refreshLocalVideo();
    useAppStore.getState().setVoiceSession({ cameraOn: false });
    this.sendState({ camera: false });
  }

  async startScreenShare() {
    if (this.screenTrack) return;
    let stream: MediaStream;
    const quality = getDevicePrefs().streamQuality ?? "720p30";
    const [width, height, frameRate] =
      quality === "1080p60"
        ? [1920, 1080, 60]
        : quality === "1080p30"
          ? [1920, 1080, 30]
          : [1280, 720, 30];
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: frameRate },
        },
        audio: true,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError")
        return;
      throw error;
    }
    this.screenTrack = stream.getVideoTracks()[0] ?? null;
    this.screenAudioTrack = stream.getAudioTracks()[0] ?? null;
    if (!this.screenTrack) {
      this.screenAudioTrack?.stop();
      this.screenAudioTrack = null;
      return;
    }
    this.screenTrack.onended = () => void this.stopScreenShare();
    await this.publishVideoTrack(this.screenTrack);
    if (this.screenAudioTrack) {
      const screenStream = new MediaStream([this.screenAudioTrack]);
      for (const peer of this.peers.values()) {
        peer.screenAudioSender = peer.pc.addTrack(
          this.screenAudioTrack,
          screenStream
        );
      }
    }
    this.refreshLocalVideo();
    useAppStore.getState().setVoiceSession({ screenOn: true });
    this.sendState({ screen: true });
    soundManager.play("screen-start");
  }

  async stopScreenShare() {
    const screenTrack = this.screenTrack;
    const screenAudioTrack = this.screenAudioTrack;
    this.screenTrack = null;
    this.screenAudioTrack = null;
    screenTrack?.stop();
    screenAudioTrack?.stop();

    for (const peer of this.peers.values()) {
      if (peer.videoSender) {
        if (this.cameraTrack) {
          await peer.videoSender.replaceTrack(this.cameraTrack);
        } else {
          await peer.videoSender.replaceTrack(null);
          peer.pc.removeTrack(peer.videoSender);
          peer.videoSender = null;
        }
      }
      if (peer.screenAudioSender) {
        await peer.screenAudioSender.replaceTrack(null);
        peer.pc.removeTrack(peer.screenAudioSender);
        peer.screenAudioSender = null;
      }
    }
    this.refreshLocalVideo();
    useAppStore.getState().setVoiceSession({ screenOn: false });
    this.sendState({ screen: false });
    soundManager.play("screen-stop");
  }

  private async publishVideoTrack(track: MediaStreamTrack) {
    const stream = new MediaStream([track]);
    for (const peer of this.peers.values()) {
      if (peer.videoSender) await peer.videoSender.replaceTrack(track);
      else peer.videoSender = peer.pc.addTrack(track, stream);
    }
  }

  private refreshLocalVideo() {
    const track = this.screenTrack ?? this.cameraTrack;
    useAppStore
      .getState()
      .setVoiceSession({ localVideo: track ? new MediaStream([track]) : null });
  }

  handleRealtimeConnection(connected: boolean) {
    if (!this.roomKey || !this.target) return;
    if (connected) {
      if (!this.reconnectDeadline) return;
      if (this.reconnectDeadline) clearTimeout(this.reconnectDeadline);
      this.reconnectDeadline = null;
      useAppStore.getState().setVoiceSession({
        voiceConnectionStatus: "connecting",
        voiceCallPhase: "reconnecting",
      });
      this.sendJoin();
      return;
    }

    useAppStore.getState().setVoiceSession({
      voiceConnectionStatus: "reconnecting",
      voiceCallPhase: "reconnecting",
    });
    this.voiceSessionId = null;
    if (this.reconnectDeadline) clearTimeout(this.reconnectDeadline);
    this.reconnectDeadline = setTimeout(() => {
      if (!realtime.connected && this.roomKey) {
        useAppStore.getState().setVoiceSession({
          voiceConnectionStatus: "failed",
          voiceCallPhase: "failed",
        });
        this.teardown("realtime-timeout");
      }
    }, 20_000);
  }

  handleCallState(event: {
    conversationId: number;
    callId: string;
    state: "ringing" | "connected" | "ended";
    startedAt: string;
    unansweredDeadline?: string;
    reason?: string;
  }) {
    if (this.target?.conversationId !== event.conversationId) return false;
    const startedAt = new Date(event.startedAt).getTime();
    if (event.state === "ended") {
      this.teardown(`call-${event.reason ?? "ended"}`);
      useAppStore.getState().setVoiceSession({
        voiceCallPhase: "ended",
        voiceCallId: event.callId,
        voiceCallStartedAt: Number.isFinite(startedAt) ? startedAt : null,
        voiceCallEndReason: event.reason ?? "ended",
      });
      return true;
    }
    const store = useAppStore.getState();
    store.setVoiceSession({
      voiceCallId: event.callId,
      voiceCallStartedAt: Number.isFinite(startedAt) ? startedAt : null,
      voiceCallDeadlineAt: event.unansweredDeadline
        ? new Date(event.unansweredDeadline).getTime()
        : null,
      voiceCallPhase: event.state,
      voiceConnectionStatus:
        event.state === "connected" ? "connected" : store.voiceConnectionStatus,
      ...(event.state === "connected" && store.voiceCallConnectedAt == null
        ? { voiceCallConnectedAt: Date.now() }
        : {}),
    });
    if (event.state === "connected") this.markMetric("callConnectedAt");
    return true;
  }

  declineCall(conversationId: number) {
    realtime.send({ t: "call:decline", conversationId });
  }

  private startStatsMonitor() {
    if (this.statsTimer) return;
    void this.collectQualityStats();
    this.statsTimer = setInterval(() => {
      void this.collectQualityStats();
    }, 5_000);
  }

  private async collectQualityStats() {
    const samples: VoiceStatsSample[] = [];
    await Promise.all(
      [...this.peers.entries()].map(async ([userId, peer]) => {
        const reports = await peer.pc.getStats();
        let rttMs: number | null = null;
        let candidateType: string | null = null;
        reports.forEach(report => {
          const candidatePair = report as RTCStats & {
            type: string;
            state?: string;
            nominated?: boolean;
            selected?: boolean;
            currentRoundTripTime?: number;
            localCandidateId?: string;
          };
          if (
            candidatePair.type === "candidate-pair" &&
            candidatePair.state === "succeeded" &&
            (candidatePair.nominated || candidatePair.selected)
          ) {
            rttMs =
              candidatePair.currentRoundTripTime == null
                ? null
                : candidatePair.currentRoundTripTime * 1_000;
            const local = candidatePair.localCandidateId
              ? reports.get(candidatePair.localCandidateId)
              : null;
            candidateType =
              (local as (RTCStats & { candidateType?: string }) | undefined)
                ?.candidateType ?? null;
          }
        });
        reports.forEach(report => {
          const inbound = report as RTCStats & {
            type: string;
            kind?: string;
            mediaType?: string;
            jitter?: number;
            packetsLost?: number;
            packetsReceived?: number;
            bytesReceived?: number;
            timestamp: number;
          };
          if (
            inbound.type !== "inbound-rtp" ||
            (inbound.kind ?? inbound.mediaType) !== "audio"
          ) {
            return;
          }
          const previous = this.previousInbound.get(userId);
          const bitrateKbps =
            previous &&
            inbound.bytesReceived != null &&
            inbound.timestamp > previous.timestamp
              ? Math.max(
                  0,
                  ((inbound.bytesReceived - previous.bytesReceived) * 8) /
                    (inbound.timestamp - previous.timestamp)
                )
              : null;
          if (inbound.bytesReceived != null) {
            this.previousInbound.set(userId, {
              bytesReceived: inbound.bytesReceived,
              timestamp: inbound.timestamp,
            });
          }
          samples.push({
            rttMs,
            jitterMs: inbound.jitter == null ? null : inbound.jitter * 1_000,
            packetsLost: Math.max(0, inbound.packetsLost ?? 0),
            packetsReceived: Math.max(0, inbound.packetsReceived ?? 0),
            bitrateKbps,
            candidateType,
          });
        });
      })
    );
    useAppStore
      .getState()
      .setVoiceSession({ voiceQuality: summarizeVoiceQuality(samples) });
  }

  async getDebugStats() {
    const peers = await Promise.all(
      [...this.peers.entries()].map(async ([userId, peer]) => {
        const reports = await peer.pc.getStats();
        const selected: Record<string, unknown>[] = [];
        reports.forEach(report => {
          if (
            [
              "inbound-rtp",
              "outbound-rtp",
              "candidate-pair",
              "remote-inbound-rtp",
            ].includes(report.type)
          ) {
            selected.push(serializeRtcStats(report));
          }
        });
        return {
          userId,
          signalingState: peer.pc.signalingState,
          iceConnectionState: peer.pc.iceConnectionState,
          iceGatheringState: peer.pc.iceGatheringState,
          connectionState: peer.pc.connectionState,
          reports: selected,
        };
      })
    );
    return {
      localMicrophone: useAppStore
        .getState()
        .localStream?.getAudioTracks()
        .map(track => ({
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      peers,
      metrics: this.metrics,
      quality: useAppStore.getState().voiceQuality,
    };
  }

  resumeRemotePlayback() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nexora:resume-voice-playback"));
    }
  }

  async leave() {
    if (this.roomKey) {
      soundManager.play("leave");
      realtime.send({
        t: "voice:leave",
        voiceSessionId: this.voiceSessionId ?? undefined,
      });
    }
    this.teardown("leave");
  }

  cleanupVoiceSession() {
    this.teardown("cleanup");
  }

  private destroyPeer(userId: number) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
    for (const sender of peer.pc.getSenders()) {
      sender.replaceTrack(null).catch(() => {});
    }
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    peer.remoteStream.getTracks().forEach(track => track.stop());
    this.peers.delete(userId);
    useAppStore.getState().setRemoteStream(userId, null);
    useAppStore.getState().setSpeaking(userId, false);
  }

  private teardown(reason: string) {
    if (this.cleaningUp) return;
    this.cleaningUp = true;
    this.joinGeneration += 1;
    this.log("cleanup", reason);
    if (this.reconnectDeadline) clearTimeout(this.reconnectDeadline);
    this.reconnectDeadline = null;
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    this.previousInbound.clear();
    if (this.joinAck) {
      clearTimeout(this.joinAck.timer);
      this.joinAck.reject(new Error("A sessão de voz foi encerrada."));
      this.joinAck = null;
    }
    for (const id of [...this.peers.keys()]) this.destroyPeer(id);

    this.cameraTrack?.stop();
    this.screenTrack?.stop();
    this.screenAudioTrack?.stop();
    this.cameraTrack = null;
    this.screenTrack = null;
    this.screenAudioTrack = null;
    const session = this.audioSession;
    session?.outputStream.getAudioTracks().forEach(track => {
      track.onended = null;
    });
    this.audioSession = null;
    if (session) void session.close();

    const store = useAppStore.getState();
    store.localStream?.getTracks().forEach(track => track.stop());
    Object.values(store.remoteStreams).forEach(stream =>
      stream.getTracks().forEach(track => track.stop())
    );
    store.resetVoice();
    this.roomKey = null;
    this.target = null;
    this.voiceSessionId = null;
    this.myId = 0;
    this.knownParticipantIds.clear();
    this.initialJoinSent = false;
    this.mutedBeforeDeafen = false;
    this.pushToTalkPressed = false;
    this.cleaningUp = false;
  }
}

export const voiceManager = new VoiceManager();
