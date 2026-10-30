//! Sistema de atualização do Nexora CLI.
//!
//! - Verificação leve via API oficial do GitHub Releases (projeto do Nexora).
//! - Comparação semântica real (não string).
//! - Download do artefato correto para a plataforma e substituição segura.
//! - Nunca bloqueia a TUI: roda em background e aplica em momento seguro.
//! - Fallback: se falhar, a versão atual continua funcionando normalmente.

use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::path::PathBuf;

pub const GITHUB_REPO: &str = "Gatinho-Dev/Nexora";
pub const CHECK_INTERVAL_MS: u64 = 24 * 60 * 60 * 1000; // 24h

#[derive(Debug, Clone, PartialEq)]
pub struct Version {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
}

impl Version {
    pub fn parse(s: &str) -> Result<Self> {
        let s = s.trim().trim_start_matches('v');
        let core = s.split(['-', '+']).next().unwrap_or(s);
        let mut parts = core.split('.');
        let major = parts.next().unwrap_or("0").parse().unwrap_or(0);
        let minor = parts.next().unwrap_or("0").parse().unwrap_or(0);
        let patch = parts.next().unwrap_or("0").parse().unwrap_or(0);
        Ok(Self {
            major,
            minor,
            patch,
        })
    }

    pub fn is_newer_than(&self, other: &Version) -> bool {
        (self.major, self.minor, self.patch) > (other.major, other.minor, other.patch)
    }
}

#[derive(Debug, Clone)]
pub struct UpdateInfo {
    pub latest: Version,
    pub download_url: String,
}

#[derive(Debug, Deserialize)]
struct GhRelease {
    #[serde(rename = "tagName")]
    tag_name: String,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    #[serde(rename = "browserDownloadUrl")]
    url: String,
}

/// Artefatos esperados para a plataforma atual (em ordem de preferência).
fn expected_artifacts() -> Vec<String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    match (os, arch) {
        ("linux", "x86_64") => vec!["nexora-cli-linux-x64.tar.gz".into()],
        ("linux", "aarch64") => vec!["nexora-cli-linux-arm64.tar.gz".into()],
        ("windows", _) => vec!["nexora-cli-windows-x64.zip".into()],
        ("macos", "aarch64") => vec!["nexora-cli-macos-arm64.tar.gz".into()],
        ("macos", "x86_64") => vec!["nexora-cli-macos-x64.tar.gz".into()],
        _ => vec![format!("nexora-cli-{os}-{arch}.tar.gz")],
    }
}

/// Consulta o GitHub Releases e devolve a atualização disponível (se houver).
pub async fn check_for_update(client: &reqwest::Client) -> Result<Option<UpdateInfo>> {
    let url = format!("https://api.github.com/repos/{GITHUB_REPO}/releases/latest");
    let release: GhRelease = client
        .get(&url)
        .header("User-Agent", concat!("nexora-cli/", env!("CARGO_PKG_VERSION")))
        .send()
        .await
        .context("consultando releases")?
        .error_for_status()?
        .json()
        .await
        .context("parse do release")?;

    let latest = Version::parse(&release.tag_name)?;
    let current = Version::parse(env!("CARGO_PKG_VERSION"))?;
    if !latest.is_newer_than(&current) {
        return Ok(None);
    }

    let wanted = expected_artifacts();
    let asset = release
        .assets
        .iter()
        .find(|a| wanted.iter().any(|w| a.name == *w))
        .or_else(|| {
            release
                .assets
                .iter()
                .find(|a| a.name.contains(std::env::consts::OS) && !a.name.ends_with(".deb"))
        });

    Ok(asset.map(|a| UpdateInfo {
        latest,
        download_url: a.url.clone(),
    }))
}

