use tauri::{PhysicalPosition, PhysicalSize};

/// Rectangle representing the tray icon's screen position.
#[derive(Debug, Clone, Copy)]
pub struct TrayRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Rectangle representing a monitor's usable bounds.
#[derive(Debug, Clone, Copy)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Compute the popover window's top-left position so it sits under the tray
/// icon, with its right edge ~28px inset from the tray icon's right edge.
///
/// If the resulting position would push the window off the right side of the
/// monitor, clamp it inside the monitor bounds. Also clamps to the left edge
/// for pathological cases where the tray is near the screen's left.
pub fn position_under_tray(
    tray: TrayRect,
    window_size: PhysicalSize<u32>,
    monitor: MonitorBounds,
) -> PhysicalPosition<i32> {
    let tray_center_x = tray.x + (tray.width as i32 / 2);
    let mut x = tray_center_x - (window_size.width as i32) + 28;
    let y = tray.y + tray.height as i32 + 4; // 4px gap below menu bar

    // Clamp to monitor right edge with 8px margin
    let monitor_right = monitor.x + monitor.width as i32;
    let window_right = x + window_size.width as i32;
    if window_right > monitor_right {
        x -= window_right - monitor_right + 8;
    }

    // Clamp to monitor left edge with 8px margin
    if x < monitor.x + 8 {
        x = monitor.x + 8;
    }

    PhysicalPosition::new(x, y)
}

/// Popover visibility state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PopoverState {
    Hidden,
    Visible,
}

impl PopoverState {
    pub fn toggle(self) -> Self {
        match self {
            Self::Hidden => Self::Visible,
            Self::Visible => Self::Hidden,
        }
    }

    pub fn show(self) -> Self {
        Self::Visible
    }

    pub fn hide(self) -> Self {
        Self::Hidden
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_monitor() -> MonitorBounds {
        MonitorBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }
    }

    #[test]
    fn test_position_under_tray_centers_with_offset() {
        let tray = TrayRect {
            x: 1000,
            y: 0,
            width: 24,
            height: 24,
        };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        // tray center 1012, x = 1012 - 360 + 28 = 680, y = 28
        assert_eq!(pos.x, 680);
        assert_eq!(pos.y, 28);
    }

    #[test]
    fn test_position_under_tray_clamps_at_right_edge() {
        // Tray icon very close to the right edge of a 1920-wide monitor.
        let tray = TrayRect {
            x: 1900,
            y: 0,
            width: 24,
            height: 24,
        };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        // Unclamped x = 1912 - 360 + 28 = 1580. Window right = 1940. Monitor
        // right = 1920. Overflow = 20. Adjusted x = 1580 - 20 - 8 = 1552.
        assert_eq!(pos.x, 1552);
        // Window stays on-screen
        assert!(pos.x + win.width as i32 <= 1920);
    }

    #[test]
    fn test_position_under_tray_clamps_at_left_edge() {
        // Pathological: tray very close to left edge.
        let tray = TrayRect {
            x: 10,
            y: 0,
            width: 24,
            height: 24,
        };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        // Unclamped x = 22 - 360 + 28 = -310. Clamped to monitor.x + 8 = 8.
        assert_eq!(pos.x, 8);
    }

    #[test]
    fn test_position_under_tray_y_includes_menu_bar_gap() {
        let tray = TrayRect {
            x: 500,
            y: 0,
            width: 24,
            height: 24,
        };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        assert_eq!(pos.y, 28); // 24 (tray height) + 4 (gap)
    }

    #[test]
    fn test_popover_state_toggle_from_hidden() {
        assert_eq!(PopoverState::Hidden.toggle(), PopoverState::Visible);
    }

    #[test]
    fn test_popover_state_toggle_from_visible() {
        assert_eq!(PopoverState::Visible.toggle(), PopoverState::Hidden);
    }

    #[test]
    fn test_popover_state_show_is_idempotent() {
        assert_eq!(PopoverState::Hidden.show(), PopoverState::Visible);
        assert_eq!(PopoverState::Visible.show(), PopoverState::Visible);
    }

    #[test]
    fn test_popover_state_hide_is_idempotent() {
        assert_eq!(PopoverState::Visible.hide(), PopoverState::Hidden);
        assert_eq!(PopoverState::Hidden.hide(), PopoverState::Hidden);
    }
}
