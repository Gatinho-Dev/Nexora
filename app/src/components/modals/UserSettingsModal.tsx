import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { apiUrl } from "@/lib/endpoints";
import { Camera, Mic, Moon, Sun, Monitor, X, Check } from "lucide-react";
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

type Tab =
  | "account"
  | "profile"
  | "privacy"
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
      { id: "account", label: "Minha conta" },
      { id: "profile", label: "Perfil" },
      { id: "privacy", label: "Privacidade" },
      { id: "connections", label: "Conexões" },
    ],
  },
  {
    title: "CONFIGURAÇÕES",
    items: [
      { id: "appearance", label: "Aparência" },
      { id: "accessibility", label: "Acessibilidade" },
      { id: "voice", label: "Voz e vídeo" },
      { id: "notifications", label: "Notificações" },
      { id: "shortcuts", label: "Atalhos" },
      { id: "language", label: "Idioma" },
    ],
  },
  {
    title: "APP",
    items: [{ id: "advanced", label: "Avançado" }],
  },
];

export function UserSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("account");

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
      <DialogContent className="max-w-4xl h-[640px] p-0 gap-0 overflow-hidden bg-[#313338] border-white/10 text-white rounded-2xl select-none">
        <DialogTitle className="sr-only">
          Configurações do Usuário Nexora
        </DialogTitle>
        <div className="flex h-full relative">
          {/* Left Navigation Sidebar */}
          <aside className="w-56 shrink-0 bg-[#2B2D31] p-4 border-r border-white/5 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="nexora-mark h-6 w-6 rounded-lg flex items-center justify-center font-bold text-xs">
                N
              </div>
              <span className="font-bold text-sm text-white tracking-wider">
                NEXORA
              </span>
            </div>

            {MENU_GROUPS.map(group => (
              <div key={group.title} className="mb-4">
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#B5BAC1]">
                  {group.title}
                </p>
                <nav className="space-y-0.5">
                  {group.items.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors flex items-center gap-2",
                        tab === t.id
                          ? "bg-[#5865F2]/20 text-[#5865F2]"
                          : "text-[#B5BAC1] hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span>{t.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            ))}
          </aside>

          {/* Right Main Content */}
          <div className="flex-1 min-w-0 bg-[#313338] relative">
            {/* ESC close button */}
            <div className="absolute top-5 right-6 z-20 flex items-center gap-1.5">
              <button
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center h-8 w-8 rounded-full border border-white/20 text-[#B5BAC1] hover:bg-white/10 hover:text-white transition-colors"
                title="Fechar (ESC)"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-bold text-[#B5BAC1] uppercase tracking-wider">
                ESC
              </span>
            </div>

            <ScrollArea className="h-full">
              <div className="p-8 max-w-xl">
                {tab === "account" && <AccountTab />}
                {tab === "profile" && <ProfileTab />}
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
        <p className="text-xs text-[#B5BAC1] mt-1">
          Gerencie suas credenciais e segurança de acesso à Nexora.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-[#2B2D31] border border-white/10 p-4 shadow-lg">
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
          <p className="text-xs text-[#B5BAC1] truncate">
            @{user?.username ?? "usuario-nexora"}
          </p>
        </div>
      </div>

      {user?.username ? (
        <div className="space-y-4 rounded-xl bg-[#2B2D31] border border-white/10 p-5">
          <h3 className="text-sm font-bold text-white">Alterar senha</h3>
          <div className="space-y-2">
            <Label htmlFor="cur-pass" className="text-xs text-[#B5BAC1]">
              Senha atual
            </Label>
            <Input
              id="cur-pass"
              type="password"
              className="bg-[#313338] border-white/10 text-white"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pass" className="text-xs text-[#B5BAC1]">
              Nova senha
            </Label>
            <Input
              id="new-pass"
              type="password"
              className="bg-[#313338] border-white/10 text-white"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conf-pass" className="text-xs text-[#B5BAC1]">
              Confirmar nova senha
            </Label>
            <Input
              id="conf-pass"
              type="password"
              className="bg-[#313338] border-white/10 text-white"
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
        <p className="text-xs text-[#B5BAC1]">
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      bio: bio.trim() || undefined,
      avatar: avatarUrl || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Perfil da Nexora</h2>
        <p className="text-xs text-[#B5BAC1] mt-1">
          Personalize como você aparece para seus amigos e comunidades.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            userId={user?.id}
            name={user?.name}
            src={avatarUrl || null}
            size="xl"
            showStatus={false}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 rounded-full bg-[#5865F2] p-2 text-white shadow-lg hover:bg-[#4752C4]"
            title="Alterar avatar"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                setUploading(true);
                const form = new FormData();
                form.append("file", file);
                fetch(apiUrl("/api/upload"), {
                  method: "POST",
                  body: form,
                  credentials: "include",
                })
                  .then(r => r.json())
                  .then(d => {
                    setAvatarUrl(d.url);
                    toast.success("Imagem enviada! Clique em salvar.");
                  })
                  .finally(() => setUploading(false));
              }
            }}
          />
        </div>
        <p className="text-xs text-[#B5BAC1]">Suporta PNG, JPG, WEBP ou GIF.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display-name" className="text-xs text-[#B5BAC1]">
          Nome de exibição
        </Label>
        <Input
          id="display-name"
          className="bg-[#2B2D31] border-white/10 text-white"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username" className="text-xs text-[#B5BAC1]">
          Nome de usuário (@username)
        </Label>
        <Input
          id="username"
          className="bg-[#2B2D31] border-white/10 text-white"
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase())}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio" className="text-xs text-[#B5BAC1]">
          Sobre mim
        </Label>
        <Textarea
          id="bio"
          className="bg-[#2B2D31] border-white/10 text-white"
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
        />
      </div>

      <Button
        onClick={save}
        disabled={updateProfile.isPending || uploading}
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
      <p className="text-xs text-[#B5BAC1]">
        Controle quem pode enviar mensagens diretas e solicitações de amizade na
        Nexora.
      </p>
      <div className="rounded-xl bg-[#2B2D31] border border-white/10 p-4 space-y-3 text-xs">
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
      <p className="text-xs text-[#B5BAC1]">
        Conecte suas contas para exibir no perfil da Nexora.
      </p>
      <div className="rounded-xl bg-[#2B2D31] border border-white/10 p-6 text-center text-xs text-[#B5BAC1]">
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
        <p className="text-xs text-[#B5BAC1] mt-1">
          Ajuste os efeitos sonoros originais e notificações da Nexora.
        </p>
      </div>

      <div className="rounded-xl bg-[#2B2D31] border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">
              Ativar efeitos sonoros
            </p>
            <p className="text-xs text-[#B5BAC1]">
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

      <div className="rounded-xl bg-[#2B2D31] border border-white/10 p-5 space-y-3 text-xs">
        <h3 className="text-xs font-bold uppercase text-[#B5BAC1] tracking-wider mb-2">
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
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [prefs, setPrefs] = useState(getDevicePrefs());
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const testStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const stopTest = () => {
    cancelAnimationFrame(rafRef.current);
    testStreamRef.current?.getTracks().forEach(t => t.stop());
    testStreamRef.current = null;
    setTesting(false);
    setLevel(0);
  };

  const loadDevices = async () => {
    try {
      const probe = await navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter(d => d.kind === "audioinput"));
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
    return () => {
      window.clearTimeout(loadTimer);
      cancelAnimationFrame(rafRef.current);
      testStreamRef.current?.getTracks().forEach(track => track.stop());
      testStreamRef.current = null;
    };
  }, []);

  const startTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: prefs.audioInputId
          ? { deviceId: { ideal: prefs.audioInputId } }
          : true,
      });
      testStreamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(100, Math.round((avg / 128) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const updatePref = (patch: Partial<ReturnType<typeof getDevicePrefs>>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setDevicePrefs(patch);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Voz e Vídeo</h2>
        <p className="text-xs text-[#B5BAC1] mt-1">
          Configure seus dispositivos de áudio e pré-visualize sua câmera.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-[#B5BAC1]">
          Dispositivo de Entrada (Microfone)
        </Label>
        <Select
          value={prefs.audioInputId ?? "default"}
          onValueChange={v =>
            updatePref({ audioInputId: v === "default" ? undefined : v })
          }
        >
          <SelectTrigger className="bg-[#2B2D31] border-white/10 text-white">
            <SelectValue placeholder="Microfone Padrão" />
          </SelectTrigger>
          <SelectContent className="bg-[#232428] border-white/10 text-white">
            <SelectItem value="default">Microfone Padrão</SelectItem>
            {audioInputs.map(d => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Microfone (${d.deviceId.slice(0, 6)})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-[#B5BAC1]">
          Dispositivo de Saída / Câmera
        </Label>
        <Select
          value={prefs.videoInputId ?? "default"}
          onValueChange={v =>
            updatePref({ videoInputId: v === "default" ? undefined : v })
          }
        >
          <SelectTrigger className="bg-[#2B2D31] border-white/10 text-white">
            <SelectValue placeholder="Câmera Padrão" />
          </SelectTrigger>
          <SelectContent className="bg-[#232428] border-white/10 text-white">
            <SelectItem value="default">Câmera Padrão</SelectItem>
            {videoInputs.map(d => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Câmera (${d.deviceId.slice(0, 6)})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mic Test Meter */}
      <div className="rounded-xl bg-[#2B2D31] border border-white/10 p-5 space-y-3">
        <Label className="text-xs text-white font-bold">
          Teste de Microfone
        </Label>
        <div className="h-3 w-full rounded-full bg-[#313338] overflow-hidden p-0.5 border border-white/5">
          <div
            className={cn(
              "h-full rounded-full transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-75",
              level > 60
                ? "bg-[#23A559]"
                : level > 25
                  ? "bg-amber-400"
                  : "bg-[#5865F2]"
            )}
            style={{ width: `${level}%` }}
          />
        </div>
        <Button
          variant={testing ? "destructive" : "secondary"}
          size="sm"
          onClick={() => (testing ? stopTest() : startTest())}
          className="text-xs font-bold"
        >
          <Mic className="h-3.5 w-3.5 mr-1.5" />
          {testing ? "Parar teste" : "Testar microfone"}
        </Button>
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
        <p className="text-xs text-[#B5BAC1] mt-1">
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
                : "border-white/10 bg-[#2B2D31] text-[#B5BAC1] hover:border-white/20 hover:text-white"
            )}
          >
            <opt.icon className="h-5 w-5 mb-2 text-[#5865F2]" />
            <p className="text-sm font-bold text-white">{opt.label}</p>
            <p className="text-[11px] text-[#B5BAC1] mt-1 leading-snug">
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
      <p className="text-xs text-[#B5BAC1]">
        Ajuste preferências de navegação e animações.
      </p>
      <div className="rounded-xl bg-[#2B2D31] border border-white/10 p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Reduzir animações</p>
            <p className="text-[#B5BAC1] text-[11px]">
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
      <div className="rounded-xl bg-[#2B2D31] border border-white/10 p-4 space-y-2 text-xs">
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
      <p className="text-xs text-[#B5BAC1]">
        Português (Brasil) - Idioma padrão da Nexora.
      </p>
    </div>
  );
}

function AdvancedTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Avançado</h2>
      <p className="text-xs text-[#B5BAC1]">
        Aceleração de hardware e estatísticas WebRTC.
      </p>
    </div>
  );
}
