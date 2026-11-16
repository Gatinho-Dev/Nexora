import { trpc } from "@/providers/trpc";
import { useCallback } from "react";
import type {
  Bot,
  BotFlow,
  BotExecution,
  BotMode,
} from "@/types/bots";
import type { BotDTO, BotExecutionDTO, BotExecutionStatus, BotTriggerType } from "@contracts/types";
import { isTriggerNodeType, type NodeType } from "@/contracts/bots";

// Transform backend DTO to frontend Bot type
const adaptBot = (dto: BotDTO): Bot => ({
  id: String(dto.id),
  serverId: String(dto.serverId),
  name: dto.name,
  description: dto.description ?? "",
  avatarUrl: dto.avatarUrl,
  mode: dto.mode,
  status: dto.enabled ? "enabled" : "disabled",
  flow: dto.nodesConfig as BotFlow | null,
  code: dto.code,
  createdAt: dto.createdAt instanceof Date ? dto.createdAt.toISOString() : String(dto.createdAt),
  updatedAt: dto.updatedAt instanceof Date ? dto.updatedAt.toISOString() : String(dto.updatedAt),
  createdBy: String(dto.createdByUserId),
  executionCount: 0, // Would need separate count query
  lastExecutedAt: null, // Would need separate query
});

const toDateString = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : String(value);

// Transform backend Execution DTO to frontend BotExecution type
const adaptExecution = (dto: BotExecutionDTO, serverId: string): BotExecution => {
  const startedAt = toDateString(dto.startedAt);
  const completedAt = dto.completedAt ? toDateString(dto.completedAt) : null;
  const startedMs = Date.parse(startedAt);
  const completedMs = completedAt ? Date.parse(completedAt) : NaN;
  return {
    id: String(dto.id),
    botId: String(dto.botId),
    serverId,
    trigger: {
      type: dto.triggerType ?? "webhook",
      data: {},
    },
    status: dto.status,
    context: { variables: dto.context ?? {} },
    result: {
      nodesExecuted: 0,
      actionsPerformed: [],
      finalOutput: dto.result ?? undefined,
    },
    error: dto.error ? { nodeId: "", message: dto.error } : null,
    startedAt,
    completedAt,
    duration:
      Number.isFinite(startedMs) && Number.isFinite(completedMs)
        ? Math.max(0, (completedMs as number) - (startedMs as number))
        : 0,
  };
};

// Transform frontend Bot to backend CreateBotInput
// Omit serverId: the frontend Bot stores it as a string, the backend wants a number.
const adaptBotForCreate = (bot: Omit<Partial<Bot>, "serverId"> & { mode: BotMode; serverId: number }) => ({
  serverId: bot.serverId,
  name: bot.name ?? "",
  description: bot.description,
  avatarUrl: bot.avatarUrl ?? undefined,
  mode: bot.mode,
  code: bot.mode === "advanced" ? bot.code ?? undefined : undefined,
  nodesConfig:
    bot.mode === "simple"
      ? ((bot.flow ?? undefined) as Record<string, unknown> | undefined)
      : undefined,
});

// Transform frontend Bot to backend UpdateBotInput
// Omit id: the frontend Bot stores it as a string, the backend wants botId as a number.
const adaptBotForUpdate = (bot: Omit<Partial<Bot>, "id"> & { id: number }) => ({
  botId: bot.id,
  name: bot.name,
  description: bot.description ?? undefined,
  avatarUrl: bot.avatarUrl ?? undefined,
  mode: bot.mode,
  code: bot.mode === "advanced" ? bot.code ?? undefined : null,
  nodesConfig: bot.mode === "simple" ? (bot.flow as Record<string, unknown> | null) : null,
});

export const useBots = (serverId: number) => {
  const list = trpc.bot.list.useQuery({ serverId });
  const create = trpc.bot.create.useMutation();
  const update = trpc.bot.update.useMutation();
  const deleteBot = trpc.bot.delete.useMutation();
  const toggle = trpc.bot.toggle.useMutation();

  // Adapter functions for components
  const adaptBots = useCallback((dtos: BotDTO[]): Bot[] => dtos.map(adaptBot), []);
  const adaptBotAdapter = useCallback((dto: BotDTO): Bot => adaptBot(dto), []);
  const adaptExecutions = useCallback(
    (dtos: BotExecutionDTO[], serverId: string): BotExecution[] =>
      dtos.map((dto) => adaptExecution(dto, serverId)),
    []
  );
  const adaptExecutionAdapter = useCallback(
    (dto: BotExecutionDTO, serverId: string): BotExecution => adaptExecution(dto, serverId),
    []
  );

  return {
    // Bound tRPC hooks
    list, create, update, deleteBot, toggle,
    // Adapters
    adaptBots, adaptBot: adaptBotAdapter, adaptExecutions, adaptExecution: adaptExecutionAdapter,
    adaptBotForCreate, adaptBotForUpdate,
  };
};

// O banco guarda triggerType como texto livre; normaliza para o union do DTO
// (desconhecido vira null e o adaptador usa "webhook" como reserva).
const toExecutionDTO = (row: {
  id: number;
  botId: number;
  triggerId: number | null;
  triggerType: string | null;
  status: BotExecutionStatus;
  context: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | Date;
  completedAt: string | Date | null;
}): BotExecutionDTO => ({
  ...row,
  triggerType:
    row.triggerType && isTriggerNodeType(row.triggerType as NodeType)
      ? (row.triggerType as BotTriggerType)
      : null,
});

// Cursor-based execution history for one bot (newest first).
export const useBotExecutions = (botId: number, execServerId: string, limit = 25) => {
  const query = trpc.bot.listExecutions.useInfiniteQuery(
    { botId, limit },
    {
      enabled: Number.isFinite(botId),
      getNextPageParam: (page) =>
        page.hasMore ? page.items[page.items.length - 1]?.id : undefined,
    }
  );
  const executions = (query.data?.pages ?? []).flatMap((page) =>
    page.items.map((row) => adaptExecution(toExecutionDTO(row), execServerId))
  );
  return { ...query, executions };
};