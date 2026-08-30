import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Ban,
  BarChart3,
  Bot,
  Check,
  Hash,
  Menu,
  MessagesSquare,
  Mic,
  MonitorSmartphone,
  MonitorUp,
  Palette,
  Paperclip,
  Server,
  ShieldCheck,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { NexoraAppIcon, NexoraMark } from "@/components/NexoraBrand";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/lib/seo";
import heroImage from "@/assets/landing/nexora-hero.webp";
import communityImage from "@/assets/landing/nexora-community.webp";
import voiceImage from "@/assets/landing/nexora-voice.webp";
import "./Landing.css";

/** FAQ real da plataforma — renderizada na landing e usada no JSON-LD (FAQPage). */
const FAQ_ITEMS = [
  {
    q: "O que é a Nexora?",
    a: "Uma plataforma de comunicação com mensagens em tempo real, comunidades com canais de texto e voz, chamadas de vídeo e compartilhamento de arquivos.",
  },
  {
    q: "A Nexora é gratuita?",
    a: "Sim. Criar uma conta, conversar e participar de comunidades é gratuito.",
  },
  {
    q: "Posso criar minha própria comunidade?",
    a: "Pode. Em poucos cliques você cria um servidor com canais, cargos e convites para chamar quem quiser.",
  },
  {
    q: "A Nexora funciona no celular?",
    a: "Funciona no navegador do computador e do celular, com layout adaptado para telas pequenas.",
  },
  {
    q: "Como a Nexora cuida da segurança?",
    a: "Há denúncias, bloqueios, moderação de conteúdo e ferramentas de controle da sua conta. Os detalhes estão nas Diretrizes da Comunidade e na Política de Privacidade.",
  },
];

const NAV_LINKS = [
  { id: "recursos", label: "Recursos" },
  { id: "comunidades", label: "Comunidades" },
  { id: "voz", label: "Voz e vídeo" },
  { id: "seguranca", label: "Segurança" },
];

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  className: string;
};

const FEATURE_GROUPS: Feature[] = [
  {
    icon: MessagesSquare,
    title: "Conversa que não perde o fio",
    description:
      "Mensagens, respostas, reações e arquivos ficam organizados para todos acompanharem.",
    className: "landing-feature--messages",
  },
  {
    icon: Server,
    title: "Um lugar para cada comunidade",
    description:
      "Crie servidores, canais, cargos e convites com a identidade do seu grupo.",
    className: "landing-feature--community",
  },
  {
    icon: Mic,
    title: "Entre e fale",
    description:
      "Canais de voz ficam abertos para você chegar, ouvir e participar quando quiser.",
    className: "landing-feature--voice",
  },
  {
    icon: MonitorUp,
    title: "Mostre o que está acontecendo",
    description:
      "Vídeo e compartilhamento de tela aproximam jogos, estudos, projetos e encontros.",
    className: "landing-feature--share",
  },
  {
    icon: Hash,
    title: "Tudo no seu ritmo",
    description:
      "Tópicos, enquetes, comandos e personalização deixam cada conversa mais simples.",
    className: "landing-feature--organize",
  },
];

const COMMUNITY_PERKS = [
  "Canais de texto e voz para cada assunto",
  "Cargos e permissões que você controla",
  "Convites simples para reunir todo mundo",
];

const VOICE_FEATURES = [
  { icon: Mic, label: "Áudio claro para conversas naturais" },
  { icon: Video, label: "Vídeo para quando estar presente faz diferença" },
  { icon: MonitorUp, label: "Tela compartilhada com poucos cliques" },
];

