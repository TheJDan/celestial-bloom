import React, { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Wifi,
	WifiOff,
	Bluetooth,
	BluetoothOff,
	Sun,
	Volume2,
	VolumeX,
	BatteryCharging,
	Battery,
	Moon,
	Sliders,
	RefreshCw,
	Layers
} from "lucide-react";

interface SystemControls {
	volume: number;
	brightness: number;
	wifi_enabled: boolean;
	wifi_connected: boolean;
	wifi_name: string;
	bluetooth_enabled: boolean;
	battery_percent: number;
	battery_state: string;
}

interface CaelestiaCommandCenterProps {
	volume?: number;
	onVolumeChange?: (vol: number) => void;
	brightness?: number;
	onBrightnessChange?: (bri: number) => void;
}

export const CaelestiaCommandCenter: React.FC<CaelestiaCommandCenterProps> = ({
	volume: propVolume,
	onVolumeChange: propOnVolumeChange,
	brightness: propBrightness,
	onBrightnessChange: propOnBrightnessChange
}) => {
	const [controls, setControls] = useState<SystemControls>({
		volume: propVolume !== undefined ? propVolume : 1.0,
		brightness: propBrightness !== undefined ? propBrightness : 1.0,
		wifi_enabled: true,
		wifi_connected: true,
		wifi_name: "Conectado",
		bluetooth_enabled: true,
		battery_percent: 100,
		battery_state: "charging"
	});

	const [dockMode, setDockMode] = useState<string>(() => localStorage.getItem("bloom-dock-mode") || "fixed");
	const [dndActive, setDndActive] = useState<boolean>(() => localStorage.getItem("caelestia-dnd") === "true");

	const briThrottleRef = useRef<number | null>(null);
	const lastBriInteractionRef = useRef<number>(0);
	const lastVolInteractionRef = useRef<number>(0);

	const activeVolume = propVolume !== undefined ? propVolume : controls.volume;
	const activeBrightness = propBrightness !== undefined ? propBrightness : controls.brightness;

	const fetchControls = useCallback(async () => {
		try {
			const [vol, bri] = await Promise.all([
				invoke<number>("get_volume").catch(() => 0.5),
				invoke<number>("get_brightness").catch(() => 100)
			]);
			const now = Date.now();
			setControls((prev) => ({
				...prev,
				volume: propVolume !== undefined ? propVolume : (now - lastVolInteractionRef.current < 1500 ? prev.volume : vol),
				brightness: propBrightness !== undefined ? propBrightness : (now - lastBriInteractionRef.current < 1500 ? prev.brightness : bri / 100)
			}));
		} catch {
			// Fallback
		}
	}, [propVolume, propBrightness]);

	useEffect(() => {
		fetchControls();
		const interval = setInterval(fetchControls, 4000);
		return () => clearInterval(interval);
	}, [fetchControls]);

	const handleVolumeChange = (newVal: number) => {
		lastVolInteractionRef.current = Date.now();
		setControls((c) => ({ ...c, volume: newVal }));
		if (propOnVolumeChange) {
			propOnVolumeChange(newVal);
		} else {
			invoke("set_volume", { volume: newVal }).catch(() => {});
		}
	};

	const handleBrightnessChange = (newVal: number) => {
		lastBriInteractionRef.current = Date.now();
		setControls((c) => ({ ...c, brightness: newVal }));
		if (propOnBrightnessChange) {
			propOnBrightnessChange(newVal);
		} else {
			if (briThrottleRef.current) clearTimeout(briThrottleRef.current);
			briThrottleRef.current = setTimeout(() => {
				invoke("set_brightness", { brightness: Math.round(newVal * 100) }).catch(() => {});
			}, 40) as unknown as number;
		}
	};

	const toggleWifi = async () => {
		try {
			await fetch("http://127.0.0.1:5180/api/toggle_wifi", { method: "POST" });
			setControls((c) => ({ ...c, wifi_enabled: !c.wifi_enabled }));
			setTimeout(fetchControls, 800);
		} catch {
			// ignore
		}
	};

	const toggleBluetooth = async () => {
		try {
			await fetch("http://127.0.0.1:5180/api/toggle_bluetooth", { method: "POST" });
			setControls((c) => ({ ...c, bluetooth_enabled: !c.bluetooth_enabled }));
			setTimeout(fetchControls, 800);
		} catch {
			// ignore
		}
	};

	const cycleDockMode = () => {
		const next = dockMode === "fixed" ? "smart" : dockMode === "smart" ? "peek" : "fixed";
		setDockMode(next);
		localStorage.setItem("bloom-dock-mode", next);
	};

	const toggleDnd = () => {
		const next = !dndActive;
		setDndActive(next);
		localStorage.setItem("caelestia-dnd", String(next));
	};

	const openKdeSettings = async () => {
		try {
			await fetch("http://127.0.0.1:5180/api/launch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "systemsettings" })
			});
		} catch {
			// ignore
		}
	};

	const isCharging = controls.battery_state.includes("charge");

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				padding: "16px 20px 14px 20px",
				display: "flex",
				flexDirection: "column",
				gap: "14px",
				color: "#FFFFFF",
				userSelect: "none",
				fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
			}}
		>
			{/* Top Grid: Quick Pills */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "10px"
				}}
			>
				{/* Wi-Fi Pill */}
				<div
					onClick={toggleWifi}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						padding: "10px 14px",
						borderRadius: "14px",
						background: controls.wifi_enabled ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						cursor: "pointer",
						transition: "all 0.18s ease"
					}}
				>
					<div
						style={{
							width: "28px",
							height: "28px",
							borderRadius: "50%",
							background: controls.wifi_enabled ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center"
						}}
					>
						{controls.wifi_enabled ? <Wifi size={15} /> : <WifiOff size={15} opacity={0.6} />}
					</div>
					<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
						<span style={{ fontSize: "11px", fontWeight: 600 }}>Wi-Fi</span>
						<span
							style={{
								fontSize: "10px",
								color: "rgba(255, 255, 255, 0.5)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis"
							}}
						>
							{controls.wifi_enabled ? controls.wifi_name : "Desactivado"}
						</span>
					</div>
				</div>

				{/* Bluetooth Pill */}
				<div
					onClick={toggleBluetooth}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						padding: "10px 14px",
						borderRadius: "14px",
						background: controls.bluetooth_enabled ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						cursor: "pointer",
						transition: "all 0.18s ease"
					}}
				>
					<div
						style={{
							width: "28px",
							height: "28px",
							borderRadius: "50%",
							background: controls.bluetooth_enabled ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center"
						}}
					>
						{controls.bluetooth_enabled ? <Bluetooth size={15} /> : <BluetoothOff size={15} opacity={0.6} />}
					</div>
					<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
						<span style={{ fontSize: "11px", fontWeight: 600 }}>Bluetooth</span>
						<span style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.5)" }}>
							{controls.bluetooth_enabled ? "Activado" : "Desactivado"}
						</span>
					</div>
				</div>

				{/* Dock Mode Pill */}
				<div
					onClick={cycleDockMode}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						padding: "10px 14px",
						borderRadius: "14px",
						background: "rgba(255, 255, 255, 0.04)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						cursor: "pointer",
						transition: "all 0.18s ease"
					}}
				>
					<div
						style={{
							width: "28px",
							height: "28px",
							borderRadius: "50%",
							background: "rgba(255, 255, 255, 0.06)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center"
						}}
					>
						<Layers size={15} />
					</div>
					<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
						<span style={{ fontSize: "11px", fontWeight: 600 }}>Dock Mode</span>
						<span style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.5)", textTransform: "capitalize" }}>
							{dockMode}
						</span>
					</div>
				</div>

				{/* Battery Status Pill */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						padding: "10px 14px",
						borderRadius: "14px",
						background: "rgba(255, 255, 255, 0.04)",
						border: "1px solid rgba(255, 255, 255, 0.08)"
					}}
				>
					<div
						style={{
							width: "28px",
							height: "28px",
							borderRadius: "50%",
							background: "rgba(255, 255, 255, 0.06)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center"
						}}
					>
						{isCharging ? <BatteryCharging size={15} /> : <Battery size={15} />}
					</div>
					<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
						<span style={{ fontSize: "11px", fontWeight: 600 }}>Batería</span>
						<span style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.5)" }}>
							{controls.battery_percent}% {isCharging ? "Cargando" : ""}
						</span>
					</div>
				</div>
			</div>

			{/* Sliders Area */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "10px",
					background: "rgba(255, 255, 255, 0.03)",
					padding: "12px 16px",
					borderRadius: "16px",
					border: "1px solid rgba(255, 255, 255, 0.06)"
				}}
			>
				{/* Volume Slider */}
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<button
						onClick={() => handleVolumeChange(activeVolume > 0 ? 0 : 0.7)}
						style={{
							background: "transparent",
							border: "none",
							color: "rgba(255, 255, 255, 0.7)",
							cursor: "pointer",
							padding: 0,
							display: "flex",
							alignItems: "center"
						}}
					>
						{activeVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
					</button>
					<div
						style={{
							flex: 1,
							position: "relative",
							height: "8px",
							background: "rgba(255, 255, 255, 0.1)",
							borderRadius: "999px",
							overflow: "hidden"
						}}
					>
						<div
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								height: "100%",
								width: `${Math.round(activeVolume * 100)}%`,
								background: "#FFFFFF",
								borderRadius: "999px"
							}}
						/>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={activeVolume}
							onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: "100%",
								opacity: 0,
								cursor: "pointer",
								margin: 0
							}}
						/>
					</div>
					<span style={{ fontSize: "11px", fontWeight: 600, width: "34px", textAlign: "right", color: "rgba(255, 255, 255, 0.8)" }}>
						{Math.round(activeVolume * 100)}%
					</span>
				</div>

				{/* Brightness Slider */}
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<Sun size={16} style={{ color: "rgba(255, 255, 255, 0.7)" }} />
					<div
						style={{
							flex: 1,
							position: "relative",
							height: "8px",
							background: "rgba(255, 255, 255, 0.1)",
							borderRadius: "999px",
							overflow: "hidden"
						}}
					>
						<div
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								height: "100%",
								width: `${Math.round(activeBrightness * 100)}%`,
								background: "#FFFFFF",
								borderRadius: "999px"
							}}
						/>
						<input
							type="range"
							min="0.05"
							max="1"
							step="0.01"
							value={activeBrightness}
							onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: "100%",
								opacity: 0,
								cursor: "pointer",
								margin: 0
							}}
						/>
					</div>
					<span style={{ fontSize: "11px", fontWeight: 600, width: "34px", textAlign: "right", color: "rgba(255, 255, 255, 0.8)" }}>
						{Math.round(activeBrightness * 100)}%
					</span>
				</div>
			</div>

			{/* Quick Action Footer Icons */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "0 4px"
				}}
			>
				<button
					onClick={toggleDnd}
					title="No molestar"
					style={{
						background: dndActive ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						borderRadius: "50%",
						width: "36px",
						height: "36px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#FFF",
						cursor: "pointer"
					}}
				>
					<Moon size={15} />
				</button>

				<button
					onClick={openKdeSettings}
					title="Ajustes de KDE Plasma"
					style={{
						background: "rgba(255, 255, 255, 0.05)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						borderRadius: "50%",
						width: "36px",
						height: "36px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#FFF",
						cursor: "pointer"
					}}
				>
					<Sliders size={15} />
				</button>

				<button
					onClick={() => window.location.reload()}
					title="Recargar Shell"
					style={{
						background: "rgba(255, 255, 255, 0.05)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						borderRadius: "50%",
						width: "36px",
						height: "36px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#FFF",
						cursor: "pointer"
					}}
				>
					<RefreshCw size={15} />
				</button>
			</div>
		</div>
	);
};
