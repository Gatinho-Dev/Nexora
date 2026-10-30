import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  ShieldAlert,
  Send,
  LoaderCircle,
  LockKeyhole,
  Archive,
  Pencil,
  Copy,
  Trash2,
  Eye,
  MousePointerClick,
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  Code,
  Link2,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { OfficialIdentity } from "@/components/official/OfficialIdentity";
import { cn } from "@/lib/utils";
import type { OfficialAnnouncementDTO } from "@contracts/types";

const TYPES = [
  { id: "ANNOUNCEMENT", label: "Anúncio" },
  { id: "INFO", label: "Informação" },
  { id: "SUCCESS", label: "Sucesso" },
  { id: "WARNING", label: "Aviso" },
  { id: "ERROR", label: "Erro crítico" },
  { id: "MAINTENANCE", label: "Manutenção" },
] as const;

type EditorState = {
  title: string;
  content: string;
  type: string;
  buttonLabel: string;
  buttonUrl: string;
  startsAt: string;
  expiresAt: string;
  dismissible: boolean;
};

const EMPTY_EDITOR: EditorState = {
  title: "",
  content: "",
  type: "ANNOUNCEMENT",
  buttonLabel: "",
  buttonUrl: "",
  startsAt: "",
  expiresAt: "",
  dismissible: true,
};

