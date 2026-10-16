import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronLeft, RefreshCw, LoaderCircle, Layers } from "lucide-react";
import "./QuickPanel.css";

interface TrayApp {
	name: string;
	path: string;
	tray_ids: string[];
	window_handles: number[];
}

interface SystemTrayPanelProps {
	onBack: () => void;
}

export function SystemTrayPanel({ onBack }: SystemTrayPanelProps) {
	const [apps, setApps] = useState<TrayApp[] | null>(null);
	const [icons, setIcons] = useState<Record<string, string>>({});
	const [refreshing, setRefreshing] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);

	const fetchTrayApps = useCallback(async () => {
		try {
			const list = await invoke<TrayApp[]>("get_tray_apps");
			setApps(list);
			// Fetch icons for each app
			for (const app of list) {
				try {
					const icon = await invoke<string | null>("get_app_icon", {
						path: app.path,
						name: app.name,
						hwnd: app.window_handles[0] ?? null
					});
					if (icon) {
						setIcons((prev) => ({ ...prev, [app.path]: icon }));
					}
				} catch {}
			}
		} catch (e) {
			console.error("Failed to fetch tray apps:", e);
			setApps([]);
		}
	}, []);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		await fetchTrayApps();
		setRefreshing(false);
	}, [fetchTrayApps]);

	useEffect(() => {
		void fetchTrayApps();
	}, [fetchTrayApps]);

	const handleAppClick = useCallback(async (app: TrayApp) => {
		if (app.tray_ids.length === 0) return;
		setBusyId(app.tray_ids[0]);
		try {
			await invoke("activate_tray_icon", { trayId: app.tray_ids[0] });
		} catch (e) {
			console.error("Failed to activate tray icon:", e);
		} finally {
			setBusyId(null);
		}
	}, []);

	const handleContextMenu = useCallback(async (e: React.MouseEvent, app: TrayApp) => {
		e.preventDefault();
		e.stopPropagation();
		if (app.tray_ids.length === 0) return;
		try {
			await invoke("show_tray_context_menu", { trayId: app.tray_ids[0] });
		} catch (e) {
			console.error("Failed to show tray context menu:", e);
		}
	}, []);

	return (
		<div className="qp" onClick={(e) => e.stopPropagation()}>
			<div className="qp-header">
				<button className="qp-icon-btn" onClick={onBack} aria-label="Volver">
					<ChevronLeft />
				</button>
				<span className="qp-title">System Tray</span>
				<button
					className="qp-icon-btn"
					onClick={handleRefresh}
					disabled={refreshing}
					aria-label="Refrescar bandeja"
				>
					<RefreshCw className={refreshing ? "qp-spin" : ""} />
				</button>
			</div>

			<div className="qp-body">
				{apps === null ? (
					<div className="qp-empty">
						<LoaderCircle className="qp-spin" />
					</div>
				) : apps.length === 0 ? (
					<div className="qp-empty">No hay aplicaciones activas en la bandeja</div>
				) : (
					<ul className="qp-list">
						{apps.map((app) => {
							const iconSrc = icons[app.path];
							const isBusy = app.tray_ids[0] && busyId === app.tray_ids[0];
							return (
								<li key={app.path} className="qp-row">
									<button
										className="qp-row-main"
										onClick={() => handleAppClick(app)}
										onContextMenu={(e) => handleContextMenu(e, app)}
										title="Clic izquierdo para abrir, clic derecho para menú de opciones"
									>
										<span className="qp-row-icon" style={{ background: "transparent" }}>
											{iconSrc ? (
												<img
													src={iconSrc}
													alt=""
													style={{ width: 18, height: 18, objectFit: "contain" }}
													draggable={false}
												/>
											) : (
												<Layers style={{ width: 14, height: 14, opacity: 0.7 }} />
											)}
										</span>
										<span className="qp-row-text">
											<span className="qp-row-name">{app.name}</span>
											<span className="qp-row-sub">
												{isBusy ? "Activando…" : "Clic: abrir • Clic derecho: menú"}
											</span>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<button
				className="qp-footer"
				onClick={() => invoke("open_system_tray").catch(() => {})}
			>
				Abrir bandeja clásica de Windows
			</button>
		</div>
	);
}
