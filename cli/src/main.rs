//! Nexora CLI — cliente oficial de texto do Nexora para o terminal.

mod app;
mod api {
    pub mod client;
}
mod auth;
mod events;
mod models;
mod realtime;
mod storage;
mod theme;
mod ui;
mod update;

use anyhow::{anyhow, Result};
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io::Stdout;
use tokio::sync::mpsc;

use api::client::{Api, ApiConfig, ApiError};
use app::{App, ChatFocus, Connection, Popup, View};
use models::Message;
use realtime::{Realtime, RealtimeMessage};
use storage::Storage;
use theme::Theme;

fn main() {
    // Log opcional em NEXORA_LOG=debug → arquivo em temp dir.
    if std::env::var("NEXORA_LOG").is_ok() {
        let log_path = std::env::temp_dir().join("nexora-cli.log");
        if let Ok(file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            tracing_subscriber::fmt()
                .with_writer(std::sync::Mutex::new(file))
                .with_env_filter(
                    tracing_subscriber::EnvFilter::try_from_env("NEXORA_LOG")
                        .unwrap_or_else(|_| "info".into()),
                )
                .init();
        }
    }

    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match run(args) {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("nexora: {e:#}");
            1
        }
    };
    std::process::exit(code);
}

fn run(args: Vec<String>) -> Result<()> {
    match args.first().map(|s| s.as_str()) {
        Some("login") => login_command(),
        Some("logout") => logout_command(),
        Some("--version") | Some("-V") | Some("version") => {
            println!("nexora-cli {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        Some("--help") | Some("-h") | Some("help") => {
            print_help();
            Ok(())
        }
        None => start_tui(),
        Some(other) => {
            print_help();
            Err(anyhow!("comando desconhecido: {other}"))
        }
    }
}

fn print_help() {
    println!(
        "Nexora CLI {}

Seu Nexora diretamente no terminal — amigos, DMs e servidores, somente texto.

USO:
    nexora               Abre a interface principal (TUI)
    nexora login         Faz login pelo navegador
    nexora logout        Encerra a sessão local com segurança
    nexora --version     Mostra a versão
    nexora --help        Mostra esta ajuda

VARIÁVEIS:
    NEXORA_API_URL       URL da API (padrão: https://nexorachat.cloud)
    NEXORA_LOG           Nível de log (ex.: debug); grava em /tmp/nexora-cli.log
",
        env!("CARGO_PKG_VERSION")
    );
}

fn login_command() -> Result<()> {
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async {
        let storage = Storage::new()?;
        let api_url = std::env::var("NEXORA_API_URL")
            .unwrap_or_else(|_| api::client::DEFAULT_API_URL.to_string());
        let token = auth::login_flow(api_url).await?;
        storage.save_token(&token)?;
        println!("\n  Sessão salva. Execute `nexora` para abrir a interface.");
        Ok::<(), anyhow::Error>(())
    })?;
    Ok(())
}

fn logout_command() -> Result<()> {
    let storage = Storage::new()?;
    if let Some(token) = storage.load_token() {
        let rt = tokio::runtime::Runtime::new()?;
        let api_url = std::env::var("NEXORA_API_URL")
            .unwrap_or_else(|_| api::client::DEFAULT_API_URL.to_string());
        rt.block_on(async {
            let api = Api::with_config_only(api_url).with_token(Some(token));
            // Revoga no servidor (melhor esforço) e limpa local.
            let _ = api.device_logout(&api_token_of(&api)).await;
        });
        let _ = &rt;
    }
    storage.wipe()?;
    println!("  Sessão encerrada. Até já!");
    Ok(())
}

/// Extrai o token para o logout (recarrega do storage).
fn api_token_of(_api: &Api) -> String {
    Storage::new()
        .and_then(|s| s.load_token().ok_or_else(|| anyhow!("sem token")))
        .unwrap_or_default()
}

/// Restaura o terminal em qualquer caso (pânico incluído).
struct TerminalGuard;
impl TerminalGuard {
    fn new() -> Result<(Self, Terminal<CrosstermBackend<Stdout>>)> {
        enable_raw_mode()?;
        let mut stdout = std::io::stdout();
        execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
        let backend = CrosstermBackend::new(stdout);
        let terminal = Terminal::new(backend)?;
        Ok((Self, terminal))
    }
}
impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
        let _ = execute!(
            std::io::stdout(),
            LeaveAlternateScreen,
            DisableMouseCapture
        );
    }
}

