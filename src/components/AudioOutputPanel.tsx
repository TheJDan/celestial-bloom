import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronLeft, Check, Headphones, Volume2, RefreshCw, LoaderCircle } from "lucide-react";
import "./QuickPanel.css";

interface AudioOutputDevice {
	id: string;
	name: string;
	is_default: boolean;
}

interface AudioOutputPanelProps {
	onBack: () => void;
}

export function AudioOutputPanel({ onBack }: AudioOutputPanelProps) {
	const [devices, setDevices] = useState<AudioOutputDevice[] | null>(null);
	const [switching, setSwitching] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);

	const fetchDevices = useCallback(async () => {
		try {
			const list = await invoke<AudioOutputDevice[]>("get_audio_output_devices");
			setDevices(list);
		} catch (e) {
			console.error("Failed to fetch audio output devices:", e);
			setDevices([]);
		}
	}, []);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		await fetchDevices();
		setRefreshing(false);
	}, [fetchDevices]);

	useEffect(() => {
		void fetchDevices();
	}, [fetchDevices]);

	const selectDevice = useCallback(
		async (device: AudioOutputDevice) => {
			if (device.is_default || switching) return;
			setSwitching(device.id);
			try {
				await invoke("set_default_audio_device", { deviceId: device.id });
				setDevices((prev) =>
					prev
						? prev.map((d) => ({
								...d,
								is_default: d.id === device.id
						  }))
						: null
				);
			} catch (e) {
				console.error("Failed to set default audio device:", e);
			} finally {
				setSwitching(null);
			}
		},
		[switching]
	);

	const isHeadphones = (name: string) => {
		const lower = name.toLowerCase();
		return (
			lower.includes("headphone") ||
			lower.includes("auricular") ||
			lower.includes("headset") ||
			lower.includes("earphone") ||
			lower.includes("airpods") ||
			lower.includes("buds")
		);
	};

	return (
		<div className="qp" onClick={(e) => e.stopPropagation()}>
			<div className="qp-header">
				<button className="qp-icon-btn" onClick={onBack} aria-label="Volver">
					<ChevronLeft />
				</button>
				<span className="qp-title">Audio Output</span>
				<button
					className="qp-icon-btn"
					onClick={handleRefresh}
					disabled={refreshing}
					aria-label="Refrescar dispositivos"
				>
					<RefreshCw className={refreshing ? "qp-spin" : ""} />
				</button>
			</div>

			<div className="qp-body">
				{devices === null ? (
					<div className="qp-empty">
						<LoaderCircle className="qp-spin" />
					</div>
				) : devices.length === 0 ? (
					<div className="qp-empty">No se encontraron dispositivos de salida</div>
				) : (
					<ul className="qp-list">
						{devices.map((device) => {
							const headphones = isHeadphones(device.name);
							return (
								<li
									key={device.id}
									className={`qp-row ${device.is_default ? "active" : ""}`}
								>
									<button
										className="qp-row-main"
										onClick={() => selectDevice(device)}
										disabled={switching !== null}
									>
										<span className="qp-row-icon">
											{headphones ? <Headphones /> : <Volume2 />}
										</span>
										<span className="qp-row-text">
											<span className="qp-row-name">{device.name}</span>
											<span className="qp-row-sub">
												{device.is_default ? "Predeterminado" : "Clic para cambiar"}
											</span>
										</span>
										{switching === device.id ? (
											<LoaderCircle className="qp-spin" style={{ width: 14, height: 14 }} />
										) : device.is_default ? (
											<Check style={{ width: 15, height: 15, opacity: 0.9 }} />
										) : null}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<button
				className="qp-footer"
				onClick={() => invoke("open_sound_settings").catch(() => {})}
			>
				Configuración de sonido de Windows
			</button>
		</div>
	);
}
