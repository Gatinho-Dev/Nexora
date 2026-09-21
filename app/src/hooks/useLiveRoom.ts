import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LiveChatMessage,
  LiveDenyReason,
  LiveJoinPayload,
  LiveParticipant,
  WSLiveServerEvent,
} from "@contracts/live";
import {
  loadIdentity,
  updateIdentity,
  ensureSessionId,
} from "@/lib/live/identity";
import { liveSocket } from "@/lib/live/ws";
import { liveRtc } from "@/lib/live/rtc";

/**
 * Hook central da sala Nexora Live: junta WS, estado de participantes,
 * chat e WebRTC em um único contrato para as páginas.
 */

export type LiveRoomStatus =
  | "idle"
  | "connecting"
  | "joined"
  | "denied"
  | "ended"
  | "reconnecting"
  | "offline";

export type LiveDenyState = {
  reason: LiveDenyReason;
  message: string;
} | null;

export type UseLiveRoomResult = {
  status: LiveRoomStatus;
  deny: LiveDenyState;
  you: LiveParticipant | null;
  participants: LiveParticipant[];
  chat: LiveChatMessage[];
  amHost: boolean;
  maxParticipants: number;
  /** Nome definido pelo criador (null = exibir "Sala {código}"). */
  roomName: string | null;
  /** Stream local (mic+cam) para preview/cards. */
  localStream: MediaStream | null;
  /** Vídeo remoto por sessionId (câmera ou tela). */
  remoteVideoStreams: Record<string, MediaStream>;
  /** Áudio remoto por sessionId — renderize em <audio> imperceptível. */
  remoteAudioStreams: Record<string, MediaStream>;
  /** SessionIds que estão falando AGORA (VAD real). */
  speaking: Record<string, boolean>;
  rtcState: RTCPeerConnectionState;
  join(opts: { code: string; nickname: string; hostToken?: string }): void;
  leave(): void;
  sendChat(content: string): void;
  kick(sessionId: string): void;
  endRoom(): void;
  setMediaState(patch: { muted?: boolean; camera?: boolean; screen?: boolean }): void;
  connectionStatus: typeof liveSocket.status;
  /** Erro de mídia já amigável (permissões etc.). */
  mediaError: string | null;
  clearMediaError(): void;
  /** Incrementa quando o navegador encerra o share por fora. */
  screenEndedSignal: number;
  // ── Mobile Camera ──
  /** Preview do vídeo/áudio do celular pareado (quando conectado). */
  companionStream: MediaStream | null;
  /** Estado do pareamento/celular. */
  companionState: {
    connected: boolean;
    cameraActive: boolean;
    requestPending: boolean;
    sessionId: string | null;
    code: string | null;
  };
  startCompanionPairing(): void;
  approveCompanion(sessionId: string): void;
  rejectCompanion(sessionId: string): void;
  stopCompanion(sessionId: string): void;
  setLiveCameraSource(source: "local" | "companion"): void;
};

