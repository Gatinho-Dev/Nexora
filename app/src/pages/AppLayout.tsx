import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { useAppStore } from "@/store/useAppStore";
import { ServerRail } from "@/components/ServerRail";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Menu, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  useRealtime(user?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const membersOpen = useAppStore((s) => s.membersOpen);
  const setMembersOpen = useAppStore((s) => s.setMembersOpen);

  // Sync unread counters fetched from the server into the store
  const unread = trpc.message.unread.useQuery(undefined, { enabled: !!user });
  useEffect(() => {
    if (unread.data) {
      useAppStore.getState().setUnread(unread.data.channels, unread.data.conversations);
    }
  }, [unread.data]);

  // Close mobile drawers on navigation
  useEffect(() => {
    setMobileNavOpen(false);
    setMembersOpen(false);
  }, [location.pathname, setMobileNavOpen, setMembersOpen]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-bg)]">
        <div className="pulsar-mark h-12 w-12 animate-pulse rounded-xl" />
      </div>
    );
  }

  const inServer =
    location.pathname.startsWith("/channels/") && !location.pathname.startsWith("/channels/@me");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--chat-bg)]">
      {/* Desktop rail */}
      <div className="hidden md:flex h-full">
        <ServerRail />
      </div>

      {/* Mobile drawer: rail + page sidebar (via portal) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full shadow-2xl">
            <ServerRail />
            <div id="mobile-sidebar-slot" className="flex h-full" />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-12 items-center gap-2 border-b border-border px-3 md:hidden bg-[var(--sidebar-bg)]">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--hover-bg)]"
            title="Menu"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button onClick={() => navigate("/channels/@me")} className="flex items-center gap-2 min-w-0">
            <div className="pulsar-mark h-6 w-6 rounded-md shrink-0" />
            <span className="text-sm font-semibold truncate">Pulsar</span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {inServer && (
              <button
                onClick={() => setMembersOpen(!membersOpen)}
                className={cn(
                  "rounded-md p-1.5 text-muted-foreground hover:bg-[var(--hover-bg)]",
                  membersOpen && "bg-[var(--active-bg)] text-foreground",
                )}
                title="Membros"
              >
                <Users className="h-5 w-5" />
              </button>
            )}
            <NotificationsBell />
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
