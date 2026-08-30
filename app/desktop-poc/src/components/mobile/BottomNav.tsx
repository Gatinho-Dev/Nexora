import { useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { Users, Bell, Home } from "lucide-react";
import { NexoraAppIcon } from "../NexoraBrand";

type TabId = "home" | "servers" | "notifications" | "you";

/**
 * Fixed bottom navigation (mobile only). Four areas: Início, Comunidades,
 * Notificações e Você. Respects the iPhone safe area.
 */
export function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadConversations = useAppStore(s => s.unreadConversations);
  const unreadChannels = useAppStore(s => s.unreadChannels);

  const dmUnread = Object.values(unreadConversations).reduce((a, b) => a + b, 0);
  const chUnread = Object.values(unreadChannels).reduce((a, b) => a + b, 0);
  const homeUnread = dmUnread + chUnread;

  const friends = trpc.friend.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const friendRequests =
    friends.data?.filter(
      f =>
        f.status === "PENDING" &&
        f.direction === "incoming"
    ).length ?? 0;
  const unreadNotifications = trpc.notification.unreadCount.useQuery(
    undefined,
    { refetchInterval: 60_000, staleTime: 30_000 }
  );
  const notifBadge = (unreadNotifications.data?.count ?? 0) + friendRequests;

  const inServer = location.pathname.startsWith("/channels/") &&
    !location.pathname.startsWith("/channels/@me");

  const items: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "home", label: "Início", icon: <Home className="h-[22px] w-[22px]" />, badge: homeUnread },
    { id: "servers", label: "Comunidades", icon: <Users className="h-[22px] w-[22px]" /> },
    { id: "notifications", label: "Notificações", icon: <Bell className="h-[22px] w-[22px]" />, badge: notifBadge },
    { id: "you", label: "Você", icon: <NexoraAppIcon className="h-6 w-6" decorative /> },
  ];

  const handle = (id: TabId) => {
    if (id === "home") navigate("/channels/@me");
    if (activeTab === id && id !== "home") {
      onTabChange(id); // toggle sheet closed
      return;
    }
    onTabChange(id);
  };

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-black/20 bg-rail pb-[env(safe-area-inset-bottom)]",
        inServer ? "" : ""
      )}
      style={{ transition: "transform 200ms ease" }}
    >
      <div className="grid grid-cols-4">
        {items.map(item => {
          const active = activeTab === item.id;
          const showBadge = (item.badge ?? 0) > 0;
          return (
            <button
              key={item.id}
              onClick={() => handle(item.id)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-semibold transition-colors select-none active:scale-95",
                active ? "text-white" : "text-muted2 hover:text-bodyx"
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                />
              )}
              <span className="relative">
                {item.icon}
                {showBadge && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-rail">
                    {(item.badge ?? 0) > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className={cn(active ? "text-white" : "")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Exposed tab type for AppLayout state. */
export type MobileTab = TabId;
