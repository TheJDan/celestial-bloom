import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
	Search,
	AppWindow,
	Lock,
	Moon,
	RotateCcw,
	Power,
	Activity,
	Trash2,
	Terminal,
	Settings,
	Globe,
	Heart,
	LayoutGrid,
	Clapperboard,
	Code,
	Gamepad2,
	Palette,
	FileText,
	LogOut,
	Menu
} from "lucide-react";
import "./SpotlightLauncher.css";

interface AppInfo {
	name: string;
	path?: string;
	icon?: string;
	executable?: string;
	is_running?: boolean;
}

const CATEGORIES = [
	{ id: "favs", label: "Favoritos", icon: <Heart size={14} /> },
	{ id: "all", label: "Todas las aplicaciones", icon: <LayoutGrid size={14} /> },
	{ id: "media", label: "Audio y video", icon: <Clapperboard size={14} /> },
	{ id: "dev", label: "Desarrollo", icon: <Code size={14} /> },
	{ id: "games", label: "Juegos", icon: <Gamepad2 size={14} /> },
	{ id: "graphics", label: "Gráficos", icon: <Palette size={14} /> },
	{ id: "network", label: "Red", icon: <Globe size={14} /> },
	{ id: "office", label: "Ofimática", icon: <FileText size={14} /> },
	{ id: "settings", label: "Configuración", icon: <Settings size={14} /> }
];

const SYSTEM_COMMANDS = [
	{
		id: "sys_lock",
		title: "Bloquear equipo",
		subtitle: "Bloquear la sesión de Windows (Win + L)",
		icon: <Lock size={16} className="text-amber-400" />,
		actionKey: "lock"
	},
	{
		id: "sys_sleep",
		title: "Suspender",
		subtitle: "Poner el sistema en suspensión",
		icon: <Moon size={16} className="text-indigo-400" />,
		actionKey: "sleep"
	},
	{
		id: "sys_taskmgr",
		title: "Administrador de tareas",
		subtitle: "Ver procesos activos y rendimiento",
		icon: <Activity size={16} className="text-emerald-400" />,
		actionKey: "task_manager"
	},
	{
		id: "sys_terminal",
		title: "Terminal",
		subtitle: "Abrir Windows Terminal",
		icon: <Terminal size={16} className="text-cyan-400" />,
		actionKey: "terminal"
	},
	{
		id: "sys_settings",
		title: "Configuración de Windows",
		subtitle: "Preferencias del sistema",
		icon: <Settings size={16} className="text-blue-400" />,
		actionKey: "settings"
	},
	{
		id: "sys_recycle",
		title: "Vaciar papelera",
		subtitle: "Eliminar elementos de la papelera",
		icon: <Trash2 size={16} className="text-rose-400" />,
		actionKey: "recycle_bin"
	},
	{
		id: "sys_restart",
		title: "Reiniciar",
		subtitle: "Reiniciar el equipo",
		icon: <RotateCcw size={16} className="text-orange-400" />,
		actionKey: "restart"
	},
	{
		id: "sys_shutdown",
		title: "Apagar",
		subtitle: "Apagar el equipo por completo",
		icon: <Power size={16} className="text-red-500" />,
		actionKey: "shutdown"
	}
];

