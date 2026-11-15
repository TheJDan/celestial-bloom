use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// Minimum time between automatic background update checks (6 hours). Manual checks bypass this.
const CHECK_INTERVAL_SECS: i64 = 6 * 60 * 60;
/// Network timeout for requests to GitHub API
const TIMEOUT_SECS: u64 = 30;
const STATE_FILE: &str = "update-state.json";
const GITHUB_REPO: &str = "TheJDan/celestial-bloom";

static CHECK_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static UPDATE_BUSY: AtomicBool = AtomicBool::new(false);
static LAST_CHECK: Mutex<Option<UpdateCheckResult>> = Mutex::new(None);
static PENDING_UPDATE: Mutex<Option<PendingUpdate>> = Mutex::new(None);

#[derive(Clone, Default, Serialize, Deserialize, Debug)]
pub struct UpdateCheckResult {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

#[derive(Clone, Debug)]
struct PendingUpdate {
    #[allow(dead_code)]
    version: String,
    download_url: String,
    total_size: u64,
}

#[derive(Default, Serialize, Deserialize)]
struct PersistedUpdateState {
    last_check: i64,
    app_version: String,
    version: String,
    date: String,
    #[serde(default)]
    attempted_version: String,
    #[serde(default)]
    attempted_at: i64,
}

#[derive(Deserialize, Debug)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Deserialize, Debug)]
struct GithubRelease {
    tag_name: String,
    name: Option<String>,
    published_at: Option<String>,
    body: Option<String>,
    assets: Vec<GithubAsset>,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(STATE_FILE))
}

fn read_state(app: &AppHandle) -> PersistedUpdateState {
    state_path(app)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

fn write_state(app: &AppHandle, state: &PersistedUpdateState) {
    if let Some(path) = state_path(app) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(content) = serde_json::to_string(state) {
            let _ = std::fs::write(path, content);
        }
    }
}

fn result_from_state(state: &PersistedUpdateState) -> UpdateCheckResult {
    if state.version.is_empty() {
        return UpdateCheckResult::default();
    }
    UpdateCheckResult {
        available: true,
        version: Some(state.version.clone()),
        date: (!state.date.is_empty()).then(|| state.date.clone()),
        body: None,
    }
}

fn state_is_current(state: &PersistedUpdateState, current_version: &str) -> bool {
    state.app_version == current_version
}

fn cached_result(app: &AppHandle) -> Option<UpdateCheckResult> {
    let state = read_state(app);
    if state.last_check == 0 || now_secs() - state.last_check >= CHECK_INTERVAL_SECS {
        return None;
    }
    if !state_is_current(&state, &app.package_info().version.to_string()) {
        return None;
    }
    Some(result_from_state(&state))
}

pub fn release_is_old_enough(_result: &UpdateCheckResult) -> bool {
    true
}

fn install_attempted_recently(state: &PersistedUpdateState, version: &str, now: i64) -> bool {
    state.attempted_version == version
        && state.attempted_at > 0
        && now - state.attempted_at < (60 * 60)
}

fn get_current_build_number(app: &AppHandle) -> u64 {
    if let Some(build_str) = option_env!("CELESTIAL_BUILD_NUMBER") {
        if let Ok(num) = build_str.parse::<u64>() {
            return num;
        }
    }
    let ver = app.package_info().version.to_string();
    ver.split('.').last().and_then(|p| p.parse().ok()).unwrap_or(0)
}

fn parse_tag_build_number(tag: &str) -> u64 {
    let clean = tag.trim().trim_start_matches('v').trim_start_matches('V');
    clean.split('.').last().and_then(|p| p.parse().ok()).unwrap_or(0)
}