fn start_tui() -> Result<()> {
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async_main())
}

async fn async_main() -> Result<()> {
    let storage = Storage::new()?;
    let api_url = std::env::var("NEXORA_API_URL")
        .unwrap_or_else(|_| api::client::DEFAULT_API_URL.to_string());
    let settings = auth::ensure_settings(&storage);

    // Sessão válida? senão, onboarding + login.
    let (token, api) = auth::ensure_authenticated(api_url.clone(), &storage).await?;
    let _config = ApiConfig {
        api_url: api_url.clone(),
        ws_url: String::new(),
    };

    // Onboarding (fora do alternate screen).
    auth::onboarding_progress(&api, &storage).await?;

    // Entrando na TUI.
    let (_guard, mut terminal) = TerminalGuard::new()?;

    let mut app = App::new();
    app.connection = Connection::Connecting;

    // Carrega /me.
    match api.me().await {
        Ok(me) => {
            app.my_id = me.id;
            app.me = Some(me);
        }
        Err(e) => {
            drop_and_show_error(&mut terminal, format!("Falha ao carregar sua conta: {e}"))?;
            return Ok(());
        }
    }

    // Carga inicial em paralelo (amigos + DMs + servidores).
    let (friends, convs, servers) = tokio::join!(api.friends(), api.conversations(), api.servers());
    if let Ok(f) = friends {
        app.friends = f;
    }
    if let Ok(mut c) = convs {
        c.sort_by_key(|c| -c.lastMessage.as_ref().and_then(|m| Some(m.id)).unwrap_or(0));
        app.conversations = c;
    }
    if let Ok(s) = servers {
        app.servers = s;
    }
    app.connection = Connection::Connected;

    // Realtime.
    let ws_url = std::env::var("NEXORA_WS_URL")
        .unwrap_or_else(|_| derive_ws_url(&api_url));
    let mut rt_rx = {
        let (tx, rx) = mpsc::unbounded_channel::<RealtimeMessage>();
        let realtime = Realtime::new(ws_url, token.clone());
        realtime.spawn(tx);
        rx
    };

    // Canal de comandos da UI → API (envio de mensagens async sem travar).
    let (send_tx, mut send_rx) = mpsc::unbounded_channel::<(Option<i64>, Option<i64>, String)>();
    // Canal de cargas de histórico: (alvo, resultado devolvido).
    let (load_tx, mut load_rx) = mpsc::unbounded_channel::<(Option<i64>, Option<i64>)>();
    let (loaded_tx, mut loaded_rx) = mpsc::unbounded_channel::<Vec<Message>>();

    // Verificação de atualização em background (não bloqueia).
    let mut update_tx = spawn_update_check(storage.dir().clone());

    let mut events = events::spawn_event_loop();
    let theme = load_theme(&settings);
    let last_render_min = std::time::Instant::now();

    loop {
        // Render.
        terminal.draw(|f| ui::draw(f, &app, &theme))?;

        // Evento (com timeout para toasts/render periódico).
        let ev = tokio::select! {
            e = events.recv() => match e {
                Some(ev) => ev,
                None => break, // canal fechado
            },
            Some(rtm) = rt_rx.recv() => {
                handle_realtime(&mut app, rtm);
                continue;
            }
            Some((conv, ch, content)) = send_rx.recv() => {
                // Envia em background; mensagem otimista é substituída pelo realtime.
                let api2 = clone_api(&api, &token);
                tokio::spawn(async move {
                    let _ = api2.send_message(conv, ch, &content).await;
                });
                continue;
            }
            Some((conv, ch)) = load_rx.recv() => {
                // Carrega o histórico ao abrir uma conversa/canal.
                let api2 = clone_api(&api, &token);
                let loaded_tx = loaded_tx.clone();
                tokio::spawn(async move {
                    match api2.messages(conv, ch, 50).await {
                        Ok(msgs) => { let _ = loaded_tx.send(msgs); }
                        Err(e) => tracing::warn!("falha ao carregar histórico: {e}"),
                    }
                });
                continue;
            }
            Some(msgs) = loaded_rx.recv() => {
                if !msgs.is_empty() {
                    for m in msgs {
                        app.push_message(m);
                    }
                }
                continue;
            }
            res = &mut update_tx => {
                if let Ok(Ok(Some(info))) = res {
                    app.update_available = Some(info.latest.major.to_string()
                        + "." + &info.latest.minor.to_string()
                        + "." + &info.latest.patch.to_string());
                    app.show_toast(
                        format!("↑ Nova versão v{} disponível", app.update_available.as_deref().unwrap_or("")),
                        now_ms(), 8000,
                    );
                }
                continue;
            }
        };

        match ev {
            events::AppEvent::Resize => continue, // próximo loop redesenha
            events::AppEvent::Key(code, mods) => {
                handle_key(&mut app, code, mods, &send_tx, &load_tx, &theme);
            }
            events::AppEvent::Mouse(m) => handle_mouse(&mut app, m),
        }

        // Toast expira.
        app.tick_toast(now_ms());

        if app.should_quit {
            break;
        }
        let _ = last_render_min; // render sempre (TUI barata)
    }

    Ok(())
}

