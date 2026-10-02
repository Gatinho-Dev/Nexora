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
            ├─ CiderActivitySchema (zod estrito)
            ├─ título nulo = "parei de ouvir" → clearActivity() (sem rate limit)
            ├─ rate limit por usuário (CIDER_ACTIVITY_INTERVAL_MS)
            ├─ ensureSessionConnection(userId, "cider")
            ├─ allowlist de host da capa (só YouTube, só https)
            └─ persistActivity() → rich_presence_activities
                 └─ broadcastActivities() → ws "rich-presence:update"
                      └─ useRealtime → useAppStore.richPresence
                           └─ RichPresenceCard / RichPresenceInline
```

**A linha em `user_connections` é obrigatória**, e foi o defeito que fazia a
faixa não aparecer em lugar nenhum: tanto `visibleActivitiesFor` (o perfil)
quanto `broadcastActivities` (os amigos) filtram a atividade pelo
`showOnProfile`/`showActivity`/`activityVisibility` da conexão daquele provider.
O Cider não tem OAuth e ninguém cria essa linha ao "conectar" — então
`ensureSessionConnection` a cria na primeira faixa, com os padrões de quem quer
ser visto (`true`, `true`, `everyone`), sem nunca sobrescrever uma escolha do
usuário.

**A limpeza não entra no intervalo mínimo.** Quem manda `title: null` acabou de
encerrar o Cider (pela janela flutuante ou pelo menu da playbar) e espera a faixa
sair do perfil na hora; com o limite valendo para a limpeza, os últimos 20 s
ficariam pendurados.

**O dono também recebe o próprio push.** `contactIds` devolve só os contatos, e
o card "Agora" do perfil é alimentado pelo mesmo `rich-presence:update`: sem
incluir o usuário na audiência, o próprio perfil só mostrava a faixa depois de
recarregar.

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

A lista **cresce ao rolar**. Não há campo de limite para o usuário ajustar: uma
sentinela no fim da lista dispara a página seguinte enquanto o resultado tem
continuação. Cada página vem pelo mesmo caminho da primeira (`runSearch` com o
cursor anterior), então ordem, teto por canal e deduplicação valem para todas —
e uma página que só repete faixa já na tela é pulada, com teto de páginas para
não varrer a fonte inteira de uma vez.

O cursor depende do protocolo: o Piped devolve um `nextpage` **opaco**, que vale
só na instância que o emitiu (o token morre junto com ela, e por isso a página
seguinte não refaz failover); o Invidious pagina por `&page=N`, com teto de 10
páginas. Fim da lista é `next: null` — a interface escreve isso, em vez de girar
um carregador para sempre.

## Configuração

```bash
CIDER_PLAYER_ENABLED=true          # padrão: ligado
CIDER_ACTIVITY_INTERVAL_MS=20000   # piso: 5000
```

Desligado com `false`, o player some e a atividade é recusada.

## Interface

A tela do `/cider` replica o **Cider 2 desktop**: mesma paleta e tokens
(`src/cider/styles/tokens.css`, copiado do desktop), mesma casca — sidebar,
topbar com busca, coluna principal, playbar fixa e painel de letras.

A playbar é **uma cápsula só**, no estilo do Apple Music: controles de
transporte à esquerda, capa, título e a barra de progresso no meio (a linha
corre por baixo da capa e do texto, dentro do mesmo retângulo) e as ações
(`…`, letras, fila, volume) à direita. A ordem personalizada do usuário vale
dentro de cada bloco, não como fila única — sem isso, mover a capa para a
esquerda empurraria os botões para o meio.

O vidro da cápsula é mais transparente e muito mais desfocado que o resto da
interface (`blur(var(--cider-blur) * 1.6 + 10px)` com o fundo a ~62% de
opacidade): é o que faz a cor do que passa atrás virar mancha, em vez de
detalhe. O rodapé também perdeu o degradê que tinha — ele era uma camada opaca
entre a página e o vidro.

**A capa do que está tocando é o caminho para a letra em tela cheia.** Passar o
mouse revela duas setas na diagonal e o clique abre a tela cheia (mesmo gesto na
capa grande de "Tocando agora"); o `…` da pílula faz o mesmo por teclado. A tela
cheia traz a capa e os controles à esquerda, a letra grande à direita, o ✕ no
canto e o fundo sendo a própria capa muito desfocada (`blur(90px)`).

Nas listas de faixas, **a capa é o botão de tocar**: o play circular só aparece
no hover (ou sempre, na faixa atual, quando ele vira pause). O resto da linha não
toca mais nada — foi um pedido explícito e também evita começar música sem
querer ao selecionar a linha.

A **fila** segue o desenho do Apple Music (iOS 18) em torno de uma distinção que
o motor guarda por entrada (`src/cider/core/queue.ts`): o que veio de um
**contexto** — o álbum, a busca, a estação que começou a tocar — e o que foi posto
**à mão**. "Tocar depois" encaixa a faixa logo depois da atual; "Adicionar à fila"
manda para o fim absoluto; **"Limpar"** tira só o que está à mão e deixa o
contexto intacto — sem essa separação, limpar significaria jogar fora o álbum que
está tocando. Tocar uma lista nova que **descartaria** faixas à mão pergunta antes
("Reproduzir isto limpará a sua fila"), que é a correção do acidente clássico de
começar um álbum apagar em silêncio a fila que a pessoa montou; quando nada se
perde, o clique continua imediato e não há pergunta nenhuma.

Duas regras que o motor aplica para a fila não andar em círculos: a faixa que já
está na fila **muda de lugar** em vez de aparecer duas vezes, e a que está tocando
nunca sai — nem quando foi ela mesma colocada à mão, porque o áudio já está
carregado e a interface passaria a dizer que nada toca enquanto a música segue.
As entradas à mão aparecem marcadas no painel da fila.

No fim da lista há **"Adicionar músicas à fila"**: a busca acontece dentro do
lugar onde a fila é vista, em vez de obrigar a sair dela e voltar. Antes de
digitar, ele sugere a sua **biblioteca deste navegador** — histórico primeiro,
favoritos depois, e nada que já esteja na fila. Cada resultado traz o rótulo
"na fila" e o botão desabilitado quando a faixa já está lá, porque a fila não
recebe o mesmo vídeo duas vezes: a resposta aparece antes do clique, não como um
botão que não faz nada. Com nada tocando, o que for adicionado **começa a tocar** e
fica marcado como à mão — foi a pessoa que o pediu, então o "Limpar" alcança.

O Início abre com as **misturas** — Energia, Relaxamento, Foco, Boa Disposição e
Melancolia — como as mixes geradas por algoritmo da referência. A diferença é
que aqui não existe algoritmo: as consultas saem de `src/cider/core/mixes.ts` e
cruzam o humor com quem a pessoa **ouve de verdade** (artistas mais presentes no
histórico e nos favoritos deste navegador). Sem biblioteca, sobra a consulta do
tema — e a seção diz **"Pelo tema"**, em vez de chamar de "recomendada" uma
busca fixa. Os dois casos rodam pelo mesmo caminho de busca da Pesquisa, e o
aviso do clique informa quantas faixas entraram e de onde a mistura veio.

A **Pesquisa sem consulta** mostra os blocos de género, humor e atividade
(Energia, Festa, Fitness, Estudo, Dormir, Dirigir…). Cada bloco imprime a
consulta que executa e o clique a leva para o campo de busca, onde ainda pode
ser editada antes de confirmar — o oposto de um rótulo de marketing que esconde
o que vai ser procurado.

O ▶ de cada linha é **prévia de 30 segundos**, não reprodução: o motor é pausado
(`engine.pause()`) e a prévia sobe num player próprio, montado num canto invisível
do diálogo — o `<iframe>` precisa de área real, mas a cara dele é de outra origem,
então o que se vê é a capa e uma barra de tempo. Ao terminar (ou ao apertar
Parar), a reprodução volta **como estava**: se a música tocava, volta tocando; se
estava pausada, não começa. O teto de 30 s é o que impede a gaveta de virar uma
segunda reprodução.

O painel de letras ocupa a altura da janela (não a altura útil acima da
playbar) e alinha as linhas grandes e esmaecidas do Apple Music, com o acento do
tema só no halo da palavra cantada.

"Tocando agora" ganha o fundo da referência: as duas cores dominantes da capa
viram gradientes que derivam devagar atrás da tela. A paleta é extraída **no
navegador**, por `<canvas>` (`extractPalette`, o mesmo caminho do tema "cores da
capa" do provider): nada é enviado para análise, e uma capa sem CORS ou sem cor
devolve `null` — o fundo simplesmente não aparece, em vez de receber um tom
inventado. Quem pediu menos movimento recebe o gradiente parado
(`prefers-reduced-motion` ou as configurações de animação).

Os textos da interface **não nomeiam a plataforma de origem**: falam de "fonte",
"player" e "publicação". O motor continua sendo o mesmo `iframe` descrito abaixo —
mudou o vocabulário, não a arquitetura.

As telas são as do desktop, endereçáveis uma a uma:

| Rota | Tela |
| --- | --- |
| `/cider` | Início |
| `/cider/explorar` | Explorar por tema |
| `/cider/pesquisa?q=` | Pesquisa (a consulta vive na URL, então o resultado é compartilhável) |
| `/cider/radio` | Rádio (estações por semente) |
| `/cider/biblioteca`, `/albuns`, `/artistas`, `/musicas`, `/playlists`, `/historico`, `/favoritos` | Biblioteca |
| `/cider/tocando-agora` | Tocando agora |
| `/cider/configuracoes/:secao` | Configurações |
| `/cider/diagnostico`, `/estatisticas` | Sistema |

O motor de reprodução vive **fora do roteador**, em `CiderProvider`, montado
no `App.tsx`. É o que faz o áudio continuar quando o usuário sai do player para
o Nexora: trocar de rota desmontaria o `<iframe>` junto. O `CiderMiniBar` é só
uma janela para o mesmo motor — aparece fora de `/cider`, não cria um segundo
player e não tem fila própria. Por isso `CiderPage` **não** monta o provider de
novo: um segundo provider criaria um segundo motor tocando a mesma faixa.

Os comandos do player (`pause`, `resume`, `seekToMs`, `setVolume`) só são enviados
depois que a API entrega um objeto **utilizável** (`readyFor`): o objeto de
`new YT.Player` não responde a nada antes do `onReady`, e uma prévia cancelada no
mesmo segundo em que começou estourava uma exceção no meio da limpeza da
interface — que ficava com a prévia presa na tela.

O `<iframe>` mora no `CiderAudioDock`, também acima do roteador. Ele precisa de
área real (`display: none` e 0×0 impedem a inicialização) mas o vídeo nunca pode
aparecer, então o dock é uma faixa de 344×56 px com `opacity: 0` — invisível e
fora do empilhamento da página da Nexora. Duas travas garantem isso: o dock só
**existe** dentro de `/cider` ou quando há faixa carregada (fora disso o
`<iframe>` nem é criado), e as regras mínimas que o escondem vivem no
`src/index.css` — se ficassem só em `styles/web.css`, que carrega com a rota,
uma página da Nexora mostraria o player do YouTube em tamanho natural no meio da
interface. O `YouTubePlayer.mount` detecta host fora do documento e recria o
player, então montar e desmontar o dock não deixa o motor apontando para um nó
que não existe mais.

O mini-player é a **janela flutuante** de fora de `/cider`: arrastável (a posição
fica no `localStorage`), com pause, anterior/próxima, favorito, fila, volume,
link para o original e **"Encerrar o Cider"** — que para a música, limpa a fila
e tira a faixa do perfil (`releaseNowPlaying`).

Os arquivos de CSS são **cópias** do desktop (mesmos nomes de classe, para a
aparência não divergir). O que só existe no site — dock, mini-player, portão de
entrada e as classes das telas novas — fica em `src/cider/styles/web.css`.

## Temas

Os seis temas embutidos são **os mesmos do desktop**, portados de
`src-tauri/src/commands/theme_cmds.rs` com os mesmos tokens: Cidra Escura, Cidra
Clara, Meia-noite, Vidro, Noir e Pôr do sol — mais Automático, Escuro e Claro.
Escolher "Meia-noite" aqui dá a mesma paleta que escolher "Meia-noite" no
aplicativo.

Onde escolher:

- **primeira visita** — o guia oferece o tema antes de qualquer ajuste;
- `/cider/configuracoes/aparencia` — grade de temas, importação de
  `.cider-theme.json`, exportação e **editor visual** de cada token (cores,
  vidro, sombras, formas, tipografia, movimento) com pré-visualização ao vivo;
- **Ctrl+K** — cada tema é um comando, com o nome exato.

Duas travas merecem registro, porque um tema é **dado que vira CSS**:

1. um tema só escreve variáveis `--cider-*` (o filtro está em
   `settings/apply.ts`). Sem ele, um tema salvo reescreveria a Nexora inteira;
2. o CSS personalizado de um tema é injetado dentro de
   `@scope (.cider-root, .cider-minibar, .cider-audio-dock)`. Um seletor solto
   como `button { … }` não escapa para o site hospedeiro, e navegador sem
   `@scope` simplesmente ignora o bloco em vez de aplicar demais.

As preferências ficam no `localStorage` do navegador — a Nexora não guarda nada
do Cider no servidor.

## Letras em tempo real

O mesmo motor do desktop, portado sem alteração de comportamento:

- **tempo real é a posição do player**, nunca um cronômetro próprio. Pausa
  congela, seek recalcula, mudança de velocidade não afeta;
- **destaque por palavra** com cor interpolada, `text-shadow` em halo duplo,
  escala e blur — a palavra "acende" conforme é cantada em vez de piscar;
- **a letra começa cinza e fica pintada**: quem manda é a cor do fundo — no fundo
  escuro a tinta é branca, no claro é preta — e o cinza é só o que **ainda vem**.
  A palavra cantada não volta ao cinza depois de passar (`past` mantém a cor
  cheia, sem opacidade nem blur), então a música vai "preenchendo" a letra de
  cima para baixo, como no Apple Music. A tela cheia e o modo imersivo usam a
  paleta escura mesmo no tema claro, porque a capa desfocada com scrim atrás
  deles é escura;
- **preenchimento progressivo**: a palavra cantada é um degradê duro recortado
  pelas letras (`background-clip: text`), então ela **se enche** da esquerda
  para a direita acompanhando a voz — não é troca de cor, é varredura, e ela
  anda com a posição real do player (pausa congela, seek move);
- **a palavra cantada sobe um pouco**: 1,6 px, proporcionais ao progresso (2,4 px
  quando a palavra é esticada). Mais que isso o texto dança;
- **três bolinhas contam a espera até a voz entrar**: quando há espera de
  verdade antes da próxima linha cantada — a introdução e os intervalos
  instrumentais —, a linha esperada ganha três bolinhas acima do texto, uma
  acendendo dentro de cada terço da espera (a mesma paleta da letra: cinza até
  a tinta, branco no escuro e preto no claro). O piso de 2,5 s é o que impede a
  contagem de piscar entre **todas** as linhas: o fim da última palavra de um
  verso quase nunca é o começo do próximo. A linha esperada abre exceção ao
  esmaecimento porque a opacidade de um pai não tem como ser desfeita no filho —
  e as bolinhas ficam fora do fluxo, para o texto não pular quando a contagem
  aparece;
- **a subletra entre parênteses vai para baixo**: muita fonte escreve o canto
  de apoio na mesma linha ("... can you keep it up? (It up)"). O apoio vira um
  bloco menor **embaixo** da letra, sem os parênteses, como no Apple Music — e
  como a música soa (voz principal na frente, resposta atrás). É uma separação
  preguiçosa de propósito: acontece uma vez por documento (não a cada quadro) e
  a palavra do apoio continua com o seu tempo, então ela acende e é pintada como
  qualquer outra. Parêntese desbalanceado não vira subletra — a linha fica como
  veio, em vez de a metade de baixo engolir o resto do texto;
- **palavras esticadas ganham halo extra**, sem lista de palavras escolhidas a
  dedo: a marcação é o **tempo** — se uma palavra dura mais de 1,7× a média das
  vizinhas da mesma linha (e mais de 600 ms), ela é tratada como nota segurada e
  o halo continua aceso depois de passar. É o que faz o "relate" da Sabrina
  Carpenter brilhar enquanto é cantado devagar;
- **tempo por palavra estimado** quando a fonte só manda o tempo da linha (o
  caso do LRCLIB), pesando palavras curtas, longas e pontuação. A interface
  avisa que a estimativa é do Cider 2, e não da fonte;
- **preset `karaoke`**, o mais próximo do efeito do Apple Music: brilho 0.8 e
  decaimento de 1.2 s, para a palavra esticada continuar acesa depois de passar
  (só o halo decai; a tinta, não).

A letra vem de uma **cadeia de fontes**, e a interface diz de onde veio:

1. **LRCLIB** (exata, depois busca ampla) — única fonte com tempo por linha;
2. **`api.lyrics.ovh`** — letra sem sincronia, marcada como tal no rodapé;
3. **busca no Google** — quando nenhuma das duas tem a faixa, o estado vazio
   oferece "Procurar a letra no Google". É um endereço de busca, não um scrape:
   o app prefere levar a pessoa até a letra a inventar texto.

Antes de consultar as fontes por URL, o nome é limpo: `ft.`/`feat.` sai do
artista e o segmento depois de `|` sai do título. É medível — no `lyrics.ovh`,
`Post Malone/Sunflower` responde 200 e `Post Malone/Sunflower | Official Video`
responde 404.

O `letterSpacing` dos presets é `-0.02em`. O valor herdado do desktop era
`-0.2em` — dez vezes maior — e a 34 px encolhia ~7 px por caractere: as palavras
ficavam sem espaço nenhum entre si e a letra aparecia **inteiriça**, o defeito
descrito como "letra toda junto". O problema nunca foi de layout, e o mesmo
valor continua no desktop (`src/lyrics/presets.ts`).

A interpolação de posição vive em `LyricsTimeline`, uma fonte externa lida com
`useSyncExternalStore`. Não é detalhe de estilo: o player reporta a posição 4×
por segundo, e sem interpolar o destaque daria saltos visíveis de 250 ms.

## Ouvir junto (sessão de escuta compartilhada)

É a peça social que faltava: uma pessoa abre uma sessão, as outras entram e todo
mundo ouve **a mesma faixa no mesmo ponto** — com reações subindo sobre a capa.
Entrada pelo menu `…` da pílula ("Ouvir junto"), que abre o painel do mesmo nome.

### Papéis

- **anfitrião** — quem abre a sessão. É dono da fila e da reprodução: pular,
  voltar, pausar e a posição saem do motor dele;
- **convidado** — entrou por um código (ou por convite). O player dele **segue** o
  estado do anfitrião, e os controles da playbar viram **pedidos**: "próxima",
  "anterior", "play/pause" e a busca de posição viajam até o anfitrião, que
  aplica e publica o resultado. Sem isso, dois controles independentes fariam a
  sessão andar para lados diferentes — o oposto de ouvir junto.

O convidado também não mexe na fila localmente: `Adicionar à fila` e
`Tocar depois` viram **sugestões** para o anfitrião (até 10 por gesto), e a
faixa aparece na fila dele.

### Como o alinhamento funciona

Três decisões, todas em `src/cider/core/listen.ts` e fixadas por teste:

1. **a janela publicada começa na faixa atual.** O anfitrião manda `[atual,
   ...próximas]` (até 50), com `index: 0` — não a fila inteira. Um álbum de 500
   faixas não caberia numa mensagem, e o que o convidado precisa é o que toca e o
   que vem depois;
2. **a assinatura ignora o progresso fino.** Ela muda em troca de faixa, mudança
   de play/pause, mudança de fila e a cada **5 s** de progresso — o batimento que
   mantém a sessão alinhada sem transformar cada tique do relógio numa mensagem.
   Quando algo muda antes do intervalo mínimo, a publicação é **agendada**, nunca
   descartada;
3. **a banda de tolerância é de 3 s.** Os dois players nunca tocam no mesmo
   milissegundo; corrigir cada segundo faria o áudio engasgar. A posição alvo
   ainda compensa o tempo de viagem medido com o relógio **local** de quando o
   estado chegou — a única conta que não depende de os dois computadores estarem
   com a hora certa.

Quem entra numa sessão **pausada** não ouve uma batida antes do pause: o motor
usa `cueVideoById` em vez de `loadVideoById` (`engine.followQueue`), e a intenção
de tocar ou não é preservada mesmo quando o `<iframe>` ainda está inicializando.

### Quedas e recarregamento

A sessão **sobrevive ao recarregamento**. Cada participante recebe um **token de
retomada** ao entrar (no `cider:listen:session`) e o guarda no `sessionStorage`
desta aba — não no `localStorage`, porque ouvir junto é da aba, não do navegador
para sempre. Ao recarregar ou reconectar, a aba apresenta o token
(`cider:listen:resume`) e volta para a **própria vaga**: o registro do realtime
guarda um assento com token por pessoa, e a lista pública de membros não expõe
nenhum deles.

A queda de conexão deixou de encerrar a sessão:

- **convidado** — a retomada é imediata quando o realtime volta; o chip mostra
  "Reconectando a sessão…" enquanto a resposta não chega, e um "não" definitivo
  (sessão encerrada) limpa o que estava guardado;
- **anfitrião** — o assento dele fica reservado por **2 minutos**
  (`CiderListen.HOST_GRACE_MS`). Nesse intervalo os convidados veem "O anfitrião
  caiu da sessão", o player deles **pausa** para não irem ficando para trás, e
  quem estiver na tela vê a espera no painel. Se ele voltar, o estado guardado é
  readotado (`adoptRemoteState`) e a fila continua de onde estava; passado o
  prazo, a sessão encerra para todos, como antes.

O que continua valendo: a sessão é do **processo do realtime** e não vai para o
banco — reiniciar o servidor encerra as sessões, e nenhuma delas é reaberta
amanhã.

### Reações

A lista de emojis é **fechada** (`CIDER_LISTEN_EMOJIS`, em `contracts/constants`)
e o servidor a valida: uma lista aberta deixaria um cliente autenticado animar
texto arbitrário sobre a capa de todo mundo. A reação de quem reagiu aparece na
hora (eco local) e o servidor entrega aos outros; os dois lados respeitam o mesmo
intervalo mínimo, então ninguém vê uma animação que o resto da sessão não viu.

Elas sobem da altura da playbar, com deslocamento próprio para não subirem
coladas, e somem sozinhas (`listen-rise`, 2,6 s). Quem pediu menos movimento
recebe a mesma reação sem o voo (`listen-fade`, via `prefers-reduced-motion` ou
as configurações de animação do Cider).

### Servidor

Nada de banco: a sessão é do **processo do realtime**, como as salas de voz
(`api/ciderListen.ts` + as mensagens `cider:listen:*` em `api/realtime.ts`).

- **uma sessão por usuário** e teto de **12 pessoas**;
- **o anfitrião é a sessão**: quando ele **sai de verdade** (encerra), ela acaba
  na hora; quando ele **cai** (fecha a aba, perde a conexão), a vaga fica
  reservada por 2 minutos e os convidados são avisados da espera;
- **convites** só para **amigos aceitos** e **online** (o convite toca na tela do
  outro agora; para quem está offline não há onde tocar);
- o estado publicado é revalidado no servidor (`sanitizeListenState`): a faixa que
  toca **está** na fila, e "nada tocando" só existe com a fila vazia. Estado torto
  é **recusado**, não consertado — consertar faria o convidado seguir uma fila que
  o anfitrião não tem;
- reações e publicações de estado têm limite de frequência por usuário, e a lista
  de emojis é validada aqui — o tipo do TS não protege nada em runtime.

O painel mostra o código da sessão para copiar (quem está do lado lê em voz alta)
e a lista de amigos para convidar. O `CiderListenBridge` (montado no
`CiderProvider`, acima do roteador) é quem liga realtime e motor à store — a
sessão continua valendo **fora de `/cider`**, onde o mini-player segue o
anfitrião do mesmo jeito.

## Limitações conhecidas

- **A sessão de escuta guarda apenas um token no navegador.** O registro
  continua em memória, no processo do realtime: recarregar a página ou cair a
  conexão volta para a própria vaga (com carência de 2 minutos para o
  anfitrião), mas reiniciar o servidor encerra as sessões e nenhuma delas é
  reaberta amanhã — persistir isso exigiria escolher um lugar no banco para uma
  sala de minutos.
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
npm run test      # inclui src/cider/core/core.test.ts, src/cider/settings/settings.test.ts
                  # e src/cider/{library,radio,lyrics,cssScope,queue,queueAdd,listen,mixes}.test.ts
                  # e api/ciderListen.test.ts (regras da sessão de escuta, no servidor)
npm run check
npm run lint
```

`cssScope.test.ts` é a guarda contra a classe de defeito mais cara deste porte:
as folhas de `/cider` **não saem do documento** quando o usuário volta para a
Nexora, e um seletor global aqui passa a valer no site inteiro. O teste exige que
todo seletor de primeiro nível tenha uma classe ou um atributo (blocos de
`:root` são a exceção, porque entregam os tokens `--cider-*` para o que vive fora
da rota) e que as regras mínimas que escondem o dock estejam no CSS global.
