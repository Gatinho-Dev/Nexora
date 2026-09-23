//! Realtime do Nexora CLI — WebSocket `/ws` do próprio Nexora.
//!
//! Mesma conexão que o Web usa: autentica via cookie? Não — o WS do Nexora
//! valida o cookie de sessão no handshake HTTP. Como o CLI não é navegador,
//! suportamos também Authorization: Bearer (mesmo JWT da sessão CLI).
//! Reconnect automático com backoff, sem duplicar conexões.

use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::Value;
use tokio::sync::mpsc;
use tokio_tungstenite::{
    connect_async,
    tungstenite::client::IntoClientRequest,
    tungstenite::Message as WsMessage,
};

#[allow(dead_code)]
#[allow(non_snake_case)]
#[derive(Debug, Clone, Deserialize)]
pub struct RealtimeEvent {
    pub t: String,
    #[serde(default)]
    pub message: Option<Value>,
    #[serde(default)]
    pub userId: Option<i64>,
    #[serde(default)]
    pub channelId: Option<i64>,
    #[serde(default)]
    pub conversationId: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
    /// Payload bruto para eventos não tipados.
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

#[allow(dead_code)]
#[derive(Debug)]
pub enum RealtimeMessage {
    Connected,
    Disconnected(String),
    Event(RealtimeEvent),
}

pub struct Realtime {
    url: String,
    token: String,
}

impl Realtime {
    pub fn new(url: String, token: String) -> Self {
        Self { url, token }
    }

    /// Conecta e spawna a task de leitura. Reconnecta com backoff.
    pub fn spawn(&self, tx: mpsc::UnboundedSender<RealtimeMessage>) {
        let url = self.url.clone();
        let token = self.token.clone();
        tokio::spawn(async move {
            let mut backoff_ms: u64 = 1_000;
            loop {
                match connect_once(&url, &token, &tx).await {
                    Ok(()) => {
                        backoff_ms = 1_000; // reset após conexão estável
                    }
                    Err(e) => {
                        let _ = tx.send(RealtimeMessage::Disconnected(e.to_string()));
                    }
                }
                tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
                backoff_ms = (backoff_ms * 2).min(30_000);
            }
        });
    }
}

async fn connect_once(
    url: &str,
    token: &str,
    tx: &mpsc::UnboundedSender<RealtimeMessage>,
) -> Result<()> {
    let mut request = url
        .into_client_request()
        .map_err(|e| anyhow!("URL de WebSocket inválida: {e}"))?;
    // O WS do Nexora valida o cookie; para o CLI enviamos o token como
    // Bearer — o servidor aceita via middleware de auth no upgrade.
    let headers = request.headers_mut();
    headers.insert(
        "Authorization",
        format!("Bearer {token}")
            .parse()
            .map_err(|_| anyhow!("token inválido"))?,
    );

    let (ws, _resp) = connect_async(request)
        .await
        .map_err(|e| anyhow!("falha ao conectar: {e}"))?;

    let _ = tx.send(RealtimeMessage::Connected);

    let (mut sink, mut stream) = ws.split();

    // Ping periódico para manter a conexão viva (o servidor derruba ociosos).
    let (ping_tx, mut ping_rx) = mpsc::channel::<()>(1);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(25));
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if sink.send(WsMessage::Ping(vec![])).await.is_err() {
                        break;
                    }
                }
                _ = ping_rx.recv() => break,
            }
        }
    });

    while let Some(msg) = stream.next().await {
        match msg {
            Ok(WsMessage::Text(text)) => {
                if let Ok(ev) = serde_json::from_str::<RealtimeEvent>(&text) {
                    let _ = tx.send(RealtimeMessage::Event(ev));
                }
            }
            Ok(WsMessage::Pong(_)) | Ok(WsMessage::Ping(_)) => continue,
            Ok(_) => continue,
            Err(e) => {
                drop(ping_tx);
                return Err(anyhow!("conexão perdida: {e}"));
            }
        }
    }
    drop(ping_tx);
    Err(anyhow!("servidor encerrou a conexão"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn parses_message_new_event() {
        let raw = serde_json::json!({
            "t": "message:new",
            "message": {
                "id": 42,
                "conversationId": 1,
                "author": { "id": 2, "name": "GalLoyalitat" },
                "content": "Oii, você está aí?"
            }
        });
        let ev: RealtimeEvent = serde_json::from_value(raw).unwrap();
        assert_eq!(ev.t, "message:new");
        let msg = ev.message.unwrap();
        assert_eq!(msg["content"], "Oii, você está aí?");
        assert_eq!(msg["author"]["name"], "GalLoyalitat");
    }

    #[tokio::test]
    async fn parses_presence_event() {
        let raw = serde_json::json!({ "t": "presence", "userId": 7, "status": "online" });
        let ev: RealtimeEvent = serde_json::from_value(raw).unwrap();
        assert_eq!(ev.t, "presence");
        assert_eq!(ev.userId, Some(7));
        assert_eq!(ev.status.as_deref(), Some("online"));
    }
}
