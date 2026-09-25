import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ShieldCheck, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useClientSettingsSync } from "@/hooks/useClientSettingsSync";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NexoraLogo } from "@/components/NexoraBrand";
import { ProfileStudio } from "@/components/profile/ProfileStudio";

import { SecurityCenter } from "@/components/safety/SecurityCenter";
import { DevicesSection } from "@/components/settings/DevicesSection";
import { ConnectionsSection } from "@/components/settings/ConnectionsSection";
import { IdentityPreferencesSection } from "@/components/settings/IdentityPreferencesSection";
import { SupportTicketsSection } from "@/components/settings/SupportTicketsSection";

import { AccountTab } from "@/components/settings/AccountTab";
import { PrivacyTab } from "@/components/settings/PrivacyTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { VoiceVideoTab } from "@/components/settings/VoiceVideoTab";
import {
  AppearanceTab,
  AccessibilityTab,
} from "@/components/settings/AppearanceSettings";
import { ShortcutsTab, LanguageTab } from "@/components/settings/ShortcutsTab";
import { AdvancedTab } from "@/components/settings/AdvancedTab";
import { FriendRequestsTab } from "@/components/settings/FriendRequestsTab";
import { FamilyCenterTab } from "@/components/settings/FamilyCenterTab";
import {
  ActivityPrivacyTab,
  RegisteredGamesTab,
} from "@/components/settings/ActivitySettings";
import {
  StandingTab,
  MyReportsTab,
  AppealsTab,
  SensitiveContentTab,
} from "@/components/settings/SafetyTabs";

/**
 * Modal de Configurações do Usuário (paridade Discord).
 *
 * Arquitetura:
 *  - Duas colunas com scroll independente: sidebar `w-64` (#2B2D31) e painel
 *    principal (#313338), dentro de um modal de 90vw × 90vh sobre overlay
 *    escurecido. Só o painel rola; a árvore de navegação fica sempre visível.
 *  - `MENU_GROUPS` é a taxonomia completa. O conteúdo da aba ativa é montado de
 *    forma condicional, então a árvore pesada de Voz e Vídeo é destruída ao
 *    sair e as preferências voltam da store global já persistidas.
 *  - Cada aba vive em `components/settings/*`; este arquivo cuida só do shell.
 */

type Tab =
  | "account"
  | "profile"
  | "identity"
  | "friend-requests"
  | "family"
  | "devices"
  | "security"
  | "standing"
  | "privacy"
  | "sensitive"
  | "my-reports"
  | "appeals"
  | "connections"
  | "support"
  | "appearance"
  | "accessibility"
  | "voice"
  | "notifications"
  | "shortcuts"
  | "language"
  | "activity-privacy"
  | "registered-games"
  | "advanced";

const MENU_GROUPS: {
  title: string;
  items: { id: Tab; label: string; icon?: React.ReactNode }[];
}[] = [
  {
    title: "MINHA CONTA",
    items: [
      { id: "account", label: "Minha conta" },
      { id: "profile", label: "Perfil" },
      { id: "identity", label: "Identidade e status" },
      { id: "friend-requests", label: "Pedidos de amizade" },
      { id: "family", label: "Central da Família" },
      { id: "devices", label: "Dispositivos conectados" },
      { id: "security", label: "Central de Segurança", icon: <ShieldCheck /> },
      { id: "standing", label: "Status da Conta" },
      { id: "privacy", label: "Conteúdo e Privacidade" },
      { id: "sensitive", label: "Conteúdo sensível" },
      { id: "connections", label: "Conexões" },
      { id: "support", label: "Suporte e tickets" },
    ],
  },
  {
    title: "CONFIGURAÇÕES DO APLICATIVO",
    items: [
      { id: "appearance", label: "Aparência" },
      { id: "accessibility", label: "Acessibilidade" },
      { id: "voice", label: "Voz e vídeo" },
      { id: "notifications", label: "Notificações" },
      { id: "shortcuts", label: "Atalhos" },
      { id: "language", label: "Idioma" },
    ],
  },
  {
    title: "ATIVIDADE",
    items: [
      { id: "activity-privacy", label: "Privacidade de atividade" },
      { id: "registered-games", label: "Jogos registrados" },
    ],
  },
  {
    title: "APP",
    items: [{ id: "advanced", label: "Avançado" }],
  },
];

export type SettingsTab = Tab;

