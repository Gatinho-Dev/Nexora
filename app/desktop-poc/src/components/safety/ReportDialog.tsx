import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  MINOR_SAFETY_SUBCATEGORY_LABELS,
  REPORT_CATEGORY_LABELS as CATEGORY_LABELS,
  REPORT_TARGET_TYPE_LABELS as TARGET_TYPE_LABELS,
  type ReportTarget,
} from "./reportMeta";

type Step = "reason" | "subcategory" | "comment" | "done";

function OptionRow({
  selected,
  onSelect,
  value,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  value: string;
  label: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors select-none",
        selected
          ? "border-[#5865F2]/70 bg-[#5865F2]/10 text-white font-medium"
          : "border-white/10 bg-white/[0.03] text-bodyx hover:bg-white/[0.06]"
      )}
    >
      <RadioGroupItem
        value={value}
        tabIndex={-1}
        className="pointer-events-none border-white/40 text-[#5865F2]"
      />
      <span className="min-w-0">{label}</span>
    </div>
  );
}

export function ReportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ReportTarget;
}) {
  const { user: me } = useAuth();
  const [step, setStep] = useState<Step>("reason");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");

  const categories = trpc.safety.reportCategories.useQuery(undefined, {
    enabled: open,
  });

  const isSelfTarget = target.type === "user" && !!me && target.id === me.id;

  const createReport = trpc.safety.createReport.useMutation({
    onSuccess: data => {
      setStep("done");
      toast.success(data.message);
    },
    onError: e => toast.error(e.message),
  });

  const resetForm = () => {
    setStep("reason");
    setCategory("");
    setSubcategory("");
    setDescription("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && !createReport.isPending) resetForm();
    onOpenChange(v);
  };

  const needsSubcategory = category === "minor_safety";

  const canContinue = useMemo(() => {
    if (step === "reason") return category !== "";
    if (step === "subcategory") return subcategory !== "";
    return false;
  }, [step, category, subcategory]);

  const submit = () => {
    createReport.mutate({
      targetType: target.type,
      targetId: target.id,
      category: category as never,
      ...(needsSubcategory && subcategory
        ? { subcategory }
        : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  };

  const targetTitle = target.label
    ? `${TARGET_TYPE_LABELS[target.type]} · ${target.label}`
    : TARGET_TYPE_LABELS[target.type];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-[50%] max-h-[88dvh] w-full max-w-none translate-x-[-50%] translate-y-0 gap-0 overflow-y-auto rounded-t-2xl rounded-b-none border-white/10 bg-sidebar p-0 pb-[env(safe-area-inset-bottom)] text-white shadow-2xl duration-200 data-[state=open]:slide-in-from-bottom-8 sm:top-[50%] sm:max-h-[92dvh] sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" />

        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 px-6 pb-7 pt-6 text-center sm:px-8">
            <span className="text-4xl" aria-hidden>
              ✅
            </span>
            <DialogTitle className="text-base">Denúncia enviada</DialogTitle>
            <DialogDescription className="max-w-xs text-sm leading-relaxed text-muted2">
              Obrigado por ajudar a manter o Nexora seguro. Nossa equipe
              analisará a situação.
            </DialogDescription>
            <Button
              onClick={() => handleOpenChange(false)}
              className="mt-2 h-10 w-full rounded-lg bg-[#5865F2] text-sm font-semibold text-white hover:bg-[#4752C4]"
            >
              Fechar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="gap-1 px-5 pt-5 text-left sm:px-6">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Flag className="h-4 w-4 text-red-400" aria-hidden />
                Denunciar {TARGET_TYPE_LABELS[target.type]}
              </DialogTitle>
              <DialogDescription className="truncate text-xs text-muted2">
                Alvo: {targetTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
              {categories.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando…
                </div>
              ) : categories.isError ? (
                <p className="py-4 text-center text-sm text-red-400">
                  Não foi possível carregar os motivos. Tente novamente.
                </p>
              ) : step === "reason" ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-faint">
                    Qual é o motivo da denúncia?
                  </p>
                  <RadioGroup
                    value={category}
                    onValueChange={setCategory}
                    className="gap-2"
                  >
                    {(categories.data?.categories ?? []).map(c => (
                      <OptionRow
                        key={c}
                        value={c}
                        label={CATEGORY_LABELS[c] ?? c}
                        selected={category === c}
                        onSelect={() => setCategory(c)}
                      />
                    ))}
                  </RadioGroup>
                </div>
              ) : step === "subcategory" ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-faint">
                    Detalhe o que aconteceu
                  </p>
                  <RadioGroup
                    value={subcategory}
                    onValueChange={setSubcategory}
                    className="gap-2"
                  >
                    {(categories.data?.minorSafetySubcategories ?? []).map(s => (
                      <OptionRow
                        key={s}
                        value={s}
                        label={
                          MINOR_SAFETY_SUBCATEGORY_LABELS[s] ?? s
                        }
                        selected={subcategory === s}
                        onSelect={() => setSubcategory(s)}
                      />
                    ))}
                  </RadioGroup>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="report-comment" className="text-xs font-bold uppercase tracking-wider text-faint">
                    Comentário adicional (opcional)
                  </Label>
                  <Textarea
                    id="report-comment"
                    value={description}
                    onChange={e =>
                      setDescription(e.target.value.slice(0, 1000))
                    }
                    placeholder="Descreva o que aconteceu. Quanto mais contexto, mais rápido nossa equipe consegue agir."
                    maxLength={1000}
                    rows={5}
                    className="resize-none border-white/10 bg-panel text-sm text-white placeholder:text-faint focus-visible:border-[#5865F2]"
                  />
                  <p className="text-right text-[11px] text-muted2">
                    {description.length}/1000
                  </p>
                </div>
              )}

              {isSelfTarget && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                  Você não pode denunciar sua própria conta.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] bg-sidebar px-5 py-3.5 sm:px-6">
              {step === "reason" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-9 rounded-lg px-4 text-sm text-muted2 hover:bg-white/5 hover:text-white"
                >
                  Cancelar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setStep(step === "comment" && needsSubcategory ? "subcategory" : "reason")
                  }
                  className="h-9 rounded-lg px-4 text-sm text-muted2 hover:bg-white/5 hover:text-white"
                >
                  Voltar
                </Button>
              )}
              {step === "comment" ? (
                <Button
                  size="sm"
                  disabled={createReport.isPending || isSelfTarget}
                  onClick={submit}
                  className="h-9 rounded-lg bg-[#5865F2] px-5 text-sm font-semibold text-white hover:bg-[#4752C4] disabled:opacity-50"
                >
                  {createReport.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Enviar"
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!canContinue || isSelfTarget}
                  onClick={() =>
                    setStep(needsSubcategory && step === "reason" ? "subcategory" : "comment")
                  }
                  className="h-9 rounded-lg bg-[#5865F2] px-5 text-sm font-semibold text-white hover:bg-[#4752C4] disabled:opacity-50"
                >
                  Continuar
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
