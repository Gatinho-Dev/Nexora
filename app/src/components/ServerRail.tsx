import { forwardRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Compass, Plus, Volume2 } from "lucide-react";
import type { ServerDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { NexoraAppIcon } from "./NexoraBrand";
import { CreateServerModal } from "./modals/CreateServerModal";
import { JoinServerModal } from "./modals/JoinServerModal";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ServerContextMenu,
  type ServerMenuAction,
} from "./server/ServerContextMenu";
import { ServerBadge } from "./server/ServerBadge";
import {
  ServerActionModalHost,
  type ActiveServerMenuAction,
} from "./server/ServerActionModalHost";

export function ServerRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { data: servers } = trpc.server.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [activeAction, setActiveAction] =
    useState<ActiveServerMenuAction>(null);
  const unreadConversations = useAppStore(state => state.unreadConversations);

  const activeServerId = params.serverId ? Number(params.serverId) : null;
  const isDM = location.pathname.startsWith("/channels/@me");
  const dmUnread = Object.values(unreadConversations).reduce(
    (total, count) => total + count,
    0,
  );
  const closeAction = () => setActiveAction(null);

  return (
    <nav
      aria-label="Comunidades"
      className="z-20 flex w-[72px] shrink-0 select-none flex-col items-center gap-2 overflow-y-auto border-r border-border bg-rail py-3"
    >
      <TooltipProvider delayDuration={260}>
        <RailTooltip label="Nexora Home">
          <RailButton
            label="Nexora Home"
            active={isDM}
            onClick={() => navigate("/channels/@me")}
            mentionCount={dmUnread}
          >
            <NexoraAppIcon className="h-full w-full" decorative />
          </RailButton>
        </RailTooltip>

        <div className="my-1 h-px w-8 bg-border" />

        {servers?.map(server => (
          <ServerRailItem
            key={server.id}
            server={server}
            active={activeServerId === server.id}
            onOpen={() => navigate(`/channels/${server.id}/first`)}
            onAction={(action, target) =>
              setActiveAction({ action, server: target })
            }
          />
        ))}

        <RailTooltip label="Criar comunidade">
          <RailButton
            label="Criar comunidade"
            onClick={() => setCreateOpen(true)}
            actionType="add"
          >
            <Plus className="h-5 w-5" />
          </RailButton>
        </RailTooltip>

        <RailTooltip label="Explorar comunidades">
          <RailButton
            label="Explorar comunidades"
            onClick={() => setJoinOpen(true)}
            actionType="explore"
          >
            <Compass className="h-5 w-5" />
          </RailButton>
        </RailTooltip>
      </TooltipProvider>

      <CreateServerModal open={createOpen} onOpenChange={setCreateOpen} />
      <JoinServerModal open={joinOpen} onOpenChange={setJoinOpen} />

      <ServerActionModalHost
        activeAction={activeAction}
        onClose={closeAction}
      />
    </nav>
  );
}

