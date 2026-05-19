#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use ohmyc_desktop_lib::popover::{position_under_tray, MonitorBounds, PopoverState, TrayRect};
use ohmyc_desktop_lib::tray::{classify_click, TrayClick, TrayMenuId};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, PhysicalSize, WindowEvent};

struct PopoverGuard(Mutex<PopoverState>);

fn main() {
    tauri::Builder::default()
        .manage(PopoverGuard(Mutex::new(PopoverState::Hidden)))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Tray menu (right-click)
            let quit_item = MenuItem::with_id(
                app,
                TrayMenuId::Quit.as_str(),
                "Quit OhMyC",
                true,
                Some("CmdOrCtrl+Q"),
            )?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            // Tray icon
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if let Some(TrayMenuId::Quit) = TrayMenuId::from_id(event.id.as_ref()) {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, rect, .. } = event {
                        let button_str = match button {
                            MouseButton::Left => "Left",
                            MouseButton::Right => "Right",
                            _ => return,
                        };
                        let state_str = match button_state {
                            MouseButtonState::Up => "Up",
                            MouseButtonState::Down => "Down",
                        };
                        let Some(click) = classify_click(button_str, state_str) else {
                            return;
                        };
                        let app = tray.app_handle();
                        let pos = rect.position.to_physical::<i32>(1.0);
                        let sz = rect.size.to_physical::<u32>(1.0);
                        match click {
                            TrayClick::Left => {
                                toggle_popover(
                                    app,
                                    pos.x,
                                    pos.y,
                                    sz.width,
                                    sz.height,
                                );
                            }
                            TrayClick::Right => {
                                // Menu shows automatically via .menu(&menu).
                            }
                        }
                    }
                })
                .build(app)?;

            // Focus-loss auto-hide for popover
            let popover_window = app.get_webview_window("popover").unwrap();
            let app_handle = app.handle().clone();
            popover_window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    if let Some(win) = app_handle.get_webview_window("popover") {
                        let _ = win.hide();
                        let guard = app_handle.state::<PopoverGuard>();
                        let mut state = guard.0.lock().unwrap();
                        *state = state.hide();
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_popover(
    app: &tauri::AppHandle,
    tray_x: i32,
    tray_y: i32,
    tray_w: u32,
    tray_h: u32,
) {
    let guard = app.state::<PopoverGuard>();
    let mut state = guard.0.lock().unwrap();
    let Some(window) = app.get_webview_window("popover") else { return };

    match *state {
        PopoverState::Hidden => {
            let size = window.outer_size().unwrap_or(PhysicalSize::new(360, 440));
            let monitor = window
                .current_monitor()
                .ok()
                .flatten()
                .map(|m| MonitorBounds {
                    x: m.position().x,
                    y: m.position().y,
                    width: m.size().width,
                    height: m.size().height,
                })
                .unwrap_or(MonitorBounds {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                });

            let tray = TrayRect {
                x: tray_x,
                y: tray_y,
                width: tray_w,
                height: tray_h,
            };
            let pos = position_under_tray(tray, size, monitor);
            let _ = window.set_position(pos);
            let _ = window.show();
            let _ = window.set_focus();
            *state = state.show();
        }
        PopoverState::Visible => {
            let _ = window.hide();
            *state = state.hide();
        }
    }
}
