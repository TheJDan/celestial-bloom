//! Window transparency and click-through management.
//!
//! Bloom's windows are large transparent overlays rendered via WebView2's
//! DirectComposition layers. To prevent Windows GDI from drawing opaque
//! background boxes (e.g. white flashes or rectangles along notch edges),
//! we clear any GDI window region (`SetWindowRgn(hwnd, None, false)`).
//! Click-through and hit-testing are managed smoothly in software via
//! `services.rs` using `WS_EX_TRANSPARENT`.

use tauri::Window;
use crate::types::IntRect;

/// Configures the calling window for seamless transparent compositing.
/// Clears any GDI region to avoid white background artifacts while preserving click-through.
#[tauri::command]
pub fn set_window_region(window: Window, _rects: Vec<IntRect>) {
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let click_through = unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, GWL_EXSTYLE, WS_EX_TRANSPARENT,
        };
        GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TRANSPARENT.0 != 0
    };
    crate::utils::set_click_through(hwnd, click_through);
    unsafe {
        // Clear any GDI window region so DirectComposition renders full alpha transparency
        // without GDI background clipping or repainting artifacts.
        let _ = windows::Win32::Graphics::Gdi::SetWindowRgn(hwnd, None, false);
    }
}