const SECURITY_POINTS = [
  {
    icon: ShieldCheck,
    title: "Denúncias no contexto certo",
    description:
      "Denuncie mensagens, pessoas ou servidores sem sair do fluxo da conversa.",
  },
  {
    icon: Bot,
    title: "Moderação que ajuda de verdade",
    description:
      "Proteções automáticas reduzem spam e abuso antes que dominem a comunidade.",
  },
  {
    icon: Ban,
    title: "Você decide quem alcança você",
    description:
      "Bloqueios claros colocam o controle das interações nas suas mãos.",
  },
  {
    icon: MonitorSmartphone,
    title: "Sessões sob controle",
    description:
      "Revise dispositivos conectados e encerre acessos que você não reconhece.",
  },
];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(
    () =>
      typeof IntersectionObserver === "undefined" || prefersReducedMotion(),
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;

  return (
    <div
      ref={ref}
      style={style}
      className={`landing-reveal ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function BrandLink() {
  return (
    <Link to="/" className="landing-brand" aria-label="Nexora, página inicial">
      <NexoraAppIcon className="landing-brand__icon" decorative />
      <span>Nexora</span>
    </Link>
  );
}

function AuthActions({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="landing-auth-loading" role="status">
        <span className="sr-only">Carregando opções da conta</span>
        <span />
        <span />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <Link className="landing-button landing-button--primary" to="/channels/@me">
        Abrir Nexora
        <ArrowRight aria-hidden />
      </Link>
    );
  }

  return (
    <>
      <Link className="landing-button landing-button--ghost" to="/login">
        Entrar
      </Link>
      <Link className="landing-button landing-button--primary" to="/register">
        Criar conta
      </Link>
    </>
  );
}

function SectionIntro({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={`landing-section-intro ${className}`}>
      <h2>{title}</h2>
      <p>{children}</p>
    </Reveal>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;

  return (
    <Reveal
      delay={(index % 3) * 70}
      className={`landing-feature ${feature.className}`}
    >
      <div className="landing-feature__topline">
        <span className="landing-icon-well">
          <Icon aria-hidden />
        </span>
        {feature.className === "landing-feature--voice" && (
          <span className="landing-voice-signal" aria-label="Voz ativa">
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
      <div className="landing-feature__copy">
        <h3>{feature.title}</h3>
        <p>{feature.description}</p>
      </div>
      {feature.className === "landing-feature--community" && (
        <NexoraMark className="landing-feature__mark" decorative />
      )}
      {feature.className === "landing-feature--organize" && (
        <div className="landing-capability-row" aria-label="Recursos incluídos">
          <span><Paperclip aria-hidden /> Arquivos</span>
          <span><BarChart3 aria-hidden /> Enquetes</span>
          <span><Zap aria-hidden /> Comandos</span>
          <span><Palette aria-hidden /> Perfil</span>
        </div>
      )}
    </Reveal>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const moveToSection = () => {
      document.getElementById(id)?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      window.history.replaceState(null, "", `#${id}`);
    };

    if (menuOpen) {
      setMenuOpen(false);
      window.setTimeout(moveToSection, 0);
      return;
    }

    moveToSection();
  }

  return (
    <div className="nexora-landing">
      <Seo
        canonicalPath="/"
        description="Conheça a Nexora, a plataforma para conversar online, criar comunidades e se conectar com pessoas por mensagens, voz e vídeo — direto no navegador."
      />
      <a className="landing-skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="landing-header">
        <div className="landing-shell landing-nav-row">
          <BrandLink />

          <nav className="landing-nav-links" aria-label="Navegação principal">
            {NAV_LINKS.map(link => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={event => scrollToSection(event, link.id)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="landing-nav-actions">
            <AuthActions
              isAuthenticated={isAuthenticated}
              isLoading={isLoading}
            />
          </div>

          <button
            type="button"
            className="landing-menu-button"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>

        {menuOpen && (
          <div id="landing-mobile-menu" className="landing-mobile-menu">
            <nav aria-label="Navegação principal para celular">
              {NAV_LINKS.map(link => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={event => scrollToSection(event, link.id)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="landing-mobile-actions">
              <AuthActions
                isAuthenticated={isAuthenticated}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}
      </header>

      <main id="conteudo">
        <section className="landing-hero">
          <div className="landing-shell landing-hero__grid">
            <div className="landing-hero__copy">
              <Reveal>
                <p className="landing-eyebrow">Conversa em tempo real</p>
              </Reveal>
              <Reveal delay={70}>
                <h1>Mais perto de quem importa.</h1>
              </Reveal>
              <Reveal delay={140}>
                <p className="landing-hero__lead">
                  Mensagens, comunidades e chamadas no mesmo lugar, para
                  conversas que continuam de verdade.
                </p>
              </Reveal>
              <Reveal delay={210}>
                <div className="landing-hero__actions">
                  <Link
                    className="landing-button landing-button--primary landing-button--large"
                    to="/register"
                  >
                    Criar conta
                    <ArrowRight aria-hidden />
                  </Link>
                  <Link
                    className="landing-button landing-button--secondary landing-button--large"
                    to="/login"
                  >
                    Entrar
                  </Link>
                </div>
              </Reveal>
            </div>

            <Reveal delay={120} className="landing-hero__media">
              <figure>
                <img
                  src={heroImage}
                  alt="Três amigos conversando juntos com fones e notebook"
                  width="1586"
                  height="992"
                  fetchPriority="high"
                />
                <figcaption>
                  Um espaço simples para chegar, conversar e ficar por perto.
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </section>

        <section id="recursos" className="landing-section landing-section--features">
          <div className="landing-shell">
            <SectionIntro title="Tudo o que aproxima, sem complicar.">
              O Nexora reúne as ferramentas certas e deixa a conversa ocupar o
              centro da experiência.
            </SectionIntro>

            <div className="landing-feature-grid">
              {FEATURE_GROUPS.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  feature={feature}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="comunidades" className="landing-section">
          <div className="landing-shell landing-story-grid">
            <Reveal className="landing-story-media landing-story-media--portrait">
              <img
                src={communityImage}
                alt="Amigos organizando um projeto e conversando com outra pessoa por chamada"
                width="880"
                height="1100"
                loading="lazy"
                decoding="async"
              />
            </Reveal>

            <div className="landing-story-copy">
              <SectionIntro title="Sua comunidade, do seu jeito.">
                Reúna amigos, projetos e interesses em um espaço que cresce sem
                perder a organização.
              </SectionIntro>
              <Reveal delay={100}>
                <ul className="landing-check-list">
                  {COMMUNITY_PERKS.map(perk => (
                    <li key={perk}>
                      <span><Check aria-hidden /></span>
                      {perk}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="voz" className="landing-section landing-section--voice">
          <div className="landing-shell landing-voice-grid">
            <div className="landing-voice-copy">
              <SectionIntro title="Entrou no canal, entrou na conversa.">
                Fale, apareça em vídeo ou mostre sua tela sem transformar um
                encontro espontâneo em reunião.
              </SectionIntro>
              <Reveal delay={100}>
                <ul className="landing-voice-list">
                  {VOICE_FEATURES.map(item => (
                    <li key={item.label}>
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <Reveal delay={80} className="landing-story-media landing-story-media--square">
              <img
                src={voiceImage}
                alt="Dois amigos participando de uma chamada pelo notebook"
                width="1100"
                height="1100"
                loading="lazy"
                decoding="async"
              />
            </Reveal>
          </div>
        </section>

        <section id="seguranca" className="landing-section landing-security">
          <div className="landing-shell">
            <SectionIntro title="Segurança presente, não escondida.">
              Controles claros ajudam pessoas e comunidades a cuidar do espaço
              sem interromper a conversa.
            </SectionIntro>

            <div className="landing-security-grid">
              {SECURITY_POINTS.map((point, index) => (
                <Reveal
                  key={point.title}
                  delay={(index % 2) * 70}
                  className="landing-security-item"
                >
                  <span className="landing-icon-well">
                    <point.icon aria-hidden />
                  </span>
                  <div>
                    <h3>{point.title}</h3>
                    <p>{point.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="landing-section">
          <div className="landing-shell">
            <SectionIntro title="Perguntas frequentes">
              O essencial sobre a Nexora, direto ao ponto.
            </SectionIntro>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: FAQ_ITEMS.map(item => ({
                    "@type": "Question",
                    name: item.q,
                    acceptedAnswer: { "@type": "Answer", text: item.a },
                  })),
                }),
              }}
            />
            <div className="landing-faq">
              {FAQ_ITEMS.map(item => (
                <Reveal key={item.q}>
                  <details className="landing-faq__item">
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-final-cta">
          <div className="landing-shell">
            <Reveal className="landing-final-cta__panel">
              <NexoraAppIcon className="landing-final-cta__icon" decorative />
              <h2>O próximo “oi” começa aqui.</h2>
              <p>Crie seu espaço no Nexora e chame quem faz parte dele.</p>
              <div className="landing-final-cta__actions">
                <Link
                  className="landing-button landing-button--primary landing-button--large"
                  to="/register"
                >
                  Criar conta
                  <ArrowRight aria-hidden />
                </Link>
                <Link className="landing-text-link" to="/login">
                  Entrar
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__row">
          <div className="landing-footer__brand">
            <NexoraAppIcon className="landing-footer__icon" decorative />
            <span>Nexora</span>
            <small>© {year}</small>
          </div>
          <nav aria-label="Links do rodapé">
            <Link to="/privacy">Privacidade</Link>
            <Link to="/legal/terms">Termos</Link>
            <Link to="/legal/guidelines">Diretrizes</Link>
            <a
              href="#seguranca"
              onClick={event => scrollToSection(event, "seguranca")}
            >
              Segurança
            </a>
            <a href="mailto:suporte@nexorachat.cloud">Contato</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
