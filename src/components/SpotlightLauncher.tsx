import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
	Search,
	Calculator,
	AppWindow,
	Lock,
	Moon,
	RotateCcw,
	Power,
	Activity,
	Trash2,
	Terminal,
	Settings,
	Globe
} from "lucide-react";
import "./SpotlightLauncher.css";

interface AppInfo {
	name: string;
	path?: string;
	icon?: string;
	executable?: string;
	is_running?: boolean;
}

interface SpotlightItem {
	id: string;
	title: string;
	subtitle: string;
	icon: React.ReactNode;
	category: "Apps" | "Calculator" | "System" | "Web";
	action: () => void;
}

const SYSTEM_COMMANDS = [
	{
		id: "sys_lock",
		title: "Lock Computer",
		subtitle: "Lock your Windows workstation (Win + L)",
		icon: <Lock size={17} className="text-amber-400" />,
		actionKey: "lock"
	},
	{
		id: "sys_sleep",
		title: "Sleep",
		subtitle: "Put Windows into sleep mode",
		icon: <Moon size={17} className="text-indigo-400" />,
		actionKey: "sleep"
	},
	{
		id: "sys_taskmgr",
		title: "Task Manager",
		subtitle: "View running processes and performance",
		icon: <Activity size={17} className="text-emerald-400" />,
		actionKey: "task_manager"
	},
	{
		id: "sys_terminal",
		title: "Terminal",
		subtitle: "Launch Windows Terminal",
		icon: <Terminal size={17} className="text-cyan-400" />,
		actionKey: "terminal"
	},
	{
		id: "sys_settings",
		title: "Windows Settings",
		subtitle: "Configure system preferences",
		icon: <Settings size={17} className="text-blue-400" />,
		actionKey: "settings"
	},
	{
		id: "sys_recycle",
		title: "Empty Recycle Bin",
		subtitle: "Permanently delete items in trash",
		icon: <Trash2 size={17} className="text-rose-400" />,
		actionKey: "recycle_bin"
	},
	{
		id: "sys_restart",
		title: "Restart Computer",
		subtitle: "Reboot Windows",
		icon: <RotateCcw size={17} className="text-orange-400" />,
		actionKey: "restart"
	},
	{
		id: "sys_shutdown",
		title: "Shut Down",
		subtitle: "Turn off your computer",
		icon: <Power size={17} className="text-red-500" />,
		actionKey: "shutdown"
	}
];

function getAppDescription(name: string, exec?: string): string {
	const n = name.toLowerCase();
	if (
		n.includes("brave") ||
		n.includes("chrome") ||
		n.includes("firefox") ||
		n.includes("edge") ||
		n.includes("opera") ||
		n.includes("vivaldi") ||
		n.includes("browser")
	) {
		return "Access the Internet";
	}
	if (
		n.includes("code") ||
		n.includes("visual studio") ||
		n.includes("cursor") ||
		n.includes("sublime") ||
		n.includes("notepad")
	) {
		return "Source code editor and development environment";
	}
	if (
		n.includes("terminal") ||
		n.includes("powershell") ||
		n.includes("cmd") ||
		n.includes("bash") ||
		n.includes("wt")
	) {
		return "Command line interface and shell environment";
	}
	if (
		n.includes("spotify") ||
		n.includes("music") ||
		n.includes("tidal") ||
		n.includes("apple music")
	) {
		return "Stream music, podcasts and audio";
	}
	if (
		n.includes("discord") ||
		n.includes("slack") ||
		n.includes("telegram") ||
		n.includes("teams") ||
		n.includes("whatsapp")
	) {
		return "Voice, video and text communication";
	}
	if (
		n.includes("steam") ||
		n.includes("epic") ||
		n.includes("game") ||
		n.includes("battle.net") ||
		n.includes("riot")
	) {
		return "Digital gaming platform and storefront";
	}
	if (
		n.includes("btop") ||
		n.includes("taskmgr") ||
		n.includes("task manager") ||
		n.includes("monitor") ||
		n.includes("resource")
	) {
		return "Resource monitor that shows usage and stats";
	}
	if (n.includes("rename")) {
		return "Rename multiple files and folders";
	}
	if (n.includes("settings") || n.includes("control panel")) {
		return "Configure system settings and preferences";
	}
	if (n.includes("calculator") || n.includes("calc")) {
		return "Perform mathematical calculations";
	}
	if (n.includes("obs") || n.includes("stream")) {
		return "Live streaming and video recording software";
	}
	if (
		n.includes("photoshop") ||
		n.includes("paint") ||
		n.includes("gimp") ||
		n.includes("figma") ||
		n.includes("illustrator")
	) {
		return "Create, edit and manipulate images and vector art";
	}
	if (n.includes("explorer") || n.includes("files")) {
		return "Browse files, folders and local drives";
	}
	if (n.includes("word") || n.includes("docs") || n.includes("writer")) {
		return "Word processor and document editor";
	}
	if (n.includes("excel") || n.includes("sheets")) {
		return "Spreadsheet and data analysis";
	}
	if (exec) {
		const cleanExec = exec.replace(/\\/g, "/").split("/").pop() || exec;
		return `Desktop application • ${cleanExec}`;
	}
	return "Desktop application";
}

