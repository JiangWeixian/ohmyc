//! Main window construction and visibility commands.
//!
//! The main window is built on demand by the `open_main_window` command —
//! it is not declared in `tauri.conf.json`, because the popover should be
//! the only auto-built window at launch.

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

pub const MAIN_LABEL: &str = "main";
const DEFAULT_WIDTH: f64 = 1200.0;
const DEFAULT_HEIGHT: f64 = 800.0;

/// Show the main window. Builds it on first call; brings it to front on
/// subsequent calls.
///
/// macOS: the title bar is replaced with an `Overlay` style so the
/// content extends to the top edge while the traffic lights remain
/// visible (the modern macOS app pattern — Linear, Raycast, Arc).
/// The sidebar headers compensate with extra top padding so the
/// LayoutGrid icon doesn't sit under the traffic light cluster.
#[tauri::command]
pub fn open_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(MAIN_LABEL) {
        existing.show().map_err(|e| e.to_string())?;
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut builder = WebviewWindowBuilder::new(&app, MAIN_LABEL, WebviewUrl::App("index.html".into()))
        .title("OhMyC")
        .inner_size(DEFAULT_WIDTH, DEFAULT_HEIGHT)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(true)
        .visible(true);

    #[cfg(target_os = "macos")]
    {
        builder = builder.title_bar_style(TitleBarStyle::Overlay).hidden_title(true);
    }

    let window = builder.build().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use tauri::LogicalSize;

    use super::*;

    #[test]
    fn default_size_constants_are_sane() {
        assert_eq!(DEFAULT_WIDTH, 1200.0);
        assert_eq!(DEFAULT_HEIGHT, 800.0);
    }

    #[test]
    fn main_label_is_stable() {
        assert_eq!(MAIN_LABEL, "main");
        let _ = LogicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    }
}
