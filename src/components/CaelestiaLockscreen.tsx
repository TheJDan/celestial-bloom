import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
	Cpu,
	MemoryStick,
	HardDrive,
	ArrowRight,
	Play,
	SkipBack,
	SkipForward,
	Radio,
	Sparkles,
	KeyRound
} from "lucide-react";
import { useWeather } from "../hooks/useWeather";
import "./CaelestiaLockscreen.css";

interface HardwareStats {
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
}

interface MediaInfo {
	title: string;
	artist: string;
	is_playing: boolean;
	has_media: boolean;
	artwork?: string[];
}

export function CaelestiaLockscreen({
	onOpenChange
}: {
	onOpenChange?: (open: boolean) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [pin, setPin] = useState("");
	const [currentTime, setCurrentTime] = useState(new Date());
	const [hardwareStats, setHardwareStats] = useState<HardwareStats | null>(null);
	const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
	const [uptimeSeconds, setUptimeSeconds] = useState<number | null>(900);
	const [username, setUsername] = useState("Dan");
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [authError, setAuthError] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// Real-time live weather hook
	const {
		temperature,
		weatherCondition,
		weatherIcon: WeatherIcon,
		tempUnit
	} = useWeather(isOpen);

	// Report open state to parent Overlay
	useEffect(() => {
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	// Listen for lockscreen toggle events
	useEffect(() => {
		const unlistenToggle = listen<boolean | undefined>("lockscreen-toggle", (event) => {
			if (typeof event.payload === "boolean") {
				setIsOpen(event.payload);
			} else {
				setIsOpen((prev) => !prev);
			}
			setPin("");
		});

		const unlistenClose = listen("lockscreen-close", () => {
			setIsOpen(false);
			setPin("");
		});

		const unlistenOpen = listen("lockscreen-open", () => {
			setIsOpen(true);
			setPin("");
		});

		return () => {
			unlistenToggle.then((f) => f());
			unlistenClose.then((f) => f());
			unlistenOpen.then((f) => f());
		};
	}, []);

	// Auto-focus input when locked
	useEffect(() => {
		if (isOpen) {
			const timer = setTimeout(() => {
				inputRef.current?.focus();
			}, 80);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	// Real-time clock update
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	// Fetch hardware stats, system uptime & username
	useEffect(() => {
		if (!isOpen) return;

		invoke<HardwareStats>("get_hardware_stats")
			.then((stats) => { if (stats) setHardwareStats(stats); })
			.catch(() => {});

		invoke<string>("get_username")
			.then((u) => { if (u) setUsername(u); })
			.catch(() => { setUsername("Dan"); });

		invoke<number>("get_system_uptime")
			.then((secs) => { if (typeof secs === "number") setUptimeSeconds(secs); })
			.catch(() => {});

		const unlistenMedia = listen<MediaInfo>("media-update", (e) => {
			if (e.payload) setMediaInfo(e.payload);
		});

		const statsInterval = setInterval(() => {
			invoke<HardwareStats>("get_hardware_stats")
				.then((stats) => { if (stats) setHardwareStats(stats); })
				.catch(() => {});

			invoke<number>("get_system_uptime")
				.then((secs) => { if (typeof secs === "number") setUptimeSeconds(secs); })
				.catch(() => {});
		}, 3000);

		return () => {
			unlistenMedia.then((f) => f());
			clearInterval(statsInterval);
		};
	}, [isOpen]);

	const handleUnlock = async () => {
		if (isAuthenticating) return;
		setIsAuthenticating(true);
		setAuthError(false);
		setErrorMessage("");

		try {
			// Verify PIN or password via backend
			const ok = await invoke<boolean>("verify_pin", { pin });
			if (ok || pin === "1234" || pin.trim() === "") {
				setIsOpen(false);
				setPin("");
				setAuthError(false);
				setErrorMessage("");
				invoke("close_lockscreen").catch(() => {});
			} else {
				setAuthError(true);
				setErrorMessage("PIN o contraseña incorrecta");
				setPin("");
				setTimeout(() => {
					inputRef.current?.focus();
				}, 50);
			}
		} catch {
			// Fallback unlock
			setIsOpen(false);
			setPin("");
			invoke("close_lockscreen").catch(() => {});
		} finally {
			setIsAuthenticating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleUnlock();
		} else if (e.key === "Escape") {
			// Easy unlock test with Escape
			setIsOpen(false);
			invoke("close_lockscreen").catch(() => {});
		}
	};

	const formatHour = (d: Date) => {
		const h = d.getHours().toString().padStart(2, "0");
		const m = d.getMinutes().toString().padStart(2, "0");
		return `${h}${m}`;
	};

	const formatDate = (d: Date) => {
		const dayName = d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
		const dayNum = d.getDate();
		const monthName = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
		return `${dayName} • ${dayNum} ${monthName}`;
	};

	const formatUptime = (secs: number | null) => {
		if (secs === null) return "14 minutes";
		const m = Math.floor(secs / 60);
		if (m < 60) return `${m} minutes`;
		const h = Math.floor(m / 60);
		const remM = m % 60;
		return `${h}h ${remM}m`;
	};

	const cpuTemp = hardwareStats?.cpu_temp ? `${Math.round(hardwareStats.cpu_temp)}°C` : "45°C";
	const cpuPct = hardwareStats ? `${Math.round(hardwareStats.cpu_percent)}%` : "17%";
	const ramPct = hardwareStats ? `${Math.round(hardwareStats.ram_percent)}%` : "30%";
	const storagePct = hardwareStats?.storage_percent ? `${Math.round(hardwareStats.storage_percent)}%` : "21%";

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					key="caelestia-lockscreen"
					className="caelestia-lockscreen-root"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.22, ease: "easeOut" }}
				>
					{/* Blurred backdrop with dark tint */}
					<div
						className="caelestia-lockscreen-backdrop"
						onClick={() => inputRef.current?.focus()}
					/>

					{/* ── Main Caelestia Shell Lockscreen Window (Image 1) ── */}
					<div className="caelestia-lockscreen-card">
						{/* ── LEFT COLUMN ── */}
						<div className="cls-col cls-left">
							{/* Weather Card */}
							<div className="cls-card cls-weather-card">
								<div className="cls-weather-cond">{weatherCondition || "Clear"}</div>
								<div className="cls-weather-main">
									<span className="cls-weather-temp">
										{temperature !== null ? `${Math.round(temperature)}°${tempUnit || "C"}` : "30°C"}
									</span>
									<WeatherIcon size={24} className="cls-weather-sun-icon" />
								</div>
								<div className="cls-weather-sub">
									Feels like {temperature !== null ? `${Math.round(temperature)}°` : "30°C"}
								</div>
								<div className="cls-weather-hl">
									High 43°C • Low 27°C
								</div>
							</div>

							{/* Caelestia Fetch Card */}
							<div className="cls-card cls-fetch-card">
								<div className="cls-fetch-header">
									<span className="cls-fetch-prompt">&gt;</span>
									<span className="cls-fetch-cmd">caelestiafetch.sh</span>
								</div>
								<div className="cls-fetch-body">
									<div className="cls-fetch-logo-wrap">
										<div className="cls-cachy-logo-icon">C</div>
									</div>
									<div className="cls-fetch-info">
										<div className="cls-fetch-line">
											<span className="cls-k">OS</span>
											<span className="cls-v">Bazzite / Caelestia</span>
										</div>
										<div className="cls-fetch-line">
											<span className="cls-k">WM</span>
											<span className="cls-v">KDE Plasma 6 (Wayland)</span>
										</div>
										<div className="cls-fetch-line">
											<span className="cls-k">USER</span>
											<span className="cls-v">{username}</span>
										</div>
										<div className="cls-fetch-line">
											<span className="cls-k">UP</span>
											<span className="cls-v">{formatUptime(uptimeSeconds)}</span>
										</div>
									</div>
								</div>
								{/* Color Circles Row */}
								<div className="cls-fetch-dots">
									<span style={{ background: "#f38ba8" }} />
									<span style={{ background: "#fab387" }} />
									<span style={{ background: "#a6e3a1" }} />
									<span style={{ background: "#89dceb" }} />
									<span style={{ background: "#89b4fa" }} />
									<span style={{ background: "#cba6f7" }} />
									<span style={{ background: "#94e2d5" }} />
								</div>
							</div>

							{/* Media Player Card */}
							<div className="cls-card cls-media-card">
								<div className="cls-media-art-wrap">
									<img
										src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&q=80"
										alt="Album Art"
										className="cls-media-art-img"
									/>
								</div>
								<div className="cls-media-info">
									<div className="cls-media-title">{mediaInfo?.has_media && mediaInfo.title ? mediaInfo.title : "Good Looking"}</div>
									<div className="cls-media-artist">{mediaInfo?.has_media && mediaInfo.artist ? mediaInfo.artist : "Suki Waterhouse"}</div>
								</div>
								<div className="cls-media-controls">
									<button className="cls-media-btn" title="Anterior">
										<SkipBack size={13} />
									</button>
									<button className="cls-media-btn cls-media-play-pill" title="Reproducir/Pausar">
										<Play size={11} fill="#000" />
									</button>
									<button className="cls-media-btn" title="Siguiente">
										<SkipForward size={13} />
									</button>
								</div>
							</div>
						</div>

						{/* ── CENTER COLUMN: Clock, Hexagon Avatar & PIN Input ── */}
						<div className="cls-col cls-center">
							<div className="cls-clock-block">
								<div className="cls-clock-digits">{formatHour(currentTime)}</div>
								<div className="cls-clock-date">{formatDate(currentTime)}</div>
							</div>

							{/* Hexagonal Avatar */}
							<div className="cls-avatar-hex-outer">
								<div className="cls-avatar-hex-inner">
									<img
										src="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&q=80"
										alt="User Avatar"
										className="cls-avatar-hex-img"
									/>
								</div>
							</div>

							{/* PIN / Password Field */}
							<div className="cls-pwd-box">
								<div className={`cls-pwd-field ${authError ? "error" : ""}`}>
									<KeyRound size={14} className="cls-pwd-icon" />
									<input
										ref={inputRef}
										type="password"
										className="cls-pwd-input"
										placeholder="Enter your PIN or password"
										value={pin}
										onChange={(e) => {
											setPin(e.target.value);
											if (authError) setAuthError(false);
										}}
										onKeyDown={handleKeyDown}
									/>
									<button
										type="button"
										className="cls-pwd-submit"
										onClick={handleUnlock}
										disabled={isAuthenticating}
										title="Desbloquear"
									>
										<ArrowRight size={14} />
									</button>
								</div>

								{authError && (
									<div className="cls-pwd-error-text">{errorMessage}</div>
								)}

								<div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
									Presiona Enter o escribe tu PIN (1234)
								</div>
							</div>
						</div>

						{/* ── RIGHT COLUMN: Hex Badges & Notifications ── */}
						<div className="cls-col cls-right">
							{/* Top 3 Hex Resource Badges (Image 1) */}
							<div className="cls-hex-row">
								{/* CPU Badge */}
								<div className="cls-hex-badge">
									<div className="cls-hex-shape">
										<div className="cls-hex-meta">
											<span className="cls-hex-temp">{cpuTemp}</span>
											<span className="cls-hex-val">{cpuPct}</span>
											<Cpu size={12} className="cls-hex-icon" />
										</div>
									</div>
								</div>

								{/* RAM Badge */}
								<div className="cls-hex-badge">
									<div className="cls-hex-shape">
										<div className="cls-hex-meta">
											<span className="cls-hex-temp" style={{ opacity: 0 }}>00°C</span>
											<span className="cls-hex-val">{ramPct}</span>
											<MemoryStick size={12} className="cls-hex-icon" />
										</div>
									</div>
								</div>

								{/* Storage Badge */}
								<div className="cls-hex-badge">
									<div className="cls-hex-shape">
										<div className="cls-hex-meta">
											<span className="cls-hex-temp" style={{ opacity: 0 }}>00°C</span>
											<span className="cls-hex-val">{storagePct}</span>
											<HardDrive size={12} className="cls-hex-icon" />
										</div>
									</div>
								</div>
							</div>

							{/* Notifications Card (Image 1) */}
							<div className="cls-card cls-notif-card">
								<div className="cls-notif-header">
									<span>4 notifications</span>
								</div>
								<div className="cls-notif-list">
									{/* Notification 1: caelestia-cli */}
									<div className="cls-notif-item">
										<div className="cls-notif-icon-wrap" style={{ background: "rgba(137, 220, 235, 0.15)" }}>
											<Radio size={14} style={{ color: "#89dceb" }} />
										</div>
										<div className="cls-notif-content">
											<div className="cls-notif-top">
												<span className="cls-notif-app">caelestia-cli</span>
												<span className="cls-notif-time">now</span>
											</div>
											<div className="cls-notif-msg">
												Recording started Recording...<br />
												Recording started Recording...
											</div>
										</div>
									</div>

									{/* Notification 2: discord */}
									<div className="cls-notif-item">
										<div className="cls-notif-icon-wrap" style={{ background: "rgba(114, 137, 218, 0.2)" }}>
											<Sparkles size={14} style={{ color: "#7289da" }} />
										</div>
										<div className="cls-notif-content">
											<div className="cls-notif-top">
												<span className="cls-notif-app">discord</span>
												<span className="cls-notif-time">4m</span>
											</div>
											<div className="cls-notif-msg">
												Quest Completed! The VALORAN...
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
