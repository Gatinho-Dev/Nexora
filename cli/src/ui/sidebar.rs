//! Sidebar — logo, atalhos, lista de DMs com avatar textual, presença,
//! preview da última mensagem e indicador de não lidas.

use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
    Frame,
};

use crate::app::{App, View};
use crate::theme::Theme;

pub fn draw(f: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    let bg = Style::new().bg(theme.sidebar);
    f.render_widget(Block::default().style(bg), area);

    // Logo
    let logo_area = Rect { height: 3, ..area };
    let rest = Rect { y: area.y + 3, height: area.height.saturating_sub(3), ..area };

    let logo = Paragraph::new(vec![
        Line::from(Span::styled(
            "  ╭─╮ ",
            Style::new().fg(theme.accent).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            "  ╰─╯  NEXORA",
            Style::new().fg(theme.accent).add_modifier(Modifier::BOLD),
        )),
    ]);
    f.render_widget(logo, logo_area);

    let inner_h = rest.height.saturating_sub(2);
    let shortcuts_h = 4.min(inner_h);
    let (top, bottom) = if inner_h > shortcuts_h {
        (
            Rect { height: shortcuts_h, ..rest },
            Rect { y: rest.y + shortcuts_h, height: inner_h - shortcuts_h, ..rest },
        )
    } else {
        (rest, rest)
    };

    let friends_active = app.view == View::Friends;
    let servers_active = app.view == View::Servers;
    // Zonas clicáveis dos atalhos (linhas do bloco de atalhos).
    // top tem 4 linhas: separador + Amigos + Servidores (+ padding).
    crate::mouse::register(crate::mouse::HitZone {
        row: top.y + 1,
        col: top.x,
        width: top.width,
        kind: crate::mouse::ZoneKind::ShortcutFriends,
    });
    crate::mouse::register(crate::mouse::HitZone {
        row: top.y + 2,
        col: top.x,
        width: top.width,
        kind: crate::mouse::ZoneKind::ShortcutServers,
    });
    let shortcuts = Paragraph::new(vec![
        Line::from(Span::styled(
            "  ─────────────",
            Style::new().fg(theme.border),
        )),
        Line::from(Span::styled(
            if friends_active { "  ◆ Amigos" } else { "  ◇ Amigos" },
            if friends_active {
                Style::new().fg(theme.text).add_modifier(Modifier::BOLD)
            } else {
                theme.style_muted()
            },
        )),
        Line::from(Span::styled(
            if servers_active { "  ◆ Servidores" } else { "  ◇ Servidores" },
            if servers_active {
                Style::new().fg(theme.text).add_modifier(Modifier::BOLD)
            } else {
                theme.style_muted()
            },
        )),
    ]);
    f.render_widget(shortcuts, top);

    // ── DMs ──────────────────────────────────────────────────
    let block = Block::default()
        .borders(Borders::TOP)
        .border_style(theme.style_border(false))
        .title(" MENSAGENS DIRETAS ")
        .title_style(Style::new().fg(theme.muted));
    let list_area = block.inner(bottom);
    f.render_widget(block, bottom);

    let convs = app.visible_conversations();
    if convs.is_empty() {
        f.render_widget(
            Paragraph::new("  Nenhuma conversa").style(theme.style_muted()),
            list_area,
        );
    } else {
        let mut lines: Vec<Line> = Vec::new();
        let visible = list_area.height as usize;
        let sel = app.dm_selected.min(convs.len().saturating_sub(1));
        let start = if convs.len() <= visible {
            0
        } else {
            sel.saturating_sub(visible / 2).min(convs.len() - visible)
        };
        for (i, c) in convs.iter().enumerate().skip(start).take(visible) {
            let name = c.display_name(app.my_id);
            let initial = c.initial(app.my_id);
            let unread = app.unread.get(&c.id).copied().unwrap_or(0);
            let selected = i == sel && app.view == View::Chat;
            let is_open = app.open_conversation == Some(c.id);

            let online = c
                .members
                .iter()
                .filter(|m| m.id != app.my_id)
                .find_map(|m| app.online.get(&m.id).copied())
                .unwrap_or(false);
            let dot = if online { "●" } else { "○" };
            let dot_style = if online {
                theme.style_online()
            } else {
                theme.style_muted()
            };

            let name_style = if unread > 0 {
                Style::new().fg(theme.unread).add_modifier(Modifier::BOLD)
            } else if selected || is_open {
                Style::new().fg(theme.text)
            } else {
                theme.style_text()
            };

            let avatar_style = if selected || is_open {
                Style::new()
                    .fg(theme.accent)
                    .add_modifier(Modifier::BOLD)
            } else {
                theme.style_accent()
            };

            let width = list_area.width as usize;
            let preview = c
                .lastMessage
                .as_ref()
                .and_then(|m| m.content.clone())
                .map(|s| {
                    truncate(
                        &s.replace('\n', " "),
                        width.saturating_sub(name.chars().count() + 8),
                    )
                })
                .unwrap_or_default();

            let badge = if unread > 0 {
                Span::styled(
                    format!(" {unread} "),
                    Style::new().bg(theme.unread).fg(theme.background),
                )
            } else {
                Span::raw("   ")
            };

            lines.push(Line::from(vec![
                Span::styled(if selected || is_open { "▶" } else { " " }, theme.style_accent()),
                Span::styled(format!(" {dot} "), dot_style),
                Span::styled(format!("[{initial}] "), avatar_style),
                Span::styled(truncate(&name, 14), name_style),
                badge,
            ]));
            // Zona clicável da DM (linha do nome).
            crate::mouse::register(crate::mouse::HitZone {
                row: list_area.y + (lines.len() as u16) - 1,
                col: list_area.x,
                width: list_area.width,
                kind: crate::mouse::ZoneKind::Conversation(i),
            });
            if !preview.is_empty() && list_area.height > 4 {
                lines.push(Line::from(Span::styled(
                    format!("     {preview}"),
                    theme.style_muted(),
                )));
            }
        }
        f.render_widget(Paragraph::new(lines), list_area);
    }

    // Usuário atual no rodapé da sidebar.
    if area.height > 10 {
        if let Some(me) = &app.me {
            let name = me.name.clone().unwrap_or_else(|| "—".into());
            let user_area = Rect {
                y: area.bottom().saturating_sub(3),
                height: 3,
                ..area
            };
            let user_line = Paragraph::new(vec![
                Line::from(Span::styled(
                    "  ─────────────",
                    Style::new().fg(theme.border),
                )),
                Line::from(vec![
                    Span::styled(" ● ", theme.style_online()),
                    Span::styled(truncate(&name, 18), theme.style_text()),
                ]),
            ]);
            f.render_widget(user_line, user_area);
        }
    }
}

/// Trunca com ellipsis.
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
