// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use keyring::Entry;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_store::StoreExt;
use tauri_plugin_shell::process::Command;

static SESSION_KEYRING: Lazy<Mutex<Option<Entry>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Serialize, Deserialize)]
struct SessionData {
    token: String,
    refresh_token: Option<String>,
    expires_at: Option<i64>,
    user_id: Option<i64>,
    username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WindowStateData {
    width: f64,
    height: f64,
    x: Option<f64>,
    y: Option<f64>,
    maximized: bool,
    fullscreen: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingsData {
    minimize_to_tray: bool,
    start_minimized: bool,
    autolaunch: bool,
    show_notification_content: bool,
    play_notification_sound: bool,
}

impl Default for SettingsData {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
            start_minimized: false,
            autolaunch: false,
            show_notification_content: true,
            play_notification_sound: true,
        }
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
async fn get_platform() -> String {
    "linux".to_string()
}

#[tauri::command]
async fn is_desktop() -> bool {
    true
}

#[tauri::command]
async fn get_desktop_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn open_login_in_browser(app: AppHandle) -> Result<(), String> {
    // Open the login page in the system browser with a desktop flag
    // The server will redirect to nexora://auth/callback after successful login
    let login_url = "https://nexorachat.cloud/login?desktop=true";
    
    // Try to open with opener plugin first
    if let Err(e) = tauri_plugin_opener::open_url(login_url, None::<&str>) {
        let err = e.to_string();
        eprintln!("Failed to open browser with opener plugin: {}", err);
        
        // Fallback: try xdg-open directly on Linux
        use std::process::Command;
        if let Err(e2) = Command::new("xdg-open").arg(login_url).spawn() {
            let err2 = e2.to_string();
            eprintln!("Failed to open browser with xdg-open: {}", err2);
            return Err(format!("Both opener plugin and xdg-open failed: {} | {}", err, err2));
        }
        eprintln!("Opened browser via xdg-open fallback");
    } else {
        eprintln!("Opened browser via opener plugin");
    }
    
    Ok(())
}

#[tauri::command]
async fn handle_auth_callback(app: AppHandle, token: String) -> Result<(), String> {
    // Store the session token securely in the keyring
    let entry = keyring::Entry::new("nexora-desktop", "session").map_err(|e| e.to_string())?;
    let session_data = serde_json::json!({
        "token": token,
        "timestamp": chrono::Utc::now().timestamp()
    });
    entry.set_password(&session_data.to_string()).map_err(|e| e.to_string())?;

    // Also store in app store for quick access
    let store = app.store("session.json").map_err(|e| e.to_string())?;
    store.set("has_session".to_string(), serde_json::json!(true));
    store.set("token".to_string(), serde_json::json!(token));
    store.save().map_err(|e| e.to_string())?;

    // Navigate to the app main page
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval("window.location.href = '/channels/@me'");
        let _ = window.show();
        let _ = window.set_focus();
    }

    Ok(())
}

#[tauri::command]
async fn show_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        window.unminimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn minimize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn maximize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn is_window_maximized(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        Ok(window.is_maximized().unwrap_or(false))
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn close_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn get_window_state(app: AppHandle) -> Result<WindowStateData, String> {
    if let Some(window) = app.get_webview_window("main") {
        let size = window.inner_size().map_err(|e| e.to_string())?;
        let position = window.outer_position().ok();
        let maximized = window.is_maximized().unwrap_or(false);
        let fullscreen = window.is_fullscreen().unwrap_or(false);
        Ok(WindowStateData {
            width: size.width as f64,
            height: size.height as f64,
            x: position.map(|p| p.x as f64),
            y: position.map(|p| p.y as f64),
            maximized,
            fullscreen,
        })
    } else {
        Err("Window not found".to_string())
    }
}

#[tauri::command]
async fn set_minimize_to_tray(app: AppHandle, value: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("minimize_to_tray".to_string(), serde_json::json!(value));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_minimize_to_tray(app: AppHandle) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let value = store.get("minimize_to_tray").and_then(|v| v.as_bool()).unwrap_or(true);
    Ok(value)
}

#[tauri::command]
async fn get_show_notification_content(app: AppHandle) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let value = store.get("show_notification_content").and_then(|v| v.as_bool()).unwrap_or(true);
    Ok(value)
}

#[tauri::command]
async fn set_show_notification_content(app: AppHandle, value: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("show_notification_content".to_string(), serde_json::json!(value));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_play_notification_sound(app: AppHandle) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let value = store.get("play_notification_sound").and_then(|v| v.as_bool()).unwrap_or(true);
    Ok(value)
}

#[tauri::command]
async fn set_play_notification_sound(app: AppHandle, value: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("play_notification_sound".to_string(), serde_json::json!(value));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    conversation_id: Option<String>,
) -> Result<(), String> {
    let show_content = get_show_notification_content(app.clone()).await.unwrap_or(true);

    app
        .notification()
        .builder()
        .title(title)
        .body(if show_content { body } else { "Você recebeu uma nova mensagem.".to_string() })
        .show()
        .map_err(|e| e.to_string())?;

    if let Some(conv_id) = conversation_id {
        app.emit("notification-click", conv_id).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Invalid URL protocol".to_string());
    }
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_files(app: AppHandle, _multiple: bool) -> Result<Vec<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "gif"])
        .add_filter("Videos", &["mp4", "webm", "mov"])
        .add_filter("Documents", &["pdf", "txt", "doc", "docx"])
        .add_filter("All Files", &["*"])
        .pick_files(move |files| {
            let _ = tx.send(files);
        });
    
    match rx.recv() {
        Ok(Some(paths)) => Ok(paths.into_iter().map(|p| p.to_string()).collect()),
        Ok(None) => Ok(vec![]),
        Err(_) => Err("Dialog closed".to_string()),
    }
}

