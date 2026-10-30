# Nexora Live

Salas temporárias de voz/vídeo/chat **sem cadastro**. O usuário escolhe um
nick, cria a sala (com **nome opcional**), compartilha o link e conversa —
tudo some quando a sala expira. É uma experiência separada do Nexora tradicional: não usa sessão,
não toca nas tabelas de usuários/mensagens e não altera nenhuma rota
existente.

## Rotas novas

| Rota | Tipo | Descrição |
| --- | --- | --- |
| `/live` | Página | Lobby: nick → criar sala ou entrar por código/link. Indexável (SEO próprio). |
| `/live/:roomCode` | Página | Sala (prepare + room). `noindex` — salas são privadas. |
| `POST /api/live/rooms` | REST | Cria sala → `{ code, hostToken }`. Rate limit por IP (hash). |
| `GET /api/live/rooms/:code` | REST | Estado público: `{ exists, full, nicknames, maxParticipants }`. |
| `GET /api/live/ice` | REST | Servidores ICE (mesma config de `/api/rtc-config`). |
| `/ws/live` | WebSocket | Gateway público: join, signaling, chat, estado, kick/end. |
| `/ws/live-companion` | WebSocket | Nexora Mobile Camera: celular pareia por código (via QR) e transmite câmera/mic P2P para o dono. Aprovação obrigatória do dono; sessão única, TTL e invalidação ao sair. |
| `/mobile-camera?code=…` | Página | Controlador do celular: prévia em tela cheia, mic/cam/flip, encerrar. |

## Arquivos criados/modificados

**Compartilhado (frontend + backend)**
- `contracts/live.ts` — tipos do protocolo WS, limites centralizados
  (`LIVE_MAX_PARTICIPANTS_*`, TTLs, rate limits) e validação de nick/código
  (sanitização XSS-safe, unicidade case-insensitive).

**Backend**
- `db/schema.ts` — tabela `live_rooms` (só metadado da sala).
- `db/migrations/0023_nexora_live.sql` — migration correspondente.
- `api/live/rooms.ts` — núcleo: salas em memória, sessões com token secreto
  (anti-hijack), host, kick, chat, relay de signaling, expiração, sweeper.
- `api/live/gateway.ts` — WebSocket `/ws/live` (padrão do gateway companion).
- `api/live/http.ts` — rotas REST com rate limiting.
- `api/live/rooms.test.ts` — 15 testes unitários (vitest).
- `api/boot.ts` / `api/server.ts` — wiring (1 linha cada).

**Frontend**
- `src/lib/live/api.ts` — REST + URL do WS + Web Share API.
- `src/lib/live/identity.ts` — identidade efêmera por aba (sessionStorage):
  sessionId do cliente + sessionToken/hostToken secretos.
- `src/lib/live/ws.ts` — cliente WS com reconexão/backoff.
- `src/lib/live/rtc.ts` — WebRTC P2P em malha (perfect negotiation reusada
  de `src/lib/voice/perfectNegotiation.ts`), mic/cam/screen, VAD, ICE
  restart, cleanup completo de tracks/PCs.
- `src/lib/live/uuid.ts` — UUID v4 via Web Crypto.
- `src/hooks/useLiveRoom.ts` — hook central (status, participantes, chat,
  streams, falando, reconexão).
- `src/components/live/LiveVideoCard.tsx` — card com vídeo/avatar,
  indicadores mic/cam/tela, borda de "falando", kick pelo host.
- `src/components/live/LiveChatPanel.tsx` — chat lateral/painel mobile.
- `src/pages/LiveLobby.tsx` — `/live`.
- `src/pages/LiveRoomPage.tsx` — `/live/:roomCode`.
- `src/pages/Live.css` — estilos (variáveis do tema; dark/light herdados).
- `src/App.tsx` — rotas `/live` e `/live/:roomCode`.
- `src/pages/Landing.tsx` + `Landing.css` — botão "Nexora Live" na nav e no
  hero (nada foi removido).
- `public/robots.txt` — `Disallow: /live/*` (salas fora do índice; o lobby
  `/live` continua indexável e está no `sitemap.xml`).

## Banco de dados

Somente `live_rooms` (id, roomCode, hostTokenHash, hostSessionId, status,
maxParticipants, createdAt, lastActivityAt, expiresAt). Participantes, nicks
e chat **nunca** tocam o banco — vivem só na memória do processo enquanto a
sala existe. O token do criador é guardado apenas como sha256. O sweeper
remove linhas com mais de 24h.

Aplicar a migration: `npm start` roda `dist/migrate.js` automaticamente
(ou `npm run db:migrate`).

## Variáveis de ambiente

| Variável | Default | Descrição |
| --- | --- | --- |
| `LIVE_MAX_PARTICIPANTS` | `8` | Participantes por sala (teto 16, centralizado em `contracts/live.ts`). |

STUN/TURN continuam os mesmos das chamadas existentes (`ICE_SERVERS` etc.).
Nenhuma secret nova no frontend.

## Segurança

- **Sessões**: sessionId é público (precisa para o signaling); a credencial
  real é o `sessionToken` secreto emitido no join e comparado em tempo
  constante. Reconexão sem token é recusada — participantes não podem se
  passar uns pelos outros.
- **Host**: quem criou a sala tem um `hostToken` (prova posse no join para
  reassumir após refresh). Host pode kickar e encerrar; ao sair, o host é
  transferido ao participante mais antigo.
