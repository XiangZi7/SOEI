use crate::{
    audio::Operation,
    library,
    model::{AppError, AppResult, PlaybackSnapshot, Track},
    wallpaper::{self, Display, WallpaperStatus},
    AppState,
};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, State, WebviewWindow};

fn main_only(window: &WebviewWindow) -> AppResult<()> {
    if window.label() != "main" {
        return Err(AppError::new("PERMISSION", "此窗口只允许读取播放场景"));
    }
    Ok(())
}
#[tauri::command]
pub fn library_load(window: WebviewWindow, state: State<AppState>) -> AppResult<Vec<Track>> {
    main_only(&window)?;
    state.storage.tracks()
}
#[tauri::command]
pub fn library_test_track(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> AppResult<Track> {
    main_only(&window)?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::new("TEST_TRACK", error))?
        .join("playback-test");
    let mut track = library::create_test_track(&directory, &state.cache_dir)?;
    if let Ok(existing) = state.storage.track(&track.id) {
        track.favorite = existing.favorite;
        track.last_played = existing.last_played;
    }
    state.storage.save_track(&track)?;
    Ok(track)
}
#[tauri::command]
pub async fn library_import(
    window: WebviewWindow,
    app: AppHandle,
    directory: bool,
) -> AppResult<bool> {
    main_only(&window)?;
    if app
        .state::<AppState>()
        .scan_busy
        .swap(true, Ordering::AcqRel)
    {
        return Err(AppError::new("SCAN_BUSY", "音乐库正在扫描"));
    }
    app.state::<AppState>()
        .scan_cancel
        .store(false, Ordering::Relaxed);
    let paths = tauri::async_runtime::spawn_blocking(move || {
        if directory {
            rfd::FileDialog::new()
                .set_title("选择音乐目录")
                .pick_folder()
                .map(|path| vec![path])
        } else {
            rfd::FileDialog::new()
                .set_title("导入本地音乐")
                .add_filter("音乐", &["mp3", "flac", "wav", "ogg", "m4a", "aac"])
                .pick_files()
        }
    })
    .await
    .map_err(|error| AppError::new("DIALOG", error));
    match paths {
        Ok(Some(paths)) => {
            std::thread::spawn(move || library::scan(app, paths));
            Ok(true)
        }
        Ok(None) => {
            app.state::<AppState>()
                .scan_busy
                .store(false, Ordering::Release);
            Ok(false)
        }
        Err(error) => {
            app.state::<AppState>()
                .scan_busy
                .store(false, Ordering::Release);
            Err(error)
        }
    }
}
#[tauri::command]
pub fn library_cancel(window: WebviewWindow, state: State<AppState>) -> AppResult<()> {
    main_only(&window)?;
    state.scan_cancel.store(true, Ordering::Relaxed);
    Ok(())
}
#[tauri::command]
pub fn library_favorite(
    window: WebviewWindow,
    state: State<AppState>,
    id: String,
) -> AppResult<Track> {
    main_only(&window)?;
    let mut track = state.storage.track(&id)?;
    track.favorite = !track.favorite;
    state.storage.save_track(&track)?;
    Ok(track)
}
#[tauri::command]
pub fn player_snapshot(state: State<AppState>) -> AppResult<PlaybackSnapshot> {
    state.audio.snapshot()
}
#[tauri::command]
pub async fn player_command(
    window: WebviewWindow,
    app: AppHandle,
    action: String,
    id: Option<String>,
    value: Option<f64>,
    mode: Option<String>,
    queue: Option<Vec<String>>,
) -> AppResult<PlaybackSnapshot> {
    main_only(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let operation = match action.as_str() {
            "play" => Operation::Play(
                state
                    .storage
                    .track(&id.ok_or_else(|| AppError::new("TRACK", "未指定歌曲"))?)?,
            ),
            "toggle" => Operation::Toggle,
            "next" => Operation::Next,
            "previous" => Operation::Previous,
            "stop" => Operation::Stop,
            "seek" => {
                let value = value.unwrap_or(0.0);
                if !value.is_finite() || value < 0.0 {
                    return Err(AppError::new("SEEK", "进度参数无效"));
                }
                Operation::Seek(value as u64)
            }
            "volume" => Operation::Volume(value.unwrap_or(0.65) as f32),
            "repeat" => Operation::Repeat(mode.unwrap_or_else(|| "sequential".into())),
            "queue" => {
                let ids = queue.unwrap_or_default();
                if ids.len() > 50_000 {
                    return Err(AppError::new("QUEUE_SIZE", "队列超过限制"));
                }
                Operation::Queue(
                    ids.into_iter()
                        .map(|id| state.storage.track(&id))
                        .collect::<AppResult<Vec<_>>>()?,
                )
            }
            _ => return Err(AppError::new("COMMAND", "未知播放命令")),
        };
        state.audio.request(operation)
    })
    .await
    .map_err(|error| AppError::new("AUDIO_TASK", error))?
}
#[tauri::command]
pub fn scene_track(state: State<AppState>, id: String) -> AppResult<(Track, Option<String>)> {
    let track = state.storage.track(&id)?;
    let lyrics = library::read_lyrics(&track)?;
    Ok((track, lyrics))
}
#[tauri::command]
pub async fn lyrics_import(
    window: WebviewWindow,
    app: AppHandle,
    id: String,
) -> AppResult<Option<String>> {
    main_only(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new()
            .set_title("选择 LRC 歌词")
            .add_filter("歌词", &["lrc"])
            .pick_file()
        else {
            return Ok(None);
        };
        let state = app.state::<AppState>();
        let mut track = state.storage.track(&id)?;
        track.lyric_ref = Some(path.canonicalize()?.to_string_lossy().into_owned());
        let text = library::read_lyrics(&track)?;
        state.storage.save_track(&track)?;
        Ok(text)
    })
    .await
    .map_err(|error| AppError::new("LYRICS", error))?
}
#[tauri::command]
pub fn settings_load(state: State<AppState>) -> AppResult<serde_json::Value> {
    state.storage.settings()
}
#[tauri::command]
pub fn settings_save(
    window: WebviewWindow,
    app: AppHandle,
    value: serde_json::Value,
) -> AppResult<()> {
    main_only(&window)?;
    app.state::<AppState>().storage.save_settings(&value)?;
    use tauri::Emitter;
    let _ = app.emit("settings:changed", &value);
    Ok(())
}
#[tauri::command]
pub fn display_list(window: WebviewWindow, app: AppHandle) -> AppResult<Vec<Display>> {
    main_only(&window)?;
    wallpaper::displays(&app)
}
#[tauri::command]
pub async fn wallpaper_set_enabled(
    window: WebviewWindow,
    app: AppHandle,
    ids: Vec<String>,
) -> AppResult<WallpaperStatus> {
    main_only(&window)?;
    tauri::async_runtime::spawn_blocking(move || wallpaper::enable(&app, ids))
        .await
        .map_err(|error| AppError::new("WALLPAPER", error))?
}
#[tauri::command]
pub fn wallpaper_status(state: State<AppState>) -> AppResult<WallpaperStatus> {
    state
        .wallpaper
        .0
        .lock()
        .map(|value| value.clone())
        .map_err(|_| AppError::new("WALLPAPER", "壁纸状态不可用"))
}
#[tauri::command]
pub async fn visual_import(window: WebviewWindow, app: AppHandle) -> AppResult<Option<String>> {
    main_only(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new()
            .set_title("选择场景背景")
            .add_filter("图片和视频", &["png", "jpg", "jpeg", "webp", "mp4", "webm"])
            .pick_file()
        else {
            return Ok(None);
        };
        let canonical = path.canonicalize()?;
        app.asset_protocol_scope()
            .allow_file(&canonical)
            .map_err(|error| AppError::new("ASSET_SCOPE", error))?;
        Ok(Some(canonical.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|error| AppError::new("BACKGROUND", error))?
}
#[tauri::command]
pub fn window_action(window: WebviewWindow, action: String) -> AppResult<()> {
    main_only(&window)?;
    match action.as_str() {
        "minimize" => window.minimize(),
        "maximize" => {
            if window.is_maximized().unwrap_or(false) {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "fullscreen" => window.set_fullscreen(!window.is_fullscreen().unwrap_or(false)),
        "borderless" => window.set_decorations(!window.is_decorated().unwrap_or(true)),
        "close" => window.close(),
        "drag" => window.start_dragging(),
        _ => return Err(AppError::new("WINDOW", "未知窗口操作")),
    }
    .map_err(|error| AppError::new("WINDOW", error))
}

#[tauri::command]
pub async fn shortcuts_set(
    window: WebviewWindow,
    app: AppHandle,
    bindings: std::collections::HashMap<String, String>,
) -> AppResult<()> {
    main_only(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
        let mut parsed = Vec::new();
        for (action, binding) in bindings {
            if binding.trim().is_empty() {
                continue;
            }
            if !["toggle", "next", "previous"].contains(&action.as_str()) || !binding.contains('+')
            {
                return Err(AppError::new(
                    "SHORTCUT",
                    "快捷键必须包含修饰键，且只能绑定播放操作",
                ));
            }
            let shortcut: Shortcut = binding
                .parse()
                .map_err(|error| AppError::new("SHORTCUT", error))?;
            if parsed
                .iter()
                .any(|(_, existing): &(String, Shortcut)| existing.id() == shortcut.id())
            {
                return Err(AppError::new("SHORTCUT", "同一个组合键不能绑定两个操作"));
            }
            parsed.push((action, shortcut));
        }
        app.global_shortcut()
            .unregister_all()
            .map_err(|error| AppError::new("SHORTCUT", error))?;
        for (action, shortcut) in parsed {
            let result = app
                .global_shortcut()
                .on_shortcut(shortcut, move |app, _, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let handle = app.clone();
                    let action = action.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        let operation = match action.as_str() {
                            "next" => Operation::Next,
                            "previous" => Operation::Previous,
                            _ => Operation::Toggle,
                        };
                        let _ = handle.state::<AppState>().audio.request(operation);
                    });
                });
            if let Err(error) = result {
                let _ = app.global_shortcut().unregister_all();
                return Err(AppError::new(
                    "SHORTCUT_CONFLICT",
                    format!("组合键注册失败，原绑定已清理：{error}"),
                ));
            }
        }
        Ok(())
    })
    .await
    .map_err(|error| AppError::new("SHORTCUT", error))?
}
