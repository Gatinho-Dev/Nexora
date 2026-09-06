import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { websocketUrl } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  VolumeX,
  Headphones,
  PhoneOff,
  Loader2,
  Smartphone,
  Wifi,
  WifiOff,
  TriangleAlert,
} from "lucide-react";
import { NexoraAppIcon } from "@/components/NexoraBrand";

export default function CompanionPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [activeCode, setActiveCode] = useState(code);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pairedRef = useRef(false);

  const [phase, setPhase] = useState<
    "code" | "connecting" | "paired" | "video-ready" | "disconnected" | "error"
  >("code");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mute, setMute] = useState(false);
  const [deafen, setDeafen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);

  // ── Signaling + WebRTC (offerer) ──────────────────────────
  function send(data: unknown) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }

  function pairCode(): string {
    return activeCode;
  }

  async function ensurePeer() {
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
        code: pairCode(),
        data: {
          candidate: event.candidate ? event.candidate.toJSON() : null,
        },
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        setPhase("error");
        setErrorMsg("A conexão com a chamada falhou.");
      }
    };

    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    }
    return pc;
  }

  async function handleSignal(data: unknown) {
    if (!data || typeof data !== "object") return;
    const msg = data as { description?: RTCSessionDescriptionInit; candidate?: unknown };
    try {
      const pc = await ensurePeer();
      if (msg.description) {
        if (pc.signalingState !== "stable") return;
        await pc.setRemoteDescription(msg.description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({
          t: "companion:signal",
          code: pairCode(),
          data: { description: pc.localDescription?.toJSON() },
        });
      } else if (msg.candidate !== undefined) {
        await pc.addIceCandidate(msg.candidate as RTCIceCandidateInit);
      }
    } catch (error) {
      console.error("[COMPANION] Falha no signaling", error);
      setPhase("error");
      setErrorMsg("Não foi possível conectar à chamada.");
    }
  }

  function createOffer() {
    void (async () => {
      try {
        const pc = await ensurePeer();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({
          t: "companion:signal",
          code: pairCode(),
          data: { description: pc.localDescription?.toJSON() },
        });
      } catch (error) {
        console.error("[COMPANION] Falha ao criar oferta", error);
        setPhase("error");
        setErrorMsg("Não foi possível iniciar a câmera externa.");
      }
    })();
  }

  async function start(codeToPair: string) {
    setErrorMsg(null);
    if (!codeToPair) {
      setPhase("error");
      setErrorMsg("Falta o código de pareamento na URL.");
      return;
    }
    setPhase("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
    } catch {
      setPhase("error");
      setErrorMsg(
        "Nexora não conseguiu acessar a câmera deste dispositivo. Permita o acesso e tente novamente."
      );
      return;
    }
    localStreamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {});
    }

    const ws = new WebSocket(websocketUrl("/ws/companion"));
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
      const m = msg as {
        t?: string;
        message?: string;
        session?: {
          status?: string;
          cameraActive?: boolean;
          muted?: boolean;
          deafened?: boolean;
          screenActive?: boolean;
        };
        data?: unknown;
      };
      switch (m.t) {
        case "paired":
          pairedRef.current = true;
          setPhase("paired");
          createOffer();
          break;
        case "companion:signal":
          void handleSignal(m.data);
          break;
        case "companion:error":
          pairedRef.current = false;
          setPhase("error");
          setErrorMsg(m.message ?? "Erro ao parear o dispositivo.");
          break;
        case "companion:state":
          setCamera(!!m.session?.cameraActive);
          setScreen(!!m.session?.screenActive);
          break;
        default:
          break;
      }
    };
    ws.onclose = () => {
      if (!pairedRef.current) {
        setPhase("error");
        setErrorMsg("A conexão foi encerrada.");
      } else {
        setPhase("disconnected");
      }
      cleanup();
    };
    ws.onerror = () => {
      setPhase("error");
      setErrorMsg("Não foi possível conectar-se à Nexora.");
    };
  }

  function sendControl(action: string) {
    send({ t: "companion:control", code: pairCode(), action });
  }

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    pairedRef.current = false;
  }

  useEffect(() => {
    return () => cleanup();
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#1e1f22] p-4 text-white">
      {phase === "code" && (
        <CompanionIdle
          initialCode={code}
          onStart={c => {
            setActiveCode(c);
            void start(c);
          }}
        />
      )}
      {phase === "connecting" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#5865F2]" />
          <h1 className="text-lg font-bold">Conectando à Nexora…</h1>
          <p className="text-sm text-white/60">
            Solicitando acesso à câmera e pareando com a chamada.
          </p>
        </div>
      )}
      {(phase === "paired" || phase === "video-ready") && (
        <div className="flex w-full max-w-xl flex-col items-center gap-4">
          <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            {camera ? (
              <CameraPill className="text-emerald-400" label="Câmera ativa" />
            ) : (
              <CameraPill className="text-white/40" label="Câmera desligada" />
            )}
          </div>
          <CompanionControls
            mute={mute}
            deafen={deafen}
            camera={camera}
            screen={screen}
            onMute={() => {
              setMute(v => !v);
              sendControl("toggle-mute");
            }}
            onDeafen={() => {
              setDeafen(v => !v);
              sendControl("toggle-deafen");
            }}
            onCamera={() => sendControl("toggle-camera")}
            onScreen={() => sendControl("toggle-screen")}
            onLeave={() => sendControl("leave-call")}
          />
          <p className="text-center text-xs text-white/40">
            Este dispositivo está transmitindo sua câmera como a câmera principal
            da chamada. Use os controles abaixo para gerenciar a chamada ou desconecte.
          </p>
        </div>
      )}
      {phase === "disconnected" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <PhoneOff className="h-10 w-10 text-white/50" />
          <h1 className="text-lg font-bold">Câmera externa desconectada</h1>
          <p className="text-sm text-white/60">
            Você saiu da chamada. Este dispositivo não transmite mais a câmera.
          </p>
        </div>
      )}
      {phase === "error" && (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <TriangleAlert className="h-10 w-10 text-amber-400" />
          <h1 className="text-lg font-bold">Não foi possível parear</h1>
          <p className="text-sm text-white/60">{errorMsg}</p>
          <Button
            variant="secondary"
            onClick={() => {
              cleanup();
              setPhase("code");
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
    </main>
  );
}

function CameraPill({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs font-medium border border-white/10",
        className
      )}
    >
      {label === "Câmera ativa" ? (
        <Video className="h-3 w-3" />
      ) : (
        <VideoOff className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}

function CompanionIdle({
  initialCode,
  onStart,
}: {
  initialCode: string;
  onStart: (code: string) => void;
}) {
  const [composingCode, setComposingCode] = useState(initialCode);
  const hasInitialCode = initialCode.length >= 6;
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-6">
      <div className="mb-4 flex flex-col items-center gap-3 text-center">
        <NexoraAppIcon className="h-12 w-12" />
        <h1 className="text-lg font-bold">Controle de chamada Nexora</h1>
        <p className="text-sm text-white/60">
          {hasInitialCode
            ? "Vamos usar a câmera deste dispositivo na sua chamada. Ao tocar em conectar, a Nexora vai pedir acesso à câmera e ao microfone."
            : "Use este dispositivo como câmera da sua chamada. Informe o código exibido no QR code da conversa."}
        </p>
      </div>
      {hasInitialCode && (
        <p className="mb-4 rounded-lg border border-[#5865F2]/30 bg-[#5865F2]/10 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-white">
          {initialCode}
        </p>
      )}
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
        Código de pareamento
      </label>
      {hasInitialCode ? (
        <p className="mb-4 text-center text-xs text-white/50">
          O código veio do QR code. Você pode editá-lo abaixo se precisar.
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
  );
}

function CompanionControls({
  mute,
  deafen,
  camera,
  screen,
  onMute,
  onDeafen,
  onCamera,
  onScreen,
  onLeave,
}: {
  mute: boolean;
  deafen: boolean;
  camera: boolean;
  screen: boolean;
  onMute: () => void;
  onDeafen: () => void;
  onCamera: () => void;
  onScreen: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ControlButton
        active={!mute}
        label={mute ? "Desmutar" : "Silenciar"}
        onClick={onMute}
      >
        {mute ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </ControlButton>
      <ControlButton
        active={!deafen}
        label={deafen ? "Ouvir" : "Ensurdecer"}
        onClick={onDeafen}
      >
        {deafen ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Headphones className="h-5 w-5" />
        )}
      </ControlButton>
      <ControlButton
        active={camera}
        label={camera ? "Desligar câmera" : "Ligar câmera"}
        onClick={onCamera}
      >
        {camera ? (
          <Video className="h-5 w-5" />
        ) : (
          <VideoOff className="h-5 w-5" />
        )}
      </ControlButton>
      <ControlButton
        active={screen}
        label="Compartilhar tela"
        onClick={onScreen}
      >
        {screen ? (
          <Wifi className="h-5 w-5" />
        ) : (
          <WifiOff className="h-5 w-5" />
        )}
      </ControlButton>
      <ControlButton
        active={false}
        label="Desconectar"
        onClick={onLeave}
        danger
      >
        <PhoneOff className="h-5 w-5" />
      </ControlButton>
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
