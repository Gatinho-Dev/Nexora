import { Link } from "react-router";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { IconRules } from "@/components/icons/figmaChannelIcons";

/** Minimal internal pages for Terms of Service / Community Guidelines. */
export function LegalPage({ kind }: { kind: "terms" | "guidelines" }) {
  const isTerms = kind === "terms";
  return (
    <main className="min-h-[100dvh] bg-chat px-6 py-12 text-bodyx">
      <div className="mx-auto max-w-2xl">
        {kind === "guidelines" ? (
          <IconRules className="h-11 w-11 text-[#5865F2]" />
        ) : (
          <NexoraAppIcon decorative className="h-10 w-10" />
        )}
        <h1 className="mt-4 text-2xl font-extrabold text-white">
          {isTerms ? "Termos de Serviço do Nexora" : "Diretrizes da Comunidade do Nexora"}
        </h1>
        <p className="mt-1 text-xs text-faint">Última atualização: agosto de 2026</p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed">
          {isTerms ? (
            <>
              <p>
                Ao utilizar o Nexora você concorda em usar a plataforma de
                forma responsável, respeitando outros usuários e a legislação
                aplicável.
              </p>
              <p>
                Contas que violarem estas condições podem receber limitações,
                suspensões temporárias ou banimento permanente, conforme o
                Status da Conta e o sistema de infrações.
              </p>
              <p>
                Mídias enviadas ao Nexora passam por verificação automática de
                segurança. Conteúdo proibido é bloqueado e pode gerar
                ocorrências revisadas pela moderação.
              </p>
            </>
          ) : (
            <>
              <p>
                Não publique conteúdo sexual envolvendo menores — essa é uma
                violação gravíssima que resulta em bloqueio imediato da mídia,
                suspensão automática e revisão humana obrigatória.
              </p>
              <p>
                Conteúdo adulto (+18) pode permanecer na plataforma apenas
                quando sinalizado pela segurança e oculto por padrão, com
                revelação mediante aviso.
              </p>
              <p>
                Trate as pessoas com respeito: assédio, discurso de ódio,
                violência gratuita e spam resultam em infrações no Status da
                sua conta.
              </p>
            </>
          )}
        </div>

        <Link
          to="/channels/@me"
          className="mt-8 inline-block rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#4752C4]"
        >
          Voltar ao Nexora
        </Link>
      </div>
    </main>
  );
}
