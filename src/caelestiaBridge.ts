import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";

export interface HardwareStats {
	cpu_percent: number;
	cpu_temp?: number;
	cpu_name?: string;
	gpu_percent?: number;
	gpu_temp?: number;
	gpu_name?: string;
	ram_used_gb: number;
	ram_total_gb: number;
	ram_percent: number;
	storage_used_gb?: number;
	storage_total_gb?: number;
	storage_percent?: number;
	net_download_speed?: number;
	net_upload_speed?: number;
}

const DEFAULT_PINNED_APPS = [
	{
		name: "Antigravity",
		path: "antigravity",
		executable: "antigravity",
		icon: "/icons/antigravity.svg",
		is_running: true,
		window_count: 1
	},
	{
		name: "Brave",
		path: "com.brave.Browser",
		executable: "brave",
		icon: "/icons/brave.svg",
		is_running: true,
		window_count: 1
	},
	{
		name: "Steam",
		path: "steam",
		executable: "steam",
		icon: "/icons/steam.svg",
		is_running: false,
		window_count: 0
	},
	{
		name: "Archivos",
		path: "org.kde.dolphin",
		executable: "dolphin",
		icon: "/icons/dolphin.svg",
		is_running: false,
		window_count: 0
	},
	{
		name: "Konsole",
		path: "org.kde.konsole",
		executable: "konsole",
		icon: "/icons/konsole.svg",
		is_running: false,
		window_count: 0
	},
	{
		name: "Lutris",
		path: "net.lutris.Lutris",
		executable: "lutris",
		icon: "/icons/lutris.svg",
		is_running: false,
		window_count: 0
	},
	{
		name: "Bazar",
		path: "io.github.kolunmi.Bazaar",
		executable: "bazaar",
		icon: "/icons/discover.svg",
		is_running: false,
		window_count: 0
	}
];

