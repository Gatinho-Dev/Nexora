import React from "react";

// REFERENCE — BotsPage (prioridade 1 conforme Atlas; integra botRouter.ts, 17 rotas tRPC, tipos @contracts/types)
// NÃO modifica código existente — adiciona nova rota /server/:serverId/settings/integrations/bots
// Precisa ser importado no router de páginas; tab "Bots" adicionada no ServerSettingsModal (para Atlas/Pixel depois)

import { ServerBotsList } from "@/components/bots/ServerBotsList";
import { BotEditorModal } from "@/components/bots/BotEditorModal";

export const BotsPage: React.FC<{ serverId: number }> = ({ serverId }) => (
  <div>
    <h1>Bots — Integração do Servidor</h1>
    <ServerBotsList serverId={serverId} />
    <BotEditorModal serverId={serverId} onClose={() => {}} />
    {/* BotFlowEditor (React Flow — Pixel entrega componentes) será integrado na prioridade 2 */}
  </div>
);
