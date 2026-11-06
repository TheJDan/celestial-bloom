import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronLeft, RefreshCw, LoaderCircle, Layers, MoreHorizontal, X } from "lucide-react";
import "./QuickPanel.css";

interface TrayApp {
	name: string;
	path: string;
	tray_ids: string[];
	window_handles: number[];
}

interface SystemTrayPanelProps {
	onBack: () => void;
	onPinChange?: (pinned: boolean) => void;
}

export function SystemTrayPanel({ onBack, onPinChange }: SystemTrayPanelProps) {
	const [apps, setApps] = useState<TrayApp[] | null>(null);
	const [icons, setIcons] = useState<Record<string, string>>({});
	const [refreshing, setRefreshing] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [closingPaths, setClosingPaths] = useState<Set<string>>(new Set());

	// Pin the notch while this panel is open so tray interactions or focus shifts don't collapse Bloom
	useEffect(() => {
		onPinChange?.(true);
		return () => {
			onPinChange?.(false);
		};
	}, [onPinChange]);

	const handleBack = useCallback(() => {
		onPinChange?.(false);
		onBack();
	}, [onBack, onPinChange]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleBack();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleBack]);

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
		// If the app has an existing window, focus it first
		if (app.window_handles && app.window_handles.length > 0) {
			try {
				await invoke("focus_window", { hwnd: app.window_handles[0] });
				return;
			} catch (e) {
				console.warn("Failed to focus window, trying tray activation:", e);
			}
		}
		if (!app.tray_ids || app.tray_ids.length === 0) return;
		setBusyId(app.tray_ids[0]);
		try {
			for (const id of app.tray_ids) {
				try {
					await invoke("activate_tray_icon", { trayId: id });
					return;
				} catch (err) {
					// try next tray id
				}
			}
		} catch (e) {
			console.error("Failed to activate tray icon:", e);
		} finally {
			setBusyId(null);
		}
	}, []);

	const handleContextMenu = useCallback(async (e: React.MouseEvent, app: TrayApp) => {
		e.preventDefault();
		e.stopPropagation();
		if (!app.tray_ids || app.tray_ids.length === 0) return;
		let lastError = null;
		for (const id of app.tray_ids) {
			try {
				await invoke("show_tray_context_menu", { trayId: id });
				return;
			} catch (e) {
				lastError = e;
			}
		}
		if (lastError) {
			console.error("Failed to show tray context menu:", lastError);
		}
	}, []);

	const handleEndTask = useCallback(async (e: React.MouseEvent, app: TrayApp) => {
		e.preventDefault();
		e.stopPropagation();
		setClosingPaths((prev) => new Set(prev).add(app.path));
		try {
			await invoke("end_task", {
				hwnd: app.window_handles[0] ?? null,
				path: app.path
			});
			// Optimistically remove from state
			setApps((prev) => (prev ? prev.filter((a) => a.path !== app.path) : []));
		} catch (err) {
			console.error("Failed to end task:", err);
			// Refresh list in case process couldn't be closed
			void fetchTrayApps();
		} finally {
			setClosingPaths((prev) => {
				const next = new Set(prev);
				next.delete(app.path);
				return next;
			});
		}
	}, [fetchTrayApps]);

	return (
		<div className="qp" onClick={(e) => e.stopPropagation()}>
			<div className="qp-header">
				<button className="qp-icon-btn" onClick={handleBack} aria-label="Volver">
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
							const isClosing = closingPaths.has(app.path);
							return (
								<li key={app.path} className="qp-row qp-row-tray">
									<button
										type="button"
										className="qp-row-main"
										onClick={() => handleAppClick(app)}
										onContextMenu={(e) => handleContextMenu(e, app)}
										title="Clic para abrir/enfocar • Clic derecho para menú"
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
												{isClosing
													? "Cerrando proceso…"
													: isBusy
													? "Activando…"
													: "En segundo plano"}
											</span>
										</span>
									</button>
									<div className="qp-row-side-actions">
										{app.tray_ids.length > 0 && (
											<button
												type="button"
												className="qp-action-btn"
												onClick={(e) => handleContextMenu(e, app)}
												title="Menú contextual"
												aria-label="Menú contextual"
											>
												<MoreHorizontal size={13} />
											</button>
										)}
										<button
											type="button"
											className="qp-action-btn qp-close-btn"
											onClick={(e) => handleEndTask(e, app)}
											disabled={isClosing}
											title="Cerrar / Finalizar tarea"
											aria-label="Cerrar / Finalizar tarea"
										>
											{isClosing ? <LoaderCircle className="qp-spin" size={13} /> : <X size={13} />}
										</button>
									</div>
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
