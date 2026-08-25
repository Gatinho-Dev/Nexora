# Segurança e Moderação do Nexora

Camada completa de **Segurança, Moderação e Proteção por IA**, com o
**OpenRouter como único gateway de IA** da plataforma.

```
NEXORA
  ↓
SafetyService            (fachada: cache, dedup, métricas, kill switch)
  ↓
OpenRouterSafetyProvider (monta prompts texto/imagem)
  ↓
OpenRouter               (https://openrouter.ai/api/v1)
  ↓
nvidia/nemotron-3.5-content-safety:free   ← OPENROUTER_SAFETY_MODEL
  ↓
SafetyParser             (JSON → categorias internas; minor ANTES de sexual)
  ↓
SafetyPolicyEngine       (decideTextAction / decideFromVerdict — código Nexora)
  ↓
AÇÃO                     (publicar / blur +18 / remover + suspender / revisão)
```

**Regra fundamental:** a IA apenas **analisa, classifica e retorna categorias**.
Quem interpreta e aplica política é o Nexora. Nenhum banimento/strike é
decidido diretamente por uma resposta do modelo.

---

## Arquitetura de arquivos

| Caminho | Responsabilidade |
|---|---|
| `api/services/safety/openRouterClient.ts` | Único ponto HTTP do OpenRouter + erros tipados (`OpenRouterAuthenticationError`, `RateLimitError`, `TimeoutError`, `ProviderError`) |
| `api/services/safety/safetyParser.ts` | `parseSafetyResponse` (formato canônico JSON), `normalizeVerdict` (payloads com scores), prompt anti-injection, retry/backoff |
| `api/services/safety/safetyService.ts` | **SafetyService**: fachada `analyzeText/analyzeImage`, cache LRU por `sha256(conteúdo)+modelo+policyVersion`, dedup em voo, kill switch, shadow mode |
| `api/services/safety/safetyMetrics.ts` | Métricas seguras (sem conteúdo): requests, 429, timeouts, latência, cache hit rate, fila |
| `api/services/safety/errors.ts` | `NormalizedVerdict` + `toNormalizedVerdict` |
| `api/services/mediaModeration.ts` | Pipeline de IMAGEM (fail closed) com circuit breaker |
| `api/services/textModeration.ts` | Pipeline de TEXTO (assíncrono pós-publicação) |
| `api/services/automod/engine.ts` | Regras locais puras do AutoMod (flood/repeat/menções/palavras/convites/links) |
| `api/services/automod/service.ts` | Carrega regras do servidor e aplica antes de publicar |
| `api/services/urlSafety.ts` | Heurísticas locais anti-phishing/golpe (sem LLM) |
| `api/services/reports/reportService.ts` | Denúncias: criação, rate limit, dedup, triagem IA (só prioriza) |
| `api/services/reports/moderationCaseService.ts` | Casos de moderação: agregação de denúncias, fila, escalonamento |
| `api/services/appeals/appealService.ts` | Apelações: criação, revisão, reversão transacional |
| `api/services/accountSafety.ts` | Strikes, suspensões, banimento, Status da Conta, guard `assertCanInteract` |
| `api/services/profileModeration.ts` | Análise assíncrona de nomes/bios/descrições públicos |
| `api/services/moderationActions.ts` | Ações manuais (ban, advertência, bloqueio de mídia) |
| `api/services/safetyAudit.ts` | Auditoria estruturada em banco (`safety_audit_events`) |

---

## Configuração (variáveis de ambiente)

