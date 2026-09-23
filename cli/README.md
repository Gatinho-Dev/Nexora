# Nexora CLI

O Nexora oficial direto no seu terminal. Uma TUI (Terminal User Interface) moderna — nada de menus numerados, nada de Electron — que conversa com a **mesma conta e a mesma API do Nexora Web**. Mensagens enviadas pelo CLI aparecem no Web em tempo real (e vice-versa).

**Somente texto.** Sem chamadas, sem câmera, sem microfone — o CLI é propositalmente leve.

## Destaques

- **TUI moderna** (Ratatui): sidebar com DMs e presença, tela de amigos, chat com histórico, notificações, busca fuzzy (`Ctrl+K`), status bar.
- **Login pelo navegador** (device flow OAuth-style): nenhuma senha passa pelo terminal. O token emitido é uma sessão real do Nexora — aparece em "Dispositivos conectados" e pode ser revogada de lá.
- **Realtime** pelo mesmo WebSocket do Web (`/ws`), autenticado via `Authorization: Bearer`.
- **Atualização automática** via GitHub Releases, sem bloquear a interface.
- **Multiplataforma**: Linux (binário + `.deb`), Windows (`.exe`), macOS (`.tar.gz`, arm64/x64).
- Terminal sempre restaurado no encerramento (raw mode, alternate screen, mouse capture), mesmo em erro ou `Ctrl+C`.

## Requisitos

- Para usar: só o binário (Linux x86_64/arm64, Windows x64, macOS arm64/x64).
- Para compilar: Rust 1.75+ (via [rustup](https://rustup.rs)).

## Instalação

### Linux — pacote `.deb` (Debian/Ubuntu)

```bash
sudo apt install ./nexora-cli_<VERSION>_amd64.deb
nexora
```

O binário é instalado em `/usr/bin/nexora`. Remover depois, se quiser:

```bash
sudo apt remove nexora-cli
```

(dados do usuário em `~/.config/nexora-cli` são preservados)

### Binário standalone

Baixe o artefato da [GitHub Release](https://github.com/Gatinho-Dev/Nexora/releases) para sua plataforma, extraia e coloque no `PATH`:

```bash
tar xzf nexora-cli-<versão>-<plataforma>.tar.gz
sudo mv nexora /usr/local/bin/   # Linux/macOS
```

### Compilar do código-fonte

```bash
cd cli
cargo build --release
# binário em target/release/nexora
cargo install --path .   # alternativa: instala no ~/.cargo/bin
```

## Desenvolvimento

```bash
cd cli
cargo run            # roda em modo debug
cargo test           # 22 testes (modelos, parsing, versões, storage, update…)
cargo build          # checagem rápida
```

## Uso

```bash
nexora               # abre a TUI (login pelo navegador na primeira vez)
nexora login         # força o login pelo navegador
nexora logout        # encerra a sessão local e revoga no servidor
nexora --version
nexora --help
```

### Primeira execução (onboarding)

1. `nexora` detecta que não há sessão e mostra a tela de boas-vindas.
2. `Enter` abre o navegador em `nexorachat.cloud/cli/login`.
3. Autorize o CLI (você estará logado no Web). O código `XXXX-XXXX` amarra o dispositivo.
4. O CLI percebe sozinho, cria a sessão segura e entra na TUI.

Nas próximas execuções a TUI abre direto, sem navegador.

### Atalhos

| Tecla | Ação |
| --- | --- |
| `↑` / `↓` | navegar listas |
| `Enter` | abrir / enviar |
| `Esc` | voltar / fechar popup |
| `Ctrl+K` | busca global (fuzzy) |
| `Ctrl+N` | nova mensagem |
| `Ctrl+D` | DMs |
| `Ctrl+G` | servidores |
| `Ctrl+,` | configurações |
| `Ctrl+Q` | sair |
| `PageUp` / `PageDown` | rolar histórico |
| `Home` / `End` | início / fim |

Mouse: clique em DMs/amigos/canais/botões, scroll no histórico. Tudo também funciona só com teclado.

## Arquitetura

```text
cli/src/
├── main.rs        # loop principal, wiring, terminal restore garantido
├── app.rs         # estado central (View, seleções, input, notificações)
├── events.rs      # crossterm → canal tokio (teclado, mouse, resize)
├── theme.rs       # tema único — nenhuma cor espalhada pelo código
├── api/
│   ├── mod.rs
│   └── client.rs  # tRPC (superjson) + endpoints do device flow + WS URL
├── models/        # User, Friend, Conversation, Message, Server, Channel
├── storage.rs     # sessão/preferências em ~/.config/nexora-cli (dirs)
├── auth.rs        # device flow: start → navegador → poll
├── realtime.rs    # WebSocket /ws com Bearer, reconexão com backoff
├── update.rs      # versão via GitHub Releases, comparação semântica
└── ui/            # sidebar, header, friends, chat, popup, status_bar
```

O CLI **não** cria backend nem endpoints paralelos: reutiliza tRPC (`auth.me`, `dm.list`, `friend.list`, `message.send`…) e o gateway realtime `/ws` do Nexora Web. A única adição no servidor é o device flow (`/api/cli/device/*`) + página `/cli/login`, projetado para isso.

## Atualização automática

- Verificação leve em background contra a API do GitHub Releases (respeita intervalo mínimo entre checagens, nunca bloqueia a TUI).
- Nova versão → notificação discreta com as versões atual/nova.
- Download do artefato correto da plataforma em background; substituição segura em momento seguro; sessão preservada.

## Configuração local

- Sessão/token e preferências em `~/.config/nexora-cli` (Linux), `~/Library/Application Support/nexora-cli` (macOS), `%APPDATA%\nexora-cli` (Windows) — via crate `dirs`, sem caminhos hardcoded.
- Nenhuma senha é armazenada; apenas o token de sessão, que pode ser revogado a qualquer momento no Web.

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NEXORA_API_URL` | `https://nexorachat.cloud` | apontar o CLI para outra instância (dev/testes) |

## Solução de problemas

- **"Não autenticado" ao abrir**: rode `nexora login` e conclua no navegador.
- **Terminal quebrado após fechar**: não deveria acontecer (restore em `Drop` + handlers de pânico); se ocorrer, `reset` no terminal.
- **Sem realtime**: verifique conectividade com `NEXORA_API_URL`; o status bar mostra `● Conectado / ○ Desconectado / ◐ Reconectando...`.
- **Servidor self-hosted**: exporte `NEXORA_API_URL` antes de abrir.