function ServerRailItem({
  server,
  active,
  onOpen,
  onAction,
}: {
  server: ServerDTO;
  active: boolean;
  onOpen: () => void;
  onAction: (action: ServerMenuAction, server: ServerDTO) => void;
}) {
  const unread = useAppStore(state => state.serverUnread[server.id] ?? 0);
  const mentions = useAppStore(state => state.serverMentions[server.id] ?? 0);
  const realtimeVoice = useAppStore(
    state => state.serverVoiceSummaries[server.id],
  );
  const activeVoiceCount = realtimeVoice?.count ?? server.activeVoiceCount ?? 0;
  const preview = realtimeVoice?.preview ?? server.voicePreviewMembers ?? [];
  const hasRichPreview = server.partnered || activeVoiceCount > 0;

  return (
    <HoverCard openDelay={hasRichPreview ? 280 : 340} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span className="block h-12 w-12">
          <ServerContextMenu server={server} onAction={onAction}>
            <RailButton
              label={server.name}
              active={active}
              hasUnread={unread > 0}
              mentionCount={mentions}
              voiceActive={activeVoiceCount > 0}
              onClick={onOpen}
            >
              {server.iconUrl ? (
                <img
                  src={server.iconUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold tracking-wide text-foreground">
                  {server.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </RailButton>
          </ServerContextMenu>
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="center"
        sideOffset={10}
        className={cn(
          "rounded-xl border-border/80 bg-popover/95 p-3 text-popover-foreground shadow-2xl backdrop-blur-xl",
          hasRichPreview ? "w-64" : "w-auto max-w-56 py-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {server.partnered && (
            <ServerBadge type="partner" className="h-[18px] w-[18px]" />
          )}
          <p className="truncate text-sm font-semibold">{server.name}</p>
        </div>
        {activeVoiceCount > 0 && (
          <div
            className="mt-3 flex items-center gap-2"
            aria-label={`${activeVoiceCount} membro${activeVoiceCount === 1 ? "" : "s"} em chamada`}
          >
            <Volume2 className="h-4 w-4 shrink-0 text-[#7383FF]" aria-hidden />
            <div className="flex -space-x-2" aria-hidden>
              {preview.slice(0, 4).map(person => (
                <Avatar
                  key={person.userId}
                  userId={person.userId}
                  name={person.name}
                  src={person.avatar}
                  size="xs"
                  showStatus={false}
                  className="ring-2 ring-popover"
                />
              ))}
            </div>
            {activeVoiceCount > preview.length && (
              <span className="text-xs font-semibold text-muted-foreground">
                +{activeVoiceCount - preview.length}
              </span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              Em chamada
            </span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="border-border bg-popover font-medium text-popover-foreground"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

type RailButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label"
> & {
  label: string;
  active?: boolean;
  actionType?: "add" | "explore";
  hasUnread?: boolean;
  mentionCount?: number;
  voiceActive?: boolean;
  children: React.ReactNode;
};

const RailButton = forwardRef<HTMLButtonElement, RailButtonProps>(
  function RailButton(
    {
      label,
      active,
      onClick,
      actionType,
      hasUnread,
      mentionCount = 0,
      voiceActive,
      children,
      className,
      ...buttonProps
    },
    ref,
  ) {
    const status = [
      mentionCount > 0
        ? `${mentionCount} menção${mentionCount === 1 ? "" : "ões"}`
        : null,
      hasUnread ? "mensagens não lidas" : null,
      voiceActive ? "membros em chamada" : null,
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <button
        {...buttonProps}
        ref={ref}
        type="button"
        onClick={onClick}
        aria-label={status ? `${label}, ${status}` : label}
        className={cn(
          "group relative flex h-12 w-12 items-center justify-center rounded-2xl outline-none transition-transform duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[#7383FF] focus-visible:ring-offset-2 focus-visible:ring-offset-rail",
          className,
        )}
      >
        <span
          className={cn(
            "absolute -left-3 w-1 rounded-r-full bg-[var(--dm-unread-indicator)] transition-[height,opacity] duration-200",
            active
              ? "h-8"
              : hasUnread
                ? "h-2.5 opacity-90"
                : "h-0 opacity-0",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl transition-[border-radius,background-color,color,transform] duration-200 ease-out group-hover:rounded-[13px]",
            active
              ? "rounded-[13px] bg-primary text-primary-foreground"
              : actionType
                ? "bg-chat text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                : "bg-chat text-foreground group-hover:bg-primary/15",
          )}
        >
          {children}
        </span>
        {voiceActive && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-rail bg-[#4654D8] text-white"
            aria-hidden
          >
            <Volume2 className="h-2.5 w-2.5" />
          </span>
        )}
        {mentionCount > 0 && (
          <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-rail bg-[var(--mention-badge)] px-1 text-[10px] font-bold text-white">
            {mentionCount > 99 ? "99+" : mentionCount}
          </span>
        )}
      </button>
    );
  },
);
