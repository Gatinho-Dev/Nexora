import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "./Avatar";
import { statusColor } from "@/lib/statusColor";
import { useAppStore } from "@/store/useAppStore";
import { realtime } from "@/lib/ws";
import { voiceManager } from "@/lib/rtc";
import { UserSettingsModal } from "./modals/UserSettingsModal";
import { NexoraMark } from "./NexoraBrand";
import { BadgeIcon } from "./badges/BadgeUI";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  ChevronRight,
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Settings,
  LogOut,  Pencil,
  PhoneOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { UserStatus } from "@contracts/constants";

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  idle: "Ausente",
  dnd: "Não perturbe",
  invisible: "Invisível",
  offline: "Offline",
};

export function UserPanel() {
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account" | "profile">(
    "account"
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const wsConnected = useAppStore(s => s.wsConnected);
  const inVoice = useAppStore(
    s => s.voiceChannelId !== null || s.voiceConversationId !== null
  );
  const muted = useAppStore(s => s.muted);
  const deafened = useAppStore(s => s.deafened);
  const voiceConnectionStatus = useAppStore(s => s.voiceConnectionStatus);
  const myBadges = trpc.badge.mine.useQuery();
  const myStatus = useAppStore(s => (user ? s.presence[user.id] : undefined));

  if (!user) return null;

  const setStatus = (status: UserStatus) => {
    realtime.send({ t: "presence", status });
    useAppStore
      .getState()
      .setPresence(user.id, status === "invisible" ? "offline" : status);
  };

  const openSettings = (tab: "account" | "profile") => {
    setProfileOpen(false);
    setSettingsTab(tab);
    requestAnimationFrame(() => setSettingsOpen(true));
  };

  const profile = user as typeof user & {
    banner?: string | null;
  };
  const currentStatus = myStatus ?? user.status ?? "online";

  return (
    <div className="bg-panel border-t border-black/20 select-none">
      {/* Voice status bar if in call */}
      {inVoice && (
        <div className="px-3 py-2 flex items-center justify-between bg-panel border-b border-black/20 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1 font-semibold",
                wsConnected ? "text-[hsl(var(--presence-online))]" : "text-amber-500"
              )}
            >
              {wsConnected ? (
                <Wifi className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {voiceConnectionStatus === "connected"
                ? "Voz conectada"
                : voiceConnectionStatus === "failed"
                  ? "Falha na voz"
                  : "Reconectando..."}
            </span>
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => voiceManager.leave()}
                  className="p-1 rounded text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                  aria-label="Desconectar da chamada"
                  title="Desconectar da chamada"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Desconectar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* User profile row — fixed 52px height per design spec */}
      <div className="h-[52px] px-2 py-1 flex items-center justify-between gap-1.5">
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex h-full min-h-0 items-center gap-2.5 flex-1 min-w-0 rounded-md hover:bg-hov p-1 transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Abrir meu perfil"
              aria-expanded={profileOpen}
              title="Meu perfil"
            >
              <Avatar
                userId={user.id}
                name={user.name ?? user.username}
                src={user.avatar}
                size="sm"
                showStatus
                statusOverride={currentStatus}
                statusBorderColor="#232428"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground truncate">
                  {user.name ?? user.username}
                </div>
                <div className="text-[11px] text-muted2 truncate flex items-center gap-1">
                  <span>@{user.username}</span>
                </div>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={8}
            className="w-[min(320px,calc(100vw-1rem))] overflow-hidden rounded-2xl border-black/10 dark:border-white/10 bg-popover text-popover-foreground p-0 shadow-2xl"
          >
            <div className="relative h-20 overflow-hidden bg-hov">
              {profile.banner ? (
                <img
                  src={profile.banner}
                  alt="Meu banner"
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <NexoraMark
                    decorative
                    className="absolute -right-5 -top-9 h-36 w-36 rotate-6 opacity-[0.13]"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-primary" />
                </>
              )}
            </div>

            <div className="px-4 pb-4">
              <div className="-mt-7 flex items-end justify-between gap-3">
                <div className="rounded-full border-4 border-popover bg-popover">
                  <Avatar
                    userId={user.id}
                    name={user.name ?? user.username}
                    src={user.avatar}
                    size="lg"
                    showStatus
                    statusOverride={currentStatus}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => openSettings("profile")}
                  className="mb-0.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar perfil
                </button>
              </div>

              <div className="mt-2 min-w-0">
                <p className="truncate text-base font-bold text-foreground">
                  {user.name ?? user.username}
                </p>
                <p className="truncate text-xs text-muted2">
                  @{user.username ?? "sem-usuario"}
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-black/[0.06] dark:border-white/[0.07] bg-panel p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                  Sobre mim
                </p>
                <p
                  className={cn(
                    "mt-1.5 whitespace-pre-wrap text-xs leading-5",
                    user.bio ? "text-bodyx" : "text-faint"
                  )}
                >
                  {user.bio ||
                    "Adicione uma biografia para completar seu perfil."}
                </p>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                    Emblemas
                  </p>
                  <span className="text-[10px] text-faint">
                    {myBadges.data?.length ?? 0}
                  </span>
                </div>
                {myBadges.data?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {myBadges.data.slice(0, 6).map(badge => (
                      <span
                        key={badge.id}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 text-[10px] font-semibold text-bodyx"
                        title={badge.description ?? badge.name}
                      >
                        <BadgeIcon badge={badge} size={14} />
                        {badge.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-[11px] text-faint">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Espaço reservado para seus emblemas
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-white/[0.07] pt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                  Status
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["online", "idle", "dnd", "invisible"] as const).map(
                    status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatus(status)}
                        className={cn(
                          "flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-left text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          currentStatus ===
                            (status === "invisible" ? "offline" : status)
                            ? "bg-black/[0.06] text-foreground"
                            : "text-muted2 hover:bg-hov hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            statusColor(status)
                          )}
                        />
                        {STATUS_LABELS[status]}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-white/[0.07] pt-3">
                <button
                  type="button"
                  onClick={() => openSettings("account")}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-bodyx transition-colors hover:bg-hov focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Settings className="h-4 w-4 text-faint" />
                  Configurações
                  <ChevronRight className="ml-auto h-4 w-4 text-faint" />
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Sair da Nexora
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-0.5">
            {/* Microphone Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => voiceManager.toggleMute()}
                  className={cn(
                    "h-9 w-9 inline-flex items-center justify-center rounded-md transition-colors",
                    muted
                      ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                      : "text-muted2 hover:bg-black/[0.06] hover:text-foreground"
                  )}
                  aria-label={
                    muted ? "Ativar microfone" : "Silenciar microfone"
                  }
                  title={muted ? "Ativar microfone" : "Silenciar microfone"}
                >
                  {muted ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {muted ? "Desmutar" : "Silenciar"}
              </TooltipContent>
            </Tooltip>

            {/* Headphones / Deafen Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => voiceManager.toggleDeafen()}
                  className={cn(
                    "h-9 w-9 inline-flex items-center justify-center rounded-md transition-colors",
                    deafened
                      ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                      : "text-muted2 hover:bg-black/[0.06] hover:text-foreground"
                  )}
                  aria-label={deafened ? "Ativar áudio" : "Ensurdecer áudio"}
                  title={deafened ? "Ativar áudio" : "Ensurdecer áudio"}
                >
                  {deafened ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Headphones className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {deafened ? "Desensurdecer" : "Ensurdecer"}
              </TooltipContent>
            </Tooltip>

            {/* Settings Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => openSettings("account")}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted2 hover:bg-hov hover:text-white transition-colors"
                  aria-label="Abrir configurações de usuário"
                  title="Configurações de usuário"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Configurações de usuário
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <UserSettingsModal
        key={settingsTab}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
      />
    </div>
  );
}
