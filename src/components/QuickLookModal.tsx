import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { X, ExternalLink, FileText, Image as ImageIcon, Music, Film, File } from "lucide-react";
import "./QuickLookModal.css";

interface QuickLookData {
	path: string;
	name: string;
	extension: string;
	size_bytes: u64 | number;
	modified_ms: number;
	kind: "image" | "video" | "audio" | "text" | "binary";
	content: string | null;
}

type u64 = number;

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function QuickLookModal({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
	const [isOpen, setIsOpen] = useState(false);
	const [data, setData] = useState<QuickLookData | null>(null);
	const [loading, setLoading] = useState(false);
	const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	const handleClose = useCallback(() => {
		setIsOpen(false);
		setData(null);
		setImgDimensions(null);
		invoke("close_quick_look").catch(() => {});
	}, []);

	useEffect(() => {
		const unlistenOpen = listen<string>("quick-look-open", async (event) => {
			const path = event.payload;
			if (!path) return;
			setLoading(true);
			setIsOpen(true);
			try {
				const info = await invoke<QuickLookData>("get_quick_look_data", { path });
				setData(info);
			} catch (e) {
				console.error("Failed to load Quick Look data:", e);
				handleClose();
			} finally {
				setLoading(false);
			}
		});

		const unlistenClose = listen("quick-look-close", () => {
			handleClose();
		});

		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isOpen) return;
			if (e.key === "Escape" || e.code === "Space") {
				e.preventDefault();
				handleClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			unlistenOpen.then((f) => f());
			unlistenClose.then((f) => f());
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, handleClose]);

	const handleOpenWithDefault = () => {
		if (data?.path) {
			invoke("shelf_open", { path: data.path }).catch(() => {});
			handleClose();
		}
	};

	const fileUrl = data?.path ? convertFileSrc(data.path) : "";

	const renderPreview = () => {
		if (!data) return null;

		switch (data.kind) {
			case "image":
				return (
					<div className="quicklook-image-container">
						<img
							src={fileUrl}
							alt={data.name}
							className="quicklook-image"
							onLoad={(e) => {
								const img = e.currentTarget;
								setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
							}}
						/>
					</div>
				);

			case "video":
				return (
					<div className="quicklook-video-container">
						<video
							src={fileUrl}
							className="quicklook-video"
							controls
							autoPlay
							loop
						/>
					</div>
				);

			case "audio":
				return (
					<div className="quicklook-audio-container">
						<div className="quicklook-audio-disc">
							<Music size={48} className="text-white/80 animate-pulse" />
						</div>
						<audio ref={audioRef} src={fileUrl} controls autoPlay className="quicklook-audio-player" />
					</div>
				);

			case "text": {
				const lines = (data.content || "").split("\n");
				return (
					<div className="quicklook-text-container">
						<div className="quicklook-code-lines">
							{lines.map((_, i) => (
								<div key={i} className="quicklook-line-num">
									{i + 1}
								</div>
							))}
						</div>
						<pre className="quicklook-code-content">
							<code>{data.content || ""}</code>
						</pre>
					</div>
				);
			}

			case "binary":
			default:
				return (
					<div className="quicklook-binary-container">
						<div className="quicklook-file-icon-box">
							<File size={64} className="text-blue-400" />
							<span className="quicklook-file-badge">{data.extension.toUpperCase() || "FILE"}</span>
						</div>
						<div className="quicklook-binary-info">
							<h3 className="quicklook-binary-title">{data.name}</h3>
							<p className="quicklook-binary-path">{data.path}</p>
							<div className="quicklook-binary-meta">
								<span>{formatBytes(data.size_bytes)}</span>
								<span>•</span>
								<span>{new Date(data.modified_ms).toLocaleString()}</span>
							</div>
						</div>
					</div>
				);
		}
	};

	const getKindIcon = () => {
		switch (data?.kind) {
			case "image": return <ImageIcon size={16} className="text-emerald-400" />;
			case "video": return <Film size={16} className="text-purple-400" />;
			case "audio": return <Music size={16} className="text-amber-400" />;
			case "text": return <FileText size={16} className="text-cyan-400" />;
			default: return <File size={16} className="text-blue-400" />;
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="quicklook-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					onClick={handleClose}
				>
					<motion.div
						className="quicklook-modal"
						initial={{ scale: 0.92, opacity: 0, y: 15 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.92, opacity: 0, y: 15 }}
						transition={{ type: "spring", damping: 26, stiffness: 380 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="quicklook-header">
							<div className="quicklook-title-box">
								{getKindIcon()}
								<span className="quicklook-filename">{data?.name || "Loading..."}</span>
								{data && (
									<span className="quicklook-meta-tag">
										{imgDimensions
											? `${imgDimensions.w} × ${imgDimensions.h} • ${formatBytes(data.size_bytes)}`
											: `${data.extension.toUpperCase()} • ${formatBytes(data.size_bytes)}`}
									</span>
								)}
							</div>
							<div className="quicklook-actions">
								<button
									className="quicklook-action-btn"
									onClick={handleOpenWithDefault}
									title="Open with default application"
								>
									<ExternalLink size={14} />
									<span>Open</span>
								</button>
								<button
									className="quicklook-close-btn"
									onClick={handleClose}
									title="Close (Esc or Space)"
								>
									<X size={16} />
								</button>
							</div>
						</div>

						{/* Content Body */}
						<div className="quicklook-body">
							{loading ? (
								<div className="quicklook-loading">
									<div className="quicklook-spinner" />
									<span>Loading preview...</span>
								</div>
							) : (
								renderPreview()
							)}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
