//! Tela de chat — histórico roolável e input de mensagem.

use ratatui::{
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

use crate::app::{App, ChatFocus};
use crate::theme::Theme;

pub fn draw(f: &mut Frame, app: &App, theme: &Theme, area: Rect, show_sidebar: bool) {
    let chunks = Layout::vertical([
        Constraint::Length(1),  // header
        Constraint::Min(0),     // histórico
        Constraint::Length(3),  // input
    ])
    .split(area);

    super::header::draw(f, app, theme, chunks[0]);

    // ── Histórico ────────────────────────────────────────────
    let hist_block = Block::default()
        .borders(Borders::NONE)
        .style(Style::new().bg(theme.background));
    let hist_inner = hist_block.inner(chunks[1]);
    f.render_widget(hist_block, chunks[1]);

    let width = hist_inner.width.saturating_sub(2) as usize;
    let lines = render_messages(app, theme, width);

    // Scroll: 0 = ancorado no fim (mais recente).
    let total = lines.len();
    let visible = hist_inner.height as usize;
    let scroll_from_end = app.history_scroll as usize;
    let scroll = total.saturating_sub(visible).saturating_sub(scroll_from_end);

    let para = Paragraph::new(lines)
        .wrap(Wrap { trim: false })
        .scroll((scroll as u16, 0));
    f.render_widget(para, hist_inner);

    // ── Input ────────────────────────────────────────────────
    let input_focused = app.chat_focus == ChatFocus::Input;
    let (input_title, cursor) = if input_focused {
        (" mensagem  (Enter envia · Shift+Enter nova linha) ", "▏")
    } else {
        (" mensagem  (Tab volta ao histórico) ", "")
    };

    let input_block = Block::default()
        .borders(Borders::ALL)
        .border_style(theme.style_border(input_focused))
        .title(input_title)
        .title_style(if input_focused {
            theme.style_accent()
        } else {
            theme.style_muted()
        });
    let input_inner = input_block.inner(chunks[2]);
    f.render_widget(input_block, chunks[2]);

    let text = &app.input;
    let max = (input_inner.width as usize).saturating_sub(2);
    let disp_len = text.chars().count();
    let disp = if disp_len > max {
        // Mostra o final do texto (cursor fica no fim).
        let skip = disp_len - max;
        text.chars().skip(skip).collect::<String>()
    } else {
        text.clone()
    };

    let mut spans = vec![Span::raw(disp)];
    if input_focused {
        spans.push(Span::styled(cursor, theme.style_accent()));
    } else if text.is_empty() {
        spans.clear();
        spans.push(Span::styled(
            "Escreva uma mensagem…",
            theme.style_muted(),
        ));
    }

    f.render_widget(
        Paragraph::new(Line::from(spans)).style(Style::new().bg(theme.input)),
        input_inner,
    );

    // ── Dica de teclas no rodapé do histórico (desktop largo) ──
    if show_sidebar && hist_inner.height > 4 {
        let _ = (); // espaço reservado para dicas futuras
    }
}

/// Converte as mensagens em linhas renderizáveis.
fn render_messages(app: &App, theme: &Theme, width: usize) -> Vec<Line<'static>> {
    let mut lines: Vec<Line> = Vec::new();

    if app.messages.is_empty() {
        lines.push(Line::from(Span::styled(
            "  Nenhuma mensagem ainda. Diga oi! 👋",
            theme.style_muted(),
        )));
        return lines;
    }

    let mut last_author: Option<i64> = None;
    let mut last_day: Option<String> = None;

    for m in &app.messages {
        let content = m.display_content();
        let author_name = m
            .author
            .name
            .clone()
            .unwrap_or_else(|| "Usuário".into());
        let mine = m.author.id == app.my_id;

        // Separador de dia.
        let day = m
            .createdAt
            .as_deref()
            .and_then(|c| chrono::DateTime::parse_from_rfc3339(c).ok())
            .map(|d| d.format("%d/%m/%Y").to_string());
        if day != last_day && day.is_some() {
            lines.push(Line::from(Span::styled(
                format!("  ── {} ──", day.clone().unwrap()),
                theme.style_muted(),
            )));
        }
        last_day = day;

        // Hora.
        let time = m
            .createdAt
            .as_deref()
            .and_then(|c| chrono::DateTime::parse_from_rfc3339(c).ok())
            .map(|d| d.format("%H:%M").to_string())
            .unwrap_or_default();

        // Quebra o conteúdo na largura disponível.
        let content_lines = wrap_text(&content, width.saturating_sub(6));

        if last_author != Some(m.author.id) {
            // Cabeçalho de autor.
            let name_style = if mine {
                Style::new().fg(theme.accent).add_modifier(Modifier::BOLD)
            } else {
                Style::new().fg(theme.text).add_modifier(Modifier::BOLD)
            };
            let header_text = if mine {
                format!("{author_name}  (você)")
            } else {
                author_name.clone()
            };
            let mut spans = vec![
                Span::styled(format!("{author_name:<14}"), name_style),
            ];
            spans.truncate(1);
            spans[0] = Span::styled(truncate(&header_text, 18), name_style);
            if !time.is_empty() {
                spans.push(Span::styled(format!("  {time}"), theme.style_muted()));
            }
            lines.push(Line::from(spans));
        } else if !time.is_empty() {
            // Continuação: hora discreta à direita não é possível em texto;
            // deixamos limpo.
        }

        for (i, cl) in content_lines.iter().enumerate() {
            let prefix = if i == 0 { "  " } else { "  " };
            let base = if mine {
                Span::styled(format!("{prefix}{}", cl), Style::new().fg(theme.text))
            } else {
                Span::styled(format!("{prefix}{}", cl), Style::new().fg(theme.text))
            };
            let _ = base;
            lines.push(Line::from(render_rich(
                &format!("{prefix}{cl}"),
                theme,
            )));
        }

        last_author = Some(m.author.id);
        lines.push(Line::from(""));
    }

    lines
}

