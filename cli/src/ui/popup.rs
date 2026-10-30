//! Popups — busca global (Ctrl+K), erros, ajuda e toast.

use ratatui::{
    layout::{Alignment, Constraint, Layout, Rect},
    style::Style,
    text::{Line, Span},
    widgets::{Block, Borders, Clear, Paragraph, Wrap},
    Frame,
};

use crate::app::{App, Popup, SearchResultKind};
use crate::theme::Theme;

pub fn draw(f: &mut Frame, app: &App, theme: &Theme, size: Rect) {
    match &app.popup {
        Popup::None => {}
        Popup::Search => draw_search(f, app, theme, size),
        Popup::Error(msg) => draw_message(f, theme, size, "⚠ Erro", msg, theme.error),
        Popup::Info(msg) => draw_message(f, theme, size, "ℹ Nexora CLI", msg, theme.accent),
        Popup::Help => draw_help(f, theme, size),
        Popup::Settings => {}
    }

    // Toast (independente de popup).
    if let Some((text, _)) = &app.toast {
        draw_toast(f, theme, size, text);
    }
}

fn centered_rect(width: u16, height: u16, size: Rect) -> Rect {
    let w = width.min(size.width.saturating_sub(2));
    let h = height.min(size.height.saturating_sub(2));
    Rect {
        x: size.x + (size.width.saturating_sub(w)) / 2,
        y: size.y + (size.height.saturating_sub(h)) / 2,
        width: w,
        height: h,
    }
}

fn clear_and_block(f: &mut Frame, area: Rect, theme: &Theme, title: &str) {
    f.render_widget(Clear, area);
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(theme.style_border(true))
        .style(Style::new().bg(theme.panel))
        .title(format!(" {title} "))
        .title_style(theme.style_accent());
    f.render_widget(block, area);
}

fn draw_search(f: &mut Frame, app: &App, theme: &Theme, size: Rect) {
    let area = centered_rect(56, 16, size);
    clear_and_block(f, area, theme, "🔍 Pesquisar no Nexora");

    let inner = Rect {
        x: area.x + 1,
        y: area.y + 1,
        width: area.width.saturating_sub(2),
        height: area.height.saturating_sub(2),
    };

    let chunks = Layout::vertical([
        Constraint::Length(1), // input
        Constraint::Length(1), // sep
        Constraint::Min(0),    // resultados
        Constraint::Length(1), // dicas
    ])
    .split(inner);

    let query_disp = if app.search_query.is_empty() {
        Span::styled("digite sua busca…", theme.style_muted())
    } else {
        Span::styled(&app.search_query, theme.style_text())
    };
    f.render_widget(
        Paragraph::new(Line::from(vec![
            query_disp,
            Span::styled("▏", theme.style_accent()),
        ])),
        chunks[0],
    );

    let results = app.search_results();
    if results.is_empty() && !app.search_query.is_empty() {
        f.render_widget(
            Paragraph::new("Nada encontrado.").style(theme.style_muted()),
            chunks[2],
        );
    } else {
        let visible = chunks[2].height as usize;
        let sel = app.search_selected.min(results.len().saturating_sub(1));
        let start = if results.len() <= visible {
            0
        } else {
            sel.saturating_sub(visible / 2).min(results.len() - visible)
        };
        let mut lines: Vec<Line> = Vec::new();
        for (i, r) in results.iter().enumerate().skip(start).take(visible) {
            let selected = i == sel;
            let icon = match r.kind {
                SearchResultKind::Friend => "👤",
                SearchResultKind::Conversation => "💬",
                SearchResultKind::Server => "🖥",
                SearchResultKind::Channel => "#",
            };
            let line = if selected {
                Line::from(vec![
                    Span::styled("▶ ", theme.style_accent()),
                    Span::styled(
                        format!("{icon} {}", r.label),
                        Style::new().bg(theme.selection).fg(theme.text),
                    ),
                    Span::styled(
                        format!("  {}", r.detail),
                        Style::new().bg(theme.selection).fg(theme.muted),
                    ),
                ])
            } else {
                Line::from(vec![
                    Span::raw("  "),
                    Span::styled(format!("{icon} {}", r.label), theme.style_text()),
                    Span::styled(format!("  {}", r.detail), theme.style_muted()),
                ])
            };
            lines.push(line);
        }
        f.render_widget(Paragraph::new(lines), chunks[2]);
    }

    f.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled("↑↓", theme.style_accent()),
            Span::styled(" navegar   ", theme.style_muted()),
            Span::styled("ENTER", theme.style_accent()),
            Span::styled(" abrir   ", theme.style_muted()),
            Span::styled("ESC", theme.style_accent()),
            Span::styled(" fechar", theme.style_muted()),
        ]))
        .alignment(Alignment::Center),
        chunks[3],
    );
}

