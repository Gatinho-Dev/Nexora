import { useEffect } from "react";
import { Link } from "react-router";
import { NexoraAppIcon } from "@/components/NexoraBrand";

/**
 * Páginas legais públicas (/privacy e /terms) — sem login, prontas para
 * registro OAuth no Roblox Creator Dashboard.
 */

function useDocTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function DocShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-[100dvh] bg-chat px-4 py-10 text-bodyx sm:px-6 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Nexora">
            <NexoraAppIcon decorative className="h-9 w-9" />
            <span className="text-lg font-extrabold text-white">Nexora</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/privacy" className="text-muted2 transition-colors hover:text-white">
              Política de Privacidade
            </Link>
            <Link to="/terms" className="text-muted2 transition-colors hover:text-white">
              Termos de Serviço
            </Link>
          </nav>
        </header>

        <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-xs text-faint">Última atualização: {updated}</p>

        <article className="mt-8 space-y-8">{children}</article>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-faint">
          <div className="flex flex-wrap gap-4">
            <Link to="/" className="hover:text-white">Início</Link>
            <Link to="/privacy" className="hover:text-white">Política de Privacidade</Link>
            <Link to="/terms" className="hover:text-white">Termos de Serviço</Link>
          </div>
          <Link
            to="/channels/@me"
            className="rounded-full bg-[#5865F2] px-4 py-1.5 font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            Voltar para Nexora
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Section({ n, t, children }: { n: number; t: string; children: React.ReactNode }) {
  return (
    <section id={`secao-${n}`}>
      <h2 className="text-base font-bold text-white">
        <span className="mr-2 text-[#7983F5]">{n}.</span>
        {t}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-bodyx/90">{children}</div>
    </section>
  );
}

const CONTATO =
  "Para questões relacionadas a privacidade ou aos Termos, utilize os canais oficiais de suporte disponíveis na Nexora.";
const ATUALIZACAO = "agosto de 2026";