/** Toolbar markdown: aplica wrapper no texto selecionado do textarea. */
function wrapSelection(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  before: string,
  after = "",
  placeholder = "texto",
) {
  const el = ref.current;
  if (!el) return;
  const { selectionStart, selectionEnd, value } = el;
  const selected = value.slice(selectionStart, selectionEnd) || placeholder;
  const next =
    value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  // Setter nativo: contorna o value-tracker do React para o onChange disparar.
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  nativeSetter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  requestAnimationFrame(() => {
    el.focus();
    const start = selectionStart + before.length;
    el.setSelectionRange(start, start + selected.length);
  });
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa1ab] transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function BroadcastsSection() {
  const utils = trpc.useUtils();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OfficialAnnouncementDTO | null>(null);

  const announcements = trpc.admin.listAnnouncements.useQuery({
    limit: 50,
    includeArchived: true,
  });
  const invalidate = async () => {
    await Promise.all([
      utils.admin.listAnnouncements.invalidate(),
      utils.official.list.invalidate(),
      utils.official.activeBanner.invalidate(),
      utils.official.unreadCount.invalidate(),
    ]);
  };

  const createAnnouncement = trpc.admin.createAnnouncement.useMutation({
    onSuccess: async () => {
      setEditor(EMPTY_EDITOR);
      await invalidate();
      toast.success("Mensagem global publicada para todos os usuários.");
    },
    onError: e => toast.error(e.message || "Não foi possível publicar."),
  });
  const editAnnouncement = trpc.admin.editAnnouncement.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      setEditor(EMPTY_EDITOR);
      await invalidate();
      toast.success("Mensagem atualizada.");
    },
    onError: e => toast.error(e.message || "Não foi possível salvar."),
  });
  const archiveAnnouncement = trpc.admin.archiveAnnouncement.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Mensagem desativada.");
    },
  });
  const duplicateAnnouncement = trpc.admin.duplicateAnnouncement.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Cópia criada como rascunho inativo.");
    },
  });
  const deleteAnnouncement = trpc.admin.deleteAnnouncement.useMutation({
    onSuccess: async () => {
      setDeleteTarget(null);
      await invalidate();
      toast.success("Mensagem excluída.");
    },
  });

  const set = (patch: Partial<EditorState>) =>
    setEditor(prev => ({ ...prev, ...patch }));

  const canPublish =
    editor.title.trim().length >= 3 &&
    editor.content.trim().length >= 5 &&
    (!editor.buttonLabel || /^https?:\/\//.test(editor.buttonUrl.trim()));

  const submit = () => {
    if (!canPublish) return;
    const payload = {
      title: editor.title.trim(),
      content: editor.content.trim(),
      contentFormat: "MARKDOWN" as const,
      type: editor.type as
        | "INFO"
        | "SUCCESS"
        | "WARNING"
        | "ERROR"
        | "MAINTENANCE"
        | "ANNOUNCEMENT",
      buttonLabel: editor.buttonLabel.trim() || null,
      buttonUrl: editor.buttonUrl.trim() || null,
      startsAt: editor.startsAt ? new Date(editor.startsAt) : null,
      expiresAt: editor.expiresAt ? new Date(editor.expiresAt) : null,
      dismissible: editor.dismissible,
    };
    if (editingId !== null) {
      editAnnouncement.mutate({ announcementId: editingId, ...payload });
    } else {
      createAnnouncement.mutate({ ...payload, kind: "GENERAL" });
    }
  };

  const startEdit = (item: OfficialAnnouncementDTO) => {
    setEditingId(item.id);
    setEditor({
      title: item.title,
      content: item.content,
      type: item.type,
      buttonLabel: item.buttonLabel ?? "",
      buttonUrl: item.buttonUrl ?? "",
      startsAt: item.startsAt ? toLocalInput(item.startsAt) : "",
      expiresAt: item.expiresAt ? toLocalInput(item.expiresAt) : "",
      dismissible: item.dismissible,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addLink = () => {
    const url = linkUrl.trim();
    const text = linkText.trim() || url;
    if (!/^https?:\/\//.test(url)) {
      toast.error("A URL precisa começar com https://");
      return;
    }
    wrapSelection(editorRef, `[${text}](${url})`, "", "link");
    setLinkModalOpen(false);
    setLinkText("");
    setLinkUrl("");
  };

  return (
    <div className="space-y-5">
      {/* ── Editor ─────────────────────────────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(330px,0.85fr)]">
        <div className="rounded-xl border border-white/[0.075] bg-[#22252b]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-white">
                {editingId !== null ? "Editar mensagem global" : "Nova mensagem global"}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#8e959f]">
                Markdown suportado: **negrito**, [links](https://…), títulos, listas.
              </p>
            </div>
            {editingId !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setEditor(EMPTY_EDITOR);
                }}
                className="text-xs text-[#9da4ae]"
              >
                <X className="h-3.5 w-3.5" /> Cancelar edição
              </Button>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                Título
              </Label>
              <Input
                value={editor.title}
                onChange={e => set({ title: e.target.value })}
                maxLength={120}
                placeholder="Exemplo: Mudança de domínio"
                className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white placeholder:text-[#68707b]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                  Tipo visual
                </Label>
                <Select
                  value={editor.type}
                  onValueChange={value => set({ type: value })}
                >
                  <SelectTrigger className="h-10 w-full border-white/[0.08] bg-[#17191e] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/[0.08] bg-[#24262c] text-white">
                    {TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex min-h-[40px] w-full items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#17191e] px-3">
                  <span className="text-xs font-semibold text-[#aeb4be]">
                    Dispensável (mostra o X)
                  </span>
                  <Switch
                    checked={editor.dismissible}
                    onCheckedChange={v => set({ dismissible: v })}
                    aria-label="Mensagem dispensável"
                  />
                </label>
              </div>
            </div>

            {/* Toolbar markdown */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                Mensagem (Markdown)
              </Label>
              <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-white/[0.08] border-b-0 bg-[#1a1c21] px-1.5 py-1">
                <ToolButton icon={Bold} label="Negrito" onClick={() => wrapSelection(editorRef, "**", "**")} />
                <ToolButton icon={Italic} label="Itálico" onClick={() => wrapSelection(editorRef, "*", "*")} />
                <ToolButton icon={Strikethrough} label="Riscado" onClick={() => wrapSelection(editorRef, "~~", "~~")} />
                <ToolButton icon={Link2} label="Inserir link" onClick={() => setLinkModalOpen(true)} />
                <ToolButton icon={Heading2} label="Subtítulo" onClick={() => wrapSelection(editorRef, "## ", "", "Título")} />
                <ToolButton icon={List} label="Lista" onClick={() => wrapSelection(editorRef, "- ", "", "item")} />
                <ToolButton icon={Code} label="Código" onClick={() => wrapSelection(editorRef, "`", "`")} />
              </div>
              <Textarea
                ref={editorRef}
                value={editor.content}
                onChange={e => set({ content: e.target.value })}
                maxLength={10_000}
                rows={9}
                placeholder={"**Importante:** servidores antigos serão desligados em 30 de agosto.\n\n[Abrir novo site](https://nexorachat.cloud)"}
                className="min-h-44 resize-y rounded-t-none border-white/[0.08] bg-[#17191e] text-sm leading-6 text-white placeholder:text-[#68707b]"
              />
              <div className="flex items-center justify-between text-[10px] text-[#69717c]">
                <span>HTML não é interpretado (proteção contra XSS).</span>
                <span>{editor.content.length}/10000</span>
              </div>
            </div>

            {/* CTA opcional */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                  Botão (opcional)
                </Label>
                <Input
                  value={editor.buttonLabel}
                  onChange={e => set({ buttonLabel: e.target.value })}
                  maxLength={80}
                  placeholder="Ex.: Abrir novo site"
                  className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white placeholder:text-[#68707b]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                  Link do botão
                </Label>
                <Input
                  value={editor.buttonUrl}
                  onChange={e => set({ buttonUrl: e.target.value })}
                  maxLength={500}
                  placeholder="https://nexorachat.cloud"
                  className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white placeholder:text-[#68707b]"
                />
              </div>
            </div>

            {/* Agendamento */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                  Exibir a partir de (opcional)
                </Label>
                <Input
                  type="datetime-local"
                  value={editor.startsAt}
                  onChange={e => set({ startsAt: e.target.value })}
                  className="h-10 border-white/[0.08] bg-[#17191e] text-xs text-white [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                  Expira em (opcional)
                </Label>
                <Input
                  type="datetime-local"
                  value={editor.expiresAt}
                  onChange={e => set({ expiresAt: e.target.value })}
                  className="h-10 border-white/[0.08] bg-[#17191e] text-xs text-white [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
              <p className="flex items-center gap-1.5 text-[10px] text-[#858c96]">
                <LockKeyhole className="h-3.5 w-3.5" />
                A permissão é validada novamente pelo servidor.
              </p>
              <Button
                onClick={submit}
                disabled={!canPublish || createAnnouncement.isPending || editAnnouncement.isPending}
                className="bg-[#5865F2] px-4 text-white hover:bg-[#5664e6]"
              >
                {createAnnouncement.isPending || editAnnouncement.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {editingId !== null ? "Salvar alterações" : "Publicar para todos"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Preview (idêntico à entrega) ─────────────────────── */}
        <aside className="rounded-xl border border-white/[0.075] bg-[#1c1e23] p-4" aria-label="Prévia da mensagem">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7f8792]">
            Prévia (idêntica ao que o usuário recebe)
          </p>
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#24262c] p-4 shadow-xl">
            <OfficialIdentity />
            <div className="ml-[52px] mt-2">
              <h3 className="break-words text-sm font-bold text-white">
                {editor.title.trim() || "Título da mensagem"}
              </h3>
              {editor.content.trim() ? (
                <MarkdownRenderer content={editor.content} className="mt-1.5 text-xs" />
              ) : (
                <p className="mt-1.5 text-xs leading-5 text-[#7f8792]">
                  A mensagem com **markdown**, links e listas aparece aqui.
                </p>
              )}
              {editor.buttonLabel.trim() && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3.5 py-1.5 text-xs font-bold text-white">
                  {editor.buttonLabel} <span aria-hidden>→</span>
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#f0a64a]/20 bg-[#f0a64a]/[0.06] px-3 py-2.5">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f1b462]" />
            <p className="text-[10px] leading-4 text-[#9da4ae]">
              Links externos abrem em nova aba com noopener. Scripts/HTML nunca são executados.
            </p>
          </div>
        </aside>
      </section>

      {/* ── Histórico ──────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#22252b]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-white">Histórico de mensagens globais</h2>
            <p className="mt-0.5 text-[10px] text-[#858c96]">
              Ativas, agendadas e arquivadas — com métricas.
            </p>
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
            {announcements.data.items.map(item => (
              <HistoryRow
                key={item.id}
                item={item}
                onEdit={() => startEdit(item)}
                onDuplicate={() => duplicateAnnouncement.mutate({ announcementId: item.id })}
                onArchive={() => archiveAnnouncement.mutate({ announcementId: item.id })}
                onDelete={() => setDeleteTarget(item)}
                busy={
                  archiveAnnouncement.isPending ||
                  duplicateAnnouncement.isPending ||
                  deleteAnnouncement.isPending
                }
              />
            ))}
          </div>
        ) : (
          <p className="px-4 py-12 text-center text-xs text-[#858c96]">
            Nenhuma mensagem publicada ainda.
          </p>
        )}
      </section>

      {/* Modal de link */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-sm border-white/10 bg-[#24262c] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Adicionar link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                Texto
              </Label>
              <Input
                value={linkText}
                onChange={e => setLinkText(e.target.value)}
                placeholder="Novo site da Nexora"
                className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                URL
              </Label>
              <Input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://nexorachat.cloud"
                className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setLinkModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={addLink}
                disabled={!/^https?:\/\//.test(linkUrl.trim())}
                className="bg-[#5865F2] text-white hover:bg-[#5664e6]"
              >
                <Link2 className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={deleteTarget !== null} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm border-white/10 bg-[#24262c] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Excluir mensagem global?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#9da4ae]">
            “{deleteTarget?.title}” será removida permanentemente para todos os usuários.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteAnnouncement.isPending}
              onClick={() =>
                deleteTarget &&
                deleteAnnouncement.mutate({ announcementId: deleteTarget.id })
              }
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toLocalInput(value: string | Date): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function HistoryRow({
  item,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  busy,
}: {
  item: OfficialAnnouncementDTO;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const stats = trpc.admin.announcementStats.useQuery(
    { announcementId: item.id },
    { staleTime: 30_000 },
  );
  const [now] = useState(() => Date.now());
  const scheduled = item.startsAt && new Date(item.startsAt).getTime() > now;
  return (
    <article className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-[#9ca4b0]">
        <Megaphone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-xs font-bold text-[#f0f1f3]">{item.title}</h3>
          <span
            className={cn(
              "rounded-[4px] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
              !item.isActive
                ? "bg-white/[0.055] text-[#7f8792]"
                : scheduled
                  ? "bg-[#f0b232]/15 text-[#f0b232]"
                  : "bg-[#39a768]/15 text-[#67cc90]",
            )}
          >
            {!item.isActive ? "Inativa" : scheduled ? "Agendada" : "Ativa"}
          </span>
          <span className="rounded-[4px] bg-white/[0.045] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#9ca3ad]">
            {item.contentFormat === "MARKDOWN" ? "Markdown" : "Texto"}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#969da7]">
          {item.content}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-[#68707b]">
          <span>Criada em {formatDate(item.publishedAt)}</span>
          {item.expiresAt && <span>Expira em {formatDate(item.expiresAt)}</span>}
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" /> {stats.data?.views ?? 0} visualizações
          </span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3 w-3" /> {item.clicks} cliques
          </span>
          {stats.data && stats.data.dismissals > 0 && (
            <span>{stats.data.dismissals} dispensas</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" title="Editar" aria-label={`Editar ${item.title}`} onClick={onEdit} className="text-[#969da7] hover:bg-white/[0.06] hover:text-white">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" title="Duplicar" aria-label={`Duplicar ${item.title}`} onClick={onDuplicate} disabled={busy} className="text-[#969da7] hover:bg-white/[0.06] hover:text-white">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {item.isActive && (
          <Button variant="ghost" size="icon-sm" title="Desativar" aria-label={`Desativar ${item.title}`} onClick={onArchive} disabled={busy} className="text-[#969da7] hover:bg-[#f0b232]/10 hover:text-[#f0b232]">
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" title="Excluir" aria-label={`Excluir ${item.title}`} onClick={onDelete} disabled={busy} className="text-[#969da7] hover:bg-[#ed4245]/10 hover:text-[#ff8c8f]">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
