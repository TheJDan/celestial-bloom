import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Sun,
	Cpu,
	MemoryStick,
	HardDrive,
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Clock,
	Layers
} from "lucide-react";
import "./CaelestiaTabs.css";

interface HardwareStats {
	cpu_percent: number;
	cpu_temp?: number;
	cpu_name?: string;
	gpu_percent?: number;
	gpu_temp?: number;
	ram_used_gb: number;
	ram_total_gb: number;
	ram_percent: number;
	storage_used_gb?: number;
	storage_total_gb?: number;
	storage_percent?: number;
}

interface MediaInfo {
	title: string;
	artist: string;
	is_playing: boolean;
	has_media: boolean;
	artwork?: string[];
}

export function CaelestiaDashboard({
	mediaInfo,
	temperature,
	weatherCondition,
	cityName,
	onTogglePlayPause,
	onNext,
	onPrev
}: {
	mediaInfo?: MediaInfo | null;
	temperature?: number | null;
	weatherCondition?: string;
	cityName?: string;
	onTogglePlayPause?: () => void;
	onNext?: () => void;
	onPrev?: () => void;
}) {
	const [now, setNow] = useState(new Date());
	const [stats, setStats] = useState<HardwareStats | null>(null);
	const [uptime, setUptime] = useState<number>(900);
	const [username, setUsername] = useState("Dan");

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		const fetchStats = () => {
			invoke<HardwareStats>("get_hardware_stats")
				.then((s) => { if (s) setStats(s); })
				.catch(() => {});
			invoke<number>("get_system_uptime")
				.then((u) => { if (typeof u === "number") setUptime(u); })
				.catch(() => {});
			invoke<string>("get_username")
				.then((u) => { if (u) setUsername(u); })
				.catch(() => {});
		};
		fetchStats();
		const interval = setInterval(fetchStats, 2000);
		return () => clearInterval(interval);
	}, []);

	// Formatting
	const hours = now.getHours().toString().padStart(2, "0");
	const minutes = now.getMinutes().toString().padStart(2, "0");
	const monthName = now.toLocaleString("en-US", { month: "long" });
	const year = now.getFullYear();
	const todayDate = now.getDate();

	const uptimeMinutes = Math.floor(uptime / 60);
	const uptimeStr = uptimeMinutes < 60 ? `${uptimeMinutes}m` : `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}m`;

	// Simple Month Calendar Generator
	const firstDayIndex = new Date(year, now.getMonth(), 1).getDay();
	const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
	const daysInPrevMonth = new Date(year, now.getMonth(), 0).getDate();

	const calCells = [];
	for (let i = firstDayIndex - 1; i >= 0; i--) {
		calCells.push({ day: daysInPrevMonth - i, isOther: true, isToday: false });
	}
	for (let d = 1; d <= daysInMonth; d++) {
		calCells.push({ day: d, isOther: false, isToday: d === todayDate });
	}
	while (calCells.length < 35) {
		calCells.push({ day: calCells.length - daysInMonth - firstDayIndex + 1, isOther: true, isToday: false });
	}

	const cpuPct = Math.round(stats?.cpu_percent ?? 18);
	const ramPct = Math.round(stats?.ram_percent ?? 29);
	const diskPct = Math.round(stats?.storage_percent ?? 21);

	// Circular Gauge SVG helper (clean monochrome)
	const renderDial = (pct: number, icon: React.ReactNode, title: string) => {
		const radius = 17;
		const circ = 2 * Math.PI * radius;
		const strokeDashoffset = circ - (pct / 100) * circ;
		return (
			<div className="cdash-dial-circle" title={`${title}: ${pct}%`}>
				<svg className="cdash-dial-svg" width="44" height="44" viewBox="0 0 44 44">
					<circle
						cx="22"
						cy="22"
						r={radius}
						fill="none"
						stroke="rgba(255, 255, 255, 0.1)"
						strokeWidth="3.2"
					/>
					<circle
						cx="22"
						cy="22"
						r={radius}
						fill="none"
						stroke="#ffffff"
						strokeWidth="3.2"
						strokeDasharray={circ}
						strokeDashoffset={strokeDashoffset}
						strokeLinecap="round"
					/>
				</svg>
				<div className="cdash-dial-icon">{icon}</div>
			</div>
		);
	};

	const isPlaying = mediaInfo?.is_playing ?? false;
	const title = mediaInfo?.has_media && mediaInfo.title ? mediaInfo.title : "Instant Crush";
	const artist = mediaInfo?.has_media && mediaInfo.artist ? mediaInfo.artist : "Daft Punk";
	const coverArt = (mediaInfo?.artwork && mediaInfo.artwork.length > 0 && mediaInfo.artwork[0])
		? mediaInfo.artwork[0]
		: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&q=80";

	const tempDisplay = temperature !== null && temperature !== undefined ? `${Math.round(temperature)}°C` : "9°C";
	const condDisplay = weatherCondition || "Mayormente Despejado";

	return (
		<div className="caelestia-tab-body">
			<div className="cdash-grid">
				{/* ── Left Column: Weather + Vertical Clock ── */}
				<div className="cdash-col-left">
					<div className="cdash-card cdash-weather-card">
						<Sun size={26} className="cdash-weather-icon" />
						<span className="cdash-weather-temp">{tempDisplay}</span>
						<span className="cdash-weather-cond">{condDisplay}</span>
						{cityName && <span className="cdash-weather-city">{cityName}</span>}
					</div>

					<div className="cdash-card cdash-clock-card">
						<span className="cdash-clock-digit">{hours}</span>
						<span className="cdash-clock-dots">•••</span>
						<span className="cdash-clock-digit">{minutes}</span>
					</div>
				</div>

				{/* ── Center Column: Profile + Calendar ── */}
				<div className="cdash-col-center">
					<div className="cdash-profile-bar">
						<div className="cdash-avatar-wrap">
							<img
								src="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100&q=80"
								alt="Avatar"
								className="cdash-avatar-img"
							/>
						</div>
						<div className="cdash-badge-pill">
							<span>C</span>
						</div>
						<div className="cdash-badge-pill">
							<Layers size={11} />
							<span>{username}</span>
						</div>
						<div className="cdash-uptime-pill">
							<Clock size={11} />
							<span>up {uptimeStr}</span>
						</div>
					</div>

					<div className="cdash-card cdash-calendar-card">
						<div className="cdash-cal-header">
							<span>{monthName} {year}</span>
						</div>
						<div className="cdash-cal-grid">
							{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
								<span key={day} className="cdash-cal-day-label">{day}</span>
							))}
							{calCells.map((c, i) => (
								<div
									key={i}
									className={`cdash-cal-cell ${c.isToday ? "today" : ""} ${c.isOther ? "other-month" : ""}`}
								>
									{c.day}
								</div>
							))}
						</div>
					</div>
				</div>

				{/* ── Right Column: Dials + Mini Player ── */}
				<div className="cdash-col-right">
					<div className="cdash-dials-col">
						{renderDial(cpuPct, <Cpu size={14} />, "CPU")}
						{renderDial(ramPct, <MemoryStick size={14} />, "RAM")}
						{renderDial(diskPct, <HardDrive size={14} />, "Disk")}
					</div>

					<div className="cdash-card cdash-mini-player-card">
						<div className="cdash-mini-vinyl-wrap">
							<div className={`cdash-mini-vinyl ${isPlaying ? "spinning" : ""}`}>
								<img
									src={coverArt}
									alt="Cover"
									style={{ width: "100%", height: "100%", objectFit: "cover" }}
								/>
							</div>
						</div>

						<span className="cdash-mini-title" title={title}>{title}</span>
						<span className="cdash-mini-artist" title={artist}>{artist}</span>

						<div className="cdash-mini-controls">
							<button className="cdash-mini-btn" onClick={onPrev} title="Anterior">
								<SkipBack size={12} />
							</button>
							<button className="cdash-mini-play-pill" onClick={onTogglePlayPause} title={isPlaying ? "Pausar" : "Reproducir"}>
								{isPlaying ? <Pause size={10} fill="#000" /> : <Play size={10} fill="#000" />}
							</button>
							<button className="cdash-mini-btn" onClick={onNext} title="Siguiente">
								<SkipForward size={12} />
							</button>
						</div>

						{/* Animated Bongo Cat */}
						<img
							src="https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif"
							alt="Bongo Cat"
							className="cdash-bongo-cat"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
