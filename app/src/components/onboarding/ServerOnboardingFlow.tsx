import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import type { ServerDetailsDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ServerOnboardingFlow({ details }: { details: ServerDetailsDTO }) {
  const serverId = details.server.id;
  const onboarding = trpc.advanced.server.onboarding.useQuery({ serverId });
  const me = trpc.auth.me.useQuery().data;
  const utils = trpc.useUtils();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [completed, setCompleted] = useState(false);
  const [recommendedChannelIds, setRecommendedChannelIds] = useState<number[]>([]);
  const questions = useMemo(() => onboarding.data?.questions ?? [], [onboarding.data?.questions]);
  const requireRules = onboarding.data?.config?.requireRules ?? false;
  const totalSteps = 2 + (requireRules ? 1 : 0);
  const questionStep = requireRules ? 2 : 1;
  const isManager = details.server.ownerId === me?.id || details.myPermissions.includes("MANAGE_SERVER") || details.myPermissions.includes("ADMINISTRATOR");

  const complete = trpc.advanced.server.completeOnboarding.useMutation({
    onSuccess: result => {
      setRecommendedChannelIds(result.recommendedChannelIds);
      setCompleted(true);
      void Promise.all([utils.advanced.server.onboarding.invalidate({ serverId }), utils.server.get.invalidate({ serverId })]);
      toast.success("Boas-vindas à comunidade!");
    },
    onError: error => toast.error(error.message),
  });
  const currentQuestionMissing = useMemo(() => questions.some(question => question.required && (answers[String(question.id)]?.length ?? 0) === 0), [answers, questions]);
  const visible = Boolean(onboarding.isFetched && onboarding.data?.config?.enabled && !onboarding.data.answers && !isManager);
  if (!visible) return null;

  const toggleOption = (questionId: number, optionId: string, multiple: boolean) => {
    setAnswers(current => {
      const key = String(questionId);
      const selected = current[key] ?? [];
      const next = selected.includes(optionId) ? selected.filter(id => id !== optionId) : multiple ? [...selected, optionId] : [optionId];
      return { ...current, [key]: next };
    });
  };

  return <Dialog open onOpenChange={() => undefined}><DialogContent showCloseButton={false} className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-chat p-0 text-white sm:h-[min(760px,94dvh)] sm:w-[min(760px,calc(100vw-1rem))] sm:rounded-2xl sm:border-white/10">
    <div className="h-1.5 bg-white/5"><div className="h-full bg-[#5865f2] transition-[width] duration-200" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {step === 0 && <section className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">{onboarding.data?.config?.coverImageUrl && <img src={onboarding.data.config.coverImageUrl} alt="" className="absolute inset-0 h-56 w-full object-cover opacity-35 [mask-image:linear-gradient(to_bottom,black,transparent)]" />}<div className="relative grid size-20 place-items-center rounded-[28px] bg-[#5865f2]/20 text-[#9ca6ff]"><Sparkles className="size-9" /></div><DialogHeader className="relative mt-6 items-center"><DialogTitle className="max-w-xl text-2xl sm:text-3xl">{onboarding.data?.config?.welcomeTitle || `Boas-vindas a ${details.server.name}`}</DialogTitle><DialogDescription className="mt-3 max-w-xl text-sm leading-6 text-muted2">{onboarding.data?.config?.welcomeMessage || "Vamos preparar sua experiência nesta comunidade."}</DialogDescription></DialogHeader></section>}
      {requireRules && step === 1 && <section className="mx-auto max-w-2xl px-5 py-8 sm:px-8"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="size-6" /></span><h2 className="mt-5 text-2xl font-bold">Regras da comunidade</h2><p className="mt-2 text-sm text-muted2">Ao continuar, você confirma que leu e concorda em seguir estas regras.</p><ol className="mt-6 space-y-3">{(details.server.rules?.length ? details.server.rules : ["Respeite os outros membros.", "Não publique spam ou conteúdo malicioso.", "Siga as orientações da moderação."]).map((rule, index) => <li key={index} className="flex gap-3 rounded-xl border border-white/[0.07] bg-sidebar p-4 text-sm leading-6"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#5865f2]/15 text-[11px] font-bold text-[#9ca6ff]">{index + 1}</span>{rule}</li>)}</ol></section>}
      {step === questionStep && !completed && <section className="mx-auto max-w-2xl px-5 py-8 sm:px-8"><h2 className="text-2xl font-bold">Personalize sua experiência</h2><p className="mt-2 text-sm text-muted2">Suas respostas ajudam a recomendar canais, interesses e cargos.</p>{questions.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted2">Tudo pronto para entrar.</div> : <div className="mt-7 space-y-7">{questions.map(question => <fieldset key={question.id}><legend className="text-sm font-bold">{question.prompt}{question.required && <span className="ml-1 text-red-300">*</span>}</legend><p className="mt-1 text-[11px] text-muted2">{question.multiple ? "Escolha uma ou mais opções" : "Escolha uma opção"}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(question.options ?? []).map(option => { const checked = answers[String(question.id)]?.includes(option.id) ?? false; return <button type="button" key={option.id} role={question.multiple ? "checkbox" : "radio"} aria-checked={checked} onClick={() => toggleOption(question.id, option.id, question.multiple)} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition-colors", checked ? "border-[#7383ff] bg-[#5865f2]/15 text-white" : "border-white/[0.07] bg-sidebar text-bodyx hover:border-white/15")}><span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", checked ? "border-[#7383ff] bg-[#5865f2]" : "border-white/15")}>{checked && <Check className="size-3 text-white" />}</span>{option.label}</button>; })}</div></fieldset>)}</div>}</section>}
      {completed && <section className="flex min-h-full flex-col items-center justify-center px-6 py-12 text-center"><span className="grid size-20 place-items-center rounded-[28px] bg-emerald-400/10 text-emerald-300"><Rocket className="size-9" /></span><h2 className="mt-6 text-3xl font-bold">Tudo pronto!</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted2">Sua experiência foi configurada e sincronizada. Você já pode explorar a comunidade.</p>{recommendedChannelIds.length > 0 && <p className="mt-4 rounded-full bg-white/5 px-4 py-2 text-xs text-bodyx">{recommendedChannelIds.length} canal{recommendedChannelIds.length === 1 ? " recomendado" : "is recomendados"}</p>}</section>}
    </div>
    <footer className="flex min-h-20 items-center justify-between gap-3 border-t border-white/[0.06] bg-sidebar px-5 pb-[env(safe-area-inset-bottom)] sm:px-8"><Button variant="ghost" className="min-h-11" disabled={step === 0 || complete.isPending || completed} onClick={() => setStep(value => Math.max(0, value - 1))}><ChevronLeft className="size-4" /> Voltar</Button>{completed ? <Button className="min-h-11" onClick={() => { setCompleted(false); void onboarding.refetch(); }}>Entrar na comunidade <ChevronRight className="size-4" /></Button> : step < questionStep ? <Button className="min-h-11" onClick={() => setStep(value => value + 1)}>Continuar <ChevronRight className="size-4" /></Button> : <Button className="min-h-11" disabled={currentQuestionMissing || complete.isPending} onClick={() => complete.mutate({ serverId, answers })}>{complete.isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Concluir</Button>}</footer>
  </DialogContent></Dialog>;
}
