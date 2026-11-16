/**
 * Nexora Bots - Starter Templates
 * Pronto-para-usar fluxos válidos para a galeria "Começar de um modelo".
 * Cada template monta objetos novos a cada chamada (sem estado compartilhado)
 * e só usa campos obrigatórios preenchidos, para abrir sem erros de validação.
 */

import { getNodeDefinition } from "@/contracts/bots";
import type {
  ActionConfig,
  ActionNodeType,
  BotFlow,
  FlowEdge,
  FlowNode,
  LogicConfig,
  TriggerConfig,
  TriggerNodeType,
} from "@/contracts/bots";

export interface BotTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Chave de ícone do flowIcons (renderIcon). */
  icon: string;
  suggestedName: string;
  build: () => BotFlow;
}

// ============================================
// Builders (sempre retornam objetos novos)
// ============================================

function triggerNode(
  id: string,
  type: TriggerNodeType,
  label: string,
  x: number,
  y: number,
  config: TriggerConfig = {},
): FlowNode {
  const def = getNodeDefinition(type);
  return {
    id,
    type,
    position: { x, y },
    data: {
      label,
      category: "trigger",
      triggerType: type,
      config,
      outputs: def?.outputs ?? [],
    },
  };
}

function actionNode(
  id: string,
  type: ActionNodeType,
  label: string,
  x: number,
  y: number,
  config: ActionConfig,
): FlowNode {
  const def = getNodeDefinition(type);
  return {
    id,
    type,
    position: { x, y },
    data: {
      label,
      category: "action",
      actionType: type,
      config,
      inputs: def?.inputs ?? [],
      outputs: def?.outputs ?? [],
    },
  };
}

function conditionNode(
  id: string,
  label: string,
  x: number,
  y: number,
  expression: string,
): FlowNode {
  const def = getNodeDefinition("condition");
  const config: LogicConfig = { expression };
  return {
    id,
    type: "condition",
    position: { x, y },
    data: {
      label,
      category: "logic",
      logicType: "condition",
      config,
      inputs: def?.inputs ?? [],
      outputs: def?.outputs ?? [],
    },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
): FlowEdge {
  return sourceHandle
    ? { id, source, target, sourceHandle }
    : { id, source, target };
}

function flow(nodes: FlowNode[], edges: FlowEdge[]): BotFlow {
  return { version: 1, nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
}

// ============================================
// Templates
// ============================================

function buildWelcome(): BotFlow {
  return flow(
    [
      triggerNode("t-join", "member_join", "Quando alguém entrar", 80, 140),
      actionNode("a-hello", "send_message", "Dar boas-vindas", 400, 140, {
        content:
          "👋 Bem-vindo(a) ao servidor, {user}! Dá uma olhada nas regras e se apresenta pra gente. 🎉",
      }),
    ],
    [edge("e-join-hello", "t-join", "a-hello")],
  );
}

function buildPingCommand(): BotFlow {
  return flow(
    [
      triggerNode("t-cmd", "command", "Comando /ping", 80, 140, {
        commandName: "ping",
        description: "Responde com Pong para testar o bot",
      }),
      actionNode("a-pong", "send_message", "Responder Pong", 400, 140, {
        content: "🏓 Pong! Estou online e funcionando.",
      }),
    ],
    [edge("e-cmd-pong", "t-cmd", "a-pong")],
  );
}

function buildLinkWatch(): BotFlow {
  return flow(
    [
      triggerNode("t-msg", "message_create", "Mensagem com link", 80, 140, {
        keyword: "http",
        ignoreBots: true,
      }),
      conditionNode(
        "l-invite",
        "É convite de outro servidor?",
        400,
        140,
        'event.message.content.includes("discord.gg")',
      ),
      actionNode("a-warn", "send_message", "Avisar no canal", 720, 60, {
        content:
          "⚠️ Ei {user}, links de convite não são permitidos aqui. Chama um moderador se precisar compartilhar algo!",
      }),
    ],
    [edge("e-msg-cond", "t-msg", "l-invite"), edge("e-cond-warn", "l-invite", "a-warn", "true")],
  );
}

function buildDailyAnnouncement(): BotFlow {
  return flow(
    [
      triggerNode("t-cron", "scheduled", "Todo dia às 9h", 80, 140, {
        cronExpression: "0 12 * * *",
        timezone: "UTC",
      }),
      actionNode("a-news", "send_message", "Bom dia do servidor", 400, 140, {
        content:
          "☀️ Bom dia, pessoal! Passando pra lembrar: o evento da semana começa hoje. Reajam com 🎮 pra participar!",
      }),
    ],
    [edge("e-cron-news", "t-cron", "a-news")],
  );
}

export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: "welcome",
    name: "Boas-vindas",
    tagline: "Recebe quem entra no servidor",
    description:
      "Quando um membro novo entra, o bot manda uma mensagem de boas-vindas no canal. 2 nós, pronto pra personalizar o texto.",
    icon: "UserPlus",
    suggestedName: "Recepção",
    build: buildWelcome,
  },
  {
    id: "ping-command",
    name: "Comando /ping",
    tagline: "Responde na hora pra testar",
    description:
      "Registra o comando /ping e responde Pong. Ideal como primeiro teste de que o bot está respondendo.",
    icon: "Zap",
    suggestedName: "Ping",
    build: buildPingCommand,
  },
  {
    id: "link-watch",
    name: "Sentinela de convites",
    tagline: "Avisa sobre links de outros servidores",
    description:
      "Detecta mensagens com link, verifica se é convite (discord.gg) e avisa no canal. Mostra como usar condições.",
    icon: "ShieldAlert",
    suggestedName: "Sentinela",
    build: buildLinkWatch,
  },
  {
    id: "daily-announcement",
    name: "Bom dia automático",
    tagline: "Mensagem agendada todo dia",
    description:
      "Dispara todo dia às 9h (horário de Brasília) com um recado. Troque o texto e o horário quando quiser.",
    icon: "Clock",
    suggestedName: "Bom dia",
    build: buildDailyAnnouncement,
  },
];

export function getBotTemplate(id: string): BotTemplate | undefined {
  return BOT_TEMPLATES.find((t) => t.id === id);
}
