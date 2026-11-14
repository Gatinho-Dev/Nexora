import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { cn } from "@/lib/utils";
import { Users, Inbox, Home } from "lucide-react";
import { NexoraAppIcon } from "../NexoraBrand";

type TabId = "home" | "servers" | "notifications" | "you";

/**
 * Navegação inferior fixa (mobile): Início, Comunidades, Caixa e Você.
 * Blur + safe-area, alvos de 64px, feedback tátil e auto-ocultação
 * enquanto o teclado está aberto (para o composer respirar).
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
  const keyboardOffset = useKeyboardOffset(true);
  const keyboardOpen = keyboardOffset > 80;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const notifBadge = Math.max(
    unreadNotifications.data?.count ?? 0,
    friendRequests,
  );

  // Evita flicker quando o teclado abre/fecha rápido.
  const visuallyHidden = useVisuallyHidden(keyboardOpen);
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const items: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "home", label: "Início", icon: <Home className="h-[22px] w-[22px]" />, badge: homeUnread },
    { id: "servers", label: "Comunidades", icon: <Users className="h-[22px] w-[22px]" /> },
    { id: "notifications", label: "Caixa", icon: <Inbox className="h-[22px] w-[22px]" />, badge: notifBadge },
    { id: "you", label: "Você", icon: <NexoraAppIcon className="h-6 w-6" decorative /> },
  ];

  const handle = (id: TabId) => {
    try {
      navigator.vibrate?.(8);
    } catch {
      // sem haptics — segue o jogo
    }
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
      aria-hidden={visuallyHidden || undefined}
      className={cn(
        "nexora-bottom-blur fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-black/20 pb-[env(safe-area-inset-bottom)]",
        "transition-transform duration-200 ease-out",
        visuallyHidden && "translate-y-full",
      )}
    >
      <div className="grid grid-cols-4 px-1" role="tablist">
        {items.map(item => {
          const active = activeTab === item.id;
          const showBadge = (item.badge ?? 0) > 0;
          const inHere =
            (item.id === "home" && location.pathname.startsWith("/channels/@me")) ||
            (item.id === "servers" && location.pathname.startsWith("/channels/") && !location.pathname.startsWith("/channels/@me"));
          const highlighted = active || (item.id !== "notifications" && item.id !== "you" && inHere && activeTab !== "notifications" && activeTab !== "you");
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={highlighted}
              onClick={() => handle(item.id)}
              aria-label={item.label + (showBadge ? `, ${item.badge} não lidas` : "")}
              aria-current={highlighted ? "page" : undefined}
              tabIndex={visuallyHidden ? -1 : 0}
              className={cn(
                "relative flex min-h-[64px] flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] font-semibold transition-colors select-none",
                "active:scale-95 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                highlighted ? "text-white" : "text-muted2 active:text-bodyx"
              )}
            >
              {highlighted && (
                <span
                  aria-hidden
                  className="absolute top-1 h-1 w-8 rounded-full bg-primary"
                />
              )}
              <span className={cn(
                "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                highlighted && "bg-primary/15 text-white",
              )}>
                {item.icon}
                {showBadge && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-rail">
                    {(item.badge ?? 0) > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className={cn("leading-none", highlighted ? "text-white" : "")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Esconde com pequeno atraso para não piscar junto do teclado. */
function useVisuallyHidden(keyboardOpen: boolean) {
  const [hidden, setHidden] = useState(keyboardOpen);
  useEffect(() => {
    if (!keyboardOpen) {
      const t = setTimeout(() => setHidden(false), 120);
      return () => clearTimeout(t);
    }
    setHidden(true);
    return undefined;
  }, [keyboardOpen]);
  return hidden;
}

/** Exposed tab type for AppLayout state. */
export type MobileTab = TabId;
