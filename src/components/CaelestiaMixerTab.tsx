import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Volume2,
	VolumeX,
	Mic,
	MicOff,
	Sliders
} from "lucide-react";
import { CaelestiaTopBar, CaelestiaTabKey } from "./CaelestiaTopBar";
import "./CaelestiaTabs.css";

interface AudioDevice {
	id: string;
	name: string;
	isDefault?: boolean;
}

interface AppVolumeItem {
	id: string;
	name: string;
	sub: string;
	volume: number; // 0 - 100
	icon?: string;
	muted?: boolean;
}

interface CaelestiaMixerTabProps {
	onSwitchTab?: (tab: CaelestiaTabKey) => void;
}

export function CaelestiaMixerTab({ onSwitchTab }: CaelestiaMixerTabProps) {
	// Outputs
	const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([
		{ id: "razer", name: "Razer BlackShark V2 Pro Estéreo analógico", isDefault: true },
		{ id: "internal", name: "Audio Interno Estéreo analógico", isDefault: false }
	]);
	const [activeOutputId, setActiveOutputId] = useState<string>("razer");
	const [outputVolume, setOutputVolume] = useState<number>(100);

	// Inputs
	const [inputDevices, setInputDevices] = useState<AudioDevice[]>([
		{ id: "razer_mic", name: "Razer BlackShark V2 Pro Mono", isDefault: false },
		{ id: "internal_mic", name: "Audio Interno Estéreo analógico", isDefault: false },
		{ id: "trust_mic", name: "Trust USB microphone Mono", isDefault: true }
	]);
	const [activeInputId, setActiveInputId] = useState<string>("trust_mic");
	const [inputVolume, setInputVolume] = useState<number>(100);
	const [micLevel, setMicLevel] = useState<number>(0.15);

	// Applications
	const [apps, setApps] = useState<AppVolumeItem[]>([
		{
			id: "app_alsa",
			name: "ALSA plug-in [par...",
			sub: "ALSA Playback",
			volume: 100,
			icon: "!"
		},
		{
			id: "app_brave",
			name: "Brave Browser",
			sub: "Audio stream",
			volume: 100,
			icon: "🦁"
		},
		{
			id: "app_spotify",
			name: "Spotify",
			sub: "Music Playback",
			volume: 100,
			icon: "🎵"
		}
	]);

	// Load real system volume on mount
	useEffect(() => {
		invoke<{ volume?: number; muted?: boolean } | number>("get_volume")
			.then((v) => {
				if (typeof v === "number") {
					setOutputVolume(v);
				} else if (v && typeof v.volume === "number") {
					setOutputVolume(v.volume);
				}
			})
			.catch(() => {});

		// VU meter animation
		const vuInterval = setInterval(() => {
			setMicLevel((prev) => {
				const target = Math.random() * 0.4 + 0.05;
				return prev * 0.4 + target * 0.6;
			});
		}, 150);

		return () => clearInterval(vuInterval);
	}, []);

	const handleOutputChange = (val: number) => {
		setOutputVolume(val);
		invoke("set_volume", { volume: val }).catch(() => {});
	};

	const handleResetAllApps = () => {
		setApps((prev) => prev.map((a) => ({ ...a, volume: 100 })));
	};

	const handleAppVolumeChange = (id: string, val: number) => {
		setApps((prev) =>
			prev.map((a) => (a.id === id ? { ...a, volume: val } : a))
		);
	};

	return (
		<div className="caelestia-home-panel cmixer-tab-root" onClick={(e) => e.stopPropagation()}>
			{/* Top Bar */}
			<CaelestiaTopBar activeTab="mixer" onSwitchTab={(t) => onSwitchTab?.(t)} />

			{/* Main Content: Left & Right Columns (Image 6) */}
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
									onClick={() => setActiveOutputId(dev.id)}
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
									onClick={() => setActiveInputId(dev.id)}
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
								onChange={(e) => setInputVolume(parseInt(e.target.value, 10))}
								className="cmixer-range-input"
							/>
						</div>
						<span className="cmixer-pct-text">{inputVolume}%</span>
					</div>

					{/* VU Meter Line (Image 6: green reactive voice bar) */}
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
						<button
							type="button"
							className="cmixer-reset-link"
							onClick={handleResetAllApps}
						>
							Restablecer todo al 100%
						</button>
					</div>

					<div className="cmixer-apps-list">
						{apps.map((app) => (
							<div key={app.id} className="cmixer-app-row">
								<div className="cmixer-app-icon-box">
									<span>{app.icon || "!"}</span>
								</div>
								<div className="cmixer-app-info">
									<div className="cmixer-app-name">{app.name}</div>
									<div className="cmixer-app-sub">{app.sub}</div>
								</div>
								<div className="cmixer-track-wrap app-track">
									<div
										className="cmixer-track-fill"
										style={{ width: `${app.volume}%` }}
									/>
									<div
										className="cmixer-thumb"
										style={{ left: `calc(${app.volume}% - 8px)` }}
									/>
									<input
										type="range"
										min="0"
										max="100"
										value={app.volume}
										onChange={(e) => handleAppVolumeChange(app.id, parseInt(e.target.value, 10))}
										className="cmixer-range-input"
									/>
								</div>
								<span className="cmixer-pct-text">{app.volume}%</span>
								<button
									type="button"
									className="cmixer-app-mute-btn"
									onClick={() => handleAppVolumeChange(app.id, app.volume === 0 ? 100 : 0)}
								>
									{app.volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
								</button>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
