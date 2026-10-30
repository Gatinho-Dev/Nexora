import {
  Ban,
  BookOpen,
  ChevronRight,
  EyeOff,
  Flag,
  Lock,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

/**
 * Configurações → Minha Conta → Central de Segurança
 *
 * Hub com atalhos para todas as áreas de segurança da conta.
 */
export type SecurityCenterTab =
  | "standing"
  | "sensitive"
  | "privacy"
  | "my-reports"
  | "appeals";

const HUB_ITEMS: {
  tab: SecurityCenterTab;
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}[] = [
  {
    tab: "standing",
    icon: ShieldAlert,
    title: "Status da Conta",
    description: "Infrações, strikes e restrições da sua conta.",
  },
  {
    tab: "sensitive",
    icon: EyeOff,
    title: "Conteúdo Sensível",
    description: "Escolha como o Nexora exibe mídias sensíveis.",
  },
  {
    tab: "privacy",
    icon: Ban,
    title: "Usuários Bloqueados",
    description: "Gerencie bloqueios nas opções de privacidade.",
  },
  {
    tab: "my-reports",
    icon: Flag,
    title: "Minhas Denúncias",
    description: "Acompanhe denúncias que você enviou.",
  },
  {
    tab: "appeals",
    icon: MessageSquareWarning,
    title: "Apelações",
    description: "Solicite revisão de decisões aplicadas à sua conta.",
  },
  {
    tab: "privacy",
    icon: Lock,
    title: "Privacidade",
    description: "Mensagens diretas, recibos de leitura e mais.",
  },
];

export function SecurityCenter({
  onNavigate,
}: {
  onNavigate: (tab: SecurityCenterTab) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Central de Segurança</h2>
        <p className="text-xs text-muted2 mt-1">
          Tudo sobre segurança, moderação e privacidade da sua conta em um só
          lugar.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {HUB_ITEMS.map(item => (
          <button
            key={item.title}
            type="button"
            onClick={() => onNavigate(item.tab)}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-sidebar p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/15 text-[#7383FF]">
              <item.icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-white">
                {item.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted2">
                {item.description}
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        ))}

        <a
          href="/legal/guidelines"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-sidebar p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/15 text-[#7383FF]">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">
              Diretrizes da Comunidade
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted2">
              As regras que mantêm o Nexora seguro.
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </a>
      </div>

      <p className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2.5 text-[11px] text-muted2">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#23A55A]" aria-hidden />
        Denúncias e apelações são analisadas pela equipe de segurança do Nexora.
      </p>
    </div>
  );
}
