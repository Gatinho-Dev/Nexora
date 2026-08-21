import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, statusColor } from "./Avatar";
import { useAppStore } from "@/store/useAppStore";
import { realtime } from "@/lib/ws";
import { voiceManager } from "@/lib/rtc";
import { UserSettingsModal } from "./modals/UserSettingsModal";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Settings,
  LogOut,
  PhoneOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const wsConnected = useAppStore((s) => s.wsConnected);
  const inVoice = useAppStore((s) => s.voiceChannelId !== null || s.voiceConversationId !== null);
  const muted = useAppStore((s) => s.muted);
  const deafened = useAppStore((s) => s.deafened);
  const myStatus = useAppStore((s) => (user ? s.presence[user.id] : undefined));

  if (!user) return null;

  const setStatus = (status: UserStatus) => {
    realtime.send({ t: "presence", status });
    useAppStore.getState().setPresence(user.id, status === "invisible" ? "offline" : status);
  };

  return (
    <div className="bg-rail/60 border-t border-border">
      {/* Voice connection bar */}
      {inVoice && (
        <div className="px-2 py-1.5 flex items-center gap-1 border-b border-border">
          <span className={cn("text-xs font-semibold flex items-center gap-1", wsConnected ? "text-online" : "text-idle")}>
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {wsConnected ? "Voz conectada" : "Reconectando..."}
            </span>
          <div className="ml-auto flex gap-1">
            <IconBtn
              title={muted ? "Desmutar" : "Mutar"}
              active={muted}
              onClick={() => voiceManager.toggleMute()}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </IconBtn>
            <IconBtn
              title={deafened ? "Ouvir novamente" : "Ensurdecer"}
              active={deafened}
              onClick={() => voiceManager.toggleDeafen()}
            >
              {deafened ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
            </IconBtn>
            <IconBtn title="Desconectar" danger onClick={() => voiceManager.leave()}>
              <PhoneOff className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>
      )}

      {/* User row */}
      <div className="p-2 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 flex-1 min-w-0 rounded-md hover:bg-hover p-1 transition-colors text-left">
              <Avatar
                userId={user.id}
                name={user.name ?? user.username}
                src={user.avatar}
                size="sm"
                showStatus
                statusOverride={myStatus ?? user.status ?? "online"}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {user.name ?? user.username}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {STATUS_LABELS[myStatus ?? "online"] ?? "Online"}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-56">
            <DropdownMenuLabel>Definir status</DropdownMenuLabel>
            {(["online", "idle", "dnd", "invisible"] as const).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                <span className={cn("h-2.5 w-2.5 rounded-full mr-2", statusColor(s))} />
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          className="p-2 rounded-md text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
          title="Configurações do usuário"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  active,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        danger
          ? "text-destructive hover:bg-destructive/20"
          : active
            ? "bg-destructive/20 text-destructive"
            : "text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
