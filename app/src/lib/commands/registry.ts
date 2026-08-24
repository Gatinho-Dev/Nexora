import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  MessageSquarePlus,
  Image as ImageIcon,
  Type,
  UserCog,
} from "lucide-react";

/**
 * Registry central de Slash Commands do Nexora.
 *
 * Dois modos de execução:
 * - "client": transformação pura de texto/abertura de UI (sem efeito
 *   colateral no servidor) — ex.: /shrug, /me, /poll (abre editor).
 * - "server": executa no backend via trpc.command.execute com validação
 *   de permissão e rate limit (ex.: /nick).
 *
 * Novos comandos (inclusive de apps/bots futuros) = nova entrada aqui +
 * handler no commandService do backend quando houver efeito colateral.
 */

export type CommandArgType =
  | "string"
  | "number"
  | "boolean"
  | "user"
  | "channel";

export type CommandArg = {
  name: string;
  description: string;
  type: CommandArgType;
  required: boolean;
  placeholder?: string;
};

export type NexoraCommand = {
  name: string;
  description: string;
  icon: LucideIcon;
  /** app dono do comando (para badge no autocomplete) */
  app: "Nexora";
  args?: CommandArg[];
  /**
   * client: resolvido no composer (UI/texto).
   * server: POST trpc command.execute.
   */
  execution: "client" | "server";
};

export const NEXORA_COMMANDS: NexoraCommand[] = [
  {
    name: "poll",
    description: "Criar uma enquete",
    icon: BarChart3,
    app: "Nexora",
    execution: "client",
    args: [
      {
        name: "pergunta",
        description: "Pergunta da enquete",
        type: "string",
        required: true,
        placeholder: "Qual jogo vamos jogar hoje?",
      },
    ],
  },
  {
    name: "topic",
    description: "Criar um tópico neste canal",
    icon: MessageSquarePlus,
    app: "Nexora",
    execution: "client",
    args: [
      {
        name: "nome",
        description: "Nome do tópico",
        type: "string",
        required: true,
        placeholder: "nome-do-topico",
      },
    ],
  },
  {
    name: "gif",
    description: "Pesquisar e enviar um GIF",
    icon: ImageIcon,
    app: "Nexora",
    execution: "client",
    args: [
      {
        name: "busca",
        description: "Termo para buscar GIFs",
        type: "string",
        required: false,
        placeholder: "gato dançando",
      },
    ],
  },
  {
    name: "nick",
    description: "Alterar seu apelido neste servidor",
    icon: UserCog,
    app: "Nexora",
    execution: "server",
    args: [
      {
        name: "apelido",
        description: "Seu novo apelido (vazio para remover)",
        type: "string",
        required: false,
        placeholder: "Novo apelido",
      },
    ],
  },
  {
    name: "shrug",
    description: "Envia ¯\\_(ツ)_/¯ com sua mensagem",
    icon: Type,
    app: "Nexora",
    execution: "client",
  },
  {
    name: "me",
    description: "Enviar mensagem de ação (em itálico)",
    icon: Type,
    app: "Nexora",
    execution: "client",
    args: [
      {
        name: "ação",
        description: "O que você está fazendo",
        type: "string",
        required: true,
        placeholder: "está com fome",
      },
    ],
  },
];

/** Busca com relevância: exata > prefixo > descrição/keywords. */
export function searchCommands(query: string): NexoraCommand[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  if (!q) return NEXORA_COMMANDS;
  const exact = NEXORA_COMMANDS.filter(c => c.name === q);
  const prefix = NEXORA_COMMANDS.filter(
    c => c.name !== q && c.name.startsWith(q),
  );
  const rest = NEXORA_COMMANDS.filter(
    c =>
      c.name !== q &&
      !c.name.startsWith(q) &&
      (c.description.toLowerCase().includes(q) || c.name.includes(q)),
  );
  return [...exact, ...prefix, ...rest];
}

/** Aplica comandos client-side puros de texto. */
export function applyTextCommand(
  name: string,
  args: string,
): string | null {
  const trimmed = args.trim();
  if (name === "shrug") {
    return `${trimmed ? trimmed + " " : ""}¯\\_(ツ)_/¯`;
  }
  if (name === "me") {
    return trimmed ? `*${trimmed}*` : null;
  }
  return null;
}
