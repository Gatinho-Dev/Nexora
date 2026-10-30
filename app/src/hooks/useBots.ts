import { trpc } from "@/providers/trpc";
import { useCallback } from "react";

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

  return {
    list, get, create, update, deleteBot, toggle, saveFlow, listExecutions, testRun,
    createTrigger, updateTrigger, deleteTrigger,
    createAction, updateAction, deleteAction,
    createNode, updateNode, deleteNode,
    createEdge, updateEdge, deleteEdge,
  };
};
