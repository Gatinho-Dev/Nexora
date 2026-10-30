pub mod chat;
pub mod friends;
pub mod header;
pub mod popup;
pub mod sidebar;
pub mod status_bar;

use ratatui::{
    layout::{Constraint, Layout},
    Frame,
};

use crate::app::{App, View};
use crate::theme::Theme;

/// Render principal: layout raiz responsivo.
pub fn draw(f: &mut Frame, app: &App, theme: &Theme) {
    let size = f.area();
    crate::mouse::begin_frame();
    // Terminal muito pequeno: só status.
    if size.height < 8 || size.width < 40 {
        let _ = f.render_widget(
            ratatui::widgets::Paragraph::new(" Nexora CLI — terminal muito pequeno"),
            size,
        );
        return;
    }

    let show_sidebar = size.width >= 70;
    let show_status = size.height >= 10;

    let chunks = if show_status {
        Layout::vertical([Constraint::Min(1), Constraint::Length(1)]).split(size)
    } else {
        Layout::vertical([Constraint::Min(1)]).split(size)
    };

    let main = if show_sidebar {
        Layout::horizontal([
            Constraint::Length(26.min(size.width / 4)),
            Constraint::Min(0),
        ])
        .split(chunks[0])
    } else {
        Layout::horizontal([Constraint::Length(0), Constraint::Min(0)]).split(chunks[0])
    };

    if show_sidebar {
        sidebar::draw(f, app, theme, main[0]);
    }

    match app.view {
        View::Friends => friends::draw(f, app, theme, main[1]),
        View::Chat => chat::draw(f, app, theme, main[1], show_sidebar),
        View::Servers => servers_view(f, app, theme, main[1]),
        View::Settings => settings_view(f, app, theme, main[1]),
    }

    if show_status {
        status_bar::draw(f, app, theme, chunks[1]);
    }

    popup::draw(f, app, theme, size);
}

fn servers_view(f: &mut Frame, app: &App, theme: &Theme, area: ratatui::layout::Rect) {
    use ratatui::widgets::{Block, Borders, List, ListItem, Paragraph};

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(theme.style_border(true))
        .title(" Servidores ")
        .title_style(theme.style_accent());
    let inner = block.inner(area);
    f.render_widget(block, area);

    if app.servers.is_empty() {
        f.render_widget(
            Paragraph::new("Nenhum servidor. Você não participa de servidores ainda.")
                .style(theme.style_muted()),
            inner,
        );
        return;
    }

    if app.open_server.is_none() {
        // Lista de servidores (nível 1). Clique/Enter abre o servidor.
        let mut lines: Vec<ListItem> = Vec::new();
        lines.push(ListItem::new("SEUS SERVIDORES"));
        for (i, s) in app.servers.iter().enumerate() {
            let unread = s.unreadCount.unwrap_or(0);
            let suffix = if unread > 0 {
                format!("  [{unread}]")
            } else {
                String::new()
            };
            let selected = i == app.server_selected.min(app.servers.len() - 1);
            let pointer = if selected { "▶ " } else { "  " };
            let mut item = ListItem::new(format!("{pointer}● {}{suffix}", s.name));
            if selected {
                item = item.style(theme.style_selection());
            }
            // Zona clicável (linha 1 = cabeçalho, servidores a partir da 2).
            crate::mouse::register(crate::mouse::HitZone {
                row: inner.y + (i as u16) + 1,
                col: inner.x,
                width: inner.width,
                kind: crate::mouse::ZoneKind::Server(i),
            });
            lines.push(item);
        }
        let list = List::new(lines).block(Block::default());
        f.render_widget(list, inner);
        return;
    }

    // Servidor aberto: canais de texto (nível 2).
    let title = app
        .servers
        .iter()
        .find(|s| Some(s.id) == app.open_server)
        .map(|s| s.name.clone())
        .unwrap_or_else(|| "Servidor".into());
    let inner2 = ratatui::layout::Rect {
        y: inner.y + 1,
        height: inner.height.saturating_sub(1),
        ..inner
    };
    f.render_widget(
        Paragraph::new(format!(" {title}"))
            .style(theme.style_accent()),
        inner,
    );

    if app.channels.is_empty() {
        f.render_widget(
            Paragraph::new("  Carregando canais…")
                .style(theme.style_muted()),
            inner2,
        );
        return;
    }

    let mut lines: Vec<ListItem> = Vec::new();
    lines.push(ListItem::new("TEXT CHANNELS"));
    for (i, ch) in app
        .channels
        .iter()
        .filter(|c| matches!(c.kind.as_deref(), Some("TEXT") | None))
        .enumerate()
    {
        let unread = app.unread.get(&ch.id).copied().unwrap_or(0);
        let mark = if unread > 0 {
            format!(" [{unread}]")
        } else {
            String::new()
        };
        let selected = i == app.dm_selected;
        let pointer = if selected { "▶" } else { " " };
        let mut item = ListItem::new(format!("{pointer} # {}{mark}", ch.name));
        if selected {
            item = item.style(theme.style_selection());
        }
        // Zona clicável (+1: linha do cabeçalho).
        crate::mouse::register(crate::mouse::HitZone {
            row: inner2.y + (i as u16) + 1,
            col: inner2.x,
            width: inner2.width,
            kind: crate::mouse::ZoneKind::Channel(ch.id),
        });
        lines.push(item);
    }
    let list = List::new(lines).block(Block::default());
    f.render_widget(list, inner2);
}

