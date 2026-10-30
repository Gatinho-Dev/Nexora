import React from "react";
import { ServerBotsList } from "./ServerBotsList";

export const BotsTab: React.FC<{ serverId: number }> = ({ serverId }) => (
  <div>
    <h2>Bots — Integrações</h2>
    <ServerBotsList serverId={serverId} />
  </div>
);
