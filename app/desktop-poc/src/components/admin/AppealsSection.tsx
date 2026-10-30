import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
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
import { timeAgo } from "./safetyShared";

/** Fila de apelações de ocorrências (staff). */
export function AppealsSection() {
  const utils = trpc.useUtils();
  const queue = trpc.admin.appealsQueue.useQuery();
  const [denyTarget, setDenyTarget] = useState<{ id: number; reason: string | null } | null>(null);
  const [approveTarget, setApproveTarget] = useState<{ id: number; reason: string | null } | null>(null);

  const reviewAppeal = trpc.admin.reviewAppeal.useMutation({
    onSuccess: (_data, vars) => {
      utils.admin.appealsQueue.invalidate();
      utils.admin.safetyQueue.invalidate();
      utils.admin.safetyAuditEvents.invalidate();
      toast.success(
        vars.decision === "approved"
          ? "Apelação aprovada — strike/suspensão revertidos."
          : "Apelação negada."
      );
      setApproveTarget(null);
      setDenyTarget(null);
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {queue.isLoading ? (
        <p className="py-10 text-center text-xs text-[#858c96]">Carregando apelações...</p>
      ) : (queue.data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-white/[0.055] bg-[#191b20] py-12 text-center text-xs text-[#858c96]">
          Nenhuma apelação pendente.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.data!.map(({ appeal, user }) => (
            <li
              key={appeal.id}
              className="rounded-xl border border-white/[0.06] bg-[#1c1e23] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-white">
                      Apelação #{appeal.id}
                      {" · "}
                      {user?.name ?? user?.username ?? `Usuário ${appeal.userId}`}
                    </p>
                    {user?.username && (
                      <span className="text-[11px] text-[#737b86]">@{user.username}</span>
                    )}
                    <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9ca3ad]">
                      Ocorrência #{appeal.violationId}
                    </span>
                  </div>
                  {appeal.reason && (
                    <p className="mt-1 rounded-lg border border-white/[0.06] bg-[#17191e] px-2.5 py-1.5 text-xs leading-5 text-[#c8cdd5]">
                      “{appeal.reason}”
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-[#737b86]">
                    Enviada {timeAgo(appeal.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    disabled={reviewAppeal.isPending}
                    onClick={() => setApproveTarget({ id: appeal.id, reason: appeal.reason })}
                    className="bg-emerald-500/90 text-xs font-bold hover:bg-emerald-600"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reviewAppeal.isPending}
                    onClick={() => setDenyTarget({ id: appeal.id, reason: appeal.reason })}
                    className="border-white/10 bg-transparent text-xs text-[#bdc2ca] hover:bg-white/[0.05] hover:text-white"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Negar
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confirmar aprovação */}
      <AlertDialog
        open={approveTarget !== null}
        onOpenChange={o => !o && setApproveTarget(null)}
      >
        <AlertDialogContent className="border-white/10 bg-[#24262c] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">
              Aprovar apelação #{approveTarget?.id}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-5 text-[#969da7]">
              Isso removerá strikes/suspensão desta ocorrência. A decisão é registrada na
              auditoria de segurança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-xs text-[#9da4ae] hover:bg-white/[0.05] hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={reviewAppeal.isPending}
              onClick={() =>
                approveTarget &&
                reviewAppeal.mutate({ appealId: approveTarget.id, decision: "approved" })
              }
              className="bg-emerald-500/90 text-xs font-bold text-white hover:bg-emerald-600"
            >
              {reviewAppeal.isPending ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Aprovar apelação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Negar com nota opcional */}
      <Dialog open={denyTarget !== null} onOpenChange={o => !o && setDenyTarget(null)}>
        <DialogContent className="border-white/10 bg-[#24262c] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Negar apelação #{denyTarget?.id}?
            </DialogTitle>
          </DialogHeader>
          <DenyForm
            busy={reviewAppeal.isPending}
            onSubmit={note => {
              if (!denyTarget) return;
              reviewAppeal.mutate({
                appealId: denyTarget.id,
                decision: "denied",
                note: note.trim() || undefined,
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DenyForm({ busy, onSubmit }: { busy: boolean; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
          Nota ao usuário (opcional)
        </Label>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Ex.: Mantemos a decisão — o conteúdo analisado viola as diretrizes."
          className="resize-none border-white/[0.08] bg-[#17191e] text-xs text-white placeholder:text-[#68707b]"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onSubmit("")}>
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => onSubmit(note)}
        >
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Negar apelação
        </Button>
      </div>
    </div>
  );
}
