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
import { VoiceMediaRenderer } from "@/components/voice/VoiceMediaRenderer";
import { PermanentBanScreen } from "@/components/safety/PermanentBanScreen";
import { TriangleAlert } from "lucide-react";
import { NexoraAppIcon, NexoraLogo } from "@/components/NexoraBrand";

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
  const safety = trpc.safety.me.useQuery(undefined, { enabled: !!user });

  // Keep the sensitive-media preference in sync with the server.
  useEffect(() => {
    if (safety.data) {
      useAppStore
        .getState()
        .setSensitiveMediaPref(safety.data.safety.sensitiveMediaPref);
    }
  }, [safety.data]);

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
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-chat text-foreground">
        <NexoraAppIcon className="mb-4 h-14 w-14 animate-pulse" />
        <p className="text-sm font-medium text-muted2 animate-pulse">
          Carregando Nexora...
        </p>
      </div>
    );
  }

  // Server-side enforced ban — presentation only.
  if (safety.data?.safety.accountStatus === "permanently_banned") {
    return <PermanentBanScreen severeStrikes={safety.data.safety.severeStrikes} />;
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
    <div className="flex h-[100dvh] overflow-hidden bg-rail select-none text-[#F2F3F5]">
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
        {safety.data?.safety.accountStatus === "suspended" && (
          <button
            onClick={() => navigate("/channels/@me")}
            className="flex items-center justify-center gap-2 bg-red-500/15 px-3 py-2 text-left text-xs font-semibold text-red-200 hover:bg-red-500/20"
            aria-label="Conta suspensa: consulte o Status da Conta"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              Uma ação foi aplicada à sua conta — confira em Configurações → Status da Conta.
            </span>
          </button>
        )}
        {/* Mobile top bar */}
        <div className="flex h-12 items-center gap-2 border-b border-black/20 px-3 md:hidden bg-sidebar text-foreground">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted2 hover:bg-hov hover:text-white"
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
            aria-label="Ir para o início da Nexora"
            title="Nexora"
          >
            <NexoraLogo className="h-6 w-[112px]" decorative />
          </button>
          <div className="ml-auto flex items-center gap-1">
            {inServer && (
              <button
                onClick={() => setMembersOpen(!membersOpen)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-md text-muted2 hover:bg-hov",
                  membersOpen && "bg-act text-foreground"
                )}
                aria-label={membersOpen ? "Ocultar membros" : "Mostrar membros"}
                title="Membros"
              >
                <Users className="h-5 w-5" />
              </button>
            )}
            <NotificationsBell onOpenProfile={setActiveProfileUserId} />
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
      <VoiceMediaRenderer myUserId={user.id} />
    </div>
  );
}
