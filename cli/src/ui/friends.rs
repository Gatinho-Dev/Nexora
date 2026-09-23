//! Tela de amigos — abas (Todos/Online/Pendentes/Bloqueados), busca e lista.

use ratatui::{
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
    Frame,
};

use crate::app::{App, FriendTab};
use crate::theme::Theme;

pub fn draw(f: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    // Header (2 linhas) + busca (1) + lista.
    let chunks = Layout::vertical([
        Constraint::Length(2),
        Constraint::Length(1),
        Constraint::Min(0),
    ])
    .split(area);

    let header = Paragraph::new(vec![
        Line::from(Span::styled(
            "Amigos",
            Style::new().fg(theme.text).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
    ]);
    f.render_widget(header, chunks[0]);

    // Abas.
    let mut tab_spans: Vec<Span> = Vec::new();
    for tab in FriendTab::ALL {
        let active = tab == app.friend_tab;
        let count = match tab {
            FriendTab::All => app.friends.iter().filter(|f| f.is_accepted()).count(),
            FriendTab::Online => app
                .friends
                .iter()
                .filter(|f| f.is_accepted() && app.online.get(&f.id).copied().unwrap_or(false))
                .count(),
            FriendTab::Pending => app.friends.iter().filter(|f| f.is_pending()).count(),
            FriendTab::Blocked => app.friends.iter().filter(|f| f.is_blocked()).count(),
        };
        let label = if active {
            format!(" ◆ {} {count} ", tab.label())
        } else {
            format!(" ◇ {} {count} ", tab.label())
        };
        tab_spans.push(Span::styled(
            label,
            if active {
                Style::new().fg(theme.text).add_modifier(Modifier::BOLD)
            } else {
                theme.style_muted()
            },
        ));
        tab_spans.push(Span::styled("  ·  ", theme.style_border(false)));
    }
    tab_spans.push(Span::styled(
        " ＋ Adicionar amigo ",
        theme.style_accent(),
    ));
    f.render_widget(Paragraph::new(Line::from(tab_spans)), chunks[1]);

    // Busca.
    let query_disp = if app.friend_query.is_empty() {
        Span::styled("digite para buscar…", theme.style_muted())
    } else {
        Span::styled(&app.friend_query, theme.style_text())
    };
    let search = Paragraph::new(Line::from(vec![
        Span::styled(" 🔍 ", theme.style_muted()),
        query_disp,
        if app.friend_query.is_empty() {
            Span::raw("")
        } else {
            Span::styled("▏", theme.style_accent())
        },
    ]))
    .style(Style::new().bg(theme.input));
    f.render_widget(search, Rect { y: chunks[2].y, height: 1, ..chunks[2] });

    // Lista.
    let list_area = Rect {
        y: chunks[2].y + 1,
        height: chunks[2].height.saturating_sub(1),
        ..chunks[2]
    };

    let section_label = format!(
        "{} · {}",
        app.friend_tab.label().to_uppercase(),
        app.visible_friends().len()
    );
    let items_h = list_area.height as usize;
    if items_h == 0 {
        return;
    }

    let friends = app.visible_friends();
    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::from(Span::styled(section_label, theme.style_muted())));

    let visible = items_h.saturating_sub(2);
    let sel = app.friend_selected.min(friends.len().saturating_sub(1));
    let start = if friends.len() <= visible {
        0
    } else {
        sel.saturating_sub(visible / 2).min(friends.len() - visible)
    };

    for (i, fr) in friends.iter().enumerate().skip(start).take(visible) {
        let selected = i == sel;
        let online = app.online.get(&fr.id).copied().unwrap_or(false);
        let dot = if online { "●" } else { "○" };
        let dot_style = if online {
            theme.style_online()
        } else {
            theme.style_muted()
        };

        let status_suffix = match fr.status.as_deref() {
            Some("pending_in") => Span::styled("  ·  quer ser seu amigo", theme.style_accent()),
            Some("pending_out") => Span::styled("  ·  solicitação enviada", theme.style_muted()),
            Some("blocked") => Span::styled("  ·  bloqueado", theme.style_unread()),
            _ => Span::raw(""),
        };

        let line = Line::from(vec![
            Span::styled(if selected { "▶" } else { " " }, theme.style_accent()),
            Span::styled(format!(" {dot} "), dot_style),
            Span::styled(
                format!("[{}] ", fr.initial()),
                if selected {
                    Style::new().fg(theme.accent).add_modifier(Modifier::BOLD)
                } else {
                    theme.style_accent()
                },
            ),
            Span::styled(
                format!("{:<16}", truncate(&fr.display_name(), 16)),
                if selected {
                    Style::new().fg(theme.text).add_modifier(Modifier::BOLD)
                } else {
                    theme.style_text()
                },
            ),
            Span::styled(format!("{:<24}", fr.handle()), theme.style_muted()),
            Span::styled("💬", theme.style_muted()),
            status_suffix,
        ]);
        lines.push(line);
    }

    if friends.is_empty() {
        lines.push(Line::from(Span::styled(
            "  Ninguém aqui ainda.",
            theme.style_muted(),
        )));
    }

    let block = Block::default().borders(Borders::NONE);
    f.render_widget(
        Paragraph::new(lines).block(block),
        list_area,
    );
}

fn truncate(s: &str, max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    if s.chars().count() <= max {
        return s.to_string();
    }
    let taken: String = s.chars().take(max.saturating_sub(1)).collect();
    format!("{taken}…")
}
