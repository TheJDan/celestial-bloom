use serde::{Deserialize, Serialize};
use std::ffi::c_void;
use windows::core::{s, BOOL};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};
use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SmartBoostResult {
    pub freed_mb: f64,
    pub processes_optimized: u32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_percent: f32,
}

#[repr(C)]
struct PROCESSENTRY32W {
    dw_size: u32,
    cnt_usage: u32,
    th32_process_id: u32,
    th32_default_heap_id: usize,
    th32_module_id: u32,
    cnt_threads: u32,
    th32_parent_process_id: u32,
    pc_pri_class_base: i32,
    dw_flags: u32,
    sz_exe_file: [u16; 260],
}

#[repr(C)]
struct PROCESS_MEMORY_COUNTERS {
    cb: u32,
    page_fault_count: u32,
    peak_working_set_size: usize,
    working_set_size: usize,
    quota_peak_paged_pool_usage: usize,
    quota_paged_pool_usage: usize,
    quota_peak_non_paged_pool_usage: usize,
    quota_non_paged_pool_usage: usize,
    pagefile_usage: usize,
    peak_pagefile_usage: usize,
}

pub fn execute_smart_boost() -> SmartBoostResult {
    unsafe {
        // 1. Get foreground window PID to PROTECT it
        let fg_hwnd = GetForegroundWindow();
        let mut fg_pid = 0u32;
        if !fg_hwnd.is_invalid() {
            let _ = GetWindowThreadProcessId(fg_hwnd, Some(&mut fg_pid));
        }
        let self_pid = std::process::id();

        // 2. Load API functions from kernel32 and psapi
        let kernel32 = LoadLibraryA(s!("kernel32.dll")).unwrap_or_default();
        let psapi = LoadLibraryA(s!("psapi.dll")).unwrap_or_default();

        type FnCreateToolhelp32Snapshot = unsafe extern "system" fn(u32, u32) -> HANDLE;
        type FnProcess32FirstW = unsafe extern "system" fn(HANDLE, *mut PROCESSENTRY32W) -> BOOL;
        type FnProcess32NextW = unsafe extern "system" fn(HANDLE, *mut PROCESSENTRY32W) -> BOOL;
        type FnOpenProcess = unsafe extern "system" fn(u32, BOOL, u32) -> HANDLE;
        type FnCloseHandle = unsafe extern "system" fn(HANDLE) -> BOOL;
        type FnEmptyWorkingSet = unsafe extern "system" fn(HANDLE) -> BOOL;
        type FnGetProcessMemoryInfo = unsafe extern "system" fn(HANDLE, *mut PROCESS_MEMORY_COUNTERS, u32) -> BOOL;

        let fn_snapshot: Option<FnCreateToolhelp32Snapshot> =
            GetProcAddress(kernel32, s!("CreateToolhelp32Snapshot")).map(|f| std::mem::transmute(f));
        let fn_first: Option<FnProcess32FirstW> =
            GetProcAddress(kernel32, s!("Process32FirstW")).map(|f| std::mem::transmute(f));
        let fn_next: Option<FnProcess32NextW> =
            GetProcAddress(kernel32, s!("Process32NextW")).map(|f| std::mem::transmute(f));
        let fn_open: Option<FnOpenProcess> =
            GetProcAddress(kernel32, s!("OpenProcess")).map(|f| std::mem::transmute(f));
        let fn_close: Option<FnCloseHandle> =
            GetProcAddress(kernel32, s!("CloseHandle")).map(|f| std::mem::transmute(f));

        let fn_empty: Option<FnEmptyWorkingSet> =
            GetProcAddress(psapi, s!("EmptyWorkingSet")).or_else(|| {
                GetProcAddress(kernel32, s!("K32EmptyWorkingSet"))
            }).map(|f| std::mem::transmute(f));

        let fn_mem_info: Option<FnGetProcessMemoryInfo> =
            GetProcAddress(psapi, s!("GetProcessMemoryInfo")).or_else(|| {
                GetProcAddress(kernel32, s!("K32GetProcessMemoryInfo"))
            }).map(|f| std::mem::transmute(f));

        let mut total_freed_bytes: u64 = 0;
        let mut processes_trimmed: u32 = 0;

        let target_names = [
            "brave.exe",
            "chrome.exe",
            "msedge.exe",
            "firefox.exe",
            "opera.exe",
            "vivaldi.exe",
            "discord.exe",
            "spotify.exe",
            "steamwebhelper.exe",
            "slack.exe",
            "notion.exe",
            "teams.exe",
            "code.exe",
        ];

        if let (Some(f_snap), Some(f_first), Some(f_next), Some(f_open), Some(f_close), Some(f_empty)) =
            (fn_snapshot, fn_first, fn_next, fn_open, fn_close, fn_empty)
        {
            // TH32CS_SNAPPROCESS = 0x00000002
            let h_snap = f_snap(0x00000002, 0);
            if !h_snap.is_invalid() {
                let mut entry = PROCESSENTRY32W {
                    dw_size: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                    cnt_usage: 0,
                    th32_process_id: 0,
                    th32_default_heap_id: 0,
                    th32_module_id: 0,
                    cnt_threads: 0,
                    th32_parent_process_id: 0,
                    pc_pri_class_base: 0,
                    dw_flags: 0,
                    sz_exe_file: [0; 260],
                };

                if f_first(h_snap, &mut entry).as_bool() {
                    loop {
                        let pid = entry.th32_process_id;
                        if pid != 0 && pid != 4 && pid != fg_pid && pid != self_pid {
                            let len = entry.sz_exe_file.iter().position(|&c| c == 0).unwrap_or(entry.sz_exe_file.len());
                            let name = String::from_utf16_lossy(&entry.sz_exe_file[..len]).to_lowercase();

                            if target_names.iter().any(|&t| name == t) {
                                // PROCESS_QUERY_INFORMATION (0x0400) | PROCESS_SET_QUOTA (0x0100)
                                let h_proc = f_open(0x0400 | 0x0100, BOOL(0), pid);
                                if !h_proc.is_invalid() {
                                    let mut before_ws = 0usize;
                                    if let Some(f_mem) = fn_mem_info {
                                        let mut pmc = std::mem::zeroed::<PROCESS_MEMORY_COUNTERS>();
                                        pmc.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
                                        if f_mem(h_proc, &mut pmc, pmc.cb).as_bool() {
                                            before_ws = pmc.working_set_size;
                                        }
                                    }

                                    if f_empty(h_proc).as_bool() {
                                        processes_trimmed += 1;
                                        if let Some(f_mem) = fn_mem_info {
                                            let mut pmc_after = std::mem::zeroed::<PROCESS_MEMORY_COUNTERS>();
                                            pmc_after.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
                                            if f_mem(h_proc, &mut pmc_after, pmc_after.cb).as_bool() {
                                                let diff = before_ws.saturating_sub(pmc_after.working_set_size);
                                                total_freed_bytes += diff as u64;
                                            }
                                        }
                                    }
                                    let _ = f_close(h_proc);
                                }
                            }
                        }

                        if !f_next(h_snap, &mut entry).as_bool() {
                            break;
                        }
                    }
                }
                let _ = f_close(h_snap);
            }
        }

        // 3. Standby List Purge (safe, no effect if privilege isn't granted)
        let ntdll = LoadLibraryA(s!("ntdll.dll")).unwrap_or_default();
        type FnNtSetSystemInformation = unsafe extern "system" fn(i32, *const c_void, u32) -> i32;
        if let Some(fn_nt_set) = GetProcAddress(ntdll, s!("NtSetSystemInformation")).map(|f| {
            let func: FnNtSetSystemInformation = std::mem::transmute(f);
            func
        }) {
            // SystemMemoryListInformation = 80, MemoryPurgeStandbyList = 4
            let command: u32 = 4;
            let _ = fn_nt_set(80, &command as *const u32 as *const c_void, std::mem::size_of::<u32>() as u32);
        }

        // 4. Read final memory status
        let mut mem = MEMORYSTATUSEX::default();
        mem.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        let mut ram_used_gb = 0.0f32;
        let mut ram_total_gb = 0.0f32;
        let mut ram_percent = 0.0f32;

        if GlobalMemoryStatusEx(&mut mem).is_ok() {
            let total = mem.ullTotalPhys as f64 / (1024.0 * 1024.0 * 1024.0);
            let avail = mem.ullAvailPhys as f64 / (1024.0 * 1024.0 * 1024.0);
            let used = total - avail;
            ram_used_gb = (used as f32 * 10.0).round() / 10.0;
            ram_total_gb = (total as f32 * 10.0).round() / 10.0;
            ram_percent = mem.dwMemoryLoad as f32;
        }

        let freed_mb = (total_freed_bytes as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0;

        SmartBoostResult {
            freed_mb,
            processes_optimized: processes_trimmed,
            ram_used_gb,
            ram_total_gb,
            ram_percent,
        }
    }
}
