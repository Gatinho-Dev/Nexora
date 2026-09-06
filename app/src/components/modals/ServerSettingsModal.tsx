import { useDeferredValue, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  Copy,
  Plus,
  Trash2,
  Shield,
  Ban,
  UserMinus,
  Crown,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  FileClock,
  ImagePlus,
  Link2,
  LockKeyhole,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { ServerDetailsDTO, RoleDTO } from "@contracts/types";
import { PERMISSIONS, type Permission } from "@contracts/constants";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { apiUrl } from "@/lib/endpoints";

const PERMISSION_LABELS: Record<Permission, string> = {
  ADMINISTRATOR: "Administrador",
  VIEW_CHANNEL: "Ver canal",
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
  KICK_MEMBERS:
    "Remover membros do servidor (eles podem voltar com um convite).",
  BAN_MEMBERS: "Banir membros permanentemente.",
  MANAGE_MESSAGES: "Excluir mensagens de outros membros.",
  CONNECT: "Entrar em canais de voz.",
  SPEAK: "Usar o microfone em canais de voz.",
  STREAM: "Usar câmera e compartilhar a tela.",
};

type Tab =
  | "overview"
  | "roles"
  | "members"
  | "invites"
  | "access"
  | "moderation"
  | "audit"
  | "notifications"
  | "danger"
  | "permissions"
  | "integrations";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(true);
  const [navQuery, setNavQuery] = useState("");
  const { server, myPermissions } = details;
  const isOwner = trpc.auth.me.useQuery().data?.id === server.ownerId;
  const canManageServer = myPermissions.includes("MANAGE_SERVER");
  const canManageRoles = myPermissions.includes("MANAGE_ROLES");
  const canKick = myPermissions.includes("KICK_MEMBERS");
  const canBan = myPermissions.includes("BAN_MEMBERS");

  const tabs: { id: Tab; label: string; group: string; icon: typeof Settings2; visible: boolean; danger?: boolean }[] = [
    { id: "overview", label: "Perfil do servidor", group: "Servidor", icon: Settings2, visible: canManageServer },
    { id: "roles", label: "Cargos", group: "Pessoas", icon: ShieldCheck, visible: canManageRoles },
    {
      id: "members",
      label: "Membros",
      group: "Pessoas",
      icon: Users,
      visible: canKick || canBan || canManageRoles,
    },
    { id: "invites", label: "Convites", group: "Acesso", icon: Link2, visible: canManageServer },
    { id: "access", label: "Entrada e regras", group: "Acesso", icon: BookOpenCheck, visible: canManageServer },
    { id: "permissions", label: "Permissões de canais", group: "Acesso", icon: LockKeyhole, visible: canManageServer },
    { id: "moderation", label: "Segurança e AutoMod", group: "Segurança", icon: Shield, visible: canBan || canManageServer },
    { id: "audit", label: "Registro de auditoria", group: "Segurança", icon: FileClock, visible: canManageServer },
    { id: "integrations", label: "Integrações", group: "Aplicativos", icon: SlidersHorizontal, visible: canManageServer },
    { id: "notifications", label: "Notificações", group: "Pessoal", icon: Bell, visible: true },
    { id: "danger", label: "Transferir ou excluir", group: "Servidor", icon: UserCog, visible: isOwner, danger: true },
  ];
  const visibleTabs = tabs.filter(t => t.visible && t.label.toLowerCase().includes(navQuery.trim().toLowerCase()));
  const activeTab = visibleTabs.some(t => t.id === tab)
    ? tab
    : tabs.find(t => t.visible && t.id === tab)?.id ?? tabs.find(t => t.visible)?.id;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setMobileNavOpen(true);
    onOpenChange(nextOpen);
  };

  const groups = [...new Set(visibleTabs.map(item => item.group))];
  const activeLabel = tabs.find(item => item.id === activeTab)?.label ?? "Configurações";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!inset-0 !top-0 !left-0 !h-[100dvh] !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !gap-0 !overflow-hidden !rounded-none !border-0 bg-[#11131a] !p-0 !shadow-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
      >
        <DialogTitle className="sr-only">Configurações do servidor</DialogTitle>
        <div className="flex h-full min-h-0 bg-[#11131a] text-slate-100">
          <aside
            className={cn(
              "w-full shrink-0 border-r border-white/[0.06] bg-[#181b23] md:block md:w-[292px]",
              !mobileNavOpen && "hidden",
            )}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-white/[0.06] px-5 pb-4 pt-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#4654d8] text-sm font-bold shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]">
                    {server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover" /> : server.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{server.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Configurações do servidor</p>
                  </div>
                  <button type="button" onClick={() => onOpenChange(false)} className="ml-auto grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label="Fechar configurações">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <Input value={navQuery} onChange={event => setNavQuery(event.target.value)} placeholder="Buscar configurações" className="h-9 border-white/[0.07] bg-black/20 pl-9 text-sm" />
                </div>
              </div>
              <ScrollArea key={mobileNavOpen ? "navigation-open" : "navigation-collapsed"} className="min-h-0 flex-1">
                <nav className="space-y-5 p-3" aria-label="Configurações do servidor">
                  {groups.map(group => (
                    <div key={group}>
                      <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{group}</p>
                      <div className="space-y-0.5">
                        {visibleTabs.filter(item => item.group === group).map(item => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setTab(item.id); setMobileNavOpen(false); }}
                              className={cn(
                                "group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383ff]",
                                activeTab === item.id ? "bg-[#4654d8]/18 text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
                                item.danger && "text-rose-400 hover:text-rose-300",
                              )}
                            >
                              <Icon className={cn("size-[17px]", activeTab === item.id && "text-[#8290ff]")} />
                              <span className="truncate">{item.label}</span>
                              <ChevronRight className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-60 md:hidden" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {visibleTabs.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma configuração encontrada.</p>}
                </nav>
              </ScrollArea>
              <div className="border-t border-white/[0.06] p-4 text-xs leading-5 text-slate-500">
                Alterações administrativas são validadas no servidor e registradas para auditoria.
              </div>
            </div>
          </aside>
          <section className={cn("min-w-0 flex-1 bg-[#11131a]", mobileNavOpen && "hidden md:block")}>
            <header className="flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#14171e]/95 px-4 backdrop-blur md:px-8">
              <button type="button" onClick={() => setMobileNavOpen(true)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white md:hidden" aria-label="Voltar para categorias">
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <p className="text-sm font-semibold text-white">{activeLabel}</p>
                <p className="hidden text-xs text-slate-500 sm:block">{server.name}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 rounded-full border border-[#7383ff]/20 bg-[#4654d8]/10 px-3 py-1.5 text-[11px] font-semibold text-[#aab2ff]">
                <ShieldCheck className="size-3.5" />
                Acesso verificado
              </div>
              <button type="button" onClick={() => onOpenChange(false)} className="hidden size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white md:grid" aria-label="Fechar configurações">
                <X className="size-5" />
              </button>
            </header>
            <div className="h-[calc(100dvh-4rem)] min-h-0">
            <ScrollArea className="h-full">
              <div className="mx-auto w-full max-w-[1180px] p-4 pb-28 sm:p-7 lg:p-10">
                {activeTab === "overview" && <OverviewTab details={details} />}
                {activeTab === "permissions" && <PermissionsTab details={details} />}
                {activeTab === "integrations" && <IntegrationsTab details={details} />}
                {activeTab === "roles" && <RolesTab details={details} />}
                {activeTab === "members" && (
                  <MembersTab
                    details={details}
                    canKick={canKick}
                    canBan={canBan}
                    canManageRoles={canManageRoles}
                  />
                )}
                {activeTab === "invites" && <InvitesTab details={details} />}
                {activeTab === "access" && <AccessTab details={details} />}
                {activeTab === "moderation" && (
                  <ModerationTab serverId={server.id} />
                )}
                {activeTab === "audit" && <AuditTab serverId={server.id} />}
                {activeTab === "notifications" && <NotificationsTab serverId={server.id} />}
                {activeTab === "danger" && (
                  <DangerTab
                    details={details}
                    onClose={() => onOpenChange(false)}
                  />
                )}
              </div>
            </ScrollArea>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PageIntro({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8290ff]">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-[28px]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function SettingsPanel({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-white/[0.07] bg-[#181b23]", className)}>
      <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-white">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, hint, counter, children }: { label: string; hint?: string; counter?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4"><Label className="text-xs font-semibold text-slate-300">{label}</Label>{counter && <span className="text-[11px] tabular-nums text-slate-500">{counter}</span>}</div>
      {children}
      {hint && <p className="text-[11px] leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Visão geral ───────────────────────────────────────────────
function OverviewTab({ details }: { details: ServerDetailsDTO }) {
  const utils = trpc.useUtils();
  const iconInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(details.server.name);
  const [description, setDescription] = useState(details.server.description ?? "");
  const [icon, setIcon] = useState(details.server.iconUrl ?? "");
  const [banner, setBanner] = useState(details.server.bannerUrl ?? "");
  const [vanity, setVanity] = useState(details.server.vanitySlug ?? "");
  const [tagsText, setTagsText] = useState((details.server.tags ?? []).join(", "));
  const [defaultNotifications, setDefaultNotifications] = useState(details.server.defaultNotifications ?? "all");
  const [uploading, setUploading] = useState<"icon" | "banner" | null>(null);

  const dirty = name !== details.server.name
    || description !== (details.server.description ?? "")
    || icon !== (details.server.iconUrl ?? "")
    || banner !== (details.server.bannerUrl ?? "")
    || vanity !== (details.server.vanitySlug ?? "")
    || tagsText !== (details.server.tags ?? []).join(", ")
    || defaultNotifications !== (details.server.defaultNotifications ?? "all");

  const reset = () => {
    setName(details.server.name);
    setDescription(details.server.description ?? "");
    setIcon(details.server.iconUrl ?? "");
    setBanner(details.server.bannerUrl ?? "");
    setVanity(details.server.vanitySlug ?? "");
    setTagsText((details.server.tags ?? []).join(", "));
    setDefaultNotifications(details.server.defaultNotifications ?? "all");
  };

  const uploadMedia = async (file: File, kind: "icon" | "banner") => {
    if (!file.type.startsWith("image/")) return toast.error("Escolha uma imagem válida.");
    if (file.size > 8 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 8 MB.");
    setUploading(kind);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(apiUrl("/api/upload"), { method: "POST", body: form, credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha no upload.");
      if (kind === "icon") setIcon(data.url);
      else setBanner(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload.");
    } finally {
      setUploading(null);
    }
  };

  const update = trpc.server.update.useMutation({
    onSuccess: async () => {
      toast.success("Servidor atualizado.");
      await Promise.all([
        utils.server.get.invalidate({ serverId: details.server.id }),
        utils.server.list.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message),
  });

  const save = () => update.mutate({
    serverId: details.server.id,
    name: name.trim() || details.server.name,
    iconUrl: icon || null,
    bannerUrl: banner || null,
    vanitySlug: vanity.trim() || null,
    description: description.trim() || null,
    tags: tagsText.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 5),
    defaultNotifications,
  });

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Identidade" title="Perfil do servidor" description="Controle como o servidor aparece para membros e em links de convite. As alterações só são publicadas quando você salvar." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <SettingsPanel title="Identidade visual" description="Use imagens próprias em formato PNG, JPG ou WebP.">
            <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
              <div className="space-y-3">
                <Label>Ícone do servidor</Label>
                <button type="button" onClick={() => iconInput.current?.click()} className="group relative grid size-32 place-items-center overflow-hidden rounded-[32px] border border-white/10 bg-[#20242d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383ff]">
                  {icon ? <img src={icon} alt="Prévia do ícone" className="h-full w-full object-cover" /> : <ImagePlus className="size-7 text-slate-500" />}
                  <span className="absolute inset-0 grid place-items-center bg-black/60 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100">{uploading === "icon" ? "Enviando" : "Alterar"}</span>
                </button>
                <input ref={iconInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => event.target.files?.[0] && uploadMedia(event.target.files[0], "icon")} />
                {icon && <Button type="button" size="sm" variant="ghost" className="text-slate-400" onClick={() => setIcon("")}>Remover ícone</Button>}
              </div>
              <div className="space-y-4">
                <Field label="Nome do servidor" counter={`${name.length}/100`}>
                  <Input id="srv-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} />
                </Field>
                <Field label="Descrição" counter={`${description.length}/500`}>
                  <Textarea id="srv-desc" value={description} onChange={event => setDescription(event.target.value)} maxLength={500} rows={5} placeholder="Explique o propósito e o tom da comunidade." />
                </Field>
              </div>
            </div>
            <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-6">
              <div className="flex items-center justify-between gap-4"><Label>Banner do servidor</Label><span className="text-xs text-slate-500">Recomendado: 1200 × 480</span></div>
              <button type="button" onClick={() => bannerInput.current?.click()} className="group relative h-44 w-full overflow-hidden rounded-2xl border border-dashed border-white/15 bg-[#20242d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383ff]">
                {banner ? <img src={banner} alt="Prévia do banner" className="h-full w-full object-cover" /> : <span className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-400"><Upload className="size-5" />Enviar banner</span>}
                {banner && <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100">{uploading === "banner" ? "Enviando" : "Substituir banner"}</span>}
              </button>
              <input ref={bannerInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => event.target.files?.[0] && uploadMedia(event.target.files[0], "banner")} />
              {banner && <Button type="button" size="sm" variant="ghost" onClick={() => setBanner("")}>Remover banner</Button>}
            </div>
          </SettingsPanel>

          <SettingsPanel title="Descoberta e comunicação" description="Informações usadas em convites e na experiência padrão dos membros.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Link personalizado" hint="De 3 a 32 caracteres, letras minúsculas, números e hífen.">
                <div className="flex items-center rounded-md border border-input bg-black/15 pl-3 focus-within:ring-2 focus-within:ring-ring"><span className="text-xs text-slate-500">/invite/</span><Input id="srv-vanity" value={vanity} onChange={event => setVanity(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="meu-servidor" maxLength={32} className="border-0 bg-transparent focus-visible:ring-0" /></div>
              </Field>
              <Field label="Tags" hint="Até 5, separadas por vírgula.">
                <Input value={tagsText} onChange={event => setTagsText(event.target.value)} placeholder="jogos, estudos, comunidade" />
              </Field>
              <Field label="Notificações padrão">
                <Select value={defaultNotifications} onValueChange={value => setDefaultNotifications(value as typeof defaultNotifications)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as mensagens</SelectItem><SelectItem value="mentions">Somente menções</SelectItem></SelectContent></Select>
              </Field>
            </div>
          </SettingsPanel>
        </div>

        <aside className="xl:sticky xl:top-0 xl:self-start">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Prévia do convite</p>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c2029] shadow-[0_18px_50px_rgba(0,0,0,.25)]">
            <div className="h-28 bg-[#252a35]">{banner && <img src={banner} alt="" className="h-full w-full object-cover" />}</div>
            <div className="relative p-5 pt-11"><div className="absolute -top-8 left-5 grid size-16 place-items-center overflow-hidden rounded-[20px] border-4 border-[#1c2029] bg-[#4654d8] font-bold">{icon ? <img src={icon} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}</div><p className="text-base font-semibold text-white">{name || "Servidor sem nome"}</p><p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-400">{description || "Adicione uma descrição para apresentar sua comunidade."}</p><div className="mt-4 flex flex-wrap gap-1.5">{tagsText.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 5).map(tag => <span key={tag} className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-slate-300">{tag}</span>)}</div><div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><span className="size-2 rounded-full bg-emerald-400" />{details.members.length} membros carregados</div></div>
          </div>
        </aside>
      </div>

      {dirty && (
        <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-white/10 bg-[#20242d]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-xl sm:bottom-6 sm:px-4">
          <div className="hidden size-9 place-items-center rounded-xl bg-[#4654d8]/15 text-[#8290ff] sm:grid"><Save className="size-4" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Alterações não salvas</p><p className="hidden text-xs text-slate-400 sm:block">Revise a prévia antes de publicar.</p></div>
          <Button variant="ghost" onClick={reset} disabled={update.isPending}>Descartar</Button>
          <Button onClick={save} disabled={update.isPending || uploading !== null || !name.trim()}>{update.isPending ? "Salvando" : "Salvar"}</Button>
        </div>
      )}
    </div>
  );
}

// ── Cargos ────────────────────────────────────────────────────
function RolesTab({ details }: { details: ServerDetailsDTO }) {
  const utils = trpc.useUtils();
  const serverId = details.server.id;
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(
    details.roles[0]?.id ?? null
  );
  const [newRoleName, setNewRoleName] = useState("");
  const selectedRole = details.roles.find(r => r.id === selectedRoleId) ?? null;

  const invalidate = () => utils.server.get.invalidate({ serverId });

  const createRole = trpc.server.createRole.useMutation({
    onSuccess: () => {
      setNewRoleName("");
      toast.success("Cargo criado.");
      invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const updateRole = trpc.server.updateRole.useMutation({
    onSuccess: () => invalidate(),
    onError: e => toast.error(e.message),
  });
  const deleteRole = trpc.server.deleteRole.useMutation({
    onSuccess: () => {
      setSelectedRoleId(null);
      toast.success("Cargo excluído.");
      invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const reorderRoles = trpc.server.reorderRoles.useMutation({
    onSuccess: () => {
      toast.success("Ordem dos cargos atualizada.");
      invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const movableRoles = details.roles.filter(role => !role.isDefault);
  const moveRole = (roleId: number, direction: -1 | 1) => {
    const currentIndex = movableRoles.findIndex(role => role.id === roleId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= movableRoles.length) return;
    const roleIds = movableRoles.map(role => role.id);
    [roleIds[currentIndex], roleIds[nextIndex]] = [roleIds[nextIndex], roleIds[currentIndex]];
    reorderRoles.mutate({ serverId, roleIds });
  };

  const togglePermission = (role: RoleDTO, perm: Permission) => {
    const current = new Set(role.permissions as Permission[]);
    if (current.has(perm)) current.delete(perm);
    else current.add(perm);
    updateRole.mutate({
      roleId: role.id,
      permissions: [...current] as Permission[],
    });
  };

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Hierarquia" title="Cargos" description="Organize responsabilidades com uma hierarquia explícita. Você só pode editar cargos abaixo do seu cargo mais alto e nunca pode conceder uma permissão que não possui." />
      <div className="flex max-w-xl gap-2">
        <Input
          placeholder="Nome do novo cargo"
          value={newRoleName}
          onChange={e => setNewRoleName(e.target.value)}
          maxLength={64}
        />
        <Button
          variant="secondary"
          disabled={!newRoleName.trim() || createRole.isPending}
          onClick={() =>
            createRole.mutate({
              serverId,
              name: newRoleName.trim(),
              permissions: [
                "SEND_MESSAGES",
                "READ_MESSAGES",
                "CONNECT",
                "SPEAK",
              ],
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" /> Criar
        </Button>
      </div>
      <div className="grid min-h-[480px] gap-5 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
        <div className="space-y-1 rounded-2xl border border-white/[0.07] bg-[#181b23] p-2">
          <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Ordem de prioridade</p>
          {details.roles.map((role, index) => (
            <div
              key={role.id}
              className={cn(
                "group flex min-h-10 w-full items-center gap-1 rounded-lg px-2 text-left text-sm",
                selectedRoleId === role.id
                  ? "bg-[var(--active-bg)]"
                  : "hover:bg-[var(--hover-bg)]"
              )}
            >
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left" onClick={() => setSelectedRoleId(role.id)}>
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: role.color }}
              />
              <span className="truncate">{role.name}</span>
              {role.isDefault && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  padrão
                </span>
              )}
              </button>
              {!role.isDefault && (
                <div className="flex shrink-0 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button type="button" title="Subir cargo" aria-label={`Subir ${role.name}`} disabled={reorderRoles.isPending || index === 0} onClick={() => moveRole(role.id, -1)} className="grid size-7 place-items-center rounded text-slate-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-25"><ArrowUp className="size-3.5" /></button>
                  <button type="button" title="Descer cargo" aria-label={`Descer ${role.name}`} disabled={reorderRoles.isPending || movableRoles.findIndex(item => item.id === role.id) === movableRoles.length - 1} onClick={() => moveRole(role.id, 1)} className="grid size-7 place-items-center rounded text-slate-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-25"><ArrowDown className="size-3.5" /></button>
                </div>
              )}
            </div>
          ))}
          <p className="px-2 pt-3 text-[11px] leading-5 text-slate-500">A ordem é aplicada no backend. O cargo padrão permanece sempre na base.</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#181b23] p-5 sm:p-6">
          {selectedRole ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  key={selectedRole.id}
                  defaultValue={selectedRole.name}
                  maxLength={64}
                  className="max-w-56"
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && v !== selectedRole.name)
                      updateRole.mutate({ roleId: selectedRole.id, name: v });
                  }}
                />
                <input
                  type="color"
                  defaultValue={selectedRole.color}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  onBlur={e => {
                    if (e.target.value !== selectedRole.color)
                      updateRole.mutate({
                        roleId: selectedRole.id,
                        color: e.target.value,
                      });
                  }}
                />
                {!selectedRole.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() =>
                      deleteRole.mutate({ roleId: selectedRole.id })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => updateRole.mutate({ roleId: selectedRole.id, hoistMembers: !selectedRole.hoistMembers })} className={cn("rounded-xl border p-3 text-left", selectedRole.hoistMembers ? "border-[#7383ff]/50 bg-[#4654d8]/10" : "border-white/[0.07] bg-black/10")}><p className="text-sm font-medium">Separar na lista</p><p className="mt-1 text-xs text-slate-500">Exibe membros desse cargo em um grupo próprio.</p></button>
                <button type="button" onClick={() => updateRole.mutate({ roleId: selectedRole.id, mentionable: !selectedRole.mentionable })} className={cn("rounded-xl border p-3 text-left", selectedRole.mentionable ? "border-[#7383ff]/50 bg-[#4654d8]/10" : "border-white/[0.07] bg-black/10")}><p className="text-sm font-medium">Permitir menção</p><p className="mt-1 text-xs text-slate-500">Membros podem mencionar este cargo.</p></button>
              </div>
              <div className="space-y-1">
                {PERMISSIONS.map(perm => {
                  const enabled = (
                    selectedRole.permissions as Permission[]
                  ).includes(perm);
                  return (
                    <div
                      key={perm}
                      className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-[var(--hover-bg)]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm">{PERMISSION_LABELS[perm]}</p>
                        {PERMISSION_DESCRIPTIONS[perm] && (
                          <p className="text-xs text-muted-foreground">
                            {PERMISSION_DESCRIPTIONS[perm]}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() =>
                          togglePermission(selectedRole, perm)
                        }
                        disabled={updateRole.isPending}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione um cargo para editar.
            </p>
          )}
        </div>
        <aside className="rounded-2xl border border-white/[0.07] bg-[#181b23] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Lente de impacto</p>
          {selectedRole ? <div className="mt-5 space-y-5"><div><p className="text-3xl font-semibold tracking-tight text-white">{details.members.filter(member => member.roles.some(role => role.id === selectedRole.id)).length}</p><p className="mt-1 text-xs text-slate-500">membros recebem este cargo</p></div><div className="h-px bg-white/[0.06]" /><div><p className="text-sm font-medium text-white">{selectedRole.permissions.length} permissões diretas</p><p className="mt-1 text-xs leading-5 text-slate-500">Permissões de canal ainda podem permitir ou negar ações específicas.</p></div>{selectedRole.permissions.includes("ADMINISTRATOR") && <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-xs leading-5 text-amber-200">Administrador ignora restrições de canais. Use apenas em cargos de confiança.</div>}</div> : <p className="mt-4 text-xs leading-5 text-slate-500">Selecione um cargo para visualizar o alcance da mudança.</p>}
        </aside>
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
  const [memberQuery, setMemberQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "active_today" | "active_7d" | "joined_7d" | "timeout">("all");
  const deferredMemberQuery = useDeferredValue(memberQuery.trim());
  const membersQuery = trpc.server.settingsMembers.useInfiniteQuery(
    {
      serverId,
      query: deferredMemberQuery,
      roleId: roleFilter === "all" ? undefined : Number(roleFilter),
      activity: activityFilter,
      limit: 50,
    },
    { getNextPageParam: page => page.nextCursor ?? undefined },
  );
  const members = membersQuery.data?.pages.flatMap(page => page.items) ?? details.members;
  const invalidate = async () => {
    await Promise.all([
      utils.server.get.invalidate({ serverId }),
      membersQuery.refetch(),
    ]);
  };

  const kick = trpc.server.kick.useMutation({
    onSuccess: () => {
      toast.success("Membro expulso.");
      invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const ban = trpc.server.ban.useMutation({
    onSuccess: () => {
      toast.success("Membro banido.");
      invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const assignRole = trpc.server.assignRole.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const unassignRole = trpc.server.unassignRole.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const timeout = trpc.server.timeoutMember.useMutation({
    onSuccess: () => { toast.success("Timeout atualizado."); membersQuery.refetch(); },
    onError: error => toast.error(error.message),
  });

  const [confirm, setConfirm] = useState<{
    userId: number;
    name: string;
    action: "kick" | "ban";
  } | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Pessoas" title="Membros" description="Pesquise, filtre por cargo e aplique ações de moderação. A hierarquia é verificada novamente pelo backend em cada ação." />
      <SettingsPanel title={`${members.length} membros carregados`} description={membersQuery.hasNextPage || details.membersTruncated ? "A lista usa paginação por cursor e filtros executados no servidor." : "Gerencie cargos e estado de moderação."}>
        <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_200px_200px]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={memberQuery} onChange={event => setMemberQuery(event.target.value)} placeholder="Buscar por nome, usuário ou apelido" className="pl-9" /></div><Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os cargos</SelectItem>{details.roles.filter(role => !role.isDefault).map(role => <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>)}</SelectContent></Select><Select value={activityFilter} onValueChange={value => setActivityFilter(value as typeof activityFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda atividade</SelectItem><SelectItem value="active_today">Ativos hoje</SelectItem><SelectItem value="active_7d">Ativos em 7 dias</SelectItem><SelectItem value="joined_7d">Entraram em 7 dias</SelectItem><SelectItem value="timeout">Em timeout</SelectItem></SelectContent></Select></div>
      <div className="divide-y divide-white/[0.05]">
        {members.map(m => {
          const isSelf = m.user.id === me?.id;
          return (
            <div
              key={m.user.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-[var(--hover-bg)]"
            >
              <Avatar user={m.user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <span className="truncate">
                    {m.user.name ?? m.user.username}
                  </span>
                  {m.isOwner && (
                    <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{m.user.username}
                </p>
              </div>
              {canManageRoles && !m.isOwner && (
                <div className="flex flex-wrap gap-1 max-w-52">
                  {details.roles
                    .filter(r => !r.isDefault)
                    .map(role => {
                      const has = m.roles.some(r => r.id === role.id);
                      return (
                        <button
                          key={role.id}
                          disabled={
                            assignRole.isPending || unassignRole.isPending
                          }
                          onClick={() =>
                            has
                              ? unassignRole.mutate({
                                  serverId,
                                  userId: m.user.id,
                                  roleId: role.id,
                                })
                              : assignRole.mutate({
                                  serverId,
                                  userId: m.user.id,
                                  roleId: role.id,
                                })
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                            has
                              ? "border-transparent text-white"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                          style={
                            has ? { backgroundColor: role.color } : undefined
                          }
                          title={
                            has
                              ? `Remover cargo ${role.name}`
                              : `Atribuir cargo ${role.name}`
                          }
                        >
                          {role.name}
                        </button>
                      );
                    })}
                </div>
              )}
              {!m.isOwner && !isSelf && (canKick || canBan) && (
                <div className="flex gap-1 shrink-0">
                  {canKick && <Button variant="ghost" size="sm" title="Aplicar timeout de 1 hora" onClick={() => timeout.mutate({ serverId, userId: m.user.id, until: new Date(Date.now() + 60 * 60_000).toISOString(), reason: "Timeout aplicado pelo painel" })}>1h</Button>}
                  {canKick && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Expulsar"
                      onClick={() =>
                        setConfirm({
                          userId: m.user.id,
                          name: m.user.name ?? m.user.username ?? "membro",
                          action: "kick",
                        })
                      }
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
                      onClick={() =>
                        setConfirm({
                          userId: m.user.id,
                          name: m.user.name ?? m.user.username ?? "membro",
                          action: "ban",
                        })
                      }
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!membersQuery.isLoading && members.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Nenhum membro encontrado.</p>}
      </div>
      {membersQuery.hasNextPage && <div className="mt-5 flex justify-center"><Button variant="secondary" disabled={membersQuery.isFetchingNextPage} onClick={() => membersQuery.fetchNextPage()}>{membersQuery.isFetchingNextPage ? "Carregando" : "Carregar mais membros"}</Button></div>}
      </SettingsPanel>

      <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
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
            <Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Motivo para o registro de auditoria (opcional)" />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === "kick")
                  kick.mutate({ serverId, userId: confirm.userId, reason: reason.trim() || undefined });
                else ban.mutate({ serverId, userId: confirm.userId, reason: reason.trim() || undefined });
                setConfirm(null);
                setReason("");
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
function InvitesTab({ details }: { details: ServerDetailsDTO }) {
  const serverId = details.server.id;
  const utils = trpc.useUtils();
  const invites = trpc.server.listInvites.useQuery({ serverId });
  const [maxUses, setMaxUses] = useState("25");
  const [expiresInHours, setExpiresInHours] = useState("168");
  const create = trpc.server.createInvite.useMutation({
    onSuccess: data => {
      toast.success("Convite criado.");
      invites.refetch();
      navigator.clipboard.writeText(`${window.location.origin}${data.url}`).catch(() => {});
    },
    onError: error => toast.error(error.message),
  });
  const revoke = trpc.server.revokeInvite.useMutation({
    onSuccess: () => {
      toast.success("Convite revogado.");
      invites.refetch();
    },
    onError: e => toast.error(e.message),
  });
  const pause = trpc.server.setInvitesPaused.useMutation({
    onSuccess: async (_, input) => {
      toast.success(input.paused ? "Convites pausados." : "Convites reativados.");
      await utils.server.get.invalidate({ serverId });
    },
    onError: error => toast.error(error.message),
  });

  const copy = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Acesso" title="Convites" description="Crie links com prazo e limite de uso, pause novas entradas ou revogue um link sem apagar o histórico." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <SettingsPanel title="Novo convite" description="O link é copiado automaticamente após a criação.">
          <div className="space-y-4">
            <Field label="Expira em"><Select value={expiresInHours} onValueChange={setExpiresInHours}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 hora</SelectItem><SelectItem value="24">1 dia</SelectItem><SelectItem value="168">7 dias</SelectItem><SelectItem value="720">30 dias</SelectItem><SelectItem value="0">Nunca</SelectItem></SelectContent></Select></Field>
            <Field label="Limite de usos"><Input type="number" min={1} max={1000} value={maxUses} onChange={event => setMaxUses(event.target.value)} /></Field>
            <Button className="w-full" disabled={create.isPending || details.server.invitesPaused} onClick={() => create.mutate({ serverId, maxUses: Number(maxUses) || undefined, expiresInHours: Number(expiresInHours) || undefined })}><Plus className="mr-2 size-4" />Criar e copiar</Button>
            {details.server.invitesPaused && <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">Novos usos estão pausados. Reative os convites para criar ou usar links.</p>}
          </div>
        </SettingsPanel>
        <SettingsPanel title="Links do servidor" description="Links revogados permanecem visíveis para auditoria.">
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/10 p-3"><div><p className="text-sm font-medium text-white">Aceitar entradas por convite</p><p className="mt-1 text-xs text-slate-500">Pausar não apaga nenhum link.</p></div><Switch checked={!details.server.invitesPaused} onCheckedChange={checked => pause.mutate({ serverId, paused: !checked })} /></div>
      {invites.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : invites.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum convite ativo. Use o menu do servidor para criar um.
        </p>
      ) : (
        <div className="space-y-2">
          {invites.data?.map(inv => (
            <div
              key={inv.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0"><code className={cn("text-sm font-mono", inv.revokedAt && "text-slate-600 line-through")}>{inv.code}</code><p className="mt-1 text-[11px] text-slate-500">{inv.revokedAt ? `Revogado em ${new Date(inv.revokedAt).toLocaleDateString("pt-BR")}` : "Ativo"}</p></div>
              <span className="text-xs text-muted-foreground">
                {inv.uses} uso{inv.uses === 1 ? "" : "s"}
                {inv.maxUses ? ` / máx. ${inv.maxUses}` : ""}
                {inv.expiresAt
                  ? ` · expira em ${new Date(inv.expiresAt).toLocaleDateString("pt-BR")}`
                  : " · sem expiração"}
              </span>
              <div className="ml-auto flex gap-1">
                {!inv.revokedAt && <Button
                  variant="ghost"
                  size="icon"
                  title="Copiar link"
                  onClick={() => copy(inv.code)}
                >
                  <Copy className="h-4 w-4" />
                </Button>}
                {!inv.revokedAt && <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  title="Revogar"
                  onClick={() => revoke.mutate({ inviteId: inv.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>}
              </div>
            </div>
          ))}
        </div>
      )}
        </SettingsPanel>
      </div>
    </div>
  );
}

// ── Entrada e regras ──────────────────────────────────────────
function AccessTab({ details }: { details: ServerDetailsDTO }) {
  const serverId = details.server.id;
  const utils = trpc.useUtils();
  const [verificationLevel, setVerificationLevel] = useState(details.server.verificationLevel ?? "none");
  const [rulesEnabled, setRulesEnabled] = useState(details.server.rulesEnabled ?? false);
  const [communityEnabled, setCommunityEnabled] = useState(details.server.communityEnabled ?? false);
  const [rulesText, setRulesText] = useState((details.server.rules ?? []).join("\n"));

  const parsedRules = rulesText
    .split("\n")
    .map(rule => rule.trim())
    .filter(Boolean)
    .slice(0, 20);
  const invalidRule = parsedRules.some(rule => rule.length > 240);
  const dirty = verificationLevel !== (details.server.verificationLevel ?? "none")
    || rulesEnabled !== (details.server.rulesEnabled ?? false)
    || communityEnabled !== (details.server.communityEnabled ?? false)
    || rulesText !== (details.server.rules ?? []).join("\n");
  const update = trpc.server.update.useMutation({
    onSuccess: async () => {
      toast.success("Entrada e regras atualizadas.");
      await utils.server.get.invalidate({ serverId });
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Entrada" title="Acesso e regras" description="Defina as barreiras de entrada e apresente regras claras antes de ampliar a comunidade." />
      <SettingsPanel title="Nível de verificação" description="Aumentar o nível reduz contas descartáveis, mas também adiciona fricção para novos membros.">
        <Select value={verificationLevel} onValueChange={value => setVerificationLevel(value as typeof verificationLevel)}>
          <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum requisito adicional</SelectItem>
            <SelectItem value="low">E-mail verificado</SelectItem>
            <SelectItem value="medium">Conta com pelo menos 5 minutos</SelectItem>
            <SelectItem value="high" disabled>Membro por 10 minutos (indisponível)</SelectItem>
            <SelectItem value="maximum" disabled>Telefone verificado (indisponível)</SelectItem>
          </SelectContent>
        </Select>
      </SettingsPanel>
      <SettingsPanel title="Regras da comunidade" description="Uma regra por linha, até 20 regras. Cada regra pode ter no máximo 240 caracteres.">
        <ToggleRow title="Exigir aceite das regras" description="Mantém a política ativa para os fluxos de entrada compatíveis com o Nexora." checked={rulesEnabled} onCheckedChange={setRulesEnabled} />
        <Textarea value={rulesText} onChange={event => setRulesText(event.target.value)} rows={9} maxLength={4800} placeholder={"Respeite as outras pessoas.\nNão compartilhe conteúdo ilegal.\nUse cada canal para o assunto indicado."} className="mt-5 resize-y" />
        <div className="mt-2 flex justify-between gap-4 text-[11px] text-slate-500"><span>{parsedRules.length}/20 regras</span>{invalidRule && <span className="text-rose-400">Uma regra ultrapassa 240 caracteres.</span>}</div>
      </SettingsPanel>
      <SettingsPanel title="Modo comunidade" description="Sinaliza que este servidor utiliza recursos públicos e políticas de comunidade do Nexora.">
        <ToggleRow title="Ativar recursos de comunidade" description="Mantém as configurações de acesso prontas para futuros fluxos de descoberta e onboarding, sem publicar o servidor automaticamente." checked={communityEnabled} onCheckedChange={setCommunityEnabled} />
      </SettingsPanel>
      <div className="flex justify-end">
        <Button disabled={!dirty || invalidRule || update.isPending} onClick={() => update.mutate({ serverId, verificationLevel, rulesEnabled, rules: parsedRules, communityEnabled })}>{update.isPending ? "Salvando" : "Salvar acesso"}</Button>
      </div>
    </div>
  );
}

// ── Moderação (banimentos) ────────────────────────────────────
function ModerationTab({ serverId }: { serverId: number }) {
  const bans = trpc.server.listBans.useQuery({ serverId });
  const automod = trpc.server.automodGet.useQuery({ serverId });
  const updateRule = trpc.server.automodUpdateRule.useMutation({
    onSuccess: () => { toast.success("Regra do AutoMod atualizada."); automod.refetch(); },
    onError: error => toast.error(error.message),
  });
  const unban = trpc.server.unban.useMutation({
    onSuccess: () => {
      toast.success("Banimento removido.");
      bans.refetch();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Proteção" title="Segurança e AutoMod" description="Automatize barreiras de entrada e filtros de conteúdo. A decisão continua auditável e a equipe pode intervir manualmente." />
      <SettingsPanel title="Regras automáticas" description="Cada filtro é aplicado pelo backend antes de a mensagem ser distribuída.">
        <div className="space-y-3">
          {(automod.data?.rules ?? []).map(rule => {
            const labels: Record<string, [string, string]> = {
              flood: ["Controle de flood", "Limita sequências rápidas de mensagens."],
              repeat: ["Mensagens repetidas", "Bloqueia conteúdo duplicado em sequência."],
              mass_mention: ["Menções em massa", "Evita notificações abusivas."],
              blocked_words: ["Palavras bloqueadas", "Aplica a lista configurada pela moderação."],
              invites: ["Convites externos", "Intercepta links de convite de outras comunidades."],
              suspicious_links: ["Links suspeitos", "Bloqueia endereços com sinais de fraude."],
            };
            const [title, description] = labels[rule.type] ?? [rule.type, "Filtro automático."];
            return <AutomodRuleCard key={rule.type} rule={rule} title={title} description={description} pending={updateRule.isPending} onSave={(enabled, config) => updateRule.mutate({ serverId, ruleType: rule.type, enabled, config })} />;
          })}
          {automod.isLoading && <p className="py-5 text-sm text-slate-500">Carregando regras...</p>}
        </div>
      </SettingsPanel>
      <SettingsPanel title="Pessoas banidas" description="Revise o motivo e remova o banimento quando necessário.">
      {bans.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : bans.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário banido.</p>
      ) : (
        <div className="space-y-2">
          {bans.data?.map(({ ban, user }) => (
            <div
              key={ban.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <Avatar user={user} size="sm" showStatus={false} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {user.name ?? user.username}
                </p>
                {ban.reason && (
                  <p className="text-xs text-muted-foreground truncate">
                    Motivo: {ban.reason}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => unban.mutate({ serverId, userId: user.id })}
              >
                Desbanir
              </Button>
            </div>
          ))}
        </div>
      )}
      </SettingsPanel>
    </div>
  );
}

type AutomodRuleKind = "flood" | "repeat" | "mass_mention" | "blocked_words" | "invites" | "suspicious_links";
type AutomodRuleConfigDraft = {
  maxMessages?: number;
  windowSeconds?: number;
  maxRepeats?: number;
  maxMentions?: number;
  words?: string[];
};

function AutomodRuleCard({
  rule,
  title,
  description,
  pending,
  onSave,
}: {
  rule: { type: AutomodRuleKind; enabled: boolean; config: AutomodRuleConfigDraft | null };
  title: string;
  description: string;
  pending: boolean;
  onSave: (enabled: boolean, config?: AutomodRuleConfigDraft) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [maxMessages, setMaxMessages] = useState(String(rule.config?.maxMessages ?? 10));
  const [windowSeconds, setWindowSeconds] = useState(String(rule.config?.windowSeconds ?? 10));
  const [maxRepeats, setMaxRepeats] = useState(String(rule.config?.maxRepeats ?? 3));
  const [maxMentions, setMaxMentions] = useState(String(rule.config?.maxMentions ?? 6));
  const [words, setWords] = useState((rule.config?.words ?? []).join("\n"));
  const configurable = !["invites", "suspicious_links"].includes(rule.type);

  const currentConfig = (): AutomodRuleConfigDraft | undefined => {
    if (rule.type === "flood") return { maxMessages: Math.max(2, Math.min(100, Number(maxMessages) || 10)), windowSeconds: Math.max(1, Math.min(120, Number(windowSeconds) || 10)) };
    if (rule.type === "repeat") return { maxRepeats: Math.max(2, Math.min(10, Number(maxRepeats) || 3)) };
    if (rule.type === "mass_mention") return { maxMentions: Math.max(1, Math.min(50, Number(maxMentions) || 6)) };
    if (rule.type === "blocked_words") return { words: words.split(/[\n,]/).map(word => word.trim().slice(0, 60)).filter(Boolean).slice(0, 200) };
    return undefined;
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/10">
      <div className="flex items-center gap-4 p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#4654d8]/12 text-[#8290ff]"><ShieldCheck className="size-[18px]" /></div>
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
        {configurable && <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>Configurar<ChevronRight className={cn("ml-1 size-4 transition-transform", expanded && "rotate-90")} /></Button>}
        <Switch checked={rule.enabled} disabled={pending} aria-label={`${rule.enabled ? "Desativar" : "Ativar"} ${title}`} onCheckedChange={enabled => onSave(enabled, currentConfig())} />
      </div>
      {expanded && <div className="border-t border-white/[0.06] p-4">
        {rule.type === "flood" && <div className="grid gap-3 sm:grid-cols-2"><Field label="Máximo de mensagens"><Input type="number" min={2} max={100} value={maxMessages} onChange={event => setMaxMessages(event.target.value)} /></Field><Field label="Janela em segundos"><Input type="number" min={1} max={120} value={windowSeconds} onChange={event => setWindowSeconds(event.target.value)} /></Field></div>}
        {rule.type === "repeat" && <Field label="Repetições permitidas"><Input className="max-w-xs" type="number" min={2} max={10} value={maxRepeats} onChange={event => setMaxRepeats(event.target.value)} /></Field>}
        {rule.type === "mass_mention" && <Field label="Máximo de menções"><Input className="max-w-xs" type="number" min={1} max={50} value={maxMentions} onChange={event => setMaxMentions(event.target.value)} /></Field>}
        {rule.type === "blocked_words" && <Field label="Palavras e frases" hint="Uma por linha ou separadas por vírgula. O filtro é aplicado no backend antes da publicação."><Textarea rows={6} value={words} onChange={event => setWords(event.target.value)} maxLength={12000} placeholder={"termo bloqueado\nfrase bloqueada"} /></Field>}
        <div className="mt-4 flex justify-end"><Button size="sm" disabled={pending} onClick={() => onSave(rule.enabled, currentConfig())}><Save className="mr-2 size-4" />Salvar configuração</Button></div>
      </div>}
    </div>
  );
}

function AuditTab({ serverId }: { serverId: number }) {
  const [query, setQuery] = useState("");
  const audit = trpc.server.auditLog.useInfiniteQuery(
    { serverId, limit: 50 },
    { getNextPageParam: page => page.nextCursor ?? undefined },
  );
  const labels: Record<string, string> = {
    SERVER_UPDATE: "Servidor atualizado",
    INVITE_CREATE: "Convite criado",
    INVITE_REVOKE: "Convite revogado",
    INVITES_PAUSE: "Convites pausados",
    INVITES_RESUME: "Convites reativados",
    MEMBER_KICK: "Membro expulso",
    MEMBER_BAN: "Membro banido",
    MEMBER_UNBAN: "Banimento removido",
    MEMBER_TIMEOUT: "Timeout aplicado",
    MEMBER_TIMEOUT_CLEAR: "Timeout removido",
    ROLE_CREATE: "Cargo criado",
    ROLE_UPDATE: "Cargo atualizado",
    ROLE_DELETE: "Cargo excluído",
    ROLE_ASSIGN: "Cargo atribuído",
    ROLE_UNASSIGN: "Cargo removido",
    ROLE_REORDER: "Cargos reordenados",
    OWNERSHIP_TRANSFER: "Propriedade transferida",
    AUTOMOD_UPDATE: "Regra do AutoMod atualizada",
  };
  const rows = useMemo(() => (audit.data?.pages.flatMap(page => page.items) ?? []).filter(row => {
    const haystack = `${row.action} ${row.actor.name ?? row.actor.username ?? ""} ${row.targetUser?.name ?? row.targetUser?.username ?? ""} ${row.reason ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [audit.data?.pages, query]);

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Transparência" title="Registro de auditoria" description="Ações administrativas ficam registradas com autor, alvo, data e justificativa. Este histórico não é editável pelo painel." />
      <SettingsPanel title="Atividade administrativa" description="O histórico é carregado em páginas de 50 eventos por cursor.">
        <div className="relative mb-5"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por ação, ID ou motivo" className="pl-9" /></div>
        {audit.isLoading ? <p className="py-10 text-center text-sm text-slate-500">Carregando histórico...</p> : rows.length === 0 ? <div className="py-14 text-center"><ClipboardList className="mx-auto size-8 text-slate-600" /><p className="mt-3 text-sm text-slate-400">Nenhum evento encontrado.</p></div> : <div className="divide-y divide-white/[0.06]">{rows.map(row => <div key={row.id} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[42px_1fr_auto]"><div className="grid size-9 place-items-center rounded-xl bg-white/[0.05] text-slate-400"><FileClock className="size-4" /></div><div><p className="text-sm font-medium text-white">{labels[row.action] ?? row.action}</p><p className="mt-1 text-xs text-slate-500">{row.actor.name ?? row.actor.username ?? `Usuário ${row.actorUserId}`}{row.targetUser ? ` · alvo: ${row.targetUser.name ?? row.targetUser.username ?? `Usuário ${row.targetUserId}`}` : ""}{row.targetId ? ` · ${row.targetType} ${row.targetId}` : ""}</p>{row.reason && <p className="mt-2 rounded-lg bg-black/15 px-3 py-2 text-xs leading-5 text-slate-400">Motivo: {row.reason}</p>}</div><time className="text-[11px] tabular-nums text-slate-500">{new Date(row.createdAt).toLocaleString("pt-BR")}</time></div>)}</div>}
        {audit.hasNextPage && <div className="mt-5 flex justify-center"><Button variant="secondary" disabled={audit.isFetchingNextPage} onClick={() => audit.fetchNextPage()}>{audit.isFetchingNextPage ? "Carregando" : "Carregar eventos anteriores"}</Button></div>}
      </SettingsPanel>
    </div>
  );
}

function NotificationsTab({ serverId }: { serverId: number }) {
  const preferences = trpc.server.notificationPreferences.useQuery({ serverId });
  type Draft = { level: "all" | "mentions" | "none"; muted: boolean; suppressEveryone: boolean; suppressRoles: boolean };
  const [draft, setDraft] = useState<Draft | null>(null);
  const values: Draft = draft ?? {
    level: preferences.data?.level ?? "mentions",
    muted: Boolean(preferences.data?.mutedUntil),
    suppressEveryone: preferences.data?.suppressEveryone ?? false,
    suppressRoles: preferences.data?.suppressRoles ?? false,
  };
  const updateDraft = (patch: Partial<Draft>) => setDraft(current => ({ ...values, ...current, ...patch }));
  const update = trpc.server.updateNotificationPreferences.useMutation({
    onSuccess: () => { toast.success("Preferências salvas."); setDraft(null); preferences.refetch(); },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Preferências pessoais" title="Notificações" description="Essas escolhas afetam apenas a sua conta neste servidor e não exigem permissão administrativa." />
      <SettingsPanel title="Mensagens" description="Escolha quais mensagens geram alertas.">
        <div className="grid gap-3 sm:grid-cols-3">{([ ["all", "Todas", "Cada nova mensagem"], ["mentions", "Menções", "Somente quando citarem você"], ["none", "Nenhuma", "Sem alertas de mensagem"] ] as const).map(([value, title, description]) => <button key={value} type="button" onClick={() => updateDraft({ level: value })} className={cn("rounded-xl border p-4 text-left transition-colors", values.level === value ? "border-[#7383ff]/60 bg-[#4654d8]/12" : "border-white/[0.07] bg-black/10 hover:bg-white/[0.04]")}><span className={cn("mb-3 block size-4 rounded-full border-4", values.level === value ? "border-[#7383ff] bg-white" : "border-slate-600")} /><p className="text-sm font-medium text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></button>)}</div>
      </SettingsPanel>
      <SettingsPanel title="Controles adicionais">
        <div className="divide-y divide-white/[0.06]"><ToggleRow title="Silenciar por 8 horas" description="Suspende temporariamente todos os alertas deste servidor." checked={values.muted} onCheckedChange={muted => updateDraft({ muted })} /><ToggleRow title="Suprimir @everyone" description="Não notificar menções gerais." checked={values.suppressEveryone} onCheckedChange={suppressEveryone => updateDraft({ suppressEveryone })} /><ToggleRow title="Suprimir menções de cargos" description="Não notificar quando um dos seus cargos for mencionado." checked={values.suppressRoles} onCheckedChange={suppressRoles => updateDraft({ suppressRoles })} /></div>
        <Button className="mt-5" disabled={update.isPending || !draft} onClick={() => update.mutate({ serverId, level: values.level, mutedUntil: values.muted ? new Date(Date.now() + 8 * 60 * 60_000).toISOString() : null, suppressEveryone: values.suppressEveryone, suppressRoles: values.suppressRoles })}>{update.isPending ? "Salvando" : "Salvar preferências"}</Button>
      </SettingsPanel>
    </div>
  );
}

function ToggleRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>;
}

// ── Excluir servidor ──────────────────────────────────────────
function DangerTab({
  details,
  onClose,
}: {
  details: ServerDetailsDTO;
  onClose: () => void;
}) {
  const serverId = details.server.id;
  const serverName = details.server.name;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [confirmName, setConfirmName] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [transferConfirm, setTransferConfirm] = useState("");
  const transfer = trpc.server.transferOwnership.useMutation({
    onSuccess: async () => {
      toast.success("Propriedade transferida.");
      await utils.server.get.invalidate({ serverId });
    },
    onError: error => toast.error(error.message),
  });
  const del = trpc.server.delete.useMutation({
    onSuccess: () => {
      toast.success("Servidor excluído.");
      utils.server.list.invalidate();
      onClose();
      navigate("/channels/@me");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Propriedade" title="Transferir ou excluir" description="Essas ações afetam toda a comunidade. Confirme o nome exato do servidor para evitar mudanças acidentais." />
      <SettingsPanel title="Transferir propriedade" description="O novo dono assume controle total. Você continuará como membro comum.">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Novo proprietário"><Select value={transferUserId} onValueChange={setTransferUserId}><SelectTrigger><SelectValue placeholder="Escolha um membro" /></SelectTrigger><SelectContent>{details.members.filter(member => !member.isOwner).map(member => <SelectItem key={member.user.id} value={String(member.user.id)}>{member.user.name ?? member.user.username}</SelectItem>)}</SelectContent></Select></Field>
          <Field label={`Digite ${serverName}`}><Input value={transferConfirm} onChange={event => setTransferConfirm(event.target.value)} /></Field>
        </div>
        <Button className="mt-4" variant="secondary" disabled={!transferUserId || transferConfirm !== serverName || transfer.isPending} onClick={() => transfer.mutate({ serverId, newOwnerId: Number(transferUserId), confirmation: transferConfirm })}>Transferir propriedade</Button>
      </SettingsPanel>
      <section className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.05]">
        <div className="border-b border-rose-500/15 px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-rose-300">Excluir servidor</h2><p className="mt-1 text-xs leading-5 text-rose-200/60">Esta ação remove permanentemente canais, mensagens, convites, cargos e membros.</p></div>
        <div className="max-w-2xl space-y-4 p-5 sm:p-6"><Field label={`Digite ${serverName} para confirmar`}><Input value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={serverName} /></Field><Button variant="destructive" disabled={confirmName !== serverName || del.isPending} onClick={() => del.mutate({ serverId })}>{del.isPending ? "Excluindo..." : "Excluir servidor permanentemente"}</Button></div>
      </section>
    </div>
  );
}

// ── Permissões (overrides por categoria/canal × cargo) ────────
function PermissionsTab({ details }: { details: ServerDetailsDTO }) {
  const utils = trpc.useUtils();
  const targets = [
    ...details.categories.map(c => ({
      id: c.id,
      type: "category" as const,
      label: `📂 ${c.name}`,
    })),
    ...details.channels.map(c => ({
      id: c.id,
      type: "channel" as const,
      label: `${c.type === "VOICE" || c.type === "STAGE" ? "🔊" : "#"} ${c.name}`,
    })),
  ];
  const [target, setTarget] = useState<{ type: "category" | "channel"; id: number } | null>(
    targets[0] ? { type: targets[0].type, id: targets[0].id } : null
  );
  const [roleId, setRoleId] = useState<number | null>(null);

  const overrides = trpc.server.listOverrides.useQuery(
    { targetType: target?.type ?? "channel", targetId: target?.id ?? 0 },
    { enabled: !!target }
  );
  const upsert = trpc.server.upsertOverride.useMutation({
    onSuccess: () => {
      toast.success("Permissões salvas.");
      utils.server.listOverrides.invalidate();
      utils.server.get.invalidate({ serverId: details.server.id });
    },
    onError: e => toast.error(e.message),
  });
  const removeOv = trpc.server.deleteOverride.useMutation({
    onSuccess: () => utils.server.listOverrides.invalidate(),
    onError: e => toast.error(e.message),
  });
  const setSynced = trpc.server.setChannelSynced.useMutation({
    onSuccess: () => utils.server.get.invalidate({ serverId: details.server.id }),
    onError: e => toast.error(e.message),
  });

  const selectedChannel =
    target?.type === "channel"
      ? details.channels.find(c => c.id === target.id)
      : undefined;

  if (targets.length === 0) {
    return <p className="text-xs text-faint">Crie categorias ou canais primeiro.</p>;
  }

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Acesso" title="Permissões de canais" description="Defina exceções por cargo com três estados: herdar, permitir ou negar. Canais sincronizados recebem as regras da categoria automaticamente." />
      <SettingsPanel title="Matriz de acesso" description="Sem a permissão Ver canal, metadados e conteúdo do canal não são enviados ao membro.">

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={target ? String(target.id) : ""}
          onValueChange={v => {
            const t = targets.find(x => String(x.id) === v)!;
            setTarget({ type: t.type, id: t.id });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Categoria ou canal" /></SelectTrigger>
          <SelectContent className="max-h-64">
            {targets.map(t => (
              <SelectItem key={`${t.type}-${t.id}`} value={String(t.id)}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={roleId === null ? "everyone" : String(roleId)}
          onValueChange={v => setRoleId(v === "everyone" ? null : Number(v))}
        >
          <SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">@everyone</SelectItem>
            {details.roles.map(r => (
              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedChannel && (
        <label className="flex items-center gap-2 text-xs text-muted2">
          <input
            type="checkbox"
            className="accent-[#5865F2]"
            checked={selectedChannel.syncedWithCategory ?? true}
            onChange={e =>
              setSynced.mutate({
                channelId: selectedChannel.id,
                synced: e.target.checked,
              })
            }
          />
          Sincronizar permissões com a categoria
        </label>
      )}

      {target && !overrides.isLoading && <PermissionGridEditor
        key={`${target.type}-${target.id}-${roleId ?? "everyone"}-${JSON.stringify(overrides.data?.find(override => override.roleId === roleId) ?? null)}`}
        current={overrides.data?.find(override => override.roleId === roleId)}
        pending={upsert.isPending}
        onSave={(allow, deny) => upsert.mutate({ targetType: target.type, targetId: target.id, roleId, allow, deny })}
      />}

      {/* Existing overrides */}
      {overrides.data && overrides.data.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
            Regras ativas neste alvo
          </p>
          {overrides.data.map(ov => {
            const roleName =
              ov.roleId === null
                ? "@everyone"
                : details.roles.find(r => r.id === ov.roleId)?.name ?? `Cargo ${ov.roleId}`;
            return (
              <div
                key={ov.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate">
                  <b>{roleName}</b> · ✓{ov.allow.length} ✗{ov.deny.length}
                </span>
                <button
                  onClick={() => removeOv.mutate({ overrideId: ov.id })}
                  className="rounded px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/10"
                >
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      )}
      </SettingsPanel>
    </div>
  );
}

function PermissionGridEditor({
  current,
  pending,
  onSave,
}: {
  current?: { allow: string[]; deny: string[] };
  pending: boolean;
  onSave: (allow: Permission[], deny: Permission[]) => void;
}) {
  const initialStates = useMemo(() => {
    const next: Record<string, "off" | "allow" | "deny"> = {};
    for (const permission of current?.allow ?? []) next[permission] = "allow";
    for (const permission of current?.deny ?? []) next[permission] = "deny";
    return next;
  }, [current]);
  const [states, setStates] = useState(initialStates);

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(PERMISSION_LABELS) as Permission[]).map(permission => {
          const state = states[permission] ?? "off";
          return (
            <button
              type="button"
              key={permission}
              onClick={() => setStates(previous => ({
                ...previous,
                [permission]: state === "off" ? "allow" : state === "allow" ? "deny" : "off",
              }))}
              title={`Clique para alternar entre herdar, permitir e negar (${PERMISSION_LABELS[permission]})`}
              className={cn(
                "flex min-h-10 items-center justify-between rounded-lg border px-3 text-left text-xs transition-colors",
                state === "allow"
                  ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                  : state === "deny"
                    ? "border-red-500/40 bg-red-500/[0.08]"
                    : "border-white/10 hover:bg-white/5",
              )}
            >
              <span className="truncate">{PERMISSION_LABELS[permission]}</span>
              <span className={cn("ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase", state === "allow" ? "bg-emerald-500/20 text-emerald-300" : state === "deny" ? "bg-red-500/20 text-red-300" : "text-faint")}>
                {state === "off" ? "herdar" : state === "allow" ? "✓" : "✗"}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        disabled={pending}
        onClick={() => onSave(
          Object.entries(states).filter(([, value]) => value === "allow").map(([permission]) => permission as Permission),
          Object.entries(states).filter(([, value]) => value === "deny").map(([permission]) => permission as Permission),
        )}
      >
        {pending ? "Salvando..." : "Salvar permissões"}
      </Button>
    </>
  );
}

// ── Integrações / Webhooks ────────────────────────────────────
function IntegrationsTab({ details }: { details: ServerDetailsDTO }) {
  const utils = trpc.useUtils();
  const list = trpc.webhook.list.useQuery({ serverId: details.server.id });
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState<string>(
    String(details.channels.find(c => c.type !== "VOICE")?.id ?? "")
  );
  const [justCreated, setJustCreated] = useState<{ url: string } | null>(null);

  const create = trpc.webhook.create.useMutation({
    onSuccess: data => {
      utils.webhook.list.invalidate({ serverId: details.server.id });
      setName("");
      setJustCreated({ url: data.url });
    },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.webhook.remove.useMutation({
    onSuccess: () => utils.webhook.list.invalidate({ serverId: details.server.id }),
    onError: e => toast.error(e.message),
  });

  const fullUrl = justCreated ? `${window.location.origin}${justCreated.url}` : "";

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-semibold">Integrações e Webhooks</h2>
      <p className="text-xs leading-relaxed text-muted2">
        Webhooks permitem que serviços externos enviem mensagens para um canal.
        A URL contém um token criptográfico. <b>Trate como segredo</b>. Dica:
        mantenha bots/webhooks em categorias privadas e conceda apenas os
        direitos necessários (gerenciar mensagens e webhooks).
      </p>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim() || !channelId) return;
          create.mutate({ channelId: Number(channelId), name: name.trim() });
        }}
      >
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome do webhook (ex.: Alertas de Deploy)"
          maxLength={80}
        />
        <Select value={channelId} onValueChange={setChannelId}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent className="max-h-64">
            {details.channels
              .filter(c => c.type !== "VOICE" && c.type !== "STAGE")
              .map(c => (
                <SelectItem key={c.id} value={String(c.id)}>#{c.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!name.trim() || !channelId || create.isPending}>
          Criar
        </Button>
      </form>

      {justCreated && (
        <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3">
          <p className="text-xs font-bold text-amber-200">
            Copie agora. Esta URL não será exibida novamente:
          </p>
          <code className="block break-all rounded-lg bg-black/50 p-2 text-[11px]">
            POST {fullUrl}
          </code>
      <div className="mt-5 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(fullUrl).catch(() => {});
                toast.success("URL copiada.");
              }}
            >
              Copiar URL
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setJustCreated(null)}>
              Fechar
            </Button>
          </div>
          <p className="text-[11px] text-muted2">
            Exemplo de uso:
            <code className="mt-1 block break-all rounded bg-black/40 p-1.5 text-[10px]">
{`curl -X POST ${fullUrl} -H "Content-Type: application/json" -d '{"content":"Deploy concluído ✅"}'`}
            </code>
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
          Webhooks do servidor ({list.data?.length ?? 0})
        </p>
        {list.isLoading ? (
          <p className="py-6 text-center text-xs text-muted2">Carregando...</p>
        ) : (list.data?.length ?? 0) === 0 ? (
          <p className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-xs text-muted2">
            Nenhum webhook criado ainda.
          </p>
        ) : (
          list.data!.map(({ webhook, channelName }) => (
            <div
              key={webhook.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{webhook.name}</p>
                <p className="truncate text-[11px] text-faint">
                  canal #{channelName ?? "?"} · criado em{" "}
                  {new Date(webhook.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() =>
                  confirm(`Excluir o webhook "${webhook.name}"?`) &&
                  remove.mutate({ webhookId: webhook.id })
                }
                className="rounded px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-500/10"
              >
                Excluir
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
