import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import {
  BellRing,
  CalendarClock,
  CheckCheck,
  Info,
  LockKeyhole,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { DMSidebar } from "@/components/DMSidebar";
import { SidebarPortal } from "@/components/SidebarPortal";
import { OfficialIdentity } from "@/components/official/OfficialIdentity";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import type {
  OfficialAnnouncementDTO,
  OfficialAnnouncementKind,
} from "@contracts/types";

const kindPresentation: Record<
  OfficialAnnouncementKind,
  { label: string; icon: typeof Info; className: string }
> = {
  GENERAL: {
    label: "Comunicado",
    icon: Megaphone,
    className: "border-[#4654D8]/35 bg-[#4654D8]/10 text-[#aab3ff]",
  },
  UPDATE: {
    label: "Novidade",
    icon: Sparkles,
    className: "border-[#6e7cff]/35 bg-[#6e7cff]/10 text-[#c2c8ff]",
  },
  SECURITY: {
    label: "Segurança",
    icon: ShieldAlert,
    className: "border-[#f0a64a]/35 bg-[#f0a64a]/10 text-[#f5bf75]",
  },
  MAINTENANCE: {
    label: "Manutenção",
    icon: Wrench,
    className: "border-[#55b6a8]/35 bg-[#55b6a8]/10 text-[#7dd3c7]",
  },
};

function formatAnnouncementDate(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function AnnouncementItem({ announcement }: { announcement: OfficialAnnouncementDTO }) {
  const presentation = kindPresentation[announcement.kind];
  const KindIcon = presentation.icon;

  return (
    <article
      className={cn(
        "group relative grid grid-cols-[40px_minmax(0,1fr)] gap-3 px-5 py-4 transition-colors hover:bg-white/[0.025] sm:grid-cols-[44px_minmax(0,1fr)] sm:px-7",
        !announcement.isRead && "bg-[#4654D8]/[0.045]",
      )}
    >
      {!announcement.isRead && (
        <span
          className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#7383FF]"
          aria-label="Não lido"
        />
      )}
      <div className="pt-0.5">
        <OfficialIdentity compact className="[&>div+div]:hidden" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <OfficialIdentity compact className="[&>div:first-child]:hidden" />
          <time
            dateTime={new Date(announcement.publishedAt).toISOString()}
            className="text-[10px] font-medium text-[#858b95]"
          >
            {formatAnnouncementDate(announcement.publishedAt)}
          </time>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
              presentation.className,
            )}
          >
            <KindIcon className="h-3 w-3" />
            {presentation.label}
          </span>
        </div>
        <h2 className="mt-2 text-[15px] font-bold leading-snug text-[#f5f6f8]">
          {announcement.title}
        </h2>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#c8cdd5]">
          {announcement.content}
        </p>
        {announcement.expiresAt && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-[#858b95]">
            <CalendarClock className="h-3.5 w-3.5" />
            Válido até {formatAnnouncementDate(announcement.expiresAt)}
          </p>
        )}
      </div>
    </article>
  );
}

export function OfficialAnnouncements() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const markedIds = useRef(new Set<number>());
  const announcements = trpc.official.list.useQuery({ limit: 50 });
  const authority = trpc.admin.authority.useQuery();
  const markRead = trpc.official.markRead.useMutation({
    onSuccess: () => {
      void utils.official.list.invalidate();
      void utils.official.unreadCount.invalidate();
    },
  });

  const unreadIds = useMemo(
    () => announcements.data?.items.filter(item => !item.isRead).map(item => item.id) ?? [],
    [announcements.data?.items],
  );

  useEffect(() => {
    for (const announcementId of unreadIds) {
      if (markedIds.current.has(announcementId)) continue;
      markedIds.current.add(announcementId);
      markRead.mutate({ announcementId });
    }
    // The mutation instance changes as request state changes; ids are de-duplicated by the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds]);

  return (
    <div className="flex min-h-0 flex-1 bg-[#1d1f24]">
      <SidebarPortal>
        <DMSidebar />
      </SidebarPortal>

      <main className="flex min-w-0 flex-1 flex-col bg-[#22242a]" aria-label="Comunicados oficiais da Nexora">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-black/25 bg-[#202228] px-4 shadow-sm sm:px-5">
          <OfficialIdentity compact />
          <span className="hidden h-5 w-px bg-white/10 sm:block" aria-hidden="true" />
          <p className="hidden truncate text-xs text-[#949aa4] sm:block">Comunicados oficiais</p>
          {authority.data?.canAccess && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/nexora-admin")}
              className="ml-auto h-8 border border-[#4654D8]/30 bg-[#4654D8]/10 px-2.5 text-[11px] font-semibold text-[#bac1ff] hover:bg-[#4654D8]/20 hover:text-white"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Painel administrativo
            </Button>
          )}
        </header>

        <div className="border-b border-white/[0.06] bg-[#1f2127] px-4 py-3 sm:px-7">
          <div className="mx-auto flex max-w-4xl items-start gap-3 rounded-lg border border-[#4654D8]/25 bg-[#4654D8]/[0.07] px-3.5 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#8e9aff]" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#e8eaff]">Canal oficial e somente leitura</p>
              <p className="mt-0.5 text-[11px] leading-5 text-[#aeb4be]">
                Este chat é destinado às notificações oficiais do Nexora. A Nexora nunca pedirá sua senha ou token da conta.
              </p>
            </div>
          </div>
        </div>

        <section className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          <div className="mx-auto w-full max-w-5xl py-3">
            {announcements.isLoading ? (
              <div className="space-y-2 px-5 py-5 sm:px-7" role="status" aria-label="Carregando comunicados">
                {[0, 1, 2].map(item => (
                  <div key={item} className="flex gap-3 py-3">
                    <div className="h-10 w-10 animate-pulse rounded-xl bg-white/[0.06]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                      <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : announcements.isError ? (
              <div className="mx-5 my-8 rounded-lg border border-[#ed4245]/25 bg-[#ed4245]/10 px-4 py-4 text-sm text-[#ffb4b6] sm:mx-7">
                Não foi possível carregar os comunicados oficiais. Tente novamente em instantes.
              </div>
            ) : announcements.data?.items.length ? (
              <div className="divide-y divide-white/[0.055]">
                {announcements.data.items.map(item => (
                  <AnnouncementItem key={item.id} announcement={item} />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[380px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-[#858c98]">
                  <BellRing className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-base font-bold text-[#eef0f3]">Nenhum comunicado publicado</h2>
                <p className="mt-1 max-w-sm text-xs leading-5 text-[#949aa4]">
                  Atualizações oficiais, avisos de segurança e novidades aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="shrink-0 border-t border-black/20 bg-[#202228] px-4 py-3 sm:px-5">
          <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-lg border border-white/[0.07] bg-[#191b20] px-3.5 py-2.5 text-[#8f96a1]">
            <LockKeyhole className="h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 text-[11px] leading-4">
              Você não pode responder a esta conversa oficial.
            </p>
            <span className="hidden items-center gap-1 text-[10px] text-[#6f7680] sm:inline-flex">
              <CheckCheck className="h-3.5 w-3.5" />
              Autenticado pela Nexora
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
