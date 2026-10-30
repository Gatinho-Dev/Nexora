import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type QueueStatus = "pending_review" | "confirmed" | "false_positive" | "resolved";

const TABS: { id: QueueStatus; label: string }[] = [
  { id: "pending_review", label: "Pendentes" },
  { id: "confirmed", label: "Confirmadas" },
  { id: "false_positive", label: "Falsos positivos" },
  { id: "resolved", label: "Resolvidas" },
];

const CATEGORY_LABELS: Record<string, string> = {
  sexual_minor: "Conteúdo sexual envolvendo possível menor",
  manual_moderator_action: "Decisão da moderação",
};

/** Fila clássica de ocorrências (violations), agora dentro da sub-tab "Ocorrências". */
export function ViolationsQueueSection() {
  const [tab, setTab] = useState<QueueStatus>("pending_review");
  const utils = trpc.useUtils();
  const queue = trpc.admin.safetyQueue.useQuery({ status: tab });

  const review = trpc.admin.reviewViolation.useMutation({
    onSuccess: (_data, vars) => {
      utils.admin.safetyQueue.invalidate();
      toast.success(
        vars.decision === "confirm"
          ? "Infração confirmada e strike aplicado."
          : "Falso positivo registrado — suspensão removida, sem strike."
      );
    },
    onError: e => toast.error(e.message),
  });
  const resolve = trpc.admin.resolveViolation.useMutation({
    onSuccess: () => {
      utils.admin.safetyQueue.invalidate();
      toast.success("Ocorrência resolvida.");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              tab === t.id
                ? "bg-[#5865F2] text-white"
                : "bg-white/[0.04] text-[#9da4ae] hover:bg-white/[0.08] hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {queue.isLoading ? (
        <p className="py-10 text-center text-xs text-[#858c96]">Carregando ocorrências...</p>
      ) : (queue.data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-white/[0.055] bg-[#191b20] py-12 text-center text-xs text-[#858c96]">
          Nenhuma ocorrência nesta aba.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.data!.map(({ violation, user }) => (
            <li
              key={violation.id}
              className="rounded-xl border border-white/[0.06] bg-[#1c1e23] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">
                    #{violation.id} ·{" "}
                    {user?.name ?? user?.username ?? `Usuário ${violation.userId}`}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9da4ae]">
                    {CATEGORY_LABELS[violation.category] ?? violation.category}
                    {" · "}
                    {new Date(violation.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {violation.internalNote && (
                    <p className="mt-1 rounded bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
                      Nota: {violation.internalNote}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tab === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        className="bg-red-500/90 text-xs font-bold hover:bg-red-600"
                        disabled={review.isPending}
                        onClick={() =>
                          review.mutate({ violationId: violation.id, decision: "confirm" })
                        }
                      >
                        Confirmar infração
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-emerald-300 hover:bg-emerald-400/10"
                        disabled={review.isPending}
                        onClick={() =>
                          review.mutate({
                            violationId: violation.id,
                            decision: "false_positive",
                          })
                        }
                      >
                        Falso positivo
                      </Button>
                    </>
                  )}
                  {tab === "pending_review" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-[#9da4ae]"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ violationId: violation.id })}
                    >
                      Resolver
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[#737b86]">
                Ação: {violation.action} · Strike aplicado:{" "}
                {violation.strikeApplied ? "sim" : "não"} · Fonte: {violation.source}
                {violation.moderationModel ? ` · ${violation.moderationModel}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
