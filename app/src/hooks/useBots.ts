import { trpc } from "@/providers/trpc";
import { useCallback } from "react";
import type { Bot, BotFlow, BotExecution, BotStatus, BotMode } from "@/types/bots";
import type { BotDTO, BotExecutionDTO } from "@/contracts/types";

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

// Transform backend Execution DTO to frontend BotExecution type
const adaptExecution = (dto: BotExecutionDTO): BotExecution => ({
  id: String(dto.id),
  botId: String(dto.botId),
  triggerId: dto.triggerId ? String(dto.triggerId) : null,
  triggerType: dto.triggerType ?? null,
  status: dto.status,
  context: dto.context as Record<string, unknown> | null,
  result: dto.result as Record<string, unknown> | null,
  error: dto.error,
  startedAt: dto.startedAt instanceof Date ? dto.startedAt.toISOString() : String(dto.startedAt),
  completedAt: dto.completedAt ? (dto.completedAt instanceof Date ? dto.completedAt.toISOString() : String(dto.completedAt)) : null,
});

// Transform frontend Bot to backend CreateBotInput
const adaptBotForCreate = (bot: Partial<Bot> & { mode: BotMode; serverId: number }) => ({
  serverId: bot.serverId,
  name: bot.name,
  description: bot.description,
  avatarUrl: bot.avatarUrl,
  mode: bot.mode,
  code: bot.mode === "advanced" ? bot.code : null,
  nodesConfig: bot.mode === "simple" ? (bot.flow as Record<string, unknown> | null) : null,
});

// Transform frontend Bot to backend UpdateBotInput
const adaptBotForUpdate = (bot: Partial<Bot> & { id: number }) => ({
  id: bot.id,
  name: bot.name,
  description: bot.description,
  avatarUrl: bot.avatarUrl,
  mode: bot.mode,
  code: bot.mode === "advanced" ? bot.code : null,
  nodesConfig: bot.mode === "simple" ? (bot.flow as Record<string, unknown> | null) : null,
});

export const useBots = () => {
  const list = trpc.bot.list.useQuery;
  const get = trpc.bot.get.useQuery;
  const create = trpc.bot.create.useMutation;
  const update = trpc.bot.update.useMutation;
  const deleteBot = trpc.bot.delete.useMutation;
  const toggle = trpc.bot.toggle.useMutation;
  const saveFlow = trpc.bot.saveFlow.useMutation;
  const listExecutions = trpc.bot.listExecutions.useQuery;
  const testRun = trpc.bot.testRun.useMutation;

  const createTrigger = trpc.bot.createTrigger.useMutation;
  const updateTrigger = trpc.bot.updateTrigger.useMutation;
  const deleteTrigger = trpc.bot.deleteTrigger.useMutation;

  const createAction = trpc.bot.createAction.useMutation;
  const updateAction = trpc.bot.updateAction.useMutation;
  const deleteAction = trpc.bot.deleteAction.useMutation;

  const createNode = trpc.bot.createNode.useMutation;
  const updateNode = trpc.bot.updateNode.useMutation;
  const deleteNode = trpc.bot.deleteNode.useMutation;

  const createEdge = trpc.bot.createEdge.useMutation;
  const updateEdge = trpc.bot.updateEdge.useMutation;
  const deleteEdge = trpc.bot.deleteEdge.useMutation;

  // Adapter functions for components
  const adaptBots = useCallback((dtos: BotDTO[]): Bot[] => dtos.map(adaptBot), []);
  const adaptBotAdapter = useCallback((dto: BotDTO): Bot => adaptBot(dto), []);
  const adaptExecutions = useCallback((dtos: BotExecutionDTO[]): BotExecution[] => dtos.map(adaptExecution), []);
  const adaptExecutionAdapter = useCallback((dto: BotExecutionDTO): BotExecution => adaptExecution(dto), []);

  return {
    // Raw tRPC hooks
    list, get, create, update, deleteBot, toggle, saveFlow, listExecutions, testRun,
    createTrigger, updateTrigger, deleteTrigger,
    createAction, updateAction, deleteAction,
    createNode, updateNode, deleteNode,
    createEdge, updateEdge, deleteEdge,
    // Adapters
    adaptBots, adaptBot: adaptBotAdapter, adaptExecutions, adaptExecution: adaptExecutionAdapter,
    adaptBotForCreate, adaptBotForUpdate,
  };
};