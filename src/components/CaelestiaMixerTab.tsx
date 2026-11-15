import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Volume2,
	VolumeX,
	Mic,
	MicOff,
	Music2
} from "lucide-react";
import { CaelestiaTopBar, CaelestiaTabKey } from "./CaelestiaTopBar";
import "./CaelestiaTabs.css";

interface AudioOutputDevice {
	id: string;
	name: string;
	is_default: boolean;
}

interface AudioSessionInfo {
	pid: number;
	name: string;
	process_path?: string;
	volume: number; // 0.0 - 1.0
	is_muted: boolean;
}

interface CaelestiaMixerTabProps {
	onSwitchTab?: (tab: CaelestiaTabKey) => void;
}

function getAppIcon(name: string): string {
	const n = name.toLowerCase();
	if (n.includes("brave")) return "🦁";
	if (n.includes("chrome")) return "🌐";
	if (n.includes("firefox")) return "🦊";
	if (n.includes("edge")) return "🌊";
	if (n.includes("spotify")) return "🎵";
	if (n.includes("discord")) return "💬";
	if (n.includes("steam")) return "🎮";
	if (n.includes("code") || n.includes("visual studio")) return "💻";
	if (n.includes("telegram")) return "✈️";
	if (n.includes("whatsapp")) return "📱";
	if (n.includes("vlc") || n.includes("media") || n.includes("player")) return "🎬";
	if (n.includes("game") || n.includes("league") || n.includes("genshin") || n.includes("valorant")) return "🎯";
	return "🔊";
}

