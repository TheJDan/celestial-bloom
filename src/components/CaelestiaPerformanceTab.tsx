import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Cpu,
	Monitor,
	HardDrive,
	MemoryStick,
	Wifi,
	BatteryCharging,
	Battery,
	Thermometer
} from "lucide-react";
import { CaelestiaTopBar, CaelestiaTabKey } from "./CaelestiaTopBar";
import "./CaelestiaTabs.css";

interface HardwareStats {
	cpu_percent: number;
	cpu_temp?: number;
	cpu_name?: string;
	gpu_percent?: number;
	gpu_temp?: number;
	gpu_name?: string;
	vram_used_gb?: number;
	vram_total_gb?: number;
	ram_used_gb: number;
	ram_total_gb: number;
	ram_percent: number;
	storage_used_gb?: number;
	storage_total_gb?: number;
	storage_percent?: number;
	storage_unit?: string;
	net_download_speed?: number;
	net_upload_speed?: number;
	battery_percent?: number;
	is_charging?: boolean;
	battery_state?: string;
}

interface CaelestiaPerformanceTabProps {
	onSwitchTab?: (tab: CaelestiaTabKey) => void;
}

export function CaelestiaPerformanceTab({ onSwitchTab }: CaelestiaPerformanceTabProps) {
	const [cpuPct, setCpuPct] = useState<number>(0);
	const [cpuTemp, setCpuTemp] = useState<number>(45);
	const [cpuName, setCpuName] = useState<string>("Detectando procesador...");

	const [gpuPct, setGpuPct] = useState<number>(0);
	const [gpuTemp, setGpuTemp] = useState<number>(42);
	const [gpuName, setGpuName] = useState<string>("Detectando GPU...");
	const [vramUsed, setVramUsed] = useState<number>(0);
	const [vramTotal, setVramTotal] = useState<number>(0);

	const [diskPct, setDiskPct] = useState<number>(0);
	const [diskUsed, setDiskUsed] = useState<number>(0);
	const [diskTotal, setDiskTotal] = useState<number>(0);
	const [diskUnit, setDiskUnit] = useState<string>("C:");

	const [ramPct, setRamPct] = useState<number>(0);
	const [ramUsed, setRamUsed] = useState<number>(0);
	const [ramTotal, setRamTotal] = useState<number>(0);

	const [downSpeedStr, setDownSpeedStr] = useState<string>("0 KB/s");
	const [upSpeedStr, setUpSpeedStr] = useState<string>("0 KB/s");

	const [batteryPct, setBatteryPct] = useState<number>(100);
	const [isCharging, setIsCharging] = useState<boolean>(false);
	const [batteryState, setBatteryState] = useState<string>("En batería");

	useEffect(() => {
		let isMounted = true;

		const applyStats = (stats: HardwareStats) => {
			if (!stats || !isMounted) return;
			if (typeof stats.cpu_percent === "number") setCpuPct(Math.round(stats.cpu_percent));
			if (typeof stats.cpu_temp === "number" && stats.cpu_temp > 0) setCpuTemp(Math.round(stats.cpu_temp));
			if (stats.cpu_name) setCpuName(stats.cpu_name);

			if (typeof stats.gpu_percent === "number") setGpuPct(Math.round(stats.gpu_percent));
			if (typeof stats.gpu_temp === "number" && stats.gpu_temp > 0) setGpuTemp(Math.round(stats.gpu_temp));
			if (stats.gpu_name) setGpuName(stats.gpu_name);
			if (typeof stats.vram_used_gb === "number") setVramUsed(parseFloat(stats.vram_used_gb.toFixed(1)));
			if (typeof stats.vram_total_gb === "number") setVramTotal(parseFloat(stats.vram_total_gb.toFixed(1)));

			if (typeof stats.ram_percent === "number") setRamPct(Math.round(stats.ram_percent));
			if (typeof stats.ram_used_gb === "number") setRamUsed(parseFloat(stats.ram_used_gb.toFixed(1)));
			if (typeof stats.ram_total_gb === "number") setRamTotal(parseFloat(stats.ram_total_gb.toFixed(1)));

			if (typeof stats.storage_percent === "number") setDiskPct(Math.round(stats.storage_percent));
			if (typeof stats.storage_used_gb === "number") setDiskUsed(parseFloat(stats.storage_used_gb.toFixed(1)));
			if (typeof stats.storage_total_gb === "number") setDiskTotal(parseFloat(stats.storage_total_gb.toFixed(1)));
			if (stats.storage_unit) setDiskUnit(stats.storage_unit);

			if (typeof stats.battery_percent === "number") setBatteryPct(stats.battery_percent);
			if (typeof stats.is_charging === "boolean") setIsCharging(stats.is_charging);
			if (stats.battery_state) setBatteryState(stats.battery_state);

			if (typeof stats.net_download_speed === "number") {
				const d = stats.net_download_speed;
				setDownSpeedStr(d > 1048576 ? `${(d / 1048576).toFixed(1)} MB/s` : d > 1024 ? `${(d / 1024).toFixed(0)} KB/s` : `${d} B/s`);
			}
			if (typeof stats.net_upload_speed === "number") {
				const u = stats.net_upload_speed;
				setUpSpeedStr(u > 1048576 ? `${(u / 1048576).toFixed(1)} MB/s` : u > 1024 ? `${(u / 1024).toFixed(0)} KB/s` : `${u} B/s`);
			}
		};

		const pollTelemetry = async () => {
			try {
				const stats = await invoke<HardwareStats>("get_hardware_stats").catch(() => null);
				if (stats) {
					applyStats(stats);
				}
			} catch {}
		};

		pollTelemetry();
		const interval = setInterval(pollTelemetry, 1500);
		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, []);

	const vramPct = Math.round((vramUsed / (vramTotal || 1)) * 100);

	return (
		<div className="caelestia-home-panel cperf-tab-root" onClick={(e) => e.stopPropagation()}>
			{/* Top Bar */}
			<CaelestiaTopBar activeTab="perf" onSwitchTab={(t) => onSwitchTab?.(t)} />

			{/* Main Performance Grid (Image 5) */}
			<div className="cperf-linux-layout">
				{/* Top Row: CPU & GPU */}
				<div className="cperf-top-cards">
					{/* CPU Card */}
					<div className="cperf-card-large">
						<div className="cperf-card-header">
							<div className="cperf-icon-box cpu">
								<Cpu size={20} color="#30d158" strokeWidth={2.2} />
							</div>
							<div className="cperf-meta-col">
								<div className="cperf-label-title">CPU</div>
								<div className="cperf-label-sub">{cpuName}</div>
							</div>
							<div className="cperf-badge-pill">{cpuPct}%</div>
						</div>

						<div className="cperf-card-middle">
							<div className="cperf-temp-row">
								<Thermometer size={14} color="rgba(255, 255, 255, 0.45)" />
								<span>{cpuTemp} °C</span>
							</div>
							<div className="cperf-usage-sub">Uso de núcleos</div>
						</div>

						<div className="cperf-progress-track">
							<div
								className="cperf-progress-fill blue"
								style={{ width: `${Math.max(2, Math.min(100, cpuPct))}%` }}
							/>
						</div>
					</div>

					{/* GPU Card */}
					<div className="cperf-card-large">
						<div className="cperf-card-header">
							<div className="cperf-icon-box gpu">
								<Monitor size={20} color="#38bdf8" strokeWidth={2.2} />
							</div>
							<div className="cperf-meta-col">
								<div className="cperf-label-title">GPU</div>
								<div className="cperf-label-sub">{gpuName}</div>
							</div>
							<div className="cperf-badge-pill">{gpuPct}%</div>
						</div>

						<div className="cperf-gpu-dual-block">
							{/* 1. Carga GPU */}
							<div className="cperf-gpu-row">
								<div className="cperf-temp-row">
									<Thermometer size={13} color="rgba(255, 255, 255, 0.45)" />
									<span>{gpuTemp} °C</span>
								</div>
								<div className="cperf-usage-sub">Carga GPU: {gpuPct}%</div>
							</div>
							<div className="cperf-progress-track thin">
								<div
									className="cperf-progress-fill purple"
									style={{ width: `${Math.max(2, Math.min(100, gpuPct))}%` }}
								/>
							</div>

							{/* 2. VRAM */}
							<div className="cperf-gpu-row" style={{ marginTop: 6 }}>
								<div className="cperf-temp-row">
									<span>VRAM {vramUsed} / {vramTotal} GB</span>
								</div>
								<div className="cperf-usage-sub">{vramPct}% VRAM</div>
							</div>
							<div className="cperf-progress-track thin">
								<div
									className="cperf-progress-fill blue"
									style={{ width: `${Math.max(2, Math.min(100, vramPct))}%` }}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Bottom Row: 4 Cards (Disco, Memoria, Red, Batería) */}
				<div className="cperf-bottom-cards">
					{/* 1. Disco */}
					<div className="cperf-card-small">
						<div className="cperf-small-header">
							<HardDrive size={15} color="#007aff" strokeWidth={2.2} />
							<span>Disco</span>
						</div>
						<div className="cperf-small-val">{diskPct}% Usado</div>
						<div className="cperf-small-sub">{diskUsed} / {diskTotal} GB</div>
						<div className="cperf-progress-track small">
							<div
								className="cperf-progress-fill grey"
								style={{ width: `${Math.max(2, Math.min(100, diskPct))}%` }}
							/>
						</div>
						<div className="cperf-small-foot">Unidad: {diskUnit}</div>
					</div>

					{/* 2. Memoria */}
					<div className="cperf-card-small">
						<div className="cperf-small-header">
							<MemoryStick size={15} color="#30d158" strokeWidth={2.2} />
							<span>Memoria</span>
						</div>
						<div className="cperf-small-val">{ramPct}% Usada</div>
						<div className="cperf-small-sub">{ramUsed} / {ramTotal} GB</div>
						<div className="cperf-progress-track small">
							<div
								className="cperf-progress-fill green"
								style={{ width: `${Math.max(2, Math.min(100, ramPct))}%` }}
							/>
						</div>
						<div className="cperf-small-foot">{ramTotal > 0 ? `${Math.round(ramTotal)} GB RAM` : "RAM del sistema"}</div>
					</div>

					{/* 3. Red */}
					<div className="cperf-card-small">
						<div className="cperf-small-header">
							<Wifi size={15} color="#007aff" strokeWidth={2.2} />
							<span>Red</span>
						</div>
						<div className="cperf-small-val net">↓ {downSpeedStr}</div>
						<div className="cperf-small-val net">↑ {upSpeedStr}</div>
						<div className="cperf-small-foot" style={{ marginTop: 10 }}>
							Descarga activa
						</div>
						<div className="cperf-small-foot">
							Subida activa
						</div>
					</div>

					{/* 4. Batería */}
					<div className="cperf-card-small">
						<div className="cperf-small-header">
							{isCharging ? (
								<BatteryCharging size={15} color="#30d158" strokeWidth={2.2} />
							) : (
								<Battery size={15} color="#30d158" strokeWidth={2.2} />
							)}
							<span>Batería</span>
						</div>
						<div className="cperf-small-val">{batteryPct}%</div>
						<div className="cperf-small-sub">{isCharging ? "⚡ Cargando" : "En batería"}</div>
						<div className="cperf-progress-track small">
							<div
								className={`cperf-progress-fill ${batteryPct < 20 ? "red" : isCharging ? "green" : "red"}`}
								style={{ width: `${Math.max(2, Math.min(100, batteryPct))}%` }}
							/>
						</div>
						<div className="cperf-small-foot">{batteryState || "Batería del sistema"}</div>
					</div>
				</div>
			</div>
		</div>
	);
}