export function initCaelestiaBridge() {
	if (typeof window === "undefined") return;
	(window as any).bloomEmit = emit;
	if ((window as any).__TAURI_INTERNALS__?.invoke) return;

	// Automatically dismiss old update announcements so Caelestia tabs take full priority
	try {
		localStorage.setItem("bloom-announcement-dismissed", "peek-mode-update");
		localStorage.setItem("bloom-first-run", "done");
		localStorage.setItem("bloom-notch-default-panel", "command-center");
		localStorage.setItem("bloom-start-icon", "linux");
	} catch {}

	try {
		mockWindows("main", "settings", "dock", "overlay");
	} catch (e) {
		console.warn("[Bridge] mockWindows error:", e);
	}

	mockIPC(async (cmd, args: any) => {
		// Hardware Stats
		if (cmd === "get_hardware_stats") {
			try {
				const res = await fetch("http://127.0.0.1:5180/api/stats");
				if (res.ok) return await res.json();
			} catch {}
			return {
				cpu_percent: 18.5,
				cpu_temp: 50.0,
				cpu_name: "Intel Core i7-13700H",
				gpu_percent: 37.0,
				gpu_temp: 48.0,
				gpu_name: "NVIDIA GeForce RTX 4060 Laptop GPU",
				ram_used_gb: 4.5,
				ram_total_gb: 15.4,
				ram_percent: 29.2,
				storage_used_gb: 31.4,
				storage_total_gb: 147.2,
				storage_percent: 21.3,
				net_download_speed: 343,
				net_upload_speed: 143
			};
		}

		if (cmd === "get_system_info") {
			return { cpu: 18, ram: 29, battery: 100 };
		}

		if (cmd === "get_username") {
			return "Dan";
		}

		if (cmd === "get_system_uptime") {
			try {
				const res = await fetch("http://127.0.0.1:5180/api/stats");
				if (res.ok) {
					const data = await res.json();
					return data.uptime || 900;
				}
			} catch {}
			return 900;
		}

		// Installed Apps for Spotlight
		if (cmd === "get_installed_apps") {
			try {
				const res = await fetch("http://127.0.0.1:5180/api/apps");
				if (res.ok) return await res.json();
			} catch {}
			return DEFAULT_PINNED_APPS;
		}

		// Dock Pinned Apps
		if (cmd === "load_pinned_apps") {
			try {
				const res = await fetch("http://127.0.0.1:5180/api/apps");
				if (res.ok) {
					const apps = await res.json();
					if (Array.isArray(apps) && apps.length > 0) return apps;
				}
			} catch {}
			return DEFAULT_PINNED_APPS;
		}

		if (cmd === "save_pinned_apps") {
			if (args?.apps) {
				localStorage.setItem("bloom-pinned-apps", JSON.stringify(args.apps));
			}
			return true;
		}

		// Running Apps
		if (cmd === "get_active_windows") {
			try {
				const res = await fetch("http://127.0.0.1:5180/api/apps");
				if (res.ok) {
					const apps = await res.json();
					return apps.filter((a: any) => a.is_running);
				}
			} catch {}
			return DEFAULT_PINNED_APPS.filter((a) => a.is_running);
		}

		if (cmd === "get_tray_apps" || cmd === "get_dock_extras" || cmd === "get_dock_drives") {
			return [];
		}

		if (cmd === "get_app_icon") {
			const p = (args?.path || "").toLowerCase();
			if (p.includes("brave")) return "/icons/brave.svg";
			if (p.includes("steam")) return "/icons/steam.svg";
			if (p.includes("lutris")) return "/icons/lutris.svg";
			if (p.includes("konsole")) return "/icons/konsole.svg";
			if (p.includes("discover")) return "/icons/discover.svg";
			if (p.includes("dolphin")) return "/icons/dolphin.svg";
			if (p.includes("antigravity")) return "/icons/antigravity.svg";
			return null;
		}

		// Launching Apps
		if (cmd === "spotlight_launch_app" || cmd === "open_app") {
			const target = args?.appName || args?.path || args?.executable || args?.exec || args?.name;
			try {
				await fetch("http://127.0.0.1:5180/api/launch", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path: target, exec: target, appName: target })
				});
			} catch (e) {
				console.error("[Bridge] Launch app error:", e);
			}
			return true;
		}

		if (cmd === "toggle_spotlight") {
			try {
				await fetch("http://127.0.0.1:5180/api/launch_menu", { method: "POST" });
			} catch {}
			return true;
		}

		// PIN & Lockscreen
		if (cmd === "verify_pin" || cmd === "verify_windows_password") {
			const pin = args?.pin || args?.password || "";
			try {
				const res = await fetch("http://127.0.0.1:5180/api/verify_pin", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pin })
				});
				if (res.ok) {
					const data = await res.json();
					return data.ok;
				}
			} catch {}
			// Default allow 1234 or empty or any 4 digit PIN
			return pin === "1234" || pin.trim() === "" || pin.length >= 4;
		}

		// Media Controls
		if (cmd === "media_play_pause" || cmd === "media_next" || cmd === "media_previous") {
			const action = cmd.replace("media_", "");
			try {
				await fetch("http://127.0.0.1:5180/api/media_control", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action })
				});
			} catch {}
			return true;
		}

		// Audio Devices & Headset
		if (cmd === "get_audio_output_devices") {
			return [
				{
					id: "default-output",
					name: "Altavoces principales",
					is_default: true
				}
			];
		}

		if (cmd === "get_audio_input_devices") {
			return [
				{
					id: "default-input",
					name: "Micrófono principal",
					is_default: true
				}
			];
		}

		if (cmd === "get_headset_battery") {
			return 85;
		}

		// Volume
		if (cmd === "get_volume_state") {
			return { volume: 0.75, is_muted: false };
		}

		if (cmd === "set_volume") {
			return true;
		}

		// Settings
		if (cmd === "load_settings") {
			return {};
		}

		if (cmd === "save_setting") {
			if (args?.key && args?.value !== undefined) {
				localStorage.setItem(args.key, String(args.value));
			}
			return true;
		}

		if (cmd === "change_notch_mode") {
			if (args?.mode) localStorage.setItem("bloom-notch-mode", args.mode);
			return true;
		}

		if (cmd === "change_dock_mode") {
			if (args?.mode) localStorage.setItem("bloom-dock-mode", args.mode);
			return true;
		}

		if (cmd === "set_window_region") {
			const rects = args?.rects || [];
			(window as any).__bloom_rects = rects;
			if ((window as any).qtBridge && (window as any).qtBridge.setRegion) {
				try {
					(window as any).qtBridge.setRegion(JSON.stringify(rects));
				} catch (e) {
					console.error("[Bridge] setRegion error:", e);
				}
			}
			return true;
		}

		if (cmd.includes("is_visible") || cmd.includes("visible")) {
			return true;
		}

		return true;
	}, { shouldMockEvents: true });

	// Live Media Polling from Daemon
	setInterval(async () => {
		try {
			const res = await fetch("http://127.0.0.1:5180/api/media");
			if (res.ok) {
				const data = await res.json();
				emit("media-update", {
					title: data.title || "",
					artist: data.artist || "",
					is_playing: !!data.is_playing,
					has_media: !!data.has_media,
					artwork: data.artwork || [],
					position_ms: (data.position || 0) * 1000,
					duration_ms: (data.duration || 0) * 1000,
					position_updated_at: Date.now()
				});
			}
		} catch {}
	}, 1500);

	console.log("[CaelestiaBridge] Mock IPC active with live Linux backend support");
}
