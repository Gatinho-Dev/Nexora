import {
  Keyboard,
  MessageCircle,
  MousePointer2,
  RefreshCw,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  className: string;
};

const features: Feature[] = [
  {
    icon: Zap,
    title: "Rápido",
    description:
      "Acesse amigos, conversas e servidores sem abrir uma interface pesada.",
    className: "is-cobalt",
  },
  {
    icon: MessageCircle,
    title: "Realtime",
    description:
      "As mensagens continuam chegando pelo canal em tempo real do Nexora.",
    className: "is-surface",
  },
  {
    icon: MousePointer2,
    title: "Teclado + mouse",
    description:
      "Navegue com atalhos de teclado ou use o mouse quando preferir.",
    className: "is-surface",
  },
  {
    icon: Keyboard,
    title: "Pensado para terminal",
    description:
      "A interface TUI mantém o foco no conteúdo e no que você está fazendo.",
    className: "is-ink",
  },
  {
    icon: ShieldCheck,
    title: "Login no navegador",
    description:
      "Autorize o acesso pela sua conta Nexora sem compartilhar sua senha com o CLI.",
    className: "is-surface",
  },
  {
    icon: RefreshCw,
    title: "Versões verificadas",
    description:
      "O cliente verifica novas versões e aponta os downloads oficiais.",
    className: "is-outline",
  },
];

export function CliFeatureGrid() {
  return (
    <div className="nexora-cli-feature-grid">
      {features.map(feature => {
        const Icon = feature.icon;
        return (
          <article
            className={`nexora-cli-feature-card ${feature.className}`}
            key={feature.title}
          >
            <span className="nexora-cli-feature-icon">
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        );
      })}
    </div>
  );
}
