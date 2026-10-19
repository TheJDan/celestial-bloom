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
	Globe,
	ArrowRight
} from "lucide-react";
import "./SpotlightLauncher.css";

interface AppInfo {
	name: string;
	path?: string;
	icon?: string;
	exec?: string;
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
		icon: <Lock size={18} className="text-amber-400" />,
		actionKey: "lock"
	},
	{
		id: "sys_sleep",
		title: "Sleep",
		subtitle: "Put Windows into sleep mode",
		icon: <Moon size={18} className="text-indigo-400" />,
		actionKey: "sleep"
	},
	{
		id: "sys_taskmgr",
		title: "Task Manager",
		subtitle: "View running processes and performance",
		icon: <Activity size={18} className="text-emerald-400" />,
		actionKey: "task_manager"
	},
	{
		id: "sys_terminal",
		title: "Terminal",
		subtitle: "Launch Windows Terminal",
		icon: <Terminal size={18} className="text-cyan-400" />,
		actionKey: "terminal"
	},
	{
		id: "sys_settings",
		title: "Windows Settings",
		subtitle: "Configure system preferences",
		icon: <Settings size={18} className="text-blue-400" />,
		actionKey: "settings"
	},
	{
		id: "sys_recycle",
		title: "Empty Recycle Bin",
		subtitle: "Permanently delete items in trash",
		icon: <Trash2 size={18} className="text-rose-400" />,
		actionKey: "recycle_bin"
	},
	{
		id: "sys_restart",
		title: "Restart Computer",
		subtitle: "Reboot Windows",
		icon: <RotateCcw size={18} className="text-orange-400" />,
		actionKey: "restart"
	},
	{
		id: "sys_shutdown",
		title: "Shut Down",
		subtitle: "Turn off your computer",
		icon: <Power size={18} className="text-red-500" />,
		actionKey: "shutdown"
	}
];

function evaluateMath(expr: string): string | null {
	const cleaned = expr.trim();
	if (!cleaned || cleaned.length < 2) return null;
	// Only evaluate if it contains digits and math operators
	if (!/[0-9]/.test(cleaned) || !/[+\-*/%^()]/.test(cleaned)) return null;
	// Disallow dangerous syntax
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
			// Format cleanly
			if (Number.isInteger(result)) return result.toString();
			return parseFloat(result.toFixed(6)).toString();
		}
	} catch {
		return null;
	}
	return null;
}

