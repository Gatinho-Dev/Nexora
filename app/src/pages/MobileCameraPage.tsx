import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { websocketUrl } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  Smartphone,
  SwitchCamera,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import { NexoraAppIcon } from "@/components/NexoraBrand";

/**
 * Nexora Mobile Camera — página do celular para o Nexora Live.
 *
 * O celular escaneia o QR exibido no PC (rota /mobile-camera?code=…),
 * pareia via /ws/live-companion e transmite câmera/mic P2P para o
 * participante do Live. Sem login: o código é temporário, de uso único
 * e ainda precisa ser aprovado pelo dono no computador.
 */

type Phase =
  | "idle"
  | "connecting"
  | "pending"
  | "ready"
  | "reconnecting"
  | "disconnected"
  | "ended"
  | "error";

type FacingMode = "user" | "environment";

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};

export default function MobileCameraPage() {
  const [searchParams] = useSearchParams();
  const urlCode = searchParams.get("code") ?? "";
  /** Código ativo em ref: os closures do WebRTC rodam antes do re-render
   *  quando o usuário digita o código no input (setActiveCode é async), e
   *  enviar signaling com code="" faz o gateway descartar em silêncio. */
  const codeRef = useRef(urlCode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<FacingMode>("user");
  const finishedRef = useRef(false);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Referência estável ao start (usado pela reconexão interna). */
  const startRef = useRef<(code: string, isReconnect?: boolean) => Promise<void>>(
    async () => {}
  );
  /** Candidatos ICE que chegarem antes do remote description. */
  const pendingCandidatesRef = useRef<(RTCIceCandidateInit | null)[]>([]);
  /** True quando a prévia local está montada com stream. */
  const [hasPreview, setHasPreview] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<FacingMode>("user");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ── WebRTC ───────────────────────────────────────────────────
  const ensurePeer = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 4,
    });
    pcRef.current = pc;

    pc.onicecandidate = event => {
      send({
        t: "companion:signal",
        code: codeRef.current,
        data: { candidate: event.candidate ? event.candidate.toJSON() : null },
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        attemptsRef.current = 0;
        setPhase("ready");
      }
      if (pc.connectionState === "failed") {
        setPhase("error");
        setErrorMsg("A conexão com a sala falhou.");
      }
    };

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }
    return pc;
  }, [send]);

  const handleSignal = useCallback(
    async (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const msg = data as {
        description?: RTCSessionDescriptionInit;
        candidate?: unknown;
      };
      try {
        const pc = ensurePeer();
        if (msg.description) {
          // Este lado é o OFERENTE (createOffer após o pareamento), então a
          // answer chega em "have-local-offer" — o guard de "stable" a
          // descartava e a conexão nunca completava. Rollback implícito
          // resolve o caso raro de um offer inesperado em "have-remote-offer".
          if (
            pc.signalingState === "have-remote-offer" &&
            msg.description.type === "offer"
          ) {
            await pc.setRemoteDescription({ type: "rollback" });
          }
          await pc.setRemoteDescription(msg.description);
          while (pendingCandidatesRef.current.length) {
            await pc.addIceCandidate(
              pendingCandidatesRef.current.shift() ?? null
            );
          }
        } else if (msg.candidate !== undefined) {
          const candidate = msg.candidate as RTCIceCandidateInit | null;
          if (!pc.remoteDescription) {
            pendingCandidatesRef.current.push(candidate);
          } else {
            await pc.addIceCandidate(candidate);
          }
        }
      } catch (error) {
        console.error("[MOBILE-LIVE] Falha no signaling", error);
        setPhase("error");
        setErrorMsg("Não foi possível conectar à sala.");
      }
    },
    [ensurePeer, send]
  );

  const createOffer = useCallback(() => {
    void (async () => {
      try {
        const pc = ensurePeer();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({
          t: "companion:signal",
          code: codeRef.current,
          data: { description: pc.localDescription?.toJSON() },
        });
      } catch (error) {
        console.error("[MOBILE-LIVE] Falha ao criar oferta", error);
        setPhase("error");
        setErrorMsg("Não foi possível iniciar a câmera.");
      }
    })();    },
    [ensurePeer, send]
  );

  // ── Cleanup ──────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    finishedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setHasPreview(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // ── Conexão ──────────────────────────────────────────────────
  const start = useCallback(
    async (codeToPair: string, isReconnect = false) => {
      setErrorMsg(null);
      finishedRef.current = false;
      if (!codeToPair) {
        setPhase("error");
        setErrorMsg("Falta o código de pareamento na URL.");
        return;
      }      if (!isReconnect) {
        setPhase("connecting");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { ...VIDEO_CONSTRAINTS, facingMode: facingRef.current },
          });
          streamRef.current = stream;
          setHasPreview(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().catch(() => {});
          }
        } catch {
          setPhase("error");
          setErrorMsg(
            "Permissão de câmera necessária. Permita o acesso nas configurações do navegador e tente novamente."
          );
          return;
        }
      } else {
        pcRef.current?.close();
        pcRef.current = null;
      }
      pendingCandidatesRef.current = [];

      const ws = new WebSocket(websocketUrl("/ws/live-companion"));
      wsRef.current = ws;

      ws.onopen = () => {
        send({ t: "pair", code: codeToPair });
      };

      ws.onmessage = event => {
        let msg: unknown;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        const m = msg as { t?: string; message?: string };
        switch (m.t) {
          case "paired":
            attemptsRef.current = 0;
            setPhase("connecting");
            createOffer();
            break;
          case "companion:pending":
            setPhase("pending");
            break;
          case "companion:signal":
            void handleSignal((msg as { data?: unknown }).data);
            break;
          case "companion:error":
            finishedRef.current = true;
            setPhase("error");
            setErrorMsg(m.message ?? "Erro ao parear o dispositivo.");
            break;
          default:
            break;
        }
      };

      ws.onclose = event => {
        wsRef.current = null;
        if (finishedRef.current) return;
        if (event.code === 4000) {
          // Recusado pelo dono ou desconectado por ele.
          setPhase("error");
          setErrorMsg("A conexão foi recusada ou encerrada no computador.");
          return;
        }
        if (attemptsRef.current < 5) {
          attemptsRef.current += 1;
          setPhase("reconnecting");
          reconnectTimerRef.current = setTimeout(
            () => void startRef.current(codeToPair, true),
            1500 * attemptsRef.current
          );
          return;
        }
        setPhase("error");
        setErrorMsg("A conexão foi perdida. Verifique sua internet.");
      };

      ws.onerror = () => {
        // onclose cuida da reconexão.
      };
    },
    [send, createOffer, handleSignal]
  );

  // Mantém o startRef sincronizado com o start real.
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // ── Controles ────────────────────────────────────────────────
  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    send({
      t: "companion:control",
      code: codeRef.current,
      action: track.enabled ? "mic-on" : "mic-off",
    });
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
    send({
      t: "companion:control",
      code: codeRef.current,
      action: track.enabled ? "camera-on" : "camera-off",
    });
  }

  async function flipCamera() {
    const stream = streamRef.current;
    if (!stream) return;
    const next: FacingMode =
      facingRef.current === "user" ? "environment" : "user";
    let newStream: MediaStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...VIDEO_CONSTRAINTS, facingMode: { ideal: next } },
      });
    } catch {
      return; // sem segunda câmera — mantém a atual
    }
    const newTrack = newStream.getVideoTracks()[0];
    const oldTrack = stream.getVideoTracks()[0];
    if (!newTrack) {
      newStream.getTracks().forEach(t => t.stop());
      return;
    }
    newTrack.enabled = camOn;
    facingRef.current = next;
    setFacing(next);

    for (const sender of pcRef.current?.getSenders() ?? []) {
      if (sender.track?.kind === "video") {
        await sender.replaceTrack(newTrack).catch(() => {});
      }
    }
    oldTrack?.stop();
    stream.removeTrack(oldTrack);
    stream.addTrack(newTrack);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {});
    }
  }

  function disconnect() {
    send({ t: "companion:control", code: codeRef.current, action: "disconnect" });
    setConfirmLeave(false);
    cleanup();
    setPhase("disconnected");
  }

  const transmitting = phase === "ready" || phase === "connecting";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#1e1f22] text-white">
      {transmitting && (
        <>
          <header className="flex items-center gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                phase === "ready" ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
            <p className="text-sm font-semibold">
              {phase === "ready"
                ? "Nexora Live • Câmera conectada"
                : "Conectando…"}
            </p>
          </header>
          <div className="relative min-h-0 flex-1 px-3">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full rounded-2xl border border-white/10 bg-black object-cover",
                facing === "user" && camOn && "-scale-x-100"
              )}
            />
            {!camOn && (
              <div className="absolute inset-3 flex items-center justify-center rounded-2xl bg-black/70">
                <div className="flex flex-col items-center gap-2">
                  <VideoOff className="h-10 w-10 text-white/40" />
                  <p className="text-sm text-white/60">Câmera desligada</p>
                </div>
              </div>
            )}
          </div>
          <footer className="pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-3xl border border-white/10 bg-black/40 p-2 backdrop-blur">
              <ControlButton
                active={micOn}
                label={micOn ? "Microfone ligado" : "Microfone desligado"}
                onClick={toggleMic}
              >
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </ControlButton>
              <ControlButton
                active={camOn}
                label={camOn ? "Câmera ligada" : "Câmera desligada"}
                onClick={toggleCam}
              >
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </ControlButton>
              <ControlButton
                active={false}
                label="Virar câmera"
                onClick={() => void flipCamera()}
              >
                <SwitchCamera className="h-5 w-5" />
              </ControlButton>
              <ControlButton
                active={false}
                label="Desconectar"
                danger
                onClick={() => setConfirmLeave(true)}
              >
                <PhoneOff className="h-5 w-5" />
              </ControlButton>
            </div>
          </footer>

          {confirmLeave && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#2b2d31] p-5 text-center">
                <h2 className="text-base font-bold">Desconectar câmera?</h2>
                <p className="mt-1 text-sm text-white/60">
                  A sala continua ativa no seu computador — só este celular para
                  de transmitir.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={disconnect}>
                    Desconectar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {phase === "idle" && (
        <IdleScreen
          initialCode={urlCode}
          onStart={c => {
            codeRef.current = c;
            void start(c);
          }}
        />
      )}
      {phase === "pending" && (
        <PhaseScreen
          icon={<Loader2 className="h-10 w-10 animate-spin text-[#5865F2]" />}
          title="Aguardando aprovação…"
          description="Toque em “Permitir” no computador para conectar este celular à sala."
        />
      )}
      {phase === "connecting" && !hasPreview && (
        <PhaseScreen
          icon={<Loader2 className="h-10 w-10 animate-spin text-[#5865F2]" />}
          title="Conectando ao Nexora Live…"
          description="Solicitando acesso à câmera e pareando com a sala."
        />
      )}
      {phase === "reconnecting" && (
        <PhaseScreen
          icon={<Loader2 className="h-10 w-10 animate-spin text-amber-400" />}
          title="Reconectando…"
          description="A conexão caiu por um instante. Voltando para a sala."
        />
      )}
      {phase === "disconnected" && (
        <PhaseScreen
          icon={<CheckCircle2 className="h-10 w-10 text-white/50" />}
          title="Celular desconectado"
          description="Escaneie o QR code novamente para reconectar."
          action={{ label: "Voltar", onClick: () => (window.location.href = "/live") }}
        />
      )}
      {phase === "error" && (
        <PhaseScreen
          icon={<TriangleAlert className="h-10 w-10 text-amber-400" />}
          title="Não foi possível parear"
          description={errorMsg ?? "Ocorreu um erro inesperado."}
          action={{
            label: "Tentar novamente",
            onClick: () => {
              cleanup();
              finishedRef.current = false;
              attemptsRef.current = 0;
              setPhase("idle");
            },
          }}
        />
      )}
    </main>
  );
}

