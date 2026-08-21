import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Hash,
  Volume2,
  Plus,
  UserPlus,
  Settings,
  Trash2,
  MicOff,
  Video,
  MonitorUp,
  LogOut,
  Users,
} from "lucide-react";
import type { ServerDetailsDTO } from "@contracts/types";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { UserPanel } from "./UserPanel";
import { CreateChannelModal } from "./modals/CreateChannelModal";
import { InviteModal } from "./modals/InviteModal";
import { ServerSettingsModal } from "./modals/ServerSettingsModal";
import { voiceManager } from "@/lib/rtc";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ChannelSidebar({ details }: { details: ServerDetailsDTO }) {
  const navigate = useNavigate();
  const params = useParams();
  const activeChannelId = params.channelId ? Number(params.channelId) : null;
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const unreadChannels = useAppStore((s) => s.unreadChannels);
  const voiceParticipants = useAppStore((s) => s.voiceParticipants);
  const myVoiceChannelId = useAppStore((s) => s.voiceChannelId);
  const me = trpc.auth.me.useQuery().data;

  const { server, channels, categories, myPermissions } = details;
  const canManageChannels = myPermissions.includes("MANAGE_CHANNELS");
  const canManageServer = myPermissions.includes("MANAGE_SERVER");
  const isOwner = server.ownerId === me?.id;

  const channelsInCategory = (categoryId: number | null, kind: "text" | "voice") =>
    channels.filter((c) =>
      kind === "text"
        ? c.type === "TEXT" && (categoryId === null || c.categoryId === categoryId)
        : c.type === "VOICE" && (categoryId === null || c.categoryId === categoryId),
    );

  const joinVoice = async (channelId: number) => {
    if (!me) return;
    try {
      await voiceManager.join({ channelId, serverId: server.id, myId: me.id });
      navigate(`/channels/${server.id}/${channelId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar no canal de voz.");
    }
  };

  const leaveServer = trpc.server.leave.useMutation({
    onSuccess: () => {
      trpc.useUtils().server.list.invalidate();
      navigate("/channels/@me");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="w-60 shrink-0 bg-sidebar flex flex-col h-full">
      {/* Server header */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-12 px-4 flex items-center justify-between font-semibold border-b border-border hover:bg-hover transition-colors">
            <span className="truncate">{server.name}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuItem onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Convidar pessoas
          </DropdownMenuItem>
          {canManageServer && (
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" /> Configurações do servidor
            </DropdownMenuItem>
          )}
          {canManageChannels && (
            <DropdownMenuItem onClick={() => setCreateChannelOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Criar canal
            </DropdownMenuItem>
          )}
          {!isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirm(`Sair de "${server.name}"?`)) {
                    leaveServer.mutate({ serverId: server.id });
                  }
                }}
              >
                <LogOut className="h-4 w-4 mr-2" /> Sair do servidor
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {categories.map((category) => {
          const kind = category.kind;
          const list = channelsInCategory(category.id, kind);
          if (list.length === 0 && !canManageChannels) return null;
          return (
            <div key={category.id}>
              <div className="flex items-center justify-between px-1 mb-1 group">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {category.name}
                </span>
                {canManageChannels && (
                  <button
                    className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setCreateChannelOpen(true)}
                    title="Criar canal"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {list.map((channel) =>
                  channel.type === "TEXT" ? (
                    <TextChannelRow
                      key={channel.id}
                      id={channel.id}
                      name={channel.name}
                      active={activeChannelId === channel.id}
                      unread={(unreadChannels[channel.id] ?? 0) > 0}
                      unreadCount={unreadChannels[channel.id] ?? 0}
                      canManage={canManageChannels}
                      onClick={() => navigate(`/channels/${server.id}/${channel.id}`)}
                    />
                  ) : (
                    <div key={channel.id}>
                      <button
                        onClick={() => joinVoice(channel.id)}
                        className={cn(
                          "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                          myVoiceChannelId === channel.id
                            ? "bg-active text-foreground"
                            : "text-muted-foreground hover:bg-hover hover:text-foreground",
                        )}
                      >
                        <Volume2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">{channel.name}</span>
                      </button>
                      {/* Voice participants */}
                      {(voiceParticipants[`c:${channel.id}`] ?? []).length > 0 && (
                        <div className="ml-6 mt-1 space-y-1">
                          {voiceParticipants[`c:${channel.id}`].map((p) => (
                            <div key={p.userId} className="flex items-center gap-2 text-xs">
                              <Avatar userId={p.userId} name={p.name} src={p.avatar} size="xs" />
                              <span className="truncate text-muted-foreground">{p.name}</span>
                              <span className="ml-auto flex gap-1 text-muted-foreground">
                                {p.muted && <MicOff className="h-3 w-3" />}
                                {p.camera && <Video className="h-3 w-3" />}
                                {p.screen && <MonitorUp className="h-3 w-3" />}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        })}

        {/* Uncategorized fallback */}
        {categories.length === 0 && (
          <div className="space-y-0.5">
            {channels.map((channel) => (
              <TextChannelRow
                key={channel.id}
                id={channel.id}
                name={channel.name}
                active={activeChannelId === channel.id}
                unread={(unreadChannels[channel.id] ?? 0) > 0}
                unreadCount={unreadChannels[channel.id] ?? 0}
                canManage={canManageChannels}
                onClick={() => navigate(`/channels/${server.id}/${channel.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <UserPanel />

      <CreateChannelModal
        open={createChannelOpen}
        onOpenChange={setCreateChannelOpen}
        serverId={server.id}
        categories={categories}
      />
      <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} serverId={server.id} />
      <ServerSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        details={details}
      />
    </div>
  );
}

function TextChannelRow({
  id,
  name,
  active,
  unread,
  unreadCount,
  canManage,
  onClick,
}: {
  id: number;
  name: string;
  active: boolean;
  unread: boolean;
  unreadCount: number;
  canManage: boolean;
  onClick: () => void;
}) {
  const utils = trpc.useUtils();
  const deleteChannel = trpc.server.deleteChannel.useMutation({
    onSuccess: () => utils.server.get.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div
      className={cn(
        "group w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
        active
          ? "bg-active text-foreground"
          : unread
            ? "text-foreground font-semibold hover:bg-hover"
            : "text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
      onClick={onClick}
    >
      <Hash className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1 text-left">{name}</span>
      {unread && unreadCount > 0 && !active && (
        <span className="h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      {canManage && (
        <button
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          title="Excluir canal"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Excluir o canal #${name}? Todas as mensagens serão perdidas.`)) {
              deleteChannel.mutate({ channelId: id });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
