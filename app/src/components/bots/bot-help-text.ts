/**
 * Nexora Bots UI - Help Texts, Tooltips & Friendly Error Messages
 * Centralized, accessible, and user-friendly copywriting for the bot system.
 */

export interface FriendlyError {
  title: string;
  message: string;
  action: string;
}

export const BOT_TOOLTIPS = {
  createBot: "Criar um novo bot para este servidor",
  duplicateBot: "Criar uma cópia deste bot com configurações idênticas",
  exportBot: "Exportar fluxo e configurações do bot em formato JSON",
  importBot: "Importar bot a partir de um arquivo JSON previamente exportado",
  deleteBot: "Excluir permanentemente este bot e seu histórico de execuções",
  editBot: "Abrir o editor para modificar configurações, nós ou código",
  viewExecutions: "Ver histórico detalhado de execuções, logs e status",
  toggleEnable: "Ativar bot para responder a eventos em tempo real",
  toggleDisable: "Pausar bot temporariamente sem perder configurações",
  undo: "Desfazer última alteração no fluxo (Ctrl+Z)",
  redo: "Refazer alteração desfeita (Ctrl+Y)",
  zoomIn: "Aproximar visualização do canvas (+)",
  zoomOut: "Afastar visualização do canvas (-)",
  fitView: "Ajustar visualização para enquadrar todos os nós na tela",
  centerView: "Centralizar visualização no ponto de origem",
  autoAlign: "Reorganizar nós automaticamente em ordem lógica de fluxo",
  minimap: "Alternar exibição do minimapa de navegação",
  closeModal: "Fechar janela (alterações não salvas serão descartadas)",
  saveBot: "Salvar e aplicar todas as alterações do bot",
  retryExecution: "Repetir execução com o mesmo evento e parâmetros para depuração",
  clearFilters: "Limpar todos os filtros de busca",
  searchBots: "Filtrar bots por nome ou descrição",
} as const;

export const BOT_HELP_TEXTS = {
  name: "Nome exibido no servidor e nas mensagens enviadas pelo bot (1 a 100 caracteres).",
  avatar: "Imagem de perfil do bot (PNG, JPG ou WebP até 5MB). Resolução recomendada: 256x256px.",
  description: "Descreva a finalidade deste bot para manter a equipe de moderação alinhada.",
  modeSimple: "Editor visual baseado em blocos conectáveis. Ideal para fluxos automáticos sem precisar programar.",
  modeAdvanced: "Editor de código TypeScript com IntelliSense. Ideal para integrações com APIs e lógica sob medida.",
  cronExpression: "Expressão cron no formato minuto, hora, dia-do-mês, mês e dia-da-semana. Ex: \"0 9 * * 1-5\" roda de seg a sex às 09:00.",
  webhookEndpoint: "Endpoint HTTP gerado exclusivamente para receber notificações de serviços externos (GitHub, Stripe, etc).",
  channelFilter: "Selecione apenas os canais onde o bot deve agir. Deixe em branco para escutar em todos os canais visíveis.",
  roleHierarchy: "Atenção: o bot só pode atribuir ou remover cargos com posição inferior ao cargo do próprio bot no servidor.",
  variablesSyntax: "Utilize chaves duplas como {{message.content}} ou {{user.username}} para inserir valores dinâmicos.",
  httpHeaders: "Insira cabeçalhos no formato chave-valor (ex: Authorization: Bearer seu_token).",
  httpBody: "Corpo da requisição em formato JSON válido para chamadas POST, PUT ou PATCH.",
} as const;