fn settings_view(f: &mut Frame, app: &App, theme: &Theme, area: ratatui::layout::Rect) {
    use ratatui::widgets::{Block, Borders, Paragraph};

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(theme.style_border(true))
        .title(" Configurações ")
        .title_style(theme.style_accent());
    let inner = block.inner(area);
    f.render_widget(block, area);

    let version = env!("CARGO_PKG_VERSION");
    let account = app
        .me
        .as_ref()
        .map(|u| {
            let name = u.name.clone().unwrap_or_default();
            let user = u.username.clone().unwrap_or_default();
            format!("{name} (@{user})")
        })
        .unwrap_or_else(|| "—".into());

    let text = vec![
        ratatui::text::Line::from(vec![
            ratatui::text::Span::styled("Conta          ", theme.style_muted()),
            ratatui::text::Span::raw(account),
        ]),
        ratatui::text::Line::from(""),
        ratatui::text::Line::from(vec![
            ratatui::text::Span::styled("Aparência      ", theme.style_muted()),
            ratatui::text::Span::raw(format!(
                "tema: {}  (t para alternar)",
                if theme.background == Theme::DARK.background { "escuro" } else { "claro" }
            )),
        ]),
        ratatui::text::Line::from(""),
        ratatui::text::Line::from(vec![
            ratatui::text::Span::styled("Notificações   ", theme.style_muted()),
            ratatui::text::Span::raw("em app (sidebar + toast)"),
        ]),
        ratatui::text::Line::from(""),
        ratatui::text::Line::from(vec![
            ratatui::text::Span::styled("Atualizações   ", theme.style_muted()),
            ratatui::text::Span::raw(match &app.update_available {
                Some(v) => format!("nova versão disponível: v{v}"),
                None => "você está na versão mais recente".into(),
            }),
        ]),
        ratatui::text::Line::from(""),
        ratatui::text::Line::from(vec![
            ratatui::text::Span::styled("Sobre          ", theme.style_muted()),
            ratatui::text::Span::raw(format!("Nexora CLI v{version}")),
        ]),
        ratatui::text::Line::from(""),
        ratatui::text::Line::from(vec![
            ratatui::text::Span::styled("Esc", theme.style_accent()),
            ratatui::text::Span::raw(" voltar"),
        ]),
    ];
    f.render_widget(Paragraph::new(text), inner);
}
