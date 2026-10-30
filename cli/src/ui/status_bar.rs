//! Status bar inferior — atalhos, conexão e versão.

use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::{App, Connection};
use crate::theme::Theme;

pub fn draw(f: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    let conn = match app.connection {
        Connection::Connected => Span::styled("● Conectado", theme.style_online()),
        Connection::Connecting => {
            Span::styled("◐ Reconectando…", Style::new().fg(theme.idle))
        }
        Connection::Disconnected => Span::styled("○ Desconectado", theme.style_unread()),
    };

    let version = env!("CARGO_PKG_VERSION");

    let mut spans = vec![
        Span::styled(" Ctrl+K", theme.style_accent()),
        Span::styled(" Pesquisar   ", theme.style_muted()),
        Span::styled("Ctrl+D", theme.style_accent()),
        Span::styled(" DMs   ", theme.style_muted()),
        Span::styled("Ctrl+S", theme.style_accent()),
        Span::styled(" Servidores   ", theme.style_muted()),
        Span::styled("?", theme.style_accent()),
        Span::styled(" Ajuda", theme.style_muted()),
    ];

    if let Some(v) = &app.update_available {
        spans.push(Span::styled(
            format!("   ↑ v{v} disponível"),
            Style::new().fg(theme.idle),
        ));
    }

    // Empurra conexão e versão para a direita manualmente (largura fixa).
    let left_len: usize = spans.iter().map(|s| s.content.chars().count()).sum();
    let width = area.width as usize;
    let right = format!(" Nexora CLI v{version} ");
    let right_len = right.chars().count();
    let conn_len = 14; // aproximado
    let pad = width.saturating_sub(left_len + conn_len + right_len + 2);

    spans.push(Span::raw(" ".repeat(pad)));
    spans.push(conn);
    spans.push(Span::styled(
        right,
        Style::new().fg(theme.muted).add_modifier(Modifier::BOLD),
    ));

    f.render_widget(Paragraph::new(Line::from(spans)), area);
}
