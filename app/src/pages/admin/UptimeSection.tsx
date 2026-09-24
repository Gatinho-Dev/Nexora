import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  ExternalLink,
  Gauge,
  MonitorCheck,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string; chip: string; icon: typeof Activity }
> = {
  up: {
    label: "Operacional",
    dot: "bg-[#23a55a]",
    text: "text-[#43b581]",
    chip: "border-[#23a55a]/25 bg-[#23a55a]/10",
    icon: MonitorCheck,
  },
  down: {
    label: "Fora do ar",
    dot: "bg-[#f23f43]",
    text: "text-[#f97073]",
    chip: "border-[#f23f43]/25 bg-[#f23f43]/10",
    icon: ShieldAlert,
  },
  seems_down: {
    label: "Instável",
    dot: "bg-[#f0b232]",
    text: "text-[#f5c452]",
    chip: "border-[#f0b232]/25 bg-[#f0b232]/10",
    icon: ShieldAlert,
  },
  paused: {
    label: "Pausado",
    dot: "bg-[#80848e]",
    text: "text-[#aeb4be]",
    chip: "border-white/[0.075] bg-white/[0.045]",
    icon: PauseCircle,
  },
  not_checked_yet: {
    label: "Aguardando checagem",
    dot: "bg-[#80848e]",
    text: "text-[#aeb4be]",
    chip: "border-white/[0.075] bg-white/[0.045]",
    icon: Clock,
  },
};

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_checked_yet;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold",
        meta.chip,
        meta.text,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function overallMeta(overall: string) {
  switch (overall) {
    case "operational":
      return STATUS_META.up;
    case "down":
      return STATUS_META.down;
    case "degraded":
      return STATUS_META.seems_down;
    case "paused":
      return STATUS_META.paused;
    default:
      return STATUS_META.not_checked_yet;
  }
}

function formatFetchedAt(ts: number) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

/**
 * Administração → Monitoramento
 * Snapshot dos monitores do Nexora (UptimeRobot), somente leitura.
 * A chave da API vive apenas no servidor; esta tela fala com o tRPC.
 */
export function UptimeSection() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const snapshot = trpc.uptime.snapshot.useQuery(undefined, {
    refetchInterval: 120_000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [["uptime", "snapshot"]] });
      await snapshot.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (snapshot.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-white/[0.055] bg-[#191b20]">
        <Activity className="h-4 w-4 animate-pulse text-[#5865F2]" />
        <span className="ml-2 text-xs text-[#8f96a1]">Carregando monitores...</span>
      </div>
    );
  }

  if (snapshot.isError) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[#f23f43]/25 bg-[#f23f43]/[0.06] p-6 text-center">
        <ShieldAlert className="h-5 w-5 text-[#f97073]" />
        <p className="mt-2 text-xs font-semibold text-[#f4f5f7]">
          Não foi possível carregar o status de uptime.
        </p>
        <p className="mt-1 text-[10px] text-[#969da7]">
          Verifique a chave UPTIMEROBOT_API_KEY no servidor e tente novamente.
        </p>
      </div>
    );
  }

  const data = snapshot.data;
  if (!data?.configured) {
    return (
      <div className="flex h-auto flex-col items-center justify-center rounded-xl border border-white/[0.075] bg-[#191b20] p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5865F2]/15 text-[#8e9aff]">
          <Gauge className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-sm font-bold text-[#f4f5f7]">
          Monitoramento de uptime não configurado
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-5 text-[#969da7]">
          Adicione a variável <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-[#b7beff]">UPTIMEROBOT_API_KEY</code> no
          ambiente do servidor (aba Keys/Environment) e aponte um monitor HTTP(s)
          do UptimeRobot para <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-[#b7beff]">/api/health</code>.
        </p>
      </div>
    );
  }

  const overall = overallMeta(data.overall);
  const OverallIcon = overall.icon;

  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-xl border p-5",
          overall.chip,
        )}
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20",
          )}
        >
          <OverallIcon className={cn("h-5 w-5", overall.text)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-bold", overall.text)}>{overall.label}</p>
          <p className="mt-0.5 text-[11px] text-[#969da7]">
            {data.counts.up}/{data.counts.total} monitores operacionais · atualizado às{" "}
            {formatFetchedAt(data.fetchedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 rounded-lg border border-white/[0.06] bg-[#191b20] px-3 py-2 sm:flex">
            <span className="text-center">
              <span className="block text-[9px] font-extrabold uppercase tracking-wider text-[#69717c]">OK</span>
              <span className="block text-xs font-bold text-[#43b581]">{data.counts.up}</span>
            </span>
            <span className="h-6 w-px bg-white/[0.075]" />
            <span className="text-center">
              <span className="block text-[9px] font-extrabold uppercase tracking-wider text-[#69717c]">Fora</span>
              <span className="block text-xs font-bold text-[#f97073]">{data.counts.down}</span>
            </span>
            <span className="h-6 w-px bg-white/[0.075]" />
            <span className="text-center">
              <span className="block text-[9px] font-extrabold uppercase tracking-wider text-[#69717c]">Instável</span>
              <span className="block text-xs font-bold text-[#f5c452]">{data.counts.seemsDown}</span>
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={refreshing || snapshot.isFetching}
            className="text-[11px] text-[#9da4ae] hover:bg-white/[0.05] hover:text-white"
            aria-label="Atualizar status dos monitores"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (refreshing || snapshot.isFetching) && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Lista de monitores */}
      {data.monitors.length === 0 ? (
        <div className="rounded-xl border border-white/[0.055] bg-[#191b20] p-6 text-center text-xs text-[#8f96a1]">
          Nenhum monitor configurado na conta do UptimeRobot.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {data.monitors.map(monitor => (
            <li
              key={monitor.id}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.055] bg-[#191b20] p-4 transition-colors hover:border-white/[0.09]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#f4f5f7]">
                    {monitor.friendlyName}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-[#69717c]">
                    {monitor.typeLabel}
                    {monitor.url ? (
                      <a
                        href={monitor.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="ml-1 inline-flex items-center gap-0.5 text-[#8e9aff] hover:underline"
                      >
                        {monitor.url.replace(/^https?:\/\//, "").slice(0, 40)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : null}
                  </p>
                </div>
                <StatusChip status={monitor.status} />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#8f96a1]">
                {monitor.uptimeRatio !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3 w-3 text-[#69717c]" />
                    Uptime (7d): <strong className="text-[#c4c9d0]">{monitor.uptimeRatio}%</strong>
                  </span>
                )}
                {monitor.averageResponseTime !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#69717c]" />
                    Resposta média: <strong className="text-[#c4c9d0]">{monitor.averageResponseTime} ms</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 text-[#69717c]" />
                  A cada {Math.round(monitor.interval / 60)} min
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-[10px] text-[#5d6470]">
        Dados fornecidos pela API do UptimeRobot · cache de 60 s para respeitar os limites da API.
      </p>
    </div>
  );
}
