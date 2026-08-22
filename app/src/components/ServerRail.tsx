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

  const activeServerId = params.serverId ? Number(params.serverId) : null;
  const isDM = location.pathname.startsWith("/channels/@me");
  const dmUnread = Object.values(unreadConversations).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <nav
      aria-label="Comunidades"
      className="w-[72px] shrink-0 bg-[#1E1F22] flex flex-col items-center py-3 gap-2 overflow-y-auto z-20 border-r border-black/20 select-none"
    >
      <TooltipProvider delayDuration={100}>
        {/* Nexora Home button */}
        <RailButton
          label="Nexora Home"
          active={isDM}
          onClick={() => navigate("/channels/@me")}
          badge={dmUnread}
        >
          <div className="h-6 w-6 flex items-center justify-center font-black text-xl tracking-tighter text-white">
            N
          </div>
        </RailButton>

        <div className="w-8 h-[2px] rounded-full bg-white/10 my-1" />

        {/* Servers */}
        {servers?.map(server => (
          <RailButton
            key={server.id}
            label={server.name}
            active={activeServerId === server.id}
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
              <span className="font-semibold text-sm tracking-wide text-white/90">
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
          "absolute -left-3 w-1 rounded-r-full bg-white transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200",
          active
            ? "h-10 bg-white"
            : hovered
              ? "h-5 bg-white/80"
              : hasUnread
                ? "h-2 bg-white/60"
                : "h-0 bg-transparent"
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
              "relative h-12 w-12 rounded-[24px] flex items-center justify-center transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 overflow-hidden active:scale-95 shadow-sm",
              active
                ? "rounded-[16px] bg-[#5865F2] text-white"
                : actionType === "add"
                  ? "bg-[#313338] text-[#23A559] hover:bg-[#23A559] hover:text-white hover:rounded-[16px]"
                  : actionType === "explore"
                    ? "bg-[#313338] text-[#23A559] hover:bg-[#23A559] hover:text-white hover:rounded-[16px]"
                    : "bg-[#313338] text-foreground hover:bg-[#5865F2] hover:text-white hover:rounded-[16px]"
            )}
          >
            {children}
            {badge !== undefined && badge > 0 && (
              <span className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center border-2 border-rail shadow-md">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-[#111214] text-white border-black/20 font-medium shadow-xl"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