function evaluateMath(expr: string): string | null {
	const cleaned = expr.trim();
	if (!cleaned || cleaned.length < 2) return null;
	if (!/[0-9]/.test(cleaned) || !/[+\-*/%^()]/.test(cleaned)) return null;
	if (/[^0-9+\-*/%^().\sMathsqrtsincostanlogpieE]/.test(cleaned)) return null;

	try {
		const safeExpr = cleaned
			.replace(/\^/g, "**")
			.replace(/sqrt\(/g, "Math.sqrt(")
			.replace(/sin\(/g, "Math.sin(")
			.replace(/cos\(/g, "Math.cos(")
			.replace(/tan\(/g, "Math.tan(")
			.replace(/log\(/g, "Math.log10(")
			.replace(/pi/gi, "Math.PI")
			.replace(/e\b/gi, "Math.E");

		// eslint-disable-next-line no-new-func
		const result = Function(`"use strict"; return (${safeExpr})`)();
		if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
			if (Number.isInteger(result)) return result.toString();
			return parseFloat(result.toFixed(6)).toString();
		}
	} catch {
		return null;
	}
	return null;
}

function filterAndDeduplicateApps(rawApps: AppInfo[]): AppInfo[] {
	const map = new Map<string, AppInfo>();
	for (const app of rawApps) {
		if (!app.name || app.name.trim() === "" || app.name === "Unknown") continue;
		const nameLower = app.name.toLowerCase().trim();
		const pathLower = (app.path || "").toLowerCase();

		// Filter out ElAmigos repack junk, web URLs, documents, uninstallers
		if (
			nameLower.includes("elamigos") ||
			pathLower.includes("elamigos") ||
			nameLower.includes("releases and updates") ||
			nameLower.includes("official site") ||
			nameLower.startsWith("==") ||
			nameLower.startsWith("__") ||
			nameLower.includes("uninstall") ||
			nameLower.includes("desinstalar") ||
			pathLower.endsWith(".url") ||
			pathLower.endsWith(".website") ||
			pathLower.endsWith(".html") ||
			pathLower.endsWith(".htm") ||
			pathLower.endsWith(".txt") ||
			pathLower.endsWith(".pdf")
		) {
			continue;
		}

		if (!map.has(nameLower)) {
			map.set(nameLower, app);
		}
	}
	return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function SpotlightLauncher({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [installedApps, setInstalledApps] = useState<AppInfo[]>([]);
	const [appIcons, setAppIcons] = useState<Record<string, string>>({});
	const pendingIconsRef = useRef<Set<string>>(new Set());
	const inputRef = useRef<HTMLInputElement | null>(null);
	const resultsRef = useRef<HTMLDivElement | null>(null);
	const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
	const openedAtRef = useRef<number>(0);
	const isComposingRef = useRef<boolean>(false);
	const graceTimerRef = useRef<number | null>(null);
	const currentSessionRef = useRef<number>(0);
	const isOpenRef = useRef<boolean>(false);

	useEffect(() => {
		isOpenRef.current = isOpen;
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	const dismissLocally = useCallback(() => {
		setIsOpen(false);
		setQuery("");
		setSelectedIndex(0);
		if (graceTimerRef.current !== null) {
			clearTimeout(graceTimerRef.current);
			graceTimerRef.current = null;
		}
	}, []);

	const handleClose = useCallback((restoreFocus: boolean = true) => {
		dismissLocally();
		invoke("close_spotlight", { restoreFocus, session: currentSessionRef.current }).catch(() => {});
	}, [dismissLocally]);

	// Load installed apps
	useEffect(() => {
		const loadApps = () => {
			invoke<AppInfo[]>("get_installed_apps")
				.then((apps) => {
					if (Array.isArray(apps)) {
						setInstalledApps(filterAndDeduplicateApps(apps));
					}
				})
				.catch(() => {});
		};

		loadApps();

		const unlistenApps = listen<AppInfo[]>("installed-apps-update", (event) => {
			if (Array.isArray(event.payload)) {
				setInstalledApps(filterAndDeduplicateApps(event.payload));
			}
		});

		const unlistenUpdated = listen("installed-apps-updated", () => {
			loadApps();
		});

		return () => {
			unlistenApps.then((f) => f());
			unlistenUpdated.then((f) => f());
		};
	}, []);

	// Fetch app icons for visible apps
	useEffect(() => {
		if (installedApps.length === 0) return;
		const trimmed = query.trim();
		if (trimmed.startsWith(">")) return;
		const q = trimmed.toLowerCase();
		const matched = q
			? installedApps.filter((app) => app.name && app.name.toLowerCase().includes(q))
			: installedApps;
		const targets = matched
			.filter((a): a is AppInfo & { path: string } => Boolean(a.path) && !appIcons[a.path!] && !pendingIconsRef.current.has(a.path!))
			.slice(0, 45);

		if (targets.length === 0) return;

		for (const a of targets) {
			pendingIconsRef.current.add(a.path);
		}

		let cancelled = false;
		Promise.all(
			targets.map(async (app) => {
				try {
					const icon = await invoke<string | null>("get_app_icon", {
						path: app.path,
						name: app.name,
					});
					return [app.path, icon] as const;
				} catch {
					return [app.path, null] as const;
				}
			})
		).then((pairs) => {
			if (cancelled) return;
			const batch: Record<string, string> = {};
			for (const [path, icon] of pairs) {
				if (icon && path) batch[path] = icon;
			}
			if (Object.keys(batch).length > 0) {
				setAppIcons((prev) => ({ ...prev, ...batch }));
			}
		});

		return () => {
			cancelled = true;
		};
	}, [installedApps, query, appIcons]);

	// Listen for toggle hotkey
	useEffect(() => {
		const unlistenToggle = listen<number>("spotlight-toggle", (event) => {
			if (graceTimerRef.current !== null) {
				clearTimeout(graceTimerRef.current);
				graceTimerRef.current = null;
			}
			if (typeof event.payload === "number" && event.payload > 0) {
				currentSessionRef.current = event.payload;
				setIsOpen(true);
				requestAnimationFrame(() => {
					inputRef.current?.focus();
				});
				setTimeout(() => {
					inputRef.current?.focus();
				}, 40);
			}
			setQuery("");
			setSelectedIndex(0);
		});

		const unlistenClose = listen("spotlight-close", () => {
			setIsOpen(false);
			setQuery("");
			setSelectedIndex(0);
			if (graceTimerRef.current !== null) {
				clearTimeout(graceTimerRef.current);
				graceTimerRef.current = null;
			}
		});

		return () => {
			unlistenToggle.then((f) => f());
			unlistenClose.then((f) => f());
		};
	}, []);

	// Global Escape, Blur & IME Composition handlers when launcher is open
	useEffect(() => {
		if (!isOpen) return;

		openedAtRef.current = Date.now();

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				handleClose(true); // Esc returns focus to previous app
			}
		};

		const onCompStart = () => {
			isComposingRef.current = true;
		};

		const onCompEnd = () => {
			isComposingRef.current = false;
		};

		const onBlur = () => {
			if (!isOpenRef.current) {
				return;
			}
			if (isComposingRef.current) {
				return;
			}
			const elapsed = Date.now() - openedAtRef.current;
			if (elapsed < 300) {
				if (graceTimerRef.current !== null) {
					clearTimeout(graceTimerRef.current);
				}
				graceTimerRef.current = window.setTimeout(() => {
					if (isOpenRef.current && !document.hasFocus() && !isComposingRef.current) {
						handleClose(false);
					}
				}, 300 - elapsed + 20);
				return;
			}
			// When blurred to an external window, close without stealing focus back
			handleClose(false);
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("blur", onBlur);
		window.addEventListener("compositionstart", onCompStart);
		window.addEventListener("compositionend", onCompEnd);

		return () => {
			if (graceTimerRef.current !== null) {
				clearTimeout(graceTimerRef.current);
				graceTimerRef.current = null;
			}
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("compositionstart", onCompStart);
			window.removeEventListener("compositionend", onCompEnd);
		};
	}, [isOpen, handleClose]);

	// Auto-focus input when opened
	useEffect(() => {
		if (isOpen) {
			const timer1 = setTimeout(() => {
				inputRef.current?.focus();
			}, 30);
			const timer2 = setTimeout(() => {
				inputRef.current?.focus();
			}, 100);
			return () => {
				clearTimeout(timer1);
				clearTimeout(timer2);
			};
		}
	}, [isOpen]);

	// Scroll selected item into view
	useEffect(() => {
		const el = itemRefs.current[selectedIndex];
		if (el) {
			el.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [selectedIndex]);

	// Calculate math result
	const mathResult = useMemo(() => evaluateMath(query), [query]);

	// Filter and assemble spotlight items (Caelestia layout)
	const items = useMemo<SpotlightItem[]>(() => {
		const list: SpotlightItem[] = [];
		const trimmed = query.trim();
		const isCommandMode = trimmed.startsWith(">");
		const q = (isCommandMode ? trimmed.slice(1) : trimmed).trim().toLowerCase();

		// 1. Math Calculation item
		if (!isCommandMode && mathResult !== null) {
			list.push({
				id: "math_res",
				title: `${mathResult}`,
				subtitle: `Calculation result • Enter to copy to clipboard`,
				icon: <Calculator size={18} className="text-emerald-400" />,
				category: "Calculator",
				action: () => {
					writeText(mathResult).catch(() => {});
					handleClose(true);
				}
			});
		}

		// 2. Command Mode (Type ">" for commands)
		if (isCommandMode) {
			const matchedSys = q
				? SYSTEM_COMMANDS.filter(
						(cmd) =>
							cmd.title.toLowerCase().includes(q) ||
							cmd.subtitle.toLowerCase().includes(q)
				  )
				: SYSTEM_COMMANDS;

			for (const cmd of matchedSys) {
				list.push({
					id: cmd.id,
					title: cmd.title,
					subtitle: cmd.subtitle,
					icon: cmd.icon,
					category: "System",
					action: () => {
						dismissLocally();
						invoke("spotlight_launch_command", { action: cmd.actionKey }).catch(() => {});
					}
				});
			}
			return list;
		}

		// 3. Regular Mode: Apps List (all sorted if !q, or filtered by q)
		const matchedApps = q
			? installedApps.filter((app) => app.name && app.name.toLowerCase().includes(q))
			: installedApps;

		for (const app of matchedApps) {
			const iconSrc = (app.path ? appIcons[app.path] : undefined) || app.icon;
			list.push({
				id: `app_${app.name}`,
				title: app.name,
				subtitle: getAppDescription(app.name, app.executable || app.path),
				icon: iconSrc ? (
					<img src={iconSrc} alt="" className="w-6 h-6 rounded-md object-contain" />
				) : (
					<AppWindow size={18} className="text-blue-400" />
				),
				category: "Apps",
				action: () => {
					dismissLocally();
					invoke("spotlight_launch_app", { appName: app.path || app.name }).catch(() => {});
				}
			});
		}

		// Match system commands in regular search too if query matches
		if (q) {
			const matchedSys = SYSTEM_COMMANDS.filter(
				(cmd) =>
					cmd.title.toLowerCase().includes(q) ||
					cmd.subtitle.toLowerCase().includes(q) ||
					(q.includes("lock") || q.includes("bloque") ? cmd.id === "sys_lock" : false)
			);
			for (const cmd of matchedSys) {
				list.push({
					id: cmd.id,
					title: cmd.title,
					subtitle: cmd.subtitle,
					icon: cmd.icon,
					category: "System",
					action: () => {
						dismissLocally();
						invoke("spotlight_launch_command", { action: cmd.actionKey }).catch(() => {});
					}
				});
			}
		}

		// 4. Web Search fallback when user types something not matched
		if (q && list.length === 0) {
			list.push({
				id: "web_search",
				title: `Search Google for "${trimmed}"`,
				subtitle: "Open search results in your default browser",
				icon: <Globe size={18} className="text-amber-400" />,
				category: "Web",
				action: () => {
					const url = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
					dismissLocally();
					invoke("spotlight_launch_url", { url }).catch(() => {});
				}
			});
		}

		return list;
	}, [query, mathResult, installedApps, handleClose, dismissLocally, appIcons]);

	// Clamp selectedIndex
	useEffect(() => {
		if (selectedIndex >= items.length) {
			setSelectedIndex(Math.max(0, items.length - 1));
		}
	}, [items, selectedIndex]);

	// Keyboard controls
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			handleClose(true);
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (items[selectedIndex]) {
				items[selectedIndex].action();
			}
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="spotlight-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.16 }}
					onClick={() => handleClose(true)}
				>
					<motion.div
						className="spotlight-panel"
						initial={{ scale: 0.96, opacity: 0, y: 24 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.96, opacity: 0, y: 20 }}
						transition={{ type: "spring", damping: 30, stiffness: 450 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* App / Command Results List (Top) */}
						<div className="spotlight-results" ref={resultsRef}>
							{items.length === 0 ? (
								<div className="spotlight-empty">No matching applications or commands</div>
							) : (
								items.map((item, index) => {
									const isSelected = index === selectedIndex;
									return (
										<div
											key={item.id}
											ref={(el) => {
												itemRefs.current[index] = el;
											}}
											className={`spotlight-item ${isSelected ? "selected" : ""}`}
											onClick={() => item.action()}
											onMouseEnter={() => setSelectedIndex(index)}
										>
											<div className="spotlight-item-icon">{item.icon}</div>
											<div className="spotlight-item-content">
												<div className="spotlight-item-title">{item.title}</div>
												<div className="spotlight-item-subtitle">{item.subtitle}</div>
											</div>
										</div>
									);
								})
							)}
						</div>

						{/* Search Input Bar (Bottom - Caelestia Hyprland replica) */}
						<div className="spotlight-input-wrapper caelestia-search-bar">
							<Search size={16} className="spotlight-search-icon" />
							<input
								ref={inputRef}
								type="text"
								className="spotlight-input"
								placeholder='Type ">" for commands'
								value={query}
								onChange={(e) => {
									setQuery(e.target.value);
									setSelectedIndex(0);
								}}
								onKeyDown={handleKeyDown}
								autoFocus
							/>
							{query && (
								<button
									className="spotlight-clear-btn"
									onClick={() => {
										setQuery("");
										setSelectedIndex(0);
										inputRef.current?.focus();
									}}
								>
									✕
								</button>
							)}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
