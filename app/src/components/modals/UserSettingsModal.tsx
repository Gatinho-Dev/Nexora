import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { AccountStanding } from "../safety/AccountStanding";
import {
  IconMyAccount,
  IconEditProfile,
  IconNoVisibility,
  IconSoundCheck,
  IconPermissions,
} from "../icons/figmaChannelIcons";
import { toast } from "sonner";
import { apiUrl } from "@/lib/endpoints";
import {
  Camera,
  Mic,
  Moon,
  Sun,
  Monitor,
  X,
  Check,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar } from "../Avatar";
import { cn } from "@/lib/utils";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { getDevicePrefs, setDevicePrefs } from "@/lib/devices";
import { useAuth } from "@/hooks/useAuth";
import { soundManager, type SoundEvent } from "@/lib/sound";
import { voiceManager } from "@/lib/rtc";
import {
  createAudioProcessingSession,
  microphoneConstraints,
  type AudioProcessingSession,
} from "@/lib/voice/audioProcessing";
import { NexoraLogo, NexoraMark } from "@/components/NexoraBrand";

type Tab =
  | "account"
  | "profile"
  | "standing"
  | "privacy"
  | "sensitive"
  | "connections"
  | "appearance"
  | "accessibility"
  | "voice"
  | "notifications"
  | "shortcuts"
  | "language"
  | "advanced";

const MENU_GROUPS: {
  title: string;
  items: { id: Tab; label: string; icon?: React.ReactNode }[];
}[] = [
  {
    title: "MINHA CONTA",
    items: [
      { id: "account", label: "Minha conta", icon: <IconMyAccount className="h-4 w-4 text-faint" /> },
      { id: "profile", label: "Perfil", icon: <IconEditProfile className="h-4 w-4 text-faint" /> },
      { id: "standing", label: "Status da Conta" },
      { id: "privacy", label: "Conteúdo e Privacidade", icon: <IconNoVisibility className="h-4 w-4 text-faint" /> },
      { id: "connections", label: "Conexões" },
    ],
  },
  {
    title: "CONFIGURAÇÕES",
    items: [
      { id: "appearance", label: "Aparência" },
      { id: "accessibility", label: "Acessibilidade" },
      { id: "voice", label: "Voz e vídeo", icon: <IconSoundCheck className="h-4 w-4 text-faint" /> },
      { id: "notifications", label: "Notificações" },
      { id: "shortcuts", label: "Atalhos" },
      { id: "language", label: "Idioma" },
    ],
  },
  {
    title: "APP",
    items: [{ id: "advanced", label: "Avançado", icon: <IconPermissions className="h-4 w-4 text-faint" /> }],
  },
];

