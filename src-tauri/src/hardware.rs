use serde::{Deserialize, Serialize};

use std::ffi::{c_char, c_uint, c_ulonglong, c_void, CStr};

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

use windows::core::s;

use windows::Win32::Foundation::FILETIME;

use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};

use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

use windows::Win32::System::Threading::GetSystemTimes;



#[derive(Clone, Debug, Serialize, Deserialize)]

pub struct HardwareStats {

    pub cpu_name: String,

    pub cpu_percent: f32,

    pub ram_used_gb: f32,

    pub ram_total_gb: f32,

    pub ram_percent: f32,

    pub gpu_name: String,

    pub gpu_percent: u32,

    pub gpu_temp: u32,

    pub vram_used_gb: f32,

    pub vram_total_gb: f32,

}



fn filetime_to_u64(ft: FILETIME) -> u64 {

    ((ft.dwHighDateTime as u64) << 32) | (ft.dwLowDateTime as u64)

}



pub struct CpuUsageTracker {

    last_idle: u64,

    last_kernel: u64,

    last_user: u64,

}



impl CpuUsageTracker {

    pub fn new() -> Self {

        let mut idle = FILETIME::default();

        let mut kernel = FILETIME::default();

        let mut user = FILETIME::default();

        unsafe {

            let _ = GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user));

        }

        Self {

            last_idle: filetime_to_u64(idle),

            last_kernel: filetime_to_u64(kernel),

            last_user: filetime_to_u64(user),

        }

    }



    pub fn get_usage(&mut self) -> f32 {

        let mut idle = FILETIME::default();

        let mut kernel = FILETIME::default();

        let mut user = FILETIME::default();

        unsafe {

            if GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)).is_err() {

                return 0.0;

            }

        }

        let idle_u64 = filetime_to_u64(idle);

        let kernel_u64 = filetime_to_u64(kernel);

        let user_u64 = filetime_to_u64(user);



        let idle_diff = idle_u64.saturating_sub(self.last_idle);

        let kernel_diff = kernel_u64.saturating_sub(self.last_kernel);

        let user_diff = user_u64.saturating_sub(self.last_user);



        self.last_idle = idle_u64;

        self.last_kernel = kernel_u64;

        self.last_user = user_u64;



        let total_diff = kernel_diff + user_diff;

        if total_diff == 0 {

            return 0.0;

        }



        let busy_diff = total_diff.saturating_sub(idle_diff);

        let pct = (busy_diff as f64 / total_diff as f64) * 100.0;

        (pct.clamp(0.0, 100.0) as f32).round()

    }

}



pub struct RamStats {

    pub used_gb: f32,

    pub total_gb: f32,

    pub percent: f32,

}



pub fn get_ram_stats() -> RamStats {

    let mut mem = MEMORYSTATUSEX::default();

    mem.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;

    unsafe {

        if GlobalMemoryStatusEx(&mut mem).is_ok() {

            let total = mem.ullTotalPhys as f64 / (1024.0 * 1024.0 * 1024.0);

            let avail = mem.ullAvailPhys as f64 / (1024.0 * 1024.0 * 1024.0);

            let used = total - avail;

            return RamStats {

                used_gb: (used as f32 * 10.0).round() / 10.0,

                total_gb: (total as f32 * 10.0).round() / 10.0,

                percent: mem.dwMemoryLoad as f32,

            };

        }

    }

    RamStats {

        used_gb: 0.0,

        total_gb: 32.0,

        percent: 0.0,

    }

}



#[repr(C)]

struct NvmlUtilization {

    gpu: c_uint,

    memory: c_uint,

}



#[repr(C)]

struct NvmlMemory {

    total: c_ulonglong,

    free: c_ulonglong,

    used: c_ulonglong,

}



type FnNvmlInit = unsafe extern "C" fn() -> c_uint;

type FnNvmlDeviceGetHandleByIndex = unsafe extern "C" fn(c_uint, *mut *mut c_void) -> c_uint;

type FnNvmlDeviceGetName = unsafe extern "C" fn(*mut c_void, *mut c_char, c_uint) -> c_uint;

type FnNvmlDeviceGetTemperature = unsafe extern "C" fn(*mut c_void, c_uint, *mut c_uint) -> c_uint;

type FnNvmlDeviceGetUtilizationRates =

    unsafe extern "C" fn(*mut c_void, *mut NvmlUtilization) -> c_uint;

type FnNvmlDeviceGetMemoryInfo = unsafe extern "C" fn(*mut c_void, *mut NvmlMemory) -> c_uint;



struct NvmlTracker {

    device_handle: *mut c_void,

    pub name: String,

    fn_get_temp: FnNvmlDeviceGetTemperature,

    fn_get_util: FnNvmlDeviceGetUtilizationRates,

