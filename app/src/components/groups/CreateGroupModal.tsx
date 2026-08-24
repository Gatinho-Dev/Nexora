import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Check, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { GroupAvatar } from "./GroupAvatar";
import { GroupLimits } from "@contracts/constants";

type SelectedUser = {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
};

/**
 * Criação de grupo (itens 1-3): seleção de amigos com busca por nome/
 * @username e etapa final com nome opcional + imagem do grupo.
 */
export function CreateGroupModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SelectedUser[]>([]);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFileId, setAvatarFileId] = useState<number | undefined>();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const friends = trpc.friend.list.useQuery(undefined, {
    enabled: open,
  });
  const me = trpc.auth.me.useQuery().data;

  const acceptedFriends = useMemo(
    () =>
      (friends.data ?? [])
        .filter(f => f.status === "ACCEPTED")
        .map(f => f.user),
    [friends.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return acceptedFriends;
    return acceptedFriends.filter(
      u =>
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q),
    );
  }, [acceptedFriends, query]);

  const toggle = (u: SelectedUser) => {
    setSelected(prev =>
      prev.some(s => s.id === u.id)
        ? prev.filter(s => s.id !== u.id)
        : prev.length >= GroupLimits.MAX_MEMBERS - 1
          ? prev
          : [...prev, u],
    );
  };

  const totalMembers = selected.length + 1;
  const canContinue =
    selected.length >= GroupLimits.MIN_MEMBERS - 1 &&
    selected.length <= GroupLimits.MAX_MEMBERS - 1;

  const previewName = useMemo(() => {
    if (name.trim()) return name.trim();
    const names = [
      me?.name ?? me?.username ?? "Você",
      ...selected.map(s => s.name ?? s.username ?? "Usuário"),
    ];
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} e ${names[1]}`;
    if (names.length === 3) return `${names[0]}, ${names[1]} e ${names[2]}`;
    return `${names[0]}, ${names[1]}, ${names[2]} e +${names.length - 3}`;
  }, [name, selected, me]);

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

  const create = trpc.group.create.useMutation({
    onSuccess: async data => {
      await utils.dm.list.invalidate();
      onOpenChange(false);
      setStep(1);
      setSelected([]);
      setName("");
      setAvatarUrl(null);
      setAvatarFileId(undefined);
      navigate(`/channels/@me/${data.conversationId}`);
    },
    onError: e => toast.error(e.message),
  });

  const close = (v: boolean) => {
    if (!v) {
      setStep(1);
      setQuery("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" aria-hidden /> Criar grupo
              </DialogTitle>
              <DialogDescription>
                Selecione amigos para conversar em privado — sem precisar criar um servidor.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar amigos por nome ou @username"
                aria-label="Buscar amigos"
                className="pl-9"
              />
            </div>

            <div className="-mx-1 max-h-72 overflow-y-auto px-1" role="listbox" aria-label="Amigos">
              {friends.isLoading && (
                <p className="py-8 text-center text-xs text-muted2">Carregando amigos...</p>
              )}
              {!friends.isLoading && filtered.length === 0 && (
                <p className="py-8 text-center text-xs text-muted2">
                  Nenhum amigo encontrado.
                </p>
              )}
              {filtered.map(u => {
                const isSelected = selected.some(s => s.id === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(u)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-primary/15"
                        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
                    )}
                  >
                    <Avatar
                      userId={u.id}
                      name={u.name ?? u.username}
                      src={u.avatar}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-bodyx">
                        {u.name ?? u.username ?? "Usuário"}
                      </span>
                      {u.username && (
                        <span className="block truncate text-xs text-muted2">
                          @{u.username}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-border",
                      )}
                      aria-hidden
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>

            <DialogFooter className="items-center gap-2 sm:justify-between">
              <span className="text-xs font-medium text-muted2" aria-live="polite">
                {totalMembers} selecionado{totalMembers === 1 ? "" : "s"} (mín.{" "}
                {GroupLimits.MIN_MEMBERS}, máx. {GroupLimits.MAX_MEMBERS})
              </span>
              <Button
                disabled={!canContinue}
                onClick={() => setStep(2)}
                aria-label="Continuar para nomear o grupo"
              >
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Novo grupo</DialogTitle>
              <DialogDescription>
                O nome é opcional — sem ele, usamos os nomes dos participantes.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                create.mutate({
                  memberIds: selected.map(s => s.id),
                  name: name.trim() || undefined,
                  avatarFileId,
                });
              }}
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-border flex items-center justify-center transition-colors hover:border-primary"
                  aria-label="Escolher imagem do grupo"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted2" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6 text-muted2" aria-hidden />
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
                  <Label htmlFor="group-name">Nome do grupo</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={previewName}
                    maxLength={GroupLimits.MAX_NAME_LENGTH}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">
                  Participantes — {totalMembers}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  <li className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-bodyx">
                    Você
                  </li>
                  {selected.map(s => (
                    <li
                      key={s.id}
                      className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-bodyx"
                    >
                      {s.name ?? s.username ?? "Usuário"}
                      <button
                        type="button"
                        onClick={() => toggle(s)}
                        aria-label={`Remover ${s.name ?? s.username}`}
                        className="text-muted2 hover:text-destructive"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                {!avatarUrl && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted2">
                    <GroupAvatar users={selected} size="xs" />
                    Sem imagem? Geramos um mosaico com os avatares dos participantes.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </Button>
                <Button type="submit" disabled={create.isPending || uploading}>
                  {create.isPending ? "Criando..." : "Criar grupo"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
