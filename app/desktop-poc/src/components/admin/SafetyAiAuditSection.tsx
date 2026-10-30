import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  EyeOff,
  LoaderCircle,
  Power,
  ShieldCheck,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { translateAuditEvent, timeAgo } from "./safetyShared";

type AiStatus = {
  provider?: string;
  model?: string;
  visionModel?: string;
  policyVersion?: string;
  requestsTotal?: number;
  flaggedTotal?: number;
  rateLimited?: number;
  timeouts?: number;
  errorsTotal?: number;
  cacheHitRate?: number;
  averageLatencyMs?: number;
  queueDepth?: number;
};

/** Normaliza a resposta: o router expõe `{ metrics, breakerOpen, killSwitch, shadowMode }`. */
function normalizeAiStatus(data: {
  metrics: Record<string, unknown>;
  breakerOpen: boolean;
  killSwitch: boolean;
  shadowMode: boolean;
}): AiStatus & { breakerOpen: boolean; killSwitch: boolean; shadowMode: boolean } {
  const m = (data.metrics ?? {}) as Record<string, unknown>;
  const pick = (key: string) => (m[key] ?? (data as Record<string, unknown>)[key]);
  return {
    provider: pick("provider") as string | undefined,
    model: pick("model") as string | undefined,
    visionModel: pick("visionModel") as string | undefined,
    policyVersion: pick("policyVersion") as string | undefined,
    requestsTotal: pick("requestsTotal") as number | undefined,
    flaggedTotal: pick("flaggedTotal") as number | undefined,
    rateLimited: pick("rateLimited") as number | undefined,
    timeouts: pick("timeouts") as number | undefined,
    errorsTotal: pick("errorsTotal") as number | undefined,
    cacheHitRate: pick("cacheHitRate") as number | undefined,
    averageLatencyMs: pick("averageLatencyMs") as number | undefined,
    queueDepth: pick("queueDepth") as number | undefined,
    breakerOpen: data.breakerOpen,
    killSwitch: data.killSwitch,
    shadowMode: data.shadowMode,
  };
}

