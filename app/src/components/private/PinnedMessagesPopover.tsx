import { Pin, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function PinnedMessagesPopover({
  conversationId,
  canUnpin,
}: {
  conversationId: number;
  canUnpin: boolean;
}) {
  const utils = trpc.useUtils();
  const pins = trpc.group.listPins.useQuery({ conversationId });
  const unpin = trpc.group.unpinMessage.useMutation({
    onSuccess: () => {
      void utils.group.listPins.invalidate({ conversationId });
      toast.success("Fixação removida.");
    },
    onError: error => toast.error(error.message),
  });

  const jumpTo = (messageId: number) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) {
      toast.info("Carregue mensagens anteriores para abrir esta fixação.");
      return;
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ring-1", "ring-primary/60", "bg-primary/10");
    window.setTimeout(
      () =>
        element.classList.remove(
          "ring-1",
          "ring-primary/60",
          "bg-primary/10",
        ),
      1600,
    );
  };

  const count = pins.data?.pins.length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-8 w-8 place-items-center rounded-lg text-muted2 transition-colors hover:bg-hov hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Mensagens fixadas${count ? `, ${count}` : ""}`}
          title="Mensagens fixadas"
        >
          <Pin className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(360px,calc(100vw-24px))] border-border bg-panel p-0"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-foreground">Mensagens fixadas</h2>
          <p className="mt-0.5 text-[11px] text-muted2">
            {count === 1 ? "1 item importante" : `${count} itens importantes`}
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {pins.isLoading ? (
            <div className="space-y-2 p-2" aria-label="Carregando fixações">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-act" />
              ))}
            </div>
          ) : pins.isError ? (
            <p className="px-3 py-8 text-center text-xs text-muted2">
              Não foi possível carregar as fixações.
            </p>
          ) : count === 0 ? (
            <div className="px-5 py-10 text-center">
              <Pin className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-3 text-xs font-semibold text-foreground">
                Nenhuma mensagem fixada
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted2">
                Use o menu de uma mensagem para mantê-la fácil de encontrar.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {pins.data?.pins.map(pin => (
                <article
                  key={pin.messageId}
                  className="group flex items-start gap-2 rounded-lg px-2 py-2.5 hover:bg-hov"
                >
                  <button
                    type="button"
                    onClick={() => jumpTo(pin.messageId)}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none"
                  >
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {pin.message?.author.name ??
                        pin.message?.author.username ??
                        "Mensagem"}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted2">
                      {pin.message?.content || "Anexo enviado"}
                    </span>
                  </button>
                  {canUnpin && (
                    <button
                      type="button"
                      onClick={() =>
                        unpin.mutate({ conversationId, messageId: pin.messageId })
                      }
                      disabled={unpin.isPending}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted2 hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remover fixação"
                      title="Remover fixação"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
