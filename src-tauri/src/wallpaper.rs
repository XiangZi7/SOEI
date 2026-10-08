use crate::model::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Display {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale: f64,
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperStatus {
    pub enabled: Vec<String>,
    pub error: Option<String>,
}
pub struct WallpaperService(pub Mutex<WallpaperStatus>);

pub fn displays(app: &AppHandle) -> AppResult<Vec<Display>> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::new("WINDOW", "主窗口不可用"))?;
    Ok(window
        .available_monitors()
        .map_err(|error| AppError::new("DISPLAY", error))?
        .into_iter()
        .map(|monitor| {
            let name = monitor
                .name()
                .cloned()
                .unwrap_or_else(|| format!("{}x{}", monitor.size().width, monitor.size().height));
            Display {
                id: name.clone(),
                name,
                width: monitor.size().width,
                height: monitor.size().height,
                x: monitor.position().x,
                y: monitor.position().y,
                scale: monitor.scale_factor(),
            }
        })
        .collect())
}
pub fn stop(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("wallpaper-") {
            let _ = window.destroy();
        }
    }
    if let Ok(mut status) = app.state::<crate::AppState>().wallpaper.0.lock() {
        *status = WallpaperStatus::default();
        let _ = app.emit("wallpaper:status", &*status);
    }
}
pub fn enable(app: &AppHandle, ids: Vec<String>) -> AppResult<WallpaperStatus> {
    stop(app);
    let result = (|| {
        let monitors = displays(app)?;
        if ids.len() > monitors.len()
            || ids
                .iter()
                .any(|id| !monitors.iter().any(|display| &display.id == id))
        {
            return Err(AppError::new("DISPLAY", "显示器已断开，请刷新显示器列表"));
        }
        for (index, monitor) in monitors
            .iter()
            .filter(|display| ids.contains(&display.id))
            .enumerate()
        {
            let window = WebviewWindowBuilder::new(
                app,
                format!("wallpaper-{index}"),
                WebviewUrl::App("index.html?wallpaper=1".into()),
            )
            .title("SOEI Wallpaper")
            .decorations(false)
            .resizable(false)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .position(
                monitor.x as f64 / monitor.scale,
                monitor.y as f64 / monitor.scale,
            )
            .inner_size(
                monitor.width as f64 / monitor.scale,
                monitor.height as f64 / monitor.scale,
            )
            .build()
            .map_err(|error| AppError::new("WALLPAPER_WINDOW", error))?;
            attach(&window, monitor)?;
            window
                .show()
                .map_err(|error| AppError::new("WALLPAPER_WINDOW", error))?;
        }
        Ok(WallpaperStatus {
            enabled: ids,
            error: None,
        })
    })();
    let status = match result {
        Ok(status) => status,
        Err(error) => {
            stop(app);
            let status = WallpaperStatus {
                enabled: vec![],
                error: Some(error.message.clone()),
            };
            if let Ok(mut target) = app.state::<crate::AppState>().wallpaper.0.lock() {
                *target = status.clone();
            }
            let _ = app.emit("wallpaper:status", status);
            return Err(error);
        }
    };
    if let Ok(mut target) = app.state::<crate::AppState>().wallpaper.0.lock() {
        *target = status.clone();
    }
    let _ = app.emit("wallpaper:status", &status);
    Ok(status)
}

