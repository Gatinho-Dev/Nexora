# Changelog — Nexora

## 1.1.0 (2026-08-23)

### Segurança
- Moderação automática de imagens via NVIDIA Nemotron (`NVIDIA_API_KEY`)
- Fluxo: upload privado → análise → aprovado | +18 borrado | bloqueado
- `Sexual (minor)` = bloqueio total + suspensão 3 dias + revisão humana
- Sistema de infrações com 3 strikes confirmados → banimento permanente
- Status da Conta (5 níveis) em Configurações → Minha Conta
- Guards server-side em todas as rotas sensíveis (403)

### Interface
- Redesign completo com design tokens Discord 2026 (blurple #5865F2,
  superfícies exatas, squircle→círculo no hover, dots de presença)
- Ícones EXATOS exportados do arquivo Figma "Discord assets" (28 glifos)
- Markdown completo: negrito, itálico, spoiler ||, citações, títulos,
  blocos de código coloridos por linguagem, embeds YouTube/Spotify
- Canais de Fórum e Palco · Eventos · GIFs KLIPY · Spoiler em imagens
- Solicitações de mensagem de não-amigos

### Correções
- Presença fantasma em chamadas (cleanup no close + heartbeat)
- Modo claro funcional (bug no applyTheme/initTheme)
- Envio de imagens sem NVIDIA_API_KEY configurada

### Performance
- React Query afinado (staleTime, sem refetch no foco)
- VoiceView/MessageItem otimizados; vendor chunks estáveis

## 1.0.0
- Lançamento inicial: servidores, canais de texto/voz, DMs, cargos,
  permissões, painel administrativo e realtime WebSocket.
