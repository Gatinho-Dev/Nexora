import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Armchair,
  AtSign,
  BarChart3,
  Calculator,
  CaseLower,
  CaseUpper,
  Coins,
  Dices,
  EyeOff,
  Flag,
  HelpCircle,
  Image as ImageIcon,
  ListChecks,
  MessageSquarePlus,
  Meh,
  Shuffle,
  Sparkles,
  Table,
  Type,
  UploadCloud,
  UserCog,
  UserPlus,
} from "lucide-react";

export type CommandCategory =
  | "mensagens"
  | "mídia"
  | "enquetes"
  | "tópicos"
  | "perfil"
  | "social"
  | "servidor"
  | "utilidades"
  | "diversão";

export type CommandArgType = "string" | "number" | "boolean" | "choice";

export type CommandArg = {
  name: string;
  description: string;
  type: CommandArgType;
  required: boolean;
  placeholder?: string;
  choices?: string[];
};

export type NexoraCommand = {
  name: string;
  description: string;
  icon: LucideIcon;
  app: "Nexora";
  category: CommandCategory;
  args?: CommandArg[];
  execution: "client" | "server";
};

export const NEXORA_COMMANDS: NexoraCommand[] = [
  {
    name: "me",
    description: "Enviar mensagem de ação (em itálico)",
    icon: Type,
    app: "Nexora",
    category: "mensagens",
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
  {
    name: "shrug",
    description: "Envia ¯\\_(ツ)_/¯ com sua mensagem",
    icon: Meh,
    app: "Nexora",
    category: "mensagens",
    execution: "client",
  },
  {
    name: "tableflip",
    description: "Envia sua mensagem com mesa virada",
    icon: Table,
    app: "Nexora",
    category: "mensagens",
    execution: "client",
  },
  {
    name: "unflip",
    description: "Envia sua mensagem com a mesa no lugar",
    icon: Armchair,
    app: "Nexora",
    category: "mensagens",
    execution: "client",
  },
  {
    name: "uppercase",
    description: "Transforma seu texto em MAIÚSCULAS",
    icon: CaseUpper,
    app: "Nexora",
    category: "mensagens",
    execution: "client",
    args: [
      {
        name: "texto",
        description: "Texto para converter",
        type: "string",
        required: true,
        placeholder: "olá mundo",
      },
    ],
  },
  {
    name: "lowercase",
    description: "Transforma seu texto em minúsculas",
    icon: CaseLower,
    app: "Nexora",
    category: "mensagens",
    execution: "client",
    args: [
      {
        name: "texto",
        description: "Texto para converter",
        type: "string",
        required: true,
        placeholder: "OLÁ MUNDO",
      },
    ],
  },
  {
    name: "spoiler",
    description: "Esconde sua mensagem como spoiler (||texto||)",
    icon: EyeOff,
    app: "Nexora",
    category: "mensagens",
    execution: "client",
    args: [
      {
        name: "texto",
        description: "Conteúdo a esconder",
        type: "string",
        required: true,
        placeholder: "o final do filme",
      },
    ],
  },
  {
    name: "gif",
    description: "Pesquisar e enviar um GIF",
    icon: ImageIcon,
    app: "Nexora",
    category: "mídia",
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
    name: "upload",
    description: "Abrir o seletor para enviar um arquivo",
    icon: UploadCloud,
    app: "Nexora",
    category: "mídia",
    execution: "client",
  },
  {
    name: "poll",
    description: "Criar uma enquete",
    icon: BarChart3,
    app: "Nexora",
    category: "enquetes",
    execution: "client",
    args: [
      {
        name: "pergunta",
        description: "Pergunta da enquete",
        type: "string",
        required: false,
        placeholder: "Qual jogo vamos jogar hoje?",
      },
    ],
  },
  {
    name: "topic",
    description: "Criar um tópico neste canal",
    icon: MessageSquarePlus,
    app: "Nexora",
    category: "tópicos",
    execution: "client",
    args: [
      {
        name: "nome",
        description: "Nome do tópico",
        type: "string",
        required: false,
        placeholder: "nome-do-topico",
      },
    ],
  },
  {
    name: "status",
    description: "Alterar seu status de presença",
    icon: Activity,
    app: "Nexora",
    category: "perfil",
    execution: "server",
    args: [
      {
        name: "estado",
        description: "Novo status",
        type: "choice",
        required: true,
        choices: ["online", "idle", "dnd", "invisible"],
      },
    ],
  },
  {
    name: "nick",
    description: "Alterar seu apelido neste servidor",
    icon: UserCog,
    app: "Nexora",
    category: "perfil",
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
    name: "dm",
    description: "Enviar mensagem direta para alguém",
    icon: AtSign,
    app: "Nexora",
    category: "social",
    execution: "server",
    args: [
      {
        name: "usuário",
        description: "@ de destino",
        type: "string",
        required: true,
        placeholder: "@amigo",
      },
      {
        name: "mensagem",
        description: "Conteúdo da mensagem",
        type: "string",
        required: true,
        placeholder: "Oi! Tudo bem?",
      },
    ],
  },
  {
    name: "friend-add",
    description: "Enviar pedido de amizade",
    icon: UserPlus,
    app: "Nexora",
    category: "social",
    execution: "server",
    args: [
      {
        name: "usuário",
        description: "@ da pessoa",
        type: "string",
        required: true,
        placeholder: "@futuro-amigo",
      },
    ],
  },
  {
    name: "help",
    description: "Mostrar a lista de comandos disponíveis",
    icon: HelpCircle,
    app: "Nexora",
    category: "utilidades",
    execution: "client",
  },
  {
    name: "report",
    description: "Denunciar uma mensagem ou usuário",
    icon: Flag,
    app: "Nexora",
    category: "utilidades",
    execution: "client",
  },
  {
    name: "calc",
    description: "Calcular uma expressão matemática",
    icon: Calculator,
    app: "Nexora",
    category: "utilidades",
    execution: "client",
    args: [
      {
        name: "expressão",
        description: "Conta a resolver (+ - * / % **)",
        type: "string",
        required: true,
        placeholder: "(2 + 3) * 4",
      },
    ],
  },
  {
    name: "coinflip",
    description: "Jogar uma moeda",
    icon: Coins,
    app: "Nexora",
    category: "diversão",
    execution: "client",
  },
  {
    name: "dice",
    description: "Rolar um dado",
    icon: Dices,
    app: "Nexora",
    category: "diversão",
    execution: "client",
    args: [
      {
        name: "lados",
        description: "Quantidade de lados (padrão 6)",
        type: "number",
        required: false,
        placeholder: "20",
      },
    ],
  },
  {
    name: "random",
    description: "Sortear um número entre dois valores",
    icon: Shuffle,
    app: "Nexora",
    category: "utilidades",
    execution: "client",
    args: [
      {
        name: "intervalo",
        description: "Mínimo e máximo separados por espaço",
        type: "string",
        required: true,
        placeholder: "1 100",
      },
    ],
  },
  {
    name: "choose",
    description: "Escolher entre opções separadas por vírgula",
    icon: ListChecks,
    app: "Nexora",
    category: "utilidades",
    execution: "client",
    args: [
      {
        name: "opções",
        description: "Opções separadas por vírgula",
        type: "string",
        required: true,
        placeholder: "pizza, hambúrguer, sushi",
      },
    ],
  },
  {
    name: "8ball",
    description: "Pergunte algo à bola mágica",
    icon: Sparkles,
    app: "Nexora",
    category: "diversão",
    execution: "client",
    args: [
      {
        name: "pergunta",
        description: "Pergunta de sim ou não",
        type: "string",
        required: true,
        placeholder: "Vou passar na prova?",
      },
    ],
  },
];

export function searchCommands(query: string): NexoraCommand[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  if (!q) return NEXORA_COMMANDS;
  const exact: NexoraCommand[] = [];
  const prefix: NexoraCommand[] = [];
  const nameIncludes: NexoraCommand[] = [];
  const descriptionIncludes: NexoraCommand[] = [];
  for (const command of NEXORA_COMMANDS) {
    if (command.name === q) exact.push(command);
    else if (command.name.startsWith(q)) prefix.push(command);
    else if (command.name.includes(q)) nameIncludes.push(command);
    else if (command.description.toLowerCase().includes(q))
      descriptionIncludes.push(command);
  }
  return [...exact, ...prefix, ...nameIncludes, ...descriptionIncludes];
}

export function applyTextCommand(
  name: string,
  args: string,
): string | null {
  const trimmed = args.trim();
  switch (name) {
    case "me":
      return trimmed ? `*${trimmed}*` : null;
    case "shrug":
      return `${trimmed ? `${trimmed} ` : ""}¯\\_(ツ)_/¯`;
    case "tableflip":
      return `${trimmed ? `${trimmed} ` : ""}(╯°□°)╯︵ ┻━┻`;
    case "unflip":
      return `${trimmed ? `${trimmed} ` : ""}┬─┬ ノ( ゜-゜ノ)`;
    case "uppercase":
      return trimmed ? trimmed.toUpperCase() : null;
    case "lowercase":
      return trimmed ? trimmed.toLowerCase() : null;
    case "spoiler":
      return trimmed ? `||${trimmed}||` : null;
    default:
      return null;
  }
}

const CALC_MAX_LENGTH = 80;

function tokenizeCalc(input: string): string[] | null {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i;
      while (j < input.length && /[0-9]/.test(input[j])) j += 1;
      if (input[j] === ".") {
        j += 1;
        while (j < input.length && /[0-9]/.test(input[j])) j += 1;
      }
      tokens.push(input.slice(i, j));
      i = j;
      continue;
    }
    if (ch === "*") {
      if (input[i + 1] === "*") {
        tokens.push("**");
        i += 2;
      } else {
        tokens.push("*");
        i += 1;
      }
      continue;
    }
    if ("+-/()%".includes(ch)) {
      tokens.push(ch);
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

function evaluateCalcTokens(tokens: string[]): number | null {
  let pos = 0;
  const peek = () => tokens[pos];

  const parsePrimary = (): number | null => {
    const token = peek();
    if (token === undefined) return null;
    if (token === "(") {
      pos += 1;
      const value = parseExpression();
      if (value === null || peek() !== ")") return null;
      pos += 1;
      return value;
    }
    const num = Number(token);
    if (token === "" || Number.isNaN(num) || !Number.isFinite(num)) return null;
    if (!/^[0-9]*\.?[0-9]+$/.test(token)) return null;
    pos += 1;
    return num;
  };

  const parsePower = (): number | null => {
    const base = parsePrimary();
    if (base === null) return null;
    if (peek() === "**") {
      pos += 1;
      const exponent = parseUnary();
      if (exponent === null) return null;
      const result = base ** exponent;
      return Number.isFinite(result) ? result : null;
    }
    return base;
  };

  const parseUnary = (): number | null => {
    const token = peek();
    if (token === "-") {
      pos += 1;
      const value = parseUnary();
      return value === null ? null : -value;
    }
    if (token === "+") {
      pos += 1;
      return parseUnary();
    }
    return parsePower();
  };

  const parseTerm = (): number | null => {
    let left = parseUnary();
    if (left === null) return null;
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = tokens[pos];
      pos += 1;
      const right = parseUnary();
      if (right === null) return null;
      if ((op === "/" || op === "%") && right === 0) return null;
      left = op === "*" ? left * right : op === "/" ? left / right : left % right;
      if (!Number.isFinite(left)) return null;
    }
    return left;
  };

  const parseExpression = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = tokens[pos];
      pos += 1;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const result = parseExpression();
  if (result === null || pos !== tokens.length) return null;
  return result;
}

const EIGHT_BALL_ANSWERS = [
  "Certamente.",
  "Sem dúvida alguma.",
  "Com certeza.",
  "Parece que sim.",
  "Melhor não contar com isso.",
  "Minha resposta é não.",
  "Minhas fontes dizem que não.",
  "Pergunte novamente mais tarde.",
  "Concentre-se e pergunte de novo.",
  "As perspectivas não são boas.",
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function computeFunCommand(
  name: string,
  args: string,
): string | null {
  const trimmed = args.trim();
  switch (name) {
    case "coinflip":
      return Math.random() < 0.5 ? "🪙 Cara!" : "🪙 Coroa!";
    case "dice": {
      const parsed = Number.parseInt(trimmed, 10);
      const sides = Number.isFinite(parsed)
        ? Math.min(Math.max(parsed, 1), 1000)
        : 6;
      const roll = Math.floor(Math.random() * sides) + 1;
      return `🎲 Você tirou ${roll}`;
    }
    case "random": {
      const parts = trimmed.split(/\s+/);
      if (parts.length !== 2) return null;
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
      if (min > max) return null;
      const roll = Math.floor(Math.random() * (max - min + 1)) + min;
      return `🎲 ${roll}`;
    }
    case "choose": {
      const options = trimmed
        .split(",")
        .map(option => option.trim())
        .filter(option => option.length > 0);
      if (options.length < 2) return null;
      return `🎯 ${pickRandom(options)}`;
    }
    case "8ball": {
      if (!trimmed) return null;
      return pickRandom(EIGHT_BALL_ANSWERS);
    }
    case "calc": {
      if (!trimmed || trimmed.length > CALC_MAX_LENGTH) return null;
      const tokens = tokenizeCalc(trimmed);
      if (!tokens || tokens.length === 0) return null;
      const value = evaluateCalcTokens(tokens);
      if (value === null) return null;
      return String(parseFloat(value.toFixed(10)));
    }
    default:
      return null;
  }
}

const RECENT_KEY = "nexora-recent-commands";
const FAVORITE_KEY = "nexora-favorite-commands";
const RECENT_LIMIT = 8;

function readStoredNames(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeStoredNames(key: string, names: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(names));
  } catch {
    return;
  }
}

export function getRecentCommands(): string[] {
  return readStoredNames(RECENT_KEY).slice(0, RECENT_LIMIT);
}

export function pushRecentCommand(name: string): void {
  const next = [
    name,
    ...readStoredNames(RECENT_KEY).filter(item => item !== name),
  ].slice(0, RECENT_LIMIT);
  writeStoredNames(RECENT_KEY, next);
}

export function getFavoriteCommands(): string[] {
  return readStoredNames(FAVORITE_KEY);
}

export function toggleFavoriteCommand(name: string): string[] {
  const current = readStoredNames(FAVORITE_KEY);
  const next = current.includes(name)
    ? current.filter(item => item !== name)
    : [...current, name];
  writeStoredNames(FAVORITE_KEY, next);
  return next;
}