```env
# OpenRouter — ÚNICO gateway de IA (nunca API direta da NVIDIA)
OPENROUTER_API_KEY=                # server-side apenas; JAMAIS no frontend
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=Nexora
OPENROUTER_SITE_URL=https://nexorachat.cloud

# Modelos configuráveis (troca sem refactor)
OPENROUTER_SAFETY_MODEL=nvidia/nemotron-3.5-content-safety:free
OPENROUTER_VISION_MODEL=meta/llama-3.2-11b-vision-instruct:free
OPENROUTER_CHAT_MODEL=             # chatbot oficial — separado da segurança

OPENROUTER_SAFETY_TIMEOUT_MS=15000
SAFETY_MAX_RETRIES=3

# Feature flags
SAFETY_AI_ENABLED=true
TEXT_MODERATION_ENABLED=true
IMAGE_MODERATION_ENABLED=true
REPORT_AI_TRIAGE_ENABLED=true
AUTOMATIC_SEVERE_SUSPENSION_ENABLED=true

# Shadow mode (classifica e registra, não aplica) e kill switch inicial
SAFETY_SHADOW_MODE=false
SAFETY_KILL_SWITCH=false

SEVERE_STRIKE_LIMIT=3
SEXUAL_MINOR_INITIAL_SUSPENSION_DAYS=3
SAFETY_POLICY_VERSION=2026.08.1
```

O kill switch também pode ser alternado em runtime pelo painel admin
(Proprietário), sem restart.

---

## Categorias internas

`sexual` · `sexual_minor` · `violence` · `graphic_violence` · `harassment` ·
`hate` · `self_harm` · `criminal` · `privacy` · `regulated_goods` · `spam` ·
`scam` · `malware` · `profanity` · `other`

O parser mapeia rótulos do modelo para essa taxonomia. **Ordem obrigatória:**
`sexual_minor` é verificado **antes** de `sexual` — "Sexual (minor)" nunca é
confundido com conteúdo adulto genérico.

## PolicyEngine

### Texto (`decideTextAction`)
| Classificação | Ação |
|---|---|
| `safe` | Publicada normalmente |
| `sexual_minor` | Mensagem removida + suspensão preventiva + caso CRITICAL `pending_review` |
| outras inseguras (ódio, assédio…) | Caso para revisão humana (sem punição automática) |

### Imagem (`decideFromVerdict`)
| Veredicto | Status |
|---|---|
| ALLOW | `approved` (publica) |
| SENSITIVE_ADULT | `sensitive` → blur 🔞 + botão "Mostrar conteúdo" |
| BLOCK (minor) | `blocked` → bytes zerados, sem preview/thumbnail/reveal, suspensão, caso crítico |
| UNCERTAIN | `review_required` → fica PRIVADA (fail closed, sem punição) |

Imagem **nunca** aparece antes da análise (sem flash pré-blur): o upload entra
em quarentena (`processing`) e só é servido a terceiros após veredito.
Falha do provedor ≠ SAFE: mídia permanece privada.

## Suspensão preventiva e revisão

1. Detecção `sexual_minor` (imagem ou texto) → suspensão imediata de
   `SEXUAL_MINOR_INITIAL_SUSPENSION_DAYS` dias (padrão 3).
2. Violação criada como `pending_review` — **strike só é aplicado após
   confirmação humana** no painel.
3. Moderador marca `confirmado` (+1 strike grave, idempotente por claim
   atômico `affectedRows`) ou `falso positivo` (suspende-se a punição,
   acesso restaurado, auditoria registra o erro da IA).

## Strikes e banimento

- Limite configurável (`SEVERE_STRIKE_LIMIT`, padrão 3): `0/3 … 3/3`.
- 1 confirmado → **Limitado**; 2 → **Em risco**; 3 → **Banimento permanente**
  (`permanentBan = true`).
- Somente strikes **confirmados** contam. IA sozinha nunca bane.

## Denúncias

- Entradas: menu de mensagem ("Denunciar"), perfil, servidor, canal, mídia,
  comando `/report`. Mobile: action-sheet do long-press.
- Categorias amigáveis + subcategorias neutras para "Segurança de menores".
- Rate limit duplo (por rota e por histórico: 5/10min) + proteções anti-abuso.
- Denúncias do mesmo alvo são **agregadas em um único `ModerationCase`**
  (janela de 24h); brigading (≥10 denúncias) apenas **eleva prioridade**
  — nunca é prova automática.
- Triagem opcional por IA (`REPORT_AI_TRIAGE_ENABLED`) só ajusta prioridade.
- O denunciante vê apenas estado genérico ("Enviada / Em análise / Resolvida");
  detalhes de punição nunca vazam.

## AutoMod (por servidor)

