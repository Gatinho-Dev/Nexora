import React, { useState } from "react";
import { ServerBotsList } from "./ServerBotsList";
import { BotEditorModal } from "./BotEditorModal";
import { BotExecutionsTab } from "./BotExecutionsTab";
import { useBots } from "@/hooks/useBots";
import type { Bot } from "@/types/bots";

export const BotsTab: React.FC<{ serverId: number }> = ({ serverId }) => {
  const { list: query, adaptBots, toggle, deleteBot, create, update, adaptBotForCreate, adaptBotForUpdate } = useBots(serverId);
  const bots = query.data ? adaptBots(query.data) : [];
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingExecutions, setViewingExecutions] = useState<Bot | null>(null);

  const handleCreate = async (botData: Partial<Bot> & { mode: "simple" | "advanced" }) => {
    await create.mutateAsync(adaptBotForCreate({ ...botData, serverId }));
    setIsCreating(false);
    query.refetch();
  };

  const handleEdit = (bot: Bot) => {
    setEditingBot(bot);
  };

  const handleSaveEdit = async (botData: Partial<Bot> & { mode: "simple" | "advanced" }) => {
    if (editingBot) {
      await update.mutateAsync(adaptBotForUpdate({ ...botData, id: Number(editingBot.id) }));
      setEditingBot(null);
      query.refetch();
    }
  };

  const handleDelete = async (bot: Bot) => {
    if (confirm(`Deletar o bot "${bot.name}"?`)) {
      await deleteBot.mutateAsync({ botId: Number(bot.id) });
      query.refetch();
    }
  };

  const handleToggleStatus = async (bot: Bot, enabled: boolean) => {
    await toggle.mutateAsync({ botId: Number(bot.id), enabled });
    query.refetch();
  };

  const handleViewExecutions = (bot: Bot) => {
    setViewingExecutions(bot);
  };

  const handleDuplicate = async (bot: Bot) => {
    await create.mutateAsync(adaptBotForCreate({
      serverId,
      name: `${bot.name} (Cópia)`,
      description: bot.description,
      avatarUrl: bot.avatarUrl,
      mode: bot.mode,
      code: bot.code,
      flow: bot.flow,
    }));
    query.refetch();
  };

  if (viewingExecutions) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-surface-border">
          <button
            onClick={() => setViewingExecutions(null)}
            className="btn btn-secondary btn-sm"
          >
            ← Voltar
          </button>
          <div className="min-w-0">
            <h3 className="font-medium text-text-primary truncate">
              Execuções · {viewingExecutions.name}
            </h3>
            <p className="text-xs text-text-tertiary">Histórico mais recente primeiro</p>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <BotExecutionsTab botId={viewingExecutions.id} serverId={viewingExecutions.serverId} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ServerBotsList
        bots={bots}
        loading={query.isLoading}
        totalCount={bots.length}
        onCreate={() => setIsCreating(true)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onViewExecutions={handleViewExecutions}
      />
      {(isCreating || editingBot) && (
        <BotEditorModal
          bot={editingBot}
          isOpen={isCreating || !!editingBot}
          onClose={() => {
            setIsCreating(false);
            setEditingBot(null);
          }}
          onSave={isCreating ? handleCreate : handleSaveEdit}
          saving={create.isPending || update.isPending}
        />
      )}
    </div>
  );
};