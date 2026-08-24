import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { useAppStore } from "@/store/useAppStore";
import { ServerRail } from "@/components/ServerRail";
import { ContextMenu, type ContextMenuState } from "@/components/ContextMenu";
import { ProfileCard } from "@/components/ProfileCard";
import { QuickSwitcherModal } from "@/components/modals/QuickSwitcherModal";
import { ShortcutsModal } from "@/components/modals/ShortcutsModal";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceMediaRenderer } from "@/components/voice/VoiceMediaRenderer";
import { IncomingCallToast } from "@/components/voice/IncomingCallToast";
import { VoiceConnectionBar } from "@/components/mobile/VoiceConnectionBar";
import { useVoiceCallView } from "@/hooks/useVoiceCallView";
import { PermanentBanScreen } from "@/components/safety/PermanentBanScreen";
import {
  UserSettingsModal,
  type SettingsTab,
} from "@/components/modals/UserSettingsModal";
import { OPEN_SETTINGS_EVENT } from "@/lib/openUserSettings";
import { MigrationBanner } from "@/components/MigrationBanner";
import { BottomNav, type MobileTab } from "@/components/mobile/BottomNav";
import { YouSheet } from "@/components/mobile/YouSheet";
import { NotificationsSheet } from "@/components/mobile/NotificationsSheet";
import { ServersSheet } from "@/components/mobile/ServersSheet";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { NexoraAppIcon, NexoraLogo } from "@/components/NexoraBrand";

export function AppLayout() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  useRealtime(user?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const mobileNavOpen = useAppStore(s => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore(s => s.setMobileNavOpen);
  const setMembersOpen = useAppStore(s => s.setMembersOpen);

  // Global modals and context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [activeProfileUserId, setActiveProfileUserId] = useState<number | null>(
    null
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  useEffect(() => {
    const openSettings = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: SettingsTab }>).detail?.tab;
      if (tab) setSettingsTab(tab);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () =>
      window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, []);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  useEffect(() => {
    const open = () => setMobileTab("servers");
    window.addEventListener("nexora:open-servers", open);
    return () => window.removeEventListener("nexora:open-servers", open);
  }, []);

  // Notificações do PC: pergunta UMA vez (clicável = gesto do usuário).
  useEffect(() => {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "default"
    ) {
      return;
    }
    if (localStorage.getItem("nexora-desktop-notif-asked") === "1") return;
    localStorage.setItem("nexora-desktop-notif-asked", "1");
    toast(
      "Quer receber notificações da Nexora no seu computador?",
      {
        duration: 15_000,
        action: {
          label: "Ativar",
          onClick: () => {
            void Notification.requestPermission();
          },
        },
      }
    );
  }, []);
  const keyboardOffset = useKeyboardOffset(true);
  const quickSwitcherOpen = useAppStore(st => st.quickSwitcherOpen);
  const wsConnected = useAppStore(st => st.wsConnected);
  const { inCall, viewingCall } = useVoiceCallView();

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

  const inVoiceCall = inCall;
  const mobileBottomPadding =
    !inVoiceCall
      ? "pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0"
      : viewingCall
        ? ""
        : "pb-[calc(66px+env(safe-area-inset-bottom))] md:pb-0";

  // Server-side enforced ban — presentation only.
  if (safety.data?.safety.accountStatus === "permanently_banned") {
    return <PermanentBanScreen severeStrikes={safety.data.safety.severeStrikes} />;
  }

  const inServer =
    location.pathname.startsWith("/channels/") &&
    !location.pathname.startsWith("/channels/@me");
  // Top bar mobile só onde não há header próprio com menu/voltar.
  const inDmConversation = /^\/channels\/@me\/\d+/.test(location.pathname);
  const showMobileTopBar = !inServer && !inDmConversation;

  function inferTab(pathname: string): MobileTab {
    if (pathname.startsWith("/channels/@me")) return "home";
    if (pathname.startsWith("/channels/")) return "servers";
    return "home";
  }

  function handleMobileTab(tab: MobileTab) {
    if (tab === "home") {
      navigate("/channels/@me");
      setMobileTab("home");
      return;
    }
    // sheets toggle; navigating away closes overlays
    setMobileTab(prev => (prev === tab ? null : tab));
  }

  const handleOpenContextMenu = (
    e: React.MouseEvent,
    type: "user" | "channel" | "server",
    id: number
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-rail select-none text-[#F2F3F5]">
      <MigrationBanner />

      <div className="flex min-h-0 flex-1">
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

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          mobileBottomPadding
        )}
        style={
          keyboardOffset > 0
            ? ({ "--kb": `${keyboardOffset}px`, marginBottom: "var(--kb)" } as React.CSSProperties)
            : undefined
        }
      >
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
        {/* Offline banner */}
        {!wsConnected && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-200 md:hidden"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
            Sem conexão — reconectando…
          </div>
        )}
        {/* Mobile top bar — só nas telas sem header próprio (home, requests,
            oficial). Em servidores e conversas o header da tela é único. */}
        {showMobileTopBar && (
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
          </div>
        )}

        <Outlet
          context={{
            onOpenContextMenu: handleOpenContextMenu,
            onOpenProfile: setActiveProfileUserId,
          }}
        />
      </div>

      {/* Mobile navigation layer */}
      {!inVoiceCall && (
        <BottomNav
          activeTab={mobileTab ?? inferTab(location.pathname)}
          onTabChange={handleMobileTab}
        />
      )}
      <VoiceConnectionBar />
      <YouSheet open={mobileTab === "you"} onClose={() => setMobileTab(null)} />
      <NotificationsSheet open={mobileTab === "notifications"} onClose={() => setMobileTab(null)} />
      <ServersSheet open={mobileTab === "servers"} onClose={() => setMobileTab(null)} />

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
        onOpenChange={v => useAppStore.getState().setQuickSwitcherOpen(v)}
      />
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <UserSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
      />
      <IncomingCallToast />
      <VoiceMediaRenderer myUserId={user.id} />
      </div>
    </div>
  );
}
