import React from "react";
import { useBots } from "@/hooks/useBots";

// REFERENCE / ESTRUCTURA — BotExecutionsTab (prioridade 3, paginado)
// Usa bot.listExecutions({ botId, limit, cursor }) via tRPC
// Integra com BotExecutionDTO (@contracts/types) — status, trigger, createdAt, etc.

export const BotExecutionsTab: React.FC<{ botId: number }> = ({ botId }) => {
  const { listExecutions } = useBots();
  const query = listExecutions({ botId, limit: 10 });

  return (
    <div>
      <h3>Execuções</h3>
      {query.isLoading ? <p>Carregando...</p> : (
        <ul>
          {(query.data?.executions ?? []).map((ex: { id: number; status: string; triggerId: number | null; createdAt: string }) => (
            <li key={ex.id}>{ex.status} (trigger: {ex.triggerId ?? "—"}) @ {ex.createdAt}</li>
          ))}
        </ul>
      )}
      <button onClick={() => {}}>Ver detalhes</button>
    </div>
  );
};
