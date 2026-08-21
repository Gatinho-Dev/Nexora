import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Camera, Mic, Moon, Sun, Monitor, Bell, BellOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type Tab = "account" | "profile" | "notifications" | "voice" | "appearance";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "Minha conta" },
  { id: "profile", label: "Perfil" },
  { id: "notifications", label: "Notificações" },
  { id: "voice", label: "Voz e vídeo" },
  { id: "appearance", label: "Aparência" },
];

export function UserSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("account");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[560px] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Configurações do usuário</DialogTitle>
        <div className="flex h-full">
          <aside className="w-48 shrink-0 bg-[var(--sidebar-bg)] p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Configurações
            </p>
            <nav className="space-y-0.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    tab === t.id
                      ? "bg-[var(--active-bg)] text-foreground"
                      : "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="flex-1 min-w-0 bg-[var(--chat-bg)]">
            <ScrollArea className="h-full">
              <div className="p-6">
                {tab === "account" && <AccountTab />}
                {tab === "profile" && <ProfileTab />}
                {tab === "notifications" && <NotificationsTab />}
                {tab === "voice" && <VoiceTab />}
                {tab === "appearance" && <AppearanceTab />}
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
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não corresponde à nova senha.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6 max-w-md">
      <h2 className="text-lg font-semibold">Minha conta</h2>
      <div className="flex items-center gap-4 rounded-lg border border-border p-4">
        <Avatar user={user} size="lg" showStatus={false} />
        <div className="min-w-0">
          <p className="font-medium truncate">{user?.name}</p>
          <p className="text-sm text-muted-foreground truncate">@{user?.username ?? "login-externo"}</p>
        </div>
      </div>

      {user?.username ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Alterar senha</h3>
          <div className="space-y-2">
            <Label htmlFor="cur-pass">Senha atual</Label>
            <Input
              id="cur-pass"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pass">Nova senha</Label>
            <Input
              id="new-pass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conf-pass">Confirmar nova senha</Label>
            <Input
              id="conf-pass"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            disabled={!currentPassword || newPassword.length < 6 || changePassword.isPending}
            onClick={submit}
          >
            {changePassword.isPending ? "Salvando..." : "Alterar senha"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta conta usa login externo (Kimi) e não possui senha local.
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
      toast.success("Perfil atualizado.");
      await refresh();
      utils.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setUsernameMut = trpc.account.setUsername.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no upload");
      setAvatarUrl(data.url);
      toast.success("Avatar enviado. Salve o perfil para aplicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (username.trim() && username.trim() !== user?.username) {
      try {
        await setUsernameMut.mutateAsync({ username: username.trim() });
      } catch {
        return; // erro já exibido via toast
      }
    }
    updateProfile.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      avatar: avatarUrl || undefined,
    });
  };

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold">Perfil</h2>
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
            className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-primary-foreground shadow hover:bg-primary/90"
            title="Alterar avatar"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, WEBP ou GIF.
          {uploading ? " Enviando..." : ""}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="display-name">Nome de exibição</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={64}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Nome de usuário</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          maxLength={32}
          placeholder="seu.usuario"
        />
        <p className="text-xs text-muted-foreground">
          Letras minúsculas, números, ponto e sublinhado. Usado em menções e busca de amigos.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Sobre mim</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} />
      </div>
      <Button onClick={save} disabled={updateProfile.isPending || uploading}>
        {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </div>
  );
}