function PhaseScreen({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      {icon}
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-white/60">{description}</p>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

function IdleScreen({
  initialCode,
  onStart,
}: {
  initialCode: string;
  onStart: (code: string) => void;
}) {
  const [composingCode, setComposingCode] = useState(initialCode);
  const hasInitialCode = initialCode.length >= 6;
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-6">
        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          <NexoraAppIcon className="h-12 w-12" />
          <h1 className="text-lg font-bold">Nexora Mobile Camera</h1>
          <p className="text-sm text-white/60">
            {hasInitialCode
              ? "Vamos usar a câmera deste dispositivo na sala do Nexora Live. Ao tocar em conectar, a Nexora vai pedir acesso à câmera e ao microfone."
              : "Use este dispositivo como câmera da sala. Informe o código exibido no QR code da sala do Nexora Live."}
          </p>
        </div>
        {hasInitialCode ? (
          <p className="mb-4 rounded-lg border border-[#5865F2]/30 bg-[#5865F2]/10 px-3 py-2 text-center font-mono text-lg tracking-[0.3em]">
            {initialCode}
          </p>
        ) : (
          <input
            value={composingCode}
            onChange={e =>
              setComposingCode(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
              )
            }
            placeholder="Ex: AB12CD34"
            className="mb-4 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center text-lg font-mono tracking-[0.3em] outline-none focus:ring-2 focus:ring-[#5865F2]"
          />
        )}
        <Button
          className="w-full"
          onClick={() => onStart(composingCode)}
          disabled={composingCode.length < 6}
        >
          <Smartphone className="mr-2 h-4 w-4" />
          Conectar como câmera
        </Button>
      </div>
    </div>
  );
}

function ControlButton({
  active,
  label,
  onClick,
  danger,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-white transition-transform active:scale-95",
        danger
          ? "bg-red-600 hover:bg-red-700"
          : active
            ? "bg-[#23A559] text-black hover:bg-[#16a34a]"
            : "bg-white/10 hover:bg-white/20"
      )}
    >
      {children}
    </button>
  );
}
