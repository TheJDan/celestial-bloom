import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
	Home,
	Clock,
	Sliders,
	Bell,
	FileText,
	MoreHorizontal,
	Volume2,
	VolumeX,
	Wifi,
	Bluetooth,
	MicOff,
	Camera,
	Lock,
	ChevronDown,
	Clipboard,
	Inbox,
	Link2,
	Pipette,
	Edit3,
	RefreshCw,
	ArrowUpCircle,
	RotateCw,
	X,
	CheckCircle2,
	AlertCircle
} from "lucide-react";
import "./CaelestiaTabs.css";

export type CaelestiaTabKey = "home" | "music" | "perf" | "timer" | "mixer" | "notifications" | "notes";

interface UpdateCheckResult {
	available: boolean;
	version?: string;
	date?: string;
	body?: string;
}

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
	notificationCount = 0,
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
	const [micMuted, setMicMuted] = useState(false);
	const [volume, setVolume] = useState(100);

	// Tool dropdown menu
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// More options menu (...)
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const moreMenuRef = useRef<HTMLDivElement>(null);

	// Updater state
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [updateVersion, setUpdateVersion] = useState("");
	const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "downloading" | "installing" | "uptodate" | "error">("idle");
	const [downloadProgress, setDownloadProgress] = useState(0);
	const [showUpdateModal, setShowUpdateModal] = useState(false);
	const [updateMessage, setUpdateMessage] = useState("");

	// Reactive notification count from localStorage and events
	const [actualNotifCount, setActualNotifCount] = useState<number>(() => {
		if (notificationCount > 0) return notificationCount;
		try {
			const saved = localStorage.getItem("caelestia-notifications");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed)) {
					return parsed.reduce((acc, g) => acc + (g.items?.length || 0), 0);
				}
			}
		} catch {}
		return 0;
	});

	// Sync notification count
	useEffect(() => {
		const updateCount = () => {
			try {
				const saved = localStorage.getItem("caelestia-notifications");
				if (saved) {
					const parsed = JSON.parse(saved);
					if (Array.isArray(parsed)) {
						const count = parsed.reduce((acc, g) => acc + (g.items?.length || 0), 0);
						setActualNotifCount(count);
						return;
					}
				}
			} catch {}
			setActualNotifCount(0);
		};

		updateCount();
		window.addEventListener("storage", updateCount);
		window.addEventListener("caelestia-notifications-updated", updateCount);
		return () => {
			window.removeEventListener("storage", updateCount);
			window.removeEventListener("caelestia-notifications-updated", updateCount);
		};
	}, []);

	// If parent passed explicit count > 0, reflect it
	useEffect(() => {
		if (notificationCount !== undefined) {
			setActualNotifCount(notificationCount);
		}
	}, [notificationCount]);

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

		invoke<boolean>("get_mic_mute_state")
			.then((m) => setMicMuted(Boolean(m)))
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

	// Auto-updater: check for updates in background & listen for events
	useEffect(() => {
		// Silent check on launch
		invoke<UpdateCheckResult>("check_for_updates", { force: false })
			.then((res) => {
				if (res && res.available) {
					setUpdateAvailable(true);
					setUpdateVersion(res.version || "Nueva versión");
				}
			})
			.catch(() => {});

		const unlistenAvail = listen<UpdateCheckResult>("update-available", (event) => {
			if (event.payload?.available) {
				setUpdateAvailable(true);
				setUpdateVersion(event.payload.version || "Nueva versión");
			}
		});

		const unlistenStatus = listen<{ status: string; progress?: number }>("auto-update-status", (event) => {
			if (event.payload.status === "downloading") {
				setUpdateStatus("downloading");
				if (typeof event.payload.progress === "number") {
					setDownloadProgress(event.payload.progress);
				}
			} else if (event.payload.status === "installing") {
				setUpdateStatus("installing");
				setDownloadProgress(100);
			}
		});

		return () => {
			unlistenAvail.then((f) => f()).catch(() => {});
			unlistenStatus.then((f) => f()).catch(() => {});
		};
	}, []);

	// Close menus on click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
			if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
				setMoreMenuOpen(false);
			}
		};
		if (menuOpen || moreMenuOpen) {
			window.addEventListener("mousedown", handleClickOutside);
		}
		return () => window.removeEventListener("mousedown", handleClickOutside);
	}, [menuOpen, moreMenuOpen]);

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

	const handleOpenBluetoothSettings = async (e: React.MouseEvent) => {
		e.preventDefault();
		try {
			await invoke("open_bluetooth_settings").catch(() => {});
		} catch {}
	};

	// Toggle Wi-Fi
	const handleToggleWifi = async () => {
		const next = !wifiOn;
		setWifiOn(next);
		try {
			await invoke("set_wifi_state", { enabled: next }).catch(() => {});
		} catch (e) {
			console.error("Wifi toggle failed:", e);
		}
	};

	const handleOpenWifiFlyout = async (e: React.MouseEvent) => {
		e.preventDefault();
		try {
			await invoke("open_wifi_settings").catch(async () => {
				await invoke("plugin:opener|open_url", { url: "ms-availablenetworks:" }).catch(() => {});
			});
		} catch {}
	};

	// Toggle mic mute
	const handleToggleMic = async () => {
		try {
			const next = await invoke<boolean>("toggle_mic_mute").catch(() => !micMuted);
			setMicMuted(next);
		} catch {
			setMicMuted(!micMuted);
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
			await invoke("trigger_screenshot").catch(async () => {
				await invoke("plugin:opener|open_url", { url: "ms-screenclip:" }).catch(async () => {
					await invoke("execute_command", { command: "explorer.exe ms-screenclip:" }).catch(() => {});
				});
			});

			window.dispatchEvent(
				new CustomEvent("caelestia-add-notification", {
					detail: {
						appId: "screenshot",
						appName: "Captura de pantalla",
						title: "Herramienta de recorte activa",
						subtitle: "Selecciona el área para recortar",
						iconType: "screenshot"
					}
				})
			);
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

	// Manual check for updates
	const handleManualCheckUpdates = async () => {
		setMoreMenuOpen(false);
		setUpdateStatus("checking");
		setShowUpdateModal(true);
		setUpdateMessage("Buscando nuevas versiones en GitHub...");
		try {
			const res = await invoke<UpdateCheckResult>("check_for_updates", { force: true });
			if (res && res.available) {
				setUpdateAvailable(true);
				setUpdateVersion(res.version || "Nueva versión");
				setUpdateStatus("available");
				setUpdateMessage(`Hay una nueva versión disponible: ${res.version || ""}`);
			} else {
				setUpdateStatus("uptodate");
				setUpdateMessage("Celestial Bloom está actualizado a la última versión disponible.");
			}
		} catch (err: any) {
			setUpdateStatus("error");
			setUpdateMessage(`Error al comprobar actualizaciones: ${err?.message || err}`);
		}
	};

	// Trigger install update
	const handleInstallUpdate = async () => {
		setUpdateStatus("downloading");
		setDownloadProgress(0);
		try {
			await invoke("install_update");
		} catch (e: any) {
			setUpdateStatus("error");
			setUpdateMessage(`Error en la instalación: ${e?.message || e}`);
		}
	};

	// Restart application
	const handleRestartApp = async () => {
		setMoreMenuOpen(false);
		try {
			await invoke("restart_bloom");
		} catch (e) {
			console.error("Restart failed:", e);
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
						<span style={{ fontSize: 13, lineHeight: 1 }}>▶</span>
						<span>Música</span>
					</button>
				) : (
					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Música"
						onClick={() => onSwitchTab("music")}
					>
						<span style={{ fontSize: 13, lineHeight: 1 }}>▶</span>
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
						title="Rendimiento del Sistema"
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
						title="Mezclador de Volumen"
						onClick={() => onSwitchTab("mixer")}
					>
						<Sliders size={14} strokeWidth={2.2} />
					</button>
				)}

				{/* 5. Notificaciones (solo muestra badge si hay notificaciones reales > 0) */}
				{activeTab === "notifications" ? (
					<button type="button" className="chome-tab-item active" onClick={() => onSwitchTab("notifications")}>
						<Bell size={14} strokeWidth={2.4} />
						<span>Notificaciones</span>
						{actualNotifCount > 0 && <span className="chome-badge">{actualNotifCount}</span>}
					</button>
				) : (
					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Notificaciones"
						onClick={() => onSwitchTab("notifications")}
					>
						<Bell size={14} strokeWidth={2.2} />
						{actualNotifCount > 0 && <span className="chome-badge">{actualNotifCount}</span>}
					</button>
				)}

				{/* Divider */}
				<div className="chome-tab-divider" />

				{/* 6. Herramientas (con dropdown) */}
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
							title="Herramientas y Utilidades"
							onClick={() => {
								onSwitchTab("notes");
								setMenuOpen(true);
							}}
						>
							<FileText size={14} strokeWidth={2.2} />
						</button>
					)}

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

				{/* 7. Más opciones (...) */}
				<div className="chome-more-dropdown-wrap" ref={moreMenuRef} style={{ position: "relative" }}>
					<button
						type="button"
						className={`chome-tab-item icon-only ${moreMenuOpen ? "active" : ""}`}
						title="Más opciones"
						onClick={() => setMoreMenuOpen(!moreMenuOpen)}
					>
						<MoreHorizontal size={14} strokeWidth={2.2} />
					</button>

					{moreMenuOpen && (
						<div className="ctool-menu-popup" style={{ minWidth: 200, right: 0, left: "auto" }}>
							<button
								type="button"
								className="ctool-menu-item"
								onClick={handleManualCheckUpdates}
							>
								<RefreshCw size={14} className="ctool-item-icon" />
								<span className="ctool-item-text">Buscar actualizaciones</span>
							</button>
							<button
								type="button"
								className="ctool-menu-item"
								onClick={handleRestartApp}
							>
								<RotateCw size={14} className="ctool-item-icon" />
								<span className="ctool-item-text">Reiniciar Celestial Bloom</span>
							</button>
							<button
								type="button"
								className="ctool-menu-item"
								onClick={() => {
									setMoreMenuOpen(false);
									handleOpenSettings();
								}}
							>
								<Sliders size={14} className="ctool-item-icon" />
								<span className="ctool-item-text">Configuración</span>
							</button>
						</div>
					)}
				</div>
			</div>

			{/* ── Center Digital Clock ── */}
			<div className="chome-center-clock">
				<span>{timeStr}</span>
			</div>

			{/* ── Right Quick Toggles & Updater ── */}
			<div className="chome-quick-toggles">
				{/* Update Pill indicator (visible when update is available) */}
				{updateAvailable && (
					<button
						type="button"
						className="chome-update-pill-btn"
						title={`Nueva versión disponible: ${updateVersion}. Clic para actualizar.`}
						onClick={() => {
							setShowUpdateModal(true);
							setUpdateStatus("available");
						}}
					>
						<ArrowUpCircle size={13} strokeWidth={2.5} />
						<span>Actualizar</span>
					</button>
				)}

				{/* Volume Toggle & Mixer Shortcut */}
				<button
					type="button"
					className={`chome-toggle-btn ${isMuted ? "muted" : ""}`}
					title={`Volumen: ${volume}% (Rueda: cambiar, Clic: mezclador, Clic derecho: silenciar)`}
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
					className={`chome-toggle-btn ${wifiOn ? "active-blue" : "off"}`}
					title={wifiOn ? "Wi-Fi Activado (Clic: apagar, Clic derecho: redes)" : "Wi-Fi Desactivado (Clic: encender)"}
					onClick={handleToggleWifi}
					onContextMenu={handleOpenWifiFlyout}
				>
					<Wifi size={14} strokeWidth={2.2} />
				</button>

				{/* Bluetooth Toggle */}
				<button
					type="button"
					className={`chome-toggle-btn ${bluetoothOn ? "active-blue" : "off"}`}
					title={bluetoothOn ? "Bluetooth Activado (Clic: alternar, Clic derecho: configuración)" : "Bluetooth Desactivado (Clic: encender)"}
					onClick={handleToggleBluetooth}
					onContextMenu={handleOpenBluetoothSettings}
				>
					<Bluetooth size={14} strokeWidth={2.2} />
				</button>

				{/* Mic / DND Toggle */}
				<button
					type="button"
					className={`chome-toggle-btn ${micMuted ? "active-red" : ""}`}
					title={micMuted ? "Micrófono Silenciado (Clic para activar)" : "Micrófono Activo (Clic para silenciar)"}
					onClick={handleToggleMic}
				>
					<MicOff size={14} strokeWidth={2.2} color={micMuted ? "#ff453a" : "currentColor"} />
				</button>

				{/* Screenshot / Recorte */}
				<button
					type="button"
					className="chome-toggle-btn"
					title="Captura de pantalla (Recorte de Windows)"
					onClick={handleScreenshot}
				>
					<Camera size={14} strokeWidth={2.2} />
				</button>

				{/* Lock Computer */}
				<button
					type="button"
					className="chome-toggle-btn"
					title="Bloquear pantalla (Win + L)"
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

			{/* ── Auto-Update Modal Dialog ── */}
			{showUpdateModal && (
				<div className="chome-update-modal-backdrop" onClick={() => setShowUpdateModal(false)}>
					<div className="chome-update-modal-card" onClick={(e) => e.stopPropagation()}>
						<div className="chome-update-modal-header">
							<div className="chome-update-modal-title">
								<ArrowUpCircle size={18} color="#0a84ff" />
								<span>Actualizador de Celestial Bloom</span>
							</div>
							<button
								type="button"
								className="chome-update-modal-close"
								onClick={() => setShowUpdateModal(false)}
							>
								<X size={14} />
							</button>
						</div>

						<div className="chome-update-modal-body">
							{updateStatus === "checking" && (
								<div className="chome-update-status-row">
									<RefreshCw size={20} className="chome-spin-icon" color="#0a84ff" />
									<div>
										<div style={{ fontWeight: 600, color: "#fff" }}>Comprobando actualizaciones...</div>
										<div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>Consultando GitHub Releases</div>
									</div>
								</div>
							)}

							{updateStatus === "uptodate" && (
								<div className="chome-update-status-row">
									<CheckCircle2 size={24} color="#30d158" />
									<div>
										<div style={{ fontWeight: 600, color: "#fff" }}>Estás al día</div>
										<div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>
											Tienes instalada la última versión disponible de Celestial Bloom.
										</div>
									</div>
								</div>
							)}

							{updateStatus === "available" && (
								<div>
									<div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>
										¡Nueva versión lista para instalar!
									</div>
									<div style={{ fontSize: 12.5, color: "#0a84ff", marginBottom: 12, fontWeight: 500 }}>
										{updateVersion || "Nueva actualización"}
									</div>
									<div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.5, marginBottom: 16 }}>
										La aplicación se descargará e instalará directamente en tu laptop de forma automática y se reiniciará sin necesidad de descargas manuales.
									</div>
									<button
										type="button"
										className="chome-update-btn-action"
										onClick={handleInstallUpdate}
									>
										Descargar e Instalar Ahora
									</button>
								</div>
							)}

							{updateStatus === "downloading" && (
								<div>
									<div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
										Descargando actualización... {downloadProgress}%
									</div>
									<div className="chome-update-progress-track">
										<div
											className="chome-update-progress-fill"
											style={{ width: `${downloadProgress}%` }}
										/>
									</div>
									<div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)", marginTop: 8 }}>
										Por favor espera. Al terminar, la aplicación se reiniciará automáticamente.
									</div>
								</div>
							)}

							{updateStatus === "installing" && (
								<div className="chome-update-status-row">
									<RefreshCw size={20} className="chome-spin-icon" color="#30d158" />
									<div>
										<div style={{ fontWeight: 600, color: "#fff" }}>Instalando actualización...</div>
										<div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>
											Reiniciando Celestial Bloom en la nueva versión...
										</div>
									</div>
								</div>
							)}

							{updateStatus === "error" && (
								<div className="chome-update-status-row">
									<AlertCircle size={22} color="#ff453a" />
									<div>
										<div style={{ fontWeight: 600, color: "#ff453a" }}>Error en la actualización</div>
										<div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)" }}>{updateMessage}</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
