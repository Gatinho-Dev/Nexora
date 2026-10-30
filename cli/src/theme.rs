//! Tema centralizado do Nexora CLI — cores do Nexora Web adaptadas para
//! terminal. Nenhum outro arquivo define cores diretamente.

use ratatui::style::{Color, Modifier, Style};

#[allow(dead_code)]
#[derive(Debug, Clone, Copy)]
pub struct Theme {
    pub background: Color,
    pub sidebar: Color,
    pub panel: Color,
    pub border: Color,
    pub border_focused: Color,
    pub text: Color,
    pub muted: Color,
    pub accent: Color,
    pub accent_hover: Color,
    pub online: Color,
    pub idle: Color,
    pub unread: Color,
    pub mention: Color,
    pub input: Color,
    pub selection: Color,
    pub error: Color,
    pub success: Color,
    pub warning: Color,
    pub quote: Color,
    pub code: Color,
}

impl Theme {
    /// Tema escuro padrão, baseado na paleta do Nexora Web
    /// (fundo #1a1b21, painéis #232428, acento blurple #5865F2).
    pub const DARK: Theme = Theme {
        background: Color::Rgb(0x1a, 0x1b, 0x21),
        sidebar: Color::Rgb(0x14, 0x15, 0x19),
        panel: Color::Rgb(0x23, 0x24, 0x28),
        border: Color::Rgb(0x35, 0x36, 0x3c),
        border_focused: Color::Rgb(0x58, 0x65, 0xf2),
        text: Color::Rgb(0xe8, 0xe9, 0xed),
        muted: Color::Rgb(0x8e, 0x92, 0x9e),
        accent: Color::Rgb(0x58, 0x65, 0xf2),
        accent_hover: Color::Rgb(0x47, 0x52, 0xc4),
        online: Color::Rgb(0x3b, 0xbd, 0x72),
        idle: Color::Rgb(0xf0, 0xb2, 0x32),
        unread: Color::Rgb(0xf2, 0x3f, 0x57),
        mention: Color::Rgb(0xfa, 0xa6, 0x1a),
        input: Color::Rgb(0x1e, 0x1f, 0x24),
        selection: Color::Rgb(0x3c, 0x42, 0x6d),
        error: Color::Rgb(0xf2, 0x3f, 0x57),
        success: Color::Rgb(0x3b, 0xbd, 0x72),
        warning: Color::Rgb(0xf0, 0xb2, 0x32),
        quote: Color::Rgb(0x6b, 0x6f, 0x7c),
        code: Color::Rgb(0x2b, 0x2d, 0x33),
    };

    /// Tema claro — revisão própria, não um inverso.
    pub const LIGHT: Theme = Theme {
        background: Color::Rgb(0xf5, 0xf6, 0xfa),
        sidebar: Color::Rgb(0xe8, 0xea, 0xf1),
        panel: Color::Rgb(0xff, 0xff, 0xff),
        border: Color::Rgb(0xd2, 0xd5, 0xde),
        border_focused: Color::Rgb(0x58, 0x65, 0xf2),
        text: Color::Rgb(0x24, 0x26, 0x2f),
        muted: Color::Rgb(0x6a, 0x6e, 0x7a),
        accent: Color::Rgb(0x47, 0x52, 0xc4),
        accent_hover: Color::Rgb(0x3a, 0x45, 0xa8),
        online: Color::Rgb(0x1f, 0x8f, 0x53),
        idle: Color::Rgb(0xb4, 0x7d, 0x10),
        unread: Color::Rgb(0xc9, 0x2f, 0x42),
        mention: Color::Rgb(0x9a, 0x63, 0x0a),
        input: Color::Rgb(0xff, 0xff, 0xff),
        selection: Color::Rgb(0xd8, 0xdc, 0xf6),
        error: Color::Rgb(0xc9, 0x2f, 0x42),
        success: Color::Rgb(0x1f, 0x8f, 0x53),
        warning: Color::Rgb(0xb4, 0x7d, 0x10),
        quote: Color::Rgb(0x8a, 0x8e, 0x99),
        code: Color::Rgb(0xec, 0xee, 0xf4),
    };

    pub fn style_text(&self) -> Style {
        Style::new().fg(self.text)
    }

    pub fn style_muted(&self) -> Style {
        Style::new().fg(self.muted)
    }

    pub fn style_accent(&self) -> Style {
        Style::new().fg(self.accent)
    }

    pub fn style_selection(&self) -> Style {
        Style::new().bg(self.selection).fg(Color::White)
    }

    pub fn style_online(&self) -> Style {
        Style::new().fg(self.online)
    }

    pub fn style_unread(&self) -> Style {
        Style::new().fg(self.unread).add_modifier(Modifier::BOLD)
    }

    pub fn style_border(&self, focused: bool) -> Style {
        if focused {
            Style::new().fg(self.border_focused)
        } else {
            Style::new().fg(self.border)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn themes_have_distinct_backgrounds() {
        assert_ne!(Theme::DARK.background, Theme::LIGHT.background);
    }

    #[test]
    fn selection_is_visible_on_dark() {
        // O selection precisa contrastar com o fundo do painel.
        assert_ne!(Theme::DARK.selection, Theme::DARK.panel);
        assert_ne!(Theme::DARK.selection, Theme::DARK.background);
    }
}
