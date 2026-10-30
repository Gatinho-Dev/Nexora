import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  Copy,
  FolderPlus,
  Hash,
  LogOut,
  Settings,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import type { ServerDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { openUserSettings } from "@/lib/openUserSettings";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type ServerMenuAction =
  | "invite"
  | "settings"
  | "create-channel"
  | "create-category"
  | "events";

const MUTE_OPTIONS = [
  { label: "15 minutos", minutes: 15 },
  { label: "1 hora", minutes: 60 },
  { label: "3 horas", minutes: 180 },
  { label: "8 horas", minutes: 480 },
  { label: "24 horas", minutes: 1440 },
] as const;

export function ServerContextMenu({
  server,
  children,
  onAction,
}: {
  server: ServerDTO;
  children: React.ReactNode;
  onAction: (action: ServerMenuAction, server: ServerDTO) => void;
}) {
  const [open, setOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery().data;
  const preferences = trpc.server.notificationPreferences.useQuery(
    { serverId: server.id },
    { enabled: open },
  );
  const updatePreferences = trpc.server.updateNotificationPreferences.useMutation({
    onSuccess: () => void preferences.refetch(),
    onError: error => toast.error(error.message),
  });
  const markRead = trpc.server.markRead.useMutation({
    onSuccess: ({ channelIds }) => {
      const store = useAppStore.getState();
      for (const channelId of channelIds) store.clearUnreadChannel(channelId);
      store.setServerUnread(server.id, 0);
      void utils.message.unread.invalidate();
      toast.success("Servidor marcado como lido.");
    },
    onError: error => toast.error(error.message),
  });
  const leave = trpc.server.leave.useMutation({
    onSuccess: () => {
      void utils.server.list.invalidate();
      navigate("/channels/@me");
    },
    onError: error => toast.error(error.message),
  });

  const permissions = new Set(server.myPermissions ?? []);
  const canManageServer = permissions.has("MANAGE_SERVER");
  const canManageChannels = permissions.has("MANAGE_CHANNELS");
  const isOwner = server.ownerId === me?.id;
  const current = preferences.data ?? {
    level: "mentions" as const,
    mutedUntil: null,
    suppressEveryone: false,
    suppressRoles: false,
  };
  const isMuted = Boolean(
    current.mutedUntil && new Date(current.mutedUntil).getTime() > currentTime,
  );

  const savePreferences = (patch: {
    level?: "all" | "mentions" | "none";
    mutedUntil?: string | null;
  }) => {
    updatePreferences.mutate({
      serverId: server.id,
      level: patch.level ?? current.level,
      mutedUntil:
        patch.mutedUntil === undefined
          ? current.mutedUntil
            ? new Date(current.mutedUntil).toISOString()
            : null
          : patch.mutedUntil,
      suppressEveryone: current.suppressEveryone,
      suppressRoles: current.suppressRoles,
    });
  };

  return (
    <ContextMenu
      onOpenChange={nextOpen => {
        setOpen(nextOpen);
        if (nextOpen) setCurrentTime(Date.now());
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64 rounded-xl border-border/80 bg-popover/95 p-1.5 text-xs shadow-2xl backdrop-blur-xl">
        <ContextMenuItem
          onSelect={() => markRead.mutate({ serverId: server.id })}
          disabled={markRead.isPending}
          className="min-h-9 rounded-lg text-xs"
        >
          <CheckCheck />
          Marcar como lido
        </ContextMenuItem>
        {!server.invitesPaused && (
          <ContextMenuItem
            onSelect={() => onAction("invite", server)}
            className="min-h-9 rounded-lg text-xs"
          >
            <UserPlus />
            Convidar para o servidor
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="min-h-9 rounded-lg text-xs">
            <BellOff />
            {isMuted ? "Servidor silenciado" : "Silenciar servidor"}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 rounded-xl border-border/80 bg-popover/95 p-1.5 text-xs shadow-2xl backdrop-blur-xl">
            {isMuted && (
              <>
                <ContextMenuItem
                  onSelect={() => savePreferences({ mutedUntil: null })}
                  className="min-h-9 rounded-lg text-xs"
                >
                  <Bell /> Reativar
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            {MUTE_OPTIONS.map(option => (
              <ContextMenuItem
                key={option.minutes}
                onSelect={() =>
                  savePreferences({
                    mutedUntil: new Date(
                      Date.now() + option.minutes * 60_000,
                    ).toISOString(),
                  })
                }
                className="min-h-9 rounded-lg text-xs"
              >
                {option.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger className="min-h-9 rounded-lg text-xs">
            <Bell />
            Config. de notificação
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 rounded-xl border-border/80 bg-popover/95 p-1.5 text-xs shadow-2xl backdrop-blur-xl">
            <ContextMenuRadioGroup
              value={current.level}
              onValueChange={value =>
                savePreferences({
                  level: value as "all" | "mentions" | "none",
                })
              }
            >
              {[
                ["all", "Todas as mensagens"],
                ["mentions", "Apenas menções"],
                ["none", "Nada"],
              ].map(([value, label]) => (
                <ContextMenuRadioItem
                  key={value}
                  value={value}
                  className="min-h-9 rounded-lg text-xs"
                >
                  {label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />
        {canManageServer && (
          <ContextMenuItem
            onSelect={() => onAction("settings", server)}
            className="min-h-9 rounded-lg text-xs"
          >
            <Settings /> Config. do servidor
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onSelect={() => openUserSettings("privacy")}
          className="min-h-9 rounded-lg text-xs"
        >
          <ShieldCheck /> Config. de privacidade
        </ContextMenuItem>

        {canManageChannels && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onAction("create-channel", server)}
              className="min-h-9 rounded-lg text-xs"
            >
              <Hash /> Criar canal
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => onAction("create-category", server)}
              className="min-h-9 rounded-lg text-xs"
            >
              <FolderPlus /> Criar categoria
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => onAction("events", server)}
              className="min-h-9 rounded-lg text-xs"
            >
              <CalendarClock /> Criar evento
            </ContextMenuItem>
          </>
        )}

        {me && !isOwner && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              className="min-h-9 rounded-lg text-xs"
              onSelect={() => {
                if (window.confirm(`Sair de “${server.name}”?`)) {
                  leave.mutate({ serverId: server.id });
                }
              }}
            >
              <LogOut /> Sair do servidor
            </ContextMenuItem>
          </>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem
          className="min-h-9 rounded-lg text-xs"
          onSelect={() => {
            void navigator.clipboard
              .writeText(String(server.id))
              .then(() => toast.success("ID do servidor copiado."))
              .catch(() => toast.error("Não foi possível copiar o ID."));
          }}
        >
          <Copy /> Copiar ID do servidor
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
