import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  CalendarDays,
  Check,
  MessageCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ServerDiscoveryDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PartnerBadge } from "@/components/server/PartnerBadge";

function formatCount(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value);
}

export function CommunityDetailsDialog({
  server,
  open,
  onOpenChange,
  onJoined,
}: {
  server: ServerDiscoveryDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined?: () => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [acceptedRules, setAcceptedRules] = useState(false);
  const join = trpc.server.joinDiscoverable.useMutation({
    onSuccess: async ({ serverId }) => {
      await Promise.all([
        utils.server.list.invalidate(),
        utils.server.discover.invalidate(),
      ]);
      toast.success("Você entrou na comunidade.");
      onOpenChange(false);
      onJoined?.();
      navigate(`/channels/${serverId}/first`);
    },
    onError: error => toast.error(error.message),
  });

  if (!server) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-0">
        <div className="relative h-44 overflow-hidden bg-sidebar sm:h-52">
          {server.bannerUrl ? (
            <img
              src={server.bannerUrl}
              alt={`Banner de ${server.name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/35 via-sidebar to-card" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/10" />
          <div className="absolute bottom-5 left-5 flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-sidebar text-xl font-bold shadow-xl">
            {server.iconUrl ? (
              <img
                src={server.iconUrl}
                alt={`Ícone de ${server.name}`}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              server.name.slice(0, 2).toUpperCase()
            )}
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-2xl tracking-[-0.04em]">
                {server.name}
              </DialogTitle>
              {server.partnered && <PartnerBadge className="size-5" />}
            </div>
            <DialogDescription>
              {server.description ||
                "Uma comunidade para conversar e compartilhar interesses."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {server.category && (
              <span className="rounded-full bg-primary/10 px-3 py-1.5 font-semibold text-primary">
                {server.category.name}
              </span>
            )}
            {server.tags.map(tag => (
              <span key={tag} className="rounded-full bg-accent px-3 py-1.5">
                {tag}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-muted/60 p-3">
              <Users size={16} className="text-primary" aria-hidden />
              <p className="mt-2 text-lg font-bold tabular-nums">
                {formatCount(server.memberCount)}
              </p>
              <p className="text-[11px] text-muted-foreground">membros</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <MessageCircle size={16} className="text-primary" aria-hidden />
              <p className="mt-2 text-lg font-bold tabular-nums">
                {formatCount(server.messageCount)}
              </p>
              <p className="text-[11px] text-muted-foreground">mensagens</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <Activity size={16} className="text-primary" aria-hidden />
              <p className="mt-2 text-lg font-bold tabular-nums">
                {formatCount(server.activeMemberCount7d)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                ativos em 7 dias
              </p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <CalendarDays size={16} className="text-primary" aria-hidden />
              <p className="mt-2 text-sm font-bold">
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "short",
                  year: "numeric",
                }).format(new Date(server.createdAt))}
              </p>
              <p className="text-[11px] text-muted-foreground">criada</p>
            </div>
          </div>

          {server.rulesEnabled && server.rules.length > 0 && (
            <section className="rounded-xl border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Regras da comunidade</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-5 text-muted-foreground">
                {server.rules.map(rule => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
              {!server.isMember && (
                <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={acceptedRules}
                    onChange={event => setAcceptedRules(event.target.checked)}
                    className="mt-1 size-4 accent-[#5865F2]"
                  />
                  <span>Li e aceito seguir estas regras.</span>
                </label>
              )}
            </section>
          )}

          {server.isMember ? (
            <Button
              className="w-full"
              onClick={() => navigate(`/channels/${server.id}/first`)}
            >
              Abrir servidor
            </Button>
          ) : server.canJoin ? (
            <Button
              className="w-full"
              disabled={
                join.isPending || (server.requiresRules && !acceptedRules)
              }
              onClick={() =>
                join.mutate({ serverId: server.id, acceptedRules })
              }
            >
              {join.isPending ? "Entrando..." : "Entrar no servidor"}
            </Button>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              A entrada direta nesta comunidade está pausada. Use um convite
              para entrar.
            </div>
          )}

          {server.partnered && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Check size={13} className="text-emerald-500" aria-hidden />
              Esta comunidade faz parte do programa de parceiros da Nexora.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