- **Rate limits**: criação de salas por IP (hash, nunca o IP cru), chat
  5 msg/5s por sessão, signaling 120/10s por conexão, checagem de sala 60/min.
- **Nick**: sanitizado (NFC, sem caracteres invisíveis/controle, sem
  `<>&"'` etc.), 2–24 chars, reservas bloqueadas (`nexora`, `admin`...).
  Renderizado como texto pelo React (sem HTML bruto).
- **Chat**: 500 chars, sanitização implícita, histórico de 100 em memória.
- **Códigos**: 6 chars de um alfabeto de 31 sem glifos ambíguos (~887M
  combinações) — inviabiliza adivinhação.
- **Privacidade**: sem e-mail/senha/IP/armazenamento permanente; nick e
  mensagens morrem com a sala.

## Como funciona o signaling

1. Cliente entra em `/live/:code`, informa nick → WS `live:join` com
   sessionId (cliente) → servidor responde `live:joined` com sessionToken,
   participantes e histórico do chat.
2. Cada cliente cria um `RTCPeerConnection` por participante e troca
   offer/answer/ICE via `live:signal` (relay ponto a ponto no servidor,
   validado por `isValidSignalData` e limitado por janela).
3. Negociação usa *perfect negotiation* (polite/impolite por ordem de
   sessionId) — a mesma estratégia das chamadas do Nexora.
4. Áudio/vídeo/tela são **sempre P2P**; o servidor só retransmite sinal,
   chat e estado (muted/camera/screen).

## Como as salas expiram

- Sala criada e ninguém entrou → TTL de **1 minuto** (evita salas fantasmas
  de link compartilhado e nunca usado; o criador está na sala em segundos).
- Último participante saiu (após grace de reconexão de 15s) → TTL de 1 min.
- Idade máxima absoluta: 12h (encerra mesmo com gente).
- Ao expirar: `live:ended` para todos, sockets fechados (4001), memória
  liberada, linha no banco marcada `expired`. Sweeper apaga linhas > 24h.
- Reconexão: cliente reconecta o WS com backoff e reenvia `live:join` com o
  mesmo sessionId + sessionToken dentro da janela de grace.

## WebRTC v2: senders pré-alocados + VAD

Cada peer é criado com **3 transceivers pré-alocados** (mic, câmera, tela,
`direction: "sendrecv"`). Ligar/desligar/trocar mídia usa apenas
`RTCRtpSender.replaceTrack()` — nunca `addTrack`/`removeTrack`. Resultado:

- **Zero renegociação** ao compartilhar tela (antes: race com a perfect
  negotiation quebrava o share).
- Ciclo câmera → tela → câmera sem recarregar (a track da câmera volta
  sozinha via `replaceTrack` ao encerrar o share).
- Compatível com Safari/iOS (a direção SDP nunca muda).

**VAD (borda verde)**: um único `AudioContext` com um `AnalyserNode` por
fonte — o microfone local **e** o áudio remoto de cada participante (antes,
só o local era analisado e a borda nunca acendia nos outros). RMS em
frequência controlada (80ms) com **histerese**: abre em RMS ≥ 0,045, só
fecha abaixo de 0,028 após 320ms sem voz — sem piscar em fala baixa.
Mic desligado nunca aparece como "falando". Nodes são desconectados e o
contexto fechado no leave (sem leaks).

**Streams imutáveis**: cada nova track gera uma `MediaStream` nova emitida
ao React — corrige o bug de vídeo remoto não aparecer quando o objeto
interno era reutilizado.

## Testar localmente

```bash
npm run dev
# Aba 1: http://localhost:5173/live → nick → "Criar sala" → copiar link
# Aba 2 (ou outro navegador): cole o link → nick → "Entrar na sala"
```

Checklist manual de 2 sessões: A cria → B entra → ambos aparecem no grid →
voz/vídeo bidirecional → A compartilha tela (B vê em destaque) → chat A→B e
B→A → B sai (A continua) → A sai → sala expira após 15 min. Reconexão:
recarregue a aba em até 15s e o participante volta com o mesmo nick/sessão.

### Nexora Mobile Camera (Live)

1. Na sala, abra o chevron ao lado do botão de câmera → "Usar celular como
   câmera" → aparece o QR + código.
2. No celular, escaneie (ou abra `/mobile-camera?code=…`) → "Conectar como
   câmera" → permita câmera/mic.
3. No PC aparece o banner de aprovação → "Permitir" → o vídeo do celular
   passa a ser a câmera do participante (com VAD/borda verde funcionando no
   áudio do celular).
4. No celular: mic/cam ligam/desligam, 🔄 vira frontal/traseira, 📞 encerra
   (PC e celular são avisados).
5. Desligar a webcam do PC não afeta o celular; "Desconectar celular" no
   menu restaura a câmera local. A sala acabou → celular recebe "Chamada
   encerrada".

Limitações conhecidas: iOS/Safari não suportam `replaceTrack` em sender com
`null` em todos os cenários (a troca celular↔webcam no iOS pode exigir
renegociação — o Live já renegocia via perfect negotiation); screen share
não existe no iOS; `facingMode` exato é best-effort no Safari.

## Deploy

Mesmo processo atual: `npm run build && npm start` (Render). A migration
`0023` aplica sozinha no start. Sem serviços novos — o gateway `/ws/live`
sobe junto com o HTTP server existente.
