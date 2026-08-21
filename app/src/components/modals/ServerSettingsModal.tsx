import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Shield, Ban, UserMinus, Crown } from "lucide-react";
import type { ServerDetailsDTO, RoleDTO } from "@contracts/types";
import { PERMISSIONS, type Permission } from "@contracts/constants";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { Avatar } from "../Avatar";
import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<Permission, string> = {
  ADMINISTRATOR: "Administrador",
  MANAGE_SERVER: "Gerenciar servidor",
  MANAGE_CHANNELS: "Gerenciar canais",
  MANAGE_ROLES: "Gerenciar cargos",
  KICK_MEMBERS: "Expulsar membros",
  BAN_MEMBERS: "Banir membros",
  MANAGE_MESSAGES: "Gerenciar mensagens",
  SEND_MESSAGES: "Enviar mensagens",
  READ_MESSAGES: "Ler mensagens",
  CONNECT: "Conectar ao canal de voz",
  SPEAK: "Falar",
  STREAM: "Transmitir vídeo e tela",
};

const PERMISSION_DESCRIPTIONS: Partial<Record<Permission, string>> = {
  ADMINISTRATOR: "Concede todas as permissões automaticamente.",
  MANAGE_SERVER: "Alterar nome, ícone e convites do servidor.",
  MANAGE_CHANNELS: "Criar e excluir canais.",
  MANAGE_ROLES: "Criar, editar e atribuir cargos.",
  KICK_MEMBERS: "Remover membros do servidor (eles podem voltar com um convite).",
  BAN_MEMBERS: "Banir membros permanentemente.",
  MANAGE_MESSAGES: "Excluir mensagens de outros membros.",
  CONNECT: "Entrar em canais de voz.",
  SPEAK: "Usar o microfone em canais de voz.",
  STREAM: "Usar câmera e compartilhar a tela.",
};

type Tab = "overview" | "roles" | "members" | "invites" | "moderation" | "danger";

