import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Crown,
  Image as ImageIcon,
  Link2,
  Loader2,
  LogOut,
  MoreVertical,
  Paperclip,
  Pin,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/endpoints";
import { Avatar } from "@/components/Avatar";
import { GroupAvatar } from "./GroupAvatar";
import { GroupLimits, type GroupRole } from "@contracts/constants";
import type { PublicUser } from "@contracts/types";

type Tab = "members" | "media" | "pins" | "invites";

const ROLE_LABEL: Record<GroupRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

function roleAtLeast(role: GroupRole, min: GroupRole): boolean {
  const rank = { member: 0, admin: 1, owner: 2 };
  return rank[role] >= rank[min];
}

export function GroupInfoModal({
  open,
  onOpenChange,
  conversationId,
  onOpenProfile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: number;
  onOpenProfile?: (userId: number) => void;
}) {
  const utils = trpc.useUtils();
  const details = trpc.group.get.useQuery(
    { conversationId },
    { enabled: open && Number.isFinite(conversationId) && conversationId > 0 },
  );
  const [tab, setTab] = useState<Tab>("members");
  const [memberQuery, setMemberQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFileId, setAvatarFileId] = useState<number | undefined>();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = async () => {
    await Promise.all([
      utils.group.get.invalidate({ conversationId }),
      utils.dm.list.invalidate(),
      utils.group.listInvites.invalidate(),
      utils.group.listPins.invalidate({ conversationId }),
    ]);
  };

  const update = trpc.group.update.useMutation({
    onSuccess: () => {
      toast.success("Grupo atualizado.");
      setEditing(false);
      void invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const removeMember = trpc.group.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Participante removido.");
      void invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const promote = trpc.group.promote.useMutation({
    onSuccess: () => void invalidate(),
    onError: e => toast.error(e.message),
  });
  const demote = trpc.group.demote.useMutation({
    onSuccess: () => void invalidate(),
    onError: e => toast.error(e.message),
  });

  const myRole = details.data?.myRole ?? null;
  const isManager = myRole === "owner" || myRole === "admin";

  if (!open) return null;

  const jumpToMessage = (messageId: number) => {
    onOpenChange(false);
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("bg-[#5865F2]/20");
      setTimeout(() => el?.classList.remove("bg-[#5865F2]/20"), 1500);
    }, 300);
  };

  const startEditing = () => {
    if (!details.data) return;
    setName(details.data.customName ?? "");
    setDescription(details.data.description ?? "");
    setAvatarUrl(details.data.avatarUrl ?? null);
    setAvatarFileId(undefined);
    setEditing(true);
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no envio da imagem.");
      setAvatarUrl(data.url as string);
      setAvatarFileId(data.id as number);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio da imagem.");
    } finally {
      setUploading(false);
    }
  };

  const membersFiltered = (details.data?.members ?? []).filter(m => {
    const q = memberQuery.trim().toLowerCase().replace(/^@/, "");
    if (!q) return true;
    return (
      m.user.name?.toLowerCase().includes(q) ||
      m.user.username?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0 text-left">
          {editing && isManager ? (
            <div className="space-y-3">
              <DialogTitle>Editar grupo</DialogTitle>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border transition-colors hover:border-primary"
                  aria-label="Escolher imagem do grupo"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted2" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted2" aria-hidden />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="group-edit-name">Nome</Label>
                  <Input
                    id="group-edit-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={GroupLimits.MAX_NAME_LENGTH}
                    placeholder={details.data?.name ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="group-edit-desc">Descrição</Label>
                <Textarea
                  id="group-edit-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  maxLength={GroupLimits.MAX_DESCRIPTION_LENGTH}
                  placeholder="Sobre este grupo (opcional)"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={update.isPending || uploading}
                  onClick={() =>
                    update.mutate({
                      conversationId,
                      name: name.trim() || null,
                      description: description.trim() || null,
                      avatarFileId: avatarFileId ?? undefined,
                    })
                  }
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <GroupAvatar
                  users={details.data?.members.map(m => m.user)}
                  src={details.data?.avatarUrl}
                  name={details.data?.name}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-left">
                    {details.data?.name ?? "..."}
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    {details.data?.memberCount ?? 0} participante
                    {(details.data?.memberCount ?? 0) === 1 ? "" : "s"}
                    {" · "}
                    {myRole ? ROLE_LABEL[myRole] : ""}
                  </DialogDescription>
                </div>
                {isManager && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={startEditing}
                    aria-label="Editar grupo"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {details.data?.description && !editing && (
                <p className="text-xs leading-relaxed text-muted2">
                  {details.data.description}
                </p>
              )}
            </>
          )}
        </DialogHeader>

        {/* Tabs */}
        {!editing && (
          <div className="flex shrink-0 gap-1 border-b border-white/10 pb-1" role="tablist" aria-label="Seções do grupo">
            {(
              [
                ["members", "Participantes", Users],
                ["media", "Mídia", ImageIcon],
                ["pins", "Fixadas", Pin],
                ...(isManager ? ([["invites", "Convites", Link2]] as const) : []),
              ] as Array<[Tab, string, typeof Users]>
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors",
                  tab === key
                    ? "bg-primary/15 text-primary"
                    : "text-muted2 hover:bg-white/5 hover:text-bodyx",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
              </button>
            ))}
          </div>
        )}

        {!editing && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1" role="tabpanel">
            {tab === "members" && (
              <MembersTab
                conversationId={conversationId}
                myRole={myRole!}
                query={memberQuery}
                setQuery={setMemberQuery}
                members={membersFiltered}
                total={details.data?.memberCount ?? 0}
                onOpenProfile={onOpenProfile}
                onRemove={id => removeMember.mutate({ conversationId, userId: id })}
                onPromote={id => promote.mutate({ conversationId, userId: id })}
                onDemote={id => demote.mutate({ conversationId, userId: id })}
              />
            )}

            {tab === "media" && <MediaTab conversationId={conversationId} />}

            {tab === "pins" && (
              <PinsTab
                conversationId={conversationId}
                canManage={!!isManager}
                onJumpToMessage={jumpToMessage}
              />
            )}

            {tab === "invites" && isManager && (
              <InvitesTab conversationId={conversationId} />
            )}
          </div>
        )}

        {!editing && (
          <>
            <NotificationPrefs conversationId={conversationId} />

            {/* Danger zone */}
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
              {myRole !== "owner" && (
                <LeaveControl conversationId={conversationId} />
              )}
              {myRole === "owner" && (
                <TransferControl
                  conversationId={conversationId}
                  onDone={() => void invalidate()}
                />
              )}
              {myRole === "owner" && (
                <DeleteControl
                  conversationId={conversationId}
                  groupName={details.data?.name ?? ""}
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Members tab ───────────────────────────────────────────────

function MembersTab({
  conversationId,
  myRole,
  query,
  setQuery,
  members,
  total,
  onOpenProfile,
  onRemove,
  onPromote,
  onDemote,
}: {
  conversationId: number;
  myRole: GroupRole;
  query: string;
  setQuery: (v: string) => void;
  members: Array<{ user: PublicUser; role: GroupRole }>;
  total: number;
  onOpenProfile?: (userId: number) => void;
  onRemove: (userId: number) => void;
  onPromote: (userId: number) => void;
  onDemote: (userId: number) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
          Participantes — {total}/{GroupLimits.MAX_MEMBERS}
        </p>
        {roleAtLeast(myRole, "admin") && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto h-7 rounded-full px-2.5 text-[11px]"
            onClick={() => setAdding(true)}
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" /> Adicionar pessoas
          </Button>
        )}
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar participante"
          aria-label="Buscar participante"
          className="h-9 pl-9 text-xs"
        />
      </div>

      <ul className="space-y-0.5">
        {members.map(m => {
          const displayName = m.user.name ?? m.user.username ?? "Usuário";
          const canAct =
            roleAtLeast(myRole, "admin") &&
            m.role !== "owner" &&
            (myRole === "owner" || m.role === "member");
          return (
            <li
              key={m.user.id}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <button
                type="button"
                onClick={() => onOpenProfile?.(m.user.id)}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                aria-label={`Ver perfil de ${displayName}`}
              >
                <Avatar
                  userId={m.user.id}
                  name={m.user.name ?? m.user.username}
                  src={m.user.avatar}
                  size="sm"
                  showStatus
                />
              </button>
              <button
                type="button"
                onClick={() => onOpenProfile?.(m.user.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-bodyx">
                    {displayName}
                  </span>
                  {m.role !== "member" && (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-wide",
                        m.role === "owner"
                          ? "bg-[#FAA61A]/15 text-[#FAA61A]"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {m.role === "owner" && <Crown className="h-2.5 w-2.5" aria-hidden />}
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                </span>
                {m.user.username && (
                  <span className="block truncate text-[11px] text-muted2">
                    @{m.user.username}
                  </span>
                )}
              </button>

              {canAct && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="rounded p-1 text-muted2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:text-white"
                      aria-label={`Ações para ${displayName}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 bg-panel text-xs text-white"
                  >
                    {myRole === "owner" && m.role === "member" && (
                      <DropdownMenuItem
                        className="cursor-pointer hover:bg-white/10"
                        onClick={() => onPromote(m.user.id)}
                      >
                        <ShieldCheck className="mr-2 h-3.5 w-3.5 text-primary" />
                        Promover a administrador
                      </DropdownMenuItem>
                    )}
                    {myRole === "owner" && m.role === "admin" && (
                      <DropdownMenuItem
                        className="cursor-pointer hover:bg-white/10"
                        onClick={() => onDemote(m.user.id)}
                      >
                        <ShieldCheck className="mr-2 h-3.5 w-3.5 text-muted2" />
                        Remover como administrador
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      className="cursor-pointer text-red-400 hover:bg-red-500/10 focus:text-red-300"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remover ${displayName} do grupo?\n\n${displayName} perderá acesso às novas mensagens deste grupo.`,
                          )
                        ) {
                          onRemove(m.user.id);
                        }
                      }}
                    >
                      <UserMinus className="mr-2 h-3.5 w-3.5" /> Remover do grupo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <AddPeopleDialog
          open={adding}
          onOpenChange={setAdding}
          conversationId={conversationId}
        />
      )}
    </div>
  );
}

// ── Add people dialog ─────────────────────────────────────────

function AddPeopleDialog({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: number;
}) {
  const utils = trpc.useUtils();
  const friends = trpc.friend.list.useQuery(undefined, { enabled: open });
  const group = trpc.group.get.useQuery({ conversationId }, { enabled: open });

  const memberIds = useMemo(
    () => new Set((group.data?.members ?? []).map(m => m.user.id)),
    [group.data],
  );
  const candidates = useMemo(
    () =>
      (friends.data ?? [])
        .filter(f => f.status === "ACCEPTED" && !memberIds.has(f.user.id))
        .map(f => f.user),
    [friends.data, memberIds],
  );

  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");

  const add = trpc.group.addMembers.useMutation({
    onSuccess: data => {
      toast.success(
        data.added.length === 1
          ? "1 pessoa adicionada."
          : `${data.added.length} pessoas adicionadas.`,
      );
      utils.dm.list.invalidate();
      utils.group.get.invalidate({ conversationId });
      onOpenChange(false);
      setSelected([]);
    },
    onError: e => toast.error(e.message),
  });

  const filtered = candidates.filter(u => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return true;
    return (
      u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar pessoas</DialogTitle>
          <DialogDescription>Selecione amigos para entrar no grupo.</DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar amigos por nome ou @username"
          aria-label="Buscar amigos"
        />
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="py-6 text-center text-xs text-muted2">
              Nenhum amigo disponível.
            </li>
          )}
          {filtered.map(u => {
            const isSel = selected.includes(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(prev =>
                      isSel ? prev.filter(x => x !== u.id) : [...prev, u.id],
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                    isSel ? "bg-primary/15 text-primary" : "hover:bg-white/[0.05]",
                  )}
                >
                  <Avatar
                    userId={u.id}
                    name={u.name ?? u.username}
                    src={u.avatar}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {u.name ?? u.username ?? "Usuário"}
                  </span>
                  {isSel && <Check className="h-4 w-4" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted2">{selected.length} selecionado(s)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={selected.length === 0 || add.isPending}
              onClick={() => {
                if (window.confirm(`Adicionar ${selected.length} pessoa(s)?`)) {
                  add.mutate({ conversationId, userIds: selected });
                }
              }}
            >
              {add.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Media tab ─────────────────────────────────────────────────

function MediaTab({ conversationId }: { conversationId: number }) {
  const [kind, setKind] = useState<
    "image" | "video" | "audio" | "file" | "link"
  >("image");
  const media = trpc.group.sharedMedia.useQuery(
    { conversationId, kind, limit: 60 },
    { enabled: conversationId > 0 },
  );

  const kinds = [
    ["image", "Imagens"],
    ["video", "Vídeos"],
    ["audio", "Áudios"],
    ["file", "Arquivos"],
    ["link", "Links"],
  ] as const;

  return (
    <div className="space-y-3 py-1">
      <div className="flex flex-wrap gap-1">
        {kinds.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-bold transition-colors",
              kind === k
                ? "bg-primary/15 text-primary"
                : "bg-secondary text-muted2 hover:text-bodyx",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {media.isLoading && (
        <p className="py-6 text-center text-xs text-muted2">Carregando...</p>
      )}

      {kind === "link" && (
        <>
          {(media.data?.links.length ?? 0) === 0 && !media.isLoading && (
            <p className="py-6 text-center text-xs text-muted2">
              Nenhum link compartilhado ainda.
            </p>
          )}
          <ul className="space-y-1">
            {media.data?.links.map(l => (
              <li key={`${l.messageId}-${l.url}`}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-primary hover:bg-white/[0.04]"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate underline-offset-2 hover:underline">
                    {l.url}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {kind !== "link" && (
        <>
          {(media.data?.attachments.length ?? 0) === 0 && !media.isLoading && (
            <p className="py-6 text-center text-xs text-muted2">
              Nada por aqui ainda.
            </p>
          )}
          <ul className="grid grid-cols-3 gap-1.5">
            {media.data?.attachments.map(a => {
              const isImg = a.mimeType.startsWith("image/");
              return (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={a.filename}
                    className="block aspect-square overflow-hidden rounded-lg bg-secondary"
                  >
                    {isImg && !a.spoiler ? (
                      <img
                        src={a.url}
                        alt={a.filename}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-[10px] font-semibold text-muted2">
                        <Paperclip className="h-4 w-4" aria-hidden />
                        <span className="line-clamp-2 break-all">{a.filename}</span>
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Pins tab ──────────────────────────────────────────────────

function PinsTab({
  conversationId,
  canManage,
  onJumpToMessage,
}: {
  conversationId: number;
  canManage: boolean;
  onJumpToMessage: (messageId: number) => void;
}) {
  const utils = trpc.useUtils();
  const pins = trpc.group.listPins.useQuery({ conversationId });
  const unpin = trpc.group.unpinMessage.useMutation({
    onSuccess: () => utils.group.listPins.invalidate({ conversationId }),
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-2 py-1">
      {(pins.data?.pins.length ?? 0) === 0 && (
        <p className="py-8 text-center text-xs text-muted2">
          Nenhuma mensagem fixada. Administradores podem fixar mensagens importantes.
        </p>
      )}
      {pins.data?.pins.map(p => (
        <div
          key={p.messageId}
          className="rounded-xl border border-white/10 bg-sidebar/60 px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 shrink-0 text-[#FAA61A]" aria-hidden />
            <button
              type="button"
              onClick={() => onJumpToMessage(p.messageId)}
              className="min-w-0 flex-1 truncate text-left text-[11px] font-bold text-bodyx hover:underline"
            >
              Ir para a mensagem
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() =>
                  unpin.mutate({ conversationId, messageId: p.messageId })
                }
                className="rounded p-1 text-muted2 hover:text-red-400"
                aria-label="Remover fixação"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted2">
            {p.message
              ? `${
                  p.message.author.name ?? p.message.author.username
                }: ${p.message.content || "(anexo)"}`
              : "(mensagem não encontrada)"}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Invites tab ───────────────────────────────────────────────

function InvitesTab({ conversationId }: { conversationId: number }) {
  const utils = trpc.useUtils();
  const invites = trpc.group.listInvites.useQuery({ conversationId });
  const createInvite = trpc.group.createInvite.useMutation({
    onSuccess: async data => {
      const url = `${window.location.origin}${data.url}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link de convite copiado!");
      } catch {
        toast(`Convite criado: ${url}`);
      }
      await utils.group.listInvites.invalidate({ conversationId });
    },
    onError: e => toast.error(e.message),
  });
  const revoke = trpc.group.revokeInvite.useMutation({
    onSuccess: () => {
      toast.success("Convite revogado.");
      utils.group.listInvites.invalidate({ conversationId });
    },
    onError: e => toast.error(e.message),
  });

  const [expiry, setExpiry] = useState<"3600" | "86400" | "604800" | "null">("null");
  const [maxUses, setMaxUses] = useState<"1" | "5" | "10" | "null">("null");

  return (
    <div className="space-y-3 py-1">
      <p className="text-[11px] leading-relaxed text-muted2">
        Qualquer pessoa com o link poderá entrar no grupo após confirmar a entrada.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="invite-expiry" className="text-[11px]">Expiração</Label>
          <select
            id="invite-expiry"
            value={expiry}
            onChange={e => setExpiry(e.target.value as typeof expiry)}
            className="h-9 w-full rounded-lg border border-input bg-panel px-2 text-xs text-bodyx"
          >
            <option value="3600">1 hora</option>
            <option value="86400">24 horas</option>
            <option value="604800">7 dias</option>
            <option value="null">Nunca</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-uses" className="text-[11px]">Limite de usos</Label>
          <select
            id="invite-uses"
            value={maxUses}
            onChange={e => setMaxUses(e.target.value as typeof maxUses)}
            className="h-9 w-full rounded-lg border border-input bg-panel px-2 text-xs text-bodyx"
          >
            <option value="1">1 uso</option>
            <option value="5">5 usos</option>
            <option value="10">10 usos</option>
            <option value="null">Sem limite</option>
          </select>
        </div>
      </div>
      <Button
        className="w-full"
        disabled={createInvite.isPending}
        onClick={() =>
          createInvite.mutate({
            conversationId,
            expiresInSeconds:
              expiry === "null"
                ? null
                : (Number(expiry) as 3600 | 86400 | 604800),
            maxUses:
              maxUses === "null"
                ? null
                : (Number(maxUses) as 1 | 5 | 10),
          })
        }
      >
        <Link2 className="mr-1.5 h-4 w-4" /> Gerar link de convite
      </Button>

      <ul className="space-y-1.5">
        {(invites.data?.invites.length ?? 0) === 0 && (
          <li className="py-4 text-center text-xs text-muted2">
            Nenhum convite ativo.
          </li>
        )}
        {invites.data?.invites.map(inv => (
          <li
            key={inv.id}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-sidebar/60 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-bodyx">
                Convite #{String(inv.id).slice(-4)}
              </p>
              <p className="text-[10px] text-muted2">
                {inv.maxUses == null
                  ? `Sem limite · ${inv.uses} uso(s)`
                  : `${inv.uses}/${inv.maxUses} usos`}
                {" · "}
                {inv.expiresAt
                  ? `expira em ${new Date(inv.expiresAt).toLocaleDateString("pt-BR")}`
                  : "nunca expira"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Revogar este convite?")) {
                  revoke.mutate({ conversationId, inviteId: inv.id });
                }
              }}
              className="rounded p-1.5 text-muted2 hover:text-red-400"
              aria-label="Revogar convite"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Notification preferences ──────────────────────────────────

const MUTE_DURATIONS: Array<{ minutes: number | null; label: string }> = [
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hora" },
  { minutes: 480, label: "8 horas" },
  { minutes: 1440, label: "24 horas" },
  { minutes: 10080, label: "7 dias" },
  { minutes: null, label: "Até reativar" },
];

function NotificationPrefs({ conversationId }: { conversationId: number }) {
  const utils = trpc.useUtils();
  const details = trpc.dm.list.useQuery();
  const conv = details.data?.find(c => c.id === conversationId);
  const [level, setLevel] = useState(conv?.notificationLevel ?? "all");
  const [showDurations, setShowDurations] = useState(false);
  // Relógio estável para checar o snooze sem impuridade no render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const setNotifications = trpc.group.setNotifications.useMutation({
    onSuccess: () => {
      void utils.dm.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const mute = trpc.group.mute.useMutation({
    onSuccess: () => {
      void utils.dm.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  // Sincroniza quando os dados chegam/atualizam em background.
  const serverLevel = conv?.notificationLevel ?? "all";
  const [syncedFor, setSyncedFor] = useState(conversationId);
  if (syncedFor !== conversationId) {
    setSyncedFor(conversationId);
    setLevel(serverLevel);
    setShowDurations(false);
  }

  const snoozeActive =
    !!conv?.mutedUntil && new Date(conv.mutedUntil).getTime() > now;

  return (
    <div className="shrink-0 space-y-2 border-t border-white/10 pt-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-faint">
          Notificações
        </span>
        <div
          className="ml-auto flex gap-1"
          role="radiogroup"
          aria-label="Configuração de notificações"
        >
          {(["all", "mentions", "muted"] as const).map(lvl => (
            <button
              key={lvl}
              role="radio"
              aria-checked={level === lvl}
              onClick={() => {
                setLevel(lvl);
                setShowDurations(lvl === "muted");
                setNotifications.mutate({ conversationId, level: lvl });
                if (lvl === "muted") {
                  // Padrão ao silenciar direto: até reativar.
                  if (!snoozeActive) {
                    mute.mutate({ conversationId, minutes: null });
                  }
                }
              }}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors",
                level === lvl
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted2 hover:text-bodyx",
              )}
            >
              {lvl === "all" ? "Todas" : lvl === "mentions" ? "Menções" : "Silenciado"}
            </button>
          ))}
        </div>
      </div>

      {(snoozeActive || showDurations) && (
        <div>
          {snoozeActive && conv?.mutedUntil && !showDurations && (
            <p className="mb-1 text-right text-[10px] font-semibold text-muted2">
              Silenciado até{" "}
              {new Date(conv.mutedUntil).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {showDurations && (
            <div className="flex flex-wrap justify-end gap-1">
              {MUTE_DURATIONS.map(d => (
                <button
                  key={d.label}
                  onClick={() => {
                    mute.mutate({ conversationId, minutes: d.minutes });
                    setShowDurations(false);
                    toast.success(
                      d.minutes
                        ? `Silenciado por ${d.label.toLowerCase()}.`
                        : "Silenciado até você reativar."
                    );
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                    "bg-secondary text-muted2 hover:bg-primary/15 hover:text-primary",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Leave / transfer / delete ─────────────────────────────────

function LeaveControl({ conversationId }: { conversationId: number }) {
  const utils = trpc.useUtils();
  const leave = trpc.group.leave.useMutation({
    onSuccess: () => {
      toast.success("Você saiu do grupo.");
      utils.dm.list.invalidate();
      window.dispatchEvent(new CustomEvent("nexora:left-group"));
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
      disabled={leave.isPending}
      onClick={() => {
        if (
          window.confirm(
            "Sair do grupo?\n\nVocê deixará de receber novas mensagens.",
          )
        ) {
          leave.mutate({ conversationId });
        }
      }}
    >
      <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sair do grupo
    </Button>
  );
}

function TransferControl({
  conversationId,
  onDone,
}: {
  conversationId: number;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const details = trpc.group.get.useQuery({ conversationId });
  const [open, setOpen] = useState(false);
  const transfer = trpc.group.transferOwnership.useMutation({
    onSuccess: () => {
      toast.success("Propriedade transferida.");
      setOpen(false);
      utils.dm.list.invalidate();
      utils.group.get.invalidate({ conversationId });
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const candidates = (details.data?.members ?? []).filter(m => m.role !== "owner");

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Crown className="mr-1.5 h-3.5 w-3.5 text-[#FAA61A]" /> Transferir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Transferir propriedade</DialogTitle>
            <DialogDescription>
              Escolha o novo proprietário. Você continuará no grupo como administrador.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {candidates.length === 0 && (
              <li className="py-6 text-center text-xs text-muted2">
                Nenhum candidato.
              </li>
            )}
            {candidates.map(m => (
              <li key={m.user.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Transferir para ${
                          m.user.name ?? m.user.username
                        }?\n\nVocê deixará de ser o proprietário.`,
                      )
                    ) {
                      transfer.mutate({ conversationId, userId: m.user.id });
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-white/[0.05]"
                >
                  <Avatar
                    userId={m.user.id}
                    name={m.user.name ?? m.user.username}
                    src={m.user.avatar}
                    size="xs"
                  />
                  <span className="truncate">
                    {m.user.name ?? m.user.username ?? "Usuário"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteControl({
  conversationId,
  groupName,
}: {
  conversationId: number;
  groupName: string;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const del = trpc.group.delete.useMutation({
    onSuccess: () => {
      toast.success("Grupo excluído.");
      utils.dm.list.invalidate();
      window.dispatchEvent(new CustomEvent("nexora:left-group"));
    },
    onError: e => toast.error(e.message),
  });
  const matches = confirmText.trim() === groupName;

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-white/10 bg-sidebar text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o grupo e todas as mensagens para
              todos os participantes. Digite{" "}
              <strong className="text-white">{groupName || "o nome do grupo"}</strong>{" "}
              para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Nome do grupo"
            aria-label="Digite o nome do grupo para confirmar"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 text-white hover:bg-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              disabled={!matches || del.isPending}
              onClick={e => {
                e.preventDefault();
                del.mutate({ conversationId, confirmName: confirmText });
              }}
            >
              {del.isPending ? "Excluindo..." : "Excluir grupo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
