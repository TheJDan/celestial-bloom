import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { X, AppWindow } from "lucide-react";
import "./ExposeGrid.css";

interface WindowItem {
	hwnd: number;
	title: string;
	app_name: string;
	icon: string | null;
	thumbnail: string | null;
}

export function ExposeGrid({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
	const [isOpen, setIsOpen] = useState(false);
	const [windows, setWindows] = useState<WindowItem[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);

	useEffect(() => {
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	const handleClose = useCallback(() => {
		setIsOpen(false);
		setSelectedIndex(0);
		invoke("close_expose").catch(() => {});
	}, []);

	const loadWindows = useCallback(async () => {
		try {
			const list = await invoke<WindowItem[]>("get_alt_tab_windows");
			if (Array.isArray(list)) {
				setWindows(list);
			}
		} catch (e) {
			console.error("Failed to load windows for Exposé:", e);
		}
	}, []);

	useEffect(() => {
		const unlistenToggle = listen<boolean | undefined>("expose-toggle", async (event) => {
			if (typeof event.payload === "boolean") {
				if (event.payload) {
					await loadWindows();
					setIsOpen(true);
					setSelectedIndex(0);
				} else {
					handleClose();
				}
			} else {
				setIsOpen((prev) => {
					if (!prev) {
						loadWindows();
						setSelectedIndex(0);
						return true;
					} else {
						handleClose();
						return false;
					}
				});
			}
		});

		const unlistenClose = listen("expose-close", () => {
			handleClose();
		});

		return () => {
			unlistenToggle.then((f) => f());
			unlistenClose.then((f) => f());
		};
	}, [handleClose, loadWindows]);

	const handleSelectWindow = (hwnd: number) => {
		invoke("switch_to_window", { hwnd }).catch(() => {});
		handleClose();
	};

	const handleCloseWindow = (e: React.MouseEvent, hwnd: number) => {
		e.stopPropagation();
		invoke("close_window", { hwnd }).catch(() => {});
		setWindows((prev) => prev.filter((w) => w.hwnd !== hwnd));
	};

	// Keyboard navigation
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" || e.key === "F3") {
				e.preventDefault();
				handleClose();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev + 1) % Math.max(1, windows.length));
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev - 1 + windows.length) % Math.max(1, windows.length));
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (windows[selectedIndex]) {
					handleSelectWindow(windows[selectedIndex].hwnd);
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, windows, selectedIndex, handleClose]);

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="expose-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					onClick={handleClose}
				>
					{/* Header bar */}
					<div className="expose-header" onClick={(e) => e.stopPropagation()}>
						<div className="expose-header-title">Mission Control</div>
						<div className="expose-header-count">
							{windows.length} {windows.length === 1 ? "window" : "windows"} open
						</div>
					</div>

					{/* Windows Grid */}
					<div className="expose-grid" onClick={(e) => e.stopPropagation()}>
						{windows.map((win, index) => {
							const isSelected = index === selectedIndex;
							return (
								<motion.div
									key={win.hwnd}
									className={`expose-card ${isSelected ? "selected" : ""}`}
									initial={{ scale: 0.88, opacity: 0, y: 30 }}
									animate={{ scale: 1, opacity: 1, y: 0 }}
									exit={{ scale: 0.88, opacity: 0, y: 30 }}
									transition={{
										type: "spring",
										damping: 25,
										stiffness: 350,
										delay: index * 0.02
									}}
									onClick={() => handleSelectWindow(win.hwnd)}
									onMouseEnter={() => setSelectedIndex(index)}
								>
									{/* Window Titlebar */}
									<div className="expose-card-header">
										<div className="expose-card-app">
											{win.icon ? (
												<img src={win.icon} alt="" className="expose-app-icon" />
											) : (
												<AppWindow size={16} className="text-white/70" />
											)}
											<span className="expose-app-name">{win.app_name || win.title}</span>
										</div>
										<button
											className="expose-card-close"
											onClick={(e) => handleCloseWindow(e, win.hwnd)}
											title="Close window"
										>
											<X size={13} />
										</button>
									</div>

									{/* Thumbnail Preview Area */}
									<div className="expose-card-preview">
										{win.thumbnail ? (
											<img
												src={win.thumbnail}
												alt={win.title}
												className="expose-thumbnail-img"
											/>
										) : (
											<div className="expose-fallback-preview">
												{win.icon ? (
													<img src={win.icon} alt="" className="w-16 h-16 opacity-40 object-contain" />
												) : (
													<AppWindow size={48} className="text-white/20" />
												)}
												<span className="expose-fallback-title">{win.title}</span>
											</div>
										)}
									</div>
								</motion.div>
							);
						})}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
