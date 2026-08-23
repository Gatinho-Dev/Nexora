import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Inbox, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export function DMRequests() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const conversations = trpc.dm.list.useQuery();
  const requests = (conversations.data ?? []).filter(c => c.isRequest);

  const deleteConversation = trpc.dm.delete.useMutation({
    onSuccess: () => utils.dm.list.invalidate(),
    onError: e => toast.error(e.message),
  });

  return (
    <div className="flex flex-1 flex-col items-center bg-[#313338] p-8 text-white select-none">
      <div className="w-full max-w-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5865F2]/20 text-[#9aa5ff]">
            <Inbox className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold">Solicitações de mensagem</h1>
            <p className="text-xs text-[#B5BAC1]">
              Pessoas fora da sua lista de amigos que te enviaram mensagem.
            </p>
          </div>
        </div>

        {conversations.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#B5BAC1]" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Inbox className="h-10 w-10 text-[#80848E]" />
            <p className="text-sm font-semibold">Sem solicitações</p>
            <p className="max-w-xs text-xs text-[#B5BAC1]">
              Quando alguém que não é seu amigo te mandar mensagem, o convite
              aparece aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map(conv => {
              const other = conv.otherUser;
              return (
                <div
                  key={conv.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#2B2D31] p-3.5"
                >
                  {other && (
                    <Avatar
                      userId={other.id}
                      name={other.name ?? other.username}
                      src={other.avatar}
                      size="md"
                      showStatus
                      statusOverride={other.status ?? "online"}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {other?.name ?? other?.username ?? "Usuário"}
                    </p>
                    <p className="truncate text-xs text-[#B5BAC1]">
                      {conv.lastMessage?.content || "📎 Anexo enviado"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/channels/@me/${conv.id}`)}
                    className="bg-[#5865F2] hover:bg-[#4752C4] text-xs font-bold"
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={deleteConversation.isPending}
                    onClick={() => deleteConversation.mutate({ conversationId: conv.id })}
                    title="Excluir solicitação"
                    aria-label="Excluir solicitação"
                    className="text-[#B5BAC1] hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => navigate("/channels/@me")}
          className="mt-6 flex items-center gap-1.5 text-xs text-[#B5BAC1] transition-colors hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Voltar
        </button>
      </div>
    </div>
  );
}
