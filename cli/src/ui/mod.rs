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
    use ratatui::widgets::{Block, Borders, List, ListItem, ListState, Paragraph};

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

    let _items: Vec<ListItem> = app
        .servers
        .iter()
        .map(|s| {
            let unread = s.unreadCount.unwrap_or(0);
            let suffix = if unread > 0 {
                format!("  [{unread}]")
            } else {
                String::new()
            };
            ListItem::new(format!("● {}{}", s.name, suffix))
        })
        .collect();

    // Canal do servidor aberto.
    let mut list_items: Vec<ListItem> = Vec::new();
    if !app.channels.is_empty() {
        list_items.push(ListItem::new("TEXT CHANNELS").style(theme.style_muted()));
        // Zonas clicáveis: linha do cabeçalho + 1 por canal de texto.
        {
            let mut row = inner.y + 1; // +1: pula a linha "TEXT CHANNELS"
            for ch in app.channels.iter().filter(|c| {
                matches!(c.kind.as_deref(), Some("TEXT") | None)
            }) {
                crate::mouse::register(crate::mouse::HitZone {
                    row,
                    col: inner.x,
                    width: inner.width,
                    kind: crate::mouse::ZoneKind::Channel(ch.id),
                });
                row += 1;
            }
        }
        for ch in app.channels.iter().filter(|c| {
            matches!(c.kind.as_deref(), Some("TEXT") | None)
        }) {
            let unread = app.unread.get(&ch.id).copied().unwrap_or(0);
            let mark = if unread > 0 { format!(" [{unread}]") } else { String::new() };
            list_items.push(ListItem::new(format!("  # {}{}", ch.name, mark)));
        }
    }

    let list = List::new(list_items)
        .block(Block::default())
        .highlight_style(theme.style_selection());
    let mut state = ListState::default();
    state.select(Some(0));
    f.render_stateful_widget(list, inner, &mut state);
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
