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
#[derive(Default)]
struct WallpaperState {
    generation: u64,
    applying: bool,
    status: WallpaperStatus,
    labels: Vec<String>,
}
impl WallpaperState {
    fn stop(&mut self) {
        self.generation += 1;
        self.applying = false;
        self.status = WallpaperStatus::default();
        self.labels.clear();
    }
}

#[derive(Default)]
pub struct WallpaperService {
    state: Mutex<WallpaperState>,
    // 只有后台线程等待此锁，主线程停用壁纸不会阻塞窗口创建。
    operation: Mutex<()>,
}

impl WallpaperService {
    pub fn status(&self) -> AppResult<WallpaperStatus> {
        self.state
            .lock()
            .map(|state| state.status.clone())
            .map_err(|_| AppError::new("WALLPAPER", "壁纸状态不可用"))
    }

    fn current(&self, generation: u64) -> bool {
        self.state
            .lock()
            .is_ok_and(|state| state.generation == generation)
    }

    fn begin(&self, expected: Option<u64>) -> AppResult<Option<u64>> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| AppError::new("WALLPAPER", "壁纸状态不可用"))?;
        // 恢复线程不能重新启用已经被用户停用或修改的显示器。
        if expected.is_some_and(|generation| state.generation != generation || state.applying) {
            return Ok(None);
        }
        state.generation += 1;
        state.applying = true;
        Ok(Some(state.generation))
    }

    fn finish(
        &self,
        generation: u64,
        status: WallpaperStatus,
        labels: Vec<String>,
    ) -> AppResult<Option<WallpaperStatus>> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| AppError::new("WALLPAPER", "壁纸状态不可用"))?;
        if state.generation != generation {
            return Ok(None);
        }
        state.status = status.clone();
        state.labels = labels;
        state.applying = false;
        Ok(Some(status))
    }
}

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
    let service = app.state::<crate::AppState>();
    if let Ok(mut state) = service.wallpaper.state.lock() {
        state.stop();
        // 在失效标记内取得旧窗口列表，稍后的启用不会被本次停用销毁。
        let windows = wallpaper_windows(app);
        let _ = app.emit("wallpaper:status", &state.status);
        drop(state);
        destroy_windows(windows);
    };
}

fn wallpaper_windows(app: &AppHandle) -> Vec<tauri::WebviewWindow> {
    app.webview_windows()
        .into_values()
        .filter(|window| window.label().starts_with("wallpaper-"))
        .collect()
}

fn destroy_windows(windows: Vec<tauri::WebviewWindow>) {
    for window in windows {
        let _ = window.hide();
        let _ = window.destroy();
    }
}

pub fn enable(app: &AppHandle, ids: Vec<String>) -> AppResult<WallpaperStatus> {
    enable_if_current(app, ids, None)
}

fn window_label(generation: u64, index: usize) -> String {
    format!("wallpaper-{generation}-{index}")
}

