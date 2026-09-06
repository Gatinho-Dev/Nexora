import { useState } from "react";
import { useNavigate } from "react-router";
import {
  BadgeCheck,
  BellRing,
  ChevronLeft,
  ClipboardList,
  LoaderCircle,
  LockKeyhole,
  Megaphone,
  Shield,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { NexoraAppIcon, NexoraLogo } from "@/components/NexoraBrand";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { SafetySection } from "./admin/SafetySection";
import { BroadcastsSection as NewBroadcastsSection } from "@/components/admin/BroadcastsSection";
import { BadgesSection as NewBadgesSection } from "@/components/admin/BadgesSection";

type AdminSection = "broadcasts" | "badges" | "safety";

function AdminNavButton({
  active,
  icon: Icon,
  label,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Megaphone;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-[#5865F2]/35 bg-[#5865F2]/15 text-white"
          : "border-transparent text-[#aeb4be] hover:border-white/[0.06] hover:bg-white/[0.035] hover:text-white",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-[#5865F2] text-white" : "bg-white/[0.045] text-[#9299a4]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold">{label}</span>
        <span className="block truncate text-[10px] text-[#7f8792]">{description}</span>
      </span>
    </button>
  );
}

export function NexoraAdminPanel() {
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("broadcasts");
  const authority = trpc.admin.authority.useQuery();

  if (authority.isLoading) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-[#1b1d22] text-[#9aa1ab]" aria-busy="true">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-xs">Validando acesso seguro...</span>
      </main>
    );
  }

  if (!authority.data?.canAccess) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-[#1b1d22] p-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/[0.075] bg-[#22252b] p-7 shadow-2xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ed4245]/25 bg-[#ed4245]/10 text-[#ff8588]">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-white">Acesso administrativo restrito</h1>
          <p className="mt-2 text-xs leading-5 text-[#969da7]">
            Esta área exige uma conta autorizada pela configuração segura do servidor Nexora.
          </p>
          <Button onClick={() => navigate("/channels/@me")} className="mt-5 bg-[#5865F2] text-white hover:bg-[#5664e6]">
            <ChevronLeft className="h-4 w-4" />
            Voltar ao aplicativo
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 bg-[#1b1d22]" aria-label="Painel administrativo Nexora">
      <aside className="hidden w-[238px] shrink-0 flex-col border-r border-black/25 bg-[#1f2126] lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-white/[0.055] px-4">
          <NexoraLogo className="h-5 w-[112px]" />
        </div>
        <div className="flex-1 space-y-1 p-3">
          <p className="px-2 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#69717c]">Plataforma</p>
          <AdminNavButton active={section === "broadcasts"} icon={Megaphone} label="Comunicados" description="Mensagens oficiais globais" onClick={() => setSection("broadcasts")} />
          <AdminNavButton active={section === "badges"} icon={BadgeCheck} label="Emblemas" description="Identidade e equipe" onClick={() => setSection("badges")} />
          <AdminNavButton active={section === "safety"} icon={Shield} label="Segurança" description="Casos, ocorrências e IA" onClick={() => setSection("safety")} />
          <div className="my-3 h-px bg-white/[0.055]" />
          <div className="rounded-lg border border-white/[0.055] bg-[#191b20] p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#bdc2ca]">
              <Shield className="h-3.5 w-3.5 text-[#8e9aff]" />
              Sessão protegida
            </div>
            <p className="mt-1.5 text-[9px] leading-4 text-[#69717c]">Acesso e ações são validados no backend e registrados para auditoria.</p>
          </div>
        </div>
        <div className="border-t border-white/[0.055] p-3">
          <Button variant="ghost" onClick={() => navigate("/channels/@me/official")} className="w-full justify-start text-xs text-[#9da4ae] hover:bg-white/[0.045] hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            Voltar aos comunicados
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-black/25 bg-[#202228] px-4 sm:px-6">
          <div className="lg:hidden">
            <NexoraAppIcon className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-white">Painel Nexora</h1>
            <p className="truncate text-[10px] text-[#7f8792]">
              {authority.data.authority === "owner" ? "Proprietário da plataforma" : "Administrador da plataforma"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-[#5865F2]/25 bg-[#5865F2]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#b7beff]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso verificado
          </div>
        </header>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.055] bg-[#1f2126] px-3 py-2 lg:hidden" aria-label="Seções administrativas">
          <Button size="sm" variant="ghost" onClick={() => setSection("broadcasts")} className={cn("text-xs", section === "broadcasts" ? "bg-[#5865F2]/15 text-white" : "text-[#9da4ae]")}>
            <Megaphone className="h-3.5 w-3.5" />Comunicados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSection("badges")} className={cn("text-xs", section === "badges" ? "bg-[#5865F2]/15 text-white" : "text-[#9da4ae]")}>
            <BadgeCheck className="h-3.5 w-3.5" />Emblemas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSection("safety")} className={cn("text-xs", section === "safety" ? "bg-[#5865F2]/15 text-white" : "text-[#9da4ae]")}>
            <Shield className="h-3.5 w-3.5" />Segurança
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/channels/@me/official")} className="ml-auto text-xs text-[#9da4ae]">
            <ChevronLeft className="h-3.5 w-3.5" />Sair
          </Button>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#737b86]">
                  {section === "broadcasts" ? (
                    <BellRing className="h-3 w-3" />
                  ) : section === "safety" ? (
                    <Shield className="h-3 w-3" />
                  ) : (
                    <UsersRound className="h-3 w-3" />
                  )}
                  Administração da plataforma
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-[#f4f5f7]">
                  {section === "broadcasts"
                    ? "Comunicados oficiais"
                    : section === "badges"
                      ? "Emblemas de perfil"
                      : "Segurança e moderação"}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[#858c96]">
                  {section === "broadcasts"
                    ? "Publique avisos globais em nome da conta verificada Nexora e acompanhe o histórico."
                    : section === "safety"
                      ? "Revise casos de moderação, ocorrências, apelações e monitore a IA de segurança."
                      : "Crie emblemas e atribua identidade oficial às contas autorizadas."}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.065] bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-[#8f96a1]">
                <ClipboardList className="h-3.5 w-3.5" />
                Ações auditadas
              </span>
            </div>
            {section === "broadcasts" ? (
              <NewBroadcastsSection />
            ) : section === "badges" ? (
              <NewBadgesSection />
            ) : (
              <SafetySection />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
