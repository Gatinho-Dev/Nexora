import { useDeferredValue, useState } from "react";
import { useOutletContext } from "react-router";
import { Bookmark, Folder, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { DMSidebar } from "@/components/DMSidebar";
import { SidebarPortal } from "@/components/SidebarPortal";
import { Avatar } from "@/components/Avatar";
import { MessageContent } from "@/components/chat/MessageContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppOutletContext } from "@/lib/appOutletContext";
import { cn } from "@/lib/utils";

export function SavedMessagesPage() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const utils = trpc.useUtils();
  const [folderId, setFolderId] = useState<number | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [folderName, setFolderName] = useState("");
  const deferredQuery = useDeferredValue(query);
  const folders = trpc.advanced.messages.folders.useQuery();
  const saved = trpc.advanced.messages.saved.useQuery({ folderId, query: deferredQuery });
  const unsave = trpc.advanced.messages.unsave.useMutation({
    onSuccess: () => void utils.advanced.messages.saved.invalidate(),
    onError: error => toast.error(error.message),
  });
  const createFolder = trpc.advanced.messages.upsertFolder.useMutation({
    onSuccess: () => {
      setFolderName("");
      toast.success("Pasta criada.");
      void utils.advanced.messages.folders.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  return (
    <div className="flex min-h-0 flex-1">
      <SidebarPortal><DMSidebar onOpenProfile={onOpenProfile} /></SidebarPortal>
      <main className="flex min-w-0 flex-1 flex-col bg-chat text-white">
        <header className="border-b border-white/[0.06] px-4 py-4 sm:px-7">
          <h1 className="flex items-center gap-2 text-base font-bold"><Bookmark className="size-5 text-[#8290ff]" /> Mensagens salvas</h1>
          <p className="mt-1 text-xs text-muted2">Sua coleção é privada e sincronizada entre dispositivos.</p>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-white/[0.06] p-3 md:w-56 md:border-b-0 md:border-r">
            <div className="flex gap-2">
              <Input value={folderName} onChange={event => setFolderName(event.target.value)} maxLength={64} placeholder="Nova pasta" aria-label="Nome da pasta" />
              <Button size="icon" disabled={!folderName.trim() || createFolder.isPending} onClick={() => createFolder.mutate({ name: folderName.trim(), color: "#7383ff" })} aria-label="Criar pasta"><Plus className="size-4" /></Button>
            </div>
            <nav className="mt-3 flex gap-1 overflow-x-auto md:block md:space-y-1" aria-label="Pastas de mensagens salvas">
              <button type="button" onClick={() => setFolderId(undefined)} className={cn("min-h-10 shrink-0 rounded-lg px-3 text-left text-xs font-semibold md:w-full", folderId === undefined ? "bg-[#4654d8]/20 text-white" : "text-muted2 hover:bg-white/[0.05]")}>Todas</button>
              <button type="button" onClick={() => setFolderId(null)} className={cn("min-h-10 shrink-0 rounded-lg px-3 text-left text-xs font-semibold md:w-full", folderId === null ? "bg-[#4654d8]/20 text-white" : "text-muted2 hover:bg-white/[0.05]")}>Sem pasta</button>
              {folders.data?.map(folder => (
                <button key={folder.id} type="button" onClick={() => setFolderId(folder.id)} className={cn("flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold md:w-full", folderId === folder.id ? "bg-[#4654d8]/20 text-white" : "text-muted2 hover:bg-white/[0.05]")}>
                  <Folder className="size-3.5" style={{ color: folder.color }} /> <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </nav>
          </aside>
          <section className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="relative mb-4 max-w-xl">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no conteúdo salvo" className="pl-9" />
            </div>
            {saved.isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin text-[#8290ff]" /></div> : saved.data?.length ? (
              <div className="mx-auto max-w-3xl space-y-2">
                {saved.data.map(item => (
                  <article key={item.id} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-sidebar p-4">
                    <button type="button" onClick={() => onOpenProfile?.(item.message.authorId)} className="h-fit rounded-full"><Avatar userId={item.message.authorId} name={item.message.author.name ?? item.message.author.username} src={item.message.author.avatar} size="sm" /></button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold">{item.message.author.name ?? item.message.author.username}</span><span className="text-[10px] text-faint">{new Date(item.message.createdAt).toLocaleString("pt-BR")}</span></div>
                      <div className="mt-1 text-sm leading-6 text-bodyx"><MessageContent content={item.message.content} /></div>
                      {item.tags?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{item.tags.map(tag => <span key={tag} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted2">#{tag}</span>)}</div>}
                    </div>
                    <Button size="icon-sm" variant="ghost" disabled={unsave.isPending} onClick={() => unsave.mutate({ messageId: item.message.id })} aria-label="Remover das mensagens salvas" title="Remover"><Trash2 className="size-4 text-red-400" /></Button>
                  </article>
                ))}
              </div>
            ) : <div className="grid min-h-64 place-items-center text-center"><div><Bookmark className="mx-auto size-10 text-faint" /><p className="mt-3 text-sm font-bold">Nada salvo aqui</p><p className="mt-1 text-xs text-muted2">Use “Salvar mensagem” no menu de qualquer mensagem.</p></div></div>}
          </section>
        </div>
      </main>
    </div>
  );
}
