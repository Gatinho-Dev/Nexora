import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "../Avatar";
import { cn } from "@/lib/utils";
import { X, AtSign, UserPlus, Megaphone, ShieldCheck, Inbox } from "lucide-react";

type Filter =
  | "all"
  | "mention"
  | "friend_request"
  | "server"
  | "moderation";

const FILTERS: { id: Filter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "Todas", icon: <Inbox className="h-3.5 w-3.5" /> },
  { id: "mention", label: "Menções", icon: <AtSign className="h-3.5 w-3.5" /> },
  { id: "friend_request", label: "Amigos", icon: <UserPlus className="h-3.5 w-3.5" /> },
  { id: "server", label: "Comunidades", icon: <Megaphone className="h-3.5 w-3.5" /> },
  { id: "moderation", label: "Sistema", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

function describe(n: {
  type: string;
  actor: { name: string | null; username: string | null } | null;
  content: string | null;
}): { title: string; body: string } {
  const who = n.actor?.name ?? n.actor?.username ?? "Alguém";
  switch (n.type) {
    case "mention":
      return { title: `${who} mencionou você`, body: n.content ?? "" };
    case "dm":
      return { title: `${who} enviou uma mensagem`, body: n.content ?? "" };
    case "reply":
      return { title: `${who} respondeu você`, body: n.content ?? "" };
    case "friend_request":
      return { title: `${who} enviou um pedido de amizade`, body: "" };
    case "group_added":
      return { title: "Você foi adicionado a um grupo", body: n.content ?? "" };
    case "group_removed":
      return { title: "Você foi removido de um grupo", body: n.content ?? "" };
    case "call_started":
      return { title: `${who} iniciou uma chamada`, body: n.content ?? "" };
    case "moderation":
      return { title: "Aviso da moderação", body: n.content ?? "" };
    default:
      return { title: who, body: n.content ?? "" };
  }
}

/** Mobile notifications sheet — dados reais do notificationRouter. */
export function NotificationsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<Filter>("all");
  const list = trpc.notification.list.useQuery(undefined, { enabled: open });
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });
  const clearUnreadConversation = useAppStore(s => s.clearUnreadConversation);

  const items = useMemo(() => {
    const all = list.data ?? [];
    if (filter === "all") return all;
    if (filter === "server") return all.filter(n => n.serverId != null);
    return all.filter(n => n.type === filter);
  }, [list.data, filter]);

  if (!open) return null;

  const openTarget = (n: (typeof items)[number]) => {
    markRead.mutate({ id: n.id });
    if (n.conversationId) {
      clearUnreadConversation(n.conversationId);
      navigate(`/channels/@me/${n.conversationId}`);
    } else if (n.serverId && n.channelId) {
      navigate(`/channels/${n.serverId}/${n.channelId}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Notificações">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col rounded-t-2xl border-t border-white/10 bg-sidebar pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-base font-bold">Notificações</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted2 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none]">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                filter === f.id
                  ? "bg-[#5865F2] text-white"
                  : "bg-white/5 text-muted2 hover:bg-white/10"
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {list.isLoading ? (
            <p className="py-10 text-center text-xs text-muted2">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-xs text-muted2">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map(n => {
                const d = describe(n);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openTarget(n)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl p-3 text-left transition-colors",
                        n.isRead ? "hover:bg-white/5" : "bg-[#5865F2]/[0.08] hover:bg-[#5865F2]/[0.14]"
                      )}
                    >
                      {n.actor ? (
                        <Avatar
                          userId={n.actor.id}
                          name={n.actor.name ?? n.actor.username}
                          src={n.actor.avatar}
                          size="sm"
                          showStatus={false}
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2]/20 text-primary">
                          <Megaphone className="h-4 w-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", n.isRead ? "text-bodyx" : "font-bold text-white")}>
                          {d.title}
                        </span>
                        {d.body && (
                          <span className="mt-0.5 block truncate text-xs text-muted2">{d.body}</span>
                        )}
                      </span>
                      {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
