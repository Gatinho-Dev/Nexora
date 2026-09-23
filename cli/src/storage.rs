//! Armazenamento local do Nexora CLI.
//!
//! - Token de sessão: arquivo com permissão 0600 no diretório de config do SO
//!   (`~/.config/nexora-cli/` no Linux, `%APPDATA%\\nexora-cli` no Windows,
//!   `~/Library/Application Support/nexora-cli` no macOS). Nenhuma senha é
//!   armazenada — apenas o token de sessão emitido pelo device flow.
//! - Preferências: `settings.json` no mesmo diretório.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    /// "dark" | "light"
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_true")]
    pub notifications: bool,
    #[serde(default)]
    pub last_conversation_id: Option<i64>,
    #[serde(default)]
    pub last_channel_id: Option<i64>,
    /// Última verificação de atualização (epoch ms).
    #[serde(default)]
    pub last_update_check: Option<u64>,
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_true() -> bool {
    true
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            settings: Settings::default(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingsState {
    settings: Settings,
}

pub struct Storage {
    dir: PathBuf,
}

impl Storage {
    /// Diretório de config por SO — nada de caminhos hardcoded.
    pub fn new() -> Result<Self> {
        let base = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("não foi possível determinar o diretório de configuração do sistema"))?;
        let dir = base.join("nexora-cli");
        std::fs::create_dir_all(&dir)
            .with_context(|| format!("criando {}", dir.display()))?;
        Ok(Self { dir })
    }

    pub fn dir(&self) -> &PathBuf {
        &self.dir
    }

    fn token_path(&self) -> PathBuf {
        self.dir.join("session.token")
    }

    fn settings_path(&self) -> PathBuf {
        self.dir.join("settings.json")
    }

    // ── Token de sessão ──────────────────────────────────────

    pub fn load_token(&self) -> Option<String> {
        std::fs::read_to_string(self.token_path())
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }

    pub fn save_token(&self, token: &str) -> Result<()> {
        use std::io::Write;

        let mut file = {
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                std::fs::OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .mode(0o600)
                    .open(self.token_path())
                    .with_context(|| "abrindo arquivo de sessão")?
            }
            #[cfg(not(unix))]
            {
                // Windows: o arquivo herda as permissões do perfil do usuário
                // (diretório de config já é privado do usuário).
                std::fs::OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .open(self.token_path())
                    .with_context(|| "abrindo arquivo de sessão")?
            }
        };
        file.write_all(token.as_bytes())?;
        #[cfg(not(unix))]
        {
            // Windows: o arquivo herda as permissões do perfil do usuário
            // (diretório de config já é privado do usuário).
            let _ = &mut file;
        }
        Ok(())
    }

    pub fn clear_token(&self) -> Result<()> {
        match std::fs::remove_file(self.token_path()) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.into()),
        }
    }

    // ── Preferências ─────────────────────────────────────────

    pub fn load_settings(&self) -> Settings {
        std::fs::read_to_string(self.settings_path())
            .ok()
            .and_then(|s| serde_json::from_str::<SettingsState>(&s).ok())
            .map(|st| st.settings)
            .unwrap_or_default()
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<()> {
        let state = SettingsState {
            settings: settings.clone(),
        };
        let json = serde_json::to_string_pretty(&state)?;
        std::fs::write(self.settings_path(), json)
            .with_context(|| "salvando preferências")?;
        Ok(())
    }

    /// Limpa cache e arquivos locais (mantém nada de sensível depois disso).
    pub fn wipe(&self) -> Result<()> {
        let _ = self.clear_token();
        let _ = std::fs::remove_file(self.settings_path());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_roundtrip_and_defaults() {
        let s: Settings = serde_json::from_str("{}").unwrap();
        assert_eq!(s.theme, "dark");
        assert!(s.notifications);

        let s2 = Settings {
            theme: "light".into(),
            notifications: false,
            last_conversation_id: Some(42),
            last_channel_id: None,
            last_update_check: Some(1_000),
        };
        let json = serde_json::to_string(&s2).unwrap();
        let s3: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(s3.last_conversation_id, Some(42));
        assert_eq!(s3.theme, "light");
    }

    #[test]
    fn token_storage_works_and_clears() {
        // Usa um dir temporário simulando a API do Storage.
        let tmp = std::env::temp_dir().join(format!("nexora-cli-test-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let storage = Storage {
            dir: tmp.clone(),
        };
        assert!(storage.load_token().is_none());
        storage.save_token("abc123").unwrap();
        assert_eq!(storage.load_token().as_deref(), Some("abc123"));
        storage.clear_token().unwrap();
        assert!(storage.load_token().is_none());
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
