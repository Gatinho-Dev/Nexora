# Integração Roblox (OAuth + Rich Presence)

## Configuração do aplicativo no Roblox
1. Conta Roblox com verificação de identidade → https://create.roblox.com/oauth/apps
2. "Create app" → Redirect URI: `https://SEU-BACKEND/api/integrations/roblox/callback` (local: `http://localhost:3000/api/integrations/roblox/callback`)
3. Copie Client ID / Client Secret.

## Variáveis de ambiente (Render)
```
ROBLOX_CLIENT_ID=...
ROBLOX_CLIENT_SECRET=...        # server-side apenas
ROBLOX_REDIRECT_URI=https://nexorachat.cloud/api/integrations/roblox/callback
ROBLOX_INTEGRATION_ENABLED=true
ROBLOX_PRESENCE_INTERVAL_MS=60000
ROBLOX_OPEN_CLOUD_API_KEY=      # OPCIONAL: nome real do jogo via Open Cloud
```
Sem as credenciais, a Nexora inicia normal e a aba mostra "Indisponível".

## Fluxo OAuth
`/api/integrations/roblox/connect` (autenticado) gera state+PKCE+nonce,
grava cookie HttpOnly de 10 min e redireciona ao Roblox. O callback valida
state, troca code→token, lê `/oauth/v1/userinfo` (sub=username ID permanente)
e grava o vínculo com tokens **criptografados em repouso** (AES-256-GCM).

## Presence
- Endpoint legacy público confirmado ao vivo: `POST presence.roblox.com/v1/presence/users`
  (batch até ~50 IDs). Sem cookies privados.
- Worker adaptativo (~60s+jitter; offline na Nexora = ~5 min; parado após 7 dias).
- 429 → backoff exponencial (teto 15 min) + circuit breaker marca atividades stale.
- Nome do jogo: Open Cloud (opcional) → games API (hoje exige auth, retorna
  "[TITLE UNAVAILABLE]") → fallback `lastLocation` do presence.
- Mudanças publicam WS `activity:update` para contactIds do usuário (amigos +
  co-membros), respeitando invisível, showActivity e bloqueios.

## Limitações REAIS da API
- Metadados de jogo sem autenticação retornam "[TITLE UNAVAILABLE]" → nome
  vem do presence/Open Cloud.
- Não existe "entrar no mesmo servidor" oficial → botão abre a experiência.
- Tempo de jogo é estimado desde a detecção pela Nexora.
- OAuth Roblox exige conta de desenvolvedor verificada por ID.
