# Sistema de Bots da Nexora

O sistema de Bots da Nexora permite criar, automatizar e estender funcionalidades em servidores comunitários através de fluxos visuais inteligentes (Modo Simples) ou scripts TypeScript robustos (Modo Avançado).

---

## 1. Visão Geral e Arquitetura

Os bots do servidor operam no contexto de permissões do servidor onde foram criados, reagindo a eventos de tempo real (mensagens, reações, entrada de membros, chamadas de voz, webhooks e agendamentos cron) e executando ações automatizadas.

### Modos de Operação

| Recurso | Modo Simples (Visual Flow) | Modo Avançado (TypeScript) |
| :--- | :--- | :--- |
| **Público-alvo** | Administradores, moderadores e criadores sem experiência prévia em código | Desenvolvedores, equipes técnicas e integrações complexas |
| **Interface** | Canvas interativo baseado em nós com arrastar e soltar (drag & drop) | Editor de código completo (Monaco Editor) com IntelliSense |
| **Tipagem e Validação** | Validação automática de conexões entre entradas e saídas de nós | Validação estática de TypeScript e checagem de erros de sintaxe |
| **Portabilidade** | Exportação/Importação em formato JSON nativo de fluxo (`BotFlow`) | Scripts portáteis com acesso às interfaces tipadas da API Nexora |

---

## 2. Guia de Criação Passo a Passo

### Passo 1: Informações Básicas
1. Acesse as **Configurações do Servidor** > aba **Bots**.
2. Clique no botão **Criar Bot** no topo da listagem.
3. Defina o **Nome do Bot** (obrigatório, até 100 caracteres).
4. Opcionalmente, envie um **Avatar** (imagem quadrada recomendada: 256x256px, até 5MB em formato PNG, JPG ou WebP) e uma **Descrição** explicativa (até 500 caracteres).
5. Selecione o **Modo Inicial**:
   - **Simples**: editor visual baseado em nós.
   - **Avançado**: script TypeScript direto.
6. Clique em **Continuar**.

### Passo 2A: Construindo no Modo Simples (Visual Flow)
1. **Painel de Nós (Paleta lateral):** Arraste um nó de **Gatilho (Trigger)** para o canvas. *Nota: todo fluxo ativo precisa de exatamente 1 gatilho de início.*
2. **Conectar Nós:** Clique na saída (*output*) de um nó e arraste uma linha de conexão até a entrada (*input*) do nó seguinte.
3. **Configuração de Propriedades:** Clique sobre qualquer nó no canvas para abrir a barra lateral de configuração à direita. Preencha campos obrigatórios como canal de envio, mensagem, cargos ou expressões de condição.
4. **Validação Visual:** O editor valida conexões em tempo real. Nós com pendências exibem um ícone de alerta vermelho.
5. Clique em **Salvar Bot**.

### Passo 2B: Construindo no Modo Avançado (Código TypeScript)
1. No editor de código, você tem acesso ao objeto de contexto de execução `ctx`.
2. Escreva manipuladores de eventos assíncronos ou utilize o template inicial gerado.
3. Monitore o painel inferior para erros de compilação ou validação de tipos.
4. Clique em **Salvar Bot**.

---

## 3. Catálogo de Nós do Visual Flow

### 3.1. Gatilhos (Triggers)
Gatilhos definem quando o bot é ativado. Cada execução gera um contexto com dados do evento.

