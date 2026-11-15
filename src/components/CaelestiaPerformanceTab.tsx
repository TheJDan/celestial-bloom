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
	ram_used_gb: number;
	ram_total_gb: number;
	ram_percent: number;
	storage_used_gb?: number;
	storage_total_gb?: number;
	storage_percent?: number;
	net_download_speed?: number;
	net_upload_speed?: number;
}

interface CaelestiaPerformanceTabProps {
	onSwitchTab?: (tab: CaelestiaTabKey) => void;
}

export function CaelestiaPerformanceTab({ onSwitchTab }: CaelestiaPerformanceTabProps) {
	const [cpuPct, setCpuPct] = useState<number>(0);
	const [cpuTemp, setCpuTemp] = useState<number>(50);
	const [cpuName, setCpuName] = useState<string>("Intel Core i7-13700H");

	const [gpuPct, setGpuPct] = useState<number>(6);
	const [gpuTemp, setGpuTemp] = useState<number>(46);
	const [gpuName, setGpuName] = useState<string>("NVIDIA GeForce RTX 4060 Laptop GPU");
	const [vramUsed, setVramUsed] = useState<number>(1.7);
	const [vramTotal, setVramTotal] = useState<number>(8.0);

	const [diskPct, setDiskPct] = useState<number>(70);
	const [diskUsed, setDiskUsed] = useState<number>(666.3);
	const [diskTotal, setDiskTotal] = useState<number>(951.6);
	const [diskUnit, setDiskUnit] = useState<string>("nvme0n1");

	const [ramPct, setRamPct] = useState<number>(35);
	const [ramUsed, setRamUsed] = useState<number>(10.9);
	const [ramTotal, setRamTotal] = useState<number>(31.1);

	const [downSpeedStr, setDownSpeedStr] = useState<string>("0 B/s");
	const [upSpeedStr, setUpSpeedStr] = useState<string>("0 B/s");

	const [batteryPct, setBatteryPct] = useState<number>(76);
	const [isCharging, setIsCharging] = useState<boolean>(false);

	useEffect(() => {
		let isMounted = true;

		const pollTelemetry = async () => {
			try {
				const stats = await invoke<HardwareStats>("get_hardware_stats").catch(() => null);
				if (stats && isMounted) {
					if (typeof stats.cpu_percent === "number") setCpuPct(Math.round(stats.cpu_percent));
					if (typeof stats.cpu_temp === "number" && stats.cpu_temp > 0) setCpuTemp(Math.round(stats.cpu_temp));
					if (stats.cpu_name) setCpuName(stats.cpu_name);

					if (typeof stats.gpu_percent === "number") setGpuPct(Math.round(stats.gpu_percent));
					if (typeof stats.gpu_temp === "number" && stats.gpu_temp > 0) setGpuTemp(Math.round(stats.gpu_temp));
					if (stats.gpu_name) setGpuName(stats.gpu_name);

					if (typeof stats.ram_percent === "number") setRamPct(Math.round(stats.ram_percent));
					if (typeof stats.ram_used_gb === "number") setRamUsed(parseFloat(stats.ram_used_gb.toFixed(1)));
					if (typeof stats.ram_total_gb === "number") setRamTotal(parseFloat(stats.ram_total_gb.toFixed(1)));

					if (typeof stats.storage_percent === "number") setDiskPct(Math.round(stats.storage_percent));
					if (typeof stats.storage_used_gb === "number") setDiskUsed(parseFloat(stats.storage_used_gb.toFixed(1)));
					if (typeof stats.storage_total_gb === "number") setDiskTotal(parseFloat(stats.storage_total_gb.toFixed(1)));

					if (typeof stats.net_download_speed === "number") {
						const d = stats.net_download_speed;
						setDownSpeedStr(d > 1048576 ? `${(d / 1048576).toFixed(1)} MB/s` : d > 1024 ? `${(d / 1024).toFixed(0)} KB/s` : `${d} B/s`);
					}
					if (typeof stats.net_upload_speed === "number") {
						const u = stats.net_upload_speed;
						setUpSpeedStr(u > 1048576 ? `${(u / 1048576).toFixed(1)} MB/s` : u > 1024 ? `${(u / 1024).toFixed(0)} KB/s` : `${u} B/s`);
					}
				} else {
					// Fallback to direct Windows commands
					const c = await invoke<number>("get_cpu_usage").catch(() => null);
					if (typeof c === "number" && isMounted) setCpuPct(c);

					const r = await invoke<number>("get_ram_usage").catch(() => null);
					if (typeof r === "number" && isMounted) setRamPct(Math.round(r));

					const net = await invoke<[number, number]>("get_network_speed").catch(() => null);
					if (net && isMounted) {
						const [up, down] = net;
						setDownSpeedStr(down > 1048576 ? `${(down / 1048576).toFixed(1)} MB/s` : down > 1024 ? `${(down / 1024).toFixed(0)} KB/s` : `${down} B/s`);
						setUpSpeedStr(up > 1048576 ? `${(up / 1048576).toFixed(1)} MB/s` : up > 1024 ? `${(up / 1024).toFixed(0)} KB/s` : `${up} B/s`);
					}

					const bat = await invoke<{ percent?: number; is_charging?: boolean }>("get_battery_state").catch(() => null);
					if (bat && isMounted) {
						if (typeof bat.percent === "number") setBatteryPct(bat.percent);
						if (typeof bat.is_charging === "boolean") setIsCharging(bat.is_charging);
					}
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
						<div className="cperf-small-foot">DDR5 / {Math.round(ramTotal)} GB</div>
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
							Total: ↓ 39.3 GiB
						</div>
						<div className="cperf-small-foot">
							Total: ↑ 3.5 GiB
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
						<div className="cperf-small-foot">Batería de polímero</div>
					</div>
				</div>
			</div>
		</div>
	);
}
