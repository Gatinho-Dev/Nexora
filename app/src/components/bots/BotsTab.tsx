import React, { useState } from "react";
import { ServerBotsList } from "./ServerBotsList";
import { BotEditorModal } from "./BotEditorModal";
import { useBots } from "@/hooks/useBots";
import type { Bot } from "@/types/bots";

export const BotsTab: React.FC<{ serverId: number }> = ({ serverId }) => {
  const { list, adaptBots, toggle, deleteBot, create, update, adaptBotForCreate, adaptBotForUpdate } = useBots();
  const query = list({ serverId });
  const bots = query.data ? adaptBots(query.data as any) : [];
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
    // TODO: navigate to executions tab
    console.log("View executions for", bot.id);
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

  return (
    <div>
      <ServerBotsList
        serverId={serverId}
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