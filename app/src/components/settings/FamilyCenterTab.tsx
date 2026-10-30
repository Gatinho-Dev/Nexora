import { HeartHandshake, ShieldCheck, UserRoundCog } from "lucide-react";
import {
  DiscordCard,
  DiscordPageHeader,
} from "@/components/settings/DiscordSettings";

/**
 * "Central da Família".
 *
 * A Nexora ainda não expõe um backend de supervisão parental, então esta tela é
 * um estado vazio honesto: nada é simulado, nada é inventado. Os dois caminhos
 * possíveis (criar um grupo familiar ou vincular uma conta de responsável) ficam
 * visíveis e explained, e o usuário é encaminhado para o suporte, que é o canal
 * que existe hoje na plataforma.
 */
export function FamilyCenterTab({ onNavigate }: { onNavigate: (tab: "support") => void }) {
  return (
    <div className="space-y-6">
      <DiscordPageHeader
        title="Central da Família"
        description="Supervisão não intrusiva para contas de menores, vinculada à conta de um responsável."
      />

      <DiscordCard
        tone="accent"
        icon={<HeartHandshake className="size-4" />}
        title="Nenhum grupo familiar vinculado"
        description="Quando um responsável vincular a conta, esta página passa a listar quem pode solicitar conversa, por quanto tempo e com qual visibilidade — sempre visível para os dois lados."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled
            className="min-h-16 cursor-not-allowed rounded-lg border border-white/[0.08] bg-[#1E1F22] px-4 py-3 text-left text-[#B5BAC1] opacity-60"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <UserRoundCog className="size-4" aria-hidden />
              Criar grupo familiar
            </span>
            <span className="mt-1 block text-[11px] leading-snug">
              Disponível quando a conta de um responsável for vinculada.
            </span>
          </button>
          <button
            type="button"
            disabled
            className="min-h-16 cursor-not-allowed rounded-lg border border-white/[0.08] bg-[#1E1F22] px-4 py-3 text-left text-[#B5BAC1] opacity-60"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <ShieldCheck className="size-4" aria-hidden />
              Vincular conta de responsável
            </span>
            <span className="mt-1 block text-[11px] leading-snug">
              Exige uma conta Nexora verificada do responsável.
            </span>
          </button>
        </div>
      </DiscordCard>

      <DiscordCard title="Precisa de ajuda agora?">
        <button
          type="button"
          onClick={() => onNavigate("support")}
          className="min-h-11 w-full rounded-lg bg-[#5865F2] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#4752C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
        >
          Abrir um ticket de suporte
        </button>
        <p className="mt-2 text-[11px] text-[#B5BAC1]">
          Escolha a categoria <span className="text-white">Conta</span> e explique a
          situação. A equipe responde por lá.
        </p>
      </DiscordCard>
    </div>
  );
}
