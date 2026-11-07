import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Hash,
  Volume2,
  MessageCircle,
  Users,
  LogOut,
  Search,
  ChevronDown,
  ChevronRight,
  PanelRight,
  Send,
  Paperclip,
  Radio,
  ArrowLeft,
  LoaderCircle,
  ExternalLink,
  Reply,
  Pencil,
  Trash2,
  SmilePlus,
  X,
  Settings,
  Mic,
  MicOff,
  PhoneOff,
  Phone,
} from "lucide-react";
import { VoiceSession, type VoiceParticipant, type VoiceRoom } from "./voice/session";
import icon from "./icon.png";
import { reconcileMessages } from "../electron/chat-state";
import "./style.css";

type User = {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
  status: string;
  customStatus: string | null;
};
type Server = {
  id: number;
  name: string;
  iconUrl: string | null;
  description: string | null;
};
type Channel = {
  id: number;
  name: string;
  categoryId: number | null;
  type: string;
  topic?: string | null;
};
type Category = { id: number; name: string };
type Details = {
  server: Server;
  channels: Channel[];
  categories: Category[];
  members: { user: User; nickname: string | null }[];
};
type Conversation = {
  id: number;
  name?: string | null;
  otherUser: User | null;
  lastMessage?: { id: number; content: string; authorId: number; createdAt: string } | null;
  unreadCount: number;
  isGroup: boolean;
};
type Reaction = { emoji: string; count: number; userIds: number[] };
type Message = {
  id: number;
  authorId: number;
  replyTo?: { id: number; content: string; author: User } | null;
  reactions: Reaction[];
  channelId: number | null;
  conversationId: number | null;
  author: User;
  content: string;
  createdAt: string;
  editedAt: string | null;
  attachments?: { id: number; filename: string; mimeType: string; url: string }[];
};
type Target =
  | { channelId: number; conversationId?: never }
  | { conversationId: number; channelId?: never };
type DesktopSettings = { notifications: boolean; minimizeToTray: boolean; trayAvailable: boolean };
type UpdateState = { status: "unsupported" | "idle" | "checking" | "available" | "downloading" | "ready" | "upToDate" | "error"; version?: string; percent?: number; message?: string };
type Navigation = { conversationId?: number; serverId?: number; channelId?: number };
type Event = {
  t: string;
  connected?: boolean;
  message?: Message;
  id?: number;
  channelId?: number;
  conversationId?: number;
  messageId?: number;
  reactions?: Reaction[];
  user?: User;
};
declare global {
  interface Window {
    nexora: {
      login: (
        identifier: string,
        password: string,
        code?: string,
      ) => Promise<{ requiresTwoFactor: boolean; user: User | null }>;
      rpc: <T>(path: string, input?: unknown) => Promise<T>;
      external: (url: string) => Promise<void>;
      pickFiles: () => Promise<{ path: string; name: string; size: number; mimeType: string }[]>;
      uploadFiles: (paths: string[]) => Promise<number[]>;
      version: () => Promise<string>;
      updaterState: () => Promise<UpdateState>;
      checkUpdates: () => Promise<UpdateState>;
      installUpdate: () => Promise<void>;
      onUpdater: (fn: (state: UpdateState) => void) => () => void;
      connected: () => Promise<boolean>;
      typing: (target: Target) => Promise<boolean>;
      voiceSend: (message: unknown) => Promise<boolean>;
      voiceIceServers: () => Promise<RTCIceServer[]>;
      mediaFetch: (url: string) => Promise<string>;
      getSettings: () => Promise<DesktopSettings>;
      setSettings: (patch: Partial<Pick<DesktopSettings, "notifications" | "minimizeToTray">>) => Promise<DesktopSettings>;
      onSettings: (fn: (settings: DesktopSettings) => void) => () => void;
      onNavigate: (fn: (target: Navigation) => void) => () => void;
      onEvent: (fn: (event: Event) => void) => () => void;
    };
  }
}
const api = <T,>(path: string, input?: unknown) =>
  window.nexora.rpc<T>(path, input);
const label = (u: User | null) => u?.name || u?.username || "Usuário";
const updateText = (state: UpdateState) =>
  state.status === "checking" ? "Verificando atualizações…"
  : state.status === "downloading" ? `Baixando${state.version ? ` a versão ${state.version}` : ""}… ${state.percent ?? 0}%`
  : state.status === "ready" ? `Versão ${state.version} pronta. Reinicie para aplicar.`
  : state.status === "upToDate" ? "Você está na versão mais recente."
  : state.status === "unsupported" ? "Disponível apenas na versão instalada."
  : state.status === "error" ? (state.message ?? "Falha ao verificar atualizações.")
  : "Verificadas automaticamente ao abrir o app.";
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        "",
      )
    : "Não foi possível concluir esta ação.";
