//! Modelos de dados do Nexora CLI — espelham os DTOs devolvidos pelas
//! queries tRPC do Nexora Web (`friend.list`, `dm.list`, `message.list`,
//! `server.list`, `auth.me`). Campos que o CLI não usa são ignorados
//! com `#[serde(default)]`/`flatten` para tolerar evoluções da API.

#![allow(non_snake_case, dead_code)]

use serde::Deserialize;

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
    pub userId: i64,
    #[serde(default)]
    pub user: Option<ConversationUser>,
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
    #[serde(default)]
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
            .filter(|m| m.userId != my_id)
            .find_map(|m| {
                m.user.as_ref().and_then(|u| {
                    u.name.clone().or_else(|| u.username.clone())
                })
            })
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
                    userId: 1,
                    user: Some(ConversationUser {
                        id: 1,
                        name: Some("Eu".into()),
                        username: None,
                        avatar: None,
                        status: None,
                    }),
                },
                ConversationMember {
                    userId: 2,
                    user: Some(ConversationUser {
                        id: 2,
                        name: Some("GalLoyalitat".into()),
                        username: None,
                        avatar: None,
                        status: None,
                    }),
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
