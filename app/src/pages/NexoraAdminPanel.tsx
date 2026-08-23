import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Archive,
  BadgeCheck,
  BellRing,
  Check,
  ChevronLeft,
  ClipboardList,
  Gem,
  LoaderCircle,
  LockKeyhole,
  Megaphone,
  Plus,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { NexoraAppIcon, NexoraLogo } from "@/components/NexoraBrand";
import { OfficialIdentity } from "@/components/official/OfficialIdentity";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { SafetySection } from "./admin/SafetySection";
import type {
  OfficialAnnouncementKind,
  PlatformBadgeDTO,
  PublicUser,
} from "@contracts/types";

type AdminSection = "broadcasts" | "badges" | "safety";

const kinds: Array<{
  id: OfficialAnnouncementKind;
  label: string;
  description: string;
  icon: typeof Megaphone;
}> = [
  { id: "GENERAL", label: "Comunicado", description: "Informação geral da plataforma", icon: Megaphone },
  { id: "UPDATE", label: "Novidade", description: "Produto, recurso ou melhoria", icon: Sparkles },
  { id: "SECURITY", label: "Segurança", description: "Alerta de conta e proteção", icon: ShieldAlert },
  { id: "MAINTENANCE", label: "Manutenção", description: "Disponibilidade e operação", icon: Wrench },
];

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function AdminNavButton({
  active,
  icon: Icon,
  label,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Megaphone;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-[#5865F2]/35 bg-[#5865F2]/15 text-white"
          : "border-transparent text-[#aeb4be] hover:border-white/[0.06] hover:bg-white/[0.035] hover:text-white",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-[#5865F2] text-white" : "bg-white/[0.045] text-[#9299a4]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold">{label}</span>
        <span className="block truncate text-[10px] text-[#7f8792]">{description}</span>
      </span>
    </button>
  );
}

function BroadcastsSection() {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<OfficialAnnouncementKind>("GENERAL");
  const [expiresAt, setExpiresAt] = useState("");
  const announcements = trpc.admin.listAnnouncements.useQuery({
    limit: 50,
    includeArchived: true,
  });
  const createAnnouncement = trpc.admin.createAnnouncement.useMutation({
    onSuccess: async () => {
      setTitle("");
      setContent("");
      setKind("GENERAL");
      setExpiresAt("");
      await Promise.all([
        utils.admin.listAnnouncements.invalidate(),
        utils.official.list.invalidate(),
        utils.official.unreadCount.invalidate(),
      ]);
      toast.success("Comunicado publicado para todos os usuários.");
    },
    onError: error => toast.error(error.message || "Não foi possível publicar o comunicado."),
  });
  const archiveAnnouncement = trpc.admin.archiveAnnouncement.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.listAnnouncements.invalidate(),
        utils.official.list.invalidate(),
        utils.official.unreadCount.invalidate(),
      ]);
      toast.success("Comunicado arquivado.");
    },
    onError: error => toast.error(error.message || "Não foi possível arquivar o comunicado."),
  });

  const selectedKind = kinds.find(item => item.id === kind) ?? kinds[0];
  const KindIcon = selectedKind.icon;
  const canPublish = title.trim().length >= 3 && content.trim().length >= 10;

  const publish = () => {
    if (!canPublish || createAnnouncement.isPending) return;
    createAnnouncement.mutate({
      title: title.trim(),
      content: content.trim(),
      kind,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(330px,0.85fr)]">
        <div className="rounded-xl border border-white/[0.075] bg-[#22252b]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-white">Novo comunicado global</h2>
              <p className="mt-0.5 text-[11px] text-[#8e959f]">Será entregue na conversa oficial de todas as contas.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#5865F2]/30 bg-[#5865F2]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#b7beff]">
              <ShieldCheck className="h-3 w-3" />
              Remetente verificado
            </span>
          </div>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="announcement-title" className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                Título
              </Label>
              <Input
                id="announcement-title"
                value={title}
                onChange={event => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Exemplo: Nova atualização disponível"
                className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white placeholder:text-[#68707b]"
              />
              <p className="text-right text-[10px] text-[#69717c]">{title.length}/120</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">Categoria</Label>
                <Select value={kind} onValueChange={value => setKind(value as OfficialAnnouncementKind)}>
                  <SelectTrigger className="h-10 w-full border-white/[0.08] bg-[#17191e] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/[0.08] bg-[#24262c] text-white">
                    {kinds.map(item => {
                      const Icon = item.icon;
                      return (
                        <SelectItem key={item.id} value={item.id}>
                          <Icon className="h-3.5 w-3.5" />
                          {item.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="announcement-expiry" className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                  Expiração opcional
                </Label>
                <Input
                  id="announcement-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={event => setExpiresAt(event.target.value)}
                  className="h-10 border-white/[0.08] bg-[#17191e] text-xs text-white [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="announcement-content" className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                Mensagem
              </Label>
              <Textarea
                id="announcement-content"
                value={content}
                onChange={event => setContent(event.target.value)}
                maxLength={5000}
                rows={8}
                placeholder="Escreva o comunicado com contexto claro, impacto e próximos passos."
                className="min-h-44 resize-y border-white/[0.08] bg-[#17191e] text-sm leading-6 text-white placeholder:text-[#68707b]"
              />
              <div className="flex items-center justify-between text-[10px] text-[#69717c]">
                <span>O conteúdo não aceita respostas dos usuários.</span>
                <span>{content.length}/5000</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
              <p className="flex items-center gap-1.5 text-[10px] text-[#858c96]">
                <LockKeyhole className="h-3.5 w-3.5" />
                A permissão é validada novamente pelo servidor.
              </p>
              <Button
                onClick={publish}
                disabled={!canPublish || createAnnouncement.isPending}
                className="bg-[#5865F2] px-4 text-white hover:bg-[#5664e6]"
              >
                {createAnnouncement.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publicar para todos
              </Button>
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-white/[0.075] bg-[#1c1e23] p-4" aria-label="Prévia do comunicado">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7f8792]">Prévia da entrega</p>
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#24262c] p-4 shadow-xl">
            <OfficialIdentity />
            <div className="ml-[52px] mt-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-[#5865F2]/30 bg-[#5865F2]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#b8c0ff]">
                <KindIcon className="h-3 w-3" />
                {selectedKind.label}
              </span>
              <h3 className="mt-2 break-words text-sm font-bold text-white">{title.trim() || "Título do comunicado"}</h3>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-[#b7bdc6]">
                {content.trim() || "A mensagem oficial aparecerá aqui exatamente como será entregue aos usuários."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#f0a64a]/20 bg-[#f0a64a]/[0.06] px-3 py-2.5">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f1b462]" />
            <p className="text-[10px] leading-4 text-[#9da4ae]">
              Confira links, datas e instruções antes de publicar. O envio fica registrado na auditoria administrativa.
            </p>
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#22252b]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-white">Histórico de comunicados</h2>
            <p className="mt-0.5 text-[10px] text-[#858c96]">Publicações ativas e arquivadas.</p>
          </div>
          <span className="rounded-md bg-white/[0.045] px-2 py-1 text-[10px] font-semibold text-[#9ca3ad]">
            {announcements.data?.items.length ?? 0} registros
          </span>
        </div>
        {announcements.isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#858c96]">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-xs">Carregando histórico...</span>
          </div>
        ) : announcements.data?.items.length ? (
          <div className="divide-y divide-white/[0.055]">
            {announcements.data.items.map(item => {
              const presentation = kinds.find(entry => entry.id === item.kind) ?? kinds[0];
              const Icon = presentation.icon;
              return (
                <article key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-[#9ca4b0]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-xs font-bold text-[#f0f1f3]">{item.title}</h3>
                      <span
                        className={cn(
                          "rounded-[4px] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                          item.isActive
                            ? "bg-[#39a768]/15 text-[#67cc90]"
                            : "bg-white/[0.055] text-[#7f8792]",
                        )}
                      >
                        {item.isActive ? "Ativo" : "Arquivado"}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#969da7]">{item.content}</p>
                    <p className="mt-1 text-[9px] text-[#68707b]">Publicado em {formatDate(item.publishedAt)}</p>
                  </div>
                  {item.isActive && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Arquivar comunicado"
                      aria-label={`Arquivar ${item.title}`}
                      onClick={() => archiveAnnouncement.mutate({ announcementId: item.id })}
                      disabled={archiveAnnouncement.isPending}
                      className="text-[#969da7] hover:bg-[#ed4245]/10 hover:text-[#ff8c8f]"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-12 text-center text-xs text-[#858c96]">Nenhum comunicado publicado ainda.</p>
        )}
      </section>
    </div>
  );
}

function BadgeChip({ badge }: { badge: PlatformBadgeDTO }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold"
      style={{ borderColor: `${badge.color}55`, backgroundColor: `${badge.color}18`, color: badge.color }}
      title={badge.description ?? badge.label}
    >
      {badge.isStaff ? <ShieldCheck className="h-3 w-3" /> : <Gem className="h-3 w-3" />}
      {badge.label}
    </span>
  );
}

function UserSearchResult({ user, selected, onSelect }: { user: PublicUser; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-[#5865F2]/40 bg-[#5865F2]/15"
          : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.035]",
      )}
    >
      <Avatar userId={user.id} name={user.name ?? user.username} src={user.avatar} size="sm" showStatus={false} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-white">{user.name ?? user.username ?? `Usuário ${user.id}`}</span>
        <span className="block truncate text-[10px] text-[#7f8792]">@{user.username ?? "sem-usuario"} · ID {user.id}</span>
      </span>
      {selected && <Check className="h-4 w-4 text-[#8e9aff]" />}
    </button>
  );
}

function BadgesSection({ canManageStaffBadges }: { canManageStaffBadges: boolean }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("shield-check");
  const [color, setColor] = useState("#7383FF");
  const [isStaff, setIsStaff] = useState(false);

  const badges = trpc.admin.listBadges.useQuery();
  const userResults = trpc.admin.searchUsers.useQuery(
    { query: debouncedSearch, limit: 12 },
    { enabled: debouncedSearch.length >= 2 },
  );
  const userBadges = trpc.admin.listUserBadges.useQuery(
    { userId: selectedUser?.id ?? 0 },
    { enabled: !!selectedUser },
  );

  const assignedIds = useMemo(
    () => new Set(userBadges.data?.map(badge => badge.id) ?? []),
    [userBadges.data],
  );

  const createBadge = trpc.admin.createBadge.useMutation({
    onSuccess: async () => {
      setSlug("");
      setLabel("");
      setDescription("");
      setIcon("shield-check");
      setColor("#7383FF");
      setIsStaff(false);
      await utils.admin.listBadges.invalidate();
      toast.success("Emblema criado.");
    },
    onError: error => toast.error(error.message || "Não foi possível criar o emblema."),
  });
  const assignBadge = trpc.admin.assignBadge.useMutation({
    onSuccess: async () => {
      await utils.admin.listUserBadges.invalidate();
      if (selectedUser) await utils.badge.forUser.invalidate({ userId: selectedUser.id });
      toast.success("Emblema atribuído.");
    },
    onError: error => toast.error(error.message || "Não foi possível atribuir o emblema."),
  });
  const unassignBadge = trpc.admin.unassignBadge.useMutation({
    onSuccess: async () => {
      await utils.admin.listUserBadges.invalidate();
      if (selectedUser) await utils.badge.forUser.invalidate({ userId: selectedUser.id });
      toast.success("Emblema removido.");
    },
    onError: error => toast.error(error.message || "Não foi possível remover o emblema."),
  });

  const submitBadge = () => {
    if (!slug.trim() || !label.trim()) return;
    createBadge.mutate({
      slug: slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      label: label.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      color,
      isStaff,
    });
  };

  const toggleBadge = (badge: PlatformBadgeDTO) => {
    if (!selectedUser) return;
    if (assignedIds.has(badge.id)) {
      unassignBadge.mutate({ userId: selectedUser.id, badgeId: badge.id });
    } else {
      assignBadge.mutate({ userId: selectedUser.id, badgeId: badge.id });
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.72fr)_minmax(440px,1.28fr)]">
      <div className="space-y-5">
        <section className="rounded-xl border border-white/[0.075] bg-[#22252b]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-sm font-bold text-white">Criar emblema</h2>
            <p className="mt-0.5 text-[10px] text-[#858c96]">Definições reutilizáveis para perfis Nexora.</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="badge-label" className="text-[10px] font-bold uppercase tracking-wide text-[#aeb4be]">Nome</Label>
                <Input
                  id="badge-label"
                  value={label}
                  onChange={event => {
                    setLabel(event.target.value);
                    if (!slug) {
                      setSlug(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, ""),
                      );
                    }
                  }}
                  maxLength={64}
                  className="border-white/[0.08] bg-[#17191e] text-xs text-white"
                  placeholder="Staff Nexora"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="badge-slug" className="text-[10px] font-bold uppercase tracking-wide text-[#aeb4be]">Identificador</Label>
                <Input
                  id="badge-slug"
                  value={slug}
                  onChange={event => setSlug(event.target.value)}
                  maxLength={48}
                  className="border-white/[0.08] bg-[#17191e] text-xs text-white"
                  placeholder="staff-nexora"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="badge-description" className="text-[10px] font-bold uppercase tracking-wide text-[#aeb4be]">Descrição</Label>
              <Input
                id="badge-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                maxLength={255}
                className="border-white/[0.08] bg-[#17191e] text-xs text-white"
                placeholder="Membro da equipe oficial Nexora"
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="badge-icon" className="text-[10px] font-bold uppercase tracking-wide text-[#aeb4be]">Ícone semântico</Label>
                <Input
                  id="badge-icon"
                  value={icon}
                  onChange={event => setIcon(event.target.value)}
                  maxLength={64}
                  className="border-white/[0.08] bg-[#17191e] text-xs text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="badge-color" className="text-[10px] font-bold uppercase tracking-wide text-[#aeb4be]">Cor</Label>
                <Input
                  id="badge-color"
                  type="color"
                  value={color}
                  onChange={event => setColor(event.target.value)}
                  className="h-9 w-14 cursor-pointer border-white/[0.08] bg-[#17191e] p-1"
                />
              </div>
            </div>
            <label className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5", canManageStaffBadges ? "cursor-pointer border-white/[0.07] bg-[#191b20]" : "border-white/[0.04] bg-[#191b20]/50 opacity-55")}>
              <input
                type="checkbox"
                checked={isStaff}
                onChange={event => setIsStaff(event.target.checked)}
                disabled={!canManageStaffBadges}
                className="mt-0.5 h-4 w-4 accent-[#5865F2]"
              />
              <span>
                <span className="block text-[11px] font-semibold text-white">Emblema de equipe oficial</span>
                <span className="block text-[9px] leading-4 text-[#7f8792]">
                  Somente o proprietário da plataforma pode criar ou atribuir emblemas de staff.
                </span>
              </span>
            </label>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
              <BadgeChip
                badge={{ id: 0, slug: slug || "preview", label: label || "Prévia", description: description || null, icon, color, isStaff }}
              />
              <Button
                size="sm"
                onClick={submitBadge}
                disabled={!slug.trim() || !label.trim() || createBadge.isPending}
                className="bg-[#5865F2] text-white hover:bg-[#5664e6]"
              >
                {createBadge.isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Criar
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.075] bg-[#22252b]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-sm font-bold text-white">Emblemas disponíveis</h2>
            <p className="mt-0.5 text-[10px] text-[#858c96]">{badges.data?.length ?? 0} definições cadastradas.</p>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {badges.isLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-[#858c96]" />
            ) : badges.data?.length ? (
              badges.data.map(badge => <BadgeChip key={badge.id} badge={badge} />)
            ) : (
              <p className="text-xs text-[#858c96]">Crie o primeiro emblema da plataforma.</p>
            )}
          </div>
        </section>
      </div>

      <section className="min-h-[580px] rounded-xl border border-white/[0.075] bg-[#22252b]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-sm font-bold text-white">Atribuir emblemas</h2>
          <p className="mt-0.5 text-[10px] text-[#858c96]">Pesquise a conta e escolha os emblemas visíveis no perfil.</p>
        </div>
        <div className="grid min-h-[526px] md:grid-cols-[minmax(220px,0.8fr)_minmax(260px,1.2fr)]">
          <div className="border-b border-white/[0.06] p-3 md:border-b-0 md:border-r">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6e7681]" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Nome ou usuário"
                className="border-white/[0.08] bg-[#17191e] pl-9 text-xs text-white"
              />
            </div>
            <div className="mt-3 space-y-1">
              {userResults.isFetching ? (
                <p className="flex items-center gap-2 px-2 py-3 text-[11px] text-[#858c96]"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Buscando...</p>
              ) : debouncedSearch.length < 2 ? (
                <p className="px-2 py-3 text-[11px] leading-5 text-[#727a85]">Digite ao menos dois caracteres para encontrar uma conta.</p>
              ) : userResults.data?.length ? (
                userResults.data.map(user => (
                  <UserSearchResult key={user.id} user={user} selected={selectedUser?.id === user.id} onSelect={() => setSelectedUser(user)} />
                ))
              ) : (
                <p className="px-2 py-3 text-[11px] text-[#858c96]">Nenhuma conta encontrada.</p>
              )}
            </div>
          </div>

          <div className="p-4">
            {selectedUser ? (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-[#191b20] p-3">
                  <Avatar userId={selectedUser.id} name={selectedUser.name ?? selectedUser.username} src={selectedUser.avatar} size="lg" showStatus={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{selectedUser.name ?? selectedUser.username}</p>
                    <p className="truncate text-[10px] text-[#7f8792]">@{selectedUser.username ?? "sem-usuario"} · ID {selectedUser.id}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSelectedUser(null)} title="Limpar seleção" className="text-[#858c96] hover:bg-white/[0.06] hover:text-white">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7f8792]">Emblemas do perfil</p>
                  {userBadges.isLoading || badges.isLoading ? (
                    <div className="flex items-center gap-2 py-8 text-xs text-[#858c96]"><LoaderCircle className="h-4 w-4 animate-spin" />Carregando...</div>
                  ) : badges.data?.length ? (
                    <div className="mt-2 space-y-1.5">
                      {badges.data.map(badge => {
                        const isAssigned = assignedIds.has(badge.id);
                        const lockedStaff = badge.isStaff && !canManageStaffBadges;
                        return (
                          <button
                            key={badge.id}
                            type="button"
                            disabled={lockedStaff || assignBadge.isPending || unassignBadge.isPending}
                            onClick={() => toggleBadge(badge)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                              isAssigned
                                ? "border-[#5865F2]/35 bg-[#5865F2]/10"
                                : "border-white/[0.06] bg-[#191b20] hover:border-white/[0.12] hover:bg-white/[0.035]",
                            )}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${badge.color}18`, color: badge.color }}>
                              {badge.isStaff ? <ShieldCheck className="h-4 w-4" /> : <Gem className="h-4 w-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                {badge.label}
                                {badge.isStaff && <span className="rounded bg-[#f0a64a]/15 px-1 py-0.5 text-[8px] uppercase text-[#f0b86e]">Staff</span>}
                              </span>
                              <span className="block truncate text-[10px] text-[#7f8792]">{badge.description || badge.slug}</span>
                            </span>
                            <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", isAssigned ? "border-[#7383FF] bg-[#5865F2] text-white" : "border-white/[0.15] text-transparent")}>
                              <Check className="h-3 w-3" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#858c96]">Crie uma definição de emblema primeiro.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035] text-[#747c87]">
                  <UserRoundCog className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">Selecione uma conta</h3>
                <p className="mt-1 max-w-xs text-[11px] leading-5 text-[#7f8792]">Os emblemas atribuídos aparecem no perfil público e no mini perfil do usuário.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function NexoraAdminPanel() {
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("broadcasts");
  const authority = trpc.admin.authority.useQuery();

  if (authority.isLoading) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-[#1b1d22] text-[#9aa1ab]" aria-busy="true">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-xs">Validando acesso seguro...</span>
      </main>
    );
  }

  if (!authority.data?.canAccess) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-[#1b1d22] p-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/[0.075] bg-[#22252b] p-7 shadow-2xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ed4245]/25 bg-[#ed4245]/10 text-[#ff8588]">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-white">Acesso administrativo restrito</h1>
          <p className="mt-2 text-xs leading-5 text-[#969da7]">
            Esta área exige uma conta autorizada pela configuração segura do servidor Nexora.
          </p>
          <Button onClick={() => navigate("/channels/@me")} className="mt-5 bg-[#5865F2] text-white hover:bg-[#5664e6]">
            <ChevronLeft className="h-4 w-4" />
            Voltar ao aplicativo
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 bg-[#1b1d22]" aria-label="Painel administrativo Nexora">
      <aside className="hidden w-[238px] shrink-0 flex-col border-r border-black/25 bg-[#1f2126] lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-white/[0.055] px-4">
          <NexoraLogo className="h-5 w-[112px]" />
        </div>
        <div className="flex-1 space-y-1 p-3">
          <p className="px-2 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#69717c]">Plataforma</p>
          <AdminNavButton active={section === "broadcasts"} icon={Megaphone} label="Comunicados" description="Mensagens oficiais globais" onClick={() => setSection("broadcasts")} />
          <AdminNavButton active={section === "badges"} icon={BadgeCheck} label="Emblemas" description="Identidade e equipe" onClick={() => setSection("badges")} />
          <AdminNavButton active={section === "safety"} icon={ShieldAlert} label="Segurança" description="Moderação de conteúdo" onClick={() => setSection("safety")} />
          <div className="my-3 h-px bg-white/[0.055]" />
          <div className="rounded-lg border border-white/[0.055] bg-[#191b20] p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#bdc2ca]">
              <Shield className="h-3.5 w-3.5 text-[#8e9aff]" />
              Sessão protegida
            </div>
            <p className="mt-1.5 text-[9px] leading-4 text-[#69717c]">Acesso e ações são validados no backend e registrados para auditoria.</p>
          </div>
        </div>
        <div className="border-t border-white/[0.055] p-3">
          <Button variant="ghost" onClick={() => navigate("/channels/@me/official")} className="w-full justify-start text-xs text-[#9da4ae] hover:bg-white/[0.045] hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            Voltar aos comunicados
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-black/25 bg-[#202228] px-4 sm:px-6">
          <div className="lg:hidden">
            <NexoraAppIcon className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-white">Painel Nexora</h1>
            <p className="truncate text-[10px] text-[#7f8792]">
              {authority.data.authority === "owner" ? "Proprietário da plataforma" : "Administrador da plataforma"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-[#5865F2]/25 bg-[#5865F2]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#b7beff]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso verificado
          </div>
        </header>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.055] bg-[#1f2126] px-3 py-2 lg:hidden" aria-label="Seções administrativas">
          <Button size="sm" variant="ghost" onClick={() => setSection("broadcasts")} className={cn("text-xs", section === "broadcasts" ? "bg-[#5865F2]/15 text-white" : "text-[#9da4ae]")}>
            <Megaphone className="h-3.5 w-3.5" />Comunicados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSection("badges")} className={cn("text-xs", section === "badges" ? "bg-[#5865F2]/15 text-white" : "text-[#9da4ae]")}>
            <BadgeCheck className="h-3.5 w-3.5" />Emblemas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/channels/@me/official")} className="ml-auto text-xs text-[#9da4ae]">
            <ChevronLeft className="h-3.5 w-3.5" />Sair
          </Button>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#737b86]">
                  {section === "broadcasts" ? <BellRing className="h-3 w-3" /> : <UsersRound className="h-3 w-3" />}
                  Administração da plataforma
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-[#f4f5f7]">
                  {section === "broadcasts"
                    ? "Comunicados oficiais"
                    : section === "badges"
                      ? "Emblemas de perfil"
                      : "Segurança e moderação"}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[#858c96]">
                  {section === "broadcasts"
                    ? "Publique avisos globais em nome da conta verificada Nexora e acompanhe o histórico."
                    : "Crie emblemas e atribua identidade oficial às contas autorizadas."}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.065] bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-[#8f96a1]">
                <ClipboardList className="h-3.5 w-3.5" />
                Ações auditadas
              </span>
            </div>
            {section === "broadcasts" ? (
              <BroadcastsSection />
            ) : section === "badges" ? (
              <BadgesSection canManageStaffBadges={authority.data.canManageStaffBadges} />
            ) : (
              <SafetySection />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
