import { Loader2, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ChannelPinsPopover({ channelId, canManage }: { channelId: number; canManage: boolean }) {
  const utils = trpc.useUtils();
  const pins = trpc.advanced.messages.pins.useQuery({ channelId });
  const setPinned = trpc.advanced.messages.setPinned.useMutation({
    onSuccess: () => void utils.advanced.messages.pins.invalidate({ channelId }),
    onError: error => toast.error(error.message),
  });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="grid size-9 place-items-center rounded-lg text-muted2 hover:bg-white/10 hover:text-white" aria-label="Mensagens fixadas" title="Mensagens fixadas">
          <Pin className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-24px))] border-white/10 bg-panel p-0 text-white">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <p className="text-sm font-bold">Mensagens fixadas</p>
          <p className="mt-0.5 text-[10px] text-muted2">Conteúdo importante deste canal.</p>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {pins.isLoading ? <div className="grid h-28 place-items-center"><Loader2 className="size-5 animate-spin text-[#8290ff]" /></div> : pins.data?.length ? pins.data.map(item => (
            <button key={item.id} type="button" onClick={() => document.getElementById(`msg-${item.message.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="group flex w-full gap-3 rounded-xl p-3 text-left hover:bg-white/[0.05]">
              <Avatar userId={item.message.authorId} name={item.message.author.name ?? item.message.author.username} src={item.message.author.avatar} size="xs" showStatus={false} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white">{item.message.author.name ?? item.message.author.username}</span>
                <span className="mt-1 line-clamp-3 block whitespace-pre-wrap text-xs leading-5 text-muted2">{item.message.content || "Anexo"}</span>
              </span>
              {canManage && (
                <Button size="icon-sm" variant="ghost" disabled={setPinned.isPending} onClick={event => { event.stopPropagation(); setPinned.mutate({ messageId: item.message.id, pinned: false }); }} aria-label="Desafixar mensagem" title="Desafixar">
                  <PinOff className="size-3.5 text-red-400" />
                </Button>
              )}
            </button>
          )) : <p className="px-4 py-10 text-center text-xs text-muted2">Nenhuma mensagem fixada.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