    fn_get_mem: FnNvmlDeviceGetMemoryInfo,

}



unsafe impl Send for NvmlTracker {}

unsafe impl Sync for NvmlTracker {}



impl NvmlTracker {

    pub fn try_init() -> Option<Self> {

        unsafe {

            let lib = LoadLibraryA(s!("nvml.dll")).ok()?;

            let fn_init: FnNvmlInit =

                std::mem::transmute(GetProcAddress(lib, s!("nvmlInit_v2"))?);

            if fn_init() != 0 {

                return None;

            }



            let fn_get_handle: FnNvmlDeviceGetHandleByIndex =

                std::mem::transmute(GetProcAddress(lib, s!("nvmlDeviceGetHandleByIndex_v2"))?);

            let mut device_handle: *mut c_void = std::ptr::null_mut();

            if fn_get_handle(0, &mut device_handle) != 0 || device_handle.is_null() {

                return None;

            }



            let fn_get_name: FnNvmlDeviceGetName =

                std::mem::transmute(GetProcAddress(lib, s!("nvmlDeviceGetName"))?);

            let mut name_buf = [0i8; 64];

            let name = if fn_get_name(device_handle, name_buf.as_mut_ptr(), 64) == 0 {

                CStr::from_ptr(name_buf.as_ptr())

                    .to_string_lossy()

                    .into_owned()

            } else {

                "NVIDIA RTX GPU".to_string()

            };



            let fn_get_temp: FnNvmlDeviceGetTemperature =

                std::mem::transmute(GetProcAddress(lib, s!("nvmlDeviceGetTemperature"))?);

            let fn_get_util: FnNvmlDeviceGetUtilizationRates =

                std::mem::transmute(GetProcAddress(lib, s!("nvmlDeviceGetUtilizationRates"))?);

            let fn_get_mem: FnNvmlDeviceGetMemoryInfo =

                std::mem::transmute(GetProcAddress(lib, s!("nvmlDeviceGetMemoryInfo"))?);



            Some(Self {

                device_handle,

                name,

                fn_get_temp,

                fn_get_util,

                fn_get_mem,

            })

        }

    }



    pub fn read(&self) -> (u32, u32, f32, f32) {

        unsafe {

            let mut temp = 0u32;

            let _ = (self.fn_get_temp)(self.device_handle, 0, &mut temp);



            let mut util = NvmlUtilization { gpu: 0, memory: 0 };

            let _ = (self.fn_get_util)(self.device_handle, &mut util);



            let mut mem = NvmlMemory {

                total: 0,

                free: 0,

                used: 0,

            };

            let _ = (self.fn_get_mem)(self.device_handle, &mut mem);



            let vram_used = mem.used as f64 / (1024.0 * 1024.0 * 1024.0);

            let vram_total = mem.total as f64 / (1024.0 * 1024.0 * 1024.0);



            (

                util.gpu,

                temp,

                (vram_used as f32 * 10.0).round() / 10.0,

                (vram_total as f32 * 10.0).round() / 10.0,

            )

        }

    }

}



#[allow(dead_code)]
pub static HUD_GAMER_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn setup_hardware_telemetry(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut cpu = CpuUsageTracker::new();
        let nvml = NvmlTracker::try_init();

        loop {
            // Adaptive polling: 1000ms when user is interacting with notch/dock, 3500ms when resting idle
            let is_active = crate::state::NOTCH_IS_HOVERED.load(Ordering::Relaxed)
                || crate::state::DOCK_IS_HOVERED.load(Ordering::Relaxed);
            let sleep_ms = if is_active { 1000 } else { 3500 };
            std::thread::sleep(std::time::Duration::from_millis(sleep_ms));

            if crate::state::SHUTTING_DOWN.load(Ordering::Relaxed) || crate::utils::is_workstation_locked() {
                continue;
            }



            let cpu_pct = cpu.get_usage();

            let ram = get_ram_stats();



            let (gpu_pct, gpu_temp, vram_used, vram_total, gpu_name) = if let Some(ref n) = nvml {

                let (u, t, vu, vt) = n.read();

                (u, t, vu, vt, n.name.clone())

            } else {

                (0, 0, 0.0, 0.0, "N/A".to_string())

            };



            let stats = HardwareStats {

                cpu_name: "i7-13700H".to_string(),

                cpu_percent: cpu_pct,

                ram_used_gb: ram.used_gb,

                ram_total_gb: ram.total_gb,

                ram_percent: ram.percent,

                gpu_name,

                gpu_percent: gpu_pct,

                gpu_temp,

                vram_used_gb: vram_used,

                vram_total_gb: vram_total,

            };



            if let Some(w) = app_handle.get_webview_window("main") {

                let _ = w.emit("hardware-stats", &stats);

            }

        }

    });

}