/// Render simples de markdown: **negrito**, `código`, > citação, URL.
fn render_rich(text: &str, theme: &Theme) -> Line<'static> {
    let mut spans: Vec<Span> = Vec::new();
    let mut rest = text;

    // Citação inteira.
    if rest.trim_start().starts_with('>') {
        return Line::from(Span::styled(
            rest.to_string(),
            Style::new().fg(theme.quote),
        ));
    }

    while !rest.is_empty() {
        if let Some(code_start) = rest.find('`') {
            if let Some(code_end_rel) = rest[code_start + 1..].find('`') {
                let before = &rest[..code_start];
                if !before.is_empty() {
                    spans.push(Span::styled(before.to_string(), theme.style_text()));
                }
                let code = &rest[code_start + 1..code_start + 1 + code_end_rel];
                spans.push(Span::styled(
                    format!(" {code} "),
                    Style::new().bg(theme.code).fg(theme.text),
                ));
                rest = &rest[code_start + code_end_rel + 2..];
                continue;
            }
        }
        spans.push(Span::styled(rest.to_string(), theme.style_text()));
        break;
    }

    Line::from(spans)
}

/// Quebra texto em linhas de no máximo `width` colunas (char-based, bom o bastante).
fn wrap_text(text: &str, width: usize) -> Vec<String> {
    if width == 0 {
        return vec![text.to_string()];
    }
    let mut out: Vec<String> = Vec::new();
    for para in text.split('\n') {
        if para.is_empty() {
            out.push(String::new());
            continue;
        }
        let mut line = String::new();
        for word in para.split(' ') {
            let candidate_len = if line.is_empty() {
                word.chars().count()
            } else {
                line.chars().count() + 1 + word.chars().count()
            };
            if candidate_len > width && !line.is_empty() {
                out.push(line.clone());
                line.clear();
                line.push_str(word);
            } else if word.chars().count() > width && line.is_empty() {
                // Palavra maior que a linha: quebra dura.
                let chars: Vec<char> = word.chars().collect();
                let mut start = 0;
                while start < chars.len() {
                    let end = (start + width).min(chars.len());
                    out.push(chars[start..end].iter().collect());
                    start = end;
                }
                line.clear();
            } else {
                if !line.is_empty() {
                    line.push(' ');
                }
                line.push_str(word);
            }
        }
        out.push(line);
    }
    out
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
