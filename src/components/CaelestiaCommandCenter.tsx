import React, { useEffect, useState, useCallback } from "react";
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

export const CaelestiaCommandCenter: React.FC = () => {
	const [controls, setControls] = useState<SystemControls>({
		volume: 1.0,
		brightness: 1.0,
		wifi_enabled: true,
		wifi_connected: true,
		wifi_name: "Conectado",
		bluetooth_enabled: true,
		battery_percent: 100,
		battery_state: "charging"
	});

	const [isDraggingVol, setIsDraggingVol] = useState(false);
	const [isDraggingBri, setIsDraggingBri] = useState(false);
	const [dockMode, setDockMode] = useState<string>(() => localStorage.getItem("bloom-dock-mode") || "fixed");
	const [dndActive, setDndActive] = useState<boolean>(() => localStorage.getItem("caelestia-dnd") === "true");

	const fetchControls = useCallback(async () => {
		try {
			const res = await fetch("http://127.0.0.1:5180/api/controls");
			if (res.ok) {
				const data = await res.json();
				setControls((prev) => ({
					...prev,
					...data,
					// Don't overwrite while user is actively sliding
					volume: isDraggingVol ? prev.volume : data.volume,
					brightness: isDraggingBri ? prev.brightness : data.brightness
				}));
			}
		} catch {
			// Local fallback
		}
	}, [isDraggingVol, isDraggingBri]);

	useEffect(() => {
		fetchControls();
		const interval = setInterval(fetchControls, 3000);
		return () => clearInterval(interval);
	}, [fetchControls]);

	const handleVolumeChange = async (newVal: number) => {
		setControls((c) => ({ ...c, volume: newVal }));
		try {
			await fetch("http://127.0.0.1:5180/api/set_volume", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ volume: newVal })
			});
		} catch {
			// ignore
		}
	};

	const handleBrightnessChange = async (newVal: number) => {
		setControls((c) => ({ ...c, brightness: newVal }));
		try {
			await fetch("http://127.0.0.1:5180/api/set_brightness", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ brightness: newVal })
			});
		} catch {
			// ignore
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
						onClick={() => handleVolumeChange(controls.volume > 0 ? 0 : 0.7)}
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
						{controls.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
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
								width: `${Math.round(controls.volume * 100)}%`,
								background: "#FFFFFF",
								borderRadius: "999px"
							}}
						/>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={controls.volume}
							onMouseDown={() => setIsDraggingVol(true)}
							onMouseUp={() => setIsDraggingVol(false)}
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
						{Math.round(controls.volume * 100)}%
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
								width: `${Math.round(controls.brightness * 100)}%`,
								background: "#FFFFFF",
								borderRadius: "999px"
							}}
						/>
						<input
							type="range"
							min="0.05"
							max="1"
							step="0.01"
							value={controls.brightness}
							onMouseDown={() => setIsDraggingBri(true)}
							onMouseUp={() => setIsDraggingBri(false)}
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
						{Math.round(controls.brightness * 100)}%
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
