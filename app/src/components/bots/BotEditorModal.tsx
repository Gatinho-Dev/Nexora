import React, { useState } from "react";
import { useBots } from "@/hooks/useBots";

export const BotEditorModal: React.FC<{ serverId: number; botId?: number; onClose: () => void }> = ({
  serverId,
  botId,
  onClose,
}) => {
  const { get, create, update, toggle } = useBots();
  const existing = botId ? get({ botId }) : { data: undefined };
  const bot = existing.data?.bot as { id: number; name: string; description: string | null; mode: "simple" | "advanced"; enabled: boolean; avatarUrl: string | null } | undefined;

  const [name, setName] = useState(bot?.name ?? "");
  const [description, setDescription] = useState(bot?.description ?? "");
  const [mode, setMode] = useState<"simple" | "advanced">(bot?.mode ?? "simple");
  const [enabled, setEnabled] = useState(bot?.enabled ?? true);

  const onSave = () => {
    if (botId && bot) {
      update({ botId, name, description, mode, enabled, nodesConfig: bot.nodesConfig ?? {} });
    } else {
      create({ serverId, name, description, mode, code: undefined });
    }
    onClose();
  };

  return (
    <div style={{ border: "2px solid #333", padding: 16, borderRadius: 10, background: "#fafafa" }}>
      <h2>{botId ? "Editar Bot" : "Novo Bot"}</h2>
      <label>Nome: <input value={name} onChange={(e) => setName(e.target.value)} /></label><br />
      <label>Descrição: <input value={description} onChange={(e) => setDescription(e.target.value)} /></label><br />
      <label>Modo: <select value={mode} onChange={(e) => setMode(e.target.value as "simple" | "advanced")}>
        <option value="simple">Simples</option>
        <option value="advanced">Avançado</option>
      </select></label><br />
      <label>Ativo: <input type="checkbox" checked={enabled} onChange={() => setEnabled(!enabled)} /></label><br />
      <button onClick={onSave}>Salvar</button>
      <button onClick={onClose} style={{ marginLeft: 8 }}>Cancelar</button>
    </div>
  );
};
