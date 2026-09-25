import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  DiscordCard,
  DiscordDangerButton,
} from "@/components/settings/DiscordSettings";

type Intent = "deactivate" | "delete" | null;

const INTENTS: Record<
  Exclude<Intent, null>,
  { title: string; subject: string; message: string }
> = {
  deactivate: {
    title: "Desativar conta",
    subject: "Desativação de conta solicitada",
    message:
      "Quero desativar temporariamente minha conta Nexora. Confirmem os efeitos (visibilidade do perfil, servidores e mensagens) e informem como reativo depois.",
  },
  delete: {
    title: "Excluir conta",
    subject: "Exclusão de conta solicitada",
    message:
      "Quero excluir permanentemente minha conta Nexora e todos os dados associados. Confirmem o procedimento, a janela de exclusão definitiva e o que acontece com mensagens em servidores.",
  },
};

/**
 * Zona de risco da conta.
 *
 * A Nexora não tem autoatendimento de exclusão (o backend `account` não expõe
 * nenhum procedimento destrutivo), então os dois botões abrem um pedido
 * autenticado no fluxo que já existe: um ticket na categoria "Conta". Nada é
 * simulado e nenhum dado é apagado silenciosamente.
 */
export function AccountDangerZone() {
  const { user } = useAuth();
  const [pending, setPending] = useState<Intent>(null);
  const createTicket = trpc.advanced.support.createTicket.useMutation({
    onSuccess: () => {
      toast.success("Pedido registrado. A equipe responde pelo ticket.");
      setPending(null);
    },
    onError: error => toast.error(error.message),
  });

  const submit = () => {
    if (!pending) return;
    const intent = INTENTS[pending];
    createTicket.mutate({
      subject: `${intent.subject} — ${user?.username ?? user?.name ?? "conta"}`,
      message: intent.message,
      category: "account",
    });
  };

  return (
    <DiscordCard
      tone="danger"
      icon={<AlertTriangle className="size-4" />}
      title="Gerenciamento da conta"
      description="Ações irreversíveis ou que exigem verificação de identidade."
    >
      {pending ? (
        <div className="space-y-3 rounded-lg border border-[#ED4245]/30 bg-[#1E1F22] p-4">
          <p className="text-[13px] font-bold text-white">{INTENTS[pending].title}</p>
          <p className="text-[11px] leading-relaxed text-[#B5BAC1]">
            A Nexora não executa essa ação automaticamente. Ao continuar, um ticket
            é aberto na categoria <span className="text-white">Conta</span> e a equipe
            confirma identidade e efeitos antes de qualquer mudança.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={createTicket.isPending}
              className="min-h-10 rounded-lg border border-[#ED4245] px-4 py-2 text-[13px] font-semibold text-[#ED4245] transition-colors hover:bg-[#ED4245] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createTicket.isPending ? "Enviando..." : "Abrir pedido"}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="min-h-10 rounded-lg border border-white/10 px-4 py-2 text-[13px] font-semibold text-[#B5BAC1] transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <DiscordDangerButton onClick={() => setPending("deactivate")}>
            Desativar conta
          </DiscordDangerButton>
          <DiscordDangerButton onClick={() => setPending("delete")}>
            Excluir conta
          </DiscordDangerButton>
        </div>
      )}
    </DiscordCard>
  );
}