export function SpotlightLauncher({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [installedApps, setInstalledApps] = useState<AppInfo[]>([]);
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	const handleClose = useCallback(() => {
		setIsOpen(false);
		setQuery("");
		setSelectedIndex(0);
		invoke("close_spotlight").catch(() => {});
	}, []);

	// Load installed apps once
	useEffect(() => {
		invoke<AppInfo[]>("get_active_windows")
			.then((apps) => {
				if (Array.isArray(apps)) setInstalledApps(apps);
			})
			.catch(() => {});

		const unlistenApps = listen<AppInfo[]>("installed-apps-update", (event) => {
			if (Array.isArray(event.payload)) {
				setInstalledApps(event.payload);
			}
		});

		return () => {
			unlistenApps.then((f) => f());
		};
	}, []);

	// Listen for toggle hotkey
	useEffect(() => {
		const unlistenToggle = listen<boolean | undefined>("spotlight-toggle", (event) => {
			if (typeof event.payload === "boolean") {
				setIsOpen(event.payload);
			} else {
				setIsOpen((prev) => !prev);
			}
			setQuery("");
			setSelectedIndex(0);
		});

		const unlistenClose = listen("spotlight-close", () => {
			handleClose();
		});

		return () => {
			unlistenToggle.then((f) => f());
			unlistenClose.then((f) => f());
		};
	}, [handleClose]);

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

	// Calculate math result
	const mathResult = useMemo(() => evaluateMath(query), [query]);

	// Filter and assemble spotlight items
	const items = useMemo<SpotlightItem[]>(() => {
		const list: SpotlightItem[] = [];
		const q = query.trim().toLowerCase();

		// 1. Math Calculation item if applicable
		if (mathResult !== null) {
			list.push({
				id: "math_res",
				title: `${mathResult}`,
				subtitle: `Calculation result • Enter to copy to clipboard`,
				icon: <Calculator size={18} className="text-emerald-400" />,
				category: "Calculator",
				action: () => {
					writeText(mathResult).catch(() => {});
					handleClose();
				}
			});
		}

		// 2. Filter Apps
		if (q) {
			const matchedApps = installedApps.filter(
				(app) => app.name && app.name.toLowerCase().includes(q)
			);
			for (const app of matchedApps.slice(0, 6)) {
				list.push({
					id: `app_${app.name}`,
					title: app.name,
					subtitle: "Application",
					icon: app.icon ? (
						<img src={app.icon} alt="" className="w-5 h-5 rounded-sm object-contain" />
					) : (
						<AppWindow size={18} className="text-blue-400" />
					),
					category: "Apps",
					action: () => {
						invoke("open_app", { name: app.name, path: app.path || app.exec || "" }).catch(() => {});
						handleClose();
					}
				});
			}
		}

		// 3. System Commands
		const matchedSys = q
			? SYSTEM_COMMANDS.filter(
					(cmd) =>
						cmd.title.toLowerCase().includes(q) ||
						cmd.subtitle.toLowerCase().includes(q)
			  )
			: SYSTEM_COMMANDS;

		for (const cmd of matchedSys.slice(0, q ? 5 : 4)) {
			list.push({
				id: cmd.id,
				title: cmd.title,
				subtitle: cmd.subtitle,
				icon: cmd.icon,
				category: "System",
				action: () => {
					invoke("execute_system_command", { action: cmd.actionKey }).catch(() => {});
					handleClose();
				}
			});
		}

		// 4. Web Search fallback
		if (q) {
			list.push({
				id: "web_search",
				title: `Search Google for "${query}"`,
				subtitle: "Open search results in your default browser",
				icon: <Globe size={18} className="text-amber-400" />,
				category: "Web",
				action: () => {
					const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
					invoke("shelf_open", { path: url }).catch(() => {});
					handleClose();
				}
			});
		}

		return list;
	}, [query, mathResult, installedApps, handleClose]);

	// Clamp selectedIndex when items change
	useEffect(() => {
		if (selectedIndex >= items.length) {
			setSelectedIndex(Math.max(0, items.length - 1));
		}
	}, [items, selectedIndex]);

	// Keyboard controls
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			handleClose();
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
					transition={{ duration: 0.15 }}
					onClick={handleClose}
				>
					<motion.div
						className="spotlight-panel"
						initial={{ scale: 0.94, opacity: 0, y: -20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.94, opacity: 0, y: -20 }}
						transition={{ type: "spring", damping: 28, stiffness: 420 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Search Input Bar */}
						<div className="spotlight-input-wrapper">
							<Search size={22} className="spotlight-search-icon" />
							<input
								ref={inputRef}
								type="text"
								className="spotlight-input"
								placeholder="Search apps, calculate, or type a command..."
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

						{/* Results List */}
						<div className="spotlight-results">
							{items.length === 0 ? (
								<div className="spotlight-empty">No matching results found</div>
							) : (
								items.map((item, index) => {
									const isSelected = index === selectedIndex;
									return (
										<div
											key={item.id}
											className={`spotlight-item ${isSelected ? "selected" : ""}`}
											onClick={() => item.action()}
											onMouseEnter={() => setSelectedIndex(index)}
										>
											<div className="spotlight-item-icon">{item.icon}</div>
											<div className="spotlight-item-content">
												<div className="spotlight-item-title">{item.title}</div>
												<div className="spotlight-item-subtitle">{item.subtitle}</div>
											</div>
											{isSelected && (
												<div className="spotlight-enter-badge">
													<span>Open</span>
													<ArrowRight size={13} />
												</div>
											)}
										</div>
									);
								})
							)}
						</div>

						{/* Footer */}
						<div className="spotlight-footer">
							<div className="spotlight-footer-hint">
								<kbd>↑</kbd> <kbd>↓</kbd> <span>Navigate</span>
							</div>
							<div className="spotlight-footer-hint">
								<kbd>↵</kbd> <span>Open</span>
							</div>
							<div className="spotlight-footer-hint">
								<kbd>esc</kbd> <span>Close</span>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
