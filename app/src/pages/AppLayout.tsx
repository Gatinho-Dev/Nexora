import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { useAppStore } from "@/store/useAppStore";
import { ServerRail } from "@/components/ServerRail";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ContextMenu, type ContextMenuState } from "@/components/ContextMenu";
import { ProfileCard } from "@/components/ProfileCard";
import { QuickSwitcherModal } from "@/components/modals/QuickSwitcherModal";
import { ShortcutsModal } from "@/components/modals/ShortcutsModal";
import { Menu, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  useRealtime(user?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const mobileNavOpen = useAppStore(s => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore(s => s.setMobileNavOpen);
  const membersOpen = useAppStore(s => s.membersOpen);
  const setMembersOpen = useAppStore(s => s.setMembersOpen);

  // Global modals and context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [activeProfileUserId, setActiveProfileUserId] = useState<number | null>(
    null
  );
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Sync unread counters
  const unread = trpc.message.unread.useQuery(undefined, { enabled: !!user });
  useEffect(() => {
    if (unread.data) {
      useAppStore
        .getState()
        .setUnread(unread.data.channels, unread.data.conversations);
    }
  }, [unread.data]);

  // Close mobile drawers on navigation
  useEffect(() => {
    setMobileNavOpen(false);
    setMembersOpen(false);
  }, [location.pathname, setMobileNavOpen, setMembersOpen]);

  if (isLoading || !user) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-[#313338] text-white">
        <div className="h-14 w-14 rounded-[18px] bg-[#5865F2] animate-pulse flex items-center justify-center font-black text-xl text-white mb-4">
          N
        </div>
        <p className="text-sm font-medium text-[#B5BAC1] animate-pulse">
          Carregando Nexora...
        </p>
      </div>
    );
  }

  const inServer =
    location.pathname.startsWith("/channels/") &&
    !location.pathname.startsWith("/channels/@me");

  const handleOpenContextMenu = (
    e: React.MouseEvent,
    type: "user" | "channel" | "server",
    id: number
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#1E1F22] select-none text-[#F2F3F5]">
      {/* Desktop Rail */}
      <div className="hidden md:flex h-full">
        <ServerRail onOpenContextMenu={handleOpenContextMenu} />
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full shadow-2xl">
            <ServerRail onOpenContextMenu={handleOpenContextMenu} />
            <div id="mobile-sidebar-slot" className="flex h-full" />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-12 items-center gap-2 border-b border-black/20 px-3 md:hidden bg-[#2B2D31] text-white">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-[#B5BAC1] hover:bg-[#35373C] hover:text-white"
            aria-label={mobileNavOpen ? "Fechar menu" : "Abrir menu"}
            title="Menu"
          >
            {mobileNavOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => navigate("/channels/@me")}
            className="flex items-center gap-2 min-w-0"
          >
            <div className="h-7 w-7 rounded-[10px] bg-[#5865F2] flex items-center justify-center font-extrabold text-xs text-white">
              N
            </div>
            <span className="text-sm font-bold tracking-wide truncate text-white">
              Nexora
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {inServer && (
              <button
                onClick={() => setMembersOpen(!membersOpen)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-md text-[#B5BAC1] hover:bg-[#35373C]",
                  membersOpen && "bg-[#404249] text-white"
                )}
                aria-label={membersOpen ? "Ocultar membros" : "Mostrar membros"}
                title="Membros"
              >
                <Users className="h-5 w-5" />
              </button>
            )}
            <NotificationsBell />
          </div>
        </div>

        <Outlet
          context={{
            onOpenContextMenu: handleOpenContextMenu,
            onOpenProfile: setActiveProfileUserId,
          }}
        />
      </div>

      {/* Global Modals & Context Menus */}
      <ContextMenu
        menuState={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpenProfile={setActiveProfileUserId}
      />
      <ProfileCard
        userId={activeProfileUserId}
        onClose={() => setActiveProfileUserId(null)}
      />
      <QuickSwitcherModal
        open={quickSwitcherOpen}
        onOpenChange={setQuickSwitcherOpen}
      />
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
