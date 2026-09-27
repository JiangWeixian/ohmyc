//! AppKit template image: two label/value columns rendered at the display's scale.
//! Keep the original status button so Tauri owns click dispatch and popover anchoring.
use super::{week_bounds, Display};
use block2::RcBlock;
use chrono::Local;
use objc2::{rc::Retained, runtime::Bool, MainThreadMarker};
use objc2_app_kit::{
    NSAccessibility, NSAutoresizingMaskOptions, NSColor, NSFont, NSFontAttributeName, NSForegroundColorAttributeName,
    NSImage, NSStringDrawing,
};
use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize, NSString};
use ohmyc_core::timeline;
use tauri::tray::TrayIcon;

const WIDTH: f64 = 120.0;
const HEIGHT: f64 = 22.0;

fn draw_text(text: &str, center: f64, y: f64, font: &NSFont) {
    let text = NSString::from_str(text);
    let color = NSColor::blackColor();
    // SAFETY: AppKit attribute keys are paired with their documented object types.
    // This function is called only inside NSImage's drawing context.
    unsafe {
        let attrs = NSDictionary::from_slices(
            &[NSFontAttributeName, NSForegroundColorAttributeName],
            &[font.as_ref(), color.as_ref()],
        );
        let size = text.sizeWithAttributes(Some(&attrs));
        text.drawAtPoint_withAttributes(NSPoint::new(center - size.width / 2.0, y), Some(&attrs));
    }
}

fn image(tokens: String, sessions: String) -> Retained<NSImage> {
    let draw = RcBlock::new(move |_rect: NSRect| {
        let label_font = NSFont::systemFontOfSize(9.0);
        let value_font = NSFont::monospacedDigitSystemFontOfSize_weight(12.0, 0.23);
        draw_text("Tokens", 30.0, 12.0, &label_font);
        draw_text("Sessions", 90.0, 12.0, &label_font);
        draw_text(&tokens, 30.0, -1.0, &value_font);
        draw_text(&sessions, 90.0, -1.0, &value_font);
        Bool::YES
    });
    // AppKit draws on demand at the screen's backing scale (including Retina).
    let image = NSImage::imageWithSize_flipped_drawingHandler(NSSize::new(WIDTH, HEIGHT), false, &draw);
    image.setTemplate(true);
    image
}

/// Keep tray-icon's event overlay aligned with the expanded native button.
pub fn resize_hit_targets(button: &objc2_app_kit::NSView) {
    // tray-icon 0.23 installs a fixed-size TaoTrayTarget over the original
    // icon. Without resizing it, clicks in the newly widened area reach
    // NSStatusBarButton directly and open its native menu even on left click.
    for target in button.subviews() {
        if target.class().name().to_bytes() == b"TaoTrayTarget" {
            target.setFrame(button.bounds());
            target.setAutoresizingMask(
                NSAutoresizingMaskOptions::ViewWidthSizable | NSAutoresizingMaskOptions::ViewHeightSizable,
            );
        }
    }
}

fn update(tray: &TrayIcon, display: Display, redraw: bool) -> tauri::Result<bool> {
    tray.with_inner_tray_icon(move |inner| {
        let Some(mtm) = MainThreadMarker::new() else {
            return false;
        };
        let Some(item) = inner.ns_status_item() else {
            return false;
        };
        let Some(button) = item.button(mtm) else { return false };
        if redraw {
            item.setLength(WIDTH + 8.0); // native status-button insets
            button.setImage(Some(&image(display.tokens, display.sessions)));
            resize_hit_targets(&button);
        }
        let description = NSString::from_str(&display.description);
        button.setToolTip(Some(&description));
        button.setAccessibilityLabel(Some(&description));
        true
    })
}

/// Start exactly once during app setup. SQLite runs off the AppKit thread;
/// the status item is touched only through Tauri's main-thread dispatcher.
pub fn start(tray: TrayIcon) -> std::io::Result<()> {
    std::thread::Builder::new()
        .name("menubar-stats".into())
        .spawn(move || {
            let mut previous: Option<Display> = None;
            loop {
                let now = Local::now();
                let mut basis = String::new();
                let totals = week_bounds(now).and_then(|(from, to)| {
                    let path = timeline::default_db_path().ok()?;
                    let conn = timeline::open_db(&path).ok()?;
                    basis = if timeline::usage::event_mode(&conn) {
                        let missing = timeline::usage::incomplete(&conn).ok()?;
                        format!("Usage time. {missing} sessions have incomplete timestamped history.")
                    } else {
                        "Session start; tokens are session lifetime totals.".into()
                    };
                    timeline::summary(&conn, from, to).ok()
                });
                let mut display = Display::new(&now.format("%Y-%m-%d").to_string(), totals);
                display.description.push_str(&basis);
                if previous.as_ref() != Some(&display) {
                    let redraw = previous
                        .as_ref()
                        .is_none_or(|old| old.tokens != display.tokens || old.sessions != display.sessions);
                    match update(&tray, display.clone(), redraw) {
                        Ok(true) => previous = Some(display),
                        Ok(false) => break, // the tray has been removed
                        Err(error) => {
                            eprintln!("Could not update menu bar activity: {error}");
                            break;
                        }
                    }
                }
                std::thread::sleep(std::time::Duration::from_secs(30));
            }
        })?;
    Ok(())
}
