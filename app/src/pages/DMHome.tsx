import { DMSidebar } from "@/components/DMSidebar";
import { FriendsPanel } from "@/components/FriendsPanel";
import { SidebarPortal } from "@/components/SidebarPortal";
import { useOutletContext, useNavigate } from "react-router";
import type { AppOutletContext } from "@/lib/appOutletContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/store/useAppStore";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { Search, UserPlus, Users } from "lucide-react";
import { NexoraAppIcon } from "@/components/NexoraBrand";

/**
 * Home: desktop mantém sidebar+friends; no celular vira uma tela de
 * conversas recentes com ações rápidas (buscar / amigos / comunidades).
 */
export function DMHome() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const isMobile = useIsMobile();
  if (!isMobile) {
    return (
      <div className="flex flex-1 min-h-0">
        <SidebarPortal>
          <DMSidebar onOpenProfile={onOpenProfile} />
        </SidebarPortal>
        <FriendsPanel onOpenProfile={onOpenProfile} />
      </div>
    );
  }
  return <MobileHome onOpenProfile={onOpenProfile} />;
}

function MobileHome({ onOpenProfile }: { onOpenProfile?: (userId: number) => void }) {
  const navigate = useNavigate();
  const setQuickSwitcher = useAppStore(s => s.setQuickSwitcherOpen);
  const conversations = trpc.dm.list.useQuery();
  const me = trpc.auth.me.useQuery().data;
  const unreadConversations = useAppStore(s => s.unreadConversations);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-chat text-foreground">
      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-2 pt-3">
        <QuickAction
          icon={<Search className="h-5 w-5" />}
          label="Buscar"
          onClick={() => setQuickSwitcher(true)}
        />
        <QuickAction
          icon={<UserPlus className="h-5 w-5" />}
          label="Amigos"
          onClick={() => {
            // FriendsPanel já é a home desktop; no mobile abrimos o painel de amigos via rota @me + query? Mantemos simples: abre painel de amigos em sheet-less route.
            navigate("/channels/@me?tab=friends");
          }}
        />
        <QuickAction
          icon={<Users className="h-5 w-5" />}
          label="Comunidades"
          onClick={() => {
            // BottomNav controla a layer; dispara clique programático via evento custom.
            window.dispatchEvent(new CustomEvent("nexora:open-servers"));
          }}
        />
      </div>

      <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-faint">
        Mensagens diretas
      </p>

      {/* Conversas recentes */}
      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {conversations.isLoading && (
          <li className="py-10 text-center text-xs text-muted2">Carregando...</li>
        )}
        {(conversations.data?.length ?? 0) === 0 && !conversations.isLoading && (
          <li className="flex flex-col items-center gap-3 py-16 text-center">
            <NexoraAppIcon className="h-12 w-12 opacity-40" />
            <p className="text-sm font-semibold">Nenhuma conversa ainda</p>
            <p className="max-w-[240px] text-xs text-muted2">
              Adicione amigos ou entre em uma comunidade para começar a conversar.
            </p>
          </li>
        )}
        {conversations.data?.filter(c => !c.isRequest).map(conv => {
          const other = conv.otherUser;
          const unread = unreadConversations[conv.id] ?? 0;
          const last = conv.lastMessage;
          const time = last ? formatTime(last.createdAt) : "";
          return (
            <li key={conv.id}>
              <button
                onClick={() => navigate(`/channels/@me/${conv.id}`)}
                className={cn(
                  "flex min-h-[64px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-white/[0.06]",
                  unread > 0 && "bg-white/[0.03]"
                )}
              >
                {other?.id ? (
                  <Avatar
                    userId={other.id}
                    name={other.name ?? other.username}
                    src={other.avatar}
                    size="md"
                    showStatus
                    statusOverride={other.status ?? "online"}
                  />
                ) : (
                  <Avatar name="?" size="md" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm",
                      unread > 0 ? "font-bold text-white" : "font-semibold text-bodyx"
                    )}
                  >
                    {other?.name ?? other?.username ?? "Conversa"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted2">
                    {last
                      ? `${last.authorId === me?.id ? "Você: " : ""}${last.content || "📎 Anexo"}`
                      : "Nova conversa"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {time && <span className="text-[10px] text-faint">{time}</span>}
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {onOpenProfile ? null : null}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-panel ring-1 ring-black/10 dark:ring-white/[0.06] transition-colors hover:bg-hov"
    >
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-semibold text-muted2">{label}</span>
    </button>
  );
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
