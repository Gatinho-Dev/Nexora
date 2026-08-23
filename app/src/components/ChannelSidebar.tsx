import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  UserPlus,
  Settings,
  Trash2,
  MicOff,
  Video,
  MonitorUp,
  LogOut,
  Pencil,
  CalendarClock,
} from "lucide-react";
import {
  IconHash,
  IconVoice,
  IconForum,
  IconMegaphone,
} from "./icons/channelIcons";
import type { ServerDetailsDTO } from "@contracts/types";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { UserPanel } from "./UserPanel";
import { CreateChannelModal } from "./modals/CreateChannelModal";
import { InviteModal } from "./modals/InviteModal";
import { ServerSettingsModal } from "./modals/ServerSettingsModal";
import { EventsModal } from "./modals/EventsModal";
import { voiceManager } from "@/lib/rtc";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ChannelSidebar({
  details,
  onOpenContextMenu,
  onOpenProfile,
}: {
  details: ServerDetailsDTO;
  onOpenContextMenu?: (
    e: React.MouseEvent,
    type: "channel" | "server",
    id: number
  ) => void;
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const params = useParams();
  const activeChannelId = params.channelId ? Number(params.channelId) : null;
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<number, boolean>
  >({});

  const unreadChannels = useAppStore(s => s.unreadChannels);
  const voiceParticipants = useAppStore(s => s.voiceParticipants);
  const myVoiceChannelId = useAppStore(s => s.voiceChannelId);
  const speakingByUser = useAppStore(s => s.speakingByUser);
  const me = trpc.auth.me.useQuery().data;

  const { server, channels, categories, myPermissions } = details;
  const canManageChannels = myPermissions.includes("MANAGE_CHANNELS");
  const canManageServer = myPermissions.includes("MANAGE_SERVER");
  const isOwner = server.ownerId === me?.id;

  const toggleCategory = (catId: number) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const channelsInCategory = (
    categoryId: number | null,
    kind: "text" | "voice"
  ) =>
    channels.filter(c => {
      const isTextKind = c.type === "TEXT" || c.type === "FORUM";
      const isVoiceKind = c.type === "VOICE" || c.type === "STAGE";
      return kind === "text"
        ? isTextKind && (categoryId === null || c.categoryId === categoryId)
        : isVoiceKind && (categoryId === null || c.categoryId === categoryId);
    });

  const joinVoice = async (channelId: number) => {
    if (!me) return;
    try {
      await voiceManager.join({ channelId, serverId: server.id, myId: me.id });
      navigate(`/channels/${server.id}/${channelId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao entrar no canal de voz."
      );
    }
  };

  const leaveServer = trpc.server.leave.useMutation({
    onSuccess: () => {
      trpc.useUtils().server.list.invalidate();
      navigate("/channels/@me");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <aside
      aria-label="Canais da comunidade"
      className="w-60 shrink-0 bg-sidebar flex flex-col h-full border-r border-black/20 select-none"
    >
      {/* Server Header Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-12 px-4 flex items-center justify-between font-semibold text-foreground border-b border-black/20 hover:bg-hov transition-colors shadow-sm">
            <span className="truncate text-sm tracking-wide">
              {server.name}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted2" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-[#111214] border-black/30 text-white shadow-xl">
          <DropdownMenuItem
            onClick={() => setInviteOpen(true)}
            className="hover:bg-white/10 cursor-pointer"
          >
            <UserPlus className="h-4 w-4 mr-2 text-[#5865F2]" /> Convidar
            pessoas
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setEventsOpen(true)}
            className="hover:bg-white/10 cursor-pointer"
          >
            <CalendarClock className="h-4 w-4 mr-2 text-muted2" /> Eventos
          </DropdownMenuItem>
          {canManageServer && (
            <DropdownMenuItem
              onClick={() => setSettingsOpen(true)}
              className="hover:bg-white/10 cursor-pointer"
            >
              <Settings className="h-4 w-4 mr-2 text-muted2" /> Configurações
              do servidor
            </DropdownMenuItem>
          )}
          {canManageChannels && (
            <DropdownMenuItem
              onClick={() => setCreateChannelOpen(true)}
              className="hover:bg-white/10 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2 text-muted2" /> Criar canal
            </DropdownMenuItem>
          )}
          {!isOwner && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300 hover:bg-red-500/10 cursor-pointer"
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

      {/* Categories & Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {categories.map(category => {
          const isCollapsed = !!collapsedCategories[category.id];
          const textList = channelsInCategory(category.id, "text");
          const voiceList = channelsInCategory(category.id, "voice");

          if (
            textList.length === 0 &&
            voiceList.length === 0 &&
            !canManageChannels
          )
            return null;

          return (
            <div key={category.id} className="space-y-1">
              {/* Category Header */}
              <div className="flex items-center justify-between px-1 py-1 group">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-faint hover:text-bodyx transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  <span>{category.name}</span>
                </button>
                {canManageChannels && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CategoryActions categoryId={category.id} name={category.name} />
                    <button
                      className="text-muted2 hover:text-foreground"
                      onClick={() => setCreateChannelOpen(true)}
                      title="Criar canal nesta categoria"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Channels when expanded */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {/* Text & Forum Channels */}
                  {textList.map(channel => (
                    <TextChannelRow
                      key={channel.id}
                      id={channel.id}
                      name={channel.name}
                      type={channel.type}
                      active={activeChannelId === channel.id}
                      unread={(unreadChannels[channel.id] ?? 0) > 0}
                      unreadCount={unreadChannels[channel.id] ?? 0}
                      canManage={canManageChannels}
                      onClick={() =>
                        navigate(`/channels/${server.id}/${channel.id}`)
                      }
                      onContextMenu={e => {
                        e.preventDefault();
                        onOpenContextMenu?.(e, "channel", channel.id);
                      }}
                      onInviteClick={() => setInviteOpen(true)}
                    />
                  ))}

                  {/* Voice & Stage Channels */}
                  {voiceList.map(channel => {
                    const participants =
                      voiceParticipants[`c:${channel.id}`] ?? [];
                    const isConnectedHere = myVoiceChannelId === channel.id;
                    const isStage = channel.type === "STAGE";

                    return (
                      <div key={channel.id} className="space-y-0.5">
                        <button
                          onClick={() =>
                            isStage
                              ? navigate(
                                  `/channels/${server.id}/${channel.id}`
                                )
                              : joinVoice(channel.id)
                          }
                          onContextMenu={e => {
                            e.preventDefault();
                            onOpenContextMenu?.(e, "channel", channel.id);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors group",
                            isConnectedHere
                              ? "bg-act text-foreground font-medium"
                              : "text-faint hover:bg-hov hover:text-bodyx"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isStage ? (
                              <IconMegaphone
                                className={cn(
                                  "h-[18px] w-[18px] shrink-0",
                                  isConnectedHere
                                    ? "text-primary"
                                    : "text-muted2"
                                )}
                              />
                            ) : (
                              <IconVoice
                                className={cn(
                                  "h-[18px] w-[18px] shrink-0",
                                  isConnectedHere
                                    ? "text-primary"
                                    : "text-muted2"
                                )}
                              />
                            )}
                            <span className="truncate">{channel.name}</span>
                          </div>
                          <UserPlus
                            onClick={e => {
                              e.stopPropagation();
                              setInviteOpen(true);
                            }}
                            className="h-3.5 w-3.5 text-muted2 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </button>

                        {/* Nested participants under voice channel */}
                        {participants.length > 0 && (
                          <div className="ml-6 space-y-1 py-1">
                            {participants.map(p => (
                              <button
                                type="button"
                                key={p.userId}
                                onClick={() => onOpenProfile?.(p.userId)}
                                className="flex w-full items-center justify-between text-xs px-2 py-1 rounded hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                                aria-label={`Ver perfil de ${p.name}`}
                                title="Ver perfil"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span
                                    className={cn(
                                      "rounded-full transition-[box-shadow] duration-150",
                                      speakingByUser[p.userId] &&
                                        !p.muted &&
                                        "voice-avatar-speaking"
                                    )}
                                    aria-label={
                                      speakingByUser[p.userId] && !p.muted
                                        ? `${p.name} está falando`
                                        : undefined
                                    }
                                  >
                                    <Avatar
                                      userId={p.userId}
                                      name={p.name}
                                      src={p.avatar}
                                      size="xs"
                                      showStatus={false}
                                    />
                                  </span>
                                  <span className="truncate text-foreground/90 font-medium">
                                    {p.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-muted2">
                                  {p.muted && (
                                    <MicOff className="h-3 w-3 text-red-400" />
                                  )}
                                  {p.camera && (
                                    <Video className="h-3 w-3 text-[#5865F2]" />
                                  )}
                                  {p.screen && (
                                    <MonitorUp className="h-3 w-3 text-green-400" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Fallback list if no categories */}
        {categories.length === 0 && (
          <div className="space-y-0.5">
            {channels.map(channel => (
              <TextChannelRow
                key={channel.id}
                id={channel.id}
                name={channel.name}
                type={channel.type}
                active={activeChannelId === channel.id}
                unread={(unreadChannels[channel.id] ?? 0) > 0}
                unreadCount={unreadChannels[channel.id] ?? 0}
                canManage={canManageChannels}
                onClick={() => navigate(`/channels/${server.id}/${channel.id}`)}
                onContextMenu={e => {
                  e.preventDefault();
                  onOpenContextMenu?.(e, "channel", channel.id);
                }}
                onInviteClick={() => setInviteOpen(true)}
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
      <InviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        serverId={server.id}
      />
      <ServerSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        details={details}
      />
      <EventsModal
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        details={details}
      />
    </aside>
  );
}

function TextChannelRow({
  id,
  name,
  type,
  active,
  unread,
  unreadCount,
  canManage,
  onClick,
  onContextMenu,
  onInviteClick,
}: {
  id: number;
  name: string;
  type: "TEXT" | "VOICE" | "ANNOUNCEMENT" | "FORUM" | "STAGE";
  active: boolean;
  unread: boolean;
  unreadCount: number;
  canManage: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onInviteClick?: () => void;
}) {
  const utils = trpc.useUtils();
  const deleteChannel = trpc.server.deleteChannel.useMutation({
    onSuccess: () => utils.server.get.invalidate(),
    onError: e => toast.error(e.message),
  });

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors select-none",
        active
          ? "bg-act text-foreground font-medium"
          : unread
            ? "text-foreground font-medium bg-hov hover:bg-act"
            : "text-faint hover:bg-hov hover:text-bodyx"
      )}
    >
      <div className="flex items-center gap-2 truncate">
        {type === "FORUM" ? (
          <IconForum
            className={cn(
              "h-[18px] w-[18px] shrink-0",
              active ? "text-bodyx" : unread ? "text-foreground" : "text-faint"
            )}
          />
        ) : type === "ANNOUNCEMENT" ? (
          <IconMegaphone
            className={cn(
              "h-[18px] w-[18px] shrink-0",
              active ? "text-bodyx" : unread ? "text-foreground" : "text-faint"
            )}
          />
        ) : (
          <IconHash
            className={cn(
              "h-[18px] w-[18px] shrink-0",
              active ? "text-bodyx" : unread ? "text-foreground" : "text-faint"
            )}
          />
        )}
        <span className="truncate">{name}</span>
      </div>

      <div className="flex items-center gap-1">
        {unread && unreadCount > 0 && !active && (
          <span className="h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onInviteClick?.();
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted2 hover:text-foreground transition-opacity"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Criar convite</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {canManage && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted2 hover:text-red-400 transition-opacity"
                  onClick={e => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Excluir o canal #${name}? Todas as mensagens serão perdidas.`
                      )
                    ) {
                      deleteChannel.mutate({ channelId: id });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Excluir canal</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function CategoryActions({
  categoryId,
  name,
}: {
  categoryId: number;
  name: string;
}) {
  const utils = trpc.useUtils();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(name);

  const updateCategory = trpc.server.updateCategory.useMutation({
    onSuccess: () => {
      utils.server.get.invalidate();
      setRenaming(false);
    },
    onError: e => toast.error(e.message),
  });
  const deleteCategory = trpc.server.deleteCategory.useMutation({
    onSuccess: () => utils.server.get.invalidate(),
    onError: e => toast.error(e.message),
  });

  if (renaming) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={e => {
          e.preventDefault();
          const trimmed = newName.trim();
          if (!trimmed) return;
          updateCategory.mutate({ categoryId, name: trimmed });
        }}
      >
        <input
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onBlur={() => setRenaming(false)}
          onKeyDown={e => {
            if (e.key === "Escape") setRenaming(false);
          }}
          className="w-28 rounded bg-rail px-1.5 py-0.5 text-[11px] font-semibold uppercase text-white outline-none ring-1 ring-[#5865F2]"
        />
      </form>
    );
  }

  return (
    <>
      <button
        className="text-muted2 hover:text-foreground"
        title="Renomear categoria"
        onClick={() => {
          setNewName(name);
          setRenaming(true);
        }}
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        className="text-muted2 hover:text-red-400"
        title="Excluir categoria"
        onClick={() => {
          if (
            confirm(
              `Excluir a categoria "${name}"? Os canais dela ficarão sem categoria.`
            )
          ) {
            deleteCategory.mutate({ categoryId });
          }
        }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </>
  );
}