| Gatilho | Descrição | Dados Disponíveis no Contexto |
| :--- | :--- | :--- |
| `on_message` | Disparado quando uma mensagem é enviada em um canal monitorado. Permite filtrar por canais, ignorar bots e buscar palavras-chave. | `{{message.id}}`, `{{message.content}}`, `{{message.author.id}}`, `{{message.author.username}}`, `{{channel.id}}`, `{{channel.name}}` |
| `on_reaction` | Disparado quando uma reação emoji é adicionada a uma mensagem. | `{{reaction.emoji}}`, `{{user.id}}`, `{{message.id}}`, `{{channel.id}}` |
| `on_member_join` | Disparado no instante em que um novo membro entra no servidor. | `{{user.id}}`, `{{user.username}}`, `{{guild.memberCount}}` |
| `on_member_leave` | Disparado quando um membro sai ou é expulso do servidor. | `{{user.id}}`, `{{user.username}}`, `{{user.tag}}` |
| `on_voice_state_update` | Disparado quando alguém entra, sai, muta ou ensurdece em um canal de voz. | `{{voice.channelId}}`, `{{voice.userId}}`, `{{voice.action}}` |
| `on_button_click` | Disparado ao clicar em botões interativos de mensagens geradas pelo bot. | `{{interaction.customId}}`, `{{interaction.user.id}}`, `{{message.id}}` |
| `on_select_menu` | Disparado ao selecionar itens em menus suspensos interativos. | `{{interaction.values}}`, `{{interaction.user.id}}`, `{{interaction.customId}}` |
| `on_modal_submit` | Disparado após o envio de formulários modais na interface. | `{{modal.fields}}`, `{{user.id}}`, `{{modal.customId}}` |
| `on_command` | Disparado ao digitar comandos com prefixo (ex: `!ajuda`, `/ticket`). | `{{command.name}}`, `{{command.args}}`, `{{message.author.id}}` |
| `cron_trigger` | Disparado periodicamente com base em expressão cron (ex: `0 9 * * 1-5`). | `{{cron.timestamp}}`, `{{cron.scheduledTime}}` |
| `webhook_trigger` | Disparado quando um serviço externo envia payload HTTP POST para o endpoint do bot. | `{{webhook.body}}`, `{{webhook.headers}}`, `{{webhook.query}}` |

### 3.2. Ações (Actions)
Ações realizam tarefas no servidor ou integram com serviços externos.

- **Comunicação:**
  - `send_message`: Envia mensagens de texto puro ou cartões embed formatados para um canal específico ou para o canal de origem do evento.
  - `edit_message`: Modifica o conteúdo de uma mensagem previamente enviada pelo bot.
  - `delete_message`: Remove uma mensagem (necessita de permissão de Gerenciar Mensagens).
  - `send_direct_message`: Envia mensagem privada (DM) para o usuário do evento.
- **Engajamento & Reações:**
  - `add_reaction`: Adiciona uma reação emoji à mensagem disparadora.
  - `remove_reaction`: Remove reações específicas de usuários ou do próprio bot.
- **Moderação e Membros:**
  - `add_role` / `remove_role`: Atribui ou revoga cargos de membros do servidor.
  - `timeout_member`: Aplica silenciamento temporário por duração configurável (ex: 5m, 1h, 1d).
  - `kick_member`: Expulsa o membro do servidor com motivo auditável.
  - `ban_member`: Bane o usuário do servidor com exclusão opcional de histórico de mensagens.
- **Gestão de Canais:**
  - `create_channel` / `delete_channel`: Cria ou remove canais de texto/voz sob demanda.
  - `create_thread`: Cria tópicos de discussão organizados a partir de uma mensagem.
- **Lógica e Integração Externa:**
  - `http_request`: Realiza requisições HTTP REST (GET, POST, PUT, DELETE, PATCH) com cabeçalhos personalizados, autenticação Bearer/API Key e corpo JSON.
  - `set_variable`: Salva dados no escopo de execução ou no estado persistente do bot.
  - `custom_script`: Bloco de código JavaScript inline para transformações de dados rápidas.
  - `log`: Registra logs customizados no histórico de auditoria da execução.

### 3.3. Nós de Lógica e Controle de Fluxo
- **Condição (`condition`):** Avalia expressões lógicas (ex: `{{message.content}}.includes("ajuda")` ou `{{user.roles}}.includes("Mod")`). Possui duas saídas de ramificação: `Verdadeiro (True)` e `Falso (False)`.
- **Paralelo (`parallel`):** Executa múltiplos ramos de ações simultaneamente.
- **Alternador (`switch`):** Ramifica o fluxo em múltiplos caminhos baseados em valores exatos de uma variável ou código.
- **Atraso (`delay`):** Pausa a execução de forma assíncrona por um período determinado em milissegundos ou segundos (ex: aguardar 3000ms antes de enviar a próxima mensagem).

---

## 4. Guia de Variáveis de Contexto e Interpolação

O sistema suporta interpolação dinâmica em strings e configurações utilizando a sintaxe `{{variavel}}`.

### Variáveis Comuns

