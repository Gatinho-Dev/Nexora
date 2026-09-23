//! Cliente da API do Nexora — tRPC (batch + superjson) e endpoints REST do
//! device flow. Reutiliza exatamente as mesmas rotas que o Nexora Web usa.

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{de::DeserializeOwned, Deserialize};
use serde_json::{json, Value};

use crate::models::{Channel, Conversation, Friend, Message, Server, User};

/// URLs padrão — podem ser sobrescritas por NEXORA_API_URL / NEXORA_WS_URL.
pub const DEFAULT_API_URL: &str = "https://nexorachat.cloud";
#[allow(dead_code)]
pub const DEFAULT_WS_URL: &str = "wss://nexorachat.cloud/ws";

#[allow(dead_code)]
pub struct ApiConfig {
    pub api_url: String,
    pub ws_url: String,
}

impl ApiConfig {
    #[allow(dead_code)]
    pub fn from_env() -> Self {
        let api_url =
            std::env::var("NEXORA_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_string());
        let ws_url = std::env::var("NEXORA_WS_URL").unwrap_or_else(|_| {
            let base = if api_url.starts_with("https") {
                format!("wss{}", &api_url[5..])
            } else if api_url.starts_with("http") {
                format!("ws{}", &api_url[4..])
            } else {
                return DEFAULT_WS_URL.to_string();
            };
            format!("{base}/ws")
        });
        Self { api_url, ws_url }
    }
}

pub struct Api {
    http: Client,
    config: ApiConfig,
    token: Option<String>,
}

// ── Resposta tRPC (superjson) ────────────────────────────────

/// Envelope do tRPC batch: [{ result: { data: { json: ... } } }].
/// O superjson só empacota valores não-JSON-puros; para os tipos que usamos
/// (strings, números, arrays de objetos planos) o campo `json` contém o valor.
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct TrpcBatchResponse {
    #[serde(default)]
    result: Option<TrpcResult>,
    #[serde(default)]
    error: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct TrpcResult {
    #[serde(default)]
    data: Option<TrpcData>,
}

#[derive(Debug, Deserialize)]
struct TrpcData {
    #[serde(default)]
    json: Option<Value>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct TrpcErrorShape {
    message: Option<Value>,
    data: Option<Value>,
}

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("autenticação expirada — rode `nexora login`")]
    Unauthorized,
    #[error("{0}")]
    Server(String),
    #[error("erro de rede: {0}")]
    Network(String),
}

pub type ApiResult<T> = std::result::Result<T, ApiError>;

impl Api {
    pub fn new(config: ApiConfig) -> Self {
        let http = Client::builder()
            .user_agent(concat!("nexora-cli/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("reqwest client");
        Self {
            http,
            config,
            token: None,
        }
    }

    /// Cria o client só com a URL da API (usado no onboarding).
    pub fn with_config_only(api_url: String) -> Self {
        Self::new(ApiConfig {
            api_url,
            ws_url: String::new(),
        })
    }

    pub fn with_token(mut self, token: Option<String>) -> Self {
        self.token = token;
        self
    }

    #[allow(dead_code)]
    pub fn set_token(&mut self, token: Option<String>) {
        self.token = token;
    }

    fn auth_header(&self) -> ApiResult<String> {
        self.token
            .clone()
            .map(|t| format!("Bearer {t}"))
            .ok_or(ApiError::Unauthorized)
    }

    /// Chama uma query tRPC: GET /api/trpc/<path>?input=<json>
    pub async fn query<T: DeserializeOwned>(&self, path: &str, input: Value) -> ApiResult<T> {
        let url = match input {
            Value::Null => format!("{}/api/trpc/{path}", self.config.api_url),
            v => format!(
                "{}/api/trpc/{path}?input={}",
                self.config.api_url,
                urlencode(&v.to_string())
            ),
        };
        let resp = self
            .http
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(|e| ApiError::Network(e.to_string()))?;
        let body: TrpcBatchResponse = handle_status(resp).await?;
        let data = body
            .result
            .and_then(|r| r.data)
            .and_then(|d| d.json)
            .ok_or_else(|| {
                ApiError::Server(format!("resposta inesperada do servidor para `{path}`"))
            })?;
        serde_json::from_value(data)
            .with_context(|| format!("parse da resposta de `{path}`"))
            .map_err(|e| ApiError::Server(e.to_string()))
    }

    /// Chama uma mutation tRPC: POST /api/trpc/<path> com batch+superjson.
    pub async fn mutate<T: DeserializeOwned>(&self, path: &str, input: Value) -> ApiResult<T> {
        // Formato batch: {"0":{"json":<input>}}
        let payload = json!({ "0": { "json": input } });
        let url = format!(
            "{}/api/trpc/{path}?batch=1",
            self.config.api_url
        );
        let resp = self
            .http
            .post(&url)
            .header("Authorization", self.auth_header()?)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| ApiError::Network(e.to_string()))?;
        let body: TrpcBatchResponse = handle_status(resp).await?;
        let data = body
            .result
            .and_then(|r| r.data)
            .and_then(|d| d.json)
            .ok_or_else(|| {
                ApiError::Server(format!("resposta inesperada do servidor para `{path}`"))
            })?;
        serde_json::from_value(data)
            .with_context(|| format!("parse da resposta de `{path}`"))
            .map_err(|e| ApiError::Server(e.to_string()))
    }

    // ── Device flow (autenticação pelo navegador) ────────────

    pub async fn device_start(&self) -> Result<DeviceStart> {
        let url = format!("{}/api/cli/device/start", self.config.api_url);
        let resp = self.http.post(&url).send().await?;
        Ok(resp.error_for_status()?.json().await?)
    }

    pub async fn device_poll(&self, device_code: &str) -> Result<DevicePoll> {
        let url = format!("{}/api/cli/device/poll", self.config.api_url);
        let resp = self
            .http
            .post(&url)
            .json(&json!({ "deviceCode": device_code }))
            .send()
            .await?;
        let status = resp.status();
        let body: Value = resp.json().await?;
        match body.get("error").and_then(|e| e.as_str()) {
            Some("authorization_pending") => Ok(DevicePoll::Pending),
            Some("expired_token") => Ok(DevicePoll::Expired),
            Some("access_denied") => Ok(DevicePoll::Denied),
            Some(other) => Err(anyhow!("servidor recusou o pareamento: {other}")),
            None => {
                if status.is_success() {
                    let token = body
                        .get("accessToken")
                        .and_then(|t| t.as_str())
                        .ok_or_else(|| anyhow!("resposta sem token"))?
                        .to_string();
                    Ok(DevicePoll::Authorized(token))
                } else {
                    Err(anyhow!("poll falhou: HTTP {status}"))
                }
            }
        }
    }

    pub async fn device_logout(&self, token: &str) -> Result<()> {
        let url = format!("{}/api/cli/device/logout", self.config.api_url);
        self.http
            .post(&url)
            .json(&json!({ "accessToken": token }))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    // ── Queries tRPC usadas pela TUI ─────────────────────────

    pub async fn me(&self) -> ApiResult<User> {
        self.query("auth.me", Value::Null).await
    }

    pub async fn friends(&self) -> ApiResult<Vec<Friend>> {
        self.query("friend.list", Value::Null).await
    }

    pub async fn conversations(&self) -> ApiResult<Vec<Conversation>> {
        self.query("dm.list", Value::Null).await
    }

    pub async fn servers(&self) -> ApiResult<Vec<Server>> {
        self.query("server.list", Value::Null).await
    }

    #[allow(dead_code)]
    pub async fn channels(&self, server_id: i64) -> ApiResult<Vec<Channel>> {
        self.query("server.channels", json!({ "serverId": server_id }))
            .await
    }

    #[allow(dead_code)]
    pub async fn messages(
        &self,
        conversation_id: Option<i64>,
        channel_id: Option<i64>,
        limit: u32,
    ) -> ApiResult<Vec<Message>> {
        let mut input = json!({ "limit": limit });
        if let Some(cid) = conversation_id {
            input["conversationId"] = json!(cid);
        } else if let Some(chid) = channel_id {
            input["channelId"] = json!(chid);
        }
        let raw: Vec<Message> = self.query("message.list", input).await?;
        // O histórico vem mais-recente-primeiro; exibimos antigo→novo.
        let mut out = raw;
        out.reverse();
        Ok(out)
    }

    pub async fn send_message(
        &self,
        conversation_id: Option<i64>,
        channel_id: Option<i64>,
        content: &str,
    ) -> ApiResult<Message> {
        let mut input = json!({ "content": content });
        if let Some(cid) = conversation_id {
            input["conversationId"] = json!(cid);
        } else if let Some(chid) = channel_id {
            input["channelId"] = json!(chid);
        }
        self.mutate("message.send", input).await
    }
}

async fn handle_status(resp: reqwest::Response) -> ApiResult<TrpcBatchResponse> {
    let status = resp.status();
    match status {
        s if s.is_success() => Ok(resp
            .json()
            .await
            .map_err(|e| ApiError::Server(format!("JSON inválido: {e}")))?),
        s if s.as_u16() == 401 => Err(ApiError::Unauthorized),
        _ => {
            let text = resp.text().await.unwrap_or_default();
            // tRPC devolve erros em formato próprio; tenta extrair a mensagem.
            if let Ok(err) = serde_json::from_str::<Vec<TrpcErrorShape>>(&text) {
                if let Some(first) = err.first() {
                    let msg = first
                        .message
                        .as_ref()
                        .and_then(|m| m.as_str())
                        .or_else(|| {
                            first
                                .data
                                .as_ref()
                                .and_then(|d| d.get("message"))
                                .and_then(|m| m.as_str())
                        })
                        .unwrap_or("erro interno do servidor");
                    return Err(ApiError::Server(msg.to_string()));
                }
            }
            Err(ApiError::Server(format!("HTTP {status}: {text}")))
        }
    }
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[derive(Debug, Deserialize)]
pub struct DeviceStart {
    #[serde(rename = "deviceCode")]
    pub device_code: String,
    #[serde(rename = "userCode")]
    pub user_code: String,
    #[serde(rename = "verifyUrl")]
    pub verify_url: String,
    #[serde(rename = "expiresIn")]
    pub expires_in: u64,
    pub interval: f64,
}

pub enum DevicePoll {
    Pending,
    Expired,
    Denied,
    Authorized(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urlencode_escapes_query_input() {
        assert_eq!(urlencode("{\"a b\"}"), "%7B%22a%20b%22%7D");
        assert_eq!(urlencode("abc-1.2~"), "abc-1.2~");
    }

    #[test]
    fn ws_url_derived_from_api_url() {
        std::env::set_var("NEXORA_API_URL", "https://example.com");
        let cfg = ApiConfig::from_env();
        assert_eq!(cfg.ws_url, "wss://example.com/ws");
        std::env::remove_var("NEXORA_API_URL");
    }
}
