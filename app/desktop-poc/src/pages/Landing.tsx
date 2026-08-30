import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Ban,
  BarChart3,
  Bell,
  Bot,
  Check,
  CornerUpLeft,
  Crown,
  Gift,
  Hash,
  Headphones,
  Menu,
  Mic,
  MonitorSmartphone,
  MonitorUp,
  MessagesSquare,
  Palette,
  Paperclip,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Smile,
  Sparkles,
  Sticker,
  Users,
  Video,
  Volume2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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
};

const FEATURES: Feature[] = [
  {
    icon: MessagesSquare,
    title: "Mensagens em tempo real",
    description: "Conversas fluidas com respostas, reações e tópicos organizados.",
  },
  {
    icon: Server,
    title: "Servidores e comunidades",
    description: "Crie seu espaço com canais, cargos e convites personalizados.",
  },
  {
    icon: Mic,
    title: "Chamadas de voz",
    description: "Áudio cristalino com um clique, sem configuração complicada.",
  },
  {
    icon: Video,
    title: "Vídeo",
    description: "Ligue a câmera e sinta a presença de quem está longe.",
  },
  {
    icon: MonitorUp,
    title: "Compartilhamento de tela",
    description: "Mostre projetos, jogos e ideias enquanto acontecem.",
  },
  {
    icon: Paperclip,
    title: "Arquivos e imagens",
    description: "Envie fotos, vídeos e documentos direto no chat.",
  },
  {
    icon: BarChart3,
    title: "Enquetes",
    description: "Crie votações rápidas e decida tudo com a comunidade.",
  },
  {
    icon: Hash,
    title: "Tópicos",
    description: "Organize assuntos sem perder o fio da meada.",
  },
  {
    icon: Zap,
    title: "Slash Commands",
    description: "Digite / e acesse ações rápidas em qualquer canal.",
  },
  {
    icon: Palette,
    title: "Emblemas e personalização",
    description: "Colete emblemas e mostre seu estilo no perfil.",
  },
];

const COMMUNITY_PERKS = [
  "Crie quantos canais de texto e voz precisar",
  "Defina cargos e permissões por canal",
  "Convide amigos com um simples link",
];