function filterAndDeduplicateApps(rawApps: AppInfo[]): AppInfo[] {
	const map = new Map<string, AppInfo>();
	for (const app of rawApps) {
		if (!app.name || app.name.trim() === "" || app.name === "Unknown") continue;
		const nameLower = app.name.toLowerCase().trim();
		const pathLower = (app.path || "").toLowerCase();

		if (
			nameLower.includes("elamigos") ||
			pathLower.includes("elamigos") ||
			nameLower.includes("releases and updates") ||
			nameLower.includes("uninstall") ||
			nameLower.includes("desinstalar") ||
			pathLower.endsWith(".url") ||
			pathLower.endsWith(".website")
		) {
			continue;
		}

		if (!map.has(nameLower)) {
			map.set(nameLower, app);
		}
	}
	return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function matchesCategory(app: AppInfo, categoryId: string, favorites: Set<string>): boolean {
	const n = (app.name || "").toLowerCase();
	const p = (app.path || "").toLowerCase();
	const e = (app.executable || "").toLowerCase();
	const str = `${n} ${p} ${e}`;

	if (categoryId === "favs") {
		return (
			favorites.has(app.name) ||
			str.includes("dolphin") ||
			str.includes("explorer") ||
			str.includes("brave") ||
			str.includes("chrome") ||
			str.includes("code") ||
			str.includes("terminal") ||
			str.includes("spotify")
		);
	}
	if (categoryId === "all") return true;
	if (categoryId === "media") {
		return (
			str.includes("media") ||
			str.includes("music") ||
			str.includes("video") ||
			str.includes("audio") ||
			str.includes("spotify") ||
			str.includes("vlc") ||
			str.includes("mpv") ||
			str.includes("obs") ||
			str.includes("player") ||
			str.includes("camera") ||
			str.includes("stream")
		);
	}
	if (categoryId === "dev") {
		return (
			str.includes("code") ||
			str.includes("studio") ||
			str.includes("terminal") ||
			str.includes("powershell") ||
			str.includes("cmd") ||
			str.includes("git") ||
			str.includes("python") ||
			str.includes("dev") ||
			str.includes("rust") ||
			str.includes("node") ||
			str.includes("intellij") ||
			str.includes("pycharm")
		);
	}
	if (categoryId === "games") {
		return (
			str.includes("game") ||
			str.includes("steam") ||
			str.includes("epic") ||
			str.includes("riot") ||
			str.includes("play") ||
			str.includes("xbox") ||
			str.includes("minecraft")
		);
	}
	if (categoryId === "graphics") {
		return (
			str.includes("paint") ||
			str.includes("photo") ||
			str.includes("figma") ||
			str.includes("blender") ||
			str.includes("gimp") ||
			str.includes("draw") ||
			str.includes("image") ||
			str.includes("adobe")
		);
	}
	if (categoryId === "network") {
		return (
			str.includes("brave") ||
			str.includes("chrome") ||
			str.includes("edge") ||
			str.includes("firefox") ||
			str.includes("browser") ||
			str.includes("discord") ||
			str.includes("telegram") ||
			str.includes("network") ||
			str.includes("wifi")
		);
	}
	if (categoryId === "office") {
		return (
			str.includes("word") ||
			str.includes("excel") ||
			str.includes("office") ||
			str.includes("pdf") ||
			str.includes("doc") ||
			str.includes("notes") ||
			str.includes("notepad") ||
			str.includes("writer") ||
			str.includes("calc")
		);
	}
	if (categoryId === "settings") {
		return (
			str.includes("setting") ||
			str.includes("config") ||
			str.includes("control") ||
			str.includes("panel") ||
			str.includes("tweak")
		);
	}
	return true;
}

export function SpotlightLauncher({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>("favs");
	const [installedApps, setInstalledApps] = useState<AppInfo[]>([]);
	const [appIcons, setAppIcons] = useState<Record<string, string>>({});
	const [favorites] = useState<Set<string>>(() => new Set(["Dolphin", "Brave", "Visual Studio Code"]));
	const pendingIconsRef = useRef<Set<string>>(new Set());
	const inputRef = useRef<HTMLInputElement | null>(null);
	const resultsRef = useRef<HTMLDivElement | null>(null);
	const currentSessionRef = useRef<number>(0);
	const isOpenRef = useRef<boolean>(false);

	useEffect(() => {
		isOpenRef.current = isOpen;
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	const dismissLocally = useCallback(() => {
		setIsOpen(false);
		setQuery("");
	}, []);

	const handleClose = useCallback((restoreFocus: boolean = true) => {
		dismissLocally();
		invoke("close_spotlight", { restoreFocus, session: currentSessionRef.current }).catch(() => {});
	}, [dismissLocally]);

	// Load installed apps
	useEffect(() => {
		invoke<AppInfo[]>("get_installed_apps")
			.then((apps) => {
				if (Array.isArray(apps)) {
					setInstalledApps(filterAndDeduplicateApps(apps));
				}
			})
			.catch(() => {});

		const unlistenToggle = listen<number>("spotlight-toggle", (event) => {
			currentSessionRef.current = event.payload;
			setIsOpen((prev) => !prev);
		});

		const unlistenClose = listen("spotlight-close", () => {
			setIsOpen(false);
			setQuery("");
		});

		return () => {
			unlistenToggle.then((f) => f());
			unlistenClose.then((f) => f());
		};
	}, []);

	// Fetch app icons
	useEffect(() => {
		if (installedApps.length === 0) return;
		const targets = installedApps
			.filter((a): a is AppInfo & { path: string } => Boolean(a.path) && !appIcons[a.path!] && !pendingIconsRef.current.has(a.path!))
			.slice(0, 30);

		if (targets.length === 0) return;

		for (const a of targets) {
			pendingIconsRef.current.add(a.path);
		}

		Promise.all(
			targets.map(async (app) => {
				try {
					const icon = await invoke<string | null>("get_app_icon", {
						path: app.path,
						name: app.name
					});
					return [app.path, icon] as const;
				} catch {
					return [app.path, null] as const;
				}
			})
		).then((pairs) => {
			const batch: Record<string, string> = {};
			for (const [path, icon] of pairs) {
				if (icon && path) batch[path] = icon;
			}
			if (Object.keys(batch).length > 0) {
				setAppIcons((prev) => ({ ...prev, ...batch }));
			}
		});
	}, [installedApps, appIcons]);

	// Focus input when opened
	useEffect(() => {
		if (isOpen) {
			setTimeout(() => {
				inputRef.current?.focus();
			}, 50);
		}
	}, [isOpen]);

	// Filtered apps based on category or search
	const displayedApps = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (q.startsWith(">")) {
			const cmdQ = q.slice(1).trim();
			return SYSTEM_COMMANDS.filter((cmd) => cmd.title.toLowerCase().includes(cmdQ) || cmd.subtitle.toLowerCase().includes(cmdQ));
		}
		if (q) {
			return installedApps.filter((app) => app.name && app.name.toLowerCase().includes(q));
		}
		return installedApps.filter((app) => matchesCategory(app, selectedCategory, favorites));
	}, [query, selectedCategory, installedApps, favorites]);

	const handleLaunchApp = (app: AppInfo) => {
		dismissLocally();
		invoke("open_app", { appName: app.path || app.name, path: app.path, executable: app.executable }).catch(async () => {
			await invoke("spotlight_launch_app", { appName: app.path || app.name }).catch(() => {});
		});
	};

	const handlePowerAction = (action: "logout" | "sleep" | "restart" | "shutdown") => {
		dismissLocally();
		if (action === "logout") {
			invoke("execute_command", { command: "shutdown /l" }).catch(() => {});
		} else if (action === "sleep") {
			invoke("execute_command", { command: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0" }).catch(() => {});
		} else if (action === "restart") {
			invoke("execute_command", { command: "shutdown /r /t 0" }).catch(() => {});
		} else if (action === "shutdown") {
			invoke("execute_command", { command: "shutdown /s /t 0" }).catch(() => {});
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="spotlight-backdrop caelestia-launcher-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
					onClick={() => handleClose(true)}
				>
					<motion.div
						className="caelestia-app-launcher-panel"
						initial={{ scale: 0.95, opacity: 0, y: 30 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.95, opacity: 0, y: 30 }}
						transition={{ type: "spring", damping: 28, stiffness: 420 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Top Section: Sidebar + App Grid (Image 4) */}
						<div className="clauncher-body">
							{/* Categories Sidebar */}
							<div className="clauncher-sidebar">
								{CATEGORIES.map((cat) => {
									const isActive = selectedCategory === cat.id && !query;
									return (
										<button
											key={cat.id}
											type="button"
											className={`clauncher-cat-btn ${isActive ? "active" : ""}`}
											onClick={() => {
												setSelectedCategory(cat.id);
												setQuery("");
											}}
										>
											<span className="clauncher-cat-icon">{cat.icon}</span>
											<span className="clauncher-cat-label">{cat.label}</span>
										</button>
									);
								})}
							</div>

							{/* Apps Grid */}
							<div className="clauncher-grid-wrap" ref={resultsRef}>
								{query.trim().startsWith(">") ? (
									/* Command Execution List */
									<div className="clauncher-cmd-list">
										{(displayedApps as typeof SYSTEM_COMMANDS).map((cmd) => (
											<div
												key={cmd.id}
												className="clauncher-cmd-item"
												onClick={() => {
													dismissLocally();
													invoke("spotlight_launch_command", { action: cmd.actionKey }).catch(() => {});
												}}
											>
												<div className="clauncher-cmd-icon">{cmd.icon}</div>
												<div className="clauncher-cmd-meta">
													<div className="clauncher-cmd-title">{cmd.title}</div>
													<div className="clauncher-cmd-sub">{cmd.subtitle}</div>
												</div>
											</div>
										))}
									</div>
								) : displayedApps.length === 0 ? (
									<div className="clauncher-empty">No se encontraron aplicaciones</div>
								) : (
									<div className="clauncher-tiles-grid">
										{(displayedApps as AppInfo[]).map((app) => {
											const iconSrc = (app.path ? appIcons[app.path] : undefined) || app.icon;
											const isFav = favorites.has(app.name);
											return (
												<div
													key={app.name + (app.path || "")}
													className="clauncher-app-tile"
													onClick={() => handleLaunchApp(app)}
													title={app.name}
												>
													<div className="clauncher-tile-icon-wrap">
														{iconSrc ? (
															<img src={iconSrc} alt="" className="clauncher-tile-img" draggable={false} />
														) : (
															<AppWindow size={32} color="#38bdf8" />
														)}
														{isFav && <span className="clauncher-fav-heart">♥</span>}
													</div>
													<span className="clauncher-tile-name">{app.name}</span>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</div>

						{/* Session / Power Action Buttons (Image 4) */}
						<div className="clauncher-power-row">
							<button
								type="button"
								className="clauncher-power-btn"
								onClick={() => handlePowerAction("logout")}
							>
								<LogOut size={14} />
								<span>Cerrar sesión</span>
							</button>

							<button
								type="button"
								className="clauncher-power-btn"
								onClick={() => handlePowerAction("sleep")}
							>
								<Moon size={14} />
								<span>Suspender</span>
							</button>

							<button
								type="button"
								className="clauncher-power-btn"
								onClick={() => handlePowerAction("restart")}
							>
								<RotateCcw size={14} />
								<span>Reiniciar</span>
							</button>

							<button
								type="button"
								className="clauncher-power-btn"
								onClick={() => handlePowerAction("shutdown")}
							>
								<Power size={14} />
								<span>Apagar</span>
							</button>
						</div>

						{/* Bottom Search Input (Image 4) */}
						<div className="clauncher-search-bar">
							<Search size={16} className="clauncher-search-icon" />
							<input
								ref={inputRef}
								type="text"
								className="clauncher-search-input"
								placeholder='Escribe ">" para ejecutar comandos'
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										e.preventDefault();
										handleClose(true);
									} else if (e.key === "Enter" && displayedApps.length > 0) {
										e.preventDefault();
										const first = displayedApps[0];
										if ("actionKey" in first) {
											dismissLocally();
											invoke("spotlight_launch_command", { action: first.actionKey }).catch(() => {});
										} else {
											handleLaunchApp(first as AppInfo);
										}
									}
								}}
							/>
							<Menu size={16} className="clauncher-menu-icon" />
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
