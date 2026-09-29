# Cider — player web em `/cider`

O `/cider` é um player de música que roda inteiro no navegador. Ele busca no
YouTube, toca pelo **player oficial** e publica a faixa atual como presença na
sua conta da Nexora — no perfil, na lista de amigos e no DM.

## O que ele é, e o que não é

- **É** o player oficial do YouTube numa aba. Nenhum áudio é baixado,
  convertido ou extraído; o que toca é o `iframe` do YouTube, comandado por
  `enablejsapi`.
- **Não** é um ripper nem um scraper de mídia. A busca usa instâncias
  comunitárias do [Piped](https://github.com/TeamPiped/Piped) só para
  **metadados** (título, canal, duração, id). O áudio nunca passa por elas.
- **Não** é afiliado ao YouTube, ao Google ou ao Cider Collective.

## Por que é uma página web

A versão desktop do Cider 2 rodava sobre Tauri/WebKitGTK, e o WebKitGTK do Linux
é compilado **sem EME** — não existe `navigator.requestMediaKeySystemAccess` no
binário. O YouTube recusa entregar o stream ao player incorporado e responde com
os erros 152/153 para qualquer vídeo, inclusive para os que verificadamente
permitem embed. Não há parâmetro que resolva: `nocookie`, `origin` e host fazem
diferença zero.

No navegador o problema não existe, porque o navegador tem Widevine. Por isso a
versão web não é um plano B — é a única que toca.

## Publicação de "tocando agora"

O caminho da atividade é o **único** ponto novo do lado do servidor. Até aqui
toda origem de presença vinha de OAuth, consultada por *polling*
(`presenceWorker`). O Cider não tem OAuth: a página já está autenticada pela
sessão e tem um WebSocket aberto, então **empurra** a atividade quando a faixa
muda.

```
/cider (navegador)
  └─ ws.send({ t: "cider:now-playing", activity })
       └─ api/realtime.ts → ciderNowPlaying()
            ├─ rate limit por usuário (CIDER_ACTIVITY_INTERVAL_MS)
            ├─ CiderActivitySchema (zod estrito)
            ├─ allowlist de host da capa (só YouTube, só https)
            └─ persistActivity() → rich_presence_activities
                 └─ broadcastActivities() → ws "rich-presence:update"
                      └─ useRealtime → useAppStore.richPresence
                           └─ RichPresenceCard / RichPresenceInline
```

A partir do `persistActivity` é o código de presença que já existia: audiência,
visibilidade (`everyone`/`friends`/`private`), redaction, bloqueio e modo
invisível funcionam sem uma linha nova. A barra de progresso na Nexora é
calculada no cliente a partir de `startedAt`/`endsAt`.

## Segurança

O que a atividade vira é presença **visível para os contatos do usuário**, e vem
de um cliente autenticado. Quatro defesas, todas com teste:

1. **Rate limit por usuário** — 20 s entre publicações por padrão. Sem isso, um
   loop apertado vira enxurrada de escrita e de broadcast para todos os amigos.
2. **Zod estrito** — o tipo TypeScript é só sugestão e não protege em runtime.
   Os limites batem com as colunas (`varchar(200)` no título, `varchar(240)` em
   details/state), e `z.string().url()` sozinho **aceita `javascript:`** — foi
   verificado, e por isso a URL exige `https` explicitamente.
3. **Allowlist de host da capa** — só `https` e só hosts de imagem do YouTube.
   Sem isso, o card de presença viraria um rastreador apontando para qualquer
   URL que o cliente mandasse.
4. **Janela de tempo validada** — `endsAt` no ano 3000 daria barra eterna; um
   `startedAt` no futuro passaria num `now - started < 86_400_000` ingênuo, já
   que a diferença seria negativa. Ambos são barrados, com tolerância de 5 min
   para desvio de relógio.

O que a atividade **não** faz: escrever em outro usuário, escolher audiência ou
ignorar privacidade. Tudo isso é do servidor, a partir do `userId` da sessão.

## Busca

As instâncias Piped respondem com `access-control-allow-origin: *`, então o
navegador busca direto — não há proxy nosso no meio. A lista é pública e muda
com frequência, então o failover é sequencial e o erro é honesto: diz o que
aconteceu com cada instância em vez de um "falhou" genérico. O orçamento de
tempo é compartilhado: instância lenta não vira soma de timeouts.

O ranking (nota de oficial, detecção de versão, deduplicação, limite por canal,
ordem invertida "Artista - Música" para achar canal que publica ao contrário) foi
portado do Cider 2 desktop e vive em `src/cider/api/query.ts`.

## Configuração

```bash
CIDER_PLAYER_ENABLED=true          # padrão: ligado
CIDER_ACTIVITY_INTERVAL_MS=20000   # piso: 5000
```

Desligado com `false`, o player some e a atividade é recusada.

## Limitações conhecidas

- **O áudio não passa pelo equalizador.** O navegador não dá acesso ao buffer do
  iframe. A DSP só valeria para arquivos locais, que esta versão não carrega.
- **Sem histórico local nem biblioteca sincronizada.** O Cider 2 desktop tinha
  SQLite; aqui não há onde persistir sem escolher um backend.
- **Instâncias caem.** É a fonte de busca e ela é comunitária. O modo offline
  não existe.
- **Sem arquivos locais, plugins, MPRIS, bandeja e atalhos globais.** Tudo isso
  dependia do núcleo nativo, que o navegador não tem.

## Testes

```bash
npm run test      # inclui src/cider/core/core.test.ts e providers/cider.test.ts
npm run check
npm run lint
```
