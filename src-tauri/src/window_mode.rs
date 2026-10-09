use crate::model::{AppError, AppResult};
use crate::window_dock::WindowDock;
use std::sync::Mutex;
#[cfg(windows)]
use tauri::utils::config::WindowEffectsConfig;
use tauri::{LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

struct WindowGeometry {
    size: PhysicalSize<u32>,
    position: PhysicalPosition<i32>,
    maximized: bool,
    fullscreen: bool,
    decorated: bool,
    resizable: bool,
    maximizable: bool,
    always_on_top: bool,
    appearance: WindowAppearance,
}

#[derive(Default)]
pub struct WindowMode {
    saved: Mutex<Option<WindowGeometry>>,
    dock: WindowDock,
}

impl WindowMode {
    pub fn compact(&self, window: &WebviewWindow) -> AppResult<()> {
        let mut saved = self
            .saved
            .lock()
            .map_err(|_| AppError::new("WINDOW", "窗口状态不可用"))?;
        if saved.is_some() {
            return Ok(());
        }
        let result = (|| -> tauri::Result<()> {
            *saved = Some(WindowGeometry {
                size: window.inner_size()?,
                position: window.outer_position()?,
                maximized: window.is_maximized()?,
                fullscreen: window.is_fullscreen()?,
                decorated: window.is_decorated()?,
                resizable: window.is_resizable()?,
                maximizable: window.is_maximizable()?,
                always_on_top: window.is_always_on_top()?,
                appearance: WindowAppearance::capture(window)?,
            });
            window.set_fullscreen(false)?;
            window.unmaximize()?;
            window.set_decorations(false)?;
            window.set_resizable(false)?;
            window.set_maximizable(false)?;
            // Keep the narrow reveal edge reachable while another app has focus.
            window.set_always_on_top(true)?;
            if let Some(geometry) = saved.as_ref() {
                geometry.appearance.compact(window)?;
            }
            // Resolve the native frame first so 560×310 measures the final transparent client area.
            // 必须先放开普通窗口的 600×520 下限，再调整为参考图的横向小窗。
            window.set_min_size(Some(LogicalSize::new(440.0, 250.0)))?;
            window.set_size(LogicalSize::new(560.0, 310.0))?;
            Ok(())
        })()
        .map_err(|error| AppError::new("WINDOW", error))
        .and_then(|_| self.dock.enter(window));
        if result.is_err() {
            if let Some(geometry) = saved.as_ref() {
                if self.restore_window(window, geometry).is_ok() {
                    *saved = None;
                }
            }
        }
        result
    }

    pub fn restore(&self, window: &WebviewWindow) -> AppResult<()> {
        let mut saved = self
            .saved
            .lock()
            .map_err(|_| AppError::new("WINDOW", "窗口状态不可用"))?;
        if let Some(geometry) = saved.as_ref() {
            self.restore_window(window, geometry)?;
            *saved = None;
        }
        Ok(())
    }

    pub fn set_hidden(
        &self,
        window: &WebviewWindow,
        hidden: bool,
        reduced_motion: bool,
    ) -> AppResult<()> {
        // Dock state is confined to the main thread and ignores inactive windows.
        // Tray callbacks must not wait on a mode lock held by a dispatched restore.
        self.dock.set_hidden(window, hidden, reduced_motion)
    }

    fn restore_window(&self, window: &WebviewWindow, geometry: &WindowGeometry) -> AppResult<()> {
        // Stop pending slide frames and remove the edge clipping before restoring the main view.
        self.dock.leave(window)?;
        restore(window, geometry).map_err(|error| AppError::new("WINDOW", error))
    }
}

fn restore(window: &WebviewWindow, geometry: &WindowGeometry) -> tauri::Result<()> {
    window.set_resizable(geometry.resizable)?;
    window.set_maximizable(geometry.maximizable)?;
    window.set_always_on_top(geometry.always_on_top)?;
    window.set_decorations(geometry.decorated)?;
    geometry.appearance.restore(window)?;
    window.set_min_size(Some(LogicalSize::new(600.0, 520.0)))?;
    window.set_size(geometry.size)?;
    window.set_position(geometry.position)?;
    if geometry.maximized {
        window.maximize()?;
    }
    window.set_fullscreen(geometry.fullscreen)
}

struct WindowAppearance {
    shadow: bool,
    #[cfg(windows)]
    effects: Option<WindowEffectsConfig>,
    #[cfg(windows)]
    frame: NativeFrame,
}

impl WindowAppearance {
    fn capture(window: &WebviewWindow) -> tauri::Result<Self> {
        // Tauri exposes no shadow/effect getters; these settings are only changed by this mode.
        let config = window
            .app_handle()
            .config()
            .app
            .windows
            .iter()
            .find(|config| config.label == window.label());
        Ok(Self {
            shadow: config.map(|config| config.shadow).unwrap_or(true),
            #[cfg(windows)]
            effects: config.and_then(|config| config.window_effects.clone()),
            #[cfg(windows)]
            frame: NativeFrame::capture(window)?,
        })
    }

    fn compact(&self, window: &WebviewWindow) -> tauri::Result<()> {
        // The native shadow adds a white 1px border and Windows 11 rounded corners.
        window.set_shadow(false)?;
        #[cfg(windows)]
        {
            self.frame.apply(window, true)?;
            // A whole-HWND Acrylic surface stays visible behind the clipped WebView.
            // Keep the native surface transparent; the player paints its own glass panel.
            window.set_effects(None::<WindowEffectsConfig>)?;
        }
        Ok(())
    }

    fn restore(&self, window: &WebviewWindow) -> tauri::Result<()> {
        #[cfg(windows)]
        {
            window.set_effects(None::<WindowEffectsConfig>)?;
            if let Some(effects) = self.effects.as_ref() {
                window.set_effects(effects.clone())?;
            }
        }
        window.set_shadow(self.shadow)?;
        #[cfg(windows)]
        self.frame.apply(window, false)?;
        Ok(())
    }
}

#[cfg(windows)]
struct NativeFrame {
    corner: Option<u32>,
    border_color: Option<u32>,
    dark_mode: Option<u32>,
}

#[cfg(windows)]
impl NativeFrame {
    fn capture(window: &WebviewWindow) -> tauri::Result<Self> {
        use windows_sys::Win32::Graphics::Dwm::{
            DWMWA_BORDER_COLOR, DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_WINDOW_CORNER_PREFERENCE,
        };

        let hwnd = window.hwnd()?.0 as _;
        Ok(Self {
            corner: read_dwm_attribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE),
            border_color: read_dwm_attribute(hwnd, DWMWA_BORDER_COLOR),
            dark_mode: read_dwm_attribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE),
        })
    }

    fn apply(&self, window: &WebviewWindow, compact: bool) -> tauri::Result<()> {
        use windows_sys::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_COLOR_NONE,
            DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
        };

        let hwnd = window.hwnd()?.0 as usize;
        let attributes = [
            (
                DWMWA_WINDOW_CORNER_PREFERENCE,
                self.corner,
                DWMWCP_DONOTROUND as u32,
            ),
            (DWMWA_BORDER_COLOR, self.border_color, DWMWA_COLOR_NONE),
            (DWMWA_USE_IMMERSIVE_DARK_MODE, self.dark_mode, 1),
        ];
        window.run_on_main_thread(move || {
            for (attribute, original, wallpaper_value) in attributes {
                // Older Windows versions do not implement every attribute. Only change values
                // that can be restored, and leave unsupported preferences to the system.
                if let Some(original) = original {
                    let value = if compact { wallpaper_value } else { original };
                    unsafe {
                        let _ = DwmSetWindowAttribute(
                            hwnd as _,
                            attribute as u32,
                            (&value as *const u32).cast(),
                            std::mem::size_of::<u32>() as u32,
                        );
                    }
                }
            }
        })
    }
}

#[cfg(windows)]
fn read_dwm_attribute(
    hwnd: windows_sys::Win32::Foundation::HWND,
    attribute: windows_sys::Win32::Graphics::Dwm::DWMWINDOWATTRIBUTE,
) -> Option<u32> {
    let mut value = 0_u32;
    let result = unsafe {
        windows_sys::Win32::Graphics::Dwm::DwmGetWindowAttribute(
            hwnd,
            attribute as u32,
            (&mut value as *mut u32).cast(),
            std::mem::size_of::<u32>() as u32,
        )
    };
    (result >= 0).then_some(value)
}
