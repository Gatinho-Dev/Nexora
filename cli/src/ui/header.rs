//! Header da área central — título da tela/contato e presença.

use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::{App, View};
use crate::theme::Theme;

pub fn draw(f: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    let title = match app.view {
        View::Friends => "Amigos".to_string(),
        View::Servers => "Servidores".to_string(),
        View::Settings => "Configurações".to_string(),
        View::Chat => {
            if let Some(cid) = app.open_conversation {
                app.conversations
                    .iter()
                    .find(|c| c.id == cid)
                    .map(|c| {
                        let name = c.display_name(app.my_id);
                        let other = c
                            .members
                            .iter()
                            .filter(|m| m.userId != app.my_id)
                            .find_map(|m| m.user.as_ref());
                        match other.and_then(|u| u.username.clone()) {
                            Some(h) => format!("{name}  @{h}"),
                            None => name,
                        }
                    })
                    .unwrap_or_else(|| "Conversa".into())
            } else if let Some(chid) = app.open_channel {
                app.channels
                    .iter()
                    .find(|c| c.id == chid)
                    .map(|c| format!("# {}", c.name))
                    .unwrap_or_else(|| "Canal".into())
            } else {
                "Chat".into()
            }
        }
    };

    // Presença do contato (DM 1:1).
    let presence: Option<Span> = if let Some(cid) = app.open_conversation {
        app.conversations
            .iter()
            .find(|c| c.id == cid)
            .and_then(|c| {
                c.members
                    .iter()
                    .filter(|m| m.userId != app.my_id)
                    .find_map(|m| app.online.get(&m.userId).copied())
            })
            .map(|online| {
                if online {
                    Span::styled("● online", theme.style_online())
                } else {
                    Span::styled("○ offline", theme.style_muted())
                }
            })
    } else {
        None
    };

    let mut spans = vec![
        Span::styled("← ", theme.style_muted()),
        Span::styled(title, Style::new().fg(theme.text).add_modifier(Modifier::BOLD)),
    ];
    if let Some(p) = presence {
        spans.push(Span::raw("   "));
        spans.push(p);
    }

    f.render_widget(Paragraph::new(Line::from(spans)), area);
}
