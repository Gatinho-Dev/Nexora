import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Users } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { UserPanel } from "./UserPanel";
import { cn } from "@/lib/utils";

export function DMSidebar() {
  const navigate = useNavigate();
  const params = useParams();
  const activeConversationId = params.conversationId
    ? Number(params.conversationId)
    : null;
  const conversations = trpc.dm.list.useQuery();
  const unreadConversations = useAppStore(s => s.unreadConversations);

  return (
    <aside
      aria-label="Mensagens diretas"
      className="flex h-full w-60 flex-col bg-[#2B2D31] border-r border-black/20 select-none"
    >
      <div className="flex h-12 items-center border-b border-white/5 px-3">
        <button
          onClick={() => navigate("/channels/@me")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            !activeConversationId
              ? "bg-[#404249] text-white"
              : "text-[#B5BAC1] hover:bg-[#35373C] hover:text-[#DBDEE1]"
          )}
        >
          <Users className="h-4 w-4" /> Amigos
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#949BA4]">
          Mensagens diretas
        </p>
        {conversations.isLoading ? (
          <p className="px-2 py-2 text-xs text-[#B5BAC1]">
            Carregando conversas...
          </p>
        ) : conversations.data?.length === 0 ? (
          <p className="px-2 py-2 text-xs text-[#B5BAC1]">
            Nenhuma conversa. Adicione amigos para começar na Nexora!
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.data?.map(conv => {
              const other = conv.otherUser;
              const unread = unreadConversations[conv.id] ?? 0;
              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/channels/@me/${conv.id}`)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors group",
                    activeConversationId === conv.id
                      ? "bg-[#404249] text-white font-medium"
                      : "text-[#B5BAC1] hover:bg-[#35373C] hover:text-[#DBDEE1]"
                  )}
                >
                  <Avatar
                    userId={other?.id}
                    name={other?.name ?? other?.username}
                    src={other?.avatar}
                    size="sm"
                    showStatus
                    statusOverride={other?.status ?? "online"}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-xs font-semibold group-hover:text-white transition-colors",
                        unread > 0 && "text-white font-bold"
                      )}
                    >
                      {other?.name ?? other?.username ?? "Conversa"}
                    </p>
                    {conv.lastMessage && (
                      <p className="truncate text-[11px] text-[#B5BAC1]/70">
                        {conv.lastMessage.content || "📎 Anexo enviado"}
                      </p>
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground border border-rail">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <UserPanel />
    </aside>
  );
}