const ERROR_DICTIONARY: Record<string, FriendlyError> = {
  ERR_NAME_REQUIRED: {
    title: "Nome do bot obrigatório",
    message: "O bot precisa de um nome identificável para ser salvo.",
    action: "Digite um nome para o bot no campo de informações básicas.",
  },
  ERR_CODE_REQUIRED: {
    title: "Código do bot não preenchido",
    message: "No modo avançado, é necessário fornecer o script TypeScript de execução.",
    action: "Escreva o código do manipulador de eventos ou clique no botão de template inicial.",
  },
  ERR_MISSING_TRIGGER: {
    title: "Gatilho de início não encontrado",
    message: "Todo bot precisa saber quando deve ser ativado. O fluxo visual não possui nenhum nó de gatilho.",
    action: "Arraste um nó da categoria Gatilhos (ex: Quando Mensagem Enviada) para o início do fluxo.",
  },
  ERR_MULTIPLE_TRIGGERS: {
    title: "Múltiplos gatilhos desconectados",
    message: "Foram encontrados múltiplos nós de gatilho sem caminhos unificados.",
    action: "Mantenha um gatilho principal por fluxo ou separe os objetivos em bots distintos.",
  },
  ERR_ORPHAN_NODES: {
    title: "Nós desconectados no fluxo",
    message: "Alguns nós de ação estão soltos no canvas e nunca serão alcançados pela execução.",
    action: "Conecte as saídas dos nós anteriores às entradas destes nós ou remova os nós não utilizados.",
  },
  ERR_INVALID_CRON: {
    title: "Expressão de agendamento (cron) inválida",
    message: "A expressão fornecida não obedece ao padrão padrão cron de 5 campos.",
    action: "Revise a sintaxe. Exemplo: \"0 12 * * *\" para rodar todos os dias ao meio-dia.",
  },
  ERR_INVALID_JSON: {
    title: "Formato JSON inválido",
    message: "O conteúdo informado no corpo da requisição ou configuração contém erros de formatação.",
    action: "Verifique se as aspas duplas, vírgulas e chaves estão corretamente balanceadas.",
  },
  ERR_RATE_LIMIT: {
    title: "Limite de mensagens atingido (Rate Limit)",
    message: "O bot tentou enviar mensagens em um ritmo superior ao permitido pelo servidor.",
    action: "Adicione nós de Atraso (Delay) de pelo menos 1 a 2 segundos entre envios sucessivos.",
  },
  ERR_MISSING_PERMISSIONS: {
    title: "Permissões insuficientes no servidor",
    message: "O bot não possui privilégios necessários para executar esta ação (ex: gerenciar cargos ou expulsar membros).",
    action: "Acesse as Configurações do Servidor > Cargos e garanta que o cargo do bot possui as permissões necessárias.",
  },
  ERR_ROLE_HIERARCHY: {
    title: "Hierarquia de cargos incompatível",
    message: "O cargo que o bot tentou gerenciar está acima ou no mesmo nível que o cargo do próprio bot.",
    action: "Mova o cargo do bot para uma posição superior na listagem de cargos do servidor.",
  },
  ERR_CHANNEL_NOT_FOUND: {
    title: "Canal não encontrado ou excluído",
    message: "O canal configurado para esta ação não existe mais ou o bot perdeu acesso de visualização.",
    action: "Edite o nó de envio e selecione um canal de texto ativo.",
  },
  ERR_EXECUTION_TIMEOUT: {
    title: "Tempo limite de execução excedido",
    message: "O fluxo demorou mais de 30 segundos para ser concluído e foi interrompido por segurança.",
    action: "Reduza atrasos longos ou otimize requisições HTTP externas para responderem mais rapidamente.",
  },
  ERR_HTTP_FAILED: {
    title: "Falha na requisição HTTP externa",
    message: "O servidor de destino retornou erro ou não respondeu à chamada.",
    action: "Confira a URL do serviço, cabeçalhos de autenticação e se a API externa está online.",
  },
};

/**
 * Transforms technical errors into friendly, understandable and actionable messages.
 */
export function getFriendlyErrorMessage(raw: unknown): FriendlyError {
  if (!raw) {
    return {
      title: "Erro inesperado",
      message: "Ocorreu uma inconsistência ao processar a solicitação.",
      action: "Tente novamente ou verifique as configurações do bot.",
    };
  }

  const errorString = typeof raw === "string" ? raw : (raw as any)?.message || (raw as any)?.code || String(raw);

  for (const [key, item] of Object.entries(ERROR_DICTIONARY)) {
    if (errorString.toLowerCase().includes(key.toLowerCase())) {
      return item;
    }
  }

  // Common pattern matching
  if (errorString.toLowerCase().includes("name is required") || errorString.toLowerCase().includes("nome")) {
    return ERROR_DICTIONARY.ERR_NAME_REQUIRED;
  }
  if (errorString.toLowerCase().includes("code is required")) {
    return ERROR_DICTIONARY.ERR_CODE_REQUIRED;
  }
  if (errorString.toLowerCase().includes("rate limit") || errorString.includes("429")) {
    return ERROR_DICTIONARY.ERR_RATE_LIMIT;
  }
  if (errorString.toLowerCase().includes("permission") || errorString.includes("403") || errorString.toLowerCase().includes("forbidden")) {
    return ERROR_DICTIONARY.ERR_MISSING_PERMISSIONS;
  }
  if (errorString.toLowerCase().includes("timeout") || errorString.toLowerCase().includes("timed out")) {
    return ERROR_DICTIONARY.ERR_EXECUTION_TIMEOUT;
  }
  if (errorString.toLowerCase().includes("json") || errorString.toLowerCase().includes("syntaxerror")) {
    return ERROR_DICTIONARY.ERR_INVALID_JSON;
  }
  if (errorString.toLowerCase().includes("cron")) {
    return ERROR_DICTIONARY.ERR_INVALID_CRON;
  }

  return {
    title: "Atenção ao salvar o bot",
    message: errorString,
    action: "Revise os campos sinalizados em vermelho e tente novamente.",
  };
}
