//! Onboarding e autenticação do Nexora CLI.
//!
//! Fluxo: boas-vindas → device flow (navegador) → polling → configuração
//! inicial com progresso → TUI. Tudo em terminal simples (sem alternate
//! screen), com restore garantido em qualquer saída.

use anyhow::{anyhow, Result};
use crossterm::{
    cursor,
    event::{self, Event, KeyCode},
    execute,
    style::{Attribute, Color as CtColor, ResetColor, SetForegroundColor},
    terminal,
};
use std::io::Write;

use crate::api::client::{Api, DevicePoll};
use crate::storage::{Settings, Storage};

/// Abre o navegador padrão na URL (cross-platform, sem crates extras pesados).
pub fn open_browser(url: &str) -> Result<()> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| anyhow!("não foi possível abrir o navegador: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| anyhow!("não foi possível abrir o navegador: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| anyhow!("não foi possível abrir o navegador: {e}"))?;
    }
    Ok(())
}

fn welcome_box() {
    println!();
    println!(
        "  {}╭──────────────────────────────────────────╮{}",
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor
    );
    println!(
        "  {}│{}                                          {}│{}",
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor,
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor
    );
    println!(
        "  {}│{}        {}N E X O R A{}  C L I                {}│{}",
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor,
        SetForegroundColor(CtColor::White),
        SetForegroundColor(CtColor::DarkGrey),
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor
    );
    println!(
        "  {}│{}   Seu Nexora diretamente no terminal       {}│{}",
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor,
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor
    );
    println!(
        "  {}│{}                                          {}│{}",
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor,
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor
    );
    println!(
        "  {}╰──────────────────────────────────────────╯{}",
        SetForegroundColor(CtColor::DarkCyan),
        ResetColor
    );
    println!();
}

fn step_line(ok: bool, label: &str) {
    let mark = if ok {
        format!("{}✓{}", SetForegroundColor(CtColor::DarkGreen), ResetColor)
    } else {
        format!("{}✗{}", SetForegroundColor(CtColor::Red), ResetColor)
    };
    println!("  {mark} {label}");
    let _ = std::io::stdout().flush();
}

/// Fluxo completo de login. Devolve o token salvo.
pub async fn login_flow(api_url: String) -> Result<String> {
    let _ = terminal::enable_raw_mode();
    welcome_box();

    println!("  Bem-vindo ao Nexora CLI!");
    println!("  Para continuar, faça login na sua conta Nexora pelo navegador.");
    println!();
    println!("  {}[ Enter ]{} Continuar", Attribute::Bold, Attribute::Reset);
    let _ = std::io::stdout().flush();

    loop {
        if let Event::Key(k) = event::read()? {
            if k.kind == event::KeyEventKind::Press
                && matches!(k.code, KeyCode::Enter | KeyCode::Esc)
            {
                break;
            }
        }
    }

    let _http = reqwest::Client::new();
    let api = Api::with_config_only(api_url.clone());

    println!("  {}◐{} Iniciando pareamento…", SetForegroundColor(CtColor::Yellow), ResetColor);
    let start = api
        .device_start()
        .await
        .map_err(|e| anyhow!("falha ao iniciar o pareamento: {e}"))?;

    // URL completa de autorização (com o código já preenchido).
    let base = api_url.trim_end_matches('/');
    let verify_url = format!("{base}{}?code={}", start.verify_url, start.user_code);

    println!();
    println!(
        "  {}1.{} Abra este link no navegador:",
        Attribute::Bold,
        Attribute::Reset
    );
    println!("     {}", verify_url);
    println!();
    println!("  {}2.{} Ou digite o código manualmente:", Attribute::Bold, Attribute::Reset);
    println!(
        "     {}{}{}",
        SetForegroundColor(CtColor::White),
        start.user_code,
        ResetColor
    );
    println!();
    println!("  Abrindo o navegador…");
    let _ = open_browser(&verify_url);
    println!(
        "  {}◐{} Aguardando autenticação…{}",
        SetForegroundColor(CtColor::Yellow),
        ResetColor,
        cursor::Hide
    );
    let _ = std::io::stdout().flush();

    // Polling respeitando o intervalo sugerido pelo servidor.
    let interval = std::time::Duration::from_millis((start.interval * 1000.0) as u64);
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(start.expires_in);
    let token = loop {
        if std::time::Instant::now() > deadline {
            return Err(anyhow!("pareamento expirado — rode `nexora login` para tentar novamente"));
        }
        tokio::time::sleep(interval).await;
        match api.device_poll(&start.device_code).await {
            Ok(DevicePoll::Pending) => continue,
            Ok(DevicePoll::Authorized(token)) => break token,
            Ok(DevicePoll::Denied) => {
                return Err(anyhow!("autorização recusada no navegador"));
            }
            Ok(DevicePoll::Expired) => {
                return Err(anyhow!("código expirado — rode `nexora login` novamente"));
            }
            Err(e) => {
                // Erro de rede: continua tentando até o deadline.
                tracing::warn!("poll falhou (tentando de novo): {e}");
                continue;
            }
        }
    };

    execute!(std::io::stdout(), cursor::Show)?;
    println!("\r  {}✓{} Login concluído!", SetForegroundColor(CtColor::DarkGreen), ResetColor);

    // Valida a sessão pegando /auth.me.
    let api = api.with_token(Some(token.clone()));
    let me = api
        .me()
        .await
        .map_err(|e| anyhow!("sessão inválida: {e}"))?;
    step_line(true, "Conta autenticada");
    step_line(true, "Sessão segura criada");
    println!();
    println!(
        "  {}Bem-vindo, {}!{}",
        Attribute::Bold,
        me.name.clone().unwrap_or_else(|| "usuário".into()),
        Attribute::Reset
    );

    Ok(token)
}