// Cache por URL: avatares e anexos repetidos não voltam ao processo principal a cada montagem.
const mediaCache = new Map<string, Promise<string>>();
function cachedMedia(src: string) {
  let entry = mediaCache.get(src);
  if (!entry) {
    entry = window.nexora.mediaFetch(src);
    mediaCache.set(src, entry);
    entry.catch(() => mediaCache.delete(src));
  }
  return entry;
}
function useMedia(src?: string | null) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setResolved(null);
    if (!src) return;
    if (!src.startsWith("/api/files/")) {
      setResolved(src);
      return;
    }
    void cachedMedia(src)
      .then((value) => alive && setResolved(value))
      .catch(() => alive && setResolved(null));
    return () => {
      alive = false;
    };
  }, [src]);
  return resolved;
}
function Media({ src, alt = "" }: { src: string; alt?: string }) {
  const resolved = useMedia(src);
  return resolved ? <img src={resolved} alt={alt} /> : null;
}
function Avatar({
  name,
  src,
  size = "normal",
}: {
  name: string;
  src?: string | null;
  size?: string;
}) {
  const resolved = useMedia(src);
  return (
    <span className={`avatar ${size}`}>
      {resolved ? <img src={resolved} alt="" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
type PublicProfile = {
  user: { id: number; username: string | null; displayName: string | null; avatar: string | null };
  details: { displayName: string | null; pronouns: string | null; location: string | null; website: string | null; about: string | null } | null;
  fields: { id: number; label: string; value: string }[];
};
function ProfileModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setProfile(null);
    setError(null);
    api<PublicProfile>("advanced.profile.publicProfile", { userId })
      .then((data) => alive && setProfile(data))
      .catch((err) => alive && setError(errorText(err)));
    return () => { alive = false; };
  }, [userId]);
  const name = profile ? (profile.details?.displayName || profile.user.displayName || profile.user.username || "Usuário") : "";
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Perfil" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{name || "Perfil"}</h2>
          <button className="icon-button" aria-label="Fechar perfil" onClick={onClose}><X size={20}/></button>
        </header>
        {error && <div className="error" role="alert">{error}</div>}
        {!profile && !error && <p className="muted">Carregando perfil…</p>}
        {profile && (
          <>
            <div className="profile-head"><Avatar name={name} src={profile.user.avatar} size="large" /><div>{profile.user.username && <small>@{profile.user.username}</small>}{profile.details?.pronouns && <small>{profile.details.pronouns}</small>}</div></div>
            {profile.details?.about && <p className="profile-about">{profile.details.about}</p>}
            <dl>
              {profile.details?.location && <><dt>Localização</dt><dd>{profile.details.location}</dd></>}
              {profile.details?.website && <><dt>Site</dt><dd>{profile.details.website}</dd></>}
              {profile.fields.map((field) => <Fragment key={field.id}><dt>{field.label}</dt><dd>{field.value}</dd></Fragment>)}
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfa, setMfa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await window.nexora.login(
        identifier,
        password,
        mfa ? code : undefined,
      );
      if (result.requiresTwoFactor) setMfa(true);
      else if (result.user) {
        setPassword("");
        onLogin(result.user);
      } else throw new Error("Resposta de autenticação inválida.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <div className="login-glow" />
      <header className="login-brand">
        <img src={icon} alt="" />
        <span>
          NEXORA <small>DESKTOP</small>
        </span>
      </header>
      <main className="login-main">
        <section className="login-intro">
          <div className="eyebrow">
            <span className="dot" /> SEU ESPAÇO, MAIS PERTO
          </div>
          <h1>
            Boas conversas
            <br />
            <span>começam aqui.</span>
          </h1>
          <p>
            Suas comunidades, suas pessoas e todos os momentos que importam.
            Tudo em um só lugar.
          </p>
          <div className="intro-line">
            <span>01</span>
            <div /> CONECTE-SE À SUA CONTA NEXORA
          </div>
        </section>
        <section className="login-card">
          <div className="card-icon">
            <img src={icon} alt="" />
          </div>
          <h2>Bem-vindo de volta</h2>
          <p>Entre para continuar de onde parou.</p>
          <form onSubmit={submit}>
            <label>
              USUÁRIO OU E-MAIL
              <input
                autoFocus
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={mfa}
              />
            </label>
            <label>
              SENHA
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={mfa}
              />
            </label>
            {mfa && (
              <label>
                CÓDIGO DE AUTENTICAÇÃO
                <input
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Entrando..."
                : mfa
                  ? "Confirmar e entrar"
                  : "Entrar na Nexora"}{" "}
              <span>→</span>
            </button>
          </form>
          <button
            className="link"
            onClick={() =>
              void window.nexora.external(
                "https://nexorachat.cloud/forgot-password",
              )
            }
          >
            Esqueceu sua senha? <ExternalLink size={13} />
          </button>
          <div className="card-foot">
            AINDA NÃO TEM CONTA?{" "}
            <button
              className="link"
              onClick={() =>
                void window.nexora.external("https://nexorachat.cloud/register")
              }
            >
              Criar conta
            </button>
          </div>
        </section>
      </main>
      <footer>
        SEU LUGAR NO UNIVERSO NEXORA <span>●</span> DESKTOP
      </footer>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [servers, setServers] = useState<Server[]>([]);
  const [dms, setDms] = useState<Conversation[]>([]);
  const [details, setDetails] = useState<Details | null>(null);
  const [serverId, setServerId] = useState<number | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [replying, setReplying] = useState<Message | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ path: string; name: string; size: number; mimeType: string }[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<number, { name: string; until: number }>>({});
  const [atBottom, setAtBottom] = useState(false);
  const [focused, setFocused] = useState(document.hasFocus());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [version, setVersion] = useState("");
  const [readThrough, setReadThrough] = useState(0);
  const [voice, setVoice] = useState<{ room: VoiceRoom; label: string; participants: VoiceParticipant[]; muted: boolean } | null>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const remoteAudio = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Target | null>(null);
  const pendingSnapshots = useRef(new Set<Set<number>>());
  const timeline = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  targetRef.current = target;
  const loadLists = useCallback(async () => {
    const [s, d] = await Promise.all([
      api<Server[]>("server.list"),
      api<Conversation[]>("dm.list"),
    ]);
    setServers(s);
    setDms(d);
  }, []);
  useEffect(() => () => {
    voiceRef.current?.leave().catch(() => undefined);
    voiceRef.current = null;
  }, []);
  useEffect(() => {
    api<User>("auth.me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    loadLists().catch((e) => setError(errorText(e)));
    void window.nexora.connected().then(setConnected);
  }, [user, loadLists]);
  useEffect(() => {
    if (!user) return;
    if (!serverId) {
      setDetails(null);
      return;
    }
    let live = true;
    setDetails(null);
    api<Details>("server.get", { serverId })
      .then((data) => {
        if (live) setDetails(data);
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [serverId, user]);
  const loadMessages = useCallback(
    async (selection: Target, before?: number, initial = false) => {
      const touched = new Set<number>();
      pendingSnapshots.current.add(touched);
      try {
        const result = await api<{ messages: Message[]; hasMore: boolean }>(
          "message.list",
          { ...selection, limit: 50, ...(before ? { before } : {}) },
        );
        if (JSON.stringify(targetRef.current) !== JSON.stringify(selection)) return;
        setMessages((old) => reconcileMessages(old, result.messages, before ? "older" : "latest", touched));
        if (before || initial) setHasMore(result.hasMore);
      } finally { pendingSnapshots.current.delete(touched); }
    },
    [],
  );
  useEffect(() => {
    if (!target || !user) {
      setMessages([]);
      return;
    }
    let live = true;
    setMessages([]);
    setReplying(null);
    setDraft("");
    setEditing(null);
    setTypingUsers({});
    setAtBottom(false);
    setReadThrough(0);
    setHasMore(false);
    setMessageLoading(true);
    loadMessages(target, undefined, true)
      .then(() => {
        if (live) requestAnimationFrame(() => {
          if (live && timeline.current) { timeline.current.scrollTop = timeline.current.scrollHeight; setAtBottom(true); }
        });
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      })
      .finally(() => {
        if (live) setMessageLoading(false);
      });
    return () => {
      live = false;
    };
  }, [target, user, loadMessages]);
  useEffect(() => {
    if (!user) return;
    return window.nexora.onEvent((event) => {
      if (event.t === "connection") {
        setConnected(!!event.connected);
        if (event.connected) {
          void loadLists().catch((e) => setError(errorText(e)));
          if (targetRef.current)
            void loadMessages(targetRef.current).catch((e) =>
              setError(errorText(e)),
            );
        }
      }
      const changedId = event.t === "message:new" || event.t === "message:update" ? event.message?.id : event.t === "message:delete" ? event.id : event.t === "reaction" ? event.messageId : undefined;
      if (changedId) for (const pending of pendingSnapshots.current) pending.add(changedId);
      if (
        (event.t === "message:new" || event.t === "message:update") &&
        event.message
      ) {
        const msg = event.message;
        const current = targetRef.current;
        if (
          current &&
          ((current.channelId === msg.channelId && !!current.channelId) ||
            (current.conversationId === msg.conversationId &&
              !!current.conversationId))
        )
          setMessages((old) =>
            old.some((m) => m.id === msg.id)
              ? old.map((m) => (m.id === msg.id ? msg : m))
              : [...old, msg],
          );
      }
      if (event.t === "message:delete")
        setMessages((old) => old.filter((m) => m.id !== event.id));
      if (event.t === "reaction" && event.messageId && event.reactions) {
        const reactions = event.reactions;
        setMessages((old) => old.map((m) => m.id === event.messageId ? { ...m, reactions } : m));
      }
      if (event.t === "typing" && event.user) {
        const current = targetRef.current;
        if (current && (current.channelId && current.channelId === event.channelId || current.conversationId && current.conversationId === event.conversationId)) {
          const sender = event.user;
          setTypingUsers((old) => ({ ...old, [sender.id]: { name: label(sender), until: Date.now() + 6000 } }));
        }
      }
      if (event.t === "dm:refresh" || event.t === "server:refresh")
        void loadLists().catch((e) => setError(errorText(e)));
      if (event.t === "voice:ready" || event.t === "voice:denied" || event.t === "voice:participants" || event.t === "signal")
        voiceRef.current?.handleEvent(event as { t: string } & Record<string, unknown>);
      if (event.t === "session:revoked") {
        void leaveVoice();
        setUser(null);
        setTarget(null);
        setServerId(null);
        setDetails(null);
        setServers([]);
        setDms([]);
        setMessages([]);
        setDraft("");
        setError("Sua sessão foi encerrada. Entre novamente.");
      }
    });
  }, [user, loadLists, loadMessages]);
  useEffect(() => {
    if (!user) return;
    void window.nexora.getSettings().then(setDesktopSettings).catch((err) => setError(errorText(err)));
    void window.nexora.version().then(setVersion).catch((err) => setError(errorText(err)));
    const offSettings = window.nexora.onSettings((next) => setDesktopSettings((previous) => ({ ...next, trayAvailable: previous?.trayAvailable ?? false })));
    const offNavigate = window.nexora.onNavigate((destination) => {
      if (destination.conversationId) { setServerId(null); setTarget({ conversationId: destination.conversationId }); }
      else if (destination.serverId && destination.channelId) { setServerId(destination.serverId); setTarget({ channelId: destination.channelId }); }
    });
    const offUpdater = window.nexora.onUpdater(setUpdate);
    void window.nexora.updaterState().then(setUpdate).catch(() => undefined);
    return () => { offSettings(); offNavigate(); offUpdater(); };
  }, [user]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); setSettingsOpen(true); }
      if (e.key === "Escape") { setSearch(false); setSettingsOpen(false); }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const focus = () => setFocused(document.hasFocus());
    window.addEventListener("focus", focus);
    window.addEventListener("blur", focus);
    return () => { window.removeEventListener("focus", focus); window.removeEventListener("blur", focus); };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTypingUsers((old) => {
      const next = Object.fromEntries(Object.entries(old).filter(([, value]) => value.until > Date.now()));
      return Object.keys(next).length === Object.keys(old).length ? old : next;
    }), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (atBottom && timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight;
  }, [messages, atBottom]);
  useEffect(() => {
    const latest = messages.at(-1);
    const node = timeline.current;
    if (!target || messageLoading || !focused || !atBottom || !node || node.scrollHeight - node.scrollTop - node.clientHeight >= 48 || !latest || latest.id <= readThrough || (target.channelId ? latest.channelId !== target.channelId : latest.conversationId !== target.conversationId)) return;
    let active = true;
    void api("message.markRead", { ...target, lastMessageId: latest.id }).then(() => {
      if (active) { setReadThrough(latest.id); void loadLists().catch((err) => setError(errorText(err))); }
    }).catch((err) => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, [target, messageLoading, focused, atBottom, messages, readThrough, loadLists]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!target || (!draft.trim() && pendingFiles.length === 0) || sending) return;
    const content = draft;
    setSending(true);
    try {
      const attachmentIds = pendingFiles.length ? await window.nexora.uploadFiles(pendingFiles.map((f) => f.path)) : [];
      const result = await api<{ message: Message }>("message.send", {
        ...target,
        content,
        ...(attachmentIds.length ? { attachmentIds } : {}),
        ...(replying ? { replyToId: replying.id } : {}),
      });
      if (JSON.stringify(targetRef.current) === JSON.stringify(target)) {
        setMessages((old) => old.some((m) => m.id === result.message.id) ? old : [...old, result.message]);
        setDraft((current) => current === content ? "" : current);
        setPendingFiles([]);
        setReplying(null);
        requestAnimationFrame(() => bottom.current?.scrollIntoView({ behavior: "smooth" }));
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  }
  async function logout() {
    try {
      await api("auth.logout");
      await leaveVoice();
      setUser(null);
      setTarget(null);
      setServerId(null);
      setDetails(null);
      setServers([]);
      setDms([]);
      setMessages([]);
      setDraft("");
    } catch (err) {
      setError(errorText(err));
    }
  }
  function chooseServer(id: number) {
    setServerId(id);
    setTarget(null);
    setError("");
  }
  async function joinVoice(room: VoiceRoom, label: string, initiated = false) {
    if (!user) return;
    setError("");
    voiceRef.current?.leave().catch(() => undefined);
    const session = new VoiceSession(user.id, {
      onParticipants: (participants) =>
        setVoice((current) => (current ? { ...current, participants } : current)),
      onRemoteStream: (userId, stream) => {
        const host = remoteAudio.current;
        if (!host) return;
        host.querySelector(`[data-user="${userId}"]`)?.remove();
        if (!stream) return;
        const el = document.createElement("audio");
        el.autoplay = true;
        el.dataset.user = String(userId);
        el.srcObject = stream;
        host.appendChild(el);
      },
      onError: (message) => setError(message),
    });
    voiceRef.current = session;
    setVoice({ room, label, participants: [], muted: false });
    try {
      await session.join(room, { initiated });
    } catch (e) {
      voiceRef.current = null;
      setVoice(null);
      setError(errorText(e));
    }
  }
  async function leaveVoice() {
    await voiceRef.current?.leave();
    voiceRef.current = null;
    if (remoteAudio.current) remoteAudio.current.replaceChildren();
    setVoice(null);
  }
  function toggleVoiceMute() {
    const session = voiceRef.current;
    if (!session) return;
    const muted = session.toggleMute();
    setVoice((current) => (current ? { ...current, muted } : current));
  }
  function chooseDm(id: number) {
    setServerId(null);
    setTarget({ conversationId: id });
    setSearch(false);
  }
  function chooseChannel(channel: Channel) {
    if (["VOICE", "STAGE"].includes(channel.type)) {
      void joinVoice({ channelId: channel.id }, channel.name);
      return;
    }
    if (!["TEXT", "ANNOUNCEMENT", "MEDIA"].includes(channel.type)) {
      setError("Este tipo de canal ainda não está disponível no Desktop.");
      return;
    }
    setTarget({ channelId: channel.id });
    setError("");
    setSearch(false);
  }
  if (loading)
    return (
      <div className="boot">
        <img src={icon} alt="Nexora" />
        <LoaderCircle className="spin" size={22} />
        <span className="boot-text">{updateText(update)}</span>
      </div>
    );
  if (!user) return <Login onLogin={setUser} />;
  const channel = details?.channels.find((c) => c.id === target?.channelId);
  const dm = dms.find((d) => d.id === target?.conversationId);
  const title =
    channel?.name || (dm ? dm.name || label(dm.otherUser) : "Início");
  const channelRow = (c: Channel) => (
    <button
      key={c.id}
      className={`channel ${target?.channelId === c.id ? "active" : ""}`}
      onClick={() => chooseChannel(c)}
    >
      {c.type === "VOICE" || c.type === "STAGE" ? (
        <Volume2 size={17} />
      ) : (
        <Hash size={18} />
      )}
      <span>{c.name}</span>
    </button>
  );
  return (
    <div className="desktop">
      <div ref={remoteAudio} hidden />
      <nav className="rail" aria-label="Servidores">
        <button
          className={`rail-home ${!serverId ? "selected" : ""}`}
          title="Início"
          onClick={() => {
            setServerId(null);
            setTarget(null);
          }}
        >
          <img src={icon} alt="Início Nexora" />
        </button>
        <div className="rail-divider" />
        {servers.map((s) => (
          <button
            className={`rail-server ${serverId === s.id ? "selected" : ""}`}
            title={s.name}
            key={s.id}
            onClick={() => chooseServer(s.id)}
          >                    {s.iconUrl ? (
                      <Media src={s.iconUrl} />
            ) : (
              s.name.slice(0, 2).toUpperCase()
            )}
          </button>
        ))}
      </nav>
      <aside className="sidebar">
        <div className="sidebar-head">
          {details ? (
            <>
              <Avatar
                name={details.server.name}
                src={details.server.iconUrl}
                size="tiny"
              />
              <strong>{details.server.name}</strong>
            </>
          ) : (
            <>
              <span className="brand-word">
                nexora<span>.</span>
              </span>
              <span className="desktop-label">DESKTOP</span>
            </>
          )}
        </div>
        <div className="sidebar-scroll">
          {serverId ? (
            details ? (
              <>
                <div className="side-overline">SEU SERVIDOR</div>
                <p className="server-description">
                  {details.server.description || "Seu espaço para conversar."}
                </p>
                {details.categories.map((cat) => (
                  <div className="category" key={cat.id}>
                    <button
                      className="category-title"
                      onClick={() =>
                        setCollapsed((v) => ({ ...v, [cat.id]: !v[cat.id] }))
                      }
                    >
                      {collapsed[cat.id] ? (
                        <ChevronRight size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}{" "}
                      {cat.name}
                    </button>
                    {!collapsed[cat.id] &&
                      details.channels
                        .filter((c) => c.categoryId === cat.id)
                        .map(channelRow)}
                  </div>
                ))}
                {details.channels
                  .filter(
                    (c) =>
                      !details.categories.some(
                        (cat) => cat.id === c.categoryId,
                      ),
                  )
                  .map(channelRow)}
              </>
            ) : (
              <div className="empty-side">Carregando canais…</div>
            )
          ) : (
            <>
              <button className="find" onClick={() => setSearch(true)}>
                <Search size={15} /> Buscar conversas <kbd>Ctrl K</kbd>
              </button>
              <div className="side-overline">SEU ESPAÇO</div>
              <button
                className="channel active"
                onClick={() => setTarget(null)}
              >
                <Users size={18} /> Visão geral
              </button>
              <div className="side-overline direct-label">
                MENSAGENS DIRETAS <span>{dms.length}</span>
              </div>
              {dms.length === 0 && (
                <p className="empty-side">Suas conversas aparecerão aqui.</p>
              )}
              {dms.map((dm) => (
                <button
                  key={dm.id}
                  className={`dm ${target?.conversationId === dm.id ? "active" : ""}`}
                  onClick={() => chooseDm(dm.id)}
                  onDoubleClick={() => void joinVoice({ conversationId: dm.id }, dm.name || label(dm.otherUser), true)}
                  title="Clique para conversar. Clique duplo para ligar."
                >
                  <Avatar
                    name={dm.name || label(dm.otherUser)}
                    src={dm.otherUser?.avatar}
                  />
                  <span className="dm-name">
                    {dm.name || label(dm.otherUser)}
                    <small>
                      {dm.lastMessage
                        ? dm.lastMessage.content
                        : dm.otherUser?.status === "online"
                          ? "Disponível"
                          : "Mensagem direta"}
                    </small>
                  </span>
                  {dm.unreadCount > 0 && (
                    <b className="badge">{dm.unreadCount}</b>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
        {voice && (
          <div className="voice-panel" aria-label="Chamada de voz">
            <div className="voice-head">
              <Phone size={16} />
              <span>
                <strong>{voice.label}</strong>
                <small>{voice.participants.length} na chamada</small>
              </span>
            </div>
            <ul className="voice-list">
              {voice.participants.map((p) => (
                <li key={p.userId}>
                  {p.userId === user.id ? "Você" : `Usuário ${p.userId}`}
                  {p.muted ? " · mudo" : ""}
                </li>
              ))}
            </ul>
            <div className="voice-actions">
              <button
                className="icon-button"
                title={voice.muted ? "Ativar microfone" : "Silenciar microfone"}
                aria-label={voice.muted ? "Ativar microfone" : "Silenciar microfone"}
                onClick={toggleVoiceMute}
              >
                {voice.muted ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button
                className="icon-button danger"
                title="Sair da chamada"
                aria-label="Sair da chamada"
                onClick={() => void leaveVoice()}
              >
                <PhoneOff size={17} />
              </button>
            </div>
          </div>
        )}
        <div className="user-panel">
          <Avatar name={label(user)} src={user.avatar} />
          <span>
            <strong>{label(user)}</strong>
            <small>{user.customStatus || "Sua conta Nexora"}</small>
          </span>
          <button className="icon-button" title="Configurações do aplicativo" aria-label="Configurações do aplicativo" onClick={() => setSettingsOpen(true)}><Settings size={17}/></button>
          <button
            className="icon-button"
            title="Encerrar sessão"
            aria-label="Encerrar sessão"
            onClick={() => void logout()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="top-title">
            {channel ? (
              <Hash size={21} />
            ) : dm ? (
              <MessageCircle size={20} />
            ) : (
              <Radio size={20} />
            )}
            <strong>{title}</strong>
            {channel?.topic && (
              <>
                <span className="top-separator" />
                <span className="topic">{channel.topic}</span>
              </>
            )}
          </div>
          <div className="top-actions">
            <span className="connection">
              <i className={connected ? "online" : ""} />
              {connected ? "Conectado" : "Reconectando"}
            </span>
            <button
              className="icon-button"
              title="Buscar"
              aria-label="Buscar"
              onClick={() => setSearch(true)}
            >
              <Search size={19} />
            </button>
            {details && (
              <button
                className="icon-button"
                title="Mostrar membros"
                aria-label="Mostrar membros"
                onClick={() => setMembers(!members)}
              >
                <PanelRight size={19} />
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="notice" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}
        {target ? (
          <>
            <div className="timeline" ref={timeline} key={target.channelId ? `c:${target.channelId}` : `dm:${target.conversationId}`} onScroll={(event) => { const node = event.currentTarget; setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 48); }}>
              {hasMore && (
                <button
                  className="load-more"
                  onClick={() => {
                    const node = timeline.current;
                    setAtBottom(false);
                    const oldHeight = node?.scrollHeight ?? 0;
                    const oldTop = node?.scrollTop ?? 0;
                    void loadMessages(target, messages[0]?.id).then(() => requestAnimationFrame(() => {
                      if (node && timeline.current === node) node.scrollTop = oldTop + node.scrollHeight - oldHeight;
                    })).catch((e) => setError(errorText(e)));
                  }}
                >
                  Carregar mensagens anteriores
                </button>
              )}
              {messageLoading && (
                <p className="timeline-status">Carregando mensagens…</p>
              )}
              {!messageLoading && messages.length === 0 && (
                <div className="conversation-start">
                  <span>
                    <Hash size={24} />
                  </span>
                  <h2>Este é o começo de {title}</h2>
                  <p>As mensagens desta conversa aparecem aqui.</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const day = new Date(msg.createdAt).toLocaleDateString(
                  "pt-BR",
                  { day: "numeric", month: "long", year: "numeric" },
                );
                const previous =
                  i > 0
                    ? new Date(messages[i - 1].createdAt).toLocaleDateString(
                        "pt-BR",
                        { day: "numeric", month: "long", year: "numeric" },
                      )
                    : "";
                return (
                  <div key={msg.id}>
                    {day !== previous && (
                      <div className="date-divider">
                        <span>{day}</span>
                      </div>
                    )}
                    <article className="message">
                      <Avatar
                        name={label(msg.author)}
                        src={msg.author.avatar}
                      />
                      <div className="message-body">
                        {msg.replyTo && <div className="reply-preview">↳ {label(msg.replyTo.author)}: {msg.replyTo.content}</div>}
                        <div className="message-meta">
                          <button type="button" className="author-link" onClick={() => setProfileUserId(msg.author.id)}><strong>{label(msg.author)}</strong></button>
                          <time>
                            {new Date(msg.createdAt).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </time>
                          {msg.editedAt && <small>editada</small>}
                        </div>
                        {editing === msg.id ? <form className="edit-message" onSubmit={async (event) => { event.preventDefault(); try { const result = await api<{ message: Message }>("message.edit", { messageId: msg.id, content: editText }); setMessages((old) => old.map((m) => m.id === msg.id ? result.message : m)); setEditing(null); } catch (err) { setError(errorText(err)); } }}><textarea value={editText} maxLength={4000} onChange={(event) => setEditText(event.target.value)} aria-label="Editar mensagem"/><div><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" disabled={!editText.trim()}>Salvar</button></div></form> : <p>{msg.content}</p>}
                        {!!msg.attachments?.length && <div className="attachments">{msg.attachments.map((file) => file.mimeType.startsWith("image/") ? <div key={file.id} className="attachment-image"><Media src={file.url} alt={file.filename}/></div> : <span key={file.id} className="attachment-link"><Paperclip size={14}/> {file.filename}</span>)}</div>}
                        {!!msg.reactions?.length && <div className="reactions">{msg.reactions.map((reaction) => <button type="button" key={reaction.emoji} className={reaction.userIds.includes(user.id) ? "mine" : ""} onClick={() => { const path = reaction.userIds.includes(user.id) ? "message.removeReaction" : "message.addReaction"; void api<{ reactions: Reaction[] }>(path, { messageId: msg.id, emoji: reaction.emoji }).then((result) => setMessages((old) => old.map((m) => m.id === msg.id ? { ...m, reactions: result.reactions } : m))).catch((err) => setError(errorText(err))); }}>{reaction.emoji} {reaction.count}</button>)}</div>}
                        <div className="message-actions">
                          <button type="button" title="Responder" aria-label="Responder" onClick={() => setReplying(msg)}><Reply size={15}/></button>
                          <button type="button" title="Reagir com 👍" aria-label="Reagir com 👍" onClick={() => { const mine = msg.reactions?.find((r) => r.emoji === "👍")?.userIds.includes(user.id); void api<{ reactions: Reaction[] }>(mine ? "message.removeReaction" : "message.addReaction", { messageId: msg.id, emoji: "👍" }).then((result) => setMessages((old) => old.map((m) => m.id === msg.id ? { ...m, reactions: result.reactions } : m))).catch((err) => setError(errorText(err))); }}><SmilePlus size={15}/></button>
                          {msg.authorId === user.id && <><button type="button" title="Editar" aria-label="Editar" onClick={() => { setEditing(msg.id); setEditText(msg.content); }}><Pencil size={15}/></button><button type="button" title="Excluir" aria-label="Excluir" onClick={() => { if (window.confirm("Excluir esta mensagem?")) void api("message.delete", { messageId: msg.id }).then(() => setMessages((old) => old.filter((m) => m.id !== msg.id))).catch((err) => setError(errorText(err))); }}><Trash2 size={15}/></button></>}
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>
            {replying && <div className="replying">Respondendo a <strong>{label(replying.author)}</strong><button type="button" aria-label="Cancelar resposta" onClick={() => setReplying(null)}><X size={15}/></button></div>}
            {Object.values(typingUsers).length > 0 && <div className="typing" role="status">{Object.values(typingUsers).map((person) => person.name).join(", ")} digitando…</div>}
            {pendingFiles.length > 0 && (
              <div className="pending-files">
                {pendingFiles.map((file) => (
                  <span className="pending-file" key={file.path}>
                    {file.name}
                    <button type="button" aria-label={`Remover ${file.name}`} onClick={() => setPendingFiles((files) => files.filter((f) => f.path !== file.path))}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form className="composer" onSubmit={send}>
              <button
                type="button"
                aria-label="Anexar arquivos"
                disabled={sending || pendingFiles.length >= 10}
                onClick={() => {
                  window.nexora.pickFiles()
                    .then((files) => setPendingFiles((old) => [...old, ...files].slice(0, 10)))
                    .catch((err) => setError(errorText(err)));
                }}
              >
                <Paperclip size={19} />
              </button>
              <textarea
                aria-label="Mensagem"
                placeholder={`Conversar em ${channel ? "#" : ""}${title}`}
                value={draft}
                maxLength={4000}
                onChange={(e) => { setDraft(e.target.value); if (e.target.value.trim()) void window.nexora.typing(target).catch((err) => setError(errorText(err))); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
                aria-label="Enviar mensagem"
              >
                <Send size={19} />
              </button>
            </form>
            <div className="composer-hint">
              ENTER PARA ENVIAR <span>·</span> SHIFT + ENTER PARA NOVA LINHA
            </div>
          </>
        ) : (
          <div className="welcome">
            <div className="welcome-orbit">
              <div className="orbit-one" />
              <div className="orbit-two" />
              <img src={icon} alt="" />
            </div>
            <div className="eyebrow">
              <span className="dot" /> SEU ESPAÇO NA NEXORA
            </div>
            <h1>
              Olá, {label(user)}
              <span>.</span>
            </h1>
            <p>
              É bom ter você por aqui. Escolha uma conversa ou comunidade para
              começar.
            </p>
            <button className="welcome-search" onClick={() => setSearch(true)}>
              <Search size={17} /> Encontrar uma conversa <kbd>Ctrl K</kbd>
            </button>
            <div className="welcome-cards">
              <div>
                <MessageCircle size={18} />
                <strong>Suas conversas</strong>
                <small>Continue de onde parou.</small>
              </div>
              <div>
                <Users size={18} />
                <strong>Suas comunidades</strong>
                <small>Encontre seu lugar.</small>
              </div>
            </div>
          </div>
        )}
      </main>
      {details && members && (
        <aside className="members">
          <div className="members-head">
            MEMBROS <span>{details.members.length}</span>
          </div>
          {details.members.map((m) => (
            <div className="member" key={m.user.id}>
              <Avatar name={m.nickname || label(m.user)} src={m.user.avatar} />
              <span>
                {m.nickname || label(m.user)}
                <small>
                  {m.user.status === "online"
                    ? "Online"
                    : m.user.status || "Offline"}
                </small>
              </span>
            </div>
          ))}
        </aside>
      )}
      {profileUserId !== null && <ProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />}
      {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="desktop-settings-title" onClick={(event) => event.stopPropagation()}><header><div><div className="eyebrow">NEXORA DESKTOP</div><h2 id="desktop-settings-title">Configurações</h2></div><button className="icon-button" aria-label="Fechar configurações" onClick={() => setSettingsOpen(false)}><X size={20}/></button></header><p>Preferências deste computador</p>{error && <div className="error" role="alert">{error}</div>}<label><span><strong>Notificações do sistema</strong><small>Avisos discretos, sem conteúdo da mensagem. Respeita o modo não perturbe e conversas silenciadas.</small></span><input type="checkbox" checked={desktopSettings?.notifications ?? false} disabled={!desktopSettings} onChange={(event) => void window.nexora.setSettings({ notifications: event.target.checked }).then(setDesktopSettings).catch((err) => setError(errorText(err)))}/></label><label><span><strong>Minimizar para a bandeja ao fechar</strong><small>{desktopSettings?.trayAvailable ? "A Nexora continua aberta em segundo plano." : "A bandeja não está disponível neste sistema."}</small></span><input type="checkbox" checked={desktopSettings?.minimizeToTray ?? false} disabled={!desktopSettings?.trayAvailable} onChange={(event) => void window.nexora.setSettings({ minimizeToTray: event.target.checked }).then(setDesktopSettings).catch((err) => setError(errorText(err)))}/></label><div className="update-box"><div><strong>Atualizações</strong><small>{updateText(update)}</small></div>{update.status === "ready" ? <button className="primary" onClick={() => void window.nexora.installUpdate().catch((err) => setError(errorText(err)))}>Reiniciar e atualizar</button> : <button onClick={() => void window.nexora.checkUpdates().then(setUpdate).catch((err) => setError(errorText(err)))} disabled={update.status === "checking" || update.status === "downloading" || update.status === "unsupported"}>Verificar agora</button>}</div><div className="settings-version">Nexora Desktop · {version || "versão indisponível"}</div></section></div>}
      {search && (
        <div className="modal-backdrop" onClick={() => setSearch(false)}>
          <div
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Busca rápida"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-input">
              <Search size={20} />
              <input
                autoFocus
                placeholder="Encontrar uma conversa ou servidor"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={() => setSearch(false)}>
                <ArrowLeft size={18} />
              </button>
            </div>
            <div className="search-results">
              <div className="side-overline">CONVERSAS</div>
              {dms
                .filter((d) =>
                  (d.name || label(d.otherUser))
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((d) => (
                  <button key={d.id} onClick={() => chooseDm(d.id)}>
                    <MessageCircle size={17} />
                    {d.name || label(d.otherUser)}
                  </button>
                ))}
              <div className="side-overline">SERVIDORES</div>
              {servers
                .filter((s) =>
                  s.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      chooseServer(s.id);
                      setSearch(false);
                    }}
                  >
                    <Hash size={17} />
                    {s.name}
                  </button>
                ))}
            </div>
            <div className="search-foot">
              Busca nas suas conversas e servidores carregados <kbd>ESC</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
