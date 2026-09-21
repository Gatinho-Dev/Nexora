import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  Check,
  Copy,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Share2,
  Video,
  VideoOff,
  MessageSquare,
  X,
  WifiOff,
  MonitorStop,
  Settings2,
} from "lucide-react";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { Seo } from "@/lib/seo";
import { useLiveRoom } from "@/hooks/useLiveRoom";
import { liveRtc } from "@/lib/live/rtc";
import { loadIdentity, saveIdentity } from "@/lib/live/identity";
import { validateNickname } from "@contracts/live";
import { LiveVideoCard } from "@/components/live/LiveVideoCard";
import { LiveChatPanel } from "@/components/live/LiveChatPanel";
import { LiveSettingsPanel } from "@/components/live/LiveSettingsPanel";
import { getDevicePrefs } from "@/lib/devices";
import "./Live.css";

/**
 * Sala Nexora Live — /live/:roomCode
 *
 * Dois estágios: preparação do dispositivo (preview + permissões) e sala.
 * Sem cadastro; nick temporário (vem do lobby, do link ou é pedido aqui).
 */

type Stage = "prepare" | "room";

export default function LiveRoomPage() {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const room = useLiveRoom();
  // Estável (useCallback com sendState estável) — seguro em deps de efeitos.
  const setMediaState = room.setMediaState;

  const [nickname, setNickname] = useState(
    loadIdentity()?.nickname || (location.state as { nickname?: string })?.nickname || ""
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Padrão do Live: microfone já ativo ao entrar (casar com o estado inicial
  // do hook useLiveRoom — evita divergência UI/servidor).
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const shareUrl = useMemo(
    () => `${window.location.origin}/live/${roomCode}`,
    [roomCode]
  );

  // ── Estado da sala ──────────────────────────────────────────
  const [everJoined, setEverJoined] = useState(false);
  if (room.status === "joined" && !everJoined) {
    setEverJoined(true); // ajuste durante o render (padrão React recomendado)
  }
  const stage: Stage = room.status === "denied" ? "prepare" : everJoined ? "room" : "prepare";

  // Não lidas do chat: derivado no render (sem effect).
  const [seenChatLen, setSeenChatLen] = useState(0);
  const unreadCount = chatOpen ? 0 : Math.max(0, room.chat.length - seenChatLen);
  const markChatSeen = useCallback(() => {
    setSeenChatLen(room.chat.length);
  }, [room.chat.length]);

  // ── Fim de share pelo navegador (barra do Chrome etc.) ──────
  // Ajuste durante o render (padrão React p/ reagir a mudança externa).
  const [seenScreenEnd, setSeenScreenEnd] = useState(0);
  if (room.screenEndedSignal !== seenScreenEnd) {
    setSeenScreenEnd(room.screenEndedSignal);
    if (room.screenEndedSignal > 0) {
      setScreen(false);
      room.setMediaState({ screen: false });
    }
  }

  // ── Ações de mídia (controlam tracks reais via liveRtc) ────
  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    liveRtc.setMuted(next);
    room.setMediaState({ muted: next });
  }

  async function toggleCamera() {
    const next = !camera;
    try {
      if (next) await liveRtc.enableCamera();
      else await liveRtc.disableCamera();
      setCamera(next);
      room.setMediaState({ camera: next });
    } catch (error) {
      setPermError(
        error instanceof Error && error.message
          ? error.message
          : "Não conseguimos acessar sua câmera. Verifique as permissões do navegador."
      );
    }
  }

  async function toggleScreen() {
    if (!screen && typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
      setPermError(
        "Seu navegador não permite compartilhamento de tela neste dispositivo."
      );
      return;
    }
    try {
      if (!screen) {
        await liveRtc.enableScreen();
        if (liveRtc.sharingScreen) {
          setScreen(true);
          room.setMediaState({ screen: true });
        }
      } else {
        await liveRtc.disableScreen();
        setScreen(false);
        room.setMediaState({ screen: false });
      }
    } catch (error) {
      setPermError(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível compartilhar a tela agora."
      );
    }
  }

  // Limpa o banner de erro automaticamente.
  useEffect(() => {
    if (!permError && !room.mediaError) return;
    const id = setTimeout(() => {
      setPermError(null);
      room.clearMediaError();
    }, 6000);
    return () => clearTimeout(id);
  }, [permError, room.mediaError]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Push-to-talk (configurado no painel de configurações) ──
  const [pttKeybind, setPttKeybind] = useState(
    () => getDevicePrefs().pushToTalkKeybind
  );
  useEffect(() => {
    const onPrefs = () => setPttKeybind(getDevicePrefs().pushToTalkKeybind);
    window.addEventListener("nexora:device-preferences", onPrefs);
    return () =>
      window.removeEventListener("nexora:device-preferences", onPrefs);
  }, []);

  // Ref do muted: o efeito abaixo registra UMA vez por keybind (sem `muted`
  // nas deps) — se `muted` estivesse nas deps, o cleanup dispararia no instante
  // em que o PTT abre o mic e desfaria a abertura (bug real, testado).
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!pttKeybind) return;
    const parts = pttKeybind.toLowerCase().split("+");
    const wantKey = parts[parts.length - 1];
    const wantCtrl = parts.includes("ctrl");
    const wantShift = parts.includes("shift");
    const wantAlt = parts.includes("alt");
    const wantMeta = parts.includes("meta");
    let openedByPtt = false;
    const isTyping = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      );
    };
    const matches = (e: KeyboardEvent) => {
      const key = (e.key === " " ? "space" : e.key.toLowerCase());
      return (
        key === wantKey &&
        e.ctrlKey === wantCtrl &&
        e.shiftKey === wantShift &&
        e.altKey === wantAlt &&
        e.metaKey === wantMeta
      );
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping() || e.repeat || !matches(e)) return;
      e.preventDefault();
      if (!openedByPtt && mutedRef.current) {
        openedByPtt = true;
        setMuted(false);
        liveRtc.setMuted(false);
        setMediaState({ muted: false });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (!matches(e) || !openedByPtt) return;
      openedByPtt = false;
      setMuted(true);
      liveRtc.setMuted(true);
      setMediaState({ muted: true });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      // Nunca deixa o mic preso aberto se o painel/desbind ocorrer no meio.
      if (openedByPtt) {
        openedByPtt = false;
        setMuted(true);
        liveRtc.setMuted(true);
        setMediaState({ muted: true });
      }
    };
  }, [pttKeybind, setMediaState]); // lê muted via mutedRef

  // Esc fecha o painel de configurações.
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  // Nome da sala para o estágio "prepare": o hook só o conhece após o join,
  // então busca do endpoint público (não bloqueia — fallback é o código).
  const [publicRoomName, setPublicRoomName] = useState<string | null>(null);
  useEffect(() => {
    if (stage !== "prepare" || !roomCode) return;
    let active = true;
    void import("@/lib/live/api").then(({ fetchLiveRoomInfo }) =>
      fetchLiveRoomInfo(roomCode.toUpperCase()).then(info => {
        if (active) setPublicRoomName(info.name ?? null);
      })
    );
    return () => {
      active = false;
    };
  }, [stage, roomCode]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard bloqueado — usuário copia manualmente
    }
  }

  async function shareLink() {
    const { shareRoomLink } = await import("@/lib/live/api");
    const shared = await shareRoomLink(shareUrl, roomCode);
    if (!shared) void copyLink();
  }

  function leaveRoom() {
    room.leave();
    navigate("/live");
  }

  // Prévia da câmera: anexa o stream ao <video>.
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !previewStream) return;
    if (video.srcObject !== previewStream) {
      video.srcObject = previewStream;
      void video.play().catch(() => {});
    }
  }, [previewStream]);

  async function testDevices() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 } },
        audio: false,
      });
      previewStream?.getTracks().forEach(t => t.stop());
      setPreviewStream(stream);
      setPermError(null);
    } catch {
      setPermError(
        "Não conseguimos acessar sua câmera/microfone. Verifique as permissões do navegador e tente novamente."
      );
    }
  }

  // ── Estágio: preparar dispositivo ──────────────────────────
  if (stage === "prepare") {
    const denied = room.status === "denied" ? room.deny : null;
    return (
      <div className="live-landing">
        <Seo
          title={`Sala ${roomCode} — Nexora Live`}
          description="Sala temporária do Nexora Live."
          canonicalPath={`/live/${roomCode}`}
          noindex
        />
        <main className="live-lobby live-lobby--prepare">
          <section className="live-lobby__card" aria-label="Entrar na sala">
            {denied ? (
              <>
                <div className="live-lobby__badge live-lobby__badge--warn" aria-hidden>
                  <AlertTriangle size={16} />
                </div>
                <h1>Esta sala não está mais disponível.</h1>
                <p className="live-lobby__hint">{denied.message}</p>
                <div className="live-lobby__actions">
                  <Link
                    to="/live"
                    className="landing-button landing-button--primary landing-button--large"
                  >
                    Criar nova sala
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1>Entrar no Nexora Live</h1>
                <p className="live-lobby__hint">
                  {publicRoomName ? (
                    <>
                      <strong>{publicRoomName}</strong> — código{" "}
                      <strong>{roomCode.toUpperCase()}</strong>
                    </>
                  ) : (
                    <>Sala <strong>{roomCode.toUpperCase()}</strong></>
                  )}{" "}
                  — seu nick é temporário e não é necessário criar uma conta.
                </p>
                <form
                  className="live-lobby__form"
                  onSubmit={e => {
                    e.preventDefault();
                    const validation = validateNickname(nickname);
                    if (!validation.ok) {
                      setJoinError(validation.error);
                      return;
                    }
                    setJoinError(null);
                    previewStream?.getTracks().forEach(t => t.stop());
                    setPreviewStream(null);
                    ensureIdentityForJoin(roomCode, validation.value);
                    room.join({ code: roomCode.toUpperCase(), nickname: validation.value });
                  }}
                >
                  <label htmlFor="room-nick" className="live-lobby__label">
                    Seu nick
                  </label>
                  <input
                    id="room-nick"
                    className="live-lobby__input"
                    value={nickname}
                    onChange={e => setNickname(e.target.value.slice(0, 24))}
                    placeholder="Gatinho_Dev"
                    autoComplete="off"
                    maxLength={24}
                    autoFocus
                  />
                  {joinError && (
                    <p className="live-lobby__error" role="alert">
                      {joinError}
                    </p>
                  )}
                  <div className="live-lobby__preview">
                    {previewStream ? (
                      <video
                        ref={previewVideoRef}
                        className="live-lobby__preview-video"
                        autoPlay
                        playsInline
                        muted
                      />
                    ) : (
                      <span className="live-lobby__preview-hint">
                        Teste sua câmera antes de entrar
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="landing-button landing-button--ghost"
                    onClick={() => void testDevices()}
                  >
                    <Video aria-hidden />
                    {previewStream ? "Testar novamente" : "Preparar seu dispositivo"}
                  </button>
                  <button
                    type="submit"
                    className="landing-button landing-button--primary landing-button--large live-lobby__cta"
                    disabled={room.status === "connecting" || !nickname.trim()}
                  >
                    {room.status === "connecting" ? "Entrando..." : "Entrar na sala"}
                  </button>
                </form>
              </>
            )}
          </section>
        </main>
      </div>
    );
  }

  // ── Sala ────────────────────────────────────────────────────
  // Quem compartilha tela: prioridade para remoto; senão eu.
  const remoteSharer = room.participants.find(
    p => p.screen && p.sessionId !== room.you?.sessionId
  );
  const iShare = screen;
  const spotlightSessionId = remoteSharer
    ? remoteSharer.sessionId
    : iShare
      ? room.you?.sessionId
      : null;

  const gridClass =
    spotlightSessionId != null
      ? "live-grid--spotlight"
      : `live-grid live-grid--${Math.min(room.participants.length, 6)}`;

  const banner =
    room.status === "reconnecting"
      ? "Reconectando…"
      : room.rtcState === "failed"
        ? "Problema de conexão de mídia. Tentando recuperar…"
        : null;

  const roomTitle = room.roomName || `Sala ${roomCode.toUpperCase()}`;

  return (
    <div className="live-room">
      <Seo
        title={`${roomTitle} — Nexora Live`}
        description="Sala temporária do Nexora Live."
        canonicalPath={`/live/${roomCode}`}
        noindex
      />

      <header className="live-room__header">
        <div className="live-room__title">
          <NexoraAppIcon className="live-room__brand" decorative />
          <span>Nexora Live</span>
          <span className="live-beta-badge" aria-label="Recurso em beta">
            Beta
          </span>
          <span className="live-room__name">{roomTitle}</span>
          <span className="live-room__count">
            {room.participants.length}/{room.maxParticipants}
          </span>
          <span
            className={`live-conn ${
              room.connectionStatus === "open" ? "live-conn--ok" : "live-conn--bad"
            }`}
            role="status"
            title={
              room.connectionStatus === "open"
                ? "Conectado"
                : "Reconectando…"
            }
          >
            <span className="live-conn__dot" aria-hidden />
            {room.connectionStatus === "open" ? "Conectado" : "Reconectando…"}
          </span>
        </div>
        <div className="live-room__header-actions">
          <button type="button" className="live-icon-btn" onClick={copyLink} aria-label="Copiar link da sala" title="Copiar link">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <button type="button" className="live-icon-btn" onClick={() => void shareLink()} aria-label="Compartilhar sala" title="Compartilhar">
            <Share2 size={18} />
          </button>
        </div>
      </header>

      {banner && (
        <div className="live-room__banner" role="status">
          <WifiOff size={14} aria-hidden /> {banner}
        </div>
      )}
      {(permError || room.mediaError) && (
        <div
          className="live-room__banner live-room__banner--warn"
          role="alert"
          onClick={() => {
            setPermError(null);
            room.clearMediaError();
          }}
        >
          <AlertTriangle size={14} aria-hidden /> {permError || room.mediaError}
        </div>
      )}

      <main className="live-room__grid-area">
        <div className={gridClass}>
          {/* Spotlight: tela compartilhada em destaque. */}
          {spotlightSessionId && (
            <LiveVideoCard
              spotlight
              participant={
                spotlightSessionId === room.you?.sessionId
                  ? (room.you ?? {
                      sessionId: spotlightSessionId,
                      nickname: "Você",
                      isHost: false,
                      muted: false,
                      camera: false,
                      screen: true,
                    })
                  : (room.participants.find(p => p.sessionId === spotlightSessionId) ?? {
                      sessionId: spotlightSessionId,
                      nickname: "—",
                      isHost: false,
                      muted: false,
                      camera: false,
                      screen: true,
                    })
              }
              videoStream={
                spotlightSessionId === room.you?.sessionId
                  ? liveRtc.screenStreamLocal
                  : (room.remoteVideoStreams[spotlightSessionId] ?? null)
              }
              speaking={!!room.speaking[spotlightSessionId]}
              videoMuted={true}
              isSelf={spotlightSessionId === room.you?.sessionId}
            />
          )}
          {room.participants
            .filter(p => p.sessionId !== spotlightSessionId)
            .map(p => {
              const isSelf = p.sessionId === room.you?.sessionId;
              const stream = isSelf
                ? room.localStream
                : (room.remoteVideoStreams[p.sessionId] ?? null);
              const videoPending =
                !isSelf && p.camera && !stream;
              return (
                <LiveVideoCard
                  key={p.sessionId}
                  participant={p}
                  videoStream={stream}
                  audioStream={isSelf ? null : (room.remoteAudioStreams[p.sessionId] ?? null)}
                  speaking={!!room.speaking[p.sessionId]}
                  videoMuted={isSelf}
                  isSelf={isSelf}
                  videoPending={videoPending}
                  onKick={
                    room.amHost && !isSelf
                      ? () => room.kick(p.sessionId)
                      : undefined
                  }
                />
              );
            })}
        </div>

        {chatOpen && (
          <LiveChatPanel
            chat={room.chat}
            mySessionId={room.you?.sessionId ?? ""}
            onSend={room.sendChat}
            onClose={() => {
              setChatOpen(false);
              markChatSeen();
            }}
          />
        )}
      </main>

      <footer className="live-controls" role="toolbar" aria-label="Controles da sala">
        <button
          type="button"
          className={`live-ctrl ${muted ? "live-ctrl--off" : "live-ctrl--ok"}`}
          onClick={() => void toggleMute()}
          aria-pressed={muted}
          title={muted ? "Ativar microfone" : "Desativar microfone"}
        >
          {muted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
          <span>{muted ? "Ativar microfone" : "Desativar microfone"}</span>
        </button>

        <button
          type="button"
          className={`live-ctrl ${camera ? "live-ctrl--ok" : "live-ctrl--idle"}`}
          onClick={() => void toggleCamera()}
          aria-pressed={camera}
          title={camera ? "Desativar câmera" : "Ativar câmera"}
        >
          {camera ? <Video aria-hidden /> : <VideoOff aria-hidden />}
          <span>{camera ? "Desativar câmera" : "Ativar câmera"}</span>
        </button>

        <button
          type="button"
          className={`live-ctrl ${screen ? "live-ctrl--screen" : "live-ctrl--idle"}`}
          onClick={() => void toggleScreen()}
          aria-pressed={screen}
          title={screen ? "Parar compartilhamento" : "Compartilhar tela"}
        >
          {screen ? <MonitorStop aria-hidden /> : <MonitorUp aria-hidden />}
          <span>{screen ? "Parar compartilhamento" : "Compartilhar tela"}</span>
        </button>

        <button
          type="button"
          className="live-ctrl live-ctrl--idle"
          onClick={() => {
            setChatOpen(open => !open);
            markChatSeen();
          }}
          aria-expanded={chatOpen}
          title="Chat"
        >
          {chatOpen ? <X aria-hidden /> : <MessageSquare aria-hidden />}
          <span>Chat</span>
          {unreadCount > 0 && !chatOpen && (
            <span className="live-ctrl__badge" aria-label={`${unreadCount} novas mensagens`}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="live-ctrl live-ctrl--idle"
          onClick={() => setSettingsOpen(true)}
          aria-haspopup="dialog"
          title="Configurações"
        >
          <Settings2 aria-hidden />
          <span>Configurações</span>
        </button>

        {room.amHost && (
          <button
            type="button"
            className="live-ctrl live-ctrl--danger-ghost"
            onClick={() => {
              if (window.confirm("Encerrar a sala para todos?")) {
                room.endRoom();
                navigate("/live");
              }
            }}
            title="Encerrar sala"
          >
            <LogOut aria-hidden />
            <span>Encerrar</span>
          </button>
        )}

        <button
          type="button"
          className="live-ctrl live-ctrl--danger"
          onClick={leaveRoom}
          title="Sair da sala"
        >
          <PhoneOff aria-hidden />
          <span>Sair</span>
        </button>
      </footer>

      {settingsOpen && (
        <LiveSettingsPanel
          onClose={() => setSettingsOpen(false)}
          onError={message => setPermError(message)}
        />
      )}
    </div>
  );
}

/** Garante identidade consistente antes do join (nick + roomCode). */
function ensureIdentityForJoin(roomCode: string, nickname: string) {
  const current = loadIdentity();
  saveIdentity({
    sessionId: current?.sessionId ?? crypto.randomUUID(),
    nickname,
    sessionToken:
      current?.roomCode === roomCode.toUpperCase()
        ? current?.sessionToken ?? ""
        : "",
    hostToken:
      current?.roomCode === roomCode.toUpperCase()
        ? current?.hostToken ?? ""
        : "",
    roomCode: roomCode.toUpperCase(),
  });
}
