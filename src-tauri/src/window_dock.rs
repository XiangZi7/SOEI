use crate::model::{AppError, AppResult};
use tauri::{PhysicalPosition, WebviewWindow};

#[cfg(windows)]
use std::sync::Arc;
#[cfg(windows)]
use tauri::{Emitter, Manager};

const HANDLE_WIDTH: f64 = 12.0;

#[derive(Default)]
pub struct WindowDock {
    #[cfg(windows)]
    owner: Arc<()>,
}

impl WindowDock {
    pub fn enter(&self, window: &WebviewWindow) -> AppResult<()> {
        let monitor = match window.current_monitor().map_err(window_error)? {
            Some(monitor) => monitor,
            None => window
                .primary_monitor()
                .map_err(window_error)?
                .ok_or_else(|| AppError::new("WINDOW", "未找到播放器所在的显示器"))?,
        };
        let work = monitor.work_area();
        let size = window.outer_size().map_err(window_error)?;
        let geometry = DockGeometry::new(
            work.position.x,
            work.position.y,
            work.size.width,
            work.size.height,
            size.width,
            size.height,
            monitor.scale_factor(),
        )?;

        #[cfg(windows)]
        {
            let handle = window.hwnd().map_err(window_error)?.0 as usize;
            let owner = Arc::downgrade(&self.owner);
            let app = window.app_handle().clone();
            on_main_thread(window, move || {
                native::enter(
                    handle,
                    owner,
                    geometry,
                    Some(std::rc::Rc::new(move |state| {
                        let _ = app.emit_to("main", "wallpaper-player:docked", state);
                    })),
                )
            })
        }
        #[cfg(not(windows))]
        {
            window
                .set_position(geometry.position())
                .map_err(window_error)
        }
    }

    /// Finishes cancelling the native animation and removing its clipping region
    /// before the caller restores the ordinary window geometry.
    pub fn leave(&self, window: &WebviewWindow) -> AppResult<()> {
        #[cfg(windows)]
        {
            let handle = window.hwnd().map_err(window_error)?.0 as usize;
            let owner = Arc::downgrade(&self.owner);
            on_main_thread(window, move || native::leave(handle, &owner))
        }
        #[cfg(not(windows))]
        {
            let _ = window;
            Ok(())
        }
    }

    pub fn set_hidden(
        &self,
        window: &WebviewWindow,
        hidden: bool,
        reduced_motion: bool,
    ) -> AppResult<()> {
        #[cfg(windows)]
        {
            let handle = window.hwnd().map_err(window_error)?.0 as usize;
            let owner = Arc::downgrade(&self.owner);
            on_main_thread(window, move || {
                native::set_hidden(handle, &owner, hidden, reduced_motion)
            })
        }
        #[cfg(not(windows))]
        {
            // Wallpaper hosting is Windows-only. Without a native window region,
            // moving off this monitor would cover a neighbouring display.
            let _ = (window, hidden, reduced_motion);
            Ok(())
        }
    }
}

fn window_error(error: impl ToString) -> AppError {
    AppError::new("WINDOW", error)
}

#[cfg(windows)]
fn on_main_thread(
    window: &WebviewWindow,
    action: impl FnOnce() -> AppResult<()> + Send + 'static,
) -> AppResult<()> {
    let (send, receive) = std::sync::mpsc::channel();
    // Tauri runs this inline when already on the main thread. No dock mutex is
    // held while dispatching or waiting, including calls made during restore.
    window
        .run_on_main_thread(move || {
            let _ = send.send(action());
        })
        .map_err(window_error)?;
    receive.recv().map_err(window_error)?
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum DockEdge {
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Clone, Copy, Debug)]
struct DockGeometry {
    work: Rect,
    width: i32,
    height: i32,
    handle_width: i32,
    position: PhysicalPosition<i32>,
    edge: Option<DockEdge>,
    snap_distance: i32,
}

impl DockGeometry {
    #[allow(clippy::too_many_arguments)]
    fn new(
        left: i32,
        top: i32,
        work_width: u32,
        work_height: u32,
        width: u32,
        height: u32,
        scale: f64,
    ) -> AppResult<Self> {
        let invalid = || AppError::new("WINDOW", "播放器或显示器尺寸无效");
        if work_width == 0 || work_height == 0 || width == 0 || height == 0 {
            return Err(invalid());
        }
        let width = i32::try_from(width).map_err(|_| invalid())?;
        let height = i32::try_from(height).map_err(|_| invalid())?;
        let right =
            i32::try_from(i64::from(left) + i64::from(work_width)).map_err(|_| invalid())?;
        let bottom =
            i32::try_from(i64::from(top) + i64::from(work_height)).map_err(|_| invalid())?;
        right.checked_sub(width).ok_or_else(invalid)?;
        bottom.checked_sub(height).ok_or_else(invalid)?;
        let scale = if scale.is_finite() && scale > 0.0 {
            scale
        } else {
            1.0
        };
        let handle_width = (HANDLE_WIDTH * scale).round().clamp(
            1.0,
            f64::from(width.min(height)).min(f64::from(work_width.min(work_height))),
        ) as i32;
        Ok(Self {
            work: Rect {
                left,
                top,
                right,
                bottom,
            },
            width,
            height,
            handle_width,
            position: PhysicalPosition::new(right - width, bottom - height),
            edge: Some(DockEdge::Right),
            snap_distance: (24.0 * scale).round().clamp(1.0, f64::from(i32::MAX)) as i32,
        })
    }