#[allow(dead_code)]
/// Baixa o artefato para `dest` com progresso. Não instala nada.
pub async fn download_update(
    client: &reqwest::Client,
    info: &UpdateInfo,
    dest: &std::path::Path,
    progress: impl Fn(u64, Option<u64>) + Send + Sync,
) -> Result<()> {
    let resp = client
        .get(&info.download_url)
        .header("User-Agent", concat!("nexora-cli/", env!("CARGO_PKG_VERSION")))
        .header("Accept", "application/octet-stream")
        .send()
        .await
        .context("iniciando download")?
        .error_for_status()?;

    let total = resp.content_length();
    let bytes = resp.bytes().await.context("baixando atualização")?;

    if bytes.is_empty() {
        return Err(anyhow!("download vazio — atualização descartada"));
    }

    // Grava tudo de uma vez (artefatos são pequenos, ~10 MB).
    tokio::fs::write(dest, &bytes)
        .await
        .with_context(|| format!("gravando {}", dest.display()))?;

    progress(bytes.len() as u64, total.or(Some(bytes.len() as u64)));
    Ok(())
}

#[allow(dead_code)]
/// Substitui o binário atual de forma segura (backup + swap + rollback).
pub fn apply_update(packed: &std::path::Path) -> Result<()> {
    let current = std::env::current_exe().context("localizando o executável atual")?;
    let new_bin = extract_binary(packed)?;

    let backup = current.with_extension("old");
    let _ = std::fs::remove_file(&backup);
    std::fs::rename(&current, &backup).context("preservando o binário atual")?;
    match std::fs::rename(&new_bin, &current) {
        Ok(()) => {
            let _ = std::fs::remove_file(&backup);
            Ok(())
        }
        Err(e) => {
            let _ = std::fs::rename(&backup, &current);
            Err(anyhow!("falha ao substituir o binário: {e}"))
        }
    }
}

/// Extrai o binário do artefato (.tar.gz no Unix, .zip no Windows).
fn extract_binary(packed: &std::path::Path) -> Result<PathBuf> {
    let out_dir = packed
        .parent()
        .unwrap_or(std::path::Path::new("/tmp"))
        .join("nexora-update");
    let _ = std::fs::remove_dir_all(&out_dir);
    std::fs::create_dir_all(&out_dir)?;

    let name = packed
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();

    if name.ends_with(".tar.gz") {
        let tar_gz = std::fs::File::open(packed)?;
        let decoder = flate2::read::GzDecoder::new(tar_gz);
        tar::Archive::new(decoder).unpack(&out_dir)?;
    } else if name.ends_with(".zip") {
        let file = std::fs::File::open(packed)?;
        zip::ZipArchive::new(file)?.extract(&out_dir)?;
    } else {
        std::fs::copy(packed, out_dir.join("nexora"))?;
    }

    let candidates: &[&str] = if cfg!(windows) {
        &["nexora.exe", "nexora-cli.exe"]
    } else {
        &["nexora", "nexora-cli"]
    };
    for c in candidates {
        let p = out_dir.join(c);
        if p.exists() {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755))?;
            }
            return Ok(p);
        }
    }
    Err(anyhow!("binário não encontrado no artefato"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_semantic_comparison() {
        assert!(Version::parse("1.10.0").unwrap().is_newer_than(&Version::parse("1.9.0").unwrap()));
        assert!(Version::parse("v2.0.0").unwrap().is_newer_than(&Version::parse("1.99.99").unwrap()));
        assert!(Version::parse("1.0.1").unwrap().is_newer_than(&Version::parse("1.0.0").unwrap()));
        assert!(!Version::parse("1.0.0").unwrap().is_newer_than(&Version::parse("1.0.0").unwrap()));
        assert!(!Version::parse("1.0.0-beta.1").unwrap().is_newer_than(&Version::parse("1.0.0").unwrap()));
    }

    #[test]
    fn version_parse_tolerates_prefixes() {
        assert_eq!(
            Version::parse("v1.2.3").unwrap(),
            Version { major: 1, minor: 2, patch: 3 }
        );
        assert_eq!(
            Version::parse("1.2").unwrap(),
            Version { major: 1, minor: 2, patch: 0 }
        );
    }

    #[test]
    fn expected_artifacts_cover_current_platform() {
        let arts = expected_artifacts();
        assert!(!arts.is_empty());
        assert!(arts[0].contains("nexora-cli"));
    }
}