export function CaelestiaMixerTab({ onSwitchTab }: CaelestiaMixerTabProps) {
	// Real Output Devices
	const [outputDevices, setOutputDevices] = useState<AudioOutputDevice[]>([]);
	const [activeOutputId, setActiveOutputId] = useState<string>("");
	const [outputVolume, setOutputVolume] = useState<number>(100);

	// Real Input Devices
	const [inputDevices, setInputDevices] = useState<AudioOutputDevice[]>([]);
	const [activeInputId, setActiveInputId] = useState<string>("");
	const [inputVolume, setInputVolume] = useState<number>(100);
	const [micLevel, setMicLevel] = useState<number>(0.15);

	// Real Running Applications with Audio Sessions
	const [apps, setApps] = useState<AudioSessionInfo[]>([]);

	// Initial load and periodic refresh of real audio devices & sessions
	useEffect(() => {
		const loadDevices = () => {
			// Query real output endpoints from Windows CoreAudio
			invoke<AudioOutputDevice[]>("get_audio_output_devices")
				.then((devs) => {
					if (Array.isArray(devs) && devs.length > 0) {
						setOutputDevices(devs);
						const def = devs.find((d) => d.is_default) || devs[0];
						setActiveOutputId((prev) => (prev ? prev : def.id));
					} else {
						setOutputDevices([{ id: "default_out", name: "Altavoces principales", is_default: true }]);
						setActiveOutputId((prev) => (prev ? prev : "default_out"));
					}
				})
				.catch(() => {
					setOutputDevices([{ id: "default_out", name: "Altavoces principales", is_default: true }]);
					setActiveOutputId((prev) => (prev ? prev : "default_out"));
				});

			// Query real input (microphone) endpoints from Windows CoreAudio
			invoke<AudioOutputDevice[]>("get_audio_input_devices")
				.then((devs) => {
					if (Array.isArray(devs) && devs.length > 0) {
						setInputDevices(devs);
						const def = devs.find((d) => d.is_default) || devs[0];
						setActiveInputId((prev) => (prev ? prev : def.id));
					} else {
						setInputDevices([{ id: "default_in", name: "Micrófono del sistema", is_default: true }]);
						setActiveInputId((prev) => (prev ? prev : "default_in"));
					}
				})
				.catch(() => {
					setInputDevices([{ id: "default_in", name: "Micrófono del sistema", is_default: true }]);
					setActiveInputId((prev) => (prev ? prev : "default_in"));
				});

			// Query master output volume
			invoke<{ volume?: number; is_muted?: boolean } | number>("get_volume_state")
				.then((v) => {
					if (typeof v === "number") {
						setOutputVolume(Math.round(v <= 1.0 ? v * 100 : v));
					} else if (v && typeof v.volume === "number") {
						setOutputVolume(Math.round(v.volume <= 1.0 ? v.volume * 100 : v.volume));
					}
				})
				.catch(() => {});

			// Query master mic volume
			invoke<number>("get_mic_volume")
				.then((v) => {
					if (typeof v === "number") {
						setInputVolume(Math.round(v <= 1.0 ? v * 100 : v));
					}
				})
				.catch(() => {});

			// Query active Windows audio process sessions
			invoke<AudioSessionInfo[]>("get_audio_sessions")
				.then((sessions) => {
					if (Array.isArray(sessions)) {
						setApps(sessions);
					}
				})
				.catch(() => {});
		};

		loadDevices();

		// Refresh audio sessions every 2.5s to track launched/closed audio apps
		const sessionInterval = setInterval(() => {
			invoke<AudioSessionInfo[]>("get_audio_sessions")
				.then((sessions) => {
					if (Array.isArray(sessions)) {
						setApps(sessions);
					}
				})
				.catch(() => {});
		}, 2500);

		// Subtle VU meter activity
		const vuInterval = setInterval(() => {
			setMicLevel((prev) => {
				const target = Math.random() * 0.35 + 0.05;
				return prev * 0.4 + target * 0.6;
			});
		}, 200);

		return () => {
			clearInterval(sessionInterval);
			clearInterval(vuInterval);
		};
	}, []);

	// Master output volume change
	const handleOutputChange = (val: number) => {
		setOutputVolume(val);
		invoke("set_volume", { volume: val / 100 }).catch(() => {});
	};

	// Master input volume change
	const handleInputChange = (val: number) => {
		setInputVolume(val);
		invoke("set_mic_volume", { volume: val / 100 }).catch(() => {});
	};

	// Output device selection
	const handleSelectOutput = (devId: string) => {
		setActiveOutputId(devId);
		invoke("set_default_audio_device", { deviceId: devId }).catch(() => {});
	};

	// Input device selection
	const handleSelectInput = (devId: string) => {
		setActiveInputId(devId);
		invoke("set_default_audio_device", { deviceId: devId }).catch(() => {});
	};

	// Reset all apps to 100%
	const handleResetAllApps = () => {
		apps.forEach((a) => {
			invoke("set_app_volume", { pid: a.pid, volume: 1.0 }).catch(() => {});
			invoke("set_app_mute", { pid: a.pid, muted: false }).catch(() => {});
		});
		setApps((prev) => prev.map((a) => ({ ...a, volume: 1.0, is_muted: false })));
	};

	// App volume change
	const handleAppVolumeChange = (pid: number, val: number) => {
		setApps((prev) =>
			prev.map((a) => (a.pid === pid ? { ...a, volume: val / 100, is_muted: val === 0 } : a))
		);
		invoke("set_app_volume", { pid, volume: val / 100 }).catch(() => {});
	};

	// App mute toggle
	const handleAppMuteToggle = (pid: number, currentMuted: boolean) => {
		const nextMuted = !currentMuted;
		setApps((prev) =>
			prev.map((a) => (a.pid === pid ? { ...a, is_muted: nextMuted } : a))
		);
		invoke("set_app_mute", { pid, muted: nextMuted }).catch(() => {});
	};

	return (
		<div className="caelestia-home-panel cmixer-tab-root" onClick={(e) => e.stopPropagation()}>
			{/* Top Bar */}
			<CaelestiaTopBar activeTab="mixer" onSwitchTab={(t) => onSwitchTab?.(t)} />

			{/* Main Content: Left & Right Columns */}
			<div className="cmixer-layout">
				{/* ── Left Column: SALIDA & ENTRADA ── */}
				<div className="cmixer-left-col">
					{/* SALIDA */}
					<div className="cmixer-section-heading">SALIDA</div>
					<div className="cmixer-device-pills">
						{outputDevices.map((dev) => {
							const isSelected = dev.id === activeOutputId;
							return (
								<button
									key={dev.id}
									type="button"
									className={`cmixer-pill-btn ${isSelected ? "selected" : ""}`}
									onClick={() => handleSelectOutput(dev.id)}
									title={dev.name}
								>
									<Volume2 size={13} className="cmixer-pill-icon" />
									<span className="cmixer-pill-label">{dev.name}</span>
								</button>
							);
						})}
					</div>

					{/* Salida Slider */}
					<div className="cmixer-slider-row">
						<Volume2 size={15} className="cmixer-slider-icon" />
						<div className="cmixer-track-wrap">
							<div
								className="cmixer-track-fill"
								style={{ width: `${outputVolume}%` }}
							/>
							<div
								className="cmixer-thumb"
								style={{ left: `calc(${outputVolume}% - 8px)` }}
							/>
							<input
								type="range"
								min="0"
								max="100"
								value={outputVolume}
								onChange={(e) => handleOutputChange(parseInt(e.target.value, 10))}
								className="cmixer-range-input"
							/>
						</div>
						<span className="cmixer-pct-text">{outputVolume}%</span>
					</div>

					<div style={{ height: 16 }} />

					{/* ENTRADA */}
					<div className="cmixer-section-heading">ENTRADA</div>
					<div className="cmixer-device-pills">
						{inputDevices.map((dev) => {
							const isSelected = dev.id === activeInputId;
							return (
								<button
									key={dev.id}
									type="button"
									className={`cmixer-pill-btn ${isSelected ? "selected" : ""}`}
									onClick={() => handleSelectInput(dev.id)}
									title={dev.name}
								>
									<Mic size={13} className="cmixer-pill-icon" />
									<span className="cmixer-pill-label">{dev.name}</span>
								</button>
							);
						})}
					</div>

					{/* Entrada Slider */}
					<div className="cmixer-slider-row">
						<Mic size={15} className="cmixer-slider-icon" />
						<div className="cmixer-track-wrap">
							<div
								className="cmixer-track-fill"
								style={{ width: `${inputVolume}%` }}
							/>
							<div
								className="cmixer-thumb"
								style={{ left: `calc(${inputVolume}% - 8px)` }}
							/>
							<input
								type="range"
								min="0"
								max="100"
								value={inputVolume}
								onChange={(e) => handleInputChange(parseInt(e.target.value, 10))}
								className="cmixer-range-input"
							/>
						</div>
						<span className="cmixer-pct-text">{inputVolume}%</span>
					</div>

					{/* VU Meter Line */}
					<div className="cmixer-vu-track">
						<div
							className="cmixer-vu-fill"
							style={{ width: `${Math.min(100, Math.max(4, micLevel * 100))}%` }}
						/>
					</div>
				</div>

				{/* ── Right Column: APLICACIONES ── */}
				<div className="cmixer-right-col">
					<div className="cmixer-apps-header">
						<span className="cmixer-section-heading">APLICACIONES</span>
						{apps.length > 0 && (
							<button
								type="button"
								className="cmixer-reset-link"
								onClick={handleResetAllApps}
							>
								Restablecer todo al 100%
							</button>
						)}
					</div>

					{apps.length > 0 ? (
						<div className="cmixer-apps-list">
							{apps.map((app) => {
								const appVolPct = Math.round(app.volume * 100);
								const isAppMuted = app.is_muted || appVolPct === 0;
								return (
									<div key={app.pid} className="cmixer-app-row">
										<div className="cmixer-app-icon-box">
											<span>{getAppIcon(app.name)}</span>
										</div>
										<div className="cmixer-app-info" title={app.name}>
											<div className="cmixer-app-name">{app.name}</div>
											<div className="cmixer-app-sub">Audio de Windows</div>
										</div>
										<div className="cmixer-track-wrap app-track">
											<div
												className="cmixer-track-fill"
												style={{ width: `${isAppMuted ? 0 : appVolPct}%` }}
											/>
											<div
												className="cmixer-thumb"
												style={{ left: `calc(${isAppMuted ? 0 : appVolPct}% - 8px)` }}
											/>
											<input
												type="range"
												min="0"
												max="100"
												value={isAppMuted ? 0 : appVolPct}
												onChange={(e) => handleAppVolumeChange(app.pid, parseInt(e.target.value, 10))}
												className="cmixer-range-input"
											/>
										</div>
										<span className="cmixer-pct-text">{isAppMuted ? 0 : appVolPct}%</span>
										<button
											type="button"
											className="cmixer-app-mute-btn"
											onClick={() => handleAppMuteToggle(app.pid, app.is_muted)}
											title={isAppMuted ? "Activar sonido" : "Silenciar"}
										>
											{isAppMuted ? <VolumeX size={14} color="#ff453a" /> : <Volume2 size={14} />}
										</button>
									</div>
								);
							})}
						</div>
					) : (
						<div className="cmixer-empty-apps">
							<Music2 size={28} color="rgba(255, 255, 255, 0.2)" />
							<div>No hay aplicaciones reproduciendo audio</div>
							<div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.25)" }}>
								Los programas que emitan sonido aparecerán aquí automáticamente
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
