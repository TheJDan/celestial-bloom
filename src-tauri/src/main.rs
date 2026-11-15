#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod battery;
mod bluetooth;
mod buds;
mod commands;
mod diagnostics;
mod dock_extras;
mod jack;
mod services;
mod settings_window;
mod shelf;
mod shelf_preview;
mod state;
mod tray;
mod types;
mod updater;
mod usb;
mod utils;
mod wifi;
mod hardware;
mod optimizer;
mod window_region;
mod razer;

use std::sync::atomic::Ordering;
use tauri::Manager;
use windows::core::BOOL;
use windows::Win32::System::Console::SetConsoleCtrlHandler;
use windows::Win32::System::Console::{CTRL_BREAK_EVENT, CTRL_CLOSE_EVENT, CTRL_C_EVENT};

use crate::commands::*;
use crate::services::*;
use crate::state::*;
use crate::utils::*;

unsafe extern "system" fn ctrl_handler(ctrl_type: u32) -> BOOL {
    if ctrl_type == CTRL_C_EVENT || ctrl_type == CTRL_BREAK_EVENT || ctrl_type == CTRL_CLOSE_EVENT {
        set_taskbar_visibility(true, true);
        NATIVE_TASKBAR_HIDDEN.store(false, Ordering::Relaxed);
        set_native_osd_suppressed(false);
    }
    BOOL(0)
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        log_boot(&format!("PANIC: {}", info));
    }));
    log_boot("main() entered");
    let mut args = std::env::args_os();
    if args.nth(1).as_deref() == Some(std::ffi::OsStr::new("--taskbar-watchdog")) {
        if let (Some(pid), Some(marker)) = (args.next(), args.next()) {
            if let Ok(pid) = pid.to_string_lossy().parse::<u32>() {
                utils::run_taskbar_watchdog(pid, marker.into());
            }
        }
        return;
    }

    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--disable-background-networking --disable-component-update --disable-features=Translate,OptimizationHints,MediaRouter,DefaultBrowserErrorPage --no-default-browser-check",
    );
    unsafe {
        let _ = SetConsoleCtrlHandler(Some(ctrl_handler), true);
    }

    // Single-instance enforcement
    unsafe {
        use windows::Win32::Foundation::{CloseHandle, GetLastError};
        use windows::Win32::System::Threading::{
            CreateEventW, CreateMutexW, OpenEventW, SetEvent, SYNCHRONIZATION_ACCESS_RIGHTS,
        };

        let mutex_name: Vec<u16> = "BloomSingleInstance"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let event_name: Vec<u16> = "BloomOpenSettings"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let h_mutex = CreateMutexW(None, true, windows::core::PCWSTR(mutex_name.as_ptr())).ok();
        let err = GetLastError();

        log_boot(&format!("Single instance check err={}", err.0));
        if err.0 == 183 {
            log_boot("Single instance check: already running (err=183). Exiting.");
            // Another instance is already running — signal it to open settings
            if let Ok(h_event) = OpenEventW(
                SYNCHRONIZATION_ACCESS_RIGHTS(0x00100002),
                false,
                windows::core::PCWSTR(event_name.as_ptr()),
            ) {
                let _ = SetEvent(h_event);
                let _ = CloseHandle(h_event);
            }
            if let Some(h) = h_mutex {
                let _ = CloseHandle(h);
            }
            return;
        }

        if let Ok(h_event) = CreateEventW(
            None,
            false,
            false,
            windows::core::PCWSTR(event_name.as_ptr()),
        ) {
            let _ = SINGLE_INSTANCE_EVENT_HANDLE.set(h_event.0 as isize);
        }
        if let Some(h) = h_mutex {
            let _ = SINGLE_INSTANCE_MUTEX_HANDLE.set(h.0 as isize);
        }
    }

    diagnostics::initialize();
    setup_brightness_worker();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .invoke_handler(tauri::generate_handler![
            end_task,
            run_smart_boost,
            hide_native_osd,
            open_settings_window,
            close_settings_window,
            open_wifi_settings,
            open_sound_settings,
            get_audio_output_devices,
            get_audio_input_devices,
            get_mic_volume,
            set_mic_volume,
            set_default_audio_device,
            get_headset_battery,
            get_jarvis_status,
            jarvis_toggle_mute,
            jarvis_send_prompt,
            toggle_coucou_island,
            open_notification_center,
            open_system_tray,
            set_ignore_cursor_events,
            update_notch_hit_rects,
            get_material_palette,
            set_window_height,
            resize_settings_window,
            hide_overlay,
            set_splash_fullscreen,
            sync_overlay_position,
            get_alt_tab_windows,
            switch_to_window,
            cancel_alt_tab,
            show_3d_switcher,
            hide_3d_switcher,
            media_play_pause,
            media_next,
            media_previous,
            media_seek,
            open_media_source_app,
            init_dock,
            toggle_dock,
            change_dock_mode,
            change_notch_mode,
            sync_appbar,
            open_app,
            launch_new_instance,
            update_dock_rect,
            update_notch_rect,
            window_region::set_window_region,
            set_dock_hovered,
            set_dock_popup_active,
            set_notch_hovered,
            set_notch_visible,
            setup_shelf_drop,
            shelf_thumbnail,
            shelf_drag_icon,
            shelf_prune,
            shelf_open,
            get_active_windows,
            get_tray_apps,
            show_tray_context_menu,
            activate_tray_icon,
            open_system_action,
            get_app_icon,
            get_installed_apps,
            save_pinned_apps,
            load_pinned_apps,
            clear_icon_cache,
            set_custom_icon,
            remove_custom_icon,
            get_custom_icons,
            set_menu_open,
            focus_window,
            focus_app_windows,
            close_window,
            quit_bloom,
            restart_bloom,
            get_volume,
            get_volume_state,
            get_brightness,
            set_volume,
            get_audio_sessions,
            set_app_volume,
            set_app_mute,
            set_volume_mixer_rect,
            clear_volume_mixer_rect,
            save_setting,
            load_settings,
            settings_file_readable,
            capture_window_thumbnail,
            get_wifi_status,
            set_wifi_state,
            get_bluetooth_state,
            set_bluetooth_state,
            open_bluetooth_settings,
            open_airplane_mode_settings,
            set_brightness,
            get_battery_saver_state,
            open_battery_saver_settings,
            battery::get_battery_details,
            get_system_accent_color,
            get_cpu_usage,
            get_ram_usage,
            get_disk_space,
            get_network_speed,
            export_settings_to_file,
            import_settings_from_file,
            reset_settings,
            updater::check_for_updates,
            updater::install_update,
            updater::get_update_state,
            dock_extras::get_dock_extras,
            dock_extras::open_dock_extra,
            dock_extras::eject_dock_extra,
            dock_extras::get_dock_drives,
            wifi::wifi_list_networks,
            wifi::wifi_scan,
            wifi::wifi_connect,
            wifi::wifi_disconnect,
            wifi::wifi_forget,
            wifi::wifi_open_settings,
            bluetooth::bluetooth_list_devices,
            bluetooth::bluetooth_set_connected,
            bluetooth::bluetooth_discovery,
            bluetooth::bluetooth_pair,
            bluetooth::bluetooth_pairing_respond,
            bluetooth::bluetooth_unpair,
            bluetooth::bluetooth_refresh_buds,
            get_quick_look_data,
            close_quick_look,
            open_spotlight,
            toggle_spotlight,
            close_spotlight,
            spotlight_launch_app,
            spotlight_launch_command,
            spotlight_launch_url,
            close_expose,
            get_username,
            get_system_uptime,
            verify_windows_password,
            lock_windows_workstation,
            trigger_screenshot,
            toggle_mic_mute,
            get_mic_mute_state,
            hardware::get_hardware_stats,
            open_lockscreen,
            close_lockscreen,
            toggle_lockscreen,
            execute_system_command,
            window_region::set_window_region,
            usb::usb_list_devices,
            jack::jack_list_devices
        ])
        .setup(|app| {
            log_boot("setup() step 1: entered");
            init_taskbar_marker(app.handle());
            log_boot("setup() step 2: taskbar marker init");
            // Populate the settings cache before anything else: a webview can
            // invoke save_setting as soon as it loads, which happens before the
            // rest of this hook runs.
            crate::utils::init_settings_cache(app.handle());
            // Crash-recovery: if a previous session was force-killed while the native
            // taskbar was hidden, restore it now. Runs before the frontend re-hides it
            // (init_dock fires after a delay), so the flag must be removed first.
            if taskbar_marker_exists() {
                restore_taskbar_after_crash();
                NATIVE_TASKBAR_HIDDEN.store(false, Ordering::Relaxed);
            }

            // Cleanup any temporary artifacts from previous self-updates
            if let Ok(current_exe) = std::env::current_exe() {
                let old_exe = current_exe.with_extension("old.exe");
                let _ = std::fs::remove_file(old_exe);
                let new_temp = current_exe.with_extension("new.exe");
                let _ = std::fs::remove_file(new_temp);
            }

            // Update check on startup (non-blocking). Always runs so the UI can
            // show an update badge; auto-install only happens when the user
            // enabled it and the release has aged past the rollout gate.
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    updater::run_startup_check(app_handle).await;
                });
            }

            log_boot("setup() step 3: getting windows");
            let window = match app.get_webview_window("main") {
                Some(w) => w,
                None => {
                    log_boot("ERROR: main window not found in setup");
                    return Err("main window not found".into());
                }
            };
            let _ = window.set_ignore_cursor_events(true);

            let dock_win = match app.get_webview_window("dock") {
                Some(w) => w,
                None => {
                    log_boot("ERROR: dock window not found in setup");
                    return Err("dock window not found".into());
                }
            };
            let _ = dock_win.set_ignore_cursor_events(true);
            if let Ok(hwnd) = dock_win.hwnd() {
                DOCK_HWND.store(hwnd.0 as isize, Ordering::Relaxed);
            }
            log_boot("setup() step 4: windows retrieved");

            // Sync window rects initially and on event
            let win_clone = window.clone();
            let update_main_rect = move || {
                if let (Ok(p), Ok(s)) = (win_clone.outer_position(), win_clone.outer_size()) {
                    if let Ok(mut lock) = MAIN_WINDOW_RECT.lock() {
                        *lock = Some((p, s));
                    }
                }
            };

            let dock_clone = dock_win.clone();
            let update_dock_window_rect = move || {
                if let (Ok(p), Ok(s)) = (dock_clone.outer_position(), dock_clone.outer_size()) {
                    if let Ok(mut lock) = DOCK_WINDOW_RECT.lock() {
                        *lock = Some((p, s));
                    }
                }
            };

            update_main_rect();
            update_dock_window_rect();

            let u_main = update_main_rect.clone();
            let handle_for_events = app.handle().clone();
            window.on_window_event(move |e| match e {
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    u_main();
                    sync_overlays(&handle_for_events);
                }
                tauri::WindowEvent::ScaleFactorChanged { .. } => {
                    // Re-evaluate against the configured notch mode instead of
                    // registering unconditionally: on wake / display re-init a
                    // scale change in smart/peek mode must not reserve the top
                    // strip (issue #109).
                    let h = handle_for_events.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                        reconcile_main_appbar(&h);
                        sync_overlays(&h);
                    });
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    restore_taskbar_and_exit(&handle_for_events);
                }
                _ => {}
            });

            let u_dock = update_dock_window_rect.clone();
            let dock_for_events = dock_win.clone();
            let handle_for_dock_events = app.handle().clone();
            dock_win.on_window_event(move |e| match e {
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    u_dock();
                    sync_overlays(&handle_for_dock_events);
                }
                tauri::WindowEvent::ScaleFactorChanged { .. } => {
                    let h = handle_for_dock_events.clone();
                    if DOCK_APPBAR_REGISTERED.load(Ordering::Relaxed) {
                        let w = dock_for_events.clone();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                            register_dock_appbar(w);
                            sync_overlays(&h);
                        });
                    } else {
                        sync_overlays(&h);
                    }
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    restore_taskbar_and_exit(&handle_for_dock_events);
                }
                _ => {}
            });

            sync_overlays(app.handle());

            // Initialize the overlay window — on Windows, set_position doesn't
            // take effect on a window that has never been shown. Show it once
            // to register it with the compositor, then hide immediately.
            if let Some(ov_win) = app.get_webview_window("overlay") {
                if let Ok(hwnd) = ov_win.hwnd() {
                    crate::services::OVERLAY_HWND.store(hwnd.0 as isize, std::sync::atomic::Ordering::SeqCst);
                }
                // Layered from the start, like the notch and dock (see
                // set_click_through): the overlay has a window region too.
                let _ = ov_win.set_ignore_cursor_events(true);
                let _ = ov_win.show();
                let _ = ov_win.hide();
                let overlay_handle = app.handle().clone();
                ov_win.on_window_event(move |e| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                        api.prevent_close();
                        restore_taskbar_and_exit(&overlay_handle);
                    }
                });
            }

            watch_webview_processes(app.handle());
            setup_mouse_hook(app.handle().clone());
            setup_display_change_monitor(app.handle().clone());
            setup_window_change_hook(app.handle().clone());
            {
                let _ = crate::state::THUMBNAIL_CACHE
                    .set(std::sync::Mutex::new(std::collections::HashMap::new()));
                let _ = crate::state::FOCUS_TIMESTAMPS
                    .set(std::sync::Mutex::new(std::collections::HashMap::new()));
                let _ = crate::state::MRU_HISTORY
                    .set(std::sync::Mutex::new(Vec::new()));
                let _ = crate::state::PROCESS_PATH_CACHE
                    .set(std::sync::Mutex::new(std::collections::HashMap::new()));
                // Initialize before the scan so its results are actually stored.
                let _ = crate::state::INSTALLED_APPS_CACHE.set(std::sync::Mutex::new(Vec::new()));
            }
            setup_thumbnail_capture(app.handle().clone());
            trigger_app_scan();
            let tx = setup_system_worker(app.handle().clone());
            let _ = COMMAND_SENDER.set(tx.clone());
            services::setup_keyboard_hook(app.handle().clone());
            setup_taskbar_hook();
            setup_audio_visualization(app.handle().clone());
            setup_settings_watcher(app.handle().clone());
            diagnostics::record("services_ready", "hooks and settings watcher initialized");
            wifi::setup_wifi_notifications(app.handle().clone());
            log_boot("setup() step 5: setting up services");
            bluetooth::setup_bluetooth_notifications(app.handle().clone());
            usb::setup_usb_notifications(app.handle().clone());
            jack::setup_jack_notifications(app.handle().clone());
            services::setup_memory_trim_worker();
            hardware::setup_hardware_telemetry(app.handle().clone());
            log_boot("setup() step 6: services setup completed");

            let handle_for_crash_clear = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(10));
                crate::utils::clear_crash_restart_counter(&handle_for_crash_clear);
            });

            // Ensure main (notch) and dock windows are initialized and visible
            // promptly even if frontend splash or event handshakes are delayed.
            {
                let ah = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    let dock_mode = get_setting_str(&ah, "bloom-dock-mode").unwrap_or_else(|| "smart".to_string());
                    let notch_mode = get_setting_str(&ah, "bloom-notch-mode").unwrap_or_else(|| "smart".to_string());
                    let _ = init_dock(ah.clone(), dock_mode).await;
                    let _ = change_notch_mode(ah.clone(), notch_mode).await;
                    if let Some(main_win) = ah.get_webview_window("main") {
                        let _ = main_win.show();
                        if let Ok(hwnd) = main_win.hwnd() {
                            re_assert_topmost(hwnd);
                        }
                    }
                    if dock_enabled() {
                        if let Some(dock_win) = ah.get_webview_window("dock") {
                            let _ = dock_win.show();
                            if let Ok(hwnd) = dock_win.hwnd() {
                                re_assert_topmost(hwnd);
                            }
                        }
                    }
                });
            }

            // Listen for second-instance signal to open settings
            if let Some(&h_event) = SINGLE_INSTANCE_EVENT_HANDLE.get() {
                if h_event != 0 {
                    let app_handle = app.handle().clone();
                    std::thread::spawn(move || {
                        use windows::Win32::Foundation::{HANDLE, WAIT_OBJECT_0};
                        use windows::Win32::System::Threading::{WaitForSingleObject, INFINITE};
                        let h_event = HANDLE(h_event as *mut _);
                        loop {
                            let result = unsafe { WaitForSingleObject(h_event, INFINITE) };
                            if result == WAIT_OBJECT_0 {
                                crate::commands::open_settings_window(app_handle.clone());
                            }
                        }
                    });
                }
            }

            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                let quit_item = MenuItem::with_id(app, "quit", "Quit Bloom", true, None::<&str>)?;
                let restart_item =
                    MenuItem::with_id(app, "restart", "Restart Bloom", true, None::<&str>)?;
                let settings_item =
                    MenuItem::with_id(app, "settings", "Open Settings", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&settings_item, &restart_item, &quit_item])?;
                let ah = app.handle().clone();
                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Bloom")
                    .menu(&menu)
                    .on_menu_event(move |_, event| match event.id().as_ref() {
                        "quit" => {
                            diagnostics::record("shutdown", "source=tray");
                            SHUTTING_DOWN.store(true, Ordering::Relaxed);
                            crate::commands::release_appbars(&ah);
                            set_taskbar_visibility(true, true);
                            NATIVE_TASKBAR_HIDDEN.store(false, Ordering::Relaxed);
                            set_native_osd_suppressed(false);

                            ah.exit(0);
                        }
                        "restart" => {
                            diagnostics::record("restart", "source=tray");
                            SHUTTING_DOWN.store(true, Ordering::Relaxed);
                            crate::commands::release_appbars(&ah);
                            if let Some(w) = ah.get_webview_window("settings") {
                                let _ = w.destroy();
                            }
                            set_taskbar_visibility(true, true);
                            NATIVE_TASKBAR_HIDDEN.store(false, Ordering::Relaxed);
                            set_native_osd_suppressed(false);
                            close_single_instance_handles();

                            ah.restart();
                        }
                        "settings" => {
                            crate::commands::open_settings_window(ah.clone());
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            crate::commands::open_settings_window(tray.app_handle().clone());
                        }
                    })
                    .build(app)?;
                log_boot("tray icon built successfully");
            }
            log_boot("setup() completed successfully");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    log_boot("entering app.run()");
    app.run(|_, event| {
        match &event {
            tauri::RunEvent::ExitRequested { code, .. } => {
                log_boot(&format!("app.run: ExitRequested code={:?}", code));
            }
            tauri::RunEvent::Exit => {
                log_boot("app.run: Exit");
                diagnostics::record("exit", "restoring native taskbar");
                set_taskbar_visibility(true, true);
                NATIVE_TASKBAR_HIDDEN.store(false, Ordering::Relaxed);
                set_native_osd_suppressed(false);
            }
            tauri::RunEvent::WindowEvent { label, event: we, .. } => {
                match we {
                    tauri::WindowEvent::Destroyed => {
                        log_boot(&format!("Window '{}' Destroyed", label));
                    }
                    tauri::WindowEvent::CloseRequested { .. } => {
                        log_boot(&format!("Window '{}' CloseRequested", label));
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    });
}