// ── Notificações ──────────────────────────────────────────────
function NotificationsTab() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const request = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Notificações ativadas!");
    else toast.error("Permissão de notificação negada pelo navegador.");
  };

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold">Notificações</h2>
      <div className="flex items-start gap-3 rounded-lg border border-border p-4">
        {permission === "granted" ? (
          <Bell className="h-5 w-5 text-primary mt-0.5" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">Notificações do navegador</p>
          <p className="text-xs text-muted-foreground mt-1">
            Receba avisos de menções e mensagens diretas quando o Pulsar estiver em segundo plano.
            Estado atual:{" "}
            <strong>
              {permission === "granted" ? "ativadas" : permission === "denied" ? "bloqueadas" : "não solicitadas"}
            </strong>
            .
          </p>
          {permission === "default" && (
            <Button size="sm" className="mt-3" onClick={request}>
              Ativar notificações
            </Button>
          )}
          {permission === "denied" && (
            <p className="text-xs text-muted-foreground mt-2">
              Para reativar, altere a permissão nas configurações do site no seu navegador.
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        As notificações dentro do app (central de notificações) estão sempre ativas.
      </p>
    </div>
  );
}

// ── Voz e vídeo ───────────────────────────────────────────────
function VoiceTab() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [prefs, setPrefs] = useState(getDevicePrefs());
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const testStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const loadDevices = async () => {
    try {
      // Precisa de permissão para revelar os rótulos dos dispositivos
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
      probe?.getTracks().forEach((t) => t.stop());
    } catch {
      toast.error("Não foi possível listar os dispositivos.");
    }
  };

  useEffect(() => {
    loadDevices();
    return () => stopTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTest = () => {
    cancelAnimationFrame(rafRef.current);
    testStreamRef.current?.getTracks().forEach((t) => t.stop());
    testStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setTesting(false);
    setLevel(0);
  };

  const startTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: prefs.audioInputId ? { deviceId: { ideal: prefs.audioInputId } } : true,
      });
      testStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
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
      toast.error("Não foi possível acessar o microfone. Verifique a permissão.");
    }
  };

  const updatePref = (patch: Partial<ReturnType<typeof getDevicePrefs>>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setDevicePrefs(patch);
  };

  return (
    <div className="space-y-5 max-w-md">
      <h2 className="text-lg font-semibold">Voz e vídeo</h2>

      <div className="space-y-2">
        <Label>Microfone</Label>
        <Select
          value={prefs.audioInputId ?? "default"}
          onValueChange={(v) => updatePref({ audioInputId: v === "default" ? undefined : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Padrão do sistema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Padrão do sistema</SelectItem>
            {audioInputs.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Microfone ${d.deviceId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Câmera</Label>
        <Select
          value={prefs.videoInputId ?? "default"}
          onValueChange={(v) => updatePref({ videoInputId: v === "default" ? undefined : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Padrão do sistema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Padrão do sistema</SelectItem>
            {videoInputs.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Câmera ${d.deviceId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Teste de microfone</Label>
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-75",
                level > 60 ? "bg-green-500" : level > 25 ? "bg-yellow-500" : "bg-primary",
              )}
              style={{ width: `${level}%` }}
            />
          </div>
          <Button
            variant={testing ? "destructive" : "secondary"}
            size="sm"
            onClick={() => (testing ? stopTest() : startTest())}
          >
            <Mic className="h-4 w-4 mr-1.5" />
            {testing ? "Parar teste" : "Testar microfone"}
          </Button>
          {testing && (
            <p className="text-xs text-muted-foreground">Fale algo — a barra deve se mover.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        As preferências são salvas neste navegador e aplicadas na próxima vez que você entrar em uma chamada.
      </p>
    </div>
  );
}

// ── Aparência ─────────────────────────────────────────────────
function AppearanceTab() {
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const options: { id: Theme; label: string; description: string; icon: typeof Moon }[] = [
    { id: "dark", label: "Escuro", description: "Tema padrão do Pulsar.", icon: Moon },
    { id: "light", label: "Claro", description: "Para ambientes bem iluminados.", icon: Sun },
    { id: "system", label: "Sistema", description: "Segue a preferência do seu dispositivo.", icon: Monitor },
  ];

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold">Aparência</h2>
      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => {
              setTheme(opt.id);
              setThemeState(opt.id);
            }}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              theme === opt.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground/50",
            )}
          >
            <opt.icon className="h-5 w-5 mb-2" />
            <p className="text-sm font-medium">{opt.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