    #[cfg(any(windows, test))]
    fn at_position(mut self, x: i32, y: i32) -> Self {
        let right = self.work.right - self.width;
        let bottom = self.work.bottom - self.height;
        let x = x.clamp(self.work.left.min(right), self.work.left.max(right));
        let y = y.clamp(self.work.top.min(bottom), self.work.top.max(bottom));
        // Choose the closest edge. At a bottom-right corner prefer the right edge,
        // matching the initial dock, and keep the user's position along that edge.
        let (edge, distance) = [
            (DockEdge::Right, x.abs_diff(right)),
            (DockEdge::Left, x.abs_diff(self.work.left)),
            (DockEdge::Top, y.abs_diff(self.work.top)),
            (DockEdge::Bottom, y.abs_diff(bottom)),
        ]
        .into_iter()
        .min_by_key(|(_, distance)| *distance)
        .unwrap();
        self.edge = (distance <= self.snap_distance as u32).then_some(edge);
        self.position = PhysicalPosition::new(x, y);
        match self.edge {
            Some(DockEdge::Left) => self.position.x = self.work.left,
            Some(DockEdge::Right) => self.position.x = right,
            Some(DockEdge::Top) => self.position.y = self.work.top,
            Some(DockEdge::Bottom) => self.position.y = bottom,
            None => {}
        }
        self
    }

    #[cfg(any(windows, test))]
    fn hidden_offset(self) -> i32 {
        match self.edge {
            Some(DockEdge::Left | DockEdge::Right) => self.width - self.handle_width,
            Some(DockEdge::Top | DockEdge::Bottom) => self.height - self.handle_width,
            None => 0,
        }
    }

    fn position(self) -> PhysicalPosition<i32> {
        self.position
    }

    #[cfg(any(windows, test))]
    fn clip(self, offset: i32) -> Rect {
        let PhysicalPosition { x, y } = self.position();
        let local = |edge: i32, origin: i32, limit: i32| {
            (i64::from(edge) - i64::from(origin)).clamp(0, i64::from(limit)) as i32
        };
        let mut clip = Rect {
            left: local(self.work.left, x, self.width),
            top: local(self.work.top, y, self.height),
            right: local(self.work.right, x, self.width),
            bottom: local(self.work.bottom, y, self.height),
        };
        match self.edge {
            Some(DockEdge::Left) => clip.right = clip.right.min(self.width - offset),
            Some(DockEdge::Right) => clip.left = clip.left.max(offset),
            Some(DockEdge::Top) => clip.bottom = clip.bottom.min(self.height - offset),
            Some(DockEdge::Bottom) => clip.top = clip.top.max(offset),
            None => {}
        }
        clip
    }
}

#[cfg(any(windows, test))]
mod motion {
    use super::DockGeometry;
    use std::time::{Duration, Instant};

    const DURATION: Duration = Duration::from_millis(180);

    #[derive(Clone, Copy)]
    struct Slide {
        from: i32,
        to: i32,
        started: Instant,
    }

    pub(super) struct Motion {
        pub geometry: DockGeometry,
        pub offset: i32,
        hidden: bool,
        slide: Option<Slide>,
    }

    impl Motion {
        pub fn new(geometry: DockGeometry) -> Self {
            Self {
                offset: 0,
                geometry,
                hidden: false,
                slide: None,
            }
        }

        pub fn retarget(&mut self, hidden: bool, reduced_motion: bool, now: Instant) {
            let target = if hidden {
                self.geometry.hidden_offset()
            } else {
                0
            };
            if reduced_motion {
                self.offset = target;
                self.slide = None;
            } else if hidden != self.hidden || (self.slide.is_none() && self.offset != target) {
                // Reverse from the last frame actually displayed, so rapid hover
                // changes never jump to an animation's old endpoint.
                self.slide = (self.offset != target).then_some(Slide {
                    from: self.offset,
                    to: target,
                    started: now,
                });
            }
            self.hidden = hidden;
        }

        pub fn advance(&mut self, now: Instant) {
            let Some(slide) = self.slide else {
                return;
            };
            let progress =
                now.saturating_duration_since(slide.started).as_secs_f64() / DURATION.as_secs_f64();
            if progress >= 1.0 {
                self.offset = slide.to;
                self.slide = None;
            } else {
                let eased = 1.0 - (1.0 - progress).powi(3);
                self.offset = (f64::from(slide.from)
                    + (f64::from(slide.to) - f64::from(slide.from)) * eased)
                    .round() as i32;
            }
        }

