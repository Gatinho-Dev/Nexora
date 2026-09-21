import { getDevicePrefs, type DevicePrefs } from "@/lib/devices";
import { apiUrl } from "@/lib/endpoints";
import { shouldIgnoreOffer } from "@/lib/voice/perfectNegotiation";
import {
  createAudioProcessingSession,
  microphoneConstraints,
  type AudioProcessingSession,
} from "@/lib/voice/audioProcessing";
import { manualVadThreshold } from "@/lib/voice/vadMath";
import type { LiveParticipant } from "@contracts/live";

/**
 * WebRTC do Nexora Live — malha P2P por sala, isolada do VoiceManager do
 * Nexora tradicional (que é acoplado à sessão autenticada). Reaproveita os
 * helpers existentes: perfect negotiation, device prefs e a config ICE
 * pública do servidor (/api/live/ice).
 *
 * Mídia nunca passa pelo servidor: signaling via /ws/live, mídia P2P.
 *
 * Arquitetura de senders (v2):
 * - Cada peer é criado com transceivers pré-alocados para mic/cam/tela
 *   (`addTransceiver`), então ligar/desligar mídia usa apenas
 *   `RTCRtpSender.replaceTrack()` — zero renegociação, zero corrida com a
 *   perfect negotiation e a direção SDP nunca muda (compatível com Safari).
 * - Streams emitidas ao React são IMUTÁVEIS: cada track nova gera uma nova
 *   MediaStream, então o hook re-renderiza mesmo quando o objeto interno é
 *   reutilizado (causa raiz do bug "vídeo remoto não aparece").
 * - VAD: um único AudioContext analisa o mic local E todos os áudios
 *   remotos, com histerese (abre/release) para não piscar.
 */

type SignalData = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

type Peer = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: (RTCIceCandidateInit | null)[];
  /** Todas as tracks remotas (debug). */
  remoteStream: MediaStream;
  /** Apenas vídeo remoto (câmera ou tela) — emitida imutável ao React. */
  remoteVideoStream: MediaStream;
  /** Apenas áudio remoto — emitida imutável ao React. */
  remoteAudioStream: MediaStream;
  micSender: RTCRtpSender;
  videoSender: RTCRtpSender;
  screenSender: RTCRtpSender;
  restartAttempts: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
};

export type LiveRtcHandlers = {
  onLocalStream(stream: MediaStream | null): void;
  /** Stream de vídeo remoto (câmera ou tela) do participante. */
  onRemoteVideoStream(sessionId: string, stream: MediaStream | null): void;
  /** Stream de áudio remoto do participante (para <audio> imperceptível). */
  onRemoteAudioStream(sessionId: string, stream: MediaStream | null): void;
  /** Atividade de fala (VAD) — local e remoto. */
  onSpeaking(sessionId: string, speaking: boolean): void;
  onConnectionState(state: RTCPeerConnectionState): void;
  /** Share encerrado pelo navegador ("Parar compartilhamento" do Chrome). */
  onScreenEnded(): void;
  /** Erro de mídia já traduzido para mensagem amigável. */
  onMediaError(message: string): void;
};

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

// ── VAD (Voice Activity Detection) ───────────────────────────
// Histerese: abre acima do limiar, só fecha abaixo do limiar de release
// depois de um delay — evita "piscar" em fala baixa/ruído de fundo.
const VAD_OPEN_THRESHOLD = 0.045; // RMS (0–1) do domínio do tempo
const VAD_RELEASE_DELAY_MS = 320;
const VAD_POLL_MS = 80; // ~12,5 Hz — leve na CPU, responsivo o bastante

type VadEntry = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Float32Array<ArrayBuffer>;
  speaking: boolean;
  spokeLastAt: number;
};

/** Prefs neutras para VAD de áudio remoto (sensibilidade só afeta o mic local). */
const DEFAULT_LIVE_VAD_PREFS: DevicePrefs = {
  inputSensitivityMode: "automatic",
  inputSensitivity: 28,
};