fn draw_message(f: &mut Frame, theme: &Theme, size: Rect, title: &str, msg: &str, accent: ratatui::style::Color) {
    let area = centered_rect(50, 8, size);
    clear_and_block(f, area, theme, title);

    let inner = Rect {
        x: area.x + 2,
        y: area.y + 1,
        width: area.width.saturating_sub(4),
        height: area.height.saturating_sub(2),
    };
    f.render_widget(
        Paragraph::new(msg.to_string())
            .style(Style::new().fg(accent))
            .wrap(Wrap { trim: true }),
        inner,
    );
}

fn draw_help(f: &mut Frame, theme: &Theme, size: Rect) {
    let area = centered_rect(52, 20, size);
    clear_and_block(f, area, theme, "Atalhos");

    let inner = Rect {
        x: area.x + 2,
        y: area.y + 1,
        width: area.width.saturating_sub(4),
        height: area.height.saturating_sub(2),
    };

    let key = |k: &str| Span::styled(format!("{k:<10}"), theme.style_accent());
    let lines = vec![
        Line::from(vec![key("↑ ↓"), Span::styled("navegar", theme.style_text())]),
        Line::from(vec![key("Enter"), Span::styled("abrir / enviar", theme.style_text())]),
        Line::from(vec![key("Esc"), Span::styled("voltar / fechar", theme.style_text())]),
        Line::from(vec![key("Ctrl+K"), Span::styled("pesquisa global", theme.style_text())]),
        Line::from(vec![key("Ctrl+D"), Span::styled("mensagens diretas", theme.style_text())]),
        Line::from(vec![key("Ctrl+G"), Span::styled("servidores", theme.style_text())]),
        Line::from(vec![key("Ctrl+,"), Span::styled("configurações", theme.style_text())]),
        Line::from(vec![key("Tab"), Span::styled("histórico ↔ input", theme.style_text())]),
        Line::from(vec![key("PageUp/Down"), Span::styled("rolar histórico", theme.style_text())]),
        Line::from(vec![key("Ctrl+Q"), Span::styled("sair", theme.style_text())]),
        Line::from(""),
        Line::from(vec![
            Span::styled("Tema: ", theme.style_muted()),
            Span::styled("t", theme.style_accent()),
            Span::styled(" alterna claro/escuro", theme.style_text()),
        ]),
    ];
    f.render_widget(Paragraph::new(lines), inner);
}

fn draw_toast(f: &mut Frame, theme: &Theme, size: Rect, text: &str) {
    if size.width < 30 || size.height < 8 {
        return;
    }
    let width = (text.chars().count() as u16 + 6).min(size.width.saturating_sub(2));
    let area = Rect {
        x: size.width.saturating_sub(width + 2),
        y: 1,
        width,
        height: 3,
    };
    f.render_widget(Clear, area);
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::new().fg(theme.accent))
        .style(Style::new().bg(theme.panel));
    f.render_widget(block, area);
    f.render_widget(
        Paragraph::new(text.to_string())
            .style(theme.style_text())
            .wrap(Wrap { trim: true }),
        Rect {
            x: area.x + 1,
            y: area.y + 1,
            width: area.width.saturating_sub(2),
            height: area.height.saturating_sub(2),
        },
    );
}
