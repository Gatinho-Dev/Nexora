# UX Review — Página de Bots do Nexora

**Revisor:** Product Design Lead  
**Escopo:** `src/components/bots/`, `src/components/flow/`, `src/styles/design-tokens.ts`, `src/styles/globals.css`  
**Status do build:** build passa (correção anterior aplicada). ESLint aponta erros de qualidade em componentes e stories (ver abaixo).

---

## O que já está bem (mantenha)

- **Dark mode por padrão** com toggle de tema (`src/lib/theme.ts`), respeitando `prefers-color-scheme`.
- **Empty states, loading skeletons e paginação** em `ServerBotsList` — bons padrões de lista.
- **Focus-visible global** em `globals.css` — navegação por teclado coberta.
- **Flow editor** com undo/redo, minimap, grid, zoom, alinhamento e atalhos de teclado (`BotFlowEditor`, `FlowToolbar`, `KeyboardShortcutsModal`).
- **Node palette** com busca, categorias colapsáveis (trigger/action/logic) e cores por categoria (`NodePalette`).
- **Node config sidebar** com labels, campos de input/select, descriptions, erros e `aria-*` (`NodeConfigSidebar`).
- **Toast system** definido em `globals.css` (sucesso/erro/aviso/info).
- **Status toggle, dropdown de ações, confirmação de delete** em `BotListItem`.

---

## Achados de consistência de design (ação: Pixel)

### 1. Não há fonte única de verdade para tokens
`src/styles/design-tokens.ts` define uma paleta completa (`colors`, `spacing`, `typography`, `transitions`, `zIndex`, `animation`), mas `src/styles/globals.css` redefine as mesmas cores como CSS custom properties duplicadas, e os componentes usam classes Tailwind **hardcoded** (`bg-primary-500`, `text-text-primary`, `border-surface-border`) e `var(--color-*)` misturados.

**Risco:** alterar um token em `design-tokens.ts` não muda a UI. Qualquer ajuste de marca precisa ser feito em três lugares.

**Recomendação:** escolher um mecanismo (CSS vars geradas a partir de `design-tokens.ts` via `generateCSSVariables()`, aplicado em `globals.css`) e fazer os componentes consumirem apenas essas classes/vars. Remover duplicatas.

### 2. Animações definidas, não aplicadas
`globals.css` define `.animate-in`, `.animate-out`, `animate-slide-down`, `animate-slide-up`, `animate-pulse`, mas os componentes não as usam consistentemente: modais aparecem sem transição, toasts aparecem sem entrada, listas não animam itens novos.

**Recomendação:** aplicar `animate-in` nos modais/panéis, `animate-slide-down` nos dropdowns e `animate-out` nos toasts ao fechar. Manter durações coerentes com `--animation-fast/normal`.

### 3. Responsividade parcial
- `ServerBotsList` grid responsivo (1 → 4 colunas) — OK.
- `BotEditorModal` não mostra adaptação para telas estreitas (modal pode exceder a viewport em mobile).
- `BotFlowEditor` canvas/sidebar não reagem a breakpoints (sidebar fixa `w-80` pode romper em telas pequenas).

**Recomendação:** adicionar breakpoint `sm`/`md` no modal (stack vertical) e no flow editor (ocultar/reduzir sidebar em mobile, stack node palette).

### 4. Feedback nativo do navegador em vez de UI própria
`AvatarUpload` usa `alert()` para imagem > 5MB; `BotsTab.handleDelete` usa `confirm()` nativo; `BotExecutionsTab.handleRetry`/`handleExport` estão comentados (stubs). Isso quebra a imersão e não é acessível/consistente com o sistema de toasts existente.

**Recomendação:** substituir `alert`/`confirm` por modal/dialog próprio e toasts; ligar retry/export a ações reais com feedback de toast.

### 5. Monaco Editor é um stub
O modo avançado (`advanced` → tab `code`) renderiza um `CodeEditor` que apenas loga "Monaco Editor would be loaded here" e usa fallback de textarea implícito. Sem realce de sintaxe, sem validação ao digitar. É o ponto mais fraco do UX do editor.

**Recomendação (ajuste de UX enquanto a implementação do Monaco fica com a Forge):** adicionar placeholder claro de "modo avançado em preparação", desabilitar o botão salvar com aviso, ou integrar `monaco-editor` com tema escuro consistente com `surface-primary`.

### 6. Erros de lint que afetam qualidade percebida
ESLint reporta `no-explicit-any`, variáveis não usadas (`serverId`, `_execution`, `modeColors`, `modeIcons`), `useMemo`/`useCallback` com dependências ausentes e hooks chamados fora de componentes nos stories. Não bloqueiam o build, mas degradam manutenibilidade.

---

## Validação de decisões de design (Produto)

| Decisão | Veredito | Nota |
|---|---|---|
| Dois modos (simple visual / advanced code) | ✓ válido | Atende usuários não-técnicos e desenvolvedores. |
| Status toggle inline na lista | ✓ válido | Ação frequente, fica acessível. |
| Duplicar bot via dropdown | ✓ válido | Atalho esperado. |
| View executions via ícone de olho | ✓ válido | Ícone reconhecível; considerar rótulo visível em desktop. |
| Confirmação de delete inline | ✓ válido | Evita exclusão acidental; "não pode ser desfeito" está claro. |
| Alert nativo para upload de avatar | ✗ ruim | Quebrar consistência; substituir por UI própria. |
| Sem tooltips/help text nos bots | — | Fica para a Lex (docs/tooltips). |

---

## Recomendação de prioridade (UX)

1. Unificar tokens (design-tokens → CSS vars → componentes) — consistência visual.
2. Substituir `alert`/`confirm` por dialog/toast próprio — feedback consistente.
3. Aplicar animações de entrada/saída (modais, toasts, dropdowns) — polimento.
4. Ajustar responsividade do modal e do flow editor — mobile.
5. Resolver stub do Monaco Editor — modo avançado utilizável (com a Forge).

Entregável sugerido: este review + uma tela de reference dos tokens aplicados. A implementação de funcionalidades (tRPC real, Monaco, duplicação/export/import) cabe à Forge; docs/tooltips à Lex; testes à Sentinel; roadmap à Nova.