export function ServerSettingsModal({
  open,
  onOpenChange,
  details,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: ServerDetailsDTO;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { server, myPermissions } = details;
  const isOwner = trpc.auth.me.useQuery().data?.id === server.ownerId;
  const canManageServer = myPermissions.includes("MANAGE_SERVER");
  const canManageRoles = myPermissions.includes("MANAGE_ROLES");
  const canKick = myPermissions.includes("KICK_MEMBERS");
  const canBan = myPermissions.includes("BAN_MEMBERS");

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "overview", label: "Visão geral", visible: canManageServer },
    { id: "roles", label: "Cargos", visible: canManageRoles },
    { id: "members", label: "Membros", visible: canKick || canBan || canManageRoles },
    { id: "invites", label: "Convites", visible: canManageServer },
    { id: "moderation", label: "Moderação", visible: canBan },
    { id: "danger", label: "Excluir servidor", visible: isOwner },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0]?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[560px] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Configurações do servidor</DialogTitle>
        <div className="flex h-full">
          <aside className="w-48 shrink-0 bg-[var(--sidebar-bg)] p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
              {server.name}
            </p>
            <nav className="space-y-0.5">
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    activeTab === t.id
                      ? "bg-[var(--active-bg)] text-foreground"
                      : "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-foreground",
                    t.id === "danger" && "text-destructive hover:text-destructive",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="flex-1 min-w-0 bg-[var(--chat-bg)]">
            <ScrollArea className="h-full">
              <div className="p-6">
                {activeTab === "overview" && <OverviewTab details={details} />}
                {activeTab === "roles" && <RolesTab details={details} />}
                {activeTab === "members" && (
                  <MembersTab details={details} canKick={canKick} canBan={canBan} canManageRoles={canManageRoles} />
                )}
                {activeTab === "invites" && <InvitesTab serverId={server.id} />}
                {activeTab === "moderation" && <ModerationTab serverId={server.id} />}
                {activeTab === "danger" && (
                  <DangerTab serverId={server.id} serverName={server.name} onClose={() => onOpenChange(false)} />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Visão geral ───────────────────────────────────────────────
function OverviewTab({ details }: { details: ServerDetailsDTO }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(details.server.name);
  const [description, setDescription] = useState(details.server.description ?? "");
  const update = trpc.server.update.useMutation({
    onSuccess: () => {
      toast.success("Servidor atualizado.");
      utils.server.get.invalidate({ serverId: details.server.id });
      utils.server.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold">Visão geral</h2>
      <div className="space-y-2">
        <Label htmlFor="srv-name">Nome do servidor</Label>
        <Input id="srv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="srv-desc">Descrição</Label>
        <Textarea
          id="srv-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Sobre o que é este servidor?"
        />
      </div>
      <Button
        disabled={update.isPending || (!name.trim() && true)}
        onClick={() =>
          update.mutate({
            serverId: details.server.id,
            name: name.trim() || details.server.name,
            description: description.trim() || null,
          })
        }
      >
        {update.isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </div>
  );
}

// ── Cargos ────────────────────────────────────────────────────
function RolesTab({ details }: { details: ServerDetailsDTO }) {
  const utils = trpc.useUtils();
  const serverId = details.server.id;
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(details.roles[0]?.id ?? null);
  const [newRoleName, setNewRoleName] = useState("");
  const selectedRole = details.roles.find((r) => r.id === selectedRoleId) ?? null;

  const invalidate = () => utils.server.get.invalidate({ serverId });

  const createRole = trpc.server.createRole.useMutation({
    onSuccess: () => {
      setNewRoleName("");
      toast.success("Cargo criado.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateRole = trpc.server.updateRole.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteRole = trpc.server.deleteRole.useMutation({
    onSuccess: () => {
      setSelectedRoleId(null);
      toast.success("Cargo excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePermission = (role: RoleDTO, perm: Permission) => {
    const current = new Set(role.permissions as Permission[]);
    if (current.has(perm)) current.delete(perm);
    else current.add(perm);
    updateRole.mutate({ roleId: role.id, permissions: [...current] as Permission[] });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Cargos</h2>
      <div className="flex gap-2">
        <Input
          placeholder="Nome do novo cargo"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          maxLength={64}
        />
        <Button
          variant="secondary"
          disabled={!newRoleName.trim() || createRole.isPending}
          onClick={() =>
            createRole.mutate({ serverId, name: newRoleName.trim(), permissions: ["SEND_MESSAGES", "READ_MESSAGES", "CONNECT", "SPEAK"] })
          }
        >
          <Plus className="h-4 w-4 mr-1" /> Criar
        </Button>
      </div>
      <div className="flex gap-4 min-h-[320px]">
        <div className="w-44 shrink-0 space-y-1">
          {details.roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm flex items-center gap-2",
                selectedRoleId === role.id ? "bg-[var(--active-bg)]" : "hover:bg-[var(--hover-bg)]",
              )}
            >
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
              <span className="truncate">{role.name}</span>
              {role.isDefault && <span className="ml-auto text-[10px] text-muted-foreground">padrão</span>}
            </button>
          ))}
        </div>
        <Separator orientation="vertical" />
        <div className="flex-1 min-w-0">
          {selectedRole ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  key={selectedRole.id}
                  defaultValue={selectedRole.name}
                  maxLength={64}
                  className="max-w-56"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== selectedRole.name) updateRole.mutate({ roleId: selectedRole.id, name: v });
                  }}
                />
                <input
                  type="color"
                  defaultValue={selectedRole.color}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  onBlur={(e) => {
                    if (e.target.value !== selectedRole.color)
                      updateRole.mutate({ roleId: selectedRole.id, color: e.target.value });
                  }}
                />
                {!selectedRole.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteRole.mutate({ roleId: selectedRole.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {PERMISSIONS.map((perm) => {
                  const enabled = (selectedRole.permissions as Permission[]).includes(perm);
                  return (
                    <div key={perm} className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-[var(--hover-bg)]">
                      <div className="min-w-0">
                        <p className="text-sm">{PERMISSION_LABELS[perm]}</p>
                        {PERMISSION_DESCRIPTIONS[perm] && (
                          <p className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[perm]}</p>
                        )}
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => togglePermission(selectedRole, perm)}
                        disabled={updateRole.isPending}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um cargo para editar.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Membros ───────────────────────────────────────────────────
function MembersTab({
  details,
  canKick,
  canBan,
  canManageRoles,
}: {
  details: ServerDetailsDTO;
  canKick: boolean;
  canBan: boolean;
  canManageRoles: boolean;
}) {
  const utils = trpc.useUtils();
  const serverId = details.server.id;
  const me = trpc.auth.me.useQuery().data;
  const invalidate = () => utils.server.get.invalidate({ serverId });

  const kick = trpc.server.kick.useMutation({
    onSuccess: () => {
      toast.success("Membro expulso.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const ban = trpc.server.ban.useMutation({
    onSuccess: () => {
      toast.success("Membro banido.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const assignRole = trpc.server.assignRole.useMutation({ onSuccess: invalidate, onError: (e) => toast.error(e.message) });
  const unassignRole = trpc.server.unassignRole.useMutation({ onSuccess: invalidate, onError: (e) => toast.error(e.message) });

  const [confirm, setConfirm] = useState<{ userId: number; name: string; action: "kick" | "ban" } | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Membros — {details.members.length}</h2>
      <div className="space-y-1">
        {details.members.map((m) => {
          const isSelf = m.user.id === me?.id;
          return (
            <div key={m.user.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-[var(--hover-bg)]">
              <Avatar user={m.user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <span className="truncate">{m.user.name ?? m.user.username}</span>
                  {m.isOwner && <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                </p>
                <p className="text-xs text-muted-foreground truncate">@{m.user.username}</p>
              </div>
              {canManageRoles && !m.isOwner && (
                <div className="flex flex-wrap gap-1 max-w-52">
                  {details.roles.filter((r) => !r.isDefault).map((role) => {
                    const has = m.roles.some((r) => r.id === role.id);
                    return (
                      <button
                        key={role.id}
                        disabled={assignRole.isPending || unassignRole.isPending}
                        onClick={() =>
                          has
                            ? unassignRole.mutate({ serverId, userId: m.user.id, roleId: role.id })
                            : assignRole.mutate({ serverId, userId: m.user.id, roleId: role.id })
                        }
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                          has ? "border-transparent text-white" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                        style={has ? { backgroundColor: role.color } : undefined}
                        title={has ? `Remover cargo ${role.name}` : `Atribuir cargo ${role.name}`}
                      >
                        {role.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {!m.isOwner && !isSelf && (canKick || canBan) && (
                <div className="flex gap-1 shrink-0">
                  {canKick && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Expulsar"
                      onClick={() => setConfirm({ userId: m.user.id, name: m.user.name ?? m.user.username ?? "membro", action: "kick" })}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                  {canBan && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title="Banir"
                      onClick={() => setConfirm({ userId: m.user.id, name: m.user.name ?? m.user.username ?? "membro", action: "ban" })}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "kick" ? "Expulsar membro" : "Banir membro"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "kick"
                ? `Tem certeza que deseja expulsar ${confirm?.name}? Essa pessoa poderá voltar com um novo convite.`
                : `Tem certeza que deseja banir ${confirm?.name}? Essa pessoa não poderá voltar ao servidor.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === "kick") kick.mutate({ serverId, userId: confirm.userId });
                else ban.mutate({ serverId, userId: confirm.userId });
                setConfirm(null);
              }}
            >
              {confirm?.action === "kick" ? "Expulsar" : "Banir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Convites ──────────────────────────────────────────────────
function InvitesTab({ serverId }: { serverId: number }) {
  const invites = trpc.server.listInvites.useQuery({ serverId });
  const revoke = trpc.server.revokeInvite.useMutation({
    onSuccess: () => {
      toast.success("Convite revogado.");
      invites.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const copy = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Convites ativos</h2>
      {invites.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : invites.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum convite ativo. Use o menu do servidor para criar um.</p>
      ) : (
        <div className="space-y-2">
          {invites.data?.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
              <code className="text-sm font-mono">{inv.code}</code>
              <span className="text-xs text-muted-foreground">
                {inv.uses} uso{inv.uses === 1 ? "" : "s"}
                {inv.maxUses ? ` / máx. ${inv.maxUses}` : ""}
                {inv.expiresAt ? ` · expira em ${new Date(inv.expiresAt).toLocaleDateString("pt-BR")}` : " · sem expiração"}
              </span>
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon" title="Copiar link" onClick={() => copy(inv.code)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  title="Revogar"
                  onClick={() => revoke.mutate({ inviteId: inv.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Moderação (banimentos) ────────────────────────────────────
function ModerationTab({ serverId }: { serverId: number }) {
  const bans = trpc.server.listBans.useQuery({ serverId });
  const unban = trpc.server.unban.useMutation({
    onSuccess: () => {
      toast.success("Banimento removido.");
      bans.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Shield className="h-5 w-5" /> Banimentos
      </h2>
      {bans.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : bans.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário banido.</p>
      ) : (
        <div className="space-y-2">
          {bans.data?.map(({ ban, user }) => (
            <div key={ban.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
              <Avatar user={user} size="sm" showStatus={false} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user.name ?? user.username}</p>
                {ban.reason && <p className="text-xs text-muted-foreground truncate">Motivo: {ban.reason}</p>}
              </div>
              <Button variant="secondary" size="sm" onClick={() => unban.mutate({ serverId, userId: user.id })}>
                Desbanir
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Excluir servidor ──────────────────────────────────────────
function DangerTab({ serverId, serverName, onClose }: { serverId: number; serverName: string; onClose: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [confirmName, setConfirmName] = useState("");
  const del = trpc.server.delete.useMutation({
    onSuccess: () => {
      toast.success("Servidor excluído.");
      utils.server.list.invalidate();
      onClose();
      navigate("/channels/@me");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold text-destructive">Excluir servidor</h2>
      <p className="text-sm text-muted-foreground">
        Esta ação é permanente e não pode ser desfeita. Todos os canais, mensagens e membros serão removidos.
        Digite <strong>{serverName}</strong> para confirmar.
      </p>
      <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={serverName} />
      <Button
        variant="destructive"
        disabled={confirmName !== serverName || del.isPending}
        onClick={() => del.mutate({ serverId })}
      >
        {del.isPending ? "Excluindo..." : "Excluir servidor permanentemente"}
      </Button>
    </div>
  );
}
