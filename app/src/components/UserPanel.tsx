import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "./Avatar";
import { statusColor } from "@/lib/statusColor";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const wsConnected = useAppStore(s => s.wsConnected);
  const inVoice = useAppStore(
    s => s.voiceChannelId !== null || s.voiceConversationId !== null
  );
  const muted = useAppStore(s => s.muted);
  const deafened = useAppStore(s => s.deafened);
  const myStatus = useAppStore(s => (user ? s.presence[user.id] : undefined));

  if (!user) return null;

  const setStatus = (status: UserStatus) => {
    realtime.send({ t: "presence", status });
    useAppStore
      .getState()
      .setPresence(user.id, status === "invisible" ? "offline" : status);
  };

  return (
    <div className="bg-[#232428] border-t border-black/20 select-none">
      {/* Voice status bar if in call */}
      {inVoice && (
        <div className="px-3 py-2 flex items-center justify-between bg-[#232428] border-b border-black/20 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1 font-semibold",
                wsConnected ? "text-[#23A559]" : "text-amber-400"
              )}
            >
              {wsConnected ? (
                <Wifi className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {wsConnected ? "Voz conectada" : "Reconectando..."}
            </span>
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => voiceManager.leave()}
                  className="p-1 rounded text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Desconectar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* User profile row */}
      <div className="p-2 flex items-center justify-between gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex min-h-11 items-center gap-2.5 flex-1 min-w-0 rounded-md hover:bg-[#35373C] p-1.5 transition-colors text-left group">
              <Avatar
                userId={user.id}
                name={user.name ?? user.username}
                src={user.avatar}
                size="sm"
                showStatus
                statusOverride={myStatus ?? user.status ?? "online"}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">
                  {user.name ?? user.username}
                </div>
                <div className="text-[11px] text-[#B5BAC1] truncate flex items-center gap-1">
                  <span>@{user.username}</span>
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-56 bg-[#111214] border-black/30 text-white"
          >
            <DropdownMenuLabel className="text-xs text-[#B5BAC1]">
              Definir status
            </DropdownMenuLabel>
            {(["online", "idle", "dnd", "invisible"] as const).map(s => (
              <DropdownMenuItem
                key={s}
                onClick={() => setStatus(s)}
                className="hover:bg-white/10 cursor-pointer"
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full mr-2.5",
                    statusColor(s)
                  )}
                />
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => setSettingsOpen(true)}
              className="hover:bg-white/10 cursor-pointer"
            >
              <Settings className="h-4 w-4 mr-2 text-[#B5BAC1]" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 focus:text-red-300 hover:bg-red-500/10 cursor-pointer"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
                      : "text-[#B5BAC1] hover:bg-white/10 hover:text-white"
                  )}
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
                      : "text-[#B5BAC1] hover:bg-white/10 hover:text-white"
                  )}
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
                  onClick={() => setSettingsOpen(true)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md text-[#B5BAC1] hover:bg-[#35373C] hover:text-white transition-colors"
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

      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