fn drop_and_show_error(
    _terminal: &mut Terminal<CrosstermBackend<Stdout>>,
    msg: String,
) -> Result<()> {
    // Sai da TUI limpa e mostra o erro no terminal normal.
    disable_raw_mode()?;
    execute!(
        std::io::stdout(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    anyhow::bail!("{msg}")
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn derive_ws_url(api_url: &str) -> String {
    let base = if let Some(rest) = api_url.strip_prefix("https://") {
        format!("wss://{rest}")
    } else if let Some(rest) = api_url.strip_prefix("http://") {
        format!("ws://{rest}")
    } else {
        api_url.to_string()
    };
    format!("{}/ws", base.trim_end_matches('/'))
}

fn load_theme(settings: &storage::Settings) -> Theme {
    if settings.theme == "light" {
        Theme::LIGHT
    } else {
        Theme::DARK
    }
}

fn clone_api(_api: &Api, token: &str) -> Api {
    let api_url = std::env::var("NEXORA_API_URL")
        .unwrap_or_else(|_| api::client::DEFAULT_API_URL.to_string());
    Api::with_config_only(api_url).with_token(Some(token.to_string()))
}

fn spawn_update_check(
    dir: std::path::PathBuf,
) -> tokio::task::JoinHandle<anyhow::Result<Option<update::UpdateInfo>>> {
    tokio::spawn(async move {
        // Respeita o intervalo de 24h via settings.last_update_check.
        let storage = Storage::new()?;
        let mut settings = storage.load_settings();
        let now = now_ms() as u64;
        if let Some(last) = settings.last_update_check {
            if now.saturating_sub(last) < update::CHECK_INTERVAL_MS {
                return Ok(None);
            }
        }
        settings.last_update_check = Some(now);
        let _ = storage.save_settings(&settings);

        let client = reqwest::Client::builder()
            .user_agent(concat!("nexora-cli/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        let _ = dir;
        update::check_for_update(&client).await
    })
}

fn handle_realtime(app: &mut App, msg: RealtimeMessage) {
    match msg {
        RealtimeMessage::Connected => app.connection = Connection::Connected,
        RealtimeMessage::Disconnected(_) => {
            app.connection = Connection::Connecting;
        }
        RealtimeMessage::Event(ev) => match ev.t.as_str() {
            "message:new" => {
                if let Ok(m) = serde_json::from_value::<Message>(
                    ev.message.clone().unwrap_or_default(),
                ) {
                    let is_open =
                        (m.conversationId.is_some() && m.conversationId == app.open_conversation)
                            || (m.channelId.is_some() && m.channelId == app.open_channel);
                    let author = m.author.name.clone().unwrap_or_default();
                    let preview = m.display_content();
                    let conv = m.conversationId;
                    let ch = m.channelId;
                    if is_open && app.chat_focus == ChatFocus::History {
                        app.scroll_history(0);
                    }
                    app.push_message(m);
                    if !is_open {
                        app.notify_new_message(conv, ch, &author, &preview);
                        app.show_toast(
                            format!("● {author}: {}", first_line(&preview)),
                            now_ms(),
                            5000,
                        );
                    }
                }
            }
            "presence" => {
                if let (Some(uid), Some(status)) = (ev.userId, ev.status) {
                    app.online.insert(uid, status == "online");
                }
            }
            _ => {}
        },
    }
}

fn first_line(s: &str) -> String {
    s.lines().next().unwrap_or("").to_string()
}

fn handle_key(
    app: &mut App,
    code: crossterm::event::KeyCode,
    mods: crossterm::event::KeyModifiers,
    send_tx: &mpsc::UnboundedSender<(Option<i64>, Option<i64>, String)>,
    load_tx: &mpsc::UnboundedSender<(Option<i64>, Option<i64>)>,
    theme: &Theme,
) {
    use crossterm::event::{KeyCode as K, KeyModifiers as M};

    // Globais.
    if mods == M::CONTROL {
        match code {
            K::Char('q') | K::Char('Q') => {
                app.should_quit = true;
                return;
            }
            K::Char('k') | K::Char('K') => {
                app.popup = Popup::Search;
                app.search_query.clear();
                app.search_selected = 0;
                return;
            }
            K::Char('d') | K::Char('D') => {
                app.view = View::Friends;
                app.friend_tab = app::FriendTab::All;
                return;
            }
            K::Char('g') | K::Char('G') => {
                app.view = View::Servers;
                return;
            }
            K::Char(',') => {
                app.popup = Popup::Settings;
                return;
            }
            _ => {}
        }
    }

    // Popups primeiro.
    match &mut app.popup {
        Popup::Search => {
            match (code, mods) {
                (K::Esc, _) => app.popup = Popup::None,
                (K::Enter, _) => {
                    let results = app.search_results();
                    if let Some(r) = results.get(app.search_selected).cloned() {
                        match r.kind {
                            app::SearchResultKind::Conversation => {
                                app.popup = Popup::None;
                                app.open_conversation_chat(r.id);
                            }
                            app::SearchResultKind::Friend => {
                                // Amigo: abre DM se existir, senão mostra info.
                                let conv = app
                                    .conversations
                                    .iter()
                                    .find(|c| {
                                        c.members.iter().any(|m| m.id == r.id)
                                    })
                                    .map(|c| c.id);
                                app.popup = Popup::None;
                                match conv {
                                    Some(id) => app.open_conversation_chat(id),
                                    None => {
                                        app.popup = Popup::Info(format!(
                                            "{} ainda não tem conversa aberta. Envie uma mensagem pelo Nexora Web primeiro.",
                                            r.label
                                        ));
                                    }
                                }
                            }
                            app::SearchResultKind::Server => {
                                app.popup = Popup::None;
                                app.view = View::Servers;
                                app.open_server = Some(r.id);
                            }
                            app::SearchResultKind::Channel => {
                                app.popup = Popup::None;
                                app.open_channel_chat(r.id);
                            }
                        }
                    }
                }
                (K::Up, _) => app.move_search_selection(-1),
                (K::Down, _) => app.move_search_selection(1),
                (K::Backspace, _) => {
                    app.search_query.pop();
                    app.search_selected = 0;
                }
                (K::Char(c), m) if m.is_empty() || m == M::SHIFT => {
                    app.search_query.push(c);
                    app.search_selected = 0;
                }
                _ => {}
            }
            return;
        }
        Popup::Error(_) | Popup::Info(_) | Popup::Help => {
            if matches!(code, K::Enter | K::Esc | K::Char(' ') | K::Char('?')) {
                app.popup = Popup::None;
            }
            return;
        }
        Popup::Settings => {
            if code == K::Esc {
                app.popup = Popup::None;
            }
            return;
        }
        Popup::None => {}
    }

    match app.view {
        View::Friends => handle_friends_keys(app, code, mods, load_tx),
        View::Chat => handle_chat_keys(app, code, mods, send_tx, theme),
        View::Servers => handle_servers_keys(app, code, load_tx),
        View::Settings => {
            if code == K::Esc || code == K::Char('q') {
                app.back();
            }
        }
    }
}

fn handle_friends_keys(
    app: &mut App,
    code: crossterm::event::KeyCode,
    mods: crossterm::event::KeyModifiers,
    load_tx: &mpsc::UnboundedSender<(Option<i64>, Option<i64>)>,
) {
    use crossterm::event::{KeyCode as K, KeyModifiers as M};
    match (code, mods) {
        (K::Up, _) => app.move_friend_selection(-1),
        (K::Down, _) => app.move_friend_selection(1),
        (K::Esc, _) => app.should_quit = true,
        (K::Char('t') | K::Char('T'), m) if m.is_empty() => {
            // Alterna tema (atalho simples nas configurações).
            let storage = Storage::new().ok();
            if let Some(s) = storage {
                let mut st = s.load_settings();
                st.theme = if st.theme == "light" { "dark".into() } else { "light".into() };
                let _ = s.save_settings(&st);
            }
        }
        (K::Char('?'), _) => app.popup = Popup::Help,
        (K::Enter, _) => {
            // Abre DM com o amigo selecionado (se existir conversa).
            let friends = app.visible_friends();
            if let Some(f) = friends.get(app.friend_selected) {
                let friend_id = f.id;
                if let Some(c) = app
                    .conversations
                    .iter()
                    .find(|c| c.members.iter().any(|m| m.id == friend_id))
                {
                    let cid = c.id;
                    app.open_conversation_chat(cid);
                    let _ = load_tx.send((Some(cid), None));
                } else {
                    app.popup = Popup::Info(format!(
                        "Você ainda não tem conversa com {}. Envie a primeira mensagem pelo Nexora Web.",
                        f.display_name()
                    ));
                }
            }
        }
        (K::Backspace, _) => {
            app.friend_query.pop();
            app.friend_selected = 0;
        }
        (K::Char(c), m) if m.is_empty() || m == M::SHIFT => {
            app.friend_query.push(c);
            app.friend_selected = 0;
        }
        _ => {}
    }
}

fn handle_chat_keys(
    app: &mut App,
    code: crossterm::event::KeyCode,
    mods: crossterm::event::KeyModifiers,
    send_tx: &mpsc::UnboundedSender<(Option<i64>, Option<i64>, String)>,
    _theme: &Theme,
) {
    use crossterm::event::{KeyCode as K, KeyModifiers as M};
    match (code, mods) {
        (K::Esc, _) => app.back(),
        (K::Tab, _) => {
            app.chat_focus = match app.chat_focus {
                ChatFocus::Input => ChatFocus::History,
                ChatFocus::History => ChatFocus::Input,
            };
        }
        (K::PageUp, _) => app.scroll_history(10),
        (K::PageDown, _) => {
            app.history_scroll = app.history_scroll.saturating_sub(10);
        }
        (K::Up, m) if m.is_empty() && app.chat_focus == ChatFocus::History => {
            app.scroll_history(1);
        }
        (K::Down, m) if m.is_empty() && app.chat_focus == ChatFocus::History => {
            app.history_scroll = app.history_scroll.saturating_sub(1);
        }
        _ if app.chat_focus == ChatFocus::Input => {
            match (code, mods) {
                (K::Enter, m) if m.is_empty() => {
                    let content = app.input.clone();
                    if !content.trim().is_empty() {
                        if let Some(conv) = app.open_conversation {
                            app.input.clear();
                            let _ = send_tx.send((Some(conv), None, content));
                        } else if let Some(ch) = app.open_channel {
                            app.input.clear();
                            let _ = send_tx.send((None, Some(ch), content));
                        }
                    }
                }
                (K::Char('v'), m) if m == M::CONTROL => {
                    // Colar (clipboard do sistema).
                    if let Ok(mut cb) = arboard::Clipboard::new() {
                        if let Ok(s) = cb.get_text() {
                            app.input.push_str(&s);
                        }
                    }
                }
                (K::Backspace, _) => {
                    app.input.pop();
                }
                (K::Char(c), m) => {
                    // Shift+Enter insere nova linha (quando o terminal suporta).
                    if c == 'j' && m == M::CONTROL {
                        app.input.push('\n');
                    } else {
                        app.input.push(c);
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

fn handle_servers_keys(
    app: &mut App,
    code: crossterm::event::KeyCode,
    load_tx: &mpsc::UnboundedSender<(Option<i64>, Option<i64>)>,
) {
    use crossterm::event::KeyCode as K;
    match code {
        K::Esc => app.back(),
        K::Up => app.dm_selected = app.dm_selected.saturating_sub(1),
        K::Down => {
            let max = app.channels.len().saturating_sub(1);
            app.dm_selected = (app.dm_selected + 1).min(max);
        }
        K::Enter => {
            if let Some(ch) = app.channels.get(app.dm_selected) {
                if matches!(ch.kind.as_deref(), Some("TEXT") | None) {
                    let id = ch.id;
                    app.open_channel_chat(id);
                    let _ = load_tx.send((None, Some(id)));
                } else {
                    app.popup = Popup::Info(
                        "Canais de voz não são suportados no Nexora CLI — somente texto."
                            .into(),
                    );
                }
            }
        }
        _ => {}
    }
}

fn handle_mouse(app: &mut App, m: crossterm::event::MouseEvent) {
    use crossterm::event::MouseEventKind as MK;
    match m.kind {
        MK::ScrollUp => match app.view {
            View::Chat if app.chat_focus == ChatFocus::History => app.scroll_history(3),
            _ => {}
        },
        MK::ScrollDown => match app.view {
            View::Chat if app.chat_focus == ChatFocus::History => {
                app.history_scroll = app.history_scroll.saturating_sub(3);
            }
            _ => {}
        },
        _ => {
            // Cliques em elementos: a posição exata depende do layout;
            // aqui tratamos clique simples como "abrir selecionado".
            if m.kind == MK::Down(crossterm::event::MouseButton::Left) {
                match app.view {
                    View::Friends => {
                        let _ = open_selected_friend(app);
                    }
                    View::Servers => {
                        handle_servers_keys(app, crossterm::event::KeyCode::Enter, &dummy_load_tx());
                    }
                    _ => {}
                }
            }
        }
    }
}

fn dummy_load_tx() -> mpsc::UnboundedSender<(Option<i64>, Option<i64>)> {
    let (tx, _rx) = mpsc::unbounded_channel();
    tx
}

fn open_selected_friend(app: &mut App) -> Result<(), ()> {
    let friends = app.visible_friends();
    if let Some(f) = friends.get(app.friend_selected) {
        let friend_id = f.id;
        if let Some(c) = app
            .conversations
            .iter()
            .find(|c| c.members.iter().any(|m| m.id == friend_id))
        {
            let cid = c.id;
            app.open_conversation_chat(cid);
            return Ok(());
        }
    }
    Err(())
}

// Silence unused import warning for ApiError when not used in tests.
#[allow(dead_code)]
fn _assert_api_error_send_sync() {
    fn assert<T: Send + Sync>() {}
    assert::<ApiError>();
}