export function useLiveRoom(): UseLiveRoomResult {
  const [status, setStatus] = useState<LiveRoomStatus>("idle");
  const [deny, setDeny] = useState<LiveDenyState>(null);
  const [you, setYou] = useState<LiveParticipant | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [chat, setChat] = useState<LiveChatMessage[]>([]);
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<typeof liveSocket.status>("closed");

  const payloadRef = useRef<LiveJoinPayload | null>(null);
  const joinReqRef = useRef<{
    code: string;
    nickname: string;
    hostToken?: string;
  } | null>(null);
  const mySessionIdRef = useRef<string>("");

  // Estado de mídia local espelhado para o servidor (muted/camera/screen).
  const mediaStateRef = useRef({ muted: false, camera: false, screen: false });
  /** false no primeiro join; true preserva estado na reconexão. */
  const mediaStateRestoredRef = useRef(false);

  const sendState = useCallback(() => {
    liveSocket.send({ t: "live:state", ...mediaStateRef.current });
  }, []);

  // ── Mobile Camera (celular pareado) ────────────
  // Declarado antes dos handlers de WS porque eles o utilizam.
  const [companionStream, setCompanionStream] = useState<MediaStream | null>(null);
  const [companionState, setCompanionState] = useState<{
    connected: boolean;
    cameraActive: boolean;
    requestPending: boolean;
    sessionId: string | null;
    code: string | null;
  }>({
    connected: false,
    cameraActive: false,
    requestPending: false,
    sessionId: null,
    code: null,
  });

  // ── Handlers de eventos do servidor ─────────────────────────
  useEffect(() => {
    const off = liveSocket.on((event: WSLiveServerEvent) => {
      switch (event.t) {
        case "live:joined": {
          payloadRef.current = event.payload;
          updateIdentity({ sessionToken: event.payload.sessionToken });
          setYou(event.payload.you);
          setParticipants(event.payload.participants);
          setChat(event.payload.chat);
          setMaxParticipants(event.payload.maxParticipants);
          setRoomName(event.payload.roomName ?? null);
          setStatus("joined");
          if (!mediaStateRestoredRef.current) {
            mediaStateRef.current = { muted: false, camera: false, screen: false };
            mediaStateRestoredRef.current = true;
          }
          // WebRTC: prepara mídia local e sincroniza peers.
          void liveRtc
            .join(event.payload.you.sessionId, {
              muted: mediaStateRef.current.muted,
              camera: mediaStateRef.current.camera,
            })
            .then(() => {
              if (mediaStateRef.current.camera) {
                return liveRtc.enableCamera();
              }
            })
            .then(() => liveRtc.syncParticipants(event.payload.participants))
            .then(sendState)
            .catch(() => {
              // Sem mic: entra mesmo assim (modo ouvinte) — a UI mostra erro.
              liveRtc.syncParticipants(event.payload.participants);
              sendState();
            });
          break;
        }
        case "live:participants": {
          setParticipants(event.participants);
          const me = event.participants.find(
            p => p.sessionId === mySessionIdRef.current
          );
          if (me) setYou(me);
          void liveRtc.syncParticipants(event.participants);
          break;
        }
        case "live:host": {
          setParticipants(prev =>
            prev.map(p => ({
              ...p,
              isHost: p.sessionId === event.hostSessionId,
            }))
          );
          setYou(prev =>
            prev && prev.sessionId === event.hostSessionId
              ? { ...prev, isHost: true }
              : prev
          );
          break;
        }
        case "live:chat": {
          setChat(prev => [...prev, event.message].slice(-200));
          break;
        }
        case "live:signal": {
          void liveRtc.handleSignal(
            event.from,
            event.data as Parameters<typeof liveRtc.handleSignal>[1]
          );
          break;
        }
        case "live:kicked": {
          setStatus("denied");
          setDeny({
            reason: "room-unavailable",
            message: "Você foi removido da sala pelo host.",
          });
          void liveRtc.leave();
          break;
        }
        case "live:ended": {
          setStatus("ended");
          void liveRtc.leave();
          break;
        }
        case "live:denied": {
          setStatus("denied");
          setDeny({ reason: event.reason, message: event.message });
          break;
        }
        // ── Mobile Camera ──
        case "live-companion:session": {
          setCompanionState(prev => ({
            ...prev,
            sessionId: event.sessionId,
            code: event.code,
          }));
          break;
        }
        case "live-companion:request": {
          setCompanionState(prev => ({ ...prev, requestPending: true }));
          break;
        }
        case "live-companion:signal": {
          void liveRtc.handleCompanionSignal(
            event.data as Parameters<typeof liveRtc.handleCompanionSignal>[0]
          );
          break;
        }
        case "live-companion:control": {
          // Controles de estado que não passam pelo RTC (track mute).
          if (event.action === "camera-on" || event.action === "camera-off") {
            setCompanionState(prev => ({
              ...prev,
              cameraActive: event.action === "camera-on",
            }));
          }
          if (event.action === "disconnect") {
            // O celular se desconectou por vontade própria.
            liveRtc.teardownCompanionPeer();
            setCompanionState(prev => ({
              ...prev,
              connected: false,
              cameraActive: false,
              requestPending: false,
              sessionId: null,
              code: null,
            }));
          }
          break;
        }
        case "live-companion:disconnected": {
          liveRtc.teardownCompanionPeer();
          setCompanionState(prev => ({
            ...prev,
            connected: false,
            cameraActive: false,
            requestPending: false,
            sessionId: null,
            code: null,
          }));
          break;
        }
      }
    });
    return () => {
      off();
    };
  }, [sendState]);  

  // ── Mídia local: stream e falas (VAD) ───────────────────────
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [rtcState, setRtcState] = useState<RTCPeerConnectionState>("new");

  const [remoteVideoStreams, setRemoteVideoStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [screenEndedSignal, setScreenEndedSignal] = useState(0);

  useEffect(() => {
    liveRtc.setHandlers({
      onLocalStream: stream => setLocalStream(stream),
      onRemoteVideoStream: (sessionId, stream) => {
        setRemoteVideoStreams(prev => {
          if (stream) return { ...prev, [sessionId]: stream };
          if (!(sessionId in prev)) return prev;
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
      },
      onRemoteAudioStream: (sessionId, stream) => {
        setRemoteAudioStreams(prev => {
          if (stream) return { ...prev, [sessionId]: stream };
          if (!(sessionId in prev) && stream === null) return prev;
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
      },
      onSpeaking: (sessionId, isSpeaking) => {
        setSpeaking(prev =>
          prev[sessionId] === isSpeaking
            ? prev
            : { ...prev, [sessionId]: isSpeaking }
        );
      },
      onConnectionState: state => setRtcState(state),
      onScreenEnded: () => setScreenEndedSignal(n => n + 1),
      onMediaError: message => setMediaError(message),
      onCompanionStream: stream => setCompanionStream(stream),
      onCompanionSignal: data => {
        liveSocket.send({ t: "live-companion:signal", data });
      },
      onCompanionState: state => {
        setCompanionState(prev => ({
          ...prev,
          ...(state.connected !== undefined ? { connected: state.connected } : {}),
          ...(state.cameraActive !== undefined
            ? { cameraActive: state.cameraActive }
            : {}),
        }));
      },
      onCompanionCameraState: active => {
        setCompanionState(prev => ({ ...prev, cameraActive: active }));
      },
    });
    liveRtc.onSignal = (to, data) => {
      liveSocket.send({ t: "live:signal", to, data });
    };
    // setCompanionState/setCompanionStream são setters estáveis.
     
  }, []);

  // ── Ações ───────────────────────────────────────────────────
  const join = useCallback(
    (opts: { code: string; nickname: string; hostToken?: string }) => {
      joinReqRef.current = opts;
      const sessionId = ensureSessionId();
      mySessionIdRef.current = sessionId;
      setStatus("connecting");
      setDeny(null);
      setMediaError(null);
      liveSocket.connect();
      // Envia o join quando o socket abrir (com teto de tentativas).
      let attempts = 0;
      const trySend = () => {
        if (joinReqRef.current !== opts) return; // join substituído ou saída
        const identity = loadIdentity();
        const sent = liveSocket.send({
          t: "live:join",
          code: opts.code,
          sessionId,
          nickname: opts.nickname,
          sessionToken: identity?.sessionToken || undefined,
          hostToken: opts.hostToken || identity?.hostToken || undefined,
        });
        if (!sent && ++attempts < 50) {
          setTimeout(trySend, 200);
        }
      };
      setTimeout(trySend, 0);
    },
    []
  );

  const leave = useCallback(() => {
    joinReqRef.current = null;
    liveSocket.send({ t: "live:leave" });
    void liveRtc.leave();
    liveSocket.close();
    setStatus("idle");
    setParticipants([]);
    setChat([]);
    setYou(null);
    setSpeaking({});
    setRemoteVideoStreams({});
    setRemoteAudioStreams({});
    setMediaError(null);
    mediaStateRef.current = { muted: false, camera: false, screen: false };
    payloadRef.current = null;
    liveRtc.teardownCompanionPeer();
    setCompanionState({
      connected: false,
      cameraActive: false,
      requestPending: false,
      sessionId: null,
      code: null,
    });
    // setCompanionState é setter estável.
     
  }, []);

  const sendChat = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    liveSocket.send({ t: "live:chat", content: trimmed });
  }, []);

  const kick = useCallback((sessionId: string) => {
    liveSocket.send({ t: "live:kick", sessionId });
  }, []);

  const endRoom = useCallback(() => {
    liveSocket.send({ t: "live:end" });
  }, []);

  const setMediaState = useCallback(
    (patch: { muted?: boolean; camera?: boolean; screen?: boolean }) => {
      mediaStateRef.current = { ...mediaStateRef.current, ...patch };
      sendState();
    },
    [sendState]
  );

  // ── Ações da Mobile Camera ─────────────────────────
  const startCompanionPairing = useCallback(() => {
    liveSocket.send({ t: "live-companion:start" });
  }, []);

  const approveCompanion = useCallback((sessionId: string) => {
    liveSocket.send({ t: "live-companion:approve", sessionId });
    setCompanionState(prev => ({ ...prev, requestPending: false }));
     
  }, []);

  const rejectCompanion = useCallback((sessionId: string) => {
    liveSocket.send({ t: "live-companion:reject", sessionId });
    setCompanionState(prev => ({ ...prev, requestPending: false }));
     
  }, []);

  const stopCompanion = useCallback((sessionId: string) => {
    liveSocket.send({ t: "live-companion:stop", sessionId });
    setCompanionState(prev => ({
      ...prev,
      connected: false,
      requestPending: false,
      sessionId: null,
      code: null,
    }));
     
  }, []);

  const setLiveCameraSource = useCallback((source: "local" | "companion") => {
    void liveRtc.setCameraSource(source);
  }, []);

  // Pendência de rejoin: marcada fora do render (callback de status).
  const reconnectPendingRef = useRef(false);

  // Reconexão automática: quando o WS volta após queda, religa a sala.
  useEffect(() => {
    if (
      connectionStatus === "open" &&
      status === "joined" &&
      reconnectPendingRef.current
    ) {
      reconnectPendingRef.current = false;
      const req = joinReqRef.current;
      const sessionId = mySessionIdRef.current;
      const identity = loadIdentity();
      if (req && sessionId) {
        liveSocket.send({
          t: "live:join",
          code: req.code,
          sessionId,
          nickname: req.nickname,
          sessionToken: identity?.sessionToken || undefined,
          hostToken: req.hostToken || identity?.hostToken || undefined,
        });
      }
    }
  }, [connectionStatus, status]);

  const handleStatusChange = useCallback((s: typeof liveSocket.status) => {
    if (s === "reconnecting") reconnectPendingRef.current = true;
  }, []);
  useEffect(() => {
    liveSocket.onStatusChange = s => {
      handleStatusChange(s);
      setConnectionStatus(s);
    };
    return () => {
      liveSocket.onStatusChange = null;
    };
  }, [handleStatusChange]);

  // "reconnecting" é derivado (não é state): evita cascata de renders.
  const effectiveStatus: LiveRoomStatus =
    status === "joined" &&
    (connectionStatus === "reconnecting" || connectionStatus === "connecting")
      ? "reconnecting"
      : status;

  return {
    status: effectiveStatus,
    deny,
    you,
    participants,
    chat,
    amHost: !!you?.isHost,
    maxParticipants,
    roomName,
    localStream,
    remoteVideoStreams,
    remoteAudioStreams,
    speaking,
    rtcState,
    join,
    leave,
    sendChat,
    kick,
    endRoom,
    setMediaState,
    connectionStatus,
    mediaError,
    clearMediaError: () => setMediaError(null),
    screenEndedSignal,
    // Mobile Camera
    companionStream,
    companionState,
    startCompanionPairing,
    approveCompanion,
    rejectCompanion,
    stopCompanion,
    setLiveCameraSource,
  };
}
