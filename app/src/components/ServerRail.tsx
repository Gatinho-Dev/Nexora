import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { Plus, Compass } from "lucide-react";
import { CreateServerModal } from "./modals/CreateServerModal";
import { JoinServerModal } from "./modals/JoinServerModal";
import { useAppStore } from "@/store/useAppStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NexoraAppIcon } from "./NexoraBrand";

export function ServerRail({
  onOpenContextMenu,
}: {
  onOpenContextMenu?: (e: React.MouseEvent, type: "server", id: number) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { data: servers } = trpc.server.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const unreadConversations = useAppStore(s => s.unreadConversations);
  const serverUnread = useAppStore(s => s.serverUnread);

  const activeServerId = params.serverId ? Number(params.serverId) : null;
  const isDM = location.pathname.startsWith("/channels/@me");
  const dmUnread = Object.values(unreadConversations).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <nav
      aria-label="Comunidades"
      className="z-20 flex w-16 shrink-0 select-none flex-col items-center gap-2 overflow-y-auto border-r border-border bg-rail py-3"
    >
      <TooltipProvider delayDuration={100}>
        {/* Nexora Home button */}
        <RailButton
          label="Nexora Home"
          active={isDM}
          onClick={() => navigate("/channels/@me")}
          badge={dmUnread}
        >
          <NexoraAppIcon className="h-full w-full" decorative />
        </RailButton>

        <div className="my-1 h-px w-7 bg-border" />

        {/* Servers */}
        {servers?.map(server => (
          <RailButton
            key={server.id}
            label={server.name}
            active={activeServerId === server.id}
            hasUnread={(serverUnread[server.id] ?? 0) > 0}
            badge={serverUnread[server.id] ?? 0}
            onClick={() => navigate(`/channels/${server.id}/first`)}
            onContextMenu={e => {
              e.preventDefault();
              onOpenContextMenu?.(e, "server", server.id);
            }}
          >
            {server.iconUrl ? (
              <img
                src={server.iconUrl}
                alt={server.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold tracking-wide text-foreground">
                {server.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </RailButton>
        ))}

        {/* Add server button */}
        <RailButton
          label="Criar comunidade"
          onClick={() => setCreateOpen(true)}
          actionType="add"
        >
          <Plus className="h-5 w-5" />
        </RailButton>

        {/* Explore communities */}
        <RailButton
          label="Explorar comunidades"
          onClick={() => setJoinOpen(true)}
          actionType="explore"
        >
          <Compass className="h-5 w-5" />
        </RailButton>
      </TooltipProvider>

      <CreateServerModal open={createOpen} onOpenChange={setCreateOpen} />
      <JoinServerModal open={joinOpen} onOpenChange={setJoinOpen} />
    </nav>
  );
}

function RailButton({
  label,
  active,
  onClick,
  onContextMenu,
  actionType,
  hasUnread,
  badge,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  actionType?: "add" | "explore";
  hasUnread?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative flex items-center group">
      {/* Left indicator bar */}
      <div
        className={cn(
          "absolute -left-2.5 w-1 rounded-r-full bg-[var(--dm-unread-indicator)] transition-[height,opacity] duration-200",
          active
            ? "h-8"
            : hovered
              ? "h-4 opacity-80"
              : hasUnread
                ? "h-2 opacity-70"
                : "h-0 opacity-0"
        )}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            onContextMenu={onContextMenu}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
              # Discord signature: 48px squircle that morphs into a circle on
              # hover — 350ms cubic-bezier(0.215, 0.61, 0.355, 1).
              "relative h-12 w-12 flex items-center justify-center overflow-hidden active:scale-95",
              "transition-[border-radius,background-color,color,transform,box-shadow] [transition-duration:350ms]",
              "[transition-timing-function:cubic-bezier(0.215,0.61,0.355,1)]",
              active
                ? "bg-primary text-primary-foreground"
                : actionType === "add" || actionType === "explore"
                  ? "bg-chat text-primary hover:rounded-[11px] hover:bg-primary hover:text-primary-foreground"
                  : "bg-chat text-foreground hover:rounded-[11px] hover:bg-primary hover:text-primary-foreground"
            )}
          >
            {children}
            {badge !== undefined && badge > 0 && (
              <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-rail bg-[var(--mention-badge)] px-1.5 text-[11px] font-bold text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="border-border bg-popover font-medium text-popover-foreground"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
