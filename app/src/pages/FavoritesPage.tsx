import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  FolderHeart,
  GripVertical,
  Hash,
  MessageCircle,
  Server,
  StarOff,
  TextQuote,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const labels = {
  server: { name: "Servidor", icon: Server },
  channel: { name: "Canal", icon: Hash },
  dm: { name: "Mensagem direta", icon: MessageCircle },
  thread: { name: "Thread", icon: TextQuote },
} as const;

export function FavoritesPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const favorites = trpc.advanced.profile.favorites.useQuery();
  const [order, setOrder] = useState<number[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  useEffect(() => {
    if (favorites.data) setOrder(favorites.data.map(item => item.id));
  }, [favorites.data]);

  const ordered = useMemo(() => {
    const byId = new Map((favorites.data ?? []).map(item => [item.id, item]));
    return order.flatMap(id => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [favorites.data, order]);

  const reorder = trpc.advanced.profile.reorderFavorites.useMutation({
    onSuccess: () => void utils.advanced.profile.favorites.invalidate(),
    onError: error => {
      toast.error(error.message);
      void favorites.refetch();
    },
  });
  const remove = trpc.advanced.profile.setFavorite.useMutation({
    onSuccess: () => void utils.advanced.profile.favorites.invalidate(),
    onError: error => toast.error(error.message),
  });

  const commitOrder = (next: number[]) => {
    setOrder(next);
    reorder.mutate({ ids: next });
  };
  const moveTo = (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    const next = order.filter(id => id !== sourceId);
    next.splice(Math.max(0, next.indexOf(targetId)), 0, sourceId);
    commitOrder(next);
  };
  const moveBy = (id: number, direction: -1 | 1) => {
    const index = order.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    commitOrder(next);
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-chat text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-chat/90 px-4 py-4 backdrop-blur-xl sm:px-7">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <FolderHeart className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold">Favoritos</h1>
            <p className="text-xs text-muted2">
              Servidores, canais, conversas e threads sincronizados entre dispositivos.
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl p-4 sm:p-7" aria-live="polite">
        {favorites.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="h-20 animate-pulse rounded-xl bg-sidebar" />
            ))}
          </div>
        ) : favorites.isError ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-8 text-center">
            <p className="text-sm font-semibold">Não foi possível carregar seus favoritos.</p>
            <button type="button" onClick={() => favorites.refetch()} className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-xs font-bold text-white">
              Tentar novamente
            </button>
          </div>
        ) : ordered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <FolderHeart className="mx-auto size-10 text-faint" />
            <h2 className="mt-4 text-base font-bold">Nenhum favorito ainda</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted2">
              Use o menu de contexto de um servidor, canal, DM ou thread para adicioná-lo aqui.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ordered.map((item, index) => {
              const meta = labels[item.targetType];
              const Icon = meta.icon;
              return (
                <article
                  key={item.id}
                  draggable
                  onDragStart={event => {
                    setDraggedId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(item.id));
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault();
                    const sourceId = Number(event.dataTransfer.getData("text/plain"));
                    if (sourceId) moveTo(sourceId, item.id);
                    setDraggedId(null);
                  }}
                  className={cn(
                    "group flex min-h-20 items-center gap-3 rounded-xl border border-border bg-sidebar p-3 transition-[border-color,transform,opacity] hover:border-primary/35",
                    draggedId === item.id && "opacity-50"
                  )}
                >
                  <GripVertical className="hidden size-4 shrink-0 cursor-grab text-faint sm:block" aria-hidden />
                  {item.iconUrl ? (
                    <Avatar src={item.iconUrl} name={item.label} size="md" showStatus={false} />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                  )}
                  <button type="button" onClick={() => navigate(item.href)} className="min-w-0 flex-1 text-left focus-visible:outline-none">
                    <span className="block truncate text-sm font-bold">{item.label}</span>
                    <span className="mt-1 block truncate text-[11px] text-muted2">
                      {meta.name} · {item.context}
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center">
                    <button type="button" onClick={() => moveBy(item.id, -1)} disabled={index === 0 || reorder.isPending} className="grid size-10 place-items-center rounded-lg text-muted2 hover:bg-hov hover:text-foreground disabled:opacity-25 sm:hidden" aria-label={`Mover ${item.label} para cima`}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" onClick={() => moveBy(item.id, 1)} disabled={index === ordered.length - 1 || reorder.isPending} className="grid size-10 place-items-center rounded-lg text-muted2 hover:bg-hov hover:text-foreground disabled:opacity-25 sm:hidden" aria-label={`Mover ${item.label} para baixo`}>
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => remove.mutate({ targetType: item.targetType, targetId: item.targetId, favorite: false })} disabled={remove.isPending} className="grid size-10 place-items-center rounded-lg text-muted2 hover:bg-red-400/10 hover:text-red-300" aria-label={`Remover ${item.label} dos favoritos`}>
                      <StarOff className="size-4" />
                    </button>
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
