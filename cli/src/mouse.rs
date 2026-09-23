//! Suporte a mouse: zonas clicáveis registradas durante o render e
//! resolução de clique por posição (row, col).

use crate::app::App;
use std::cell::RefCell;

/// Uma área clicável da interface.
#[derive(Debug, Clone, Copy)]
pub struct HitZone {
    /// Linha absoluta do terminal.
    pub row: u16,
    /// Coluna inicial.
    pub col: u16,
    /// Largura clicável.
    pub width: u16,
    pub kind: ZoneKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZoneKind {
    /// Item da sidebar de DMs (índice na lista visível).
    Conversation(usize),
    /// Atalho "Amigos" da sidebar.
    ShortcutFriends,
    /// Atalho "Servidores" da sidebar.
    ShortcutServers,
    /// Aba da tela de amigos (índice 0..4).
    FriendTab(usize),
    /// Amigo na lista da tela de amigos (índice na lista visível).
    Friend(usize),
    /// Canal de texto na view de servidores.
    Channel(i64),
}

thread_local! {
    /// Zonas registradas pelo render mais recente. Ratatui renderiza em uma
    /// thread (a principal), então thread_local é suficiente e sem locks.
    static ZONES: RefCell<Vec<HitZone>> = const { RefCell::new(Vec::new()) };
}

/// Limpa as zonas (início do frame).
pub fn begin_frame() {
    ZONES.with(|z| z.borrow_mut().clear());
}

/// Registra uma zona clicável.
pub fn register(zone: HitZone) {
    ZONES.with(|z| {
        let mut list = z.borrow_mut();
        // Substitui zona duplicada (mesmo kind+row) — re-render sobrescreve.
        if let Some(slot) = list
            .iter_mut()
            .find(|existing| existing.row == zone.row && existing.kind == zone.kind)
        {
            *slot = zone;
        } else {
            list.push(zone);
        }
    });
}

/// Resolve o clique: devolve a zona cuja área contém (row, col).
pub fn hit_test(row: u16, col: u16) -> Option<ZoneKind> {
    ZONES.with(|z| {
        z.borrow()
            .iter()
            .find(|zone| {
                zone.row == row && col >= zone.col && col < zone.col.saturating_add(zone.width)
            })
            .map(|zone| zone.kind)
    })
}

/// Aplica a ação de um clique na aplicação. Devolve true se abriu chat
/// (para o chamador disparar a carga de histórico).
pub fn apply_click(app: &mut App, kind: ZoneKind) -> bool {
    match kind {
        ZoneKind::Conversation(idx) => {
            let convs = app.visible_conversations();
            if let Some(c) = convs.get(idx).copied() {
                let id = c.id;
                app.dm_selected = idx;
                app.open_conversation_chat(id);
                return true;
            }
            false
        }
        ZoneKind::ShortcutFriends => {
            app.view = crate::app::View::Friends;
            false
        }
        ZoneKind::ShortcutServers => {
            app.view = crate::app::View::Servers;
            false
        }
        ZoneKind::FriendTab(i) => {
            app.friend_tab = match i {
                0 => crate::app::FriendTab::All,
                1 => crate::app::FriendTab::Online,
                2 => crate::app::FriendTab::Pending,
                3 => crate::app::FriendTab::Blocked,
                _ => crate::app::FriendTab::All,
            };
            app.friend_selected = 0;
            false
        }
        ZoneKind::Friend(idx) => {
            let friends = app.visible_friends();
            if let Some(f) = friends.get(idx).copied() {
                let fid = f.id;
                app.friend_selected = idx;
                // Abre (ou cria) a DM com o amigo, espelhando o Enter.
                let existing = app
                    .conversations
                    .iter()
                    .find(|c| {
                        c.kind.as_deref() == Some("direct")
                            && c.members.iter().any(|m| m.id == fid)
                    })
                    .map(|c| c.id);
                match existing {
                    Some(id) => {
                        app.open_conversation_chat(id);
                        true
                    }
                    None => {
                        app.popup = crate::app::Popup::Info(
                            "Ainda não há conversa com este amigo. Envie a primeira mensagem pelo Nexora Web.".into(),
                        );
                        false
                    }
                }
            } else {
                false
            }
        }
        ZoneKind::Channel(id) => {
            let is_text = app
                .channels
                .iter()
                .find(|c| c.id == id)
                .and_then(|c| c.kind.as_deref())
                .map(|k| k == "TEXT")
                .unwrap_or(true);
            if is_text {
                app.open_channel_chat(id);
                true
            } else {
                app.popup = crate::app::Popup::Info(
                    "Canais de voz não são suportados no Nexora CLI — somente texto.".into(),
                );
                false
            }
        }
    }
}
