import { format } from "date-fns";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";

/**
 * Configurações → Minha Conta → Minhas Denúncias
 */

const TARGET_TYPE_LABELS: Record<string, string> = {
  message: "Mensagem",
  user: "Usuário",
  media: "Mídia",
  server: "Servidor",
  channel: "Canal",
};

const CATEGORY_LABELS: Record<string, string> = {
  harassment: "Assédio",
  hate: "Discurso de ódio",
  sexual: "Conteúdo sexual",
  minor_safety: "Segurança de menores",
  violence: "Violência",
  self_harm: "Autolesão",
  spam_or_scam: "Spam ou golpe",
  personal_info: "Informação pessoal",
  impersonation: "Falsa identidade",
  illegal: "Atividade ilegal",
  other: "Outro",
};

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  submitted: {
    label: "Enviada",
    className: "border-blue-400/20 bg-blue-500/15 text-blue-200",
  },
  triaged: {
    label: "Enviada",
    className: "border-white/10 bg-white/[0.06] text-muted2",
  },
  under_review: {
    label: "Em análise",
    className: "border-amber-400/25 bg-amber-400/15 text-amber-300",
  },
  action_taken: {
    label: "Ação aplicada",
    className: "border-red-400/20 bg-red-500/10 text-red-300",
  },
  no_violation: {
    label: "Resolvida",
    className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  },
  closed: {
    label: "Resolvida",
    className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  },
};

export function ReportsList() {
  const reports = trpc.safety.myReports.useQuery();

  if (reports.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted2">
        Carregando denúncias...
      </div>
    );
  }

  if (!reports.data || reports.data.length === 0) {
    return (
      <p className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-xs text-muted2">
        Você ainda não enviou denúncias.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {reports.data.map(report => {
        const meta =
          STATUS_META[report.status] ??
          ({ label: report.status, className: "" } as const);
        return (
          <li
            key={report.id}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {CATEGORY_LABELS[report.category] ?? report.category}
                </p>
                <p className="mt-0.5 text-[11px] text-muted2">
                  Alvo: {TARGET_TYPE_LABELS[report.targetType] ?? report.targetType}
                  {" · "}
                  {format(new Date(report.createdAt), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              <Badge variant="outline" className={meta.className}>
                {meta.label}
              </Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
