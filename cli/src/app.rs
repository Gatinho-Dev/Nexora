//! Estado central da aplicação Nexora CLI.
//!
//! Guarda o que a TUI precisa renderizar: dados carregados da API,
//! navegação (tela ativa, seleção), input de mensagem, notificações e
//! estado de conexão. Toda mutação passa por métodos — a renderização
//! é função pura do estado.

use crate::models::{Channel, Conversation, Friend, Message, Server, User};
use std::collections::HashMap;

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum View {
    /// Tela de amigos com abas (Todos/Online/Pendentes/Bloqueados).
    Friends,
    /// Conversa aberta (DM ou canal de servidor).
    Chat,
    /// Lista de servidores e canais.
    Servers,
    /// Configurações.
    Settings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FriendTab {
    All,
    Online,
    Pending,
    Blocked,
}

impl FriendTab {
    pub const ALL: [FriendTab; 4] = [
        FriendTab::All,
        FriendTab::Online,
        FriendTab::Pending,
        FriendTab::Blocked,
    ];

    pub fn label(self) -> &'static str {
        match self {
            FriendTab::All => "Todos",
            FriendTab::Online => "Online",
            FriendTab::Pending => "Pendentes",
            FriendTab::Blocked => "Bloqueados",
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Connection {
    Connected,
    Connecting,
    Disconnected,
}

/// `Settings` é usado quando as configurações virarem popup completo.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum Popup {
    None,
    /// Busca global (Ctrl+K).
    Search,
    /// Erro amigável com botão OK.
    Error(String),
    /// Informação/aviso com botão OK.
    Info(String),
    /// Ajuda com atalhos.
    Help,
    /// Configurações sobrepostas.
    Settings,
}

/// Foco interno dentro de uma tela de chat.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChatFocus {
    History,
    Input,
}

#[allow(dead_code)]
pub struct App {
    pub me: Option<User>,
    pub friends: Vec<Friend>,
    pub conversations: Vec<Conversation>,
    pub servers: Vec<Server>,
    /// Canais do servidor aberto no momento.
    pub channels: Vec<Channel>,
    pub open_server: Option<i64>,

    pub view: View,
    pub friend_tab: FriendTab,
    pub friend_selected: usize,
    pub friend_query: String,
    pub dm_selected: usize,

    /// Histórico da conversa/canal aberto, mais antigo primeiro.
    pub messages: Vec<Message>,
    pub open_conversation: Option<i64>,
    pub open_channel: Option<i64>,
    pub chat_focus: ChatFocus,
    pub input: String,
    pub history_scroll: u16,

    /// Unread por conversa/canal (id → contagem).
    pub unread: HashMap<i64, i64>,
    /// Presença online por userId.
    pub online: HashMap<i64, bool>,

    pub connection: Connection,
    pub popup: Popup,
    /// Toast temporário (mensagem, epoch de expiração ms).
    pub toast: Option<(String, u64)>,
    /// Query da busca global.
    pub search_query: String,
    pub search_selected: usize,
    pub settings_selected: usize,
    pub status_message: Option<String>,
    /// Indicador de atualização disponível (versão nova).
    pub update_available: Option<String>,

    pub my_id: i64,
    pub should_quit: bool,
}

impl App {
    pub fn new() -> Self {
        Self {
            me: None,
            friends: Vec::new(),
            conversations: Vec::new(),
            servers: Vec::new(),
            channels: Vec::new(),
            open_server: None,
            view: View::Friends,
            friend_tab: FriendTab::All,
            friend_selected: 0,
            friend_query: String::new(),
            dm_selected: 0,
            messages: Vec::new(),
            open_conversation: None,
            open_channel: None,
            chat_focus: ChatFocus::Input,
            input: String::new(),
            history_scroll: 0,
            unread: HashMap::new(),
            online: HashMap::new(),
            connection: Connection::Connecting,
            popup: Popup::None,
            toast: None,
            search_query: String::new(),
            search_selected: 0,
            settings_selected: 0,
            status_message: None,
            update_available: None,
            my_id: 0,
            should_quit: false,
        }
    }

    // ── Navegação ────────────────────────────────────────────

    pub fn open_conversation_chat(&mut self, conversation_id: i64) {
        self.open_conversation = Some(conversation_id);
        self.open_channel = None;
        self.view = View::Chat;
        self.chat_focus = ChatFocus::Input;
        self.messages.clear();
        self.history_scroll = 0;
        if let Some(_c) = self.conversations.iter().find(|c| c.id == conversation_id) {
            self.unread.remove(&conversation_id);
        }
    }

    pub fn open_channel_chat(&mut self, channel_id: i64) {
        self.open_channel = Some(channel_id);
        self.open_conversation = None;
        self.view = View::Chat;
        self.chat_focus = ChatFocus::Input;
        self.messages.clear();
        self.history_scroll = 0;
        self.unread.remove(&channel_id);
    }

    pub fn back(&mut self) {
        match self.view {
            View::Chat => {
                if self.open_channel.is_some() {
                    self.view = View::Servers;
                } else {
                    self.view = View::Friends;
                }
                self.open_conversation = None;
                self.open_channel = None;
                self.messages.clear();
                self.input.clear();
            }
            View::Servers => self.view = View::Friends,
            View::Settings => self.view = View::Friends,
            View::Friends => {}
        }
    }

    // ── Amigos ───────────────────────────────────────────────

    /// Amigos filtrados pela aba ativa + campo de busca (fuzzy simples).
    pub fn visible_friends(&self) -> Vec<&Friend> {
        let q = self.friend_query.to_lowercase();
        self.friends
            .iter()
            .filter(|f| match self.friend_tab {
                FriendTab::All => f.is_accepted(),
                FriendTab::Online => {
                    f.is_accepted() && self.online.get(&f.id).copied().unwrap_or(false)
                }
                FriendTab::Pending => f.is_pending(),
                FriendTab::Blocked => f.is_blocked(),
            })
            .filter(|f| {
                if q.is_empty() {
                    true
                } else {
                    let name = f.display_name().to_lowercase();
                    let handle = f.handle().to_lowercase();
                    fuzzy_match(&name, &q) || fuzzy_match(&handle, &q)
                }
            })
            .collect()
    }

    pub fn move_friend_selection(&mut self, delta: i32) {
        let len = self.visible_friends().len();
        if len == 0 {
            return;
        }
        let current = self.friend_selected as i32;
        let next = (current + delta).rem_euclid(len as i32);
        self.friend_selected = next as usize;
    }

    // ── DMs (sidebar) ────────────────────────────────────────

    pub fn visible_conversations(&self) -> Vec<&Conversation> {
        self.conversations.iter().collect()
    }

    #[allow(dead_code)]
    pub fn move_dm_selection(&mut self, delta: i32) {
        let len = self.visible_conversations().len();
        if len == 0 {
            return;
        }
        let current = self.dm_selected as i32;
        let next = (current + delta).rem_euclid(len as i32);
        self.dm_selected = next as usize;
    }

    // ── Chat ─────────────────────────────────────────────────

    pub fn push_message(&mut self, msg: Message) {
        // Dedup por id (realtime + resposta do send podem coincidir).
        if self.messages.iter().any(|m| m.id == msg.id) {
            return;
        }
        self.messages.push(msg);
        self.history_scroll = 0; // volta pro fim (scroll ancorado no fim)
    }

    pub fn scroll_history(&mut self, delta: u16) {
        self.history_scroll = self.history_scroll.saturating_add(delta);
    }

    // ── Notificações ─────────────────────────────────────────

    pub fn notify_new_message(&mut self, conversation_id: Option<i64>, channel_id: Option<i64>, author: &str, preview: &str) {
        let id = conversation_id.or(channel_id);
        if let Some(id) = id {
            let is_open = (self.open_conversation == Some(id))
                || (self.open_channel == Some(id));
            if !is_open {
                *self.unread.entry(id).or_insert(0) += 1;
            }
        }
        let _ = (author, preview);
    }

    pub fn show_toast(&mut self, text: impl Into<String>, now_ms: u64, ttl_ms: u64) {
        self.toast = Some((text.into(), now_ms + ttl_ms));
    }

    pub fn tick_toast(&mut self, now_ms: u64) {
        if let Some((_, expires)) = &self.toast {
            if now_ms >= *expires {
                self.toast = None;
            }
        }
    }

    // ── Busca global ─────────────────────────────────────────

    /// Resultados da busca fuzzy sobre amigos, DMs e canais.
    pub fn search_results(&self) -> Vec<SearchResult> {
        let q = self.search_query.to_lowercase();
        if q.is_empty() {
            return Vec::new();
        }
        let mut out = Vec::new();

        for f in &self.friends {
            if !f.is_accepted() {
                continue;
            }
            let name = f.display_name();
            if fuzzy_match(&name.to_lowercase(), &q) {
                out.push(SearchResult {
                    label: name,
                    detail: f.handle(),
                    kind: SearchResultKind::Friend,
                    id: f.id,
                });
            }
        }
        for c in &self.conversations {
            let name = c.display_name(self.my_id);
            if fuzzy_match(&name.to_lowercase(), &q) {
                out.push(SearchResult {
                    label: name,
                    detail: "mensagem direta".into(),
                    kind: SearchResultKind::Conversation,
                    id: c.id,
                });
            }
        }
        for s in &self.servers {
            if fuzzy_match(&s.name.to_lowercase(), &q) {
                out.push(SearchResult {
                    label: s.name.clone(),
                    detail: "servidor".into(),
                    kind: SearchResultKind::Server,
                    id: s.id,
                });
            }
        }
        for ch in &self.channels {
            if fuzzy_match(&ch.name.to_lowercase(), &q) {
                out.push(SearchResult {
                    label: format!("#{}", ch.name),
                    detail: "canal".into(),
                    kind: SearchResultKind::Channel,
                    id: ch.id,
                });
            }
        }
        out.truncate(20);
        out
    }

    pub fn move_search_selection(&mut self, delta: i32) {
        let len = self.search_results().len();
        if len == 0 {
            self.search_selected = 0;
            return;
        }
        let next = (self.search_selected as i32 + delta).rem_euclid(len as i32);
        self.search_selected = next as usize;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchResultKind {
    Friend,
    Conversation,
    Server,
    Channel,
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub label: String,
    pub detail: String,
    pub kind: SearchResultKind,
    pub id: i64,
}

/// Fuzzy match simples: todos os chars da query em ordem no alvo.
pub fn fuzzy_match(target: &str, query: &str) -> bool {
    let mut ti = 0;
    let tchars: Vec<char> = target.chars().collect();
    for qc in query.chars() {
        let mut found = false;
        while ti < tchars.len() {
            if tchars[ti] == qc {
                found = true;
                ti += 1;
                break;
            }
            ti += 1;
        }
        if !found {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn friend(id: i64, name: &str, status: &str) -> Friend {
        Friend {
            id,
            name: Some(name.into()),
            username: None,
            avatar: None,
            status: Some(status.into()),
            online: Some(true),
        }
    }

    #[test]
    fn friend_tabs_filter_correctly() {
        let mut app = App::new();
        app.friends = vec![
            friend(1, "Rotiv", "accepted"),
            friend(2, "Gabri", "pending_in"),
            friend(3, "Devx", "blocked"),
        ];
        app.friend_tab = FriendTab::All;
        assert_eq!(app.visible_friends().len(), 1);
        app.friend_tab = FriendTab::Pending;
        assert_eq!(app.visible_friends().len(), 1);
        app.friend_tab = FriendTab::Blocked;
        assert_eq!(app.visible_friends().len(), 1);
        app.friend_tab = FriendTab::Online;
        app.online.insert(1, true);
        assert_eq!(app.visible_friends().len(), 1);
        app.online.remove(&1);
        assert_eq!(app.visible_friends().len(), 0);
    }

    #[test]
    fn friend_query_filters_fuzzy() {
        let mut app = App::new();
        app.friends = vec![friend(1, "GalLoyalitat", "accepted")];
        app.friend_query = "glt".into();
        assert_eq!(app.visible_friends().len(), 1);
        app.friend_query = "zzz".into();
        assert_eq!(app.visible_friends().len(), 0);
    }

    #[test]
    fn unread_increments_only_for_closed_chats() {
        let mut app = App::new();
        app.open_conversation = Some(5);
        app.notify_new_message(Some(5), None, "a", "b");
        assert!(!app.unread.contains_key(&5));
        app.notify_new_message(Some(7), None, "a", "b");
        app.notify_new_message(Some(7), None, "a", "b");
        assert_eq!(app.unread.get(&7), Some(&2));
    }

    #[test]
    fn push_message_dedups_by_id() {
        let mut app = App::new();
        let m = |id: i64| Message {
            id,
            channelId: None,
            conversationId: Some(1),
            author: crate::models::MessageAuthor {
                id: 2,
                name: Some("a".into()),
                username: None,
                avatar: None,
            },
            content: "x".into(),
            createdAt: None,
            editedAt: None,
            attachments: None,
            replyToId: None,
        };
        app.push_message(m(1));
        app.push_message(m(1));
        app.push_message(m(2));
        assert_eq!(app.messages.len(), 2);
    }

    #[test]
    fn fuzzy_match_basic() {
        assert!(fuzzy_match("galloyalitat", "glt"));
        assert!(fuzzy_match("nexora", "nxr"));
        assert!(!fuzzy_match("abc", "az"));
        assert!(fuzzy_match("abc", ""));
    }

    #[test]
    fn selection_wraps() {
        let mut app = App::new();
        app.friends = vec![friend(1, "a", "accepted"), friend(2, "b", "accepted")];
        app.friend_selected = 1;
        app.move_friend_selection(1);
        assert_eq!(app.friend_selected, 0);
        app.move_friend_selection(-1);
        assert_eq!(app.friend_selected, 1);
    }
}
