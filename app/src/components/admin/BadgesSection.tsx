import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  LoaderCircle,
  Search,
  ShieldCheck,
  RefreshCcw,
  Wrench,
  Bug,
  Flag,
  Handshake,
  Plus,
  Trash2,
  History,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  BadgeIcon,
} from "@/components/badges/BadgeUI";
import { RARITY_COLORS, RARITY_LABELS } from "@/components/badges/badgeMeta";
import type { BadgeDTO, PublicUser } from "@contracts/types";
import { cn } from "@/lib/utils";

type AdminUserBadge = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  rarity: string;
  restricted: boolean;
  grantedAt: string | Date;
  grantSource: string;
  expiresAt: string | Date | null;
  hiddenByUser: boolean;
  manualOverride: boolean;
  automaticGrantDisabled: boolean;
  reason: string | null;
  grantedByUser: { id: number; username: string | null; name: string | null } | null;
  [key: string]: unknown;
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function BadgesSection() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AdminUserBadge | null>(null);
  const [consistencyOpen, setConsistencyOpen] = useState(false);

  const users = trpc.admin.searchUsers.useQuery(
    { query: debounced, limit: 8 },
    { enabled: debounced.trim().length >= 2 },
  );
  const catalog = trpc.admin.listBadges.useQuery();
  const userBadges = trpc.admin.listUserBadges.useQuery(
    { userId: selectedUser?.id ?? 0 },
    { enabled: !!selectedUser },
  );
  const history = trpc.admin.badgeHistory.useQuery(
    { userId: selectedUser?.id ?? 0, limit: 30 },
    { enabled: !!selectedUser },
  );
  const authority = trpc.admin.authority.useQuery();
  const isOwner = authority.data?.authority === "owner";

  const grant = trpc.admin.grantBadge.useMutation({
    onSuccess: async (_data, vars) => {
      toast.success("Badge concedida.");
      setGrantOpen(false);
      await Promise.all([
        utils.admin.listUserBadges.invalidate({ userId: vars.userId }),
        utils.admin.badgeHistory.invalidate({ userId: vars.userId }),
        utils.badge.forUser.invalidate({ userId: vars.userId }),
        utils.badge.mine.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message),
  });
  const revoke = trpc.admin.revokeBadge.useMutation({
    onSuccess: async (_data, vars) => {
      toast.success("Badge removida.");
      setRevokeTarget(null);
      await Promise.all([
        utils.admin.listUserBadges.invalidate({ userId: vars.userId }),
        utils.admin.badgeHistory.invalidate({ userId: vars.userId }),
        utils.badge.forUser.invalidate({ userId: vars.userId }),
        utils.badge.mine.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message),
  });
  const reevaluate = trpc.admin.reevaluateUserBadges.useMutation({
    onSuccess: async (result, vars) => {
      toast.success(
        `${result.kept} mantida(s), ${result.added} adicionada(s), ${result.removed} removida(s).`,
      );
      await Promise.all([
        utils.admin.listUserBadges.invalidate({ userId: vars.userId }),
        utils.badge.forUser.invalidate({ userId: vars.userId }),
      ]);
    },
    onError: e => toast.error(e.message),
  });
  const setOverride = trpc.admin.setManualOverride.useMutation({
    onSuccess: async (_d, vars) => {
      await utils.admin.listUserBadges.invalidate({ userId: vars.userId });
      toast.success(vars.enabled ? "Override manual ativado." : "Override manual desativado.");
    },
    onError: e => toast.error(e.message),
  });
  const checkConsistency = trpc.admin.checkBadgeConsistency.useQuery(
    undefined,
    { enabled: consistencyOpen },
  );
  const fixConsistency = trpc.admin.fixBadgeConsistency.useMutation({
    onSuccess: async result => {
      toast.success(`${result.removed} inconsistência(s) corrigida(s).`);
      await utils.admin.checkBadgeConsistency.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const setPartnership = trpc.admin.setServerPartnership.useMutation({
    onSuccess: async () => {
      toast.success("Parceria atualizada — badges reavaliadas.");
    },
    onError: e => toast.error(e.message),
  });
  const recordBug = trpc.admin.recordBugReport.useMutation({
    onSuccess: result => {
      toast.success(
        `Bug reportado — ${result.added} badge(s) concedida(s) na reavaliação.`,
      );
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {/* Ferramentas do sistema */}
      <section className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConsistencyOpen(true)}
          className="border-white/10 bg-[#22252b] text-xs text-[#bdc2ca] hover:bg-white/[0.05] hover:text-white"
        >
          <Wrench className="h-3.5 w-3.5" /> Verificar inconsistências
        </Button>
        <PartnershipTool onSave={vars => setPartnership.mutate(vars)} busy={setPartnership.isPending} />
        <BugReportTool onSave={vars => recordBug.mutate(vars)} busy={recordBug.isPending} />
      </section>

      {/* Busca de usuário */}
      <section className="rounded-xl border border-white/[0.075] bg-[#22252b]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-sm font-bold text-white">Emblemas por usuário</h2>
          <p className="mt-0.5 text-[11px] text-[#8e959f]">
            Busque um usuário para ver, conceder, remover e reavaliar badges.
          </p>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68707b]" />
            <Input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                if (!e.target.value.trim()) setSelectedUser(null);
              }}
              placeholder="Nome ou @usuário…"
              className="h-11 border-white/[0.08] bg-[#17191e] pl-9 text-sm text-white placeholder:text-[#68707b]"
              aria-label="Buscar usuário"
            />
          </div>
          {users.data && users.data.length > 0 && !selectedUser && (
            <ul className="mt-2 space-y-0.5">
              {users.data.map(user => (
                <li key={user.id}>
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setSearch("");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#c8cdd5] transition-colors hover:bg-white/[0.05]"
                  >
                    <BadgeCheck className="h-3.5 w-3.5 text-[#7383FF]" />
                    <span className="font-semibold text-white">
                      {user.name ?? user.username}
                    </span>
                    <span className="text-[#7f8792]">@{user.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedUser && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.07] bg-[#1a1c21] px-3 py-2.5">
                <span className="text-xs font-bold text-white">
                  {selectedUser.name ?? selectedUser.username}
                </span>
                <span className="text-[11px] text-[#7f8792]">@{selectedUser.username}</span>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => setGrantOpen(true)}
                    className="h-8 bg-[#5865F2] px-2.5 text-[11px] text-white hover:bg-[#5664e6]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar badge
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reevaluate.mutate({ userId: selectedUser.id })}
                    disabled={reevaluate.isPending}
                    className="h-8 border-white/10 px-2.5 text-[11px] text-[#bdc2ca] hover:bg-white/[0.05] hover:text-white"
                  >
                    <RefreshCcw className={cn("h-3.5 w-3.5", reevaluate.isPending && "animate-spin")} />
                    Reavaliar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedUser(null)}
                    className="h-8 px-2 text-[#7f8792] hover:text-white"
                    aria-label="Fechar usuário"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Badges atuais */}
              {userBadges.isLoading ? (
                <div className="flex justify-center py-6">
                  <LoaderCircle className="h-4 w-4 animate-spin text-[#7383FF]" />
                </div>
              ) : userBadges.data && userBadges.data.length > 0 ? (
                <ul className="space-y-1.5">
                  {userBadges.data.map(badge => (
                    <li
                      key={badge.id}
                      className="flex flex-wrap items-start gap-3 rounded-lg border border-white/[0.07] bg-[#1c1e23] px-3 py-2.5"
                    >
                      <BadgeIcon badge={badge} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{badge.name}</span>
                          <span
                            className="rounded-[4px] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${RARITY_COLORS[badge.rarity]}22`,
                              color: RARITY_COLORS[badge.rarity],
                            }}
                          >
                            {RARITY_LABELS[badge.rarity] ?? badge.rarity}
                          </span>
                          <span className="rounded-[4px] bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#9ca3ad]">
                            {badge.grantSource}
                          </span>
                          {badge.manualOverride && (
                            <span className="rounded-[4px] bg-[#3BA55C]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#67cc90]">
                              Override manual
                            </span>
                          )}
                          {badge.automaticGrantDisabled && (
                            <span className="rounded-[4px] bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                              Automação off
                            </span>
                          )}
                          {badge.expiresAt && (
                            <span className="text-[9px] text-amber-300/80">
                              expira {formatDate(badge.expiresAt)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#858c96]">
                          Concedida em {formatDate(badge.grantedAt)}
                          {badge.grantedByUser
                            ? ` · por @${badge.grantedByUser.username}`
                            : " · pelo sistema"}
                          {badge.reason ? ` · ${badge.reason}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={badge.manualOverride ? "Desativar override" : "Ativar override manual"}
                            aria-label="Alternar override manual"
                            disabled={!isOwner && badge.restricted}
                            onClick={() =>
                              setOverride.mutate({
                                userId: selectedUser.id,
                                badgeId: badge.id,
                                enabled: !badge.manualOverride,
                              })
                            }
                            className="text-[#969da7] hover:bg-white/[0.06] hover:text-white"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Remover badge"
                            aria-label={`Remover ${badge.name}`}
                            disabled={!isOwner && badge.restricted}
                            onClick={() => setRevokeTarget(badge)}
                            className="text-[#969da7] hover:bg-[#ed4245]/10 hover:text-[#ff8c8f]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-[#7f8792]">
                  Este usuário não possui badges.
                </p>
              )}

              {/* Histórico */}
              {history.data && history.data.length > 0 && (
                <details className="rounded-lg border border-white/[0.07] bg-[#1a1c21]">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-bold text-[#bdc2ca]">
                    <History className="h-3.5 w-3.5 text-[#7383FF]" />
                    Histórico ({history.data.length})
                  </summary>
                  <ul className="max-h-64 space-y-1 overflow-y-auto px-3 pb-3">
                    {history.data.map(entry => (
                      <li key={entry.id} className="border-t border-white/[0.05] pt-1.5 text-[10px] text-[#969da7]">
                        <span className="font-bold text-[#c8cdd5]">{entry.action}</span>{" "}
                        {entry.badgeName ? `· ${entry.badgeName}` : ""} ·{" "}
                        {formatDate(entry.timestamp)}
                        {entry.performedByUser ? ` · por @${entry.performedByUser.username}` : ""}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Modal: adicionar badge */}
      <GrantBadgeModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        user={selectedUser}
        catalog={catalog.data ?? []}
        isOwner={isOwner}
        onSubmit={vars => grant.mutate(vars)}
        busy={grant.isPending}
      />

      {/* Modal: remover badge */}
      <Dialog open={revokeTarget !== null} onOpenChange={o => !o && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-sm border-white/10 bg-[#24262c] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Remover {revokeTarget?.name} de @{selectedUser?.username}?
            </DialogTitle>
          </DialogHeader>
          <RevokeForm
            busy={revoke.isPending}
            onSubmit={reason => {
              if (!revokeTarget || !selectedUser) return;
              revoke.mutate({
                userId: selectedUser.id,
                badgeId: revokeTarget.id,
                reason,
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal: consistência */}
      <Dialog open={consistencyOpen} onOpenChange={setConsistencyOpen}>
        <DialogContent className="sm:max-w-md border-white/10 bg-[#24262c] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Verificar inconsistências</DialogTitle>
          </DialogHeader>
          {checkConsistency.isLoading ? (
            <div className="flex justify-center py-6">
              <LoaderCircle className="h-5 w-5 animate-spin text-[#7383FF]" />
            </div>
          ) : checkConsistency.data ? (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Usuários analisados", checkConsistency.data.usersAnalyzed],
                  ["Badges válidas", checkConsistency.data.validBadges],
                  ["Registros legados", checkConsistency.data.legacyRows],
                  ["Duplicatas", checkConsistency.data.duplicates],
                  ["Inválidas", checkConsistency.data.invalid],
                  ["Vencidas ativas", checkConsistency.data.expiredLingering],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg bg-white/[0.04] px-3 py-2">
                    <dt className="text-[10px] text-[#858c96]">{label as string}</dt>
                    <dd className="text-sm font-bold text-white">{String(value)}</dd>
                  </div>
                ))}
              </dl>
              {checkConsistency.data.issues.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-[#ed4245]/[0.07] p-3 text-[10px] text-[#ff9d9f]">
                  {checkConsistency.data.issues.map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  disabled={
                    fixConsistency.isPending ||
                    (checkConsistency.data.invalid === 0 &&
                      checkConsistency.data.expiredLingering === 0)
                  }
                  onClick={() => fixConsistency.mutate()}
                  className="bg-[#5865F2] text-white hover:bg-[#5664e6]"
                >
                  <Wrench className="h-3.5 w-3.5" /> Corrigir automaticamente
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function GrantBadgeModal({
  open,
  onClose,
  user,
  catalog,
  isOwner,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  user: PublicUser | null;
  catalog: BadgeDTO[];
  isOwner: boolean;
  onSubmit: (vars: {
    userId: number;
    badgeId: number;
    reason?: string;
    expiresInDays?: number | null;
    manualOverride: boolean;
  }) => void;
  busy: boolean;
}) {
  const [badgeId, setBadgeId] = useState("");
  const [reason, setReason] = useState("");
  const [expiration, setExpiration] = useState("never");
  const [manualOverride, setManualOverride] = useState(true);
  const selected = catalog.find(b => String(b.id) === badgeId) ?? null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md border-white/10 bg-[#24262c] text-white">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Adicionar badge</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
              Usuário
            </Label>
            <Input
              readOnly
              value={user ? `@${user.username}` : ""}
              className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
              Badge
            </Label>
            <Select value={badgeId} onValueChange={setBadgeId}>
              <SelectTrigger className="h-10 w-full border-white/[0.08] bg-[#17191e] text-white">
                <SelectValue placeholder="Selecionar badge…" />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-white/[0.08] bg-[#24262c] text-white">
                {catalog.map(b => (
                  <SelectItem key={b.id} value={String(b.id)} disabled={b.restricted && !isOwner}>
                    <span className="flex items-center gap-2">
                      <BadgeIcon badge={b} size={16} />
                      {b.name}
                      {b.restricted && <span className="text-[9px] text-[#ed4245]">(owner)</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && !isOwner && selected.restricted && (
              <p className="text-[10px] text-[#ff9d9f]">
                Somente o proprietário da plataforma concede esta badge.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
              Motivo
            </Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={300}
              placeholder="Ex.: Membro da equipe Nexora"
              className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white placeholder:text-[#68707b]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
              Expiração
            </Label>
            <Select value={expiration} onValueChange={setExpiration}>
              <SelectTrigger className="h-10 w-full border-white/[0.08] bg-[#17191e] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-[#24262c] text-white">
                <SelectItem value="never">Sem expiração</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="365">1 ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#17191e] px-3 py-2.5">
            <span className="text-xs font-semibold text-[#aeb4be]">
              Override manual
              <span className="block text-[10px] font-normal text-[#7f8792]">
                A automação não poderá remover esta badge.
              </span>
            </span>
            <Switch checked={manualOverride} onCheckedChange={setManualOverride} aria-label="Override manual" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!badgeId || busy || (!!selected && selected.restricted && !isOwner)}
              onClick={() => {
                if (!user || !badgeId) return;
                onSubmit({
                  userId: user.id,
                  badgeId: Number(badgeId),
                  reason: reason.trim() || undefined,
                  expiresInDays:
                    expiration === "never" ? null : Number(expiration),
                  manualOverride,
                });
              }}
              className="bg-[#5865F2] text-white hover:bg-[#5664e6]"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Adicionar badge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevokeForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
          Motivo (registrado no histórico)
        </Label>
        <Input
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={300}
          placeholder="Ex.: Abuso de poder"
          className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white placeholder:text-[#68707b]"
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
          onClick={() => onSubmit(reason.trim())}
        >
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Remover
        </Button>
      </div>
    </div>
  );
}

function PartnershipTool({
  onSave,
  busy,
}: {
  onSave: (vars: { serverId: number; partnered: boolean }) => void;
  busy: boolean;
}) {
  const [serverId, setServerId] = useState("");
  const [partnered, setPartnered] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.075] bg-[#22252b] px-3 py-2">
      <Handshake className="h-4 w-4 text-[#7383FF]" />
      <Input
        value={serverId}
        onChange={e => setServerId(e.target.value.replace(/\D/g, ""))}
        placeholder="ID do servidor"
        aria-label="ID do servidor para parceria"
        className="h-9 w-36 border-white/[0.08] bg-[#17191e] text-xs text-white placeholder:text-[#68707b]"
      />
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#aeb4be]">
        <input
          type="checkbox"
          checked={partnered}
          onChange={e => setPartnered(e.target.checked)}
          className="accent-[#5865F2]"
        />
        Parceiro
      </label>
      <Button
        size="sm"
        disabled={!serverId || busy}
        onClick={() => onSave({ serverId: Number(serverId), partnered })}
        className="h-9 bg-[#5865F2] px-3 text-[11px] text-white hover:bg-[#5664e6]"
      >
        Aplicar
      </Button>
    </div>
  );
}

function BugReportTool({
  onSave,
  busy,
}: {
  onSave: (vars: { userId: number; critical: boolean; description?: string }) => void;
  busy: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [critical, setCritical] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.075] bg-[#22252b] px-3 py-2">
      <Bug className="h-4 w-4 text-[#f0b232]" />
      <Input
        value={userId}
        onChange={e => setUserId(e.target.value.replace(/\D/g, ""))}
        placeholder="ID do usuário"
        aria-label="ID do usuário para bug report"
        className="h-9 w-36 border-white/[0.08] bg-[#17191e] text-xs text-white placeholder:text-[#68707b]"
      />
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#aeb4be]">
        <input
          type="checkbox"
          checked={critical}
          onChange={e => setCritical(e.target.checked)}
          className="accent-[#5865F2]"
        />
        Crítico
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={!userId || busy}
        onClick={() => onSave({ userId: Number(userId), critical })}
        className="h-9 border-white/10 px-3 text-[11px] text-[#bdc2ca] hover:bg-white/[0.05] hover:text-white"
      >
        <Flag className="h-3.5 w-3.5" /> Registrar bug aceito
      </Button>
    </div>
  );
}
