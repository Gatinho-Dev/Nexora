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
  const activeConversationId = params.conversationId ? Number(params.conversationId) : null;
  const conversations = trpc.dm.list.useQuery();
  const unreadConversations = useAppStore((s) => s.unreadConversations);

  return (
    <div className="flex h-full w-60 flex-col bg-[var(--sidebar-bg)]">
      <div className="flex h-12 items-center border-b border-border px-4">
        <button
          onClick={() => navigate("/channels/@me")}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
            !activeConversationId
              ? "bg-[var(--active-bg)] text-foreground"
              : "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-foreground",
          )}
        >
          <Users className="h-4 w-4" /> Amigos
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mensagens diretas
        </p>
        {conversations.isLoading ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">Carregando...</p>
        ) : conversations.data?.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            Nenhuma conversa. Adicione amigos para começar a conversar!
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.data?.map((conv) => {
              const other = conv.otherUser;
              const unread = unreadConversations[conv.id] ?? 0;
              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/channels/@me/${conv.id}`)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    activeConversationId === conv.id
                      ? "bg-[var(--active-bg)] text-foreground"
                      : "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-foreground",
                  )}
                >
                  <Avatar user={other} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", unread > 0 && "font-semibold text-foreground")}>
                      {other?.name ?? other?.username ?? "Conversa"}
                    </p>
                    {conv.lastMessage && (
                      <p className="truncate text-xs text-muted-foreground">
                        {conv.lastMessage.content || "📎 Anexo"}
                      </p>
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
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
    </div>
  );
}
