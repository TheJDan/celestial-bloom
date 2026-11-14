import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Home,
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Clock,
	Sliders,
	Bell,
	FileText,
	Clipboard,
	MoreHorizontal,
	Volume2,
	VolumeX,
	Wifi,
	Bluetooth,
	MicOff,
	BatteryCharging,
	Battery,
	Camera,
	Lock,
	ChevronLeft,
	ChevronRight,
	CloudDrizzle,
	Sun,
	RotateCcw
} from "lucide-react";
import { WavySlider } from "./WavySlider";
import "./CaelestiaTabs.css";

interface MediaInfo {
	title: string;
	artist: string;
	is_playing: boolean;
	has_media: boolean;
	artwork?: string[];
	position_ms?: number;
	duration_ms?: number;
	seek_enabled?: boolean;
	position_updated_at?: number;
	source?: string;
}

interface CaelestiaDashboardProps {
	mediaInfo?: MediaInfo | null;
	temperature?: number | null;
	weatherCondition?: string;
	cityName?: string;
	onTogglePlayPause?: () => void;
	onNext?: () => void;
	onPrev?: () => void;
	onSwitchTab?: (tab: string) => void;
}

export function CaelestiaDashboard({
	mediaInfo,
	temperature,
	weatherCondition,
	cityName,
	onTogglePlayPause,
	onNext,
	onPrev,
	onSwitchTab
}: CaelestiaDashboardProps) {
	// Clock state
	const [now, setNow] = useState(new Date());
	useEffect(() => {
		const t = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(t);
	}, []);
	const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

	// Calendar state
	const [calDate, setCalDate] = useState(new Date());
	const year = calDate.getFullYear();
	const month0 = calDate.getMonth();
	const monthNames = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];
	const firstDay = new Date(year, month0, 1).getDay();
	const daysInMonth = new Date(year, month0 + 1, 0).getDate();
	const daysInPrev = new Date(year, month0, 0).getDate();

	const calCells: { day: number; isCurrent: boolean; isToday: boolean }[] = [];
	for (let i = firstDay - 1; i >= 0; i--) {
		calCells.push({ day: daysInPrev - i, isCurrent: false, isToday: false });
	}
	const today = new Date();
	for (let d = 1; d <= daysInMonth; d++) {
		const isToday =
			d === today.getDate() &&
			month0 === today.getMonth() &&
			year === today.getFullYear();
		calCells.push({ day: d, isCurrent: true, isToday });
	}
	while (calCells.length < 35) {
		calCells.push({ day: calCells.length - daysInMonth - firstDay + 1, isCurrent: false, isToday: false });
	}

	const shiftMonth = (delta: number) => {
		setCalDate(new Date(year, month0 + delta, 1));
	};

	// Timer state
	const [timerSeconds, setTimerSeconds] = useState(0);
	const [timerRunning, setTimerRunning] = useState(false);
	useEffect(() => {
		let interval: any = null;
		if (timerRunning && timerSeconds > 0) {
			interval = setInterval(() => {
				setTimerSeconds((prev) => {
					if (prev <= 1) {
						setTimerRunning(false);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		}
		return () => clearInterval(interval);
	}, [timerRunning, timerSeconds]);

	const startTimer = (mins: number) => {
		setTimerSeconds(mins * 60);
		setTimerRunning(true);
	};
	const toggleTimer = () => setTimerRunning((prev) => !prev);
	const resetTimer = () => {
		setTimerRunning(false);
		setTimerSeconds(0);
	};
	const formatTimer = (totalSec: number) => {
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${s.toString().padStart(2, "0")}`;
	};

	// Media progress calculation
	const isPlaying = mediaInfo?.is_playing ?? false;
	const title = mediaInfo?.has_media && mediaInfo.title ? mediaInfo.title : "Nada en reproducción";
	const artist = mediaInfo?.has_media && mediaInfo.artist ? mediaInfo.artist : "";
	const coverArt =
		mediaInfo?.artwork && mediaInfo.artwork.length > 0 && mediaInfo.artwork[0]
			? mediaInfo.artwork[0]
			: null;

	const posMs = mediaInfo?.position_ms ?? 0;
	const durMs = mediaInfo?.duration_ms ?? 0;
	const [displayPos, setDisplayPos] = useState(posMs);

	useEffect(() => {
		setDisplayPos(posMs);
	}, [posMs]);

	useEffect(() => {
		if (!isPlaying || durMs <= 0) return;
		const timer = setInterval(() => {
			setDisplayPos((p) => Math.min(durMs, p + 1000));
		}, 1000);
		return () => clearInterval(timer);
	}, [isPlaying, durMs]);

	const formatTime = (ms: number) => {
		const totalSec = Math.floor(ms / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		if (h > 0) {
			return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
		}
		return `${m}:${s.toString().padStart(2, "0")}`;
	};

	const progressRatio = durMs > 0 ? Math.min(1, Math.max(0, displayPos / durMs)) : 0;

	// Weather data
	const tempDisplay = temperature !== null && temperature !== undefined ? `${Math.round(temperature)}°` : "20°";
	const condDisplay = weatherCondition || "Llovizna";
	const cityDisplay = cityName || "Ibarra";

	const hourlyForecast = [
		{ hour: "17:00", temp: "20°" },
		{ hour: "18:00", temp: "19°" },
		{ hour: "19:00", temp: "17°" },
		{ hour: "20:00", temp: "17°" },
		{ hour: "21:00", temp: "17°" }
	];

	return (
		<div className="caelestia-home-panel" onClick={(e) => e.stopPropagation()}>
			{/* ── Top Bar ── */}
			<div className="chome-top-bar">
				{/* Left Tabs Pill */}
				<div className="chome-tabs-pill">
					<button
						type="button"
						className="chome-tab-item active"
						onClick={() => onSwitchTab?.("command-center")}
					>
						<Home size={14} strokeWidth={2.4} />
						<span>Inicio</span>
					</button>

					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Media"
						onClick={() => onSwitchTab?.("music")}
					>
						<Play size={13} fill="currentColor" strokeWidth={0} />
					</button>

					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Reloj / Calendario"
						onClick={() => onSwitchTab?.("calendar")}
					>
						<Clock size={14} strokeWidth={2.2} />
					</button>

					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Controles"
						onClick={() => onSwitchTab?.("devices")}
					>
						<Sliders size={14} strokeWidth={2.2} />
					</button>

					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Notificaciones"
					>
						<Bell size={14} strokeWidth={2.2} />
						<span className="chome-badge">15</span>
					</button>

					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Notas"
					>
						<FileText size={14} strokeWidth={2.2} />
					</button>

					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Portapapeles"
					>
						<Clipboard size={14} strokeWidth={2.2} />
					</button>

					<button
						type="button"
						className="chome-tab-item icon-only"
						title="Más herramientas"
					>
						<MoreHorizontal size={14} strokeWidth={2.2} />
					</button>
				</div>

				{/* Center Clock */}
				<div className="chome-center-clock">
					<span>{timeStr}</span>
				</div>

				{/* Right Quick Toggles */}
				<div className="chome-quick-toggles">
					<button type="button" className="chome-toggle-btn" title="Volumen">
						<Volume2 size={14} strokeWidth={2.2} />
					</button>
					<button type="button" className="chome-toggle-btn" title="Wi-Fi">
						<Wifi size={14} strokeWidth={2.2} />
					</button>
					<button type="button" className="chome-toggle-btn active-blue" title="Bluetooth Activado">
						<Bluetooth size={14} strokeWidth={2.2} />
					</button>
					<button type="button" className="chome-toggle-btn" title="Micrófono">
						<MicOff size={14} strokeWidth={2.2} />
					</button>
					<button type="button" className="chome-toggle-btn active-blue" title="Batería">
						<BatteryCharging size={14} strokeWidth={2.2} />
					</button>
					<button type="button" className="chome-toggle-btn" title="Captura de pantalla">
						<Camera size={14} strokeWidth={2.2} />
					</button>
					<button type="button" className="chome-toggle-btn" title="Bloquear">
						<Lock size={14} strokeWidth={2.2} />
					</button>
					<button
						type="button"
						className="chome-toggle-btn"
						title="Ajustes"
						onClick={() => onSwitchTab?.("devices")}
					>
						<Sliders size={14} strokeWidth={2.2} />
					</button>
				</div>
			</div>

			{/* ── Main Content: 3 Columns ── */}
			<div className="chome-columns">
				{/* ── Column 1: MusicCard + MonthCalendar (Width: 300px) ── */}
				<div className="chome-col chome-col-left">
					{/* MusicCard */}
					<div className="chome-music-card">
						<div className="chome-music-header">
							<div className="chome-music-art-wrap">
								{coverArt ? (
									<img src={coverArt} alt="Cover" className="chome-music-art-img" />
								) : (
									<div className="chome-music-art-placeholder">
										<Play size={18} fill="currentColor" />
									</div>
								)}
							</div>
							<div className="chome-music-info">
								<span className="chome-music-title" title={title}>
									{title}
								</span>
								{artist && (
									<span className="chome-music-artist" title={artist}>
										{artist}
									</span>
								)}
								<div className="chome-music-badge">
									<span>{mediaInfo?.artist?.includes("- Topic") ? "Brave" : "Brave"}</span>
								</div>
							</div>
						</div>

						{/* Animated Wavy Slider (Fluid 60fps Caelestia Wave) */}
						<WavySlider
							value={progressRatio}
							playing={isPlaying}
							fillColor="#ffffff"
							trackColor="rgba(255, 255, 255, 0.15)"
							handleColor="#ffffff"
							height={22}
							onChange={(v) => {
								if (durMs > 0) {
									const seekMs = Math.round(v * durMs);
									setDisplayPos(seekMs);
									invoke("media_seek", { positionMs: seekMs }).catch(() => {});
								}
							}}
						/>

						<div className="chome-music-times">
							<span>{formatTime(displayPos)}</span>
							<span>{formatTime(durMs || 7557000)}</span>
						</div>

						{/* Controls Row */}
						<div className="chome-music-ctrls">
							<button type="button" className="chome-ctrl-icon" onClick={onPrev} title="Anterior">
								<SkipBack size={16} strokeWidth={2.4} fill="currentColor" />
							</button>

							<button
								type="button"
								className="chome-ctrl-play-pill"
								onClick={onTogglePlayPause}
								title={isPlaying ? "Pausar" : "Reproducir"}
							>
								{isPlaying ? (
									<Pause size={18} strokeWidth={2.8} fill="#000" color="#000" />
								) : (
									<Play size={18} strokeWidth={2.8} fill="#000" color="#000" />
								)}
							</button>

							<button type="button" className="chome-ctrl-icon" onClick={onNext} title="Siguiente">
								<SkipForward size={16} strokeWidth={2.4} fill="currentColor" />
							</button>
						</div>
					</div>

					{/* MonthCalendar */}
					<div className="chome-calendar-card">
						<div className="chome-cal-header">
							<span className="chome-cal-title">
								{monthNames[month0]} {year}
							</span>
							<div className="chome-cal-nav">
								<button type="button" className="chome-cal-btn" onClick={() => shiftMonth(-1)}>
									<ChevronLeft size={14} />
								</button>
								<button type="button" className="chome-cal-btn" onClick={() => shiftMonth(1)}>
									<ChevronRight size={14} />
								</button>
							</div>
						</div>

						<div className="chome-cal-weekdays">
							{["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
								<span key={i} className="chome-cal-weekday">
									{w}
								</span>
							))}
						</div>

						<div className="chome-cal-grid">
							{calCells.map((c, i) => (
								<div
									key={i}
									className={`chome-cal-cell ${c.isToday ? "today" : ""} ${!c.isCurrent ? "other" : ""}`}
								>
									<span>{c.day}</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* ── Column 2: WeatherCard + UpNext (Flex: 1) ── */}
				<div className="chome-col chome-col-center">
					{/* WeatherCard */}
					<div className="chome-weather-card">
						<div className="chome-weather-main-row">
							<span className="chome-weather-deg">{tempDisplay}</span>
							<div className="chome-weather-desc-col">
								<div className="chome-weather-cond-row">
									<CloudDrizzle size={16} strokeWidth={2.2} />
									<span className="chome-weather-cond-text">{condDisplay}</span>
								</div>
								<span className="chome-weather-city-range">
									{cityDisplay} · H 26° L 16°
								</span>
							</div>
						</div>

						{/* Hourly Forecast */}
						<div className="chome-weather-hourly-row">
							{hourlyForecast.map((item, idx) => (
								<div key={idx} className="chome-hourly-item">
									<span className="chome-hourly-time">{item.hour}</span>
									<span className="chome-hourly-temp">{item.temp}</span>
								</div>
							))}
						</div>
					</div>

					{/* UpNext Section */}
					<div className="chome-upnext-card">
						<span className="chome-section-label">PRÓXIMAMENTE</span>
						<p className="chome-upnext-subtext">
							Añade el enlace de tu Google Calendar para ver eventos aquí
						</p>
					</div>
				</div>

				{/* ── Column 3: TimerCard (Width: 200px) ── */}
				<div className="chome-col chome-col-right">
					<div className="chome-timer-card">
						<span className="chome-section-label">TEMPORIZADOR</span>
						<span className="chome-timer-digits">
							{timerSeconds > 0 ? formatTimer(timerSeconds) : "0:00"}
						</span>

						{/* 2x2 Preset Grid */}
						<div className="chome-timer-grid">
							<button type="button" className="chome-preset-btn" onClick={() => startTimer(5)}>
								5 min
							</button>
							<button type="button" className="chome-preset-btn" onClick={() => startTimer(15)}>
								15 min
							</button>
							<button type="button" className="chome-preset-btn" onClick={() => startTimer(25)}>
								25 min
							</button>
							<button type="button" className="chome-preset-btn" onClick={() => startTimer(60)}>
								60 min
							</button>
						</div>

						{/* Active Controls if running */}
						{timerSeconds > 0 && (
							<div className="chome-timer-active-actions">
								<button type="button" className="chome-preset-btn active-pill" onClick={toggleTimer}>
									{timerRunning ? "Pausar" : "Reanudar"}
								</button>
								<button type="button" className="chome-timer-icon-btn" onClick={resetTimer} title="Reiniciar">
									<RotateCcw size={13} />
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
