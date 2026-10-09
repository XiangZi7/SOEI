mod audio;
mod commands;
mod library;
mod model;
mod storage;
mod wallpaper;
mod window_mode;

use std::{path::PathBuf, sync::atomic::AtomicBool};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub struct AppState {
    storage: storage::Storage,
    audio: audio::AudioService,
    cache_dir: PathBuf,
    scan_cancel: AtomicBool,
    scan_busy: AtomicBool,
    wallpaper: wallpaper::WallpaperService,
    window_mode: window_mode::WindowMode,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::library_load,
            commands::library_test_track,
            commands::library_import,
            commands::library_cancel,
            commands::library_favorite,
            commands::player_snapshot,
            commands::player_command,
            commands::scene_track,
            commands::lyrics_import,
            commands::settings_open,
            commands::settings_load,
            commands::settings_save,
            commands::display_list,
            commands::wallpaper_set_enabled,
            commands::wallpaper_status,
            commands::visual_import,
            commands::window_action,
            commands::shortcuts_set
        ])
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            let cache = data.join("covers");
            std::fs::create_dir_all(&cache)?;
            let storage = storage::Storage::open(&data.join("soei.sqlite3"))
                .map_err(|error| std::io::Error::other(error.message))?;
            for track in storage.tracks().unwrap_or_default() {
                if let Some(path) = track.cover_ref {
                    let _ = app.asset_protocol_scope().allow_file(path);
                }
            }
            if let Ok(settings) = storage.settings() {
                if let Some(background) =
                    settings.get("background").and_then(|value| value.as_str())
                {
                    let _ = app.asset_protocol_scope().allow_file(background);
                }
            }
            let audio = audio::AudioService::start(app.handle().clone());
            app.manage(AppState {
                storage,
                audio,
                cache_dir: cache,
                scan_cancel: AtomicBool::new(false),
                scan_busy: AtomicBool::new(false),
                wallpaper: wallpaper::WallpaperService::default(),
                window_mode: window_mode::WindowMode::default(),
            });
            let open = MenuItem::with_id(app, "open", "打开 SOEI", true, None::<&str>)?;
            let toggle = MenuItem::with_id(app, "toggle", "播放 / 暂停", true, None::<&str>)?;
            let previous = MenuItem::with_id(app, "previous", "上一首", true, None::<&str>)?;
            let next = MenuItem::with_id(app, "next", "下一首", true, None::<&str>)?;
            let wall = MenuItem::with_id(app, "wallpaper", "桌面壁纸", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出 SOEI", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &toggle, &previous, &next, &wall, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .tooltip("SOEI · Music Space")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => {
                        wallpaper::stop(app);
                        app.exit(0);
                    }
                    "wallpaper" => {
                        show_main(app);
                        let _ = app.emit_to("main", "ui:wallpaper", ());
                    }
                    action => {
                        let action = action.to_string();
                        let handle = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            let operation = match action.as_str() {
                                "toggle" => audio::Operation::Toggle,
                                "previous" => audio::Operation::Previous,
                                "next" => audio::Operation::Next,
                                _ => return,
                            };
                            let _ = handle.state::<AppState>().audio.request(operation);
                        });
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(event, TrayIconEvent::DoubleClick { .. }) {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            wallpaper::start_recovery(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let hide = window
                        .state::<AppState>()
                        .storage
                        .settings()
                        .ok()
                        .and_then(|value| {
                            value.get("closeToTray").and_then(|value| value.as_bool())
                        })
                        .unwrap_or(false);
                    if hide {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        wallpaper::stop(window.app_handle());
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("SOEI initialization failed; original media and database are preserved");
    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            wallpaper::stop(app);
        }
    });
}
fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
