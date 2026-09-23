//! Loop de eventos — crossterm → eventos assíncronos. Teclado, mouse, resize.

use crossterm::event::{
    Event, EventStream, KeyCode, KeyModifiers, MouseEvent,
};
use futures_util::StreamExt;
use tokio::sync::mpsc;

#[derive(Debug, Clone, PartialEq)]
pub enum AppEvent {
    Key(KeyCode, KeyModifiers),
    Mouse(MouseEvent),
    Resize,
}

/// Spawna uma task que empurra eventos do terminal para o canal.
/// O receiver é consumido pelo loop principal da TUI.
pub fn spawn_event_loop() -> mpsc::UnboundedReceiver<AppEvent> {
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        let mut stream = EventStream::new();
        loop {
            match stream.next().await {
                Some(Ok(Event::Key(key))) => {
                    // Em Windows o raw mode entrega Press e Release;
                    // processamos apenas Press para não duplicar.
                    if key.kind == crossterm::event::KeyEventKind::Press {
                        if tx
                            .send(AppEvent::Key(key.code, key.modifiers))
                            .is_err()
                        {
                            break; // receptor caiu = app fechando
                        }
                    }
                }
                Some(Ok(Event::Mouse(m))) => {
                    if tx.send(AppEvent::Mouse(m)).is_err() {
                        break;
                    }
                }
                Some(Ok(Event::Resize(_, _))) => {
                    if tx.send(AppEvent::Resize).is_err() {
                        break;
                    }
                }
                Some(Ok(_)) => continue, // FocusGained/Lost etc.
                Some(Err(_)) | None => break,
            }
        }
    });
    rx
}

#[allow(dead_code)]
/// Helper para testes: constrói eventos sintéticos.
pub fn key_event(code: KeyCode, mods: KeyModifiers) -> AppEvent {
    AppEvent::Key(code, mods)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_events_are_equal_by_code_and_mods() {
        let a = key_event(KeyCode::Char('k'), KeyModifiers::CONTROL);
        let b = key_event(KeyCode::Char('k'), KeyModifiers::CONTROL);
        let c = key_event(KeyCode::Char('k'), KeyModifiers::NONE);
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}
