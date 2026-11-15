import React, { useState, useEffect } from "react";
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
	Music,
	ListMusic,
	Shuffle,
	Repeat
} from "lucide-react";
import { WavySlider } from "./WavySlider";
import { RadialVisualizer } from "./RadialVisualizer";
import { CaelestiaTopBar } from "./CaelestiaTopBar";
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

interface CaelestiaMusicPlayerProps {
	mediaInfo: MediaInfo;
	albumArtUrl?: string | null;
	isPlaying: boolean;
	volume: number;
	onVolumeChange: (vol: number) => void;
	onTogglePlayPause: () => void;
	onPrev: () => void;
	onNext: () => void;
	onSwitchTab?: (tab: string) => void;
}

export function CaelestiaMusicPlayer({
	mediaInfo,
	albumArtUrl,
	isPlaying,
	volume,
	onVolumeChange,
	onTogglePlayPause,
	onPrev,
	onNext,
	onSwitchTab
}: CaelestiaMusicPlayerProps) {
	// Clock state for top bar
	const [now, setNow] = useState(new Date());
	useEffect(() => {
		const t = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(t);
	}, []);
	const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

	// Track details
	const title = mediaInfo.has_media && mediaInfo.title ? mediaInfo.title : "Nada en reproducción";
	const artist = mediaInfo.has_media && mediaInfo.artist ? mediaInfo.artist : "Abre Spotify o Brave";
	const sourceName = mediaInfo.artist?.includes("- Topic") ? "Brave" : (mediaInfo.source || "Brave");

	const posMs = mediaInfo.position_ms ?? 0;
	const durMs = mediaInfo.duration_ms ?? 0;
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

	const handleSeek = (ratio: number) => {
		if (durMs > 0) {
			const seekPos = Math.round(ratio * durMs);
			setDisplayPos(seekPos);
			invoke("media_seek", { positionMs: seekPos }).catch(() => {});
		}
	};

	return (
		<div className="caelestia-home-panel cmusic-stage-panel" onClick={(e) => e.stopPropagation()}>
			{/* Ambient background glow from album art */}
			{albumArtUrl && (
				<div
					className="cmusic-ambient-halo"
					style={{
						backgroundImage: `radial-gradient(circle at 35% 40%, rgba(56, 189, 248, 0.22) 0%, rgba(244, 63, 94, 0.12) 40%, transparent 70%)`
					}}
				/>
			)}

			{/* ── Authentic Caelestia Top Bar ── */}
			<CaelestiaTopBar activeTab="music" onSwitchTab={(t) => onSwitchTab?.(t)} />

			{/* ── Main Stage (Caelestia Music Player View) ── */}
			<div className="cmusic-stage-container">
				{/* Top Section: Circular Artwork with Radial Visualizer & Track Details */}
				<div className="cmusic-header-row">
					{/* Circular Art Wrap with Radial Visualizer */}
					<div className="cmusic-radial-wrap">
						<RadialVisualizer
							active={isPlaying}
							innerRadius={77}
							barCount={42}
							maxMagnitude={22}
							barColor="#38bdf8"
						/>
						<div className="cmusic-art-circle">
							{albumArtUrl ? (
								<img src={albumArtUrl} alt="Album Art" className="cmusic-art-image" draggable={false} />
							) : (
								<div className="cmusic-art-fallback">
									<Music size={44} strokeWidth={1.8} />
								</div>
							)}
						</div>
					</div>

					{/* Track Info & Volume Slider */}
					<div className="cmusic-meta-col">
						{/* Source App Pill */}
						<div className="cmusic-source-pill">
							<Music size={11} strokeWidth={2.2} />
							<span>{sourceName}</span>
						</div>

						{/* Track Title */}
						<h1 className="cmusic-track-title" title={title}>
							{title}
						</h1>

						{/* Artist */}
						<span className="cmusic-track-artist" title={artist}>
							{artist}
						</span>

						{/* Volume Slider Row */}
						<div className="cmusic-volume-row">
							<Volume2 size={13} className="cmusic-volume-icon" />
							<div className="cmusic-volume-track">
								<div
									className="cmusic-volume-fill"
									style={{ width: `${Math.round(volume * 100)}%` }}
								/>
								<input
									type="range"
									className="cmusic-volume-slider"
									min={0}
									max={1}
									step={0.01}
									value={volume}
									onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Middle Section: Long Wavy Slider & Timestamps */}
				<div className="cmusic-wavy-section">
					<WavySlider
						value={progressRatio}
						playing={isPlaying}
						fillColor="#38bdf8"
						trackColor="rgba(255, 255, 255, 0.18)"
						handleColor="#ffffff"
						height={28}
						onChange={handleSeek}
					/>

					<div className="cmusic-time-row">
						<span>{formatTime(displayPos)}</span>
						<span>{formatTime(durMs || 7557000)}</span>
					</div>
				</div>

				{/* Bottom Section: Controls Row */}
				<div className="cmusic-controls-row">
					<button
						type="button"
						className="cmusic-control-btn"
						onClick={onPrev}
						title="Anterior"
					>
						<SkipBack size={18} strokeWidth={2.2} fill="currentColor" />
					</button>

					<button
						type="button"
						className="cmusic-play-pill"
						onClick={onTogglePlayPause}
						title={isPlaying ? "Pausar" : "Reproducir"}
					>
						{isPlaying ? (
							<Pause size={22} strokeWidth={2.8} fill="#000000" color="#000000" />
						) : (
							<Play size={22} strokeWidth={2.8} fill="#000000" color="#000000" />
						)}
					</button>

					<button
						type="button"
						className="cmusic-control-btn"
						onClick={onNext}
						title="Siguiente"
					>
						<SkipForward size={18} strokeWidth={2.2} fill="currentColor" />
					</button>

					<button
						type="button"
						className="cmusic-control-btn lyrics-icon-btn"
						title="Letras"
					>
						<ListMusic size={18} strokeWidth={2.2} />
					</button>
				</div>
			</div>
		</div>
	);
}