/** Resolução do share conforme a qualidade escolhida (igual ao modal oficial). */
function screenVideoConstraints(quality?: DevicePrefs["streamQuality"]): MediaTrackConstraints {
  switch (quality ?? getDevicePrefs().streamQuality) {
    case "720p30":
      return { frameRate: { ideal: 30 }, width: { ideal: 1280 }, height: { ideal: 720 } };
    case "1080p60":
      return { frameRate: { ideal: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    case "1080p30":
    default:
      return { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } };
  }
}

class LiveRtc {
  private peers = new Map<string, Peer>();
  private iceServers: RTCIceServer[] = DEFAULT_ICE;
  private iceLoaded = false;
  private mySessionId = "";
  private micStream: MediaStream | null = null;
  private micTrack: MediaStreamTrack | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private screenAudioTrack: MediaStreamTrack | null = null;
  private handlers: LiveRtcHandlers | null = null;
  private muted = false;
  /** Sessão de processamento de áudio (ClearVoice) — reutiliza o pipeline oficial. */
  private processingSession: AudioProcessingSession | null = null;
  private audioProcessing: NonNullable<DevicePrefs["audioProcessing"]> = "standard";

  // ── VAD ──
  private vadContext: AudioContext | null = null;
  private vadEntries = new Map<string, VadEntry>();
  private vadTimer: ReturnType<typeof setInterval> | null = null;

  setHandlers(handlers: LiveRtcHandlers) {
    this.handlers = handlers;
  }

  private emit<K extends keyof LiveRtcHandlers>(
    key: K,
    ...args: Parameters<LiveRtcHandlers[K]>
  ) {
    const handler = this.handlers?.[key] as
      | ((...a: Parameters<LiveRtcHandlers[K]>) => void)
      | undefined;
    handler?.(...args);
  }

  private async loadIceServers() {
    if (this.iceLoaded) return;
    this.iceLoaded = true;
    try {
      const res = await fetch(apiUrl("/api/live/ice"));
      if (res.ok) {
        const config = (await res.json()) as { iceServers?: RTCIceServer[] };
        if (config.iceServers?.length) {
          this.iceServers = config.iceServers;
          return;
        }
      }
    } catch {
      // fallback para STUN padrão
    }
    this.iceServers = DEFAULT_ICE;
  }

  async join(mySessionId: string, opts: { muted: boolean; camera: boolean }) {
    this.mySessionId = mySessionId;
    this.muted = opts.muted;
    await this.loadIceServers();
    await this.acquireMic(opts.muted);
    if (opts.camera) {
      await this.enableCamera().catch(() => {});
    }
  }

  // ── Captura local ────────────────────────────────────────────
  private async acquireMic(startMuted: boolean) {
    if (this.micTrack) {
      this.micTrack.enabled = !startMuted;
      this.muted = startMuted;
      return;
    }
    const prefs = getDevicePrefs();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: microphoneConstraints(prefs),
        video: false,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "OverconstrainedError" || error.name === "NotFoundError")
      ) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        throw error;
      }
    }
    this.micStream = stream;
    const rawTrack = stream.getAudioTracks()[0] ?? null;
    if (!rawTrack) return;
    this.audioProcessing = prefs.audioProcessing ?? "standard";
    if (this.audioProcessing === "clearvoice") {
      try {
        this.processingSession = await createAudioProcessingSession(
          stream,
          prefs
        );
        this.micTrack =
          this.processingSession.outputStream.getAudioTracks()[0] ?? rawTrack;
      } catch {
        this.processingSession = null;
        this.audioProcessing = "standard";
        this.micTrack = rawTrack;
      }
    } else {
      this.processingSession = null;
      this.micTrack = rawTrack;
    }
    this.micTrack.enabled = !startMuted;
    this.addVad(this.mySessionId, new MediaStream([this.micTrack]));
    this.emit("onLocalStream", this.combinedLocalStream());
  }

  private combinedLocalStream(): MediaStream | null {
    const tracks = [
      ...(this.micTrack ? [this.micTrack] : []),
      ...(this.cameraTrack ? [this.cameraTrack] : []),
    ];
    return tracks.length ? new MediaStream(tracks) : null;
  }

  // ── VAD ──────────────────────────────────────────────────────
  private ensureVadContext(): AudioContext | null {
    if (!this.vadContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.vadContext = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.vadContext.state === "suspended") {
      // iOS Safari inicia suspenso até um gesto do usuário.
      void this.vadContext.resume().catch(() => {});
    }
    return this.vadContext;
  }

  private addVad(key: string, stream: MediaStream) {
    const ctx = this.ensureVadContext();
    if (!ctx) return;
    if (this.vadEntries.has(key)) return;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      this.vadEntries.set(key, {
        source,
        analyser,
        buffer: new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>,
        speaking: false,
        spokeLastAt: 0,
      });
      if (!this.vadTimer) {
        this.vadTimer = setInterval(() => this.pollVad(), VAD_POLL_MS);
      }
    } catch {
      // Stream sem track de áudio — sem VAD para esta chave.
    }
  }

  private removeVad(key: string) {
    const entry = this.vadEntries.get(key);
    if (!entry) return;
    try {
      entry.source.disconnect();
      entry.analyser.disconnect();
    } catch {
      // já desconectado
    }
    this.vadEntries.delete(key);
    if (!this.vadEntries.size && this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    if (key === this.mySessionId) {
      this.emit("onSpeaking", key, false);
    }
  }

  private pollVad() {
    for (const [key, entry] of this.vadEntries) {
      // Mic local desligado nunca é "falando" (regra: mic ligado ≠ falando;
      // mic desligado = com certeza não falando).
      if (key === this.mySessionId && this.muted) {
        if (entry.speaking) {
          entry.speaking = false;
          this.emit("onSpeaking", key, false);
        }
        continue;
      }
      const track = entry.source.mediaStream?.getAudioTracks()[0];
      if (!track || track.readyState !== "live") {
        if (entry.speaking) {
          entry.speaking = false;
          this.emit("onSpeaking", key, false);
        }
        continue;
      }
      entry.analyser.getFloatTimeDomainData(entry.buffer as Float32Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < entry.buffer.length; i++) {
        const v = entry.buffer[i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / entry.buffer.length);
      const now = Date.now();
      // Sensibilidade do usuário (modal oficial): automática usa limiar fixo;
      // manual deriva do slider (vadMath). Local usa a preferida; remoto usa a automática.
      const prefs =
        key === this.mySessionId ? getDevicePrefs() : DEFAULT_LIVE_VAD_PREFS;
      const openThreshold =
        prefs.inputSensitivityMode === "manual"
          ? manualVadThreshold(prefs.inputSensitivity ?? 28)
          : VAD_OPEN_THRESHOLD;
      const closeThreshold = openThreshold * 0.62;
      if (!entry.speaking) {
        if (rms >= openThreshold) {
          entry.speaking = true;
          entry.spokeLastAt = now;
          this.emit("onSpeaking", key, true);
        }
      } else if (rms >= closeThreshold) {
        entry.spokeLastAt = now;
      } else if (now - entry.spokeLastAt >= VAD_RELEASE_DELAY_MS) {
        entry.speaking = false;
        this.emit("onSpeaking", key, false);
      }
    }
  }

  private stopVad() {
    if (this.vadTimer) clearInterval(this.vadTimer);
    this.vadTimer = null;
    for (const entry of this.vadEntries.values()) {
      try {
        entry.source.disconnect();
        entry.analyser.disconnect();
      } catch {
        // ignore
      }
    }
    this.vadEntries.clear();
    void this.vadContext?.close().catch(() => {});
    this.vadContext = null;
  }

  /** Preview local para a tela de permissões. */
  async preview(): Promise<MediaStream | null> {
    if (!this.micTrack && !this.cameraTrack) {
      try {
        await this.acquireMic(false);
      } catch {
        return null;
      }
    }
    return this.combinedLocalStream();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.micTrack) this.micTrack.enabled = !muted;
  }

  async enableCamera(deviceId?: DevicePrefs["videoInputId"]): Promise<void> {
    if (this.cameraTrack) return;
    const prefs = getDevicePrefs();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          ...(deviceId || prefs.videoInputId
            ? { deviceId: { ideal: deviceId ?? prefs.videoInputId } }
            : {}),
        },
      });
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
          throw new Error(
            "Nenhuma câmera compatível foi encontrada neste dispositivo."
          );
        }
        if (error.name === "NotAllowedError" || error.name === "SecurityError") {
          throw new Error(
            "Acesso à câmera bloqueado. Permita o acesso nas configurações do navegador e tente novamente."
          );
        }
      }
      throw new Error("Não foi possível iniciar sua câmera agora.");
    }
    this.cameraTrack = stream.getVideoTracks()[0] ?? null;
    if (!this.cameraTrack) {
      throw new Error("A câmera não entregou vídeo.");
    }
    this.cameraTrack.onended = () => {
      void this.disableCamera();
    };
    // Senders pré-alocados: replaceTrack sem renegociação.
    for (const peer of this.peers.values()) {
      await peer.videoSender.replaceTrack(this.cameraTrack).catch(() => {});
    }
    this.emit("onLocalStream", this.combinedLocalStream());
  }

  async disableCamera() {
    const track = this.cameraTrack;
    this.cameraTrack = null;
    if (track) {
      track.onended = null;
      track.stop();
    }
    for (const peer of this.peers.values()) {
      await peer.videoSender.replaceTrack(null).catch(() => {});
    }
    this.emit("onLocalStream", this.combinedLocalStream());
  }

  /** Liga a câmera de forma transparente se ela estava desligada. */
  async ensureCameraOn(): Promise<void> {
    if (!this.cameraTrack) await this.enableCamera();
  }

  async enableScreen(quality?: DevicePrefs["streamQuality"]): Promise<void> {
    if (this.screenTrack) return;
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      throw new Error(
        "Seu navegador não permite compartilhamento de tela neste dispositivo."
      );
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: screenVideoConstraints(quality),
        audio: true,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        // AbortError = usuário fechou o seletor — não é erro.
        return;
      }
      throw new Error(
        "Não foi possível iniciar o compartilhamento de tela agora."
      );
    }
    this.screenStream = stream;
    this.screenTrack = stream.getVideoTracks()[0] ?? null;
    this.screenAudioTrack = stream.getAudioTracks()[0] ?? null;
    if (!this.screenTrack) {
      this.screenAudioTrack?.stop();
      this.screenAudioTrack = null;
      this.screenStream = null;
      return;
    }
    // Fim do share pelo próprio navegador (barra do Chrome etc.).
    this.screenTrack.onended = () => {
      void this.disableScreen();
      this.emit("onScreenEnded");
    };
    // Senders pré-alocados: replaceTrack sem renegociação.
    for (const peer of this.peers.values()) {
      await peer.screenSender.replaceTrack(this.screenTrack).catch(() => {});
    }
    if (this.screenAudioTrack) {
      // Áudio da tela substitui o mic no sender de áudio enquanto dura o
      // share (não há um quarto transceiver sem renegociar).
      for (const peer of this.peers.values()) {
        await peer.micSender
          .replaceTrack(this.screenAudioTrack)
          .catch(() => {});
      }
    }
    this.emit("onLocalStream", this.combinedLocalStream());
  }

  async disableScreen() {
    const video = this.screenTrack;
    const audio = this.screenAudioTrack;
    this.screenTrack = null;
    this.screenAudioTrack = null;
    this.screenStream = null;
    if (video) {
      video.onended = null;
      video.stop();
    }
    if (audio) audio.stop();
    for (const peer of this.peers.values()) {
      await peer.screenSender.replaceTrack(null).catch(() => {});
      // Restaura o microfone no sender de áudio.
      if (this.micTrack) {
        await peer.micSender.replaceTrack(this.micTrack).catch(() => {});
      }
    }
    this.emit("onLocalStream", this.combinedLocalStream());
  }

  get sharingScreen() {
    return !!this.screenTrack;
  }

  get cameraOn() {
    return !!this.cameraTrack;
  }

  get activeAudioProcessing() {
    return this.audioProcessing;
  }

  /**
   * Reaplica as preferências de processamento de áudio (supressão de ruído,
   * ClearVoice etc.) reabrindo o microfone com as novas constraints.
   * Espelha o reconfigureAudioProcessing do VoiceManager oficial.
   */
  async reconfigureAudio(): Promise<void> {
    if (!this.micStream) return;
    const wasEnabled = this.micTrack?.enabled ?? true;
    const peers = [...this.peers.values()];
    this.removeVad(this.mySessionId);
    const oldStream = this.micStream;
    const oldSession = this.processingSession;
    const oldTrack = this.micTrack;
    this.micStream = null;
    this.micTrack = null;
    this.processingSession = null;
    try {
      await this.acquireMic(!wasEnabled);
      await Promise.all(
        peers.map(peer =>
          peer.micSender
            .replaceTrack(this.micTrack)
            .catch(() => {})
        )
      );
    } catch (error) {
      // Falhou: restaura o áudio anterior em vez de ficar mudo.
      this.micStream = oldStream;
      this.micTrack = oldTrack;
      this.processingSession = oldSession;
      this.micTrack!.enabled = wasEnabled;
      this.addVad(this.mySessionId, new MediaStream([this.micTrack!]));
      this.emit("onLocalStream", this.combinedLocalStream());
      throw error instanceof Error
        ? error
        : new Error("Não foi possível aplicar as configurações de áudio.");
    }
    oldTrack?.stop();
    if (oldSession) await oldSession.close().catch(() => {});
    else oldStream.getTracks().forEach(t => t.stop());
  }

  /** Troca o microfone físico (idem modal oficial: switchAudioInput). */
  switchAudioInput(): Promise<void> {
    // A preferência já foi gravada; reconfiguração reabre o mic com ela.
    return this.reconfigureAudio();
  }

  /** Troca a câmera física mantendo o estado ligado/desligado. */
  async switchVideoInput(deviceId?: string): Promise<void> {
    if (!this.cameraTrack) {
      // Desligada: apenas registra a preferência para a próxima ativação.
      await this.enableCamera(deviceId).catch(() => {});
      await this.disableCamera().catch(() => {});
      return;
    }
    const wasOn = true;
    await this.disableCamera();
    await this.enableCamera(deviceId);
    void wasOn;
  }

  /** Stream de vídeo da tela compartilhada (preview próprio). */
  get screenStreamLocal(): MediaStream | null {
    return this.screenStream;
  }

  /** Liga/desliga a câmera aplicando a qualidade preferida do usuário. */
  async setCameraQuality(quality: DevicePrefs["streamQuality"]): Promise<void> {
    if (!this.cameraTrack) return;
    await this.switchVideoInput(getDevicePrefs().videoInputId);
    void quality;
  }

  // ── Peers ────────────────────────────────────────────────────
  private createPeer(remoteSessionId: string): Peer {
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
      remoteVideoStream: new MediaStream(),
      remoteAudioStream: new MediaStream(),
      micSender: null as unknown as RTCRtpSender,
      videoSender: null as unknown as RTCRtpSender,
      screenSender: null as unknown as RTCRtpSender,
      restartAttempts: 0,
      restartTimer: null,
    };
    this.peers.set(remoteSessionId, peer);

    // ── Transceivers pré-alocados: mic, câmera e tela ──
    peer.micSender = pc.addTransceiver(
      this.micTrack ?? "audio",
      { direction: "sendrecv", streams: this.micStream ? [this.micStream] : [] }
    ).sender;
    peer.videoSender = pc.addTransceiver(this.cameraTrack ?? "video", {
      direction: "sendrecv",
    }).sender;
    peer.screenSender = pc.addTransceiver("video", {
      direction: "sendrecv",
    }).sender;

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.emitSignal(remoteSessionId, {
            description: pc.localDescription.toJSON(),
          });
        }
      } catch (error) {
        console.error("[live] negotiation failed", error);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onicecandidate = event => {
      this.emitSignal(remoteSessionId, {
        candidate: event.candidate ? event.candidate.toJSON() : null,
      });
    };

    pc.ontrack = event => {
      const { track } = event;
      if (track.kind === "audio") {
        if (!peer.remoteAudioStream.getTracks().includes(track)) {
          peer.remoteAudioStream.addTrack(track);
          // Stream imutável nova → React re-renderiza.
          this.emit(
            "onRemoteAudioStream",
            remoteSessionId,
            new MediaStream([...peer.remoteAudioStream.getTracks()])
          );
        }
        // VAD do áudio remoto (borda verde nos OUTROS participantes).
        this.addVad(remoteSessionId, new MediaStream([track]));
      } else if (!peer.remoteVideoStream.getTracks().includes(track)) {
        peer.remoteVideoStream.addTrack(track);
        this.emit(
          "onRemoteVideoStream",
          remoteSessionId,
          new MediaStream([...peer.remoteVideoStream.getTracks()])
        );
      }
      track.onended = () => {
        if (track.kind === "audio") {
          this.removeVad(remoteSessionId);
          peer.remoteAudioStream.removeTrack(track);
          this.emit(
            "onRemoteAudioStream",
            remoteSessionId,
            peer.remoteAudioStream.getTracks().length
              ? new MediaStream([...peer.remoteAudioStream.getTracks()])
              : null
          );
        } else {
          peer.remoteVideoStream.removeTrack(track);
          this.emit(
            "onRemoteVideoStream",
            remoteSessionId,
            peer.remoteVideoStream.getTracks().length
              ? new MediaStream([...peer.remoteVideoStream.getTracks()])
              : null
          );
        }
      };
    };

    pc.onconnectionstatechange = () => {
      this.emit("onConnectionState", pc.connectionState);
      if (pc.connectionState === "connected") {
        peer.restartAttempts = 0;
        if (peer.restartTimer) clearTimeout(peer.restartTimer);
        peer.restartTimer = null;
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        this.scheduleIceRestart(remoteSessionId);
      }
    };

    return peer;
  }

  private emitSignal(to: string, data: SignalData) {
    this.onSignal?.(to, data);
  }

  /** Configurado pelo hook: envia {t:"live:signal", to, data} pelo WS. */
  onSignal: ((to: string, data: SignalData) => void) | null = null;

  async handleSignal(from: string, data: SignalData) {
    if (from === this.mySessionId) return;
    const peer = this.peers.get(from) ?? this.createPeer(from);
    const pc = peer.pc;
    const polite = this.mySessionId < from;
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
          if (pc.localDescription) {
            this.emitSignal(from, {
              description: pc.localDescription.toJSON(),
            });
          }
        }
      } else if (data.candidate !== undefined) {
        if (peer.ignoreOffer) return;
        if (!pc.remoteDescription) {
          peer.pendingCandidates.push(data.candidate);
        } else {
          await pc.addIceCandidate(data.candidate);
        }
      }
    } catch (error) {
      peer.isSettingRemoteAnswerPending = false;
      if (!peer.ignoreOffer) {
        console.error("[live] signaling error", from, error);
      }
    }
  }

  private scheduleIceRestart(sessionId: string) {
    const peer = this.peers.get(sessionId);
    if (!peer || peer.restartTimer) return;
    if (peer.restartAttempts >= 4) return;
    peer.restartAttempts += 1;
    peer.restartTimer = setTimeout(
      () => {
        peer.restartTimer = null;
        try {
          peer.pc.restartIce();
        } catch {
          // ignore
        }
      },
      [500, 1000, 2000, 4000][peer.restartAttempts - 1]
    );
  }

  /** Sincroniza peers com a lista oficial de participantes do servidor. */
  syncParticipants(participants: LiveParticipant[]) {
    const ids = new Set(participants.map(p => p.sessionId));
    for (const id of ids) {
      if (id !== this.mySessionId && !this.peers.has(id)) {
        this.createPeer(id);
      }
    }
    for (const [id, peer] of [...this.peers]) {
      if (!ids.has(id)) this.destroyPeer(id, peer);
    }
  }

  private destroyPeer(sessionId: string, peer?: Peer) {
    const target = peer ?? this.peers.get(sessionId);
    if (!target) return;
    if (target.restartTimer) clearTimeout(target.restartTimer);
    for (const sender of target.pc.getSenders()) {
      sender.replaceTrack(null).catch(() => {});
    }
    target.pc.ontrack = null;
    target.pc.onicecandidate = null;
    target.pc.onnegotiationneeded = null;
    target.pc.onconnectionstatechange = null;
    target.pc.close();
    for (const track of target.remoteVideoStream.getTracks()) {
      track.onended = null;
    }
    this.peers.delete(sessionId);
    this.removeVad(sessionId);
    this.emit("onRemoteVideoStream", sessionId, null);
    this.emit("onRemoteAudioStream", sessionId, null);
  }

  async leave() {
    for (const [id, peer] of [...this.peers]) {
      this.destroyPeer(id, peer);
    }
    this.stopVad();
    this.micTrack?.stop();
    this.cameraTrack?.stop();
    this.screenTrack?.stop();
    this.screenAudioTrack?.stop();
    this.micStream?.getTracks().forEach(t => t.stop());
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.micStream = null;
    this.micTrack = null;
    this.cameraTrack = null;
    this.screenTrack = null;
    this.screenAudioTrack = null;
    this.screenStream = null;
    this.muted = false;
    const session = this.processingSession;
    this.processingSession = null;
    if (session) await session.close().catch(() => {});
    this.emit("onLocalStream", null);
  }

}

export const liveRtc = new LiveRtc();