fn enable_if_current(
    app: &AppHandle,
    ids: Vec<String>,
    expected: Option<u64>,
) -> AppResult<WallpaperStatus> {
    let app_state = app.state::<crate::AppState>();
    let service = &app_state.wallpaper;
    let Some(generation) = service.begin(expected)? else {
        return service.status();
    };
    let _operation = service
        .operation
        .lock()
        .map_err(|_| AppError::new("WALLPAPER", "壁纸操作不可用"))?;
    if !service.current(generation) {
        return service.status();
    }
    let mut created = Vec::new();
    let mut changed = false;
    let result = (|| {
        let monitors = displays(app)?;
        if ids
            .iter()
            .any(|id| !monitors.iter().any(|display| &display.id == id))
        {
            return Err(AppError::new("DISPLAY", "显示器已断开，请刷新显示器列表"));
        }
        let selected: Vec<_> = monitors
            .iter()
            .filter(|display| ids.contains(&display.id))
            .collect();
        let ids: Vec<_> = selected.iter().map(|display| display.id.clone()).collect();
        let (existing_ids, existing_labels) = {
            let existing = service
                .state
                .lock()
                .map_err(|_| AppError::new("WALLPAPER", "壁纸状态不可用"))?;
            (existing.status.enabled.clone(), existing.labels.clone())
        };
        if (!ids.is_empty() || wallpaper_windows(app).is_empty())
            && existing_ids == ids
            && existing_labels.len() == ids.len()
            && existing_labels.iter().all(|label| {
                app.get_webview_window(label)
                    .is_some_and(|window| attached(&window))
            })
        {
            for (label, monitor) in existing_labels.iter().zip(&selected) {
                if !service.current(generation) {
                    return service.status();
                }
                if let Some(window) = app.get_webview_window(label) {
                    attach(&window, monitor)?;
                }
            }
            created = existing_labels;
            return Ok(WallpaperStatus {
                enabled: ids,
                error: None,
            });
        }
        if !service.current(generation) {
            return service.status();
        }
        changed = true;
        destroy_windows(wallpaper_windows(app));
        for (index, monitor) in selected.into_iter().enumerate() {
            if !service.current(generation) {
                return service.status();
            }
            // destroy 是异步的；新一代标签永远不会与尚未注销的旧窗口重名。
            let label = window_label(generation, index);
            #[cfg(windows)]
            let host = find_desktop_host()?;
            let window = WebviewWindowBuilder::new(
                app,
                &label,
                WebviewUrl::App("index.html?wallpaper=1".into()),
            )
            .title("SOEI Wallpaper")
            .decorations(false)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .closable(false)
            .focusable(false)
            .shadow(false)
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
            );
            // 告知窗口库真实父窗口，避免 show/输入设置重新写回普通窗口样式。
            #[cfg(windows)]
            let window = window.parent_raw(windows::Win32::Foundation::HWND(host));
            let window = window
                .build()
                .map_err(|error| AppError::new("WALLPAPER_WINDOW", error))?;
            created.push(label);
            window
                .set_ignore_cursor_events(true)
                .map_err(|error| AppError::new("WALLPAPER_INPUT", error))?;
            window
                .show()
                .map_err(|error| AppError::new("WALLPAPER_WINDOW", error))?;
            attach(&window, monitor)?;
        }
        Ok(WallpaperStatus {
            enabled: ids,
            error: None,
        })
    })();
    // 停用或较新的启用已覆盖此请求，仅清理本次新建的窗口。
    if !service.current(generation) {
        if changed {
            destroy_windows(
                created
                    .iter()
                    .filter_map(|label| app.get_webview_window(label))
                    .collect(),
            );
        }
        return service.status();
    }
    let status = match result {
        Ok(status) => status,
        Err(error) => {
            if changed {
                destroy_windows(
                    created
                        .iter()
                        .filter_map(|label| app.get_webview_window(label))
                        .collect(),
                );
            }
            let mut status = service.status()?;
            if changed {
                status.enabled.clear();
            }
            status.error = Some(error.message.clone());
            let labels = if changed {
                vec![]
            } else {
                service
                    .state
                    .lock()
                    .map(|state| state.labels.clone())
                    .unwrap_or_default()
            };
            if let Some(status) = service.finish(generation, status, labels)? {
                let _ = app.emit("wallpaper:status", status);
            }
            return Err(error);
        }
    };
    if let Some(status) = service.finish(generation, status, created.clone())? {
        let _ = app.emit("wallpaper:status", &status);
        return Ok(status);
    }
    if changed {
        destroy_windows(
            created
                .iter()
                .filter_map(|label| app.get_webview_window(label))
                .collect(),
        );
    }
    service.status()
}

#[cfg(windows)]
fn find_desktop_host() -> AppResult<windows_sys::Win32::Foundation::HWND> {
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM},
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
    }
    Ok(host)
}

#[cfg(windows)]
fn attach(window: &tauri::WebviewWindow, display: &Display) -> AppResult<()> {
    // 所有普通窗口操作先完成，再在所属线程中固定子窗口样式和物理尺寸。
    let handle = window
        .hwnd()
        .map_err(|error| AppError::new("WALLPAPER_HANDLE", error))?
        .0 as usize;
    let display = display.clone();
    let (reply, result) = std::sync::mpsc::channel();
    window
        .run_on_main_thread(move || {
            let _ = reply.send(attach_handle(handle as _, &display));
        })
        .map_err(|error| AppError::new("WALLPAPER_ATTACH", error))?;
    result
        .recv()
        .map_err(|error| AppError::new("WALLPAPER_ATTACH", error))?
}

#[cfg(windows)]
fn child_styles(style: isize, extended: isize) -> (isize, isize) {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    (
        (style & !((WS_POPUP | WS_OVERLAPPEDWINDOW) as isize)) | WS_CHILD as isize,
        (extended & !((WS_EX_APPWINDOW | WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE) as isize))
            | (WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW) as isize,
    )
}

#[cfg(windows)]
fn attach_handle(handle: windows_sys::Win32::Foundation::HWND, display: &Display) -> AppResult<()> {
    use windows_sys::Win32::{
        Foundation::POINT, Graphics::Gdi::MapWindowPoints, UI::WindowsAndMessaging::*,
    };
    let host = find_desktop_host()?;
    unsafe {
        if IsWindow(handle) == 0 {
            return Err(AppError::new("WALLPAPER_HANDLE", "壁纸窗口已经关闭"));
        }
        let (style, extended) = child_styles(
            GetWindowLongPtrW(handle, GWL_STYLE),
            GetWindowLongPtrW(handle, GWL_EXSTYLE),
        );
        SetWindowLongPtrW(handle, GWL_STYLE, style);
        SetWindowLongPtrW(handle, GWL_EXSTYLE, extended);
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
            HWND_BOTTOM,
            origin.x,
            origin.y,
            display.width as i32,
            display.height as i32,
            SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
        ) == 0
        {
            return Err(AppError::new("WALLPAPER_SIZE", "无法调整壁纸窗口"));
        }
    }
    Ok(())
}

