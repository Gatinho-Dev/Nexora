import React, { useState } from "react";
import { useBots } from "@/hooks/useBots";
import type { BotDTO } from "@/contracts/types";

export const ServerBotsList: React.FC<{ serverId: number }> = ({ serverId }) => {
  const { list } = useBots();
  const query = list({ serverId });
  const bots = (query.data?.bots as BotDTO[] | undefined) ?? [];
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Bots</h2>
        <button onClick={() => setOpen(true)}>Novo Bot</button>
      </div>
      {query.isLoading && <p>Carregando...</p>}
      {bots.map((bot) => (
        <div key={bot.id} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8, borderRadius: 6 }}>
          <strong>{bot.name}</strong> <span style={{ color: "#666" }}>({bot.mode})</span>
          <br />
          <small>{bot.description ?? "Sem descrição"}</small>
          <br />
          <button onClick={() => {}}>Editar</button>
        </div>
      ))}
      {open && (
        <div style={{ border: "1px solid #ddd", padding: 12, marginTop: 12, borderRadius: 8 }}>
          <h3>Criar Bot</h3>
          <p>Modal básico (passo 1: nome, descrição, modo simple/advanced, avatar). Integra bot.create({"{ serverId }"}) via tRPC.</p>
          <button onClick={() => setOpen(false)}>Fechar</button>
        </div>
      )}
    </div>
  );
};