```text
# Dados do Autor e Usuário
{{user.id}}            -> Identificador único do usuário (ex: "49201948102")
{{user.username}}      -> Nome de usuário (ex: "mariasilva")
{{user.displayName}}   -> Apelido ou nome de exibição no servidor
{{user.avatarUrl}}     -> Link do avatar do usuário

# Dados da Mensagem
{{message.id}}         -> ID da mensagem
{{message.content}}    -> Conteúdo em texto da mensagem
{{message.createdAt}}  -> Data e hora de criação no formato ISO-8601

# Dados do Canal e Servidor
{{channel.id}}         -> ID do canal onde o evento ocorreu
{{channel.name}}       -> Nome do canal (ex: "geral", "anuncios")
{{guild.id}}           -> ID do servidor
{{guild.name}}         -> Nome do servidor
{{guild.memberCount}}  -> Contagem atual de membros

# Variáveis Customizadas e Respostas HTTP
{{variables.meuValor}} -> Variável definida por um nó anterior "set_variable"
{{http.data.campo}}    -> Campo retornado no corpo JSON de um nó "http_request"
```

---

## 5. Modo Avançado: TypeScript & Runtime Sandbox

Para fluxos complexos, regras de negócio dinâmicas ou integrações com APIs proprietárias, o Modo Avançado permite programar diretamente em TypeScript.

### Exemplo de Estrutura

```typescript
import { BotContext, BotEvent } from "@nexora/bot-sdk";

export default async function handleEvent(ctx: BotContext, event: BotEvent) {
  // Verifica se o evento é uma nova mensagem
  if (event.type === "message_create") {
    const { message, channel, user } = event;

    // Ignora mensagens enviadas pelo próprio bot
    if (user.isBot) return;

    if (message.content.startsWith("!ping")) {
      await ctx.actions.sendMessage({
        channelId: channel.id,
        content: `Pong! Latência da API: ${ctx.latency}ms 🏓`,
      });
      return;
    }

    // Exemplo de integração HTTP
    if (message.content.startsWith("!clima ")) {
      const cidade = encodeURIComponent(message.content.replace("!clima ", ""));
      const resposta = await ctx.http.get(`https://api.weatherapi.com/v1/current.json?q=${cidade}`);
      
      await ctx.actions.sendMessage({
        channelId: channel.id,
        embed: {
          title: `Clima em ${resposta.data.location.name}`,
          description: `Temperatura atual: **${resposta.data.current.temp_c}°C**`,
          color: 0x3b82f6,
        },
      });
    }
  }
}
```

---

## 6. Painel de Execuções e Diagnóstico

A aba **Execuções** (disponível no menu de cada bot) oferece rastreabilidade completa de execuções passadas e ativas:

- **Status da Execução:**
  - `Success (Sucesso)`: Todas as etapas do fluxo completaram sem falhas.
  - `Failed (Falha)`: Ocorreu um erro em um nó ou requisição externa. O painel indica o nó causador e a mensagem de erro.
  - `Running (Em execução)`: Fluxo assíncrono ou com atrasos em processamento.
  - `Timeout (Tempo limite excedido)`: Execução excedeu o tempo máximo permitido (padrão: 30 segundos).
- **Inspeção Detalhada:**
  - Duração total em milissegundos.
  - Nós executados em sequência com status individual.
  - Variáveis capturadas e payloads recebidos/enviados.
  - Botão de **Repetir Execução (Retry)** para reproduzir o payload e depurar correções.

---

## 7. Boas Práticas, Limites e Segurança

1. **Permissões de Cargos:** O bot nunca pode gerenciar ou atribuir cargos que estejam em posição hierárquica superior ao cargo do próprio bot no servidor.
2. **Prevenção de Loops:** Nunca configure bots para reagirem cegamente a mensagens de outros bots ou de si mesmos sem filtro de condição `user.isBot === false`.
3. **Rate Limits:** O envio de mensagens respeita a taxa de 5 mensagens a cada 5 segundos por canal. Disparos em massa devem utilizar atrasos intencionais (`delay`).
4. **Segurança de Webhooks:** Utilize tokens de verificação de cabeçalho (`Authorization: Bearer <token>`) em gatilhos de webhook para garantir a autenticidade das chamadas externas.