const SECURITY_POINTS: Feature[] = [
  {
    icon: ShieldCheck,
    title: "Denúncias acessíveis",
    description: "Denuncie mensagens, usuários ou servidores direto pelo app.",
  },
  {
    icon: Bot,
    title: "Moderação automática",
    description: "Proteções ajudam a manter comunidades livres de spam e abuso.",
  },
  {
    icon: Ban,
    title: "Bloqueios",
    description: "Bloqueie quem quiser para controlar suas interações.",
  },
  {
    icon: MonitorSmartphone,
    title: "Sessões e dispositivos",
    description: "Veja e encerre sessões ativas nos seus dispositivos.",
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
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -48px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,transform] duration-500 ease-out will-change-transform motion-reduce:transition-none motion-reduce:translate-y-0",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted2">
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Reveal className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-[clamp(1.75rem,1.35rem+1.8vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      {children && (
        <p className="mt-4 text-base leading-relaxed text-muted2 sm:text-lg">
          {children}
        </p>
      )}
    </Reveal>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <div className="group rounded-2xl border border-border bg-card/70 p-5 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] motion-reduce:hover:translate-y-0">
      <div className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary transition-colors duration-300 group-hover:bg-primary/25">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">
        {feature.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted2">
        {feature.description}
      </p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div
      role="img"
      aria-label="Prévia da interface do Nexora: lista de servidores, canais, conversas e chamada de voz"
      className="relative mx-auto mt-14 w-full max-w-4xl select-none sm:mt-16"
    >
      <div
        aria-hidden
        className="absolute inset-x-6 top-6 bottom-0 rounded-[3rem] bg-primary/25 blur-3xl"
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#1E1F22] shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
        <div className="flex h-9 items-center gap-1.5 border-b border-black/30 px-3">
          <span aria-hidden className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span aria-hidden className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <span aria-hidden className="size-2.5 rounded-full bg-[#28C840]" />
          <span className="flex-1 text-center text-[11px] font-semibold text-[#949ba4]">
            nexora
          </span>
          <span aria-hidden className="w-10" />
        </div>

        <div className="flex h-[320px] sm:h-[360px]">
          <div className="flex w-12 shrink-0 flex-col items-center gap-2 bg-[#111214] py-3">
            <NexoraAppIcon className="size-8 rounded-full" decorative />
            <span aria-hidden className="h-px w-6 bg-white/10" />
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-[11px] font-bold text-white ring-2 ring-white/80"
            >
              C
            </span>
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[11px] font-bold text-white"
            >
              G
            </span>
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[11px] font-bold text-white"
            >
              D
            </span>
          </div>

          <div className="hidden w-40 shrink-0 flex-col bg-[#2B2D31] p-2 sm:flex">
            <p className="truncate px-2 py-1.5 text-[13px] font-bold text-white">
              Comunidade Nexora
            </p>
            <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
              Canais de texto
            </p>
            <p className="flex items-center gap-1.5 rounded bg-[#404249] px-2 py-1 text-[13px] font-medium text-white">
              <Hash className="size-3.5" aria-hidden /> geral
            </p>
            <p className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[#949ba4]">
              <Hash className="size-3.5" aria-hidden /> apresente-se
            </p>
            <p className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[#949ba4]">
              <Hash className="size-3.5" aria-hidden /> memes
            </p>
            <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
              Canais de voz
            </p>
            <p className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[#949ba4]">
              <Volume2 className="size-3.5" aria-hidden /> Lounge
            </p>
            <p className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[#949ba4]">
              <Volume2 className="size-3.5" aria-hidden /> Palco
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-[#313338]">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-black/20 px-3">
              <Hash className="size-4 text-[#949ba4]" aria-hidden />
              <span className="text-[13px] font-bold text-white">geral</span>
              <span className="hidden truncate border-l border-white/10 pl-2 text-xs text-[#949ba4] md:inline">
                converse com a comunidade
              </span>
              <span className="flex-1" />
              <Bell className="size-4 text-[#949ba4]" aria-hidden />
              <Users className="size-4 text-[#949ba4]" aria-hidden />
              <Search className="size-4 text-[#949ba4]" aria-hidden />
            </div>

            <div className="flex-1 space-y-3 overflow-hidden p-3">
              <div className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 text-xs font-bold text-white"
                >
                  L
                </span>
                <div className="min-w-0">
                  <p className="text-[13px]">
                    <span className="font-bold text-[#f472b6]">Luna</span>{" "}
                    <span className="text-[10px] text-[#949ba4]">
                      hoje às 14:02
                    </span>
                  </p>
                  <p className="text-[13px] leading-snug text-[#dbdee1]">
                    gente, os novos tópicos ficaram incríveis 😍
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <span aria-hidden className="w-8 shrink-0" />
                <div className="min-w-0">
                  <p className="-ml-[26px] mb-0.5 flex items-center gap-1 text-[10px] text-[#949ba4]">
                    <CornerUpLeft className="size-3" aria-hidden />
                    respondeu a{" "}
                    <span className="font-semibold text-[#f472b6]">Luna</span>
                  </p>
                  <p className="text-[13px]">
                    <span className="font-bold text-[#38bdf8]">Rafa</span>{" "}
                    <span className="text-[10px] text-[#949ba4]">
                      hoje às 14:04
                    </span>
                  </p>
                  <p className="text-[13px] leading-snug text-[#dbdee1]">
                    sim! já usei no servidor da facul, ajuda demais a organizar
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-xs font-bold text-white"
                >
                  B
                </span>
                <div className="min-w-0">
                  <p className="text-[13px]">
                    <span className="font-bold text-[#a78bfa]">Bia</span>{" "}
                    <span className="text-[10px] text-[#949ba4]">
                      hoje às 14:05
                    </span>
                  </p>
                  <p className="text-[13px] leading-snug text-[#dbdee1]">
                    bora continuar no voice? tô no Lounge 🎧
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#5865F2]/50 bg-[#5865F2]/20 px-1.5 py-0.5 text-[11px] text-[#c9cdff]">
                      ❤️ 4
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-[#b5bac1]">
                      🔥 2
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 pt-0">
              <div className="flex h-9 items-center gap-2 rounded-lg bg-[#1E1F22] px-3 text-[13px] text-[#949ba4]">
                <Plus className="size-4" aria-hidden />
                <span className="flex-1 truncate">Converse em #geral</span>
                <Gift className="size-4" aria-hidden />
                <Sticker className="size-4" aria-hidden />
                <Smile className="size-4" aria-hidden />
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-11 items-center gap-2 border-t border-black/30 bg-[#1E1F22] px-3">
          <span
            aria-hidden
            className="voice-avatar-speaking grid size-6 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-bold text-white"
          >
            M
          </span>
          <p className="min-w-0 flex-1 truncate text-xs text-[#949ba4]">
            <span className="font-semibold text-[#3bbd72]">@marina</span> está
            falando · Lounge
          </p>
          <Mic className="size-4 text-[#b5bac1]" aria-hidden />
          <Headphones className="size-4 text-[#b5bac1]" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function CommunitiesMockup() {
  return (
    <div
      role="img"
      aria-label="Prévia de um servidor com lista de canais, cargos e membros"
      className="select-none overflow-hidden rounded-2xl border border-white/10 bg-[#2B2D31] shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
    >
      <div className="border-b border-black/30 px-4 py-3">
        <p className="text-sm font-bold text-white">Servidor da Bia</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-black/30">
        <div className="p-3">
          <p className="pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
            Canais
          </p>
          <p className="flex items-center gap-1.5 rounded bg-[#404249] px-2 py-1 text-[13px] font-medium text-white">
            <Hash className="size-3.5" aria-hidden /> bem-vindo
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[#949ba4]">
            <Hash className="size-3.5" aria-hidden /> estudos
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 rounded px-2 py-1 text-[13px] text-[#949ba4]">
            <Volume2 className="size-3.5" aria-hidden /> foco
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="rounded-full border border-[#F23F43]/40 bg-[#F23F43]/10 px-2 py-0.5 text-[10px] font-bold text-[#F23F43]">
              Admin
            </span>
            <span className="rounded-full border border-[#5865F2]/40 bg-[#5865F2]/10 px-2 py-0.5 text-[10px] font-bold text-[#8B9AFF]">
              Mod
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[#b5bac1]">
              Membro
            </span>
          </div>
        </div>
        <div className="p-3">
          <p className="pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
            Membros
          </p>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#F23F43]">
            <Crown className="size-3.5 text-[#F0B232]" aria-hidden /> Bia
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#8B9AFF]">Marina</p>
          <p className="mt-1 text-[13px] font-semibold text-[#EB459E]">Luna</p>
          <p className="mt-1 text-[13px] text-[#b5bac1]">Rafa</p>
          <p className="mt-1 text-[13px] text-[#b5bac1]">Téo</p>
        </div>
      </div>
    </div>
  );
}

function VoiceMockup() {
  const speakers = [
    { initial: "M", name: "Marina", ring: true, gradient: "from-emerald-400 to-teal-500" },
    { initial: "L", name: "Luna", ring: false, gradient: "from-pink-400 to-fuchsia-500" },
    { initial: "R", name: "Rafa", ring: true, gradient: "from-sky-400 to-blue-500" },
    { initial: "T", name: "Téo", ring: false, gradient: "from-amber-400 to-orange-500" },
  ];
  return (
    <div
      role="img"
      aria-label="Prévia de um canal de voz com participantes e controles de áudio"
      className="select-none rounded-2xl border border-white/10 bg-[#2B2D31] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.35)] sm:p-6"
    >
      <p className="mb-4 flex items-center justify-center gap-1.5 text-xs font-bold text-[#949ba4]">
        <Volume2 className="size-3.5" aria-hidden /> Lounge
      </p>
      <ul className="flex flex-wrap items-start justify-center gap-x-6 gap-y-4">
        {speakers.map(speaker => (
          <li key={speaker.name} className="flex w-16 flex-col items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "grid size-14 place-items-center rounded-full bg-gradient-to-br text-lg font-bold text-white transition-transform duration-300",
                speaker.gradient,
                speaker.ring && "voice-avatar-speaking scale-105",
              )}
            >
              {speaker.initial}
            </span>
            <span className="max-w-full truncate text-xs text-[#b5bac1]">
              {speaker.name}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#5865F2] text-white">
          <Mic className="size-5" aria-hidden />
        </span>
        <span className="grid size-11 place-items-center rounded-full bg-[#404249] text-[#dbdee1]">
          <Headphones className="size-5" aria-hidden />
        </span>
        <span className="grid size-11 place-items-center rounded-full bg-[#404249] text-[#dbdee1]">
          <MonitorUp className="size-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function scrollToSection(
    event: MouseEvent<HTMLAnchorElement>,
    id: string,
  ) {
    event.preventDefault();
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${id}`);
  }

  const authActions = isLoading ? null : isAuthenticated ? (
    <Button
      asChild
      className="rounded-full bg-[#5865F2] font-semibold text-white hover:bg-[#4752C4]"
    >
      <Link to="/channels/@me">
        Abrir Nexora
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  ) : (
    <>
      <Button
        variant="ghost"
        asChild
        className="rounded-full font-medium text-muted2 hover:text-foreground"
      >
        <Link to="/login">Entrar</Link>
      </Button>
      <Button
        asChild
        className="rounded-full bg-[#5865F2] font-semibold text-white hover:bg-[#4752C4]"
      >
        <Link to="/register">Criar conta</Link>
      </Button>
    </>
  );

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain bg-chat text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-chat/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <NexoraAppIcon className="size-8" decorative />
            <span className="text-lg font-extrabold tracking-tight">
              Nexora
            </span>
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_LINKS.map(link => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={event => scrollToSection(event, link.id)}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted2 transition-colors duration-200 hover:bg-hover hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">{authActions}</div>

          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-muted2 transition-colors duration-200 hover:bg-hover hover:text-foreground md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>

        {menuOpen && (
          <div
            id="mobile-menu"
            className="border-t border-border/60 bg-chat/95 backdrop-blur-lg md:hidden"
          >
            <nav
              aria-label="Navegação principal"
              className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4"
            >
              {NAV_LINKS.map(link => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={event => scrollToSection(event, link.id)}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-muted2 transition-colors duration-200 hover:bg-hover hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2">{authActions}</div>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-[-8rem] top-40 size-72 rounded-full bg-[#00A8FC]/10 blur-[100px]"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted2">
                <Sparkles className="size-3.5 text-primary" aria-hidden />
                Bem-vindo à Nexora
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-[clamp(2.5rem,1.55rem+3.6vw,4.25rem)] font-bold leading-[1.05] tracking-[-0.03em]">
                Um novo jeito de{" "}
                <span className="bg-gradient-to-r from-[#7383FF] via-[#8B9AFF] to-[#00A8FC] bg-clip-text text-transparent">
                  estar conectado.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted2 sm:text-lg">
                Converse com amigos, crie comunidades, participe de chamadas de
                voz e compartilhe momentos — tudo em um só lugar.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="h-12 rounded-full bg-[#5865F2] px-7 text-base font-semibold text-white shadow-[0_8px_24px_rgba(88,101,242,0.35)] hover:bg-[#4752C4]"
                >
                  <Link to="/register">Criar uma conta</Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="h-12 rounded-full border-white/15 bg-white/5 px-7 text-base font-semibold hover:bg-white/10"
                >
                  <Link to="/login">Entrar</Link>
                </Button>
              </div>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <HeroMockup />
          </Reveal>
        </section>

        <section
          id="recursos"
          className="scroll-mt-20 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Recursos"
              title="Tudo que você precisa para ficar conectado."
            >
              Do primeiro oi à comunidade inteira: as ferramentas certas, sem
              complicação.
            </SectionHeading>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <Reveal key={feature.title} delay={(index % 3) * 70}>
                  <FeatureCard feature={feature} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section
          id="comunidades"
          className="scroll-mt-20 border-t border-border/60 bg-sidebar/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <SectionHeading eyebrow="Comunidades" title="Crie seu espaço.">
                Monte seu servidor em segundos: canais de texto e voz sob
                medida, cargos com permissões específicas e convites fáceis de
                compartilhar. O espaço é seu — e você decide quem faz o quê.
              </SectionHeading>
              <Reveal delay={120}>
                <ul className="mt-6 space-y-3">
                  {COMMUNITY_PERKS.map(perk => (
                    <li
                      key={perk}
                      className="flex items-start gap-2.5 text-sm text-muted2 sm:text-base"
                    >
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                        <Check className="size-3" aria-hidden />
                      </span>
                      {perk}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={150}>
              <CommunitiesMockup />
            </Reveal>
          </div>
        </section>

        <section
          id="voz"
          className="scroll-mt-20 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal delay={150} className="order-last lg:order-first">
              <VoiceMockup />
            </Reveal>
            <div>
              <SectionHeading eyebrow="Voz e vídeo" title="Entre na conversa.">
                Canais de voz sempre abertos, chamadas com latência baixa e
                compartilhamento de tela em um clique. Chegou junto? É só
                entrar — ninguém precisa agendar nada.
              </SectionHeading>
            </div>
          </div>
        </section>

        <section
          id="seguranca"
          className="scroll-mt-20 border-t border-border/60 bg-sidebar/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Segurança"
              title="Segurança integrada à experiência."
            >
              Sua segurança não fica escondida em menus: ela está a alguns
              cliques de distância, exatamente onde você precisa.
            </SectionHeading>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {SECURITY_POINTS.map((point, index) => (
                <Reveal key={point.title} delay={(index % 2) * 70}>
                  <div className="flex gap-4 rounded-2xl border border-border bg-card/70 p-5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                      <point.icon className="size-5" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {point.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted2">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]"
          />
          <div className="relative mx-auto max-w-2xl">
            <Reveal>
              <h2 className="text-[clamp(1.875rem,1.4rem+2.2vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em]">
                Pronto para experimentar a Nexora?
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <div className="mt-8">
                <Button
                  asChild
                  className="h-12 rounded-full bg-[#5865F2] px-8 text-base font-semibold text-white shadow-[0_8px_24px_rgba(88,101,242,0.35)] hover:bg-[#4752C4]"
                >
                  <Link to="/register">Criar minha conta</Link>
                </Button>
              </div>
              <p className="mt-5 text-sm text-muted2">
                Já possui uma conta?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-[#00A8FC] hover:underline"
                >
                  Entrar
                </Link>
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <NexoraAppIcon className="size-6" decorative />
            <span className="text-sm font-bold">Nexora</span>
            <span className="text-sm text-muted2">© {year} Nexora</span>
          </div>
          <nav
            aria-label="Links do rodapé"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted2"
          >
            <Link to="/privacy" className="hover:text-white">Privacidade</Link>
            <Link to="/legal/terms" className="hover:text-foreground">
              Termos
            </Link>
            <Link to="/legal/guidelines" className="hover:text-foreground">
              Diretrizes da Comunidade
            </Link>
            <a
              href="#seguranca"
              onClick={event => scrollToSection(event, "seguranca")}
              className="hover:text-foreground"
            >
              Segurança
            </a>
            <a href="mailto:suporte@nexorachat.cloud" className="hover:text-foreground">
              Contato
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