#[tauri::command]
async fn save_file(app: AppHandle, suggested_name: String, data: Vec<u8>) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_file_name(&suggested_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => {
            let path_buf = path.as_path().expect("Invalid path").to_path_buf();
            fs::write(&path_buf, data).map_err(|e| e.to_string())?;
            Ok(path_buf.to_string_lossy().to_string())
        }
        Ok(None) => Err("User cancelled".to_string()),
        Err(_) => Err("Dialog closed".to_string()),
    }
}

#[tauri::command]
async fn show_in_folder(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_cache_size(app: AppHandle) -> Result<u64, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let mut total_size = 0u64;
    if cache_dir.exists() {
        for entry in walkdir::WalkDir::new(&cache_dir) {
            if let Ok(entry) = entry {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                }
            }
        }
    }
    Ok(total_size)
}

#[tauri::command]
async fn clear_cache(app: AppHandle) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_logs_folder(app: AppHandle) -> Result<(), String> {
    let log_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    if !log_dir.exists() {
        fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    }
    tauri_plugin_opener::open_path(log_dir, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_diagnostics(_app: AppHandle) -> Result<serde_json::Value, String> {
    let os_info = format!("{} {}", std::env::consts::OS, std::env::consts::ARCH);
    Ok(serde_json::json!({
        "app": "Nexora Desktop",
        "version": env!("CARGO_PKG_VERSION"),
        "os": os_info,
        "webview": "webkitgtk",
        "tauri": "2.11.5",
        "arch": std::env::consts::ARCH,
    }))
}

#[tauri::command]
async fn set_secure_session(
    app: AppHandle,
    token: String,
    refresh_token: Option<String>,
    expires_at: Option<i64>,
    user_id: Option<i64>,
    username: Option<String>,
) -> Result<(), String> {
    let session = SessionData {
        token,
        refresh_token,
        expires_at,
        user_id,
        username: username.clone(),
    };

    let entry = Entry::new("nexora-desktop", "session").map_err(|e| e.to_string())?;
    let data = serde_json::to_string(&session).map_err(|e| e.to_string())?;
    entry.set_password(&data).map_err(|e| e.to_string())?;

    let store = app.store("session.json").map_err(|e| e.to_string())?;
    store.set("has_session".to_string(), serde_json::json!(true));
    store.set("user_id".to_string(), serde_json::json!(user_id));
    store.set("username".to_string(), serde_json::json!(username));
    store.save().map_err(|e| e.to_string())?;

    *SESSION_KEYRING.lock().unwrap() = Some(entry);

    Ok(())
}

#[tauri::command]
async fn get_secure_session(_app: AppHandle) -> Result<Option<SessionData>, String> {
    let entry = Entry::new("nexora-desktop", "session").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(data) => {
            let session: SessionData = serde_json::from_str(&data).map_err(|e| e.to_string())?;
            Ok(Some(session))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn clear_secure_session(app: AppHandle) -> Result<(), String> {
    let entry = Entry::new("nexora-desktop", "session").map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;

    let store = app.store("session.json").map_err(|e| e.to_string())?;
    let _ = store.delete("has_session");
    let _ = store.delete("user_id");
    let _ = store.delete("username");
    store.save().map_err(|e| e.to_string())?;

    *SESSION_KEYRING.lock().unwrap() = None;

    Ok(())
}

#[tauri::command]
async fn has_secure_session(app: AppHandle) -> Result<bool, String> {
    let store = app.store("session.json").map_err(|e| e.to_string())?;
    Ok(store.get("has_session").and_then(|v| v.as_bool()).unwrap_or(false))
}

#[tauri::command]
async fn copy_to_clipboard(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_clipboard_text(app: AppHandle) -> Result<String, String> {
    app.clipboard().read_text().map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_media_permission_granted(_permission: String) -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
async fn request_media_permission(_permission: String) -> Result<bool, String> {
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();

                for arg in args {
                    if arg.starts_with("nexora://") {
                        let _ = window.emit("deep-link", arg);
                    }
                }
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        // Restaura tamanho/posição mas nunca reabre escondido: se a janela
        // estava oculta na bandeja ao sair, o estado salvo não deve esconder
        // o app no próximo launch.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all().difference(tauri_plugin_window_state::StateFlags::VISIBLE))
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let handle = app.handle().clone();

            let _ = handle.store("settings.json");
            let _ = handle.store("session.json");

            let _tray = TrayIconBuilder::with_id("nexora-tray")
                .tooltip("Nexora")
                .icon(handle.default_window_icon().unwrap().clone())
                .menu(&MenuBuilder::new(&handle)
                    .item(&MenuItemBuilder::new("Abrir Nexora").id("open").accelerator("Ctrl+Shift+N").build(&handle)?)
                    .separator()
                    .item(&MenuItemBuilder::new("Status").id("status").enabled(false).build(&handle)?)
                    .item(&MenuItemBuilder::new("Silenciar notificações").id("mute_notifications").build(&handle)?)
                    .separator()
                    .item(&MenuItemBuilder::new("Sair").id("quit").accelerator("Ctrl+Q").build(&handle)?)
                    .build()?)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.unminimize();
                            }
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "mute_notifications" => {
                        let _ = app.emit("toggle-notifications-mute", ());
                    }
                    _ => {}
                })
                .build(&handle)?;

            // O WebKitGTK mantém cache HTTP da origem entre reinstalações/versões,
            // fazendo o app abrir um front antigo embutido em binário anterior.
            // Limpa os dados de navegação uma vez por versão e recarrega.
            if let Ok(data_dir) = handle.path().app_data_dir() {
                let marker = data_dir.join(format!(".webview-cache-purged-{}", env!("CARGO_PKG_VERSION")));
                if !marker.exists() {
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.clear_all_browsing_data();
                        // Pequeno atraso para a limpeza concluir antes de navegar para a landing page.
                        let _ = window.eval("setTimeout(() => window.location.href = '/', 500)");
                    }
                    let _ = fs::create_dir_all(&data_dir);
                    let _ = fs::write(&marker, b"1");
                }
            } else {
                // Always ensure we start at the landing page on fresh launches
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.eval("window.location.href = '/'");
                }
            }

            if let Some(window) = handle.get_webview_window("main") {
                let handle_clone = handle.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let handle = handle_clone.clone();
                        api.prevent_close();
                        let _ = handle.get_webview_window("main").map(|w| w.hide());
                    }
                });
            }

            #[cfg(target_os = "linux")]
            {
                let handle = handle.clone();
                app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    let url = urls.join("");
                    let _ = handle.emit("deep-link", &url);

                    // Handle auth callback: nexora://auth/callback?token=...
                    if url.starts_with("nexora://auth/callback") {
                        if let Ok(parsed) = url::Url::parse(&url) {
                            if let Some(token) = parsed.query_pairs().find(|(k, _)| k == "token").map(|(_, v)| v.into_owned()) {
                                let handle_for_thread = handle.clone();
                                let token_for_thread = token.clone();
                                tauri::async_runtime::spawn(async move {
                                    if let Err(e) = handle_for_thread.run_on_main_thread({
                                        let handle_inner = handle_for_thread.clone();
                                        let token_inner = token_for_thread.clone();
                                        move || {
                                            if let Some(window) = handle_inner.get_webview_window("main") {
                                                // Store token and navigate to app
                                                let _ = window.eval(&format!(
                                                    "window.dispatchEvent(new CustomEvent('nexora:auth:success', {{ detail: {{ token: '{}' }} }}))",
                                                    token_inner
                                                ));
                                            }
                                        }
                                    }) {
                                        eprintln!("Failed to dispatch auth success: {}", e);
                                    }
                                });
                            }
                        }
                    }

                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            ping,
            get_platform,
            is_desktop,
            get_desktop_version,
            open_login_in_browser,
            show_window,
            hide_window,
            minimize_window,
            maximize_window,
            is_window_maximized,
            close_window,
            get_window_state,
            set_minimize_to_tray,
            get_minimize_to_tray,
            get_show_notification_content,
            set_show_notification_content,
            get_play_notification_sound,
            set_play_notification_sound,
            show_notification,
            open_external_url,
            pick_files,
            save_file,
            show_in_folder,
            get_cache_size,
            clear_cache,
            open_logs_folder,
            get_diagnostics,
            set_secure_session,
            get_secure_session,
            clear_secure_session,
            has_secure_session,
            copy_to_clipboard,
            get_clipboard_text,
            is_media_permission_granted,
            request_media_permission,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}