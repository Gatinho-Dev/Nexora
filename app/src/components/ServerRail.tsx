import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { Home, Plus, Compass } from "lucide-react";
import { CreateServerModal } from "./modals/CreateServerModal";
import { JoinServerModal } from "./modals/JoinServerModal";
import { useAppStore } from "@/store/useAppStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ServerRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { data: servers } = trpc.server.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const unreadConversations = useAppStore((s) => s.unreadConversations);

  const activeServerId = params.serverId ? Number(params.serverId) : null;
  const isDM = location.pathname.startsWith("/channels/@me");
  const dmUnread = Object.values(unreadConversations).reduce((a, b) => a + b, 0);

  return (
    <div className="w-[72px] shrink-0 bg-rail flex flex-col items-center py-3 gap-2 overflow-y-auto">
      <TooltipProvider delayDuration={100}>
        {/* Home / DMs */}
        <RailButton
          label="Mensagens diretas"
          active={isDM}
          onClick={() => navigate("/channels/@me")}
          badge={dmUnread}
        >
          <Home className="h-6 w-6" />
        </RailButton>

        <div className="w-8 h-0.5 rounded bg-border my-1" />

        {/* Servers */}
        {servers?.map((server) => (
          <RailButton
            key={server.id}
            label={server.name}
            active={activeServerId === server.id}
            onClick={() => navigate(`/channels/${server.id}/first`)}
          >
            {server.iconUrl ? (
              <img src={server.iconUrl} alt={server.name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-semibold text-sm">
                {server.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </RailButton>
        ))}

        {/* Add server */}
        <RailButton label="Criar servidor" onClick={() => setCreateOpen(true)} green>
          <Plus className="h-6 w-6" />
        </RailButton>

        {/* Join by invite */}
        <RailButton label="Entrar com código de convite" onClick={() => setJoinOpen(true)} green>
          <Compass className="h-6 w-6" />
        </RailButton>
      </TooltipProvider>

      <CreateServerModal open={createOpen} onOpenChange={setCreateOpen} />
      <JoinServerModal open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}

function RailButton({
  label,
  active,
  onClick,
  green,
  badge,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  green?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative h-12 w-12 rounded-3xl flex items-center justify-center transition-all duration-150 overflow-hidden",
            active
              ? "rounded-2xl bg-primary text-primary-foreground"
              : green
                ? "bg-secondary text-online hover:bg-online hover:text-white hover:rounded-2xl"
                : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground hover:rounded-2xl",
          )}
        >
          {children}
          {badge !== undefined && badge > 0 && (
            <span className="absolute bottom-0 right-0 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border-2 border-rail">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
