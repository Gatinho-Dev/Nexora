import { useDeferredValue, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { FileSearch, Loader2, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { DMSidebar } from "@/components/DMSidebar";
import { SidebarPortal } from "@/components/SidebarPortal";
import { Avatar } from "@/components/Avatar";
import { MessageContent } from "@/components/chat/MessageContent";
import { Input } from "@/components/ui/input";
import type { AppOutletContext } from "@/lib/appOutletContext";

export function GlobalSearchPage() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const results = trpc.advanced.messages.search.useQuery(
    { query: deferred, limit: 30 },
    { enabled: deferred.length > 0 },
  );
  return (
    <div className="flex min-h-0 flex-1">
      <SidebarPortal><DMSidebar onOpenProfile={onOpenProfile} /></SidebarPortal>
      <main className="flex min-w-0 flex-1 flex-col bg-chat text-white">
        <header className="border-b border-white/[0.06] px-4 py-4 sm:px-7">
          <h1 className="flex items-center gap-2 text-base font-bold"><Search className="size-5 text-[#8290ff]" /> Busca global</h1>
          <div className="relative mt-3 max-w-3xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={query} onChange={event => setQuery(event.target.value)} autoFocus placeholder='Busque naturalmente ou use from:, in:, server:, before:, after:, has: e mentions:' className="min-h-11 pl-9" />
          </div>
          <p className="mt-2 text-[10px] text-faint">Exemplo: mensagens do Daniel com imagens de agosto</p>
        </header>
        <section className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {!deferred ? <div className="grid min-h-72 place-items-center text-center"><div><FileSearch className="mx-auto size-12 text-faint" /><p className="mt-3 text-sm font-bold">Encontre qualquer conversa</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted2">A busca respeita suas permissões e nunca retorna canais privados aos quais você não tem acesso.</p></div></div> : results.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-6 animate-spin text-[#8290ff]" /></div> : results.isError ? <div className="grid min-h-72 place-items-center text-center"><div><p className="text-sm font-bold">Não foi possível buscar</p><button type="button" onClick={() => results.refetch()} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-bold">Tentar novamente</button></div></div> : results.data?.items.length ? (
            <div className="mx-auto max-w-4xl space-y-2">
              {results.data.items.map(item => (
                <button key={item.message.id} type="button" onClick={() => item.context.conversationId ? navigate(`/channels/@me/${item.context.conversationId}`) : navigate(`/channels/${item.context.serverId}/${item.context.channelId}`)} className="flex w-full gap-3 rounded-2xl border border-white/[0.07] bg-sidebar p-4 text-left hover:border-[#7383ff]/30 hover:bg-white/[0.035]">
                  <Avatar userId={item.message.authorId} name={item.message.author.name ?? item.message.author.username} src={item.message.author.avatar} size="sm" />
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold">{item.message.author.name ?? item.message.author.username}</span><span className="text-[10px] text-[#aab2ff]">{item.context.channelName ? `#${item.context.channelName}` : "Mensagem direta"}</span><span className="text-[10px] text-faint">{new Date(item.message.createdAt).toLocaleString("pt-BR")}</span></span><span className="mt-1 line-clamp-4 block text-sm leading-6 text-bodyx"><MessageContent content={item.message.content} /></span></span>
                </button>
              ))}
            </div>
          ) : <div className="grid min-h-72 place-items-center text-center"><div><p className="text-sm font-bold">Nenhum resultado</p><p className="mt-1 text-xs text-muted2">Tente outros termos ou remova um filtro.</p></div></div>}
        </section>
      </main>
    </div>
  );
}