export function PrivacyPage() {
  useDocTitle("Política de Privacidade | Nexora");
  return (
    <DocShell title="Política de Privacidade da Nexora" updated={ATUALIZACAO}>
      <p>
        A Nexora respeita a sua privacidade. Coletamos apenas as informações
        necessárias para o funcionamento da plataforma, para a segurança da
        comunidade e para integrações que você autorizar explicitamente.
      </p>

      <Section n={1} t="Informações coletadas">
        <p>Podemos coletar:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>nome de usuário e nome exibido;</li>
          <li>e-mail, quando você fornece;</li>
          <li>identificadores internos da sua conta;</li>
          <li>endereço IP, navegador, dispositivo e dados de sessão, para segurança;</li>
          <li>dados técnicos necessários ao funcionamento;</li>
          <li>mensagens, arquivos e conteúdos que você mesmo envia;</li>
          <li>informações de contas externas que você conecta voluntariamente.</li>
        </ul>
      </Section>

      <Section n={2} t="Integrações externas (Roblox)">
        <p>
          Você pode conectar contas de serviços externos, como o{" "}
          <strong>Roblox</strong>. Ao conectar o Roblox por OAuth — a página
          oficial de autorização do Roblox — recebemos somente informações
          básicas autorizadas por você, como ID da conta, nome de usuário, nome
          exibido, avatar, link público do perfil e, quando disponibilizado
          pelas APIs oficiais, informações de presença ou atividade.
        </p>
        <p>
          A Nexora <strong>não pede a senha do Roblox</strong> e não armazena
          senha de serviços externos. A autenticação acontece pelo sistema
          oficial OAuth, usa apenas as permissões necessárias e pode ser
          revogada por você a qualquer momento nas configurações ou no próprio
          Roblox.
        </p>
      </Section>

      <Section n={3} t="Uso das informações">
        <p>
          Usamos os dados para fornecer o serviço, manter a sua conta,
          autenticar acessos, mostrar perfil, presença e atividades, entregar
          mensagens, habilitar integrações, melhorar a segurança, prevenir
          abusos, investigar atividades suspeitas, corrigir erros e melhorar a
          experiência.
        </p>
      </Section>

      <Section n={4} t="Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais razoáveis para proteger
          as informações — como sessões assinadas, criptografia de credenciais
          de integrações em repouso e controle de acesso por sessão. Nenhum
          sistema é infalível, então não prometemos segurança absoluta.
        </p>
      </Section>

      <Section n={5} t="Endereço IP e dispositivos">
        <p>
          Endereço IP, navegador, dispositivo e informações de sessão são
          usados para identificar suas sessões, mostrar os dispositivos
          conectados à sua conta (Configurações → Dispositivos), prevenir
          acessos não autorizados, detectar atividades suspeitas e melhorar a
          segurança.
        </p>
      </Section>

      <Section n={6} t="Cookies e sessões">
        <p>
          Utilizamos cookies necessários para login, manutenção de sessão,
          segurança, preferências e funcionamento da plataforma. O cookie de
          sessão é HttpOnly e não é usado para publicidade.
        </p>
      </Section>

      <Section n={7} t="Compartilhamento de informações">
        <p>
          A Nexora <strong>não vende dados pessoais</strong>. Informações podem
          ser compartilhadas apenas quando necessário para o funcionamento com
          provedores de infraestrutura, cumprimento de obrigação legal,
          prevenção de fraude ou abuso, e com serviços externos que você mesmo
          autorizou.
        </p>
      </Section>

      <Section n={8} t="Conteúdo enviado">
        <p>
          Mensagens, imagens, arquivos e outros conteúdos enviados por você
          podem ser processados pela Nexora para oferecer os recursos do
          serviço e aplicar as regras de segurança da comunidade.
        </p>
      </Section>

      <Section n={9} t="Retenção de dados">
        <p>
          Mantemos informações apenas pelo tempo necessário para a prestação do
          serviço, segurança, obrigações legais e resolução de problemas.
        </p>
      </Section>

      <Section n={10} t="Exclusão da conta">
        <p>
          Quando disponível, você pode solicitar ou realizar a exclusão da sua
          conta. Alguns dados podem precisar ser mantidos por períodos
          limitados por razões legais ou de segurança.
        </p>
      </Section>

      <Section n={11} t="Contas conectadas">
        <p>
          Você pode desconectar contas externas em Configurações → Conexões.
          Ao desconectar o Roblox, a Nexora deixa de usar a autorização
          correspondente e remove os tokens armazenados quando aplicável.
        </p>
      </Section>

      <Section n={12} t="Serviços de terceiros">
        <p>
          Serviços externos possuem políticas próprias — por exemplo, Roblox,
          Render e outros provedores utilizados pela Nexora. Recomendamos ler
          as políticas de cada serviço; não fazemos declarações sobre termos
          que não controlamos.
        </p>
      </Section>

      <Section n={13} t="Crianças e adolescentes">
        <p>
          O uso da Nexora deve respeitar as regras definidas nos nossos Termos
          e as regras das plataformas conectadas, incluindo as regras de idade
          do próprio Roblox.
        </p>
      </Section>

      <Section n={14} t="Alterações nesta política">
        <p>
          Esta política pode ser atualizada. Alterações relevantes poderão ser
          comunicadas pela própria plataforma.
        </p>
      </Section>

      <Section n={15} t="Contato">
        <p>{CONTATO}</p>
      </Section>
    </DocShell>
  );
}

