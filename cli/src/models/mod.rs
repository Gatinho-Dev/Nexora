//! Modelos de dados do Nexora CLI — espelham os DTOs devolvidos pelas
//! queries tRPC do Nexora Web (`friend.list`, `dm.list`, `message.list`,
//! `server.list`, `auth.me`). Campos que o CLI não usa são ignorados
//! com `#[serde(default)]`/`flatten` para tolerar evoluções da API.

#![allow(non_snake_case, dead_code)]

use serde::Deserialize;
use serde_json::Value;

/// Usuário resumido (auth.me e presença).
#[allow(dead_code)]
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize, Default)]
pub struct User {
    pub id: i64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

/// Item da lista de amigos (friend.list).
/// Shape real da API: { friendshipId, user: {...}, status, direction }.
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct Friend {
    pub id: i64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    /// accepted | pending_in | pending_out | blocked
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub online: Option<bool>,
    /// Campos crus da API (usados no from_api).
    #[serde(default)]
    pub friendshipId: Option<i64>,
    #[serde(default)]
    pub user: Option<User>,
    #[serde(default)]
    pub direction: Option<String>,
}

impl Friend {
    /// Normaliza o shape da API (user aninhado) para o modelo plano.
    pub fn from_api(v: Value) -> Option<Friend> {
        let mut obj = v;
        // A API não manda `id` no topo — copia do `user.id`.
        if obj.get("id").is_none() {
            if let Some(uid) = obj.get("user").and_then(|u| u.get("id")).cloned() {
                obj["id"] = uid;
            }
        }
        let mut f: Friend = serde_json::from_value(obj).ok()?;
        if let Some(u) = f.user.take() {
            f.id = u.id;
            f.name = u.name;
            f.username = u.username;
            f.avatar = u.avatar;
        }
        Some(f)
    }
}

/// Conversa (dm.list) — DM em grupo ou 1:1.
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct Conversation {
    pub id: i64,
    /// direct | group
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub members: Vec<ConversationMember>,
    #[serde(default)]
    pub lastMessage: Option<LastMessage>,
    #[serde(default)]
    pub unreadCount: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct ConversationMember {
    /// Shape real da API: o usuário vem direto no member ({id, name, ...}).
    pub id: i64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct ConversationUser {
    pub id: i64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct LastMessage {
    pub id: i64,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub authorId: Option<i64>,
    #[serde(default)]
    pub createdAt: Option<String>,
}

/// Mensagem do histórico (message.list) e do realtime (message:new).
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct Message {
    pub id: i64,
    /// channelId OU conversationId (o outro lado vem nulo).
    #[serde(default)]
    pub channelId: Option<i64>,
    #[serde(default)]
    pub conversationId: Option<i64>,
    pub author: MessageAuthor,
    pub content: String,
    #[serde(default)]
    pub createdAt: Option<String>,
    #[serde(default)]
    pub editedAt: Option<String>,
    /// Anexos não são baixados — só sinalizamos a presença.
    #[serde(default)]
    pub attachments: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    pub replyToId: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct MessageAuthor {
    pub id: i64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
}

/// Servidor (server.list).
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct Server {
    pub id: i64,
    pub name: String,
    /// A API manda iconUrl; mantemos "icon" como alias.
    #[serde(default, alias = "icon")]
    pub icon: Option<String>,
    #[serde(default)]
    pub unreadCount: Option<i64>,
}

/// Canal (server.channels ou equivalente).
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct Channel {
    pub id: i64,
    pub name: String,
    /// TEXT | VOICE | STAGE | FORUM
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub categoryId: Option<i64>,
    #[serde(default)]
    pub topic: Option<String>,
}

/// Evento "ready" do WebSocket — contém o id do usuário conectado.
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct ReadyEvent {
    #[serde(default)]
    pub userId: i64,
}

impl Conversation {
    /// Nome de exibição: nome do grupo ou o outro membro da DM 1:1.
    pub fn display_name(&self, my_id: i64) -> String {
        if let Some(name) = &self.name {
            if !name.is_empty() {
                return name.clone();
            }
        }
        self.members
            .iter()
            .filter(|m| m.id != my_id)
            .find_map(|m| m.name.clone().or_else(|| m.username.clone()))
            .unwrap_or_else(|| "Conversa".to_string())
    }

    /// Inicial para o avatar textual.
    pub fn initial(&self, my_id: i64) -> char {
        self.display_name(my_id)
            .chars()
            .next()
            .unwrap_or('?')
            .to_ascii_uppercase()
    }
}

impl Friend {
    pub fn display_name(&self) -> String {
        self.name
            .clone()
            .or_else(|| self.username.clone())
            .unwrap_or_else(|| "Usuário".to_string())
    }

    pub fn handle(&self) -> String {
        self.username
            .clone()
            .map(|u| format!("@{u}"))
            .unwrap_or_default()
    }

    pub fn initial(&self) -> char {
        self.display_name()
            .chars()
            .next()
            .unwrap_or('?')
            .to_ascii_uppercase()
    }

    pub fn is_accepted(&self) -> bool {
        self.status.as_deref().unwrap_or("accepted") == "accepted"
    }

    pub fn is_pending(&self) -> bool {
        matches!(self.status.as_deref(), Some("pending_in" | "pending_out"))
    }

    pub fn is_blocked(&self) -> bool {
        self.status.as_deref() == Some("blocked")
    }
}

impl Message {
    /// Texto exibível: anexos viram placeholders "[Imagem enviada]" etc.
    pub fn display_content(&self) -> String {
        let mut parts: Vec<String> = Vec::new();
        let content = self.content.trim();
        if !content.is_empty() {
            parts.push(content.to_string());
        }
        if let Some(atts) = &self.attachments {
            for a in atts {
                let kind = a
                    .get("kind")
                    .and_then(|k| k.as_str())
                    .or_else(|| a.get("mime").and_then(|m| m.as_str()));
                let label = match kind {
                    Some(k) if k.starts_with("image") => "[Imagem enviada]",
                    Some(k) if k.starts_with("video") => "[Vídeo enviado]",
                    Some(k) if k.starts_with("audio") => "[Áudio enviado]",
                    _ => "[Arquivo enviado]",
                };
                parts.push(label.to_string());
            }
        }
        if parts.is_empty() {
            "[Mensagem vazia]".to_string()
        } else {
            parts.join("\n")
        }
    }

    /// Destinatário: conversa ou canal.
    #[allow(dead_code)]
    pub fn room(&self) -> (Option<i64>, Option<i64>) {
        (self.channelId, self.conversationId)
    }
}

#[cfg(test)]
mod tests {
    /// Shape EXATO devolvido pela API de produção (verificado via curl):
    /// friend.list manda o usuário aninhado em `user`, não no topo.
    #[test]
    fn parses_real_friend_list_shape() {
        let item = serde_json::json!({
            "friendshipId": 1,
            "user": { "id": 2, "username": "AqueleManoRotiv", "name": "Rotiv", "avatar": "/api/files/2060008" },
            "status": "accepted",
            "direction": "outgoing"
        });
        let f = Friend::from_api(item).expect("Friend::from_api deve parsear o shape real");
        assert_eq!(f.id, 2);
        assert_eq!(f.name.as_deref(), Some("Rotiv"));
        assert_eq!(f.status.as_deref(), Some("accepted"));
    }

    #[test]
    fn parses_real_dm_member_shape() {
        let raw = serde_json::json!({
            "id": 2, "isGroup": false,
            "members": [{ "id": 1, "username": "Lobo_2033", "name": "Gatinho", "avatar": "/api/files/1" }]
        });
        let c: Conversation = serde_json::from_value(raw).expect("Conversation deve parsear o shape real da API");
        assert_eq!(c.members[0].id, 1);
        assert_eq!(c.display_name(99), "Gatinho");
    }

    use super::*;

    #[test]
    fn conversation_display_name_prefers_group_name() {
        let c = Conversation {
            id: 1,
            kind: Some("group".into()),
            name: Some("Grupo de testes".into()),
            members: vec![],
            lastMessage: None,
            unreadCount: None,
        };
        assert_eq!(c.display_name(99), "Grupo de testes");
        assert_eq!(c.initial(99), 'G');
    }

    #[test]
    fn conversation_dm_uses_other_member() {
        let c = Conversation {
            id: 2,
            kind: Some("direct".into()),
            name: None,
            members: vec![
                ConversationMember {
                    id: 1,
                    name: Some("Eu".into()),
                    username: None,
                    avatar: None,
                    status: None,
                },
                ConversationMember {
                    id: 2,
                    name: Some("GalLoyalitat".into()),
                    username: None,
                    avatar: None,
                    status: None,
                },
            ],
            lastMessage: None,
            unreadCount: None,
        };
        assert_eq!(c.display_name(1), "GalLoyalitat");
        assert_eq!(c.initial(1), 'G');
    }

    #[test]
    fn message_attachments_become_placeholders() {
        let m = Message {
            id: 1,
            channelId: None,
            conversationId: Some(1),
            author: MessageAuthor {
                id: 2,
                name: Some("Alguém".into()),
                username: None,
                avatar: None,
            },
            content: "olha isso".into(),
            createdAt: None,
            editedAt: None,
            attachments: Some(vec![
                serde_json::json!({"mime": "image/png"}),
                serde_json::json!({"mime": "video/mp4"}),
                serde_json::json!({"mime": "application/pdf"}),
            ]),
            replyToId: None,
        };
        let d = m.display_content();
        assert!(d.contains("olha isso"));
        assert!(d.contains("[Imagem enviada]"));
        assert!(d.contains("[Vídeo enviado]"));
        assert!(d.contains("[Arquivo enviado]"));
    }

    #[test]
    fn friend_status_helpers() {
        let f = |status: Option<&str>| Friend {
            id: 1,
            name: Some("Rotiv".into()),
            username: Some("AqueleManoRotiv".into()),
            avatar: None,
            friendshipId: None,
            user: None,
            direction: None,
            status: status.map(|s| s.to_string()),
            online: Some(true),
        };
        assert!(f(Some("accepted")).is_accepted());
        assert!(f(Some("pending_in")).is_pending());
        assert!(f(Some("pending_out")).is_pending());
        assert!(f(Some("blocked")).is_blocked());
        assert_eq!(f(None).handle(), "@AqueleManoRotiv");
        assert_eq!(f(None).initial(), 'R');
    }
}
