use crate::model::{AppError, AppResult};
use std::sync::Mutex;
use tauri::{LogicalSize, PhysicalPosition, PhysicalSize, WebviewWindow};

struct WindowGeometry {
    size: PhysicalSize<u32>,
    position: PhysicalPosition<i32>,
    maximized: bool,
    fullscreen: bool,
    decorated: bool,
    resizable: bool,
    maximizable: bool,
}

#[derive(Default)]
pub struct WindowMode {
    saved: Mutex<Option<WindowGeometry>>,
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
            });
            window.set_fullscreen(false)?;
            window.unmaximize()?;
            window.set_decorations(false)?;
            // 必须先放开普通窗口的 600×520 下限，再调整为参考图的横向小窗。
            window.set_min_size(Some(LogicalSize::new(440.0, 250.0)))?;
            window.set_size(LogicalSize::new(560.0, 310.0))?;
            window.set_resizable(false)?;
            window.set_maximizable(false)?;
            Ok(())
        })();
        if result.is_err() {
            if let Some(geometry) = saved.as_ref() {
                if restore(window, geometry).is_ok() {
                    *saved = None;
                }
            }
        }
        result.map_err(|error| AppError::new("WINDOW", error))
    }

    pub fn restore(&self, window: &WebviewWindow) -> AppResult<()> {
        let mut saved = self
            .saved
            .lock()
            .map_err(|_| AppError::new("WINDOW", "窗口状态不可用"))?;
        if let Some(geometry) = saved.as_ref() {
            restore(window, geometry).map_err(|error| AppError::new("WINDOW", error))?;
            *saved = None;
        }
        Ok(())
    }
}

fn restore(window: &WebviewWindow, geometry: &WindowGeometry) -> tauri::Result<()> {
    window.set_resizable(geometry.resizable)?;
    window.set_maximizable(geometry.maximizable)?;
    window.set_decorations(geometry.decorated)?;
    window.set_min_size(Some(LogicalSize::new(600.0, 520.0)))?;
    window.set_size(geometry.size)?;
    window.set_position(geometry.position)?;
    if geometry.maximized {
        window.maximize()?;
    }
    window.set_fullscreen(geometry.fullscreen)
}