        pub fn animating(&self) -> bool {
            self.slide.is_some()
        }

        pub fn stop(&mut self) {
            self.slide = None;
        }
    }
}

#[cfg(windows)]
mod native {
    use super::{motion::Motion, AppResult, DockEdge, DockGeometry};
    use std::{
        cell::RefCell,
        collections::HashMap,
        ptr::null_mut,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Weak,
        },
        time::Instant,
    };
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM},
        Graphics::Gdi::{
            CreateRectRgn, DeleteObject, GetMonitorInfoW, MonitorFromWindow, SetWindowRgn,
            MONITORINFO, MONITOR_DEFAULTTONEAREST,
        },
        UI::{
            HiDpi::GetDpiForWindow,
            WindowsAndMessaging::{
                CallWindowProcW, DefWindowProcW, GetWindowLongPtrW, GetWindowRect, KillTimer,
                SetTimer, SetWindowLongPtrW, SetWindowPos, GWLP_WNDPROC, SWP_NOACTIVATE,
                SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER, WM_ENTERSIZEMOVE, WM_EXITSIZEMOVE,
                WM_NCDESTROY, WNDPROC,
            },
        },
    };

    #[derive(Clone, serde::Serialize)]
    pub(super) struct DockState {
        edge: Option<DockEdge>,
        dragging: bool,
    }

    type EventSink = std::rc::Rc<dyn Fn(DockState)>;

    struct DockedWindow {
        owner: Weak<()>,
        timer_id: usize,
        motion: Motion,
        events: Option<EventSink>,
    }

    thread_local! {
        // Win32 timers and every mutation below run on the window's main thread.
        // Never hold this RefCell borrow across a native call that sends messages.
        static WINDOWS: RefCell<HashMap<usize, DockedWindow>> = RefCell::new(HashMap::new());
        // Separate forwarding records let a later WebView subclass keep chaining
        // through this procedure after compact mode is restored.
        static PROCEDURES: RefCell<HashMap<usize, WNDPROC>> = RefCell::new(HashMap::new());
    }

    // A new session gets a new ID: a queued WM_TIMER from before leave/re-enter
    // cannot act on the new session, even if Windows reused the HWND.
    static NEXT_TIMER: AtomicUsize = AtomicUsize::new(0x534F_0000);

    pub(super) fn enter(
        handle: usize,
        owner: Weak<()>,
        geometry: DockGeometry,
        events: Option<EventSink>,
    ) -> AppResult<()> {
        let previous = WINDOWS.with(|windows| windows.borrow_mut().remove(&handle));
        if let Some(previous) = previous {
            unsafe { KillTimer(handle as HWND, previous.timer_id) };
        }
        let motion = Motion::new(geometry);
        WINDOWS.with(|windows| {
            windows.borrow_mut().insert(
                handle,
                DockedWindow {
                    owner,
                    timer_id: NEXT_TIMER.fetch_add(1, Ordering::Relaxed),
                    motion,
                    events,
                },
            );
        });
        install_proc(handle)?;
        // Keep the record on error, so the caller's rollback can clear any
        // successfully installed clipping region through leave().
        set_region(
            handle,
            super::Rect {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            },
        )?;
        let position = geometry.position();
        if unsafe {
            SetWindowPos(
                handle as HWND,
                null_mut(),
                position.x,
                position.y,
                0,
                0,
                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
            )
        } == 0
        {
            return Err(last_error("无法移动播放器窗口"));
        }
        apply_frame(handle, geometry, 0)
    }

    pub(super) fn leave(handle: usize, owner: &Weak<()>) -> AppResult<()> {
        let dock = WINDOWS.with(|windows| {
            let mut windows = windows.borrow_mut();
            if windows
                .get(&handle)
                .is_some_and(|dock| dock.owner.ptr_eq(owner))
            {
                windows.remove(&handle)
            } else {
                None
            }
        });
        let Some(mut dock) = dock else { return Ok(()) };
        dock.motion.stop();
        unsafe { KillTimer(handle as HWND, dock.timer_id) };
        let result = clear_region(handle);
        if result.is_err() {
            // An unsuccessful restore may be retried without resurrecting motion.
            WINDOWS.with(|windows| {
                windows.borrow_mut().insert(handle, dock);
            });
        } else {
            remove_proc(handle);
        }
        result
    }

    fn install_proc(handle: usize) -> AppResult<()> {
        if PROCEDURES.with(|procedures| procedures.borrow().contains_key(&handle)) {
            return Ok(());
        }
        let previous = unsafe {
            SetWindowLongPtrW(
                handle as HWND,
                GWLP_WNDPROC,
                window_proc as *const () as isize,
            )
        };
        if previous == 0 {
            return Err(last_error("无法监听播放器拖动"));
        }
        let previous: WNDPROC = unsafe { std::mem::transmute(previous) };
        PROCEDURES.with(|procedures| procedures.borrow_mut().insert(handle, previous));
        Ok(())
    }

    fn remove_proc(handle: usize) {
        let current = unsafe { GetWindowLongPtrW(handle as HWND, GWLP_WNDPROC) };
        if current != window_proc as *const () as isize {
            // A newer subclass still forwards to us; preserve its original chain.
            return;
        }
        let previous = PROCEDURES.with(|procedures| procedures.borrow().get(&handle).copied());
        if let Some(Some(previous)) = previous {
            if unsafe {
                SetWindowLongPtrW(handle as HWND, GWLP_WNDPROC, previous as *const () as isize)
            } != 0
            {
                PROCEDURES.with(|procedures| procedures.borrow_mut().remove(&handle));
            }
        }
    }

    unsafe extern "system" fn window_proc(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        // Let Tao finish its move loop before we send position/region messages.
        // Never dispatch a Tauri window API from inside this window procedure.
        if message == WM_ENTERSIZEMOVE {
            begin_drag(window as usize);
        } else if message == WM_NCDESTROY {
            let dock = WINDOWS.with(|windows| windows.borrow_mut().remove(&(window as usize)));
            if let Some(dock) = dock {
                unsafe { KillTimer(window, dock.timer_id) };
            }
        }
        let previous = PROCEDURES.with(|procedures| {
            procedures
                .borrow()
                .get(&(window as usize))
                .copied()
                .flatten()
        });
        let result = if previous.is_some() {
            unsafe { CallWindowProcW(previous, window, message, wparam, lparam) }
        } else {
            unsafe { DefWindowProcW(window, message, wparam, lparam) }
        };
        if message == WM_NCDESTROY {
            PROCEDURES.with(|procedures| procedures.borrow_mut().remove(&(window as usize)));
        }
        if message == WM_EXITSIZEMOVE {
            if let Err(error) = finish_drag(window as usize) {
                eprintln!("播放器贴边失败: {}", error.message);
                notify(window as usize, None, false);
            }
        }
        result
    }

    fn notify(handle: usize, edge: Option<DockEdge>, dragging: bool) {
        let events = WINDOWS.with(|windows| {
            windows
                .borrow()
                .get(&handle)
                .and_then(|dock| dock.events.clone())
        });
        if let Some(events) = events {
            events(DockState { edge, dragging });
        }
    }

    fn begin_drag(handle: usize) {
        let timer = WINDOWS.with(|windows| {
            let mut windows = windows.borrow_mut();
            let dock = windows.get_mut(&handle)?;
            dock.motion.stop();
            dock.motion.offset = 0;
            dock.motion.geometry.edge = None;
            Some(dock.timer_id)
        });
        if let Some(timer) = timer {
            unsafe { KillTimer(handle as HWND, timer) };
            // Remove the old monitor clipping while crossing monitors or DPI scales.
            let _ = clear_region(handle);
            notify(handle, None, true);
        }
    }

    fn read_geometry(handle: usize) -> AppResult<DockGeometry> {
        let window = handle as HWND;
        let mut rect = RECT::default();
        let monitor = unsafe { MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST) };
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if unsafe { GetWindowRect(window, &mut rect) } == 0
            || unsafe { GetMonitorInfoW(monitor, &mut info) } == 0
        {
            return Err(last_error("无法读取播放器拖动位置"));
        }
        let work = info.rcWork;
        DockGeometry::new(
            work.left,
            work.top,
            work.right.abs_diff(work.left),
            work.bottom.abs_diff(work.top),
            rect.right.abs_diff(rect.left),
            rect.bottom.abs_diff(rect.top),
            f64::from(unsafe { GetDpiForWindow(window) }) / 96.0,
        )
        .map(|geometry| geometry.at_position(rect.left, rect.top))
    }

    fn finish_drag(handle: usize) -> AppResult<()> {
        let active = WINDOWS.with(|windows| {
            windows
                .borrow()
                .get(&handle)
                .is_some_and(|dock| dock.owner.strong_count() > 0)
        });
        if !active {
            return Ok(());
        }
        // Read the destination monitor after the native drag and any DPI resize.
        let geometry = read_geometry(handle)?;
        WINDOWS.with(|windows| {
            if let Some(dock) = windows.borrow_mut().get_mut(&handle) {
                dock.motion = Motion::new(geometry);
            }
        });
        let position = geometry.position();
        if unsafe {
            SetWindowPos(
                handle as HWND,
                null_mut(),
                position.x,
                position.y,
                0,
                0,
                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
            )
        } == 0
        {
            return Err(last_error("无法吸附播放器窗口"));
        }
        apply_frame(handle, geometry, 0)?;
        notify(handle, geometry.edge, false);
        Ok(())
    }

    pub(super) fn set_hidden(
        handle: usize,
        owner: &Weak<()>,
        hidden: bool,
        reduced_motion: bool,
    ) -> AppResult<()> {
        let next = WINDOWS.with(|windows| {
            let mut windows = windows.borrow_mut();
            let dock = windows.get_mut(&handle)?;
            if !dock.owner.ptr_eq(owner) {
                return None;
            }
            if hidden && dock.motion.geometry.edge.is_none() {
                return None;
            }
            dock.motion.retarget(hidden, reduced_motion, Instant::now());
            Some((
                dock.timer_id,
                dock.motion.geometry,
                dock.motion.offset,
                dock.motion.animating(),
            ))
        });
        let Some((timer_id, geometry, offset, animating)) = next else {
            return Ok(());
        };
        if animating {
            // Replaces the existing timer instead of creating threads or stacking
            // animations. The next callback always reads the latest target.
            if unsafe { SetTimer(handle as HWND, timer_id, 16, Some(tick)) } == 0 {
                let error = last_error("无法启动播放器收起动画");
                stop_motion(handle, timer_id);
                return Err(error);
            }
            Ok(())
        } else {
            unsafe { KillTimer(handle as HWND, timer_id) };
            apply_frame(handle, geometry, offset)
        }
    }

    unsafe extern "system" fn tick(handle: HWND, _message: u32, timer_id: usize, _time: u32) {
        let handle = handle as usize;
        let next = WINDOWS.with(|windows| {
            let mut windows = windows.borrow_mut();
            let dock = windows.get_mut(&handle)?;
            if dock.timer_id != timer_id {
                return None;
            }
            if dock.owner.strong_count() == 0 {
                windows.remove(&handle);
                return Some(None);
            }
            dock.motion.advance(Instant::now());
            Some(Some((
                dock.motion.geometry,
                dock.motion.offset,
                dock.motion.animating(),
            )))
        });
        match next {
            Some(Some((geometry, offset, animating))) => {
                let result = apply_frame(handle, geometry, offset);
                if !animating || result.is_err() {
                    stop_motion(handle, timer_id);
                }
                if let Err(error) = result {
                    eprintln!("播放器贴边动画失败: {}", error.message);
                }
            }
            Some(None) => {
                unsafe { KillTimer(handle as HWND, timer_id) };
                let _ = clear_region(handle);
                remove_proc(handle);
            }
            None => {
                // KillTimer does not purge already queued timer messages.
                unsafe { KillTimer(handle as HWND, timer_id) };
            }
        }
    }

    fn stop_motion(handle: usize, timer_id: usize) {
        WINDOWS.with(|windows| {
            if let Some(dock) = windows.borrow_mut().get_mut(&handle) {
                if dock.timer_id == timer_id {
                    dock.motion.stop();
                }
            }
        });
        unsafe { KillTimer(handle as HWND, timer_id) };
    }

    fn apply_frame(handle: usize, geometry: DockGeometry, offset: i32) -> AppResult<()> {
        // The HWND and WebView viewport stay on the source monitor throughout.
        // Moving the full HWND across the edge would trigger WM_DPICHANGED on a
        // differently scaled neighbour. CSS slides the content by this offset;
        // the native region clips it and removes hit-testing for the hidden area.
        set_region(handle, geometry.clip(offset))
    }

    fn set_region(handle: usize, clip: super::Rect) -> AppResult<()> {
        // An empty region is intentional while positioning the initial dock.
        let region = unsafe {
            CreateRectRgn(
                clip.left,
                clip.top,
                clip.right.max(clip.left),
                clip.bottom.max(clip.top),
            )
        };
        if region.is_null() {
            return Err(last_error("无法裁剪播放器窗口"));
        }
        // Windows owns the region only after SetWindowRgn succeeds.
        if unsafe { SetWindowRgn(handle as HWND, region, 1) } == 0 {
            let error = last_error("无法裁剪播放器窗口");
            unsafe { DeleteObject(region) };
            return Err(error);
        }
        Ok(())
    }

    fn clear_region(handle: usize) -> AppResult<()> {
        if unsafe { SetWindowRgn(handle as HWND, null_mut(), 1) } == 0 {
            Err(last_error("无法恢复播放器窗口区域"))
        } else {
            Ok(())
        }
    }

    fn last_error(context: &str) -> super::AppError {
        super::window_error(format!("{context}: {}", std::io::Error::last_os_error()))
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::sync::Arc;
        use windows_sys::Win32::{
            Foundation::RECT,
            Graphics::Gdi::{GetRgnBox, GetWindowRgn},
            UI::WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, GetWindowRect, IsWindowVisible, WS_POPUP,
            },
        };

        struct HiddenWindow(HWND);

        impl HiddenWindow {
            fn new() -> Self {
                let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
                // No WS_VISIBLE and no ShowWindow: these tests never display UI.
                let handle = unsafe {
                    CreateWindowExW(
                        0,
                        class.as_ptr(),
                        std::ptr::null(),
                        WS_POPUP,
                        50,
                        50,
                        560,
                        310,
                        null_mut(),
                        null_mut(),
                        null_mut(),
                        std::ptr::null(),
                    )
                };
                assert!(!handle.is_null(), "{}", std::io::Error::last_os_error());
                Self(handle)
            }

            fn rect(&self) -> RECT {
                let mut rect = RECT::default();
                assert_ne!(unsafe { GetWindowRect(self.0, &mut rect) }, 0);
                rect
            }
        }

        impl Drop for HiddenWindow {
            fn drop(&mut self) {
                WINDOWS.with(|windows| {
                    windows.borrow_mut().remove(&(self.0 as usize));
                });
                unsafe { DestroyWindow(self.0) };
            }
        }

        #[test]
        fn native_region_retracts_to_right_edge_without_moving_or_resizing_hwnd() {
            let window = HiddenWindow::new();
            let lifetime = Arc::new(());
            let owner = Arc::downgrade(&lifetime);
            let handle = window.0 as usize;
            let geometry = DockGeometry::new(0, 0, 1920, 1040, 560, 310, 1.0).unwrap();
            enter(handle, owner.clone(), geometry, None).unwrap();
            set_hidden(handle, &owner, true, true).unwrap();
            let rect = window.rect();
            assert_eq!((rect.left, rect.top), (1360, 730));
            assert_eq!((rect.right - rect.left, rect.bottom - rect.top), (560, 310));
            let region = unsafe { CreateRectRgn(0, 0, 0, 0) };
            let mut bounds = RECT::default();
            assert_ne!(unsafe { GetWindowRgn(window.0, region) }, 0);
            assert_ne!(unsafe { GetRgnBox(region, &mut bounds) }, 0);
            assert_eq!(
                (bounds.left, bounds.top, bounds.right, bounds.bottom),
                (548, 0, 560, 310)
            );
            set_hidden(handle, &owner, false, true).unwrap();
            assert_ne!(unsafe { GetWindowRgn(window.0, region) }, 0);
            assert_ne!(unsafe { GetRgnBox(region, &mut bounds) }, 0);
            assert_eq!((bounds.left, bounds.right), (0, 560));
            let rect = window.rect();
            assert_eq!(
                (rect.left, rect.top, rect.right, rect.bottom),
                (1360, 730, 1920, 1040)
            );
            leave(handle, &owner).unwrap();
            assert_eq!(unsafe { GetWindowRgn(window.0, region) }, 0);
            assert_eq!(unsafe { IsWindowVisible(window.0) }, 0);
            unsafe { DeleteObject(region) };
        }

        #[test]
        fn cancelled_timer_cannot_move_a_restored_or_reentered_window() {
            let window = HiddenWindow::new();
            let lifetime = Arc::new(());
            let owner = Arc::downgrade(&lifetime);
            let handle = window.0 as usize;
            let geometry = DockGeometry::new(0, 0, 1920, 1040, 560, 310, 1.0).unwrap();
            enter(handle, owner.clone(), geometry, None).unwrap();
            set_hidden(handle, &owner, true, false).unwrap();
            let old_timer = WINDOWS.with(|windows| windows.borrow()[&handle].timer_id);
            leave(handle, &owner).unwrap();
            unsafe {
                SetWindowPos(
                    window.0,
                    null_mut(),
                    80,
                    90,
                    0,
                    0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
                );
                tick(window.0, 0, old_timer, 0);
            }
            let rect = window.rect();
            assert_eq!((rect.left, rect.top), (80, 90));
            enter(handle, owner.clone(), geometry, None).unwrap();
            let new_timer = WINDOWS.with(|windows| windows.borrow()[&handle].timer_id);
            assert_ne!(old_timer, new_timer);
            unsafe { tick(window.0, 0, old_timer, 0) };
            let rect = window.rect();
            assert_eq!((rect.left, rect.top), (1360, 730));
            leave(handle, &owner).unwrap();
            leave(handle, &owner).unwrap();
            assert_eq!(unsafe { IsWindowVisible(window.0) }, 0);
        }

        #[test]
        fn all_native_edges_clip_the_entire_surface_and_release_clipping_for_drag() {
            let window = HiddenWindow::new();
            let lifetime = Arc::new(());
            let owner = Arc::downgrade(&lifetime);
            let handle = window.0 as usize;
            let region = unsafe { CreateRectRgn(0, 0, 0, 0) };
            for (x, y) in [(0, 240), (1360, 240), (500, 0), (500, 730)] {
                let geometry = DockGeometry::new(0, 0, 1920, 1040, 560, 310, 1.0)
                    .unwrap()
                    .at_position(x, y);
                enter(handle, owner.clone(), geometry, None).unwrap();
                set_hidden(handle, &owner, true, true).unwrap();
                let mut bounds = RECT::default();
                assert_ne!(unsafe { GetWindowRgn(window.0, region) }, 0);
                assert_ne!(unsafe { GetRgnBox(region, &mut bounds) }, 0);
                let clip = geometry.clip(geometry.hidden_offset());
                assert_eq!(
                    (bounds.left, bounds.top, bounds.right, bounds.bottom),
                    (clip.left, clip.top, clip.right, clip.bottom)
                );
                unsafe {
                    windows_sys::Win32::UI::WindowsAndMessaging::SendMessageW(
                        window.0,
                        WM_ENTERSIZEMOVE,
                        0,
                        0,
                    );
                }
                assert_eq!(unsafe { GetWindowRgn(window.0, region) }, 0);
                set_hidden(handle, &owner, true, true).unwrap();
                assert_eq!(unsafe { GetWindowRgn(window.0, region) }, 0);
                leave(handle, &owner).unwrap();
            }
            assert_eq!(unsafe { IsWindowVisible(window.0) }, 0);
            unsafe { DeleteObject(region) };
        }

        #[test]
        fn native_drag_exit_uses_actual_monitor_and_new_position() {
            use windows_sys::Win32::UI::WindowsAndMessaging::SendMessageW;
            let window = HiddenWindow::new();
            let lifetime = Arc::new(());
            let owner = Arc::downgrade(&lifetime);
            let handle = window.0 as usize;
            let geometry = read_geometry(handle).unwrap();
            enter(handle, owner.clone(), geometry, None).unwrap();
            unsafe { SendMessageW(window.0, WM_ENTERSIZEMOVE, 0, 0) };
            let top = geometry.work.top;
            let x = geometry.work.left + (geometry.work.right - geometry.work.left - 560) / 2;
            unsafe {
                SetWindowPos(
                    window.0,
                    null_mut(),
                    x,
                    top + 8,
                    0,
                    0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
                );
                SendMessageW(window.0, WM_EXITSIZEMOVE, 0, 0);
            }
            let rect = window.rect();
            assert_eq!((rect.left, rect.top), (x, top));
            let edge = WINDOWS.with(|windows| windows.borrow()[&handle].motion.geometry.edge);
            assert_eq!(edge, Some(DockEdge::Top));
            leave(handle, &owner).unwrap();
            assert_eq!(unsafe { IsWindowVisible(window.0) }, 0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{motion::Motion, DockEdge, DockGeometry, Rect};
    use std::time::{Duration, Instant};

    fn primary() -> DockGeometry {
        DockGeometry::new(0, 0, 1920, 1040, 560, 310, 1.0).unwrap()
    }

    #[test]
    fn docks_against_work_area_above_taskbar() {
        let geometry = primary();
        assert_eq!(geometry.position().x, 1360);
        assert_eq!(geometry.position().y, 730);
        assert_eq!(geometry.hidden_offset(), 548);
        assert_eq!(
            geometry.clip(548),
            Rect {
                left: 548,
                top: 0,
                right: 560,
                bottom: 310
            }
        );
    }

    #[test]
    fn negative_monitor_origin_and_scaled_handle_keep_physical_alignment() {
        let geometry = DockGeometry::new(-2560, -160, 2520, 1400, 840, 465, 1.5).unwrap();
        assert_eq!(geometry.position().x, -880);
        assert_eq!(geometry.position().y, 775);
        let clip = geometry.clip(geometry.hidden_offset());
        assert_eq!(clip.right - clip.left, 18);
        assert_eq!(geometry.position().x + clip.left, -58);
    }

    #[test]
    fn every_animation_frame_stays_inside_source_monitor() {
        let geometry = primary();
        let x = geometry.position().x;
        for offset in 0..=geometry.hidden_offset() {
            let clip = geometry.clip(offset);
            assert_eq!(x + clip.right, 1920);
            assert!(x + clip.left >= 0);
            assert!(clip.right - clip.left >= 12);
            assert_eq!(geometry.position().x, 1360);
            assert_eq!(geometry.width, 560);
        }
    }

    #[test]
    fn dragging_snaps_to_each_edge_and_preserves_position_along_it() {
        for (x, y, edge, position, clip) in [
            (
                15,
                240,
                DockEdge::Left,
                (0, 240),
                Rect {
                    left: 0,
                    top: 0,
                    right: 12,
                    bottom: 310,
                },
            ),
            (
                1345,
                240,
                DockEdge::Right,
                (1360, 240),
                Rect {
                    left: 548,
                    top: 0,
                    right: 560,
                    bottom: 310,
                },
            ),
            (
                500,
                18,
                DockEdge::Top,
                (500, 0),
                Rect {
                    left: 0,
                    top: 0,
                    right: 560,
                    bottom: 12,
                },
            ),
            (
                500,
                710,
                DockEdge::Bottom,
                (500, 730),
                Rect {
                    left: 0,
                    top: 298,
                    right: 560,
                    bottom: 310,
                },
            ),
        ] {
            let geometry = primary().at_position(x, y);
            assert_eq!(geometry.edge, Some(edge));
            assert_eq!((geometry.position().x, geometry.position().y), position);
            assert_eq!(geometry.clip(geometry.hidden_offset()), clip);
            for offset in 0..=geometry.hidden_offset() {
                let clip = geometry.clip(offset);
                assert!(clip.left >= 0 && clip.top >= 0);
                assert!(clip.right <= geometry.width && clip.bottom <= geometry.height);
                assert!(clip.right > clip.left && clip.bottom > clip.top);
            }
        }
    }

    #[test]
    fn floating_window_does_not_hide_and_crossing_an_edge_still_snaps() {
        let floating = primary().at_position(500, 240);
        assert_eq!(floating.edge, None);
        assert_eq!(floating.hidden_offset(), 0);
        let mut motion = Motion::new(floating);
        motion.retarget(true, false, Instant::now());
        assert!(!motion.animating());
        assert_eq!(primary().at_position(-80, 240).edge, Some(DockEdge::Left));
        assert_eq!(primary().at_position(1500, 240).edge, Some(DockEdge::Right));
    }

    #[test]
    fn destination_monitor_scale_controls_snap_distance_and_horizontal_handle() {
        let destination = DockGeometry::new(-2560, -160, 2520, 1400, 840, 465, 1.5).unwrap();
        let dock = destination.at_position(-1900, -130);
        assert_eq!(dock.edge, Some(DockEdge::Top));
        assert_eq!(dock.position().x, -1900);
        assert_eq!(dock.position().y, -160);
        let clip = dock.clip(dock.hidden_offset());
        assert_eq!(clip.bottom - clip.top, 18);
        assert_eq!(destination.at_position(-1900, -120).edge, None);
    }

    #[test]
    fn oversized_player_clips_to_work_area_without_resizing_viewport() {
        let geometry = DockGeometry::new(50, 80, 400, 250, 560, 310, 1.25).unwrap();
        assert_eq!(
            geometry.clip(0),
            Rect {
                left: 160,
                top: 60,
                right: 560,
                bottom: 310
            }
        );
        assert_eq!(
            geometry.clip(geometry.hidden_offset()),
            Rect {
                left: 545,
                top: 60,
                right: 560,
                bottom: 310
            }
        );
    }

    #[test]
    fn reversing_hover_starts_from_the_displayed_frame() {
        let mut motion = Motion::new(primary());
        let start = Instant::now();
        motion.retarget(true, false, start);
        motion.advance(start + Duration::from_millis(80));
        let last_displayed = motion.offset;
        assert!(last_displayed > 0);
        motion.retarget(false, false, start + Duration::from_millis(90));
        assert_eq!(motion.offset, last_displayed);
        motion.advance(start + Duration::from_millis(270));
        assert_eq!(motion.offset, 0);
        assert!(!motion.animating());
    }

    #[test]
    fn repeated_hide_does_not_restart_animation_and_reduced_motion_is_immediate() {
        let mut motion = Motion::new(primary());
        let start = Instant::now();
        motion.retarget(true, false, start);
        motion.retarget(true, false, start + Duration::from_millis(100));
        motion.advance(start + Duration::from_millis(180));
        assert_eq!(motion.offset, primary().hidden_offset());
        assert!(!motion.animating());
        motion.retarget(false, true, start + Duration::from_millis(190));
        assert_eq!(motion.offset, 0);
        assert!(!motion.animating());
    }

    #[test]
    fn stopping_an_animation_prevents_stale_frames_from_moving_the_window() {
        let mut motion = Motion::new(primary());
        let start = Instant::now();
        motion.retarget(true, false, start);
        motion.advance(start + Duration::from_millis(40));
        let last_displayed = motion.offset;
        motion.stop();
        motion.advance(start + Duration::from_secs(1));
        assert_eq!(motion.offset, last_displayed);
        assert!(!motion.animating());
    }

    #[test]
    fn rejects_invalid_sizes_and_clamps_handle_for_tiny_work_area() {
        assert!(DockGeometry::new(0, 0, 0, 100, 560, 310, 1.0).is_err());
        assert!(DockGeometry::new(i32::MAX, 0, 10, 100, 560, 310, 1.0).is_err());
        let geometry = DockGeometry::new(0, 0, 5, 100, 560, 310, 2.0).unwrap();
        assert_eq!(geometry.handle_width, 5);
        let geometry = DockGeometry::new(0, 0, 1920, 1040, 560, 310, f64::NAN).unwrap();
        assert_eq!(geometry.handle_width, 12);
    }
}
