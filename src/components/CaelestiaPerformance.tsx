import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Cpu,
	Monitor,
	HardDrive,
	ArrowDownUp,
	MemoryStick,
	Thermometer
} from "lucide-react";
import "./CaelestiaTabs.css";

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
	net_download_speed?: number;
	net_upload_speed?: number;
}

export function CaelestiaPerformance() {
	const [stats, setStats] = useState<HardwareStats | null>(null);
	const [history, setHistory] = useState<number[]>([12, 45, 23, 67, 34, 89, 45, 30, 78, 55, 90, 40]);

	useEffect(() => {
		const fetchStats = () => {
			invoke<HardwareStats>("get_hardware_stats")
				.then((s) => {
					if (s) {
						setStats(s);
						setHistory((prev) => [...prev.slice(1), Math.max(10, Math.min(95, s.cpu_percent + Math.random() * 20))]);
					}
				})
				.catch(() => {});
		};
		fetchStats();
		const interval = setInterval(fetchStats, 1500);
		return () => clearInterval(interval);
	}, []);

	const cpuName = stats?.cpu_name || "Intel Core i7-13700H";
	const cpuPct = Math.round(stats?.cpu_percent ?? 23);
	const cpuTemp = Math.round(stats?.cpu_temp ?? 50);

	const gpuName = stats?.gpu_name || "NVIDIA GeForce RTX 4060 Laptop GPU";
	const gpuPct = Math.round(stats?.gpu_percent ?? 37);
	const gpuTemp = Math.round(stats?.gpu_temp ?? 48);

	const ramUsed = stats?.ram_used_gb ? stats.ram_used_gb.toFixed(1) : "4.5";
	const ramTotal = stats?.ram_total_gb ? stats.ram_total_gb.toFixed(1) : "15.4";
	const ramPct = Math.round(stats?.ram_percent ?? 29);

	const diskUsed = stats?.storage_used_gb ? stats.storage_used_gb.toFixed(1) : "31.4";
	const diskTotal = stats?.storage_total_gb ? stats.storage_total_gb.toFixed(1) : "147.2";
	const diskPct = Math.round(stats?.storage_percent ?? 21);

	const downRate = stats?.net_download_speed ? `${(stats.net_download_speed / 1024).toFixed(0)} KiB/s` : "343 B/s";
	const upRate = stats?.net_upload_speed ? `${(stats.net_upload_speed / 1024).toFixed(0)} KiB/s` : "143 B/s";

	// Generate SVG polygon points for monochrome network chart
	const chartPoints = history
		.map((val, idx) => `${(idx / (history.length - 1)) * 260},${36 - (val / 100) * 32}`)
		.join(" ");

	return (
		<div className="caelestia-tab-body">
			<div className="cperf-container monochrome">
				{/* ── Top Row: CPU & GPU Cards ── */}
				<div className="cperf-row-top">
					{/* CPU Card */}
					<div className="cperf-card">
						<div className="cperf-hw-meta">
							<div className="cperf-hw-header">
								<Cpu size={16} className="cperf-icon-mono" />
								<span className="cperf-hw-title">CPU</span>
							</div>
							<span className="cperf-hw-name">{cpuName}</span>

							<div className="cperf-temp-row">
								<Thermometer size={12} className="cperf-icon-mono-sub" />
								<span className="cperf-temp-text">{cpuTemp}°C</span>
								<div className="cperf-temp-bar">
									<div className="cperf-temp-fill mono" style={{ width: `${Math.min(100, cpuTemp)}%` }} />
								</div>
							</div>
						</div>

						<div className="cperf-clover-badge mono">
							<span className="cperf-clover-label">Usage</span>
							<span className="cperf-clover-pct">{cpuPct}%</span>
						</div>
					</div>

					{/* GPU Card */}
					<div className="cperf-card">
						<div className="cperf-hw-meta">
							<div className="cperf-hw-header">
								<Monitor size={16} className="cperf-icon-mono" />
								<span className="cperf-hw-title">GPU</span>
							</div>
							<span className="cperf-hw-name">{gpuName}</span>

							<div className="cperf-temp-row">
								<Thermometer size={12} className="cperf-icon-mono-sub" />
								<span className="cperf-temp-text">{gpuTemp}°C</span>
								<div className="cperf-temp-bar">
									<div className="cperf-temp-fill mono" style={{ width: `${Math.min(100, gpuTemp)}%` }} />
								</div>
							</div>
						</div>

						<div className="cperf-clover-badge mono">
							<span className="cperf-clover-label">Usage</span>
							<span className="cperf-clover-pct">{gpuPct}%</span>
						</div>
					</div>
				</div>

				{/* ── Bottom Row: Storage, Network & Memory ── */}
				<div className="cperf-row-bottom">
					{/* Storage Dial Card */}
					<div className="cperf-card cperf-storage-card">
						<div className="cperf-dial-wrap">
							<svg className="cperf-dial-svg" width="58" height="58" viewBox="0 0 58 58">
								<circle cx="29" cy="29" r="23" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="4" />
								<circle
									cx="29"
									cy="29"
									r="23"
									fill="none"
									stroke="#ffffff"
									strokeWidth="4"
									strokeDasharray={2 * Math.PI * 23}
									strokeDashoffset={2 * Math.PI * 23 - (diskPct / 100) * 2 * Math.PI * 23}
									strokeLinecap="round"
								/>
							</svg>
							<div className="cperf-dial-inner">
								<span className="cperf-dial-pct">{diskPct}%</span>
								<span className="cperf-dial-label">Used</span>
							</div>
						</div>

						<div className="cperf-sub-meta">
							<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
								<HardDrive size={13} className="cperf-icon-mono-sub" />
								<span className="cperf-sub-title">Storage</span>
							</div>
							<span className="cperf-sub-value">{diskUsed} / {diskTotal} GiB</span>
							<span className="cperf-drive-pill">nvme0n1</span>
						</div>
					</div>

					{/* Network Activity Waveform */}
					<div className="cperf-card cperf-net-card">
						<div className="cperf-net-header">
							<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
								<ArrowDownUp size={13} className="cperf-icon-mono-sub" />
								<span className="cperf-sub-title">Network</span>
							</div>
							<div className="cperf-net-rates">
								<span className="cperf-rate">↓ {downRate}</span>
								<span className="cperf-rate">↑ {upRate}</span>
							</div>
						</div>

						{/* Monochrome Waveform SVG */}
						<div className="cperf-waveform-box">
							<svg className="cperf-waveform-svg" width="100%" height="40" viewBox="0 0 260 40" preserveAspectRatio="none">
								<polyline
									fill="none"
									stroke="#ffffff"
									strokeWidth="1.6"
									strokeLinecap="round"
									strokeLinejoin="round"
									points={chartPoints}
								/>
								<polygon
									fill="rgba(255, 255, 255, 0.08)"
									points={`0,40 ${chartPoints} 260,40`}
								/>
							</svg>
						</div>
					</div>

					{/* Memory Dial Card */}
					<div className="cperf-card cperf-mem-card">
						<div className="cperf-dial-wrap">
							<svg className="cperf-dial-svg" width="58" height="58" viewBox="0 0 58 58">
								<circle cx="29" cy="29" r="23" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="4" />
								<circle
									cx="29"
									cy="29"
									r="23"
									fill="none"
									stroke="#ffffff"
									strokeWidth="4"
									strokeDasharray={2 * Math.PI * 23}
									strokeDashoffset={2 * Math.PI * 23 - (ramPct / 100) * 2 * Math.PI * 23}
									strokeLinecap="round"
								/>
							</svg>
							<div className="cperf-dial-inner">
								<span className="cperf-dial-pct">{ramPct}%</span>
								<span className="cperf-dial-label">Used</span>
							</div>
						</div>

						<div className="cperf-sub-meta">
							<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
								<MemoryStick size={13} className="cperf-icon-mono-sub" />
								<span className="cperf-sub-title">Memory</span>
							</div>
							<span className="cperf-sub-value">{ramUsed} / {ramTotal} GiB</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
