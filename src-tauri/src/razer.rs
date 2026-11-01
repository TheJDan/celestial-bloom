use std::ffi::c_void;
use std::time::Duration;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND};
use windows::Win32::Storage::FileSystem::{
    CreateFileW, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
};

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct GUID {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

#[repr(C)]
struct SpDeviceInterfaceData {
    cb_size: u32,
    interface_class_guid: GUID,
    flags: u32,
    reserved: usize,
}

#[link(name = "hid")]
extern "system" {
    fn HidD_GetHidGuid(hid_guid: *mut GUID);
    fn HidD_SetFeature(hid_device_object: HANDLE, report_buffer: *const c_void, report_buffer_length: u32) -> i32;
    fn HidD_GetFeature(hid_device_object: HANDLE, report_buffer: *mut c_void, report_buffer_length: u32) -> i32;
}

#[link(name = "setupapi")]
extern "system" {
    fn SetupDiGetClassDevsW(
        class_guid: *const GUID,
        enumerator: PCWSTR,
        hwnd_parent: HWND,
        flags: u32,
    ) -> *mut c_void;
    fn SetupDiEnumDeviceInterfaces(
        device_info_set: *mut c_void,
        device_info_data: *const c_void,
        interface_class_guid: *const GUID,
        member_index: u32,
        device_interface_data: *mut SpDeviceInterfaceData,
    ) -> i32;
    fn SetupDiGetDeviceInterfaceDetailW(
        device_info_set: *mut c_void,
        device_interface_data: *const SpDeviceInterfaceData,
        device_interface_detail_data: *mut u8,
        device_interface_detail_data_size: u32,
        required_size: *mut u32,
        device_info_data: *mut c_void,
    ) -> i32;
    fn SetupDiDestroyDeviceInfoList(device_info_set: *mut c_void) -> i32;
}

pub fn get_razer_battery() -> Option<u8> {
    unsafe {
        let mut hid_guid = GUID::default();
        HidD_GetHidGuid(&mut hid_guid);

        let dev_info = SetupDiGetClassDevsW(
            &hid_guid,
            PCWSTR::null(),
            HWND(std::ptr::null_mut()),
            2 | 16, // DIGCF_PRESENT | DIGCF_DEVICEINTERFACE
        );
        if dev_info.is_null() || dev_info as isize == -1 {
            return None;
        }

        let mut idx = 0;
        let mut target_path: Option<Vec<u16>> = None;

        loop {
            let mut iface = SpDeviceInterfaceData {
                cb_size: std::mem::size_of::<SpDeviceInterfaceData>() as u32,
                interface_class_guid: GUID::default(),
                flags: 0,
                reserved: 0,
            };

            if SetupDiEnumDeviceInterfaces(
                dev_info,
                std::ptr::null(),
                &hid_guid,
                idx,
                &mut iface,
            ) == 0 {
                break;
            }
            idx += 1;

            let mut req_size = 0u32;
            SetupDiGetDeviceInterfaceDetailW(
                dev_info,
                &iface,
                std::ptr::null_mut(),
                0,
                &mut req_size,
                std::ptr::null_mut(),
            );

            if req_size == 0 {
                continue;
            }

            let mut buf = vec![0u8; req_size as usize];
            let cb_size_val: u32 = 8;
            std::ptr::copy_nonoverlapping(
                &cb_size_val as *const u32 as *const u8,
                buf.as_mut_ptr(),
                4,
            );

            if SetupDiGetDeviceInterfaceDetailW(
                dev_info,
                &iface,
                buf.as_mut_ptr(),
                req_size,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            ) != 0 {
                let path_slice = std::slice::from_raw_parts(
                    buf.as_ptr().add(4) as *const u16,
                    (req_size as usize - 4) / 2,
                );
                let path_str = String::from_utf16_lossy(path_slice).to_lowercase();
                if path_str.contains("vid_1532") && path_str.contains("pid_0528") && path_str.contains("col03") {
                    let mut wide_null: Vec<u16> = path_slice.iter().take_while(|&&c| c != 0).cloned().collect();
                    wide_null.push(0);
                    target_path = Some(wide_null);
                    break;
                }
            }
        }

        SetupDiDestroyDeviceInfoList(dev_info);

        let path = target_path?;
        let pcwstr = PCWSTR(path.as_ptr());

        let handle = CreateFileW(
            pcwstr,
            0x80000000 | 0x40000000,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            None,
        );

        let Ok(handle) = handle else {
            return None;
        };
        if handle.is_invalid() {
            return None;
        }

        let mut req = [0u8; 64];
        let req_bytes: [u8; 9] = [0xff, 0x0a, 0x00, 0xfd, 0x04, 0x12, 0xf1, 0x02, 0x05];
        req[..9].copy_from_slice(&req_bytes);

        let ok_set = HidD_SetFeature(handle, req.as_ptr() as *const c_void, 64);
        if ok_set == 0 {
            let _ = CloseHandle(handle);
            return None;
        }

        std::thread::sleep(Duration::from_millis(80));

        let mut resp = [0u8; 64];
        resp[0] = 0xff;

        let ok_get = HidD_GetFeature(handle, resp.as_mut_ptr() as *mut c_void, 64);
        let _ = CloseHandle(handle);

        if ok_get != 0 && resp[0] == 0xff {
            let level = resp[14];
            if level <= 100 && level > 0 {
                return Some(level);
            }
        }

        None
    }
}
