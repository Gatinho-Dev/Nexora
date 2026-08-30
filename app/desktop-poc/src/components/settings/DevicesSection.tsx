import { format, isToday } from "date-fns";
import { HelpCircle, Monitor, Smartphone, Tablet } from "lucide-react";
import type { AccountSessionDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Configurações → Minha Conta → Dispositivos conectados
 *
 * Observação: o backend ainda não retorna `currentSessionId` na lista
 * (AccountSessionDTO), portanto nenhuma sessão recebe badge de
 * "sessão atual" — apenas a lista, encerramento individual e em massa.
 */

const DEVICE_ICONS: Record<AccountSessionDTO["deviceType"], typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: HelpCircle,
};

function formatLastSeen(value: string | Date): string {
  const date = new Date(value);
  if (Date.now() - date.getTime() < 60_000) return "Agora";
  if (isToday(date)) return `Hoje às ${format(date, "HH:mm")}`;
  return format(date, "dd/MM/yyyy HH:mm");
}

function SessionCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-sidebar p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg bg-white/[0.06]" />
      <div className="flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-44 bg-white/[0.06]" />
        <Skeleton className="h-3 w-28 bg-white/[0.06]" />
        <Skeleton className="h-3 w-36 bg-white/[0.06]" />
      </div>
    </div>
  );
}

export function DevicesSection() {
  const utils = trpc.useUtils();
  const sessions = trpc.account.sessionsList.useQuery();

  const revoke = trpc.account.sessionRevoke.useMutation({
    onSuccess: () => {
      toast.success("Sessão encerrada.");
      void utils.account.sessionsList.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const revokeOthers = trpc.account.sessionRevokeOthers.useMutation({
    onSuccess: result => {
      toast.success(`${result.revoked} sessões encerradas.`);
      void utils.account.sessionsList.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  if (sessions.isLoading) {
    return (
      <div className="max-w-2xl space-y-5">
        <SessionCardSkeleton />
        <SessionCardSkeleton />
        <SessionCardSkeleton />
      </div>
    );
  }

  const list = sessions.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Dispositivos conectados</h2>
        <p className="text-xs text-muted2 mt-1">
          Veja onde sua conta Nexora está conectada.
        </p>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl bg-sidebar border border-white/10 p-6 text-center text-xs text-muted2">
          Nenhuma outra sessão ativa.
        </p>
      ) : (
        <div className="grid max-w-2xl grid-cols-1 gap-3">
          {list.map(session => {
            const Icon =
              DEVICE_ICONS[session.deviceType as AccountSessionDTO["deviceType"]] ??
              HelpCircle;
            return (
              <div
                key={session.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-sidebar p-4 transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-muted2">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 truncate text-sm font-bold text-white">
                    {session.friendlyName}
                    {session.isCurrent && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                        Este dispositivo
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted2">
                    IP: {session.ipAddress ?? "Não disponível"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    Última atividade: {formatLastSeen(session.lastSeenAt)}
                  </p>

                  {!session.isCurrent && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revoke.isPending}
                          className="mt-2 h-8 px-3 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          Encerrar sessão
                        </Button>
                      </AlertDialogTrigger>
                    <AlertDialogContent className="bg-panel border-white/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">
                          Deseja desconectar este dispositivo?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted2">
                          {session.friendlyName} ({session.ipAddress ?? "IP não disponível"}){" "}
                          será desconectado da Nexora imediatamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-transparent text-muted2 hover:bg-white/5 hover:text-white">
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={revoke.isPending}
                          onClick={() => revoke.mutate({ sessionId: session.id })}
                          className="bg-red-500 text-white hover:bg-red-600"
                        >
                          Encerrar sessão
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {list.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={revokeOthers.isPending}
              className="max-w-2xl border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              Encerrar todas as outras sessões
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-panel border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                Encerrar todas as outras sessões?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted2">
                Todos os outros dispositivos serão desconectados. Sua sessão
                atual continuará conectada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-muted2 hover:bg-white/5 hover:text-white">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={revokeOthers.isPending}
                onClick={() => revokeOthers.mutate()}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                Encerrar todas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
