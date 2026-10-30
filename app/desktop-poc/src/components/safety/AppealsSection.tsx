import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Configurações → Minha Conta → Apelações
 *
 * Lista as apelações do usuário e o andamento de cada revisão.
 */

const APPEAL_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  submitted: {
    label: "Solicitada",
    className: "border-blue-400/20 bg-blue-500/15 text-blue-200",
  },
  under_review: {
    label: "Em revisão",
    className: "border-amber-400/25 bg-amber-400/15 text-amber-300",
  },
  approved: {
    label: "Aprovada ✅",
    className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  },
  denied: {
    label: "Negada",
    className: "border-red-400/20 bg-red-500/10 text-red-300",
  },
};

const ACTION_LABELS: Record<string, string> = {
  none: "Sem ação adicional",
  warning: "Advertência",
  limited: "Funcionalidades limitadas",
  content_blocked: "Conteúdo bloqueado",
  three_day_suspension: "Suspensão de 3 dias",
  temporary_suspension: "Suspensão temporária",
  permanent_ban: "Banimento permanente",
};

const VIOLATION_CATEGORY_LABELS: Record<string, string> = {
  sexual_minor: "Conteúdo sexual envolvendo possível menor",
  sexual_minor_violation: "Violação grave de segurança",
  manual_moderator_action: "Decisão da moderação",
};

function violationCategoryLabel(category: string | null): string {
  if (!category) return "—";
  return VIOLATION_CATEGORY_LABELS[category] ?? "Violação das diretrizes";
}

export function AppealsSection() {
  const appeals = trpc.safety.myAppeals.useQuery();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
          Suas apelações
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void appeals.refetch()}
          disabled={appeals.isFetching}
          className="h-8 gap-1.5 bg-white/[0.06] px-2.5 text-[11px] font-bold text-white hover:bg-white/[0.12]"
        >
          <RefreshCw
            className={appeals.isFetching ? "h-3 w-3 animate-spin" : "h-3 w-3"}
            aria-hidden
          />
          Atualizar
        </Button>
      </div>

      {appeals.isLoading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted2">
          Carregando apelações...
        </div>
      ) : !appeals.data || appeals.data.length === 0 ? (
        <p className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-xs text-muted2">
          Você não enviou nenhuma apelação. Se discordar de uma decisão, use o
          botão “Apelar” na infração em Status da Conta.
        </p>
      ) : (
        <ul className="space-y-2">
          {appeals.data.map(appeal => {
            const meta =
              APPEAL_STATUS_META[appeal.status] ??
              ({ label: appeal.status, className: "" } as const);
            return (
              <li
                key={appeal.id}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    Apelação #{appeal.id}
                    {appeal.violationId != null && (
                      <span className="ml-1.5 text-[11px] font-normal text-faint">
                        · infração #{appeal.violationId}
                      </span>
                    )}
                  </p>
                  <Badge variant="outline" className={meta.className}>
                    {meta.label}
                  </Badge>
                </div>

                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="font-semibold text-faint">Motivo:</dt>
                  <dd>{violationCategoryLabel(appeal.violationCategory)}</dd>
                  <dt className="font-semibold text-faint">Ação:</dt>
                  <dd>
                    {appeal.violationAction
                      ? (ACTION_LABELS[appeal.violationAction] ??
                        appeal.violationAction)
                      : "—"}
                  </dd>
                  <dt className="font-semibold text-faint">Data:</dt>
                  <dd>{format(new Date(appeal.createdAt), "dd/MM/yyyy HH:mm")}</dd>
                </dl>

                <blockquote className="mt-2 rounded-lg border-l-2 border-white/10 bg-white/[0.04] px-3 py-2 text-xs italic text-muted2">
                  {appeal.reason}
                </blockquote>

                {appeal.reviewNote && (
                  <p className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muted2">
                    <span className="font-semibold text-bodyx">
                      Resposta da equipe:
                    </span>{" "}
                    {appeal.reviewNote}
                  </p>
                )}
                {appeal.reviewedAt && (
                  <p className="mt-1.5 text-[10px] text-faint">
                    Revisada em {format(new Date(appeal.reviewedAt), "dd/MM/yyyy HH:mm")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
