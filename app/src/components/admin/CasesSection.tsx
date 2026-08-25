import { useState } from "react";
import { toast } from "sonner";
import { Bot, FileSearch, LoaderCircle, UsersRound } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  CASE_CATEGORY_LABELS,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  parseAiAssessment,
  timeAgo,
} from "./safetyShared";

type CaseStatus = "open" | "under_review" | "confirmed" | "false_positive" | "closed";
type CaseFilter = "critical" | CaseStatus;
type CaseQueryInput = { status?: CaseStatus; onlyCritical?: boolean; limit?: number };

const FILTERS: { id: CaseFilter; label: string; input: CaseQueryInput }[] = [
  { id: "critical", label: "Críticos", input: { onlyCritical: true } },
  { id: "open", label: "Abertos", input: { status: "open" } },
  { id: "under_review", label: "Em análise", input: { status: "under_review" } },
  { id: "confirmed", label: "Confirmados", input: { status: "confirmed" } },
  { id: "false_positive", label: "Falsos positivos", input: { status: "false_positive" } },
  { id: "closed", label: "Resolvidos", input: { status: "closed" } },
];

export function CasesSection() {
  const [filter, setFilter] = useState<CaseFilter>("critical");
  const [reviewCaseId, setReviewCaseId] = useState<number | null>(null);

  const active = FILTERS.find(f => f.id === filter) ?? FILTERS[0];
  const queue = trpc.admin.casesQueue.useQuery(active.input);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              filter === f.id
                ? "bg-[#5865F2] text-white"
                : "bg-white/[0.04] text-[#9da4ae] hover:bg-white/[0.08] hover:text-white",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {queue.isLoading ? (
        <p className="py-10 text-center text-xs text-[#858c96]">Carregando casos...</p>
      ) : (queue.data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-white/[0.055] bg-[#191b20] py-12 text-center text-xs text-[#858c96]">
          Nenhum caso neste filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.data!.map(({ case: moderationCase, reportedUser }) => (
            <li
              key={moderationCase.id}
              className="rounded-xl border border-white/[0.06] bg-[#1c1e23] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-white">
                      Caso #NX-{moderationCase.id}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-[4px] px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider",
                        PRIORITY_BADGE_CLASSES[moderationCase.priority],
                      )}
                    >
                      {PRIORITY_LABELS[moderationCase.priority] ?? moderationCase.priority}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[#9da4ae]">
                    {CASE_CATEGORY_LABELS[moderationCase.category] ?? moderationCase.category}
                    {" · "}
                    {moderationCase.aiAssessment ? (
                      <span className="inline-flex items-center gap-1">
                        <Bot className="inline h-3 w-3" />
                        Detecção automática
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <UsersRound className="inline h-3 w-3" />
                        Denúncias
                      </span>
                    )}
                    {" · "}
                    {moderationCase.reportsCount} denúncia(s)
                    {" · "}
                    {timeAgo(moderationCase.createdAt)}
                  </p>
                  {(reportedUser?.name || reportedUser?.username) && (
                    <p className="mt-0.5 text-[11px] text-[#737b86]">
                      Usuário reportado:{" "}
                      <span className="font-semibold text-[#aeb4be]">
                        {reportedUser.name ?? reportedUser.username}
                      </span>
                      {reportedUser.username ? ` @${reportedUser.username}` : ""}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReviewCaseId(moderationCase.id)}
                  className="border-white/10 bg-transparent text-xs text-[#bdc2ca] hover:bg-white/[0.05] hover:text-white"
                >
                  <FileSearch className="h-3.5 w-3.5" /> Revisar caso
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviewCaseId !== null && (
        <CaseReviewDialog caseId={reviewCaseId} onClose={() => setReviewCaseId(null)} />
      )}
    </div>
  );
}

function CaseReviewDialog({ caseId, onClose }: { caseId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const detail = trpc.admin.caseDetail.useQuery({ caseId });

  const invalidateAfterAction = () => {
    utils.admin.casesQueue.invalidate();
    utils.admin.caseDetail.invalidate({ caseId });
    utils.admin.safetyQueue.invalidate();
    utils.admin.safetyAuditEvents.invalidate();
  };

  const review = trpc.admin.reviewCase.useMutation({
    onSuccess: () => {
      invalidateAfterAction();
      toast.success(`Decisão aplicada ao caso #NX-${caseId}.`);
      onClose();
    },
    onError: e => toast.error(e.message),
  });

  const removeContent = trpc.admin.removeCaseContent.useMutation({
    onSuccess: result => {
      invalidateAfterAction();
      toast.success(
        result.removed
          ? "Conteúdo removido do caso."
          : "Caso registrado — nenhum conteúdo removível encontrado.",
      );
      onClose();
    },
    onError: e => toast.error(e.message),
  });

  const ai = parseAiAssessment(detail.data?.aiAssessment);

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#24262c] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            Revisar caso #NX-{caseId}
          </DialogTitle>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="flex justify-center py-8">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#7383FF]" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Contexto interno */}
            {detail.data?.internalContext && (
              <section className="rounded-lg border border-amber-400/15 bg-amber-400/[0.07] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80">
                  Contexto interno
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-100/90">
                  {detail.data.internalContext}
                </p>
              </section>
            )}

            {/* Avaliação da IA */}
            {ai && (
              <section className="rounded-lg border border-[#5865F2]/20 bg-[#5865F2]/[0.07] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#b7beff]">
                  <Bot className="h-3.5 w-3.5" /> Avaliação da IA
                </p>
                <p className="mt-1 text-xs text-[#c8cdd5]">
                  Resultado:{" "}
                  <span className={ai.safe ? "font-bold text-emerald-300" : "font-bold text-red-300"}>
                    {ai.safe ? "Seguro" : "Inseguro"}
                  </span>
                  {typeof ai.confidence === "number" &&
                    ` · confiança ${(ai.confidence * 100).toFixed(0)}%`}
                </p>
                {Array.isArray(ai.categories) && ai.categories.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ai.categories.map(cat => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="border-white/10 bg-white/[0.05] text-[10px] font-semibold text-[#bdc2ca]"
                      >
                        {CASE_CATEGORY_LABELS[String(cat)] ?? String(cat)}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Denúncias relacionadas */}
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8e959f]">
                Denúncias relacionadas ({detail.data?.reports.length ?? 0})
              </p>
              {(detail.data?.reports.length ?? 0) === 0 ? (
                <p className="mt-1.5 rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-[#7f8792]">
                  Nenhuma denúncia manual — caso originado por detecção automática.
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {detail.data!.reports.map(report => (
                    <li
                      key={report.id}
                      className="rounded-lg border border-white/[0.07] bg-[#1a1c21] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                        <span className="font-bold text-[#c8cdd5]">
                          Denúncia #{report.id} · Usuário #{report.reporterId}
                        </span>
                        <span className="text-[#737b86]">{timeAgo(report.createdAt)}</span>
                        <span className="ml-auto rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9ca3ad]">
                          {report.status}
                        </span>
                      </div>
                      {report.description && (
                        <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-[#969da7]">
                          “{report.description}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <ReviewActions
              busy={review.isPending || removeContent.isPending}
              onSubmit={vars => review.mutate({ caseId, ...vars })}
              onRemoveContent={() => removeContent.mutate({ caseId })}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewActions({
  busy,
  onSubmit,
  onRemoveContent,
}: {
  busy: boolean;
  onSubmit: (vars: { decision: "confirm" | "false_positive" | "warn" | "suspend" | "ban" | "close_no_action"; note?: string; days?: number }) => void;
  onRemoveContent: () => void;
}) {
  const [note, setNote] = useState("");
  const [banOpen, setBanOpen] = useState(false);

  const trimmedNote = note.trim() || undefined;

  return (
    <div className="space-y-3 border-t border-white/[0.06] pt-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
          Nota interna (opcional)
        </Label>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Registrada na auditoria junto à decisão…"
          className="resize-none border-white/[0.08] bg-[#17191e] text-xs text-white placeholder:text-[#68707b]"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onSubmit({ decision: "confirm", note: trimmedNote })}
          className="bg-red-500/90 text-xs font-bold hover:bg-red-600"
        >
          Confirmar violação
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onSubmit({ decision: "false_positive", note: trimmedNote })}
          className="text-xs text-emerald-300 hover:bg-emerald-400/10"
        >
          Falso positivo
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onRemoveContent}
          className="border-white/10 text-xs text-[#bdc2ca] hover:bg-white/[0.05] hover:text-white"
        >
          Remover conteúdo
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onSubmit({ decision: "warn", note: trimmedNote })}
          className="border-amber-400/25 bg-transparent text-xs text-amber-300 hover:bg-amber-400/10"
        >
          Advertir
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onSubmit({ decision: "suspend", days: 3, note: trimmedNote })}
          className="border-orange-500/30 bg-transparent text-xs text-orange-300 hover:bg-orange-500/10"
        >
          Suspender 3 dias
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => setBanOpen(true)}
          className="bg-[#ed4245] text-xs font-bold hover:bg-[#d6393c]"
        >
          Banir
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onSubmit({ decision: "close_no_action", note: trimmedNote })}
          className="text-xs text-[#9da4ae] hover:bg-white/[0.05] hover:text-white"
        >
          Encerrar sem ação
        </Button>
      </div>

      <AlertDialog open={banOpen} onOpenChange={setBanOpen}>
        <AlertDialogContent className="border-white/10 bg-[#24262c] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">
              Confirmar banimento permanente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-5 text-[#969da7]">
              Esta ação é irreversível: a conta será permanentemente banida da plataforma e o
              caso será encerrado como confirmado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-xs text-[#9da4ae] hover:bg-white/[0.05] hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => onSubmit({ decision: "ban", note: trimmedNote })}
              className="bg-[#ed4245] text-xs font-bold text-white hover:bg-[#d6393c]"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Banir conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
