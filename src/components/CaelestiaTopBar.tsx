import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Home,
	Play,
	Clock,
	Sliders,
	Bell,
	FileText,
	Volume2,
	VolumeX,
	Wifi,
	Bluetooth,
	MicOff,
	Camera,
	Lock,
	MoreHorizontal,
	ChevronDown,
	Clipboard,
	Inbox,
	Link2,
	Pipette,
	Edit3
} from "lucide-react";
import "./CaelestiaTabs.css";

export type CaelestiaTabKey = "home" | "music" | "perf" | "timer" | "mixer" | "notifications" | "notes";

interface CaelestiaTopBarProps {
	activeTab: CaelestiaTabKey;
	onSwitchTab: (tab: CaelestiaTabKey) => void;
	notificationCount?: number;
	onSelectTool?: (tool: string) => void;
	selectedTool?: string;
}

export function CaelestiaTopBar({
	activeTab,
	onSwitchTab,
	notificationCount = 2,
	onSelectTool,
	selectedTool = "notes"
}: CaelestiaTopBarProps) {
	// Live clock
	const [timeStr, setTimeStr] = useState(() => {
		const now = new Date();
		return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
	});

	// Quick toggle states
	const [bluetoothOn, setBluetoothOn] = useState(true);
	const [wifiOn, setWifiOn] = useState(true);
	const [isMuted, setIsMuted] = useState(false);
	const [volume, setVolume] = useState(100);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Clock ticker
	useEffect(() => {
		const interval = setInterval(() => {
			const now = new Date();
			setTimeStr(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	// Initial hardware state read
	useEffect(() => {
		invoke<boolean>("get_bluetooth_state")
			.then((state) => setBluetoothOn(Boolean(state)))
			.catch(() => {});

		invoke<{ volume?: number; muted?: boolean } | number>("get_volume")
			.then((v) => {
				if (typeof v === "number") {
					setVolume(v);
					setIsMuted(v === 0);
				} else if (v && typeof v === "object") {
					if (typeof v.volume === "number") setVolume(v.volume);
					if (typeof v.muted === "boolean") setIsMuted(v.muted);
				}
			})
			.catch(() => {});
	}, []);

	// Close tools menu on click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		if (menuOpen) {
			window.addEventListener("mousedown", handleClickOutside);
		}
		return () => window.removeEventListener("mousedown", handleClickOutside);
	}, [menuOpen]);

	// Toggle bluetooth
	const handleToggleBluetooth = async () => {
		const next = !bluetoothOn;
		setBluetoothOn(next);
		try {
			await invoke("set_bluetooth_state", { enabled: next });
		} catch (e) {
			console.error("Bluetooth toggle failed:", e);
		}
	};

	// Toggle Wi-Fi
	const handleToggleWifi = async () => {
		const next = !wifiOn;
		setWifiOn(next);
		try {
			if (next) {
				await invoke("wifi_scan").catch(() => {});
			} else {
				await invoke("wifi_disconnect").catch(() => {});
			}
		} catch (e) {
			console.error("Wifi toggle failed:", e);
		}
	};

	// Toggle mute / volume
	const handleToggleMute = async () => {
		const next = !isMuted;
		setIsMuted(next);
		try {
			await invoke("set_volume", { volume: next ? 0 : volume || 50 }).catch(() => {});
		} catch (e) {
			console.error("Volume mute failed:", e);
		}
	};

	// Adjust volume on wheel
	const handleVolumeWheel = async (e: React.WheelEvent) => {
		e.stopPropagation();
		const delta = e.deltaY < 0 ? 5 : -5;
		const next = Math.max(0, Math.min(100, volume + delta));
		setVolume(next);
		setIsMuted(next === 0);
		try {
			await invoke("set_volume", { volume: next }).catch(() => {});
		} catch {}
	};

	// Trigger screenshot
	const handleScreenshot = async () => {
		try {
			await invoke("plugin:opener|open_url", { url: "ms-screenclip:" }).catch(async () => {
				await invoke("execute_command", { command: "explorer.exe ms-screenclip:" }).catch(() => {});
			});
		} catch (e) {
			console.error("Screenshot launch failed:", e);
		}
	};

	// Lock workstation
	const handleLock = async () => {
		try {
			await invoke("lock_windows_workstation").catch(() => {});
		} catch (e) {
			console.error("Lock workstation failed:", e);
		}
	};

	// Open Settings window
	const handleOpenSettings = async () => {
		try {
			await invoke("open_settings_window").catch(() => {});
		} catch (e) {
			console.error("Open settings failed:", e);
		}
	};

	const toolsList = [
		{ key: "clipboard", label: "Portapapeles", icon: <Clipboard size={14} /> },
		{ key: "notes", label: "Notas", icon: <Edit3 size={14} /> },
		{ key: "shelf", label: "Bandeja temporal", icon: <Inbox size={14} /> },
		{ key: "links", label: "Enlaces rápidos", icon: <Link2 size={14} /> },
		{ key: "color", label: "Selector de color", icon: <Pipette size={14} /> }
	];

	return (
		<div className="chome-top-bar" onClick={(e) => e.stopPropagation()}>
			{/* ── Left Navigation Pills ── */}
			<div className="chome-tabs-pill">
				{/* 1. Inicio */}
				{activeTab === "home" ? (
					<button type="button" className="chome-tab-item active" onClick={() => onSwitchTab("home")}>
						<Home size={14} strokeWidth={2.4} />
						<span>Inicio</span>
					</button>
				) : (
					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Inicio"
						onClick={() => onSwitchTab("home")}
					>
						<Home size={14} strokeWidth={2.2} />
					</button>
				)}

				{/* 2. Música */}
				{activeTab === "music" ? (
					<button type="button" className="chome-tab-item active" onClick={() => onSwitchTab("music")}>
						<Play size={13} fill="currentColor" strokeWidth={0} />
						<span>Música</span>
					</button>
				) : (
					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Música"
						onClick={() => onSwitchTab("music")}
					>
						<Play size={13} fill="currentColor" strokeWidth={0} />
					</button>
				)}

				{/* 3. Rendimiento */}
				{activeTab === "perf" ? (
					<button type="button" className="chome-tab-item active" onClick={() => onSwitchTab("perf")}>
						<Clock size={14} strokeWidth={2.4} />
						<span>Rendimiento</span>
					</button>
				) : (
					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Rendimiento"
						onClick={() => onSwitchTab("perf")}
					>
						<Clock size={14} strokeWidth={2.2} />
					</button>
				)}

				{/* 4. Mezclador */}
				{activeTab === "mixer" ? (
					<button type="button" className="chome-tab-item active" onClick={() => onSwitchTab("mixer")}>
						<Sliders size={14} strokeWidth={2.4} />
						<span>Mezclador</span>
					</button>
				) : (
					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Mezclador"
						onClick={() => onSwitchTab("mixer")}
					>
						<Sliders size={14} strokeWidth={2.2} />
					</button>
				)}

				{/* 5. Notificaciones */}
				{activeTab === "notifications" ? (
					<button type="button" className="chome-tab-item active" onClick={() => onSwitchTab("notifications")}>
						<Bell size={14} strokeWidth={2.4} />
						<span>Notificaciones</span>
						{notificationCount > 0 && <span className="chome-badge">{notificationCount}</span>}
					</button>
				) : (
					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Notificaciones"
						onClick={() => onSwitchTab("notifications")}
					>
						<Bell size={14} strokeWidth={2.2} />
						{notificationCount > 0 && <span className="chome-badge">{notificationCount}</span>}
					</button>
				)}

				{/* Divider */}
				<div className="chome-tab-divider" />

				{/* 6. Notas / Utilidades (con dropdown) */}
				<div className="chome-tool-dropdown-wrap" ref={menuRef}>
					{activeTab === "notes" ? (
						<button
							type="button"
							className="chome-tab-item active with-caret"
							onClick={() => setMenuOpen(!menuOpen)}
						>
							<FileText size={14} strokeWidth={2.4} />
							<span>{toolsList.find((t) => t.key === selectedTool)?.label || "Notas"}</span>
							<ChevronDown size={12} strokeWidth={2.4} />
						</button>
					) : (
						<button
							type="button"
							className="chome-tab-item icon-only"
							title="Notas / Herramientas"
							onClick={() => {
								onSwitchTab("notes");
							}}
						>
							<FileText size={14} strokeWidth={2.2} />
						</button>
					)}

					{/* Dropdown Menu (Image 8) */}
					{menuOpen && (
						<div className="ctool-menu-popup">
							{toolsList.map((tool) => (
								<button
									key={tool.key}
									type="button"
									className={`ctool-menu-item ${selectedTool === tool.key ? "selected" : ""}`}
									onClick={() => {
										onSelectTool?.(tool.key);
										onSwitchTab("notes");
										setMenuOpen(false);
									}}
								>
									<span className={`ctool-item-icon ${selectedTool === tool.key ? "active-icon" : ""}`}>
										{tool.icon}
									</span>
									<span className="ctool-item-text">{tool.label}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* 7. Más opciones */}
				<button
					type="button"
					className="chome-tab-item icon-only"
					title="Más utilidades"
					onClick={() => setMenuOpen(!menuOpen)}
				>
					<MoreHorizontal size={14} strokeWidth={2.2} />
				</button>
			</div>

			{/* ── Center Digital Clock ── */}
			<div className="chome-center-clock">
				<span>{timeStr}</span>
			</div>

			{/* ── Right Quick Toggles (Image 9) ── */}
			<div className="chome-quick-toggles">
				{/* Volume Toggle & Mixer Shortcut */}
				<button
					type="button"
					className={`chome-toggle-btn ${isMuted ? "muted" : ""}`}
					title={`Volumen: ${volume}% (Rueda para cambiar, clic para mezclador)`}
					onClick={() => onSwitchTab("mixer")}
					onContextMenu={(e) => {
						e.preventDefault();
						handleToggleMute();
					}}
					onWheel={handleVolumeWheel}
				>
					{isMuted || volume === 0 ? <VolumeX size={14} strokeWidth={2.2} /> : <Volume2 size={14} strokeWidth={2.2} />}
				</button>

				{/* Wi-Fi Toggle */}
				<button
					type="button"
					className={`chome-toggle-btn ${wifiOn ? "active-grey" : "off"}`}
					title={wifiOn ? "Wi-Fi Conectado" : "Wi-Fi Desactivado"}
					onClick={handleToggleWifi}
				>
					<Wifi size={14} strokeWidth={2.2} />
				</button>

				{/* Bluetooth Toggle (Blue active circle) */}
				<button
					type="button"
					className={`chome-toggle-btn ${bluetoothOn ? "active-blue" : "off"}`}
					title={bluetoothOn ? "Bluetooth Activado" : "Bluetooth Desactivado"}
					onClick={handleToggleBluetooth}
				>
					<Bluetooth size={14} strokeWidth={2.2} />
				</button>

				{/* Mic / DND Toggle */}
				<button
					type="button"
					className="chome-toggle-btn"
					title="No molestar / Silenciar micrófono"
					onClick={handleToggleMute}
				>
					<MicOff size={14} strokeWidth={2.2} />
				</button>

				{/* Screenshot / Recorte */}
				<button
					type="button"
					className="chome-toggle-btn"
					title="Captura de pantalla (Recorte)"
					onClick={handleScreenshot}
				>
					<Camera size={14} strokeWidth={2.2} />
				</button>

				{/* Lock Computer */}
				<button
					type="button"
					className="chome-toggle-btn"
					title="Bloquear pantalla"
					onClick={handleLock}
				>
					<Lock size={14} strokeWidth={2.2} />
				</button>

				{/* Settings Switcher */}
				<button
					type="button"
					className="chome-toggle-btn"
					title="Configuración de Celestial Bloom"
					onClick={handleOpenSettings}
				>
					<Sliders size={14} strokeWidth={2.2} />
				</button>
			</div>
		</div>
	);
}