export function TermsPage() {
  useDocTitle("Termos de Serviço | Nexora");
  return (
    <DocShell title="Termos de Serviço da Nexora" updated={ATUALIZACAO}>
      <Section n={1} t="Aceitação dos Termos">
        <p>
          Ao criar uma conta ou utilizar a Nexora, você concorda com estes
          Termos e com a{" "}
          <Link to="/privacy" className="text-[#7983F5] hover:underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </Section>

      <Section n={2} t="Uso da Nexora">
        <p>Você deve usar a plataforma de forma legal e respeitosa.</p>
      </Section>

      <Section n={3} t="Conta do usuário">
        <p>
          Você é responsável por proteger suas credenciais e por toda atividade
          realizada na sua conta. A Nexora nunca solicita senha de serviços
          externos como parte de integrações OAuth.
        </p>
      </Section>

      <Section n={4} t="Condutas proibidas">
        <p>É proibido:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>assédio, ameaças, golpes e spam;</li>
          <li>malware, phishing e tentativa de roubo de conta;</li>
          <li>conteúdo ilegal, exploração infantil e abuso sexual;</li>
          <li>divulgar informações privadas sem autorização;</li>
          <li>tentar comprometer a segurança da plataforma;</li>
          <li>uso de bots maliciosos e tentativa de contornar sistemas de segurança;</li>
          <li>uso indevido de APIs, fraude e impersonação enganosa.</li>
        </ul>
      </Section>

      <Section n={5} t="Conteúdo do usuário">
        <p>
          Você mantém os direitos sobre o conteúdo que cria. Para o serviço
          funcionar, você concede à Nexora as permissões técnicas necessárias
          para armazenar, transmitir, processar e exibir esse conteúdo dentro
          da plataforma. A Nexora não se torna dona do seu conteúdo.
        </p>
      </Section>

      <Section n={6} t="Moderação">
        <p>
          Quando houver violação das regras, risco à segurança ou obrigação
          legal, a Nexora pode remover conteúdos, aplicar restrições, suspender
          ou banir contas e limitar recursos — sempre com revisão humana nas
          decisões graves, conforme o Status da Conta.
        </p>
      </Section>

      <Section n={7} t="Integrações com terceiros">
        <p>
          Integrações são opcionais e dependem de APIs e serviços de
          terceiros. Elas podem ficar indisponíveis, mudar ou ser removidas —
          a Nexora não controla o funcionamento de serviços externos.
        </p>
      </Section>

      <Section n={8} t="Roblox">
        <p>
          A conexão com o Roblox acontece por autorização OAuth oficial,
          quando disponível. A Nexora nunca pede a sua senha do Roblox. Os
          recursos dependem das APIs fornecidas pelo Roblox e a atividade ou
          presença pode não estar sempre disponível.
        </p>
        <p>
          O Roblox é um serviço independente da Nexora.{" "}
          <strong>
            Roblox é uma marca e serviço de terceiros e não é operado pela
            Nexora.
          </strong>{" "}
          Não há afiliação, patrocínio ou endosso.
        </p>
      </Section>

      <Section n={9} t="Disponibilidade">
        <p>
          Trabalhamos para manter a Nexora disponível, mas podem ocorrer
          manutenção, falhas, interrupções e indisponibilidade de serviços
          externos. Não prometemos uptime absoluto.
        </p>
      </Section>

      <Section n={10} t="Alterações no serviço">
        <p>Recursos podem ser adicionados, alterados ou removidos.</p>
      </Section>

      <Section n={11} t="Segurança">
        <p>
          Tentativas de invasão, exploração, bypass, scraping abusivo, ataques
          automatizados, DDoS ou roubo de tokens podem resultar em suspensão ou
          encerramento da conta.
        </p>
      </Section>

      <Section n={12} t="Suspensão e encerramento">
        <p>
          Contas podem ser suspensas ou encerradas por violações graves ou
          repetidas destes Termos.
        </p>
      </Section>

      <Section n={13} t="Exclusão de conta">
        <p>
          Você pode deixar de usar o serviço e, quando disponível, excluir a
          sua conta.
        </p>
      </Section>

      <Section n={14} t="Limitação razoável de responsabilidade">
        <p>
          A Nexora é fornecida conforme disponível. Buscamos qualidade, mas não
          conseguimos garantir ausência completa de erros ou interrupções. Na
          extensão permitida pela lei aplicável, a Nexora não responde por
          danos indiretos decorrentes do uso do serviço.
        </p>
      </Section>

      <Section n={15} t="Alterações dos Termos">
        <p>Estes Termos podem ser atualizados ao longo do tempo.</p>
      </Section>

      <Section n={16} t="Contato">
        <p>{CONTATO}</p>
      </Section>
    </DocShell>
  );
}
