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
        .invoke_handler(tauri::generate_handler![
            hide_popover,
            ohmyc_desktop_lib::windows::open_main_window,
            ohmyc_desktop_lib::api::timeline::timeline_heatmap,
            ohmyc_desktop_lib::api::timeline::timeline_events,
            ohmyc_desktop_lib::api::timeline::timeline_session,
            ohmyc_desktop_lib::api::timeline::timeline_projects,
            ohmyc_desktop_lib::api::timeline::timeline_years,
            ohmyc_desktop_lib::api::timeline::timeline_status,
            ohmyc_desktop_lib::api::setup::setup_status,
            ohmyc_desktop_lib::api::agents::agents_list,
            ohmyc_desktop_lib::api::agents::agents_get,
            ohmyc_desktop_lib::api::skills::skills_list,
            ohmyc_desktop_lib::api::skills::skills_get,
            ohmyc_desktop_lib::api::commands::commands_list,
            ohmyc_desktop_lib::api::commands::commands_get,
            ohmyc_desktop_lib::api::settings::settings_get,
            ohmyc_desktop_lib::api::settings::settings_set,
            ohmyc_desktop_lib::api::configs::configs_mcp,
            ohmyc_desktop_lib::api::configs::configs_hooks,
            ohmyc_desktop_lib::api::configs::configs_lsp,
            ohmyc_desktop_lib::api::store::store_agents_list,
            ohmyc_desktop_lib::api::store::store_agents_get,
            ohmyc_desktop_lib::api::store::store_agents_create,
            ohmyc_desktop_lib::api::store::store_agents_update,
            ohmyc_desktop_lib::api::store::store_agents_delete,
            ohmyc_desktop_lib::api::store::store_skills_list,
            ohmyc_desktop_lib::api::store::store_skills_get,
            ohmyc_desktop_lib::api::store::store_skills_create,
            ohmyc_desktop_lib::api::store::store_skills_update,
            ohmyc_desktop_lib::api::store::store_skills_delete,
            ohmyc_desktop_lib::api::store::store_commands_list,
            ohmyc_desktop_lib::api::store::store_commands_get,
            ohmyc_desktop_lib::api::store::store_commands_create,
            ohmyc_desktop_lib::api::store::store_commands_update,
            ohmyc_desktop_lib::api::store::store_commands_delete,
            ohmyc_desktop_lib::api::store::store_model_configs_list,
            ohmyc_desktop_lib::api::store::store_model_configs_get,
            ohmyc_desktop_lib::api::store::store_model_configs_create,
            ohmyc_desktop_lib::api::store::store_model_configs_update,
            ohmyc_desktop_lib::api::store::store_model_configs_delete,
            ohmyc_desktop_lib::api::plugins::plugins_list,
            ohmyc_desktop_lib::api::plugins::plugins_get,
            ohmyc_desktop_lib::api::plugins::marketplaces_list,
            ohmyc_desktop_lib::api::plugins::marketplaces_get,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Tray menu (right-click)
            let open_item = MenuItem::with_id(
                app,
                TrayMenuId::OpenMain.as_str(),
                "Open OhMyC",
                true,
                Some("CmdOrCtrl+O"),
            )?;
            let quit_item = MenuItem::with_id(app, TrayMenuId::Quit.as_str(), "Quit OhMyC", true, Some("CmdOrCtrl+Q"))?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            // Tray icon
            let _tray = TrayIconBuilder::with_id("main")
                .icon(tauri::include_image!("icons/mac-computer-tray-Template@2x.png"))
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match TrayMenuId::from_id(event.id.as_ref()) {
                    Some(TrayMenuId::Quit) => app.exit(0),
                    Some(TrayMenuId::OpenMain) => {
                        let _ = ohmyc_desktop_lib::windows::open_main_window(app.clone());
                    }
                    None => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button,
                        button_state,
                        rect,
                        ..
                    } = event
                    {
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
                        match click {
                            TrayClick::Left => {
                                let pos = rect.position.to_physical::<i32>(1.0);
                                let sz = rect.size.to_physical::<u32>(1.0);
                                toggle_popover(
                                    app,
                                    TrayRect {
                                        x: pos.x,
                                        y: pos.y,
                                        width: sz.width,
                                        height: sz.height,
                                    },
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

            // The web layer paints the popover chrome. Avoid macOS vibrancy here:
            // it adds a second rounded shell around the opaque card and can wash
            // out small labels against light desktop content.
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

            // Filesystem watcher → frontend "fs:changed" events.
            ohmyc_desktop_lib::events::spawn_watcher(&app.handle().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn hide_popover(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("popover") {
        // Hide outside the lock to mirror toggle_popover's reentrancy-safe pattern.
        let _ = win.hide();
        *app.state::<PopoverGuard>().0.lock().unwrap() = PopoverState::Hidden;
    }
}

fn toggle_popover(app: &tauri::AppHandle, tray: TrayRect) {
    let guard = app.state::<PopoverGuard>();
    let Some(window) = app.get_webview_window("popover") else {
        return;
    };

    // Snapshot current state, drop lock before Tauri calls (avoid reentrancy
    // if WindowEvent::Focused fires synchronously and re-acquires the lock).
    let action = {
        let state = guard.0.lock().unwrap();
        *state
    };

    match action {
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

            let pos = position_under_tray(tray, size, monitor);
            let _ = window.set_position(pos);
            let _ = window.show();
            let _ = window.set_focus();
            *guard.0.lock().unwrap() = PopoverState::Visible;
        }
        PopoverState::Visible => {
            let _ = window.hide();
            *guard.0.lock().unwrap() = PopoverState::Hidden;
        }
    }
}
