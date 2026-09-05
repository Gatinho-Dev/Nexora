import { Bell, MessageSquare } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router";
import { trpc } from "@/providers/trpc";
import { DMSidebar } from "@/components/DMSidebar";
import { SidebarPortal } from "@/components/SidebarPortal";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppOutletContext } from "@/lib/appOutletContext";

export function FollowedThreadsPage() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const threads = trpc.advanced.messages.followedThreads.useQuery();
  return <div className="flex min-h-0 flex-1"><SidebarPortal><DMSidebar onOpenProfile={onOpenProfile} /></SidebarPortal><main className="flex min-w-0 flex-1 flex-col bg-chat text-white"><header className="border-b border-white/[0.06] px-4 py-4 sm:px-7"><h1 className="flex items-center gap-2 text-base font-bold"><Bell className="size-5 text-[#8290ff]" /> Threads seguidas</h1><p className="mt-1 text-xs text-muted2">Acompanhe conversas com todas as mensagens ou apenas menções.</p></header><section className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{threads.isLoading ? <div className="mx-auto max-w-3xl space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : threads.data?.length ? <div className="mx-auto max-w-3xl space-y-2">{threads.data.map(item => <button key={item.subscription.id} type="button" onClick={() => navigate(`/channels/${item.channel.serverId}/${item.channel.id}/t/${item.thread.id}`)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-sidebar px-4 text-left hover:border-[#7383ff]/30"><MessageSquare className="size-5 text-[#8290ff]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.thread.name}</span><span className="mt-1 block text-[11px] text-muted2">#{item.channel.name} · {item.subscription.level === "all" ? "todas as mensagens" : "apenas menções"}</span></span></button>)}</div> : <div className="grid min-h-72 place-items-center text-center"><div><MessageSquare className="mx-auto size-10 text-faint" /><p className="mt-3 text-sm font-bold">Nenhuma thread seguida</p><p className="mt-1 text-xs text-muted2">Abra uma thread e escolha o nível de notificação.</p></div></div>}</section></main></div>;
}