#[cfg(windows)]
fn attach(window: &tauri::WebviewWindow, display: &Display) -> AppResult<()> {
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, POINT},
        Graphics::Gdi::MapWindowPoints,
        UI::WindowsAndMessaging::*,
    };
    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(Some(0)).collect()
    }
    unsafe extern "system" fn find_host(window: HWND, result: LPARAM) -> i32 {
        // result 仅在 EnumWindows 的同步调用期间引用有效的栈变量。
        let def_view = unsafe {
            FindWindowExW(
                window,
                std::ptr::null_mut(),
                wide("SHELLDLL_DefView").as_ptr(),
                std::ptr::null(),
            )
        };
        if !def_view.is_null() {
            let worker = unsafe {
                FindWindowExW(
                    std::ptr::null_mut(),
                    window,
                    wide("WorkerW").as_ptr(),
                    std::ptr::null(),
                )
            };
            if !worker.is_null() {
                unsafe {
                    *(result as *mut HWND) = worker;
                }
                return 0;
            }
            let child = unsafe {
                FindWindowExW(
                    window,
                    std::ptr::null_mut(),
                    wide("WorkerW").as_ptr(),
                    std::ptr::null(),
                )
            };
            if !child.is_null() {
                unsafe {
                    *(result as *mut HWND) = child;
                }
                return 0;
            }
        }
        1
    }
    let handle = window
        .hwnd()
        .map_err(|error| AppError::new("WALLPAPER_HANDLE", error))?
        .0;
    let mut host: HWND = std::ptr::null_mut();
    // 句柄由 Windows/Tauri 持有，只改变本应用窗口，退出时销毁子窗口。
    unsafe {
        let program = FindWindowW(wide("Progman").as_ptr(), std::ptr::null());
        if program.is_null() {
            return Err(AppError::new("WALLPAPER_HOST", "未找到 Windows 桌面宿主"));
        }
        let mut response = 0;
        SendMessageTimeoutW(
            program,
            0x052c,
            0x0d,
            1,
            SMTO_ABORTIFHUNG,
            1000,
            &mut response,
        );
        SendMessageTimeoutW(program, 0x052c, 0, 0, SMTO_ABORTIFHUNG, 1000, &mut response);
        EnumWindows(Some(find_host), &mut host as *mut HWND as LPARAM);
        if host.is_null() || IsWindow(host) == 0 {
            return Err(AppError::new(
                "WALLPAPER_HOST",
                "当前桌面宿主不可用，壁纸未启用",
            ));
        }
        let style = GetWindowLongPtrW(handle, GWL_STYLE);
        SetWindowLongPtrW(
            handle,
            GWL_STYLE,
            (style & !(WS_POPUP as isize)) | WS_CHILD as isize,
        );
        let extended = GetWindowLongPtrW(handle, GWL_EXSTYLE);
        SetWindowLongPtrW(
            handle,
            GWL_EXSTYLE,
            extended
                | WS_EX_TRANSPARENT as isize
                | WS_EX_NOACTIVATE as isize
                | WS_EX_TOOLWINDOW as isize,
        );
        SetParent(handle, host);
        if GetParent(handle) != host {
            return Err(AppError::new("WALLPAPER_PARENT", "桌面窗口附着失败"));
        }
        let mut origin = POINT {
            x: display.x,
            y: display.y,
        };
        MapWindowPoints(std::ptr::null_mut(), host, &mut origin, 1);
        if SetWindowPos(
            handle,
            std::ptr::null_mut(),
            origin.x,
            origin.y,
            display.width as i32,
            display.height as i32,
            SWP_NOACTIVATE | SWP_NOZORDER | SWP_FRAMECHANGED,
        ) == 0
        {
            return Err(AppError::new("WALLPAPER_SIZE", "无法调整壁纸窗口"));
        }
    }
    window
        .set_ignore_cursor_events(true)
        .map_err(|error| AppError::new("WALLPAPER_INPUT", error))?;
    Ok(())
}
#[cfg(not(windows))]
fn attach(_: &tauri::WebviewWindow, _: &Display) -> AppResult<()> {
    Err(AppError::new("PLATFORM", "桌面壁纸只支持 Windows"))
}

pub fn start_recovery(app: AppHandle) {
    std::thread::spawn(move || {
        let mut attempts = 0;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            let state = app.state::<crate::AppState>();
            let ids = match state.wallpaper.0.lock() {
                Ok(status) => status.enabled.clone(),
                Err(_) => continue,
            };
            if ids.is_empty() {
                attempts = 0;
                continue;
            }
            #[cfg(windows)]
            let broken = {
                use windows_sys::Win32::UI::WindowsAndMessaging::{GetParent, IsWindow};
                app.webview_windows()
                    .values()
                    .filter(|window| window.label().starts_with("wallpaper-"))
                    .any(|window| {
                        window
                            .hwnd()
                            .map_or(true, |handle| unsafe { IsWindow(GetParent(handle.0)) == 0 })
                    })
            };
            #[cfg(not(windows))]
            let broken = false;
            if broken {
                attempts += 1;
                let recovered = app.clone();
                let _ = app.run_on_main_thread(move || {
                    if attempts <= 3 {
                        let _ = enable(&recovered, ids);
                    } else {
                        stop(&recovered);
                        let _ = recovered.emit_to(
                            "main",
                            "app:error",
                            "壁纸宿主恢复失败，请重新启用壁纸",
                        );
                    }
                });
            }
        }
    });
}