#[cfg(windows)]
fn attached(window: &tauri::WebviewWindow) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    window.hwnd().is_ok_and(|handle| unsafe {
        let parent = GetParent(handle.0);
        let mut class = [0u16; 32];
        let length = GetClassNameW(parent, class.as_mut_ptr(), class.len() as i32);
        let style = GetWindowLongPtrW(handle.0, GWL_STYLE) as u32;
        IsWindow(parent) != 0
            && style & WS_CHILD != 0
            && style & WS_CAPTION == 0
            && String::from_utf16_lossy(&class[..length.max(0) as usize]) == "WorkerW"
    })
}
#[cfg(not(windows))]
fn attached(_: &tauri::WebviewWindow) -> bool {
    false
}
#[cfg(not(windows))]
fn attach(_: &tauri::WebviewWindow, _: &Display) -> AppResult<()> {
    Err(AppError::new("PLATFORM", "桌面壁纸只支持 Windows"))
}

pub fn start_recovery(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            let state = app.state::<crate::AppState>();
            let (generation, ids, labels) = match state.wallpaper.state.lock() {
                Ok(state) if !state.applying && !state.status.enabled.is_empty() => (
                    state.generation,
                    state.status.enabled.clone(),
                    state.labels.clone(),
                ),
                _ => continue,
            };
            // 不检查已销毁但尚未注销的旧窗口，也能发现所有壁纸窗口都丢失的情况。
            let broken = labels.len() != ids.len()
                || labels.iter().any(|label| {
                    app.get_webview_window(label)
                        .is_none_or(|window| !attached(&window))
                });
            if broken {
                // WebView2 创建须留在后台线程，不能放到主线程事件回调内。
                if let Err(error) = enable_if_current(&app, ids, Some(generation)) {
                    let _ = app.emit_to(
                        "main",
                        "app:error",
                        format!("壁纸恢复失败：{}", error.message),
                    );
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repeated_apply_and_stop_never_reuse_a_pending_window_label() {
        let service = WallpaperService::default();
        let first = service.begin(None).unwrap().unwrap();
        let first_label = window_label(first, 0);
        service
            .finish(
                first,
                WallpaperStatus {
                    enabled: vec!["display".into()],
                    error: None,
                },
                vec![first_label.clone()],
            )
            .unwrap();
        service.state.lock().unwrap().stop();
        let next = service.begin(None).unwrap().unwrap();
        assert_ne!(first_label, window_label(next, 0));
        assert!(window_label(next, 0).starts_with("wallpaper-"));
    }

    #[test]
    fn newer_apply_or_stop_prevents_old_completion_and_recovery() {
        let service = WallpaperService::default();
        let first = service.begin(None).unwrap().unwrap();
        let next = service.begin(None).unwrap().unwrap();
        assert!(service
            .finish(
                first,
                WallpaperStatus {
                    enabled: vec!["old".into()],
                    error: None
                },
                vec![window_label(first, 0)]
            )
            .unwrap()
            .is_none());
        service.state.lock().unwrap().stop();
        assert!(!service.current(next));
        assert!(service.begin(Some(next)).unwrap().is_none());
        assert!(service
            .finish(
                next,
                WallpaperStatus {
                    enabled: vec!["display".into()],
                    error: None
                },
                vec![window_label(next, 0)]
            )
            .unwrap()
            .is_none());
        assert!(service.status().unwrap().enabled.is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn desktop_child_has_no_title_bar_and_preserves_click_through() {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        let (style, extended) = child_styles(
            (WS_POPUP | WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN) as isize,
            (WS_EX_APPWINDOW | WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE | WS_EX_LAYERED) as isize,
        );
        assert_ne!(style & WS_CHILD as isize, 0);
        assert_ne!(style & WS_CLIPCHILDREN as isize, 0);
        assert_eq!(style & (WS_POPUP | WS_OVERLAPPEDWINDOW) as isize, 0);
        assert_eq!(
            extended & (WS_EX_APPWINDOW | WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE) as isize,
            0
        );
        for flag in [
            WS_EX_LAYERED,
            WS_EX_TRANSPARENT,
            WS_EX_NOACTIVATE,
            WS_EX_TOOLWINDOW,
        ] {
            assert_ne!(extended & flag as isize, 0);
        }
    }
}
