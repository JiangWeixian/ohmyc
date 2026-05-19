use serde::Serialize;

/// Identifier for tray menu items. Used to dispatch on click in main.rs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum TrayMenuId {
    Quit,
}

impl TrayMenuId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Quit => "quit",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "quit" => Some(Self::Quit),
            _ => None,
        }
    }
}

/// What kind of tray icon event was received.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayClick {
    /// Left-click on the tray icon → toggle the popover.
    Left,
    /// Right-click on the tray icon → show the tray menu.
    Right,
}

/// Map a Tauri click event (button + button_state) into our internal
/// `TrayClick`. We only act on Up events to avoid double-firing on press.
pub fn classify_click(button: &str, button_state: &str) -> Option<TrayClick> {
    if button_state != "Up" {
        return None;
    }
    match button {
        "Left" => Some(TrayClick::Left),
        "Right" => Some(TrayClick::Right),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_menu_id_round_trip() {
        let id = TrayMenuId::Quit;
        let s = id.as_str();
        assert_eq!(s, "quit");
        assert_eq!(TrayMenuId::from_str(s), Some(id));
    }

    #[test]
    fn test_tray_menu_id_from_unknown_string() {
        assert_eq!(TrayMenuId::from_str("invalid"), None);
        assert_eq!(TrayMenuId::from_str(""), None);
    }

    #[test]
    fn test_classify_click_left_up() {
        assert_eq!(classify_click("Left", "Up"), Some(TrayClick::Left));
    }

    #[test]
    fn test_classify_click_right_up() {
        assert_eq!(classify_click("Right", "Up"), Some(TrayClick::Right));
    }

    #[test]
    fn test_classify_click_ignores_down_events() {
        assert_eq!(classify_click("Left", "Down"), None);
        assert_eq!(classify_click("Right", "Down"), None);
    }

    #[test]
    fn test_classify_click_ignores_unknown_button() {
        assert_eq!(classify_click("Middle", "Up"), None);
    }
}
