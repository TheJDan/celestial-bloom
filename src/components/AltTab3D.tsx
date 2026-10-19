import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { AppWindow, Move3d } from "lucide-react";
import "./AltTab3D.css";

export interface AltTabItem {
	hwnd: number;
	title: string;
	app_name: string;
	path: string;
	icon: string | null;
	thumbnail: string | null;
	is_minimized: boolean;
}

interface AltTab3DProps {
	onOpenChange?: (open: boolean) => void;
}

export function AltTab3D({ onOpenChange }: AltTab3DProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isStickyMode, setIsStickyMode] = useState(false);
	const [windows, setWindows] = useState<AltTabItem[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [iconMap, setIconMap] = useState<Record<number, string>>({});

	// 3D rotation states for mouse movement & free drag
	const [hoverRot, setHoverRot] = useState({ x: 0, y: 0 });
	const [dragRot, setDragRot] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);

	const isDraggingRef = useRef(false);
	const isPointerDownRef = useRef(false);
	const hasDraggedRef = useRef(false);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const lastPosRef = useRef({ x: 0, y: 0 });
	const dragRotRef = useRef({ x: 0, y: 0 });
	const lastWheelTimeRef = useRef(0);

	const windowsRef = useRef<AltTabItem[]>([]);
	windowsRef.current = windows;

	const selectedIndexRef = useRef(0);
	selectedIndexRef.current = selectedIndex;

	const isOpenRef = useRef(false);
	isOpenRef.current = isOpen;

	const isStickyModeRef = useRef(false);
	isStickyModeRef.current = isStickyMode;
	const isOpeningRef = useRef(false);
	const pendingCommitRef = useRef(false);
	const pendingStepsRef = useRef(0);

	// Notify parent whenever open state changes
	useEffect(() => {
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	// Fetch icons for items that lack them
	useEffect(() => {
		if (!isOpen || windows.length === 0) return;

		windows.forEach((win) => {
			if (!win.icon && !iconMap[win.hwnd]) {
				invoke<string | null>("get_app_icon", {
					path: win.path,
					name: win.app_name,
					hwnd: win.hwnd
				})
					.then((data) => {
						if (data) {
							setIconMap((prev) => ({ ...prev, [win.hwnd]: data }));
						}
					})
					.catch(() => {});
			}
		});
	}, [isOpen, windows, iconMap]);

	const commitSelection = useCallback(async (index?: number) => {
		isOpeningRef.current = false;
		isOpenRef.current = false;
		pendingCommitRef.current = false;
		pendingStepsRef.current = 0;
		const targetIndex = index !== undefined ? index : selectedIndexRef.current;
		const target = windowsRef.current[targetIndex];

		// Optimistically update cached MRU order: the target window is now index 0!
		if (target && windowsRef.current.length > 1 && targetIndex !== 0) {
			const updated = [...windowsRef.current];
			updated.splice(targetIndex, 1);
			updated.unshift(target);
			windowsRef.current = updated;
			setWindows(updated);
		}

		setIsOpen(false);
		onOpenChange?.(false);
		setIsStickyMode(false);
		isStickyModeRef.current = false;
		setHoverRot({ x: 0, y: 0 });
		setDragRot({ x: 0, y: 0 });
		dragRotRef.current = { x: 0, y: 0 };
		isDraggingRef.current = false;
		isPointerDownRef.current = false;
		hasDraggedRef.current = false;
		setIsDragging(false);

		if (target) {
			try {
				await invoke("switch_to_window", { hwnd: target.hwnd });
			} catch (e) {
				console.error("switch_to_window error:", e);
			}
		} else {
			await invoke("cancel_alt_tab").catch(() => {});
		}
	}, [onOpenChange]);

	const cancelSelection = useCallback(async () => {
		isOpeningRef.current = false;
		isOpenRef.current = false;
		pendingCommitRef.current = false;
		pendingStepsRef.current = 0;
		setIsOpen(false);
		onOpenChange?.(false);
		setIsStickyMode(false);
		isStickyModeRef.current = false;
		setHoverRot({ x: 0, y: 0 });
		setDragRot({ x: 0, y: 0 });
		dragRotRef.current = { x: 0, y: 0 };
		isDraggingRef.current = false;
		isPointerDownRef.current = false;
		hasDraggedRef.current = false;
		setIsDragging(false);
		await invoke("cancel_alt_tab").catch(() => {});
	}, [onOpenChange]);

	// Setup Tauri event listeners for Alt+Tab and Win+Tab hooks
	useEffect(() => {
		let unlistenOpen: (() => void) | undefined;
		let unlistenWinTabOpen: (() => void) | undefined;
		let unlistenStep: (() => void) | undefined;
		let unlistenCommit: (() => void) | undefined;
		let unlistenCancel: (() => void) | undefined;

		// Pre-warm the window list so opening Alt+Tab is instantaneous (0 ms lag)
		invoke<AltTabItem[]>("get_alt_tab_windows")
			.then((list) => {
				if (list && list.length > 0) {
					windowsRef.current = list;
					setWindows(list);
				}
			})
			.catch(() => {});

		const setup = async () => {
			unlistenOpen = await listen<number>("alt-tab-open", async (event) => {
				const dir = event.payload || 1;
				isOpenRef.current = true;
				isOpeningRef.current = true;
				pendingCommitRef.current = false;
				pendingStepsRef.current = 0;

				// Instant 0ms visual feedback if cached windows exist
				if (windowsRef.current.length > 0) {
					const count = windowsRef.current.length;
					const baseInitial = dir > 0 ? (count > 1 ? 1 : 0) : (count > 1 ? count - 1 : 0);
					selectedIndexRef.current = baseInitial;
					setSelectedIndex(baseInitial);
				}

				setIsOpen(true);
				onOpenChange?.(true);
				try {
					const list = await invoke<AltTabItem[]>("get_alt_tab_windows");
					if (!list || list.length === 0) {
						isOpeningRef.current = false;
						isOpenRef.current = false;
						pendingCommitRef.current = false;
						await invoke("cancel_alt_tab").catch(() => {});
						return;
					}

					// If user already released Alt before get_alt_tab_windows finished:
					if (pendingCommitRef.current || !isOpenRef.current) {
						isOpeningRef.current = false;
						pendingCommitRef.current = false;
						windowsRef.current = list;
						setWindows(list);
						await commitSelection(selectedIndexRef.current);
						return;
					}

					// Smoothly update windows list and preserve selected window by HWND
					const prevSelected = windowsRef.current[selectedIndexRef.current];
					windowsRef.current = list;
					setWindows(list);

					if (prevSelected) {
						const foundIdx = list.findIndex((w) => w.hwnd === prevSelected.hwnd);
						if (foundIdx !== -1) {
							selectedIndexRef.current = foundIdx;
							setSelectedIndex(foundIdx);
						} else {
							const count = list.length;
							const clamped = Math.min(selectedIndexRef.current, count - 1);
							selectedIndexRef.current = Math.max(0, clamped);
							setSelectedIndex(selectedIndexRef.current);
						}
					} else {
						const count = list.length;
						const baseInitial = dir > 0 ? (count > 1 ? 1 : 0) : (count > 1 ? count - 1 : 0);
						selectedIndexRef.current = baseInitial;
						setSelectedIndex(baseInitial);
					}

					setHoverRot({ x: 0, y: 0 });
					setDragRot({ x: 0, y: 0 });
					dragRotRef.current = { x: 0, y: 0 };
					setIsStickyMode(false);
					isStickyModeRef.current = false;
					isOpeningRef.current = false;
				} catch (err) {
					isOpeningRef.current = false;
					isOpenRef.current = false;
					pendingCommitRef.current = false;
					console.error("get_alt_tab_windows error:", err);
					await invoke("cancel_alt_tab").catch(() => {});
				}
			});

			unlistenWinTabOpen = await listen("win-tab-open", async () => {
				isOpenRef.current = true;
				setIsStickyMode(true);
				isStickyModeRef.current = true;
				if (windowsRef.current.length > 0) {
					selectedIndexRef.current = 0;
					setSelectedIndex(0);
					setHoverRot({ x: 0, y: 0 });
					setDragRot({ x: 0, y: 0 });
					dragRotRef.current = { x: 0, y: 0 };
					setIsOpen(true);
					onOpenChange?.(true);
				}
				try {
					const list = await invoke<AltTabItem[]>("get_alt_tab_windows");
					if (!list || list.length === 0) {
						isOpenRef.current = false;
						await invoke("cancel_alt_tab").catch(() => {});
						return;
					}

					windowsRef.current = list;
					setWindows(list);
					selectedIndexRef.current = 0;
					setSelectedIndex(0);
					setHoverRot({ x: 0, y: 0 });
					setDragRot({ x: 0, y: 0 });
					dragRotRef.current = { x: 0, y: 0 };
					setIsStickyMode(true);
					isStickyModeRef.current = true;
					setIsOpen(true);
					onOpenChange?.(true);
				} catch (err) {
					isOpenRef.current = false;
					console.error("win-tab-open error:", err);
					await invoke("cancel_alt_tab").catch(() => {});
				}
			});

			unlistenStep = await listen<number>("alt-tab-step", (event) => {
				const dir = event.payload || 1;
				const count = windowsRef.current.length;
				if (count > 0) {
					setSelectedIndex((prev) => {
						const next = (prev + dir + count) % count;
						selectedIndexRef.current = next;
						return next;
					});
				} else {
					pendingStepsRef.current += dir;
				}
			});

			unlistenCommit = await listen("alt-tab-commit", () => {
				if (isStickyModeRef.current) {
					return;
				}
				if (isOpeningRef.current) {
					pendingCommitRef.current = true;
				}
				if (isOpenRef.current || isOpeningRef.current) {
					commitSelection();
				}
			});

			unlistenCancel = await listen("alt-tab-cancel", () => {
				isOpeningRef.current = false;
				isOpenRef.current = false;
				pendingCommitRef.current = false;
				cancelSelection();
			});
		};

		setup();

		return () => {
			unlistenOpen?.();
			unlistenWinTabOpen?.();
			unlistenStep?.();
			unlistenCommit?.();
			unlistenCancel?.();
		};
	}, [commitSelection, cancelSelection]);

	// Webview Keyboard backup listeners when overlay is focused
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Tab") {
				e.preventDefault();
				e.stopPropagation();
				const dir = e.shiftKey ? -1 : 1;
				setSelectedIndex((prev) => {
					const count = windowsRef.current.length;
					if (count === 0) return 0;
					const next = (prev + dir + count) % count;
					selectedIndexRef.current = next;
					return next;
				});
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				setSelectedIndex((prev) => {
					const count = windowsRef.current.length;
					if (count === 0) return 0;
					const next = (prev - 1 + count) % count;
					selectedIndexRef.current = next;
					return next;
				});
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				setSelectedIndex((prev) => {
					const count = windowsRef.current.length;
					if (count === 0) return 0;
					const next = (prev + 1) % count;
					selectedIndexRef.current = next;
					return next;
				});
			} else if (e.key === "Enter") {
				e.preventDefault();
				commitSelection();
			} else if (e.key === "Escape") {
				e.preventDefault();
				cancelSelection();
			}
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });

		return () => {
			window.removeEventListener("keydown", handleKeyDown, { capture: true });
		};
	}, [isOpen, commitSelection, cancelSelection]);

	// ── 3D Mouse Parallax, Continuous Drag Rotation & Wheel Handlers ──
	const handlePointerDown = (e: React.PointerEvent) => {
		if (e.button !== 0) return;
		const isCard = (e.target as HTMLElement).closest(".alt-tab-card");
		isPointerDownRef.current = true;
		hasDraggedRef.current = false;
		dragStartRef.current = { x: e.clientX, y: e.clientY };
		lastPosRef.current = { x: e.clientX, y: e.clientY };
		if (!isCard) {
			try {
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			} catch (_) {}
		}
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		const cx = window.innerWidth / 2;
		const cy = window.innerHeight / 2;
		const dxNorm = (e.clientX - cx) / cx;
		const dyNorm = (e.clientY - cy) / cy;

		if (isPointerDownRef.current) {
			const deltaX = e.clientX - lastPosRef.current.x;
			const deltaY = e.clientY - lastPosRef.current.y;
			lastPosRef.current = { x: e.clientX, y: e.clientY };

			const totalDist = Math.hypot(
				e.clientX - dragStartRef.current.x,
				e.clientY - dragStartRef.current.y
			);
			if (totalDist > 14) {
				hasDraggedRef.current = true;
				if (!isDraggingRef.current) {
					isDraggingRef.current = true;
					setIsDragging(true);
				}
			}

			if (hasDraggedRef.current) {
				// Free continuous 3D rotation orbit:
				// Yaw (horizontal orbit): spins 360° continuously!
				// Pitch (vertical tilt): tilts smoothly between -55° and 55°
				setDragRot((prev) => {
					const nextPitch = Math.max(-55, Math.min(55, prev.x - deltaY * 0.42));
					const nextYaw = prev.y + deltaX * 0.52;
					dragRotRef.current = { x: nextPitch, y: nextYaw };
					return { x: nextPitch, y: nextYaw };
				});
			}
		} else {
			// Subtle fluid 3D parallax tilt towards cursor when hovering
			setHoverRot({
				x: -dyNorm * 12,
				y: dxNorm * 18
			});
		}
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		isPointerDownRef.current = false;
		if (isDraggingRef.current) {
			isDraggingRef.current = false;
			setIsDragging(false);
			try {
				(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
			} catch (_) {}
		}
		setTimeout(() => {
			hasDraggedRef.current = false;
		}, 30);
	};

	const handleWheel = (e: React.WheelEvent) => {
		const now = Date.now();
		if (now - lastWheelTimeRef.current < 90) return;
		lastWheelTimeRef.current = now;
		const dir = e.deltaY > 0 || e.deltaX > 0 ? 1 : -1;
		setSelectedIndex((prev) => {
			const count = windowsRef.current.length;
			if (count === 0) return 0;
			const next = (prev + dir + count) % count;
			selectedIndexRef.current = next;
			return next;
		});
	};

	const handleDoubleClick = () => {
		// Reset rotation on double click anywhere
		setDragRot({ x: 0, y: 0 });
		dragRotRef.current = { x: 0, y: 0 };
		setHoverRot({ x: 0, y: 0 });
	};

	if (!isOpen || windows.length === 0) return null;

	const activeItem = windows[selectedIndex] || windows[0];
	if (!activeItem) return null;
	const activeIcon = activeItem.icon || iconMap[activeItem.hwnd] || null;
	const rotX = hoverRot.x + dragRot.x;
	const rotY = hoverRot.y + dragRot.y;

	return (
		<AnimatePresence>
			<motion.div
				className={`alt-tab-backdrop ${isDragging ? "dragging" : ""}`}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				onWheel={handleWheel}
				onDoubleClick={handleDoubleClick}
				onClick={(e) => {
					if (e.target === e.currentTarget && !hasDraggedRef.current && !isDraggingRef.current) {
						cancelSelection();
					}
				}}
			>
				{/* Sticky Task View Banner when triggered via Win+Tab */}
				{isStickyMode && (
					<motion.div
						className="alt-tab-sticky-header"
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
					>
						<span className="alt-tab-sticky-pill">⊞ Vista de Tareas 3D</span>
					</motion.div>
				)}

				{/* 3D Stage with Free Perspective Rotator */}
				<div className="alt-tab-stage">
					<motion.div
						className="alt-tab-stage-rotator"
						animate={{
							rotateX: rotX,
							rotateY: rotY
						}}
						transition={{
							type: "spring",
							stiffness: isDragging ? 800 : 380,
							damping: isDragging ? 50 : 32,
							mass: 0.5
						}}
					>
						{windows.map((item, index) => {
							const offset = index - selectedIndex;
							const absOffset = Math.abs(offset);

							// Render only nearby cards within range for performance
							if (absOffset > 5) return null;

							const isSelected = offset === 0;
							const icon = item.icon || iconMap[item.hwnd];

							const tx = isSelected
								? 0
								: offset < 0
								? offset * 215 - 135
								: offset * 215 + 135;
							const tz = isSelected ? 85 : -absOffset * 110;
							const rY = isSelected ? 0 : offset < 0 ? 48 : -48;
							const sc = isSelected ? 1.05 : Math.max(0.68, 0.88 - absOffset * 0.04);
							const op = isSelected ? 1 : Math.max(0.18, 0.85 - absOffset * 0.16);
							const br = isSelected ? 1 : Math.max(0.4, 0.85 - absOffset * 0.14);
							const zIdx = 100 - absOffset;

							return (
								<motion.div
									key={item.hwnd}
									className={`alt-tab-card ${isSelected ? "active" : ""}`}
									style={{
										zIndex: zIdx,
										filter: `brightness(${br})`
									}}
									animate={{
										x: tx,
										z: tz,
										rotateY: rY,
										scale: sc,
										opacity: op
									}}
									transition={{
										type: "spring",
										stiffness: 450,
										damping: 38,
										mass: 0.8
									}}
									onClick={(e) => {
										e.stopPropagation();
										if (isDraggingRef.current) return;
										commitSelection(index);
									}}
									onDoubleClick={(e) => {
										e.stopPropagation();
										if (isDraggingRef.current) return;
										commitSelection(index);
									}}
								>
									{/* Card Titlebar */}
									<div className="alt-tab-card-header">
										{icon ? (
											<img src={icon} alt="" className="alt-tab-card-icon" />
										) : (
											<AppWindow className="alt-tab-card-icon-fallback" />
										)}
										<span className="alt-tab-card-appname">{item.app_name}</span>
										{item.is_minimized && (
											<span className="alt-tab-badge-minimized">Minimizado</span>
										)}
									</div>

									{/* Card Window Preview / Thumbnail */}
									<div className="alt-tab-card-body">
										{item.thumbnail ? (
											<img
												src={item.thumbnail}
												alt={item.title}
												className="alt-tab-preview-img"
											/>
										) : (
											<div className="alt-tab-card-placeholder">
												{icon ? (
													<img src={icon} alt="" className="alt-tab-placeholder-icon" />
												) : (
													<AppWindow style={{ width: 48, height: 48, color: "#64748b" }} />
												)}
												<span className="alt-tab-placeholder-title">{item.title}</span>
											</div>
										)}
									</div>
								</motion.div>
							);
						})}
					</motion.div>
				</div>

				{/* Active Window Info */}
				<motion.div
					className="alt-tab-info-container"
					key={activeItem.hwnd}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.12 }}
				>
					<div className="alt-tab-info-title">{activeItem.title}</div>
					<div className="alt-tab-info-badge">
						{activeIcon && (
							<img src={activeIcon} alt="" className="alt-tab-info-badge-icon" />
						)}
						<span>{activeItem.app_name}</span>
					</div>
				</motion.div>

				{/* Shortcut Hints Bar with 3D Navigation and Mouse Controls */}
				<div className="alt-tab-hints-bar">
					<div className="alt-tab-hint-item">
						<span className="alt-tab-key-pill">Tab</span>
						<span>Siguiente</span>
					</div>
					<div className="alt-tab-hint-item">
						<span className="alt-tab-key-pill">⇧ Tab</span>
						<span>Anterior</span>
					</div>
					<div className="alt-tab-hint-item">
						<span className="alt-tab-key-pill">◀ / ▶</span>
						<span>Navegar</span>
					</div>
					{isStickyMode ? (
						<div className="alt-tab-hint-item">
							<span className="alt-tab-key-pill">Enter / Clic</span>
							<span>Seleccionar</span>
						</div>
					) : (
						<div className="alt-tab-hint-item">
							<span className="alt-tab-key-pill">Soltar Alt</span>
							<span>Cambiar</span>
						</div>
					)}
					<div className="alt-tab-hint-item">
						<Move3d style={{ width: 14, height: 14, color: "#38bdf8" }} />
						<span>Arrastrar 3D / Rueda</span>
					</div>
					<div className="alt-tab-hint-item">
						<span className="alt-tab-key-pill">{isStickyMode ? "Esc / ⊞ Tab" : "Esc"}</span>
						<span>Cerrar</span>
					</div>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}