export function SafetyAiAuditSection() {
  const utils = trpc.useUtils();
  const [killSwitchDialogOpen, setKillSwitchDialogOpen] = useState(false);
  const status = trpc.admin.safetyAiStatus.useQuery();
  const audit = trpc.admin.safetyAuditEvents.useQuery({ limit: 50 });

  const s = status.data ? normalizeAiStatus(status.data) : null;

  const setKillSwitch = trpc.admin.setSafetyKillSwitch.useMutation({
    onSuccess: (_data, vars) => {
      utils.admin.safetyAiStatus.invalidate();
      utils.admin.safetyAuditEvents.invalidate();
      toast.success(vars.killed ? "Kill switch LIGADO — IA de segurança pausada." : "Kill switch DESLIGADO — IA ativa.");
      setKillSwitchDialogOpen(false);
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {/* Painel Segurança por IA */}
      <section className="rounded-xl border border-white/[0.075] bg-[#22252b]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-white">
              <Bot className="h-4 w-4 text-[#8e9aff]" />
              Segurança por IA
            </h2>
            <p className="mt-0.5 text-[11px] text-[#8e959f]">
              Provedor, política e saúde da moderação automática.
            </p>
          </div>
          <Button
            size="sm"
            variant={s?.killSwitch ? "default" : "outline"}
            disabled={setKillSwitch.isPending}
            onClick={() => setKillSwitchDialogOpen(true)}
            className={
              s?.killSwitch
                ? "bg-emerald-500/90 text-xs font-bold hover:bg-emerald-600"
                : "border-red-500/30 bg-transparent text-xs font-bold text-[#ff8c8f] hover:bg-red-500/10"
            }
          >
            <Power className="h-3.5 w-3.5" />
            {s?.killSwitch ? "Ligar IA" : "Kill switch"}
          </Button>
        </div>

        {status.isLoading || !s ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#7383FF]" />
          </div>
        ) : (
          <div className="p-4">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <InfoCell label="Provedor" value={s.provider ?? "—"} />
              <InfoCell label="Modelo (texto)" value={s.model ?? "—"} mono />
              <InfoCell label="Modelo (visão)" value={s.visionModel ?? "—"} mono />
              <InfoCell label="Política" value={s.policyVersion ?? "—"} mono />
              <InfoCell label="Latência média" value={`${s.averageLatencyMs ?? 0} ms`} />
              <InfoCell label="Fila" value={String(s.queueDepth ?? 0)} />
            </dl>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={
                  s.breakerOpen
                    ? "border-orange-500/30 bg-orange-500/15 text-orange-300"
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                }
              >
                {s.breakerOpen ? (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Degradado (circuit breaker)
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3 w-3" /> Operacional
                  </>
                )}
              </Badge>
              {s.shadowMode && (
                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/15 text-blue-300">
                  <EyeOff className="h-3 w-3" /> Shadow mode
                </Badge>
              )}
              {s.killSwitch && (
                <Badge variant="destructive" className="bg-[#ed4245] text-white">
                  Kill switch ativo
                </Badge>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCell label="Requisições" value={s.requestsTotal ?? 0} />
              <MetricCell label="Sinalizados" value={s.flaggedTotal ?? 0} accent />
              <MetricCell label="429 (rate limit)" value={s.rateLimited ?? 0} />
              <MetricCell label="Timeouts" value={s.timeouts ?? 0} />
              <MetricCell label="Erros" value={s.errorsTotal ?? 0} />
              <MetricCell label="Cache hit rate" value={`${Math.round((s.cacheHitRate ?? 0) * 100)}%`} />
            </dl>
          </div>
        )}
      </section>

      {/* Auditoria */}
      <section className="rounded-xl border border-white/[0.075] bg-[#22252b]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-sm font-bold text-white">Auditoria de segurança</h2>
          <p className="mt-0.5 text-[11px] text-[#8e959f]">
            Últimos 50 eventos registrados pelo sistema.
          </p>
        </div>
        {audit.isLoading ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#7383FF]" />
          </div>
        ) : (audit.data?.length ?? 0) === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-[#858c96]">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wide text-[#7f8792]">Evento</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wide text-[#7f8792]">Data</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wide text-[#7f8792]">Alvo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.data!.map(ev => (
                  <TableRow key={ev.id} className="border-white/[0.05] hover:bg-white/[0.02]">
                    <TableCell className="py-2.5 text-xs font-semibold text-[#c8cdd5]">
                      {translateAuditEvent(String(ev.event))}
                      {(ev.caseId != null || ev.violationId != null) && (
                        <span className="ml-1.5 text-[10px] font-normal text-[#737b86]">
                          {ev.caseId != null ? `· caso #${ev.caseId}` : ""}
                          {ev.violationId != null ? ` · ocorrência #${ev.violationId}` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] whitespace-nowrap text-[#969da7]">
                      {timeAgo(ev.createdAt)}
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] text-[#969da7]">
                      {ev.targetUserId != null
                        ? `Usuário #${ev.targetUserId}`
                        : ev.actorUserId != null
                          ? `Autor #${ev.actorUserId}`
                          : "Sistema"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Confirmar kill switch */}
      <AlertDialog open={killSwitchDialogOpen} onOpenChange={setKillSwitchDialogOpen}>
        <AlertDialogContent className="border-white/10 bg-[#24262c] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">
              {s?.killSwitch ? "Reativar IA de segurança?" : "Ativar kill switch?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-5 text-[#969da7]">
              {s?.killSwitch
                ? "A moderação automática voltará a analisar conteúdo e aplicar ações."
                : "Todas as análises e ações automáticas da IA serão pausadas imediatamente até que seja reativada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-xs text-[#9da4ae] hover:bg-white/[0.05] hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={setKillSwitch.isPending}
              onClick={() => setKillSwitch.mutate({ killed: !s?.killSwitch })}
              className={
                s?.killSwitch
                  ? "bg-emerald-500/90 text-xs font-bold text-white hover:bg-emerald-600"
                  : "bg-[#ed4245] text-xs font-bold text-white hover:bg-[#d6393c]"
              }
            >
              {setKillSwitch.isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              {s?.killSwitch ? "Reativar" : "Ativar kill switch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
      <dt className="text-[10px] text-[#858c96]">{label}</dt>
      <dd className={`truncate text-xs font-bold text-white ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function MetricCell({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#1a1c21] px-3 py-2">
      <dt className="text-[10px] text-[#858c96]">{label}</dt>
      <dd className={`text-sm font-bold ${accent ? "text-amber-300" : "text-white"}`}>
        {value}
      </dd>
    </div>
  );
}