export function UserSettingsModal({
  open,
  onOpenChange,
  initialTab = "account",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: Tab;
}) {
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[100dvh] w-[100vw] max-w-none gap-0 overflow-hidden rounded-none border-0 bg-[#313338] p-0 text-white select-none sm:h-[90vh] sm:w-[90vw] sm:!max-w-[1240px] sm:rounded-lg sm:border-black/40"
      >
        <DialogTitle className="sr-only">
          Configurações do Usuário Nexora
        </DialogTitle>
        {/* Shell interno: remonta a cada abertura (estado limpo no mobile). */}
        <SettingsShell
          isMobile={isMobile}
          open={open}
          initialTab={initialTab}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function SettingsShell({
  isMobile,
  open,
  initialTab,
  onOpenChange,
}: {
  isMobile: boolean;
  open: boolean;
  initialTab: Tab;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // Navegação empilhada no celular: lista → página com volta.
  const [entered, setEntered] = useState(
    () => isMobile && initialTab !== "account"
  );
  const activeLabel =
    MENU_GROUPS.flatMap(group => group.items).find(item => item.id === tab)
      ?.label ?? "";

  // Hidrata e sincroniza as preferências locais (debounce de 500 ms) só com o
  // modal aberto — nenhuma query extra para quem não abriu Configurações.
  useClientSettingsSync(open);

  const enterTab = (next: Tab) => {
    setTab(next);
    setEntered(true);
  };

  const leaveProfile = () => {
    setTab("account");
    if (isMobile) setEntered(false);
  };

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden sm:flex-row">
      {/* Sidebar — escopo de rolagem próprio, com barra oculta. */}
      <aside
        className={cn(
          "flex w-full min-w-0 max-w-full shrink-0 items-center gap-1 overflow-x-auto border-b border-black/20 bg-[#2B2D31] p-2 sm:block sm:h-full sm:w-64 sm:overflow-x-hidden sm:overflow-y-auto sm:border-r sm:border-b-0 sm:p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isMobile && entered && "hidden",
          tab === "profile" && "sm:hidden"
        )}
      >
        <div className="mb-4 hidden px-2 sm:block">
          <NexoraLogo className="h-6 w-auto" surface="dark" />
        </div>

        {MENU_GROUPS.map(group => (
          <div key={group.title} className="w-full shrink-0 sm:mb-5">
            <p className="hidden px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#949BA4] sm:block">
              {group.title}
            </p>
            <nav className="flex gap-1 sm:block sm:space-y-0.5">
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => enterTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={cn(
                    "flex w-auto items-center gap-2 whitespace-nowrap rounded px-2.5 py-1.5 text-left text-[12px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60 sm:w-full",
                    tab === item.id
                      ? "bg-[#5865F2] text-white"
                      : "text-[#B5BAC1] hover:bg-black/20 hover:text-white",
                    // Lista vertical confortável no celular (página inicial).
                    isMobile &&
                      !entered &&
                      "min-h-[48px] w-full justify-between rounded-lg px-4 text-sm text-white hover:bg-black/20 active:bg-black/30"
                  )}
                >
                  {item.icon ? (
                    <span className="text-white/80">{item.icon}</span>
                  ) : null}
                  <span>{item.label}</span>
                  {isMobile && !entered && (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-faint"
                      aria-hidden
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
        ))}
      </aside>

      {/* Conteúdo — segundo escopo de rolagem, independente da sidebar. */}
      <div
        className={cn(
          "relative min-h-0 min-w-0 flex-1 bg-[#313338]",
          isMobile && !entered && "hidden"
        )}
      >
        {/* Navegação empilhada (mobile): voltar para a lista */}
        {isMobile && tab !== "profile" && (
          <div className="absolute top-3 left-3 z-20 sm:hidden">
            <button
              onClick={() => setEntered(false)}
              aria-label="Voltar às configurações"
              className="flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-bold text-white transition-colors active:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
              Configurações
            </button>
          </div>
        )}

        {/* ESC close button */}
        <div
          className={cn(
            "absolute top-3 right-3 z-20 flex items-center gap-1.5 sm:top-5 sm:right-6",
            tab === "profile" && "hidden"
          )}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-muted2 transition-colors hover:bg-white/10 hover:text-white"
            title="Fechar (ESC)"
            aria-label="Fechar configurações"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="hidden text-[10px] font-bold uppercase tracking-wider text-muted2 sm:inline">
            ESC
          </span>
        </div>

        <ScrollArea className="h-full">
          <div
            className={cn(
              "mx-auto w-full min-w-0 max-w-3xl p-4 pt-14 pr-14 sm:p-8 sm:pt-8 sm:pr-20",
              tab === "profile" && "max-w-none p-0 pt-12 pr-0 sm:p-0 sm:pt-0 sm:pr-0"
            )}
          >
            {isMobile && <p className="sr-only">{activeLabel}</p>}
            {tab === "account" && <AccountTab />}
            {tab === "profile" && (
              <ProfileStudio
                onBack={leaveProfile}
                onClose={() => onOpenChange(false)}
              />
            )}
            {tab === "identity" && <IdentityPreferencesSection />}
            {tab === "friend-requests" && <FriendRequestsTab />}
            {tab === "family" && <FamilyCenterTab onNavigate={enterTab} />}
            {tab === "support" && <SupportTicketsSection />}
            {tab === "devices" && <DevicesSection />}
            {tab === "security" && <SecurityCenter onNavigate={enterTab} />}
            {tab === "standing" && <StandingTab />}
            {tab === "sensitive" && <SensitiveContentTab />}
            {tab === "my-reports" && <MyReportsTab />}
            {tab === "appeals" && <AppealsTab />}
            {tab === "privacy" && <PrivacyTab />}
            {tab === "connections" && <ConnectionsSection />}
            {tab === "appearance" && <AppearanceTab />}
            {tab === "accessibility" && <AccessibilityTab />}
            {tab === "voice" && <VoiceVideoTab />}
            {tab === "notifications" && <NotificationsTab />}
            {tab === "shortcuts" && <ShortcutsTab />}
            {tab === "language" && <LanguageTab />}
            {tab === "activity-privacy" && (
              <ActivityPrivacyTab onNavigate={enterTab} />
            )}
            {tab === "registered-games" && <RegisteredGamesTab />}
            {tab === "advanced" && <AdvancedTab />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