pub async fn check(app: &AppHandle, force: bool) -> Result<UpdateCheckResult, String> {
    if !force {
        if let Some(cached) = cached_result(app) {
            return Ok(cached);
        }
    }

    let _guard = CHECK_LOCK.lock().await;
    if !force {
        if let Some(cached) = cached_result(app) {
            return Ok(cached);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("celestial-bloom")
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let url = format!("https://api.github.com/repos/{}/releases/latest", GITHUB_REPO);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error checking updates: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API returned HTTP {}", resp.status()));
    }

    let release: GithubRelease = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse release metadata: {e}"))?;

    let remote_tag = release.tag_name.trim();
    let remote_build = parse_tag_build_number(remote_tag);
    let current_build = get_current_build_number(app);

    let is_newer = if remote_build > 0 && current_build > 0 {
        remote_build > current_build
    } else {
        let current_tag = format!("v{}", current_build);
        remote_tag != current_tag && remote_tag != "v0"
    };

    let exe_asset = release.assets.iter().find(|a| {
        let lower = a.name.to_lowercase();
        lower.ends_with(".exe") && (lower.contains("celestial") || lower.contains("bloom"))
    }).or_else(|| {
        release.assets.iter().find(|a| a.name.to_lowercase().ends_with(".exe"))
    });

    let result = if is_newer && exe_asset.is_some() {
        let asset = exe_asset.unwrap();
        let display_version = release.name.clone().unwrap_or_else(|| format!("Build #{}", remote_build));

        if let Ok(mut pending) = PENDING_UPDATE.lock() {
            *pending = Some(PendingUpdate {
                version: display_version.clone(),
                download_url: asset.browser_download_url.clone(),
                total_size: asset.size,
            });
        }

        UpdateCheckResult {
            available: true,
            version: Some(display_version),
            date: release.published_at.clone(),
            body: release.body.clone(),
        }
    } else {
        UpdateCheckResult::default()
    };

    let previous = read_state(app);
    write_state(
        app,
        &PersistedUpdateState {
            last_check: now_secs(),
            app_version: app.package_info().version.to_string(),
            version: result.version.clone().unwrap_or_default(),
            date: result.date.clone().unwrap_or_default(),
            attempted_version: previous.attempted_version,
            attempted_at: previous.attempted_at,
        },
    );

    if let Ok(mut cached) = LAST_CHECK.lock() {
        *cached = Some(result.clone());
    }

    let _ = app.emit("update-available", &result);
    Ok(result)
}

pub async fn install(app: &AppHandle) -> Result<(), String> {
    if UPDATE_BUSY.swap(true, Ordering::SeqCst) {
        return Err("an update is already in progress".to_string());
    }
    let result = install_inner(app).await;
    UPDATE_BUSY.store(false, Ordering::SeqCst);
    result
}

async fn install_inner(app: &AppHandle) -> Result<(), String> {
    let _guard = CHECK_LOCK.lock().await;

    let pending = {
        let lock = PENDING_UPDATE.lock().map_err(|e| e.to_string())?;
        lock.clone()
    };

    let pending = match pending {
        Some(p) => p,
        None => {
            let res = check(app, true).await?;
            if !res.available {
                return Err("No update available to install".to_string());
            }
            let lock = PENDING_UPDATE.lock().map_err(|e| e.to_string())?;
            lock.clone().ok_or_else(|| "No update asset found".to_string())?
        }
    };

    let _ = app.emit(
        "auto-update-status",
        serde_json::json!({ "status": "downloading", "progress": 0 }),
    );

    let client = reqwest::Client::builder()
        .user_agent("celestial-bloom")
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let mut resp = client
        .get(&pending.download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to initiate download: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with HTTP {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(pending.total_size);
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let temp_new_exe = current_exe.with_extension("new.exe");

    {
        use std::io::Write;
        let mut file = std::fs::File::create(&temp_new_exe)
            .map_err(|e| format!("Failed to create {}: {e}", temp_new_exe.display()))?;

        let mut downloaded: u64 = 0;
        let mut last_progress = 0u32;

        while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
            file.write_all(&chunk).map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;

            if total_size > 0 {
                let progress = (downloaded.saturating_mul(100) / total_size) as u32;
                if progress > last_progress {
                    last_progress = progress;
                    let _ = app.emit(
                        "auto-update-status",
                        serde_json::json!({ "status": "downloading", "progress": progress }),
                    );
                }
            }
        }
        file.flush().map_err(|e| e.to_string())?;
    }

    // Record the attempt
    {
        let mut state = read_state(app);
        state.attempted_version = pending.version.clone();
        state.attempted_at = now_secs();
        write_state(app, &state);
    }

    let _ = app.emit(
        "auto-update-status",
        serde_json::json!({ "status": "installing" }),
    );

    // Pre-exit cleanup
    crate::state::SHUTTING_DOWN.store(true, Ordering::Relaxed);
    crate::commands::release_appbars(app);
    crate::utils::set_taskbar_visibility(true, true);
    crate::services::set_native_osd_suppressed(false);
    app.cleanup_before_exit();

    #[cfg(windows)]
    {
        let old_exe = current_exe.with_extension("old.exe");
        let _ = std::fs::remove_file(&old_exe);

        let mut swapped = false;
        if std::fs::rename(&current_exe, &old_exe).is_ok() {
            if std::fs::rename(&temp_new_exe, &current_exe).is_ok() {
                swapped = true;
            } else {
                let _ = std::fs::rename(&old_exe, &current_exe);
            }
        }

        if swapped {
            let _ = std::process::Command::new(&current_exe).spawn();
            std::process::exit(0);
        } else {
            let bat_path = std::env::temp_dir().join("celestial_update.bat");
            let bat = format!(
                "@echo off\r\n\
                 ping 127.0.0.1 -n 2 > nul\r\n\
                 move /y \"{}\" \"{}\"\r\n\
                 if exist \"{}\" del /f /q \"{}\"\r\n\
                 start \"\" \"{}\"\r\n\
                 del \"%~f0\"\r\n",
                temp_new_exe.display(),
                current_exe.display(),
                old_exe.display(),
                old_exe.display(),
                current_exe.display()
            );
            let _ = std::fs::write(&bat_path, bat);
            let _ = std::process::Command::new("cmd")
                .args(["/c", &bat_path.to_string_lossy()])
                .spawn();
            std::process::exit(0);
        }
    }

    #[cfg(not(windows))]
    {
        let _ = std::fs::rename(&temp_new_exe, &current_exe);
        let _ = app.emit(
            "auto-update-status",
            serde_json::json!({ "status": "done" }),
        );
        app.restart()
    }
}

pub async fn run_startup_check(app: AppHandle) {
    let auto_update =
        crate::utils::get_setting_str(&app, "bloom-auto-update").as_deref() == Some("true");

    if auto_update {
        let _ = app.emit(
            "auto-update-status",
            serde_json::json!({ "status": "checking" }),
        );
    }

    let result = match check(&app, false).await {
        Ok(result) => result,
        Err(_) => {
            if auto_update {
                let _ = app.emit(
                    "auto-update-status",
                    serde_json::json!({ "status": "done" }),
                );
            }
            return;
        }
    };

    if !result.available {
        if auto_update {
            let _ = app.emit(
                "auto-update-status",
                serde_json::json!({ "status": "done" }),
            );
        }
        return;
    }

    let attempted_version = result.version.clone().unwrap_or_default();
    let attempted_recently =
        install_attempted_recently(&read_state(&app), &attempted_version, now_secs());

    if auto_update && !attempted_recently {
        if install(&app).await.is_err() {
            let _ = app.emit(
                "auto-update-status",
                serde_json::json!({ "status": "done" }),
            );
        }
    } else if auto_update {
        let _ = app.emit(
            "auto-update-status",
            serde_json::json!({ "status": "done" }),
        );
    }
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle, force: bool) -> Result<UpdateCheckResult, String> {
    check(&app, force).await
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    install(&app).await
}

#[tauri::command]
pub fn get_update_state(app: AppHandle) -> UpdateCheckResult {
    if let Ok(cached) = LAST_CHECK.lock() {
        if let Some(result) = cached.as_ref() {
            return result.clone();
        }
    }
    let state = read_state(&app);
    if !state_is_current(&state, &app.package_info().version.to_string()) {
        return UpdateCheckResult::default();
    }
    result_from_state(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_legacy_update_state_without_attempt_fields() {
        let state: PersistedUpdateState = serde_json::from_str(
            r#"{"last_check":1,"app_version":"3.8.7","version":"3.8.8","date":"2026-09-13T18:14:46Z"}"#,
        )
        .expect("legacy state parses");
        assert_eq!(state.attempted_version, "");
        assert_eq!(state.attempted_at, 0);
    }

    #[test]
    fn skips_recent_install_attempts_only() {
        let state = PersistedUpdateState {
            attempted_version: "3.8.8".into(),
            attempted_at: 1_000,
            ..Default::default()
        };

        assert!(install_attempted_recently(&state, "3.8.8", 1_000 + 600));
        assert!(!install_attempted_recently(
            &state,
            "3.8.8",
            1_000 + 7200
        ));
        assert!(!install_attempted_recently(&state, "3.8.9", 1_000 + 600));

        let empty = PersistedUpdateState::default();
        assert!(!install_attempted_recently(&empty, "3.8.8", 1_000));
    }

    #[test]
    fn persisted_state_only_applies_to_the_version_that_wrote_it() {
        let state = PersistedUpdateState {
            app_version: "1.0.0".into(),
            version: "Build #9".into(),
            ..Default::default()
        };

        assert!(state_is_current(&state, "1.0.0"));
        assert!(!state_is_current(&state, "Build #9"));
    }
}