export function UserSettingsModal({
  open,
  onOpenChange,
  initialTab = "account",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[min(760px,calc(100dvh-1rem))] w-[min(1120px,calc(100vw-1rem))] max-w-none gap-0 overflow-hidden rounded-xl border-white/10 bg-chat p-0 text-white select-none sm:max-w-none sm:rounded-2xl"
      >
        <DialogTitle className="sr-only">
          Configurações do Usuário Nexora
        </DialogTitle>
        <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden sm:flex-row">
          {/* Left Navigation Sidebar */}
          <aside className="flex w-full min-w-0 max-w-full shrink-0 items-center gap-1 overflow-x-auto border-b border-white/5 bg-sidebar p-2 sm:block sm:h-full sm:w-56 sm:overflow-x-hidden sm:overflow-y-auto sm:border-r sm:border-b-0 sm:p-4">
            <div className="mb-4 hidden px-2 sm:block">
              <NexoraLogo className="h-6 w-auto" surface="dark" />
            </div>

            {MENU_GROUPS.map(group => (
              <div key={group.title} className="shrink-0 sm:mb-4">
                <p className="hidden px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted2 sm:block">
                  {group.title}
                </p>
                <nav className="flex gap-1 sm:block sm:space-y-0.5">
                  {group.items.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "flex w-auto items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors sm:w-full sm:py-1.5",
                        tab === t.id
                          ? "bg-[#5865F2]/20 text-[#5865F2]"
                          : "text-muted2 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {t.icon}
                      <span>{t.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            ))}
          </aside>

          {/* Right Main Content */}
          <div className="relative min-h-0 min-w-0 flex-1 bg-chat">
            {/* ESC close button */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 sm:top-5 sm:right-6">
              <button
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center h-8 w-8 rounded-full border border-white/20 text-muted2 hover:bg-white/10 hover:text-white transition-colors"
                title="Fechar (ESC)"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="hidden text-[10px] font-bold text-muted2 uppercase tracking-wider sm:inline">
                ESC
              </span>
            </div>

            <ScrollArea className="h-full">
              <div className="mx-auto w-full min-w-0 max-w-3xl p-4 pr-14 sm:p-8 sm:pr-20">
                {tab === "account" && <AccountTab />}
                {tab === "profile" && <ProfileTab />}
                {tab === "standing" && <StandingTab />}
                {tab === "sensitive" && <SensitiveContentTab />}
                {tab === "privacy" && <PrivacyTab />}
                {tab === "connections" && <ConnectionsTab />}
                {tab === "appearance" && <AppearanceTab />}
                {tab === "accessibility" && <AccessibilityTab />}
                {tab === "voice" && <VoiceTab />}
                {tab === "notifications" && <NotificationsTab />}
                {tab === "shortcuts" && <ShortcutsTab />}
                {tab === "language" && <LanguageTab />}
                {tab === "advanced" && <AdvancedTab />}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Minha conta ───────────────────────────────────────────────
function AccountTab() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = trpc.account.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: e => toast.error(e.message),
  });

  const submit = () => {
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não corresponde à nova senha.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Minha conta</h2>
        <p className="text-xs text-muted2 mt-1">
          Gerencie suas credenciais e segurança de acesso à Nexora.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-sidebar border border-white/10 p-4 shadow-lg">
        <Avatar
          userId={user?.id}
          name={user?.name}
          src={user?.avatar}
          size="lg"
          showStatus={false}
        />
        <div className="min-w-0">
          <p className="font-bold text-white text-base truncate">
            {user?.name}
          </p>
          <p className="text-xs text-muted2 truncate">
            @{user?.username ?? "usuario-nexora"}
          </p>
        </div>
      </div>

      {user?.username ? (
        <div className="space-y-4 rounded-xl bg-sidebar border border-white/10 p-5">
          <h3 className="text-sm font-bold text-white">Alterar senha</h3>
          <div className="space-y-2">
            <Label htmlFor="cur-pass" className="text-xs text-muted2">
              Senha atual
            </Label>
            <Input
              id="cur-pass"
              type="password"
              className="bg-chat border-white/10 text-white"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pass" className="text-xs text-muted2">
              Nova senha
            </Label>
            <Input
              id="new-pass"
              type="password"
              className="bg-chat border-white/10 text-white"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conf-pass" className="text-xs text-muted2">
              Confirmar nova senha
            </Label>
            <Input
              id="conf-pass"
              type="password"
              className="bg-chat border-white/10 text-white"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium"
            disabled={
              !currentPassword ||
              newPassword.length < 6 ||
              changePassword.isPending
            }
            onClick={submit}
          >
            {changePassword.isPending ? "Salvando..." : "Alterar senha"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted2">
          Esta conta utiliza autenticação externa da plataforma.
        </p>
      )}
    </div>
  );
}

// ── Perfil ────────────────────────────────────────────────────
function ProfileTab() {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar ?? "");
  const [bannerUrl, setBannerUrl] = useState(user?.banner ?? "");
  const [uploadingTarget, setUploadingTarget] = useState<
    "avatar" | "banner" | null
  >(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const updateProfile = trpc.account.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Perfil da Nexora atualizado.");
      await refresh();
      utils.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const setUsernameMut = trpc.account.setUsername.useMutation({
    onError: e => toast.error(e.message),
  });

  const save = async () => {
    if (username.trim() && username.trim() !== user?.username) {
      try {
        await setUsernameMut.mutateAsync({ username: username.trim() });
      } catch {
        return;
      }
    }
    updateProfile.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim(),
      avatar: avatarUrl,
      banner: bannerUrl,
    });
  };

  const uploadImage = async (file: File, target: "avatar" | "banner") => {
    setUploadingTarget(target);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Não foi possível enviar a imagem.");
      }
      if (target === "avatar") setAvatarUrl(data.url);
      else setBannerUrl(data.url);
      toast.success(
        `${target === "avatar" ? "Avatar" : "Banner"} enviado. Clique em salvar para aplicar.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao enviar a imagem."
      );
    } finally {
      setUploadingTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Perfil da Nexora</h2>
        <p className="text-xs text-muted2 mt-1">
          Personalize como você aparece para seus amigos e comunidades.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#23252D]">
        <div className="relative h-32 overflow-hidden bg-[#1B2037]">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt="Prévia do seu banner"
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <NexoraMark
                decorative
                className="absolute -right-7 -top-12 h-48 w-48 rotate-6 opacity-[0.13]"
              />
              <div className="absolute bottom-0 left-0 h-1 w-2/3 bg-[#5865F2]" />
              <div className="absolute bottom-0 right-0 h-1 w-1/3 bg-[#7383FF]" />
            </>
          )}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {bannerUrl && (
              <button
                type="button"
                onClick={() => setBannerUrl("")}
                className="min-h-9 rounded-lg border border-white/10 bg-[#11131A]/85 px-3 text-[11px] font-semibold text-bodyx hover:bg-[#11131A] hover:text-white"
              >
                Remover banner
              </button>
            )}
            <button
              type="button"
              onClick={() => bannerFileRef.current?.click()}
              disabled={uploadingTarget !== null}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#11131A]/85 px-3 text-[11px] font-semibold text-white hover:bg-[#11131A] disabled:opacity-60"
              aria-label="Alterar banner"
              title="Alterar banner"
            >
              <Camera className="h-3.5 w-3.5" />
              {uploadingTarget === "banner" ? "Enviando..." : "Alterar banner"}
            </button>
          </div>
          <input
            ref={bannerFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file, "banner");
              event.target.value = "";
            }}
          />
        </div>

        <div className="flex items-end gap-4 px-4 pb-4">
          <div className="relative -mt-9 rounded-full border-4 border-[#23252D] bg-[#23252D]">
            <Avatar
              userId={user?.id}
              name={displayName || user?.name}
              src={avatarUrl || null}
              size="xl"
              showStatus={false}
            />
            <button
              type="button"
              onClick={() => avatarFileRef.current?.click()}
              disabled={uploadingTarget !== null}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#5865F2] text-white shadow-lg hover:bg-[#4752C4] disabled:opacity-60"
              aria-label="Alterar avatar"
              title="Alterar avatar"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void uploadImage(file, "avatar");
                event.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0 pb-1">
            <p className="truncate text-sm font-bold text-white">
              {displayName || user?.name || "Seu perfil"}
            </p>
            <p className="truncate text-[11px] text-faint">
              @{username || user?.username || "sem-usuario"}
            </p>
            <p className="mt-1 text-[10px] text-faint">
              PNG, JPG, WEBP ou GIF
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display-name" className="text-xs text-muted2">
          Nome de exibição
        </Label>
        <Input
          id="display-name"
          className="bg-sidebar border-white/10 text-white"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username" className="text-xs text-muted2">
          Nome de usuário (@username)
        </Label>
        <Input
          id="username"
          className="bg-sidebar border-white/10 text-white"
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase())}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio" className="text-xs text-muted2">
          Sobre mim
        </Label>
        <Textarea
          id="bio"
          className="bg-sidebar border-white/10 text-white"
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
        />
      </div>

      <Button
        onClick={save}
        disabled={updateProfile.isPending || uploadingTarget !== null}
        className="bg-[#5865F2] hover:bg-[#4752C4]"
      >
        {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Privacidade e Segurança</h2>
      <p className="text-xs text-muted2">
        Controle quem pode enviar mensagens diretas e solicitações de amizade na
        Nexora.
      </p>
      <div className="rounded-xl bg-sidebar border border-white/10 p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span>Permitir mensagens diretas de membros do servidor</span>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <span>Filtro de mensagens diretas de desconhecidos</span>
          <Switch defaultChecked />
        </div>
      </div>
    </div>
  );
}

function ConnectionsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Conexões</h2>
      <p className="text-xs text-muted2">
        Conecte suas contas para exibir no perfil da Nexora.
      </p>
      <div className="rounded-xl bg-sidebar border border-white/10 p-6 text-center text-xs text-muted2">
        Nenhuma integração externa vinculada ainda.
      </div>
    </div>
  );
}

// ── Notificações (Com controle de som!) ───────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = useState(() => soundManager.getPrefs());

  const updateSound = (
    patch: Partial<ReturnType<typeof soundManager.getPrefs>>
  ) => {
    soundManager.savePrefs(patch);
    setPrefs(soundManager.getPrefs());
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Notificações e Som</h2>
        <p className="text-xs text-muted2 mt-1">
          Ajuste os efeitos sonoros originais e notificações da Nexora.
        </p>
      </div>

      <div className="rounded-xl bg-sidebar border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">
              Ativar efeitos sonoros
            </p>
            <p className="text-xs text-muted2">
              Sons de chamadas, mutes, DMs e avisos da Nexora.
            </p>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={enabled => updateSound({ enabled })}
          />
        </div>

        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white">Volume dos sons</span>
            <span className="font-mono text-[#5865F2]">
              {prefs.masterVolume}%
            </span>
          </div>
          <Slider
            value={[prefs.masterVolume]}
            min={0}
            max={100}
            step={1}
            onValueChange={([val]) => updateSound({ masterVolume: val })}
            className="w-full"
          />
        </div>
      </div>

      <div className="rounded-xl bg-sidebar border border-white/10 p-5 space-y-3 text-xs">
        <h3 className="text-xs font-bold uppercase text-muted2 tracking-wider mb-2">
          Eventos de Som Individuais
        </h3>
        {(
          [
            ["join", "Entrada na chamada"],
            ["leave", "Saída da chamada"],
            ["mute", "Microfone mutado"],
            ["unmute", "Microfone desmutado"],
            ["deafen", "Áudio ensurdecido"],
            ["undeafen", "Áudio ativado"],
            ["dm-message", "Mensagens diretas"],
            ["notification", "Menções e notificações"],
            ["screen-start", "Compartilhamento de tela iniciado"],
          ] as const
        ).map(([eventKey, label]) => (
          <div key={eventKey} className="flex items-center justify-between">
            <span className="text-white/90">{label}</span>
            <Switch
              checked={prefs.events[eventKey as SoundEvent] ?? true}
              onCheckedChange={val =>
                updateSound({
                  events: { ...prefs.events, [eventKey]: val },
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Voz e vídeo (Dispositivos + Medidor de Mic) ───────────────
function VoiceTab() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [prefs, setPrefs] = useState(getDevicePrefs());
  const [testing, setTesting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const testSessionRef = useRef<AudioProcessingSession | null>(null);
  const testContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number>(0);
  const supportsOutputSelection =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  const stopTest = async () => {
    cancelAnimationFrame(rafRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    await testSessionRef.current?.close();
    testSessionRef.current = null;
    if (testContextRef.current?.state !== "closed") {
      await testContextRef.current?.close().catch(() => {});
    }
    testContextRef.current = null;
    setTesting(false);
    setRecording(false);
    setLevel(0);
  };

  const loadDevices = async () => {
    try {
      const probe = await navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter(d => d.kind === "audioinput"));
      setAudioOutputs(devices.filter(d => d.kind === "audiooutput"));
      setVideoInputs(devices.filter(d => d.kind === "videoinput"));
      probe?.getTracks().forEach(t => t.stop());
    } catch {
      // failure fallback
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadDevices();
    }, 0);
    navigator.mediaDevices?.addEventListener("devicechange", loadDevices);
    return () => {
      window.clearTimeout(loadTimer);
      cancelAnimationFrame(rafRef.current);
      navigator.mediaDevices?.removeEventListener("devicechange", loadDevices);
      void stopTest();
    };
  }, []);

  useEffect(
    () => () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    },
    [recordingUrl]
  );

  const startTest = async () => {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: microphoneConstraints(prefs),
        video: false,
      });
      const session = await createAudioProcessingSession(rawStream, prefs);
      testSessionRef.current = session;
      const ctx = new AudioContext({ latencyHint: "interactive" });
      testContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(session.outputStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        const energy = data.reduce((sum, sample) => sum + sample * sample, 0);
        setLevel(
          Math.min(100, Math.round(Math.sqrt(energy / data.length) * 700))
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const updatePref = async (
    patch: Partial<ReturnType<typeof getDevicePrefs>>
  ) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setDevicePrefs(patch);
    try {
      if ("audioInputId" in patch) {
        await voiceManager.switchAudioInput(patch.audioInputId);
      } else if ("videoInputId" in patch) {
        await voiceManager.switchVideoInput(patch.videoInputId);
      } else if ("audioProcessing" in patch) {
        await voiceManager.reconfigureAudioProcessing();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível trocar o dispositivo."
      );
    }
  };

  const recordSample = async () => {
    if (!testSessionRef.current) await startTest();
    const stream = testSessionRef.current?.outputStream;
    if (!stream || typeof MediaRecorder === "undefined") {
      toast.error("A gravação de teste não é suportada neste navegador.");
      return;
    }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = event => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      setRecordingUrl(
        URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }))
      );
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
    window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 4_000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Voz e Vídeo</h2>
        <p className="text-xs text-muted2 mt-1">
          Configure seus dispositivos de áudio e pré-visualize sua câmera.
        </p>
      </div>

      <section
        className="rounded-xl border border-[#7383FF]/40 bg-[#5865F2]/10 p-5 space-y-3"
        aria-labelledby="noise-suppression-heading"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5865F2] text-white">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p
              id="noise-suppression-heading"
              className="text-sm font-bold text-white"
            >
              Supressão de ruído
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted2">
              Escolha o áudio nativo do navegador ou o processamento Nexora
              ClearVoice. A chamada continua com fallback automático se o modo
              avançado não estiver disponível.
            </p>
          </div>
        </div>
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Modo de supressão de ruído"
        >
          {(
            [
              ["off", "Desligado", "Áudio sem redução"],
              ["standard", "Padrão", "Processamento do navegador"],
              ["clearvoice", "ClearVoice", "Pipeline de áudio Nexora"],
            ] as const
          ).map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={prefs.audioProcessing === value}
              onClick={() => void updatePref({ audioProcessing: value })}
              className={cn(
                "min-h-16 rounded-lg border px-3 py-2 text-left transition-colors",
                prefs.audioProcessing === value
                  ? "border-[#7383FF] bg-[#5865F2]/25 text-white"
                  : "border-white/[0.08] bg-[#24252b] text-[#aeb1bd] hover:border-white/20 hover:text-white"
              )}
            >
              <span className="block text-xs font-bold">{label}</span>
              <span className="mt-1 block text-[10px] leading-snug opacity-75">
                {description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        <Label className="text-xs text-muted2">
          Dispositivo de Entrada (Microfone)
        </Label>
        <Select
          value={prefs.audioInputId ?? "default"}
          onValueChange={v =>
            void updatePref({ audioInputId: v === "default" ? undefined : v })
          }
        >
          <SelectTrigger className="bg-sidebar border-white/10 text-white">
            <SelectValue placeholder="Microfone Padrão" />
          </SelectTrigger>
          <SelectContent className="bg-panel border-white/10 text-white">
            <SelectItem value="default">Microfone Padrão</SelectItem>
            {audioInputs
              .filter(d => d.deviceId !== "default")
              .map(d => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone (${d.deviceId.slice(0, 6)})`}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted2">Dispositivo de saída</Label>
        <Select
          disabled={!supportsOutputSelection}
          value={prefs.audioOutputId ?? "default"}
          onValueChange={value =>
            void updatePref({
              audioOutputId: value === "default" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="bg-sidebar border-white/10 text-white">
            <SelectValue placeholder="Saída padrão" />
          </SelectTrigger>
          <SelectContent className="bg-panel border-white/10 text-white">
            <SelectItem value="default">Saída padrão</SelectItem>
            {audioOutputs
              .filter(device => device.deviceId !== "default")
              .map(device => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Saída (${device.deviceId.slice(0, 6)})`}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {!supportsOutputSelection && (
          <p className="text-[11px] text-[#8f93a1]">
            Este navegador usa a saída definida pelo sistema operacional.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted2">Câmera</Label>
        <Select
          value={prefs.videoInputId ?? "default"}
          onValueChange={v =>
            void updatePref({ videoInputId: v === "default" ? undefined : v })
          }
        >
          <SelectTrigger className="bg-sidebar border-white/10 text-white">
            <SelectValue placeholder="Câmera Padrão" />
          </SelectTrigger>
          <SelectContent className="bg-panel border-white/10 text-white">
            <SelectItem value="default">Câmera Padrão</SelectItem>
            {videoInputs
              .filter(d => d.deviceId !== "default")
              .map(d => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Câmera (${d.deviceId.slice(0, 6)})`}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl bg-sidebar border border-white/10 p-5 space-y-4">
        <Label className="text-xs text-white font-bold">
          Teste de Microfone
        </Label>
        <div className="h-3 w-full rounded-full bg-chat overflow-hidden p-0.5 border border-white/5">
          <div
            className={cn(
              "h-full rounded-full transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-75",
              level > 12 ? "bg-[#55d98b]" : "bg-[#5865F2]"
            )}
            style={{ width: `${level}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={testing ? "destructive" : "secondary"}
            size="sm"
            onClick={() => (testing ? void stopTest() : void startTest())}
            className="text-xs font-bold"
          >
            <Mic className="h-3.5 w-3.5 mr-1.5" />
            {testing ? "Parar teste" : "Testar microfone"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={recording}
            onClick={() => void recordSample()}
            className="text-xs font-bold"
          >
            {recording ? (
              <Square className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {recording ? "Gravando 4 s" : "Gravar amostra"}
          </Button>
        </div>
        {recordingUrl && (
          <audio
            src={recordingUrl}
            controls
            className="h-9 w-full"
            aria-label="Reproduzir amostra do microfone"
          />
        )}
      </div>

      <div className="rounded-xl bg-sidebar border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-white">
              Sensibilidade automática
            </p>
            <p className="mt-1 text-[11px] text-[#8f93a1]">
              Adapta o indicador ao ruído do ambiente.
            </p>
          </div>
          <Switch
            checked={prefs.inputSensitivityMode !== "manual"}
            onCheckedChange={checked =>
              void updatePref({
                inputSensitivityMode: checked ? "automatic" : "manual",
              })
            }
          />
        </div>
        {prefs.inputSensitivityMode === "manual" && (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-[#aeb1bd]">
              <span>Mais seletivo</span>
              <span>Mais sensível</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[prefs.inputSensitivity ?? 28]}
              onValueChange={([value]) => {
                setPrefs(current => ({ ...current, inputSensitivity: value }));
                setDevicePrefs({ inputSensitivity: value });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aparência (Tema Nexora) ────────────────────────────────────
function AppearanceTab() {
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const options: {
    id: Theme;
    label: string;
    description: string;
    icon: typeof Moon;
  }[] = [
    {
      id: "dark",
      label: "Escuro Nexora",
      description: "Tema escuro oficial da Nexora com detalhes luminosos.",
      icon: Moon,
    },
    {
      id: "light",
      label: "Claro",
      description: "Visual claro para ambientes iluminados.",
      icon: Sun,
    },
    {
      id: "system",
      label: "Sistema",
      description: "Acompanha o modo do sistema operacional.",
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Aparência da Nexora</h2>
        <p className="text-xs text-muted2 mt-1">
          Escolha o tema visual para a plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => {
              setTheme(opt.id);
              setThemeState(opt.id);
            }}
            className={cn(
              "rounded-xl border p-4 text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] relative overflow-hidden select-none",
              theme === opt.id
                ? "border-[#5865F2] bg-[#5865F2]/10 text-white shadow-lg shadow-[#5865F2]/10"
                : "border-white/10 bg-sidebar text-muted2 hover:border-white/20 hover:text-white"
            )}
          >
            <opt.icon className="h-5 w-5 mb-2 text-[#5865F2]" />
            <p className="text-sm font-bold text-white">{opt.label}</p>
            <p className="text-[11px] text-muted2 mt-1 leading-snug">
              {opt.description}
            </p>
            {theme === opt.id && (
              <div className="absolute top-2 right-2 text-[#5865F2]">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccessibilityTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Acessibilidade</h2>
      <p className="text-xs text-muted2">
        Ajuste preferências de navegação e animações.
      </p>
      <div className="rounded-xl bg-sidebar border border-white/10 p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Reduzir animações</p>
            <p className="text-muted2 text-[11px]">
              Desativa transições para movimentação reduzida.
            </p>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  );
}

function ShortcutsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Atalhos do Teclado</h2>
      <div className="rounded-xl bg-sidebar border border-white/10 p-4 space-y-2 text-xs">
        <div className="flex justify-between py-1 border-b border-white/5">
          <span>Quick Switcher</span>
          <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-[10px]">
            Ctrl + K
          </kbd>
        </div>
        <div className="flex justify-between py-1 border-b border-white/5">
          <span>Mutar / Desmutar</span>
          <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-[10px]">
            Ctrl + Shift + M
          </kbd>
        </div>
        <div className="flex justify-between py-1">
          <span>Fechar modais</span>
          <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-[10px]">
            ESC
          </kbd>
        </div>
      </div>
    </div>
  );
}

function LanguageTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Idioma</h2>
      <p className="text-xs text-muted2">
        Português (Brasil) - Idioma padrão da Nexora.
      </p>
    </div>
  );
}

function AdvancedTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Avançado</h2>
      <p className="text-xs text-muted2">
        Aceleração de hardware e estatísticas WebRTC.
      </p>
    </div>
  );
}

// ── Status da Conta (Account Standing) ─────────────────────────
function StandingTab() {
  const { user } = useAuth();
  const safety = trpc.safety.me.useQuery();
  const setSensitiveMediaPref = useAppStore(s => s.setSensitiveMediaPref);

  useEffect(() => {
    if (safety.data) {
      setSensitiveMediaPref(safety.data.safety.sensitiveMediaPref);
    }
  }, [safety.data, setSensitiveMediaPref]);

  if (!user || safety.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted2">
        Carregando status da conta...
      </div>
    );
  }
  if (!safety.data) return null;

  return (
    <AccountStanding
      user={{
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar ?? null,
      }}
      safety={safety.data.safety}
      violations={safety.data.violations}
    />
  );
}

// ── Conteúdo Sensível ──────────────────────────────────────────
const SENSITIVE_OPTIONS: {
  value: "hide" | "warn" | "auto";
  label: string;
  desc: string;
}[] = [
  { value: "hide", label: "Sempre ocultar", desc: "Mídia sensível nunca é revelada por você." },
  { value: "warn", label: "Mostrar com aviso", desc: "Mídia +18 aparece borrada até você clicar em mostrar." },
  { value: "auto", label: "Mostrar automaticamente", desc: "Disponível apenas para contas elegíveis." },
];

function SensitiveContentTab() {
  const utils = trpc.useUtils();
  const safety = trpc.safety.me.useQuery();
  const setPref = trpc.safety.setSensitiveMediaPref.useMutation({
    onSuccess: data => {
      void utils.safety.me.invalidate();
      void data;
    },
    onError: e => toast.error(e.message),
  });
  const storePref = useAppStore(s => s.sensitiveMediaPref);
  const setStorePref = useAppStore(s => s.setSensitiveMediaPref);

  const current = safety.data?.safety.sensitiveMediaPref ?? storePref;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold">Conteúdo Sensível</h3>
        <p className="mt-1 text-xs text-muted2">
          Controla como o Nexora exibe mídias marcadas como sensíveis pela
          verificação automática de segurança.
        </p>
      </div>
      <div className="space-y-2">
        {SENSITIVE_OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              current === opt.value
                ? "border-[#5865F2]/60 bg-[#5865F2]/[0.08]"
                : "border-white/10 hover:bg-white/[0.04]",
              opt.value === "auto" && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="radio"
              name="sensitive-pref"
              className="mt-0.5 accent-[#5865F2]"
              checked={current === opt.value}
              disabled={opt.value === "auto"}
              onChange={() => {
                setStorePref(opt.value);
                setPref.mutate({ pref: opt.value });
              }}
            />
            <span>
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-faint">
                {opt.desc}
              </span>
            </span>
          </label>
        ))}
        <p className="text-[11px] text-faint">
          A opção automática exige verificação de idade na sua conta.
        </p>
      </div>
    </div>
  );
}