/// Configuração inicial pós-login com checklist de progresso.
pub async fn onboarding_progress(api: &Api, storage: &Storage) -> Result<()> {
    println!();
    println!("  Configurando Nexora CLI…");

    // Amigos
    let friends_ok = api.friends().await.is_ok();
    step_line(friends_ok, "Amigos sincronizados");

    // DMs
    let dms_ok = api.conversations().await.is_ok();
    step_line(dms_ok, "Mensagens diretas carregadas");

    // Servidores
    let servers_ok = api.servers().await.is_ok();
    step_line(servers_ok, "Servidores carregados");

    // Preferências
    let settings = storage.load_settings();
    let prefs_ok = storage.save_settings(&settings).is_ok();
    step_line(prefs_ok, "Preferências salvas");

    if friends_ok && dms_ok && servers_ok && prefs_ok {
        println!();
        println!(
            "  {}✓ Tudo pronto!{} Pressione Enter para entrar no Nexora.",
            SetForegroundColor(CtColor::DarkGreen),
            ResetColor
        );
    } else {
        println!();
        println!(
            "  {}⚠{} Alguns dados não sincronizaram — verifique sua conexão.",
            SetForegroundColor(CtColor::Yellow),
            ResetColor
        );
    }
    let _ = std::io::stdout().flush();

    loop {
        if let Event::Key(k) = event::read()? {
            if k.kind == event::KeyEventKind::Press && k.code == KeyCode::Enter {
                break;
            }
        }
    }
    Ok(())
}

/// Verifica se há token válido; se houver, valida contra a API.
pub async fn ensure_authenticated(api_url: String, storage: &Storage) -> Result<(String, Api)> {
    if let Some(token) = storage.load_token() {
        let api = Api::with_config_only(api_url.clone()).with_token(Some(token.clone()));
        // Validação silenciosa: se caiu em 401, força novo login.
        match api.me().await {
            Ok(_) => return Ok((token, api)),
            Err(_) => {
                storage.clear_token()?;
                println!("  Sua sessão expirou. Abrindo o navegador para autenticação…");
            }
        }
    }
    let token = login_flow(api_url.clone()).await?;
    storage.save_token(&token)?;
    let api = Api::with_config_only(api_url).with_token(Some(token.clone()));
    Ok((token, api))
}

/// Salva preferências default na primeira execução.
pub fn ensure_settings(storage: &Storage) -> Settings {
    let settings = storage.load_settings();
    let _ = storage.save_settings(&settings);
    settings
}
