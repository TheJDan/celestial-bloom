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
    pub cpu_temp: f32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_percent: f32,
    pub gpu_name: String,
    pub gpu_percent: u32,
    pub gpu_temp: u32,
    pub vram_used_gb: f32,
    pub vram_total_gb: f32,
    pub storage_used_gb: f32,
    pub storage_total_gb: f32,
    pub storage_percent: f32,
    pub storage_unit: String,
    pub net_download_speed: u64,
    pub net_upload_speed: u64,
    pub battery_percent: u8,
    pub is_charging: bool,
    pub battery_state: String,
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

pub fn get_cpu_name() -> String {
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY_LOCAL_MACHINE, KEY_READ, REG_SZ,
    };
    unsafe {
        let subkey = windows::core::w!("HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0");
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if RegOpenKeyExW(HKEY_LOCAL_MACHINE, subkey, Some(0), KEY_READ, &mut hkey).is_ok() {
            let mut val_type = REG_SZ;
            let mut buf = [0u16; 256];
            let mut buf_size = (buf.len() * 2) as u32;
            let val_name = windows::core::w!("ProcessorNameString");
            if RegQueryValueExW(
                hkey,
                val_name,
                None,
                Some(&mut val_type),
                Some(buf.as_mut_ptr() as *mut u8),
                Some(&mut buf_size),
            )
            .is_ok()
            {
                let _ = RegCloseKey(hkey);
                let len = (buf_size / 2) as usize;
                let s = String::from_utf16_lossy(&buf[..len]);
                let trimmed = s.trim_matches('\0').trim().to_string();
                if !trimmed.is_empty() {
                    return trimmed;
                }
            } else {
                let _ = RegCloseKey(hkey);
            }
        }
    }
    "CPU del sistema".to_string()
}

pub fn get_fallback_gpu_name() -> String {
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY_LOCAL_MACHINE, KEY_READ, REG_SZ,
    };
    for index in 0..4 {
        let path = format!(
            "SYSTEM\\CurrentControlSet\\Control\\Class\\{{4d36e968-e325-11ce-bfc1-08002be10318}}\\{:04}",
            index
        );
        let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            let mut hkey = windows::Win32::System::Registry::HKEY::default();
            if RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                windows::core::PCWSTR(wide.as_ptr()),
                Some(0),
                KEY_READ,
                &mut hkey,
            )
            .is_ok()
            {
                let mut val_type = REG_SZ;
                let mut buf = [0u16; 256];
                let mut buf_size = (buf.len() * 2) as u32;
                let val_name = windows::core::w!("DriverDesc");
                if RegQueryValueExW(
                    hkey,
                    val_name,
                    None,
                    Some(&mut val_type),
                    Some(buf.as_mut_ptr() as *mut u8),
                    Some(&mut buf_size),
                )
                .is_ok()
                {
                    let _ = RegCloseKey(hkey);
                    let len = (buf_size / 2) as usize;
                    let s = String::from_utf16_lossy(&buf[..len]);
                    let trimmed = s.trim_matches('\0').trim().to_string();
                    if !trimmed.is_empty() {
                        return trimmed;
                    }
                } else {
                    let _ = RegCloseKey(hkey);
                }
            }
        }
    }
    "Adaptador de pantalla".to_string()
}

pub fn query_hardware_telemetry(
    cpu_tracker: &mut CpuUsageTracker,
    nvml: &Option<NvmlTracker>,
) -> HardwareStats {
    let cpu_name = get_cpu_name();
    let cpu_percent = cpu_tracker.get_usage();
    let ram = get_ram_stats();

    let (gpu_percent, gpu_temp, vram_used_gb, vram_total_gb, gpu_name) = if let Some(ref n) = nvml {
        let (u, t, vu, vt) = n.read();
        (u, t, vu, vt, n.name.clone())
    } else {
        (0, 0, 0.0, 0.0, get_fallback_gpu_name())
    };

    // Storage C:\
    let (storage_used_gb, storage_total_gb, storage_percent) = unsafe {
        let mut free_bytes = 0u64;
        let mut total_bytes = 0u64;
        let mut total_free = 0u64;
        if windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
            windows::core::w!("C:\\"),
            Some(&mut free_bytes),
            Some(&mut total_bytes),
            Some(&mut total_free),
        )
        .is_ok()
            && total_bytes > 0
        {
            let total = total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
            let free = free_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
            let used = total - free;
            let pct = (used / total) * 100.0;
            (
                (used as f32 * 10.0).round() / 10.0,
                (total as f32 * 10.0).round() / 10.0,
                pct as f32,
            )
        } else {
            (0.0, 0.0, 0.0)
        }
    };

    // Network speed
    let (net_upload_speed, net_download_speed) =
        crate::commands::get_network_speed().unwrap_or((0, 0));

    // Battery
    let (battery_percent, is_charging, battery_state) = unsafe {
        let mut status = windows::Win32::System::Power::SYSTEM_POWER_STATUS::default();
        if windows::Win32::System::Power::GetSystemPowerStatus(&mut status).is_ok() {
            let pct = if status.BatteryLifePercent <= 100 {
                status.BatteryLifePercent
            } else {
                100
            };
            let charging = (status.BatteryFlag & 8) != 0;
            let state = if status.ACLineStatus == 1 {
                if charging {
                    "Cargando".to_string()
                } else {
                    "Conectado".to_string()
                }
            } else {
                "En batería".to_string()
            };
            (pct, charging, state)
        } else {
            (100, false, "En corriente".to_string())
        }
    };

    HardwareStats {
        cpu_name,
        cpu_percent,
        cpu_temp: 48.0,
        ram_used_gb: ram.used_gb,
        ram_total_gb: ram.total_gb,
        ram_percent: ram.percent,
        gpu_name,
        gpu_percent,
        gpu_temp,
        vram_used_gb,
        vram_total_gb,
        storage_used_gb,
        storage_total_gb,
        storage_percent,
        storage_unit: "C:".to_string(),
        net_download_speed,
        net_upload_speed,
        battery_percent,
        is_charging,
        battery_state,
    }
}

static TELEMETRY_STATE: std::sync::OnceLock<
    std::sync::Mutex<(CpuUsageTracker, Option<NvmlTracker>)>,
> = std::sync::OnceLock::new();

#[tauri::command]
pub async fn get_hardware_stats() -> Result<HardwareStats, String> {
    let state = TELEMETRY_STATE.get_or_init(|| {
        let cpu = CpuUsageTracker::new();
        let nvml = NvmlTracker::try_init();
        std::sync::Mutex::new((cpu, nvml))
    });

    let mut lock = state.lock().map_err(|e| e.to_string())?;
    let (ref mut cpu, ref nvml) = *lock;
    Ok(query_hardware_telemetry(cpu, nvml))
}

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

            if crate::state::SHUTTING_DOWN.load(Ordering::Relaxed)
                || crate::utils::is_workstation_locked()
            {
                continue;
            }

            let stats = query_hardware_telemetry(&mut cpu, &nvml);

            if let Some(w) = app_handle.get_webview_window("main") {
                let _ = w.emit("hardware-stats", &stats);
            }
        }
    });
}