Configurações do Servidor → Segurança → AutoMod:
`flood`, `repeat`, `mass_mention`, `blocked_words`, `invites`,
`suspicious_links`.

Hierarquia: **regras globais > segurança por IA > AutoMod do servidor**
(servidor pode ser mais restritivo, jamais mais permissivo). Coisas simples
são resolvidas localmente — 20 mensagens iguais em 2 segundos não chamam IA.

## Apelações

Configurações → Segurança → Apelações (uma por violação). Aprovação reverte
**transacionalmente**: strike removido, suspensão levantada, ban permanente
rebaixado quando os strikes caem abaixo do limite, status recalculado,
usuário notificado, reversão auditada.

## Restrições e Status da Conta

- Guard central `assertCanInteract()` (backend é a autoridade) aplicado às
  rotas sociais (mensagens, uploads, servidores, canais, etc.). Leitura
  continua permitida durante suspensão — usuário acessa Configurações,
  Central de Segurança, Apelações e Termos.
- Evento WebSocket **`account:restriction_updated`** atualiza clientes
  conectados na hora; alterar localStorage não afeta nada.
- Painéis: Status da Conta (strikes, contagem regressiva, histórico) e
  Central de Segurança (hub com denúncias, apelações, conteúdo sensível…).

## Resiliência do provedor

- **Retry** com backoff exponencial + jitter (`SAFETY_MAX_RETRIES`).
- **Circuit breaker** compartilhado (abre após falhas consecutivas, cooldown,
  half-open).
- **Cache** por hash de conteúdo + modelo + `policyVersion` (mudou modelo ou
  política → reavalia).
- **Deduuplicação** de análises idênticas em voo.
- Erros tipados; usuário final só vê mensagens genéricas ("Não foi possível
  verificar esta mídia no momento").

## Privacidade e logs

- Nunca logar bytes/base64/conteúdo proibido bruto; auditoria guarda apenas
  IDs/categorias/metadados seguros.
- Não enviar PII ao provedor: análise é por mensagem isolada (contexto
  opcional mínimo, nunca canal inteiro); prompt trata conteúdo como DADO
  (anti prompt-injection).
- Mídia `sexual_minor`: bytes purgados, sem thumbnail pública, sem CDN, sem
  analytics; retenção mínima para obrigações legais.

## Banco de dados (migration `0016_safety_reports_appeals_automod.sql`)

Tabelas novas: `reports`, `moderation_cases`, `moderation_case_reports`,
`appeals`, `automod_rules`, `safety_audit_events`.
Extensões em `violations`: `messageId`, `targetType`, `policyVersion`, source
`automod`; índices únicos para idempotência (`fileId+category`,
`messageId+category`). Operações críticas usam transação + claim atômico
(`affectedRows`) contra race conditions entre moderadores.

## Painel admin (Administração → Segurança)

Sub-abas **Casos** (fila Críticos/Abertos/Confirmados/Falsos positivos/…,
com ações: confirmar, falso positivo, remover conteúdo, advertir, suspender,
banir, encerrar), **Ocorrências** (fila clássica), **Apelações** (aprovar/
negar) e **IA & Auditoria** (provedor/modelo/status, latência média, 429,
timeouts, cache hit rate, fila, kill switch, eventos auditados). Nunca exibe
API key nem conteúdo sensível.

## Health check

`GET /api/health` inclui bloco `safety` (provider/modelo/operational/shadowMode).
Métricas técnicas completas: `GET /api/moderation/metrics` (somente admins).

## Troubleshooting

| Sintoma | Verificar |
|---|---|
| Toda mídia cai em `review_required` | `OPENROUTER_API_KEY` válida? breaker aberto? (`/api/moderation/metrics`) |
| 429 frequentes | Modelo gratuito sobrecarregado; retries já amortecem; considere modelo pago via env |
| Nenhuma análise acontece | Kill switch ativo? `SAFETY_KILL_SWITCH`/runtime; flags desabilitadas? |
| Suspeita de falso positivo em massa | Ativar `SAFETY_SHADOW_MODE` e comparar classificações sem impactar usuários |
