import React, { useState, useEffect } from "react";
import {
	Edit3,
	Plus,
	Trash2,
	Clipboard,
	Inbox,
	Link2,
	Pipette,
	Copy,
	Check,
	Search,
	ExternalLink,
	FileText,
	Folder,
	Image as ImageIcon,
	Code,
	Archive,
	File as GenericFileIcon,
	Sparkles
} from "lucide-react";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { CaelestiaTopBar, CaelestiaTabKey } from "./CaelestiaTopBar";
import "./CaelestiaTabs.css";

/* ── Types ── */
interface NoteItem {
	id: string;
	title: string;
	content: string;
	updatedAt: number;
}

interface ClipboardItem {
	id: string;
	text: string;
	time: string;
	timestamp: number;
}

interface ShelfItem {
	id: string;
	name: string;
	path: string;
	size?: string;
}

interface QuickLinkItem {
	id: string;
	title: string;
	url: string;
	isCustom?: boolean;
}

interface CaelestiaNotesTabProps {
	onSwitchTab?: (tab: CaelestiaTabKey) => void;
}

/* ══════════════════════════════════════════════════════════════════════════
   1. PORTAPAPELES (CLIPBOARD HISTORY)
   ══════════════════════════════════════════════════════════════════════════ */
function CaelestiaClipboardSubView() {
	const [items, setItems] = useState<ClipboardItem[]>(() => {
		try {
			const saved = localStorage.getItem("caelestia-clipboard-history");
			if (saved) return JSON.parse(saved);
		} catch {}
		return [];
	});
	const [searchQuery, setSearchQuery] = useState("");
	const [copiedId, setCopiedId] = useState<string | null>(null);

	// Poll clipboard for new text
	useEffect(() => {
		let isMounted = true;
		const checkClipboard = async () => {
			try {
				const current = await readText().catch(() => "");
				if (!current || !current.trim()) return;

				setItems((prev) => {
					if (prev.length > 0 && prev[0].text === current) {
						return prev;
					}
					const filtered = prev.filter((i) => i.text !== current);
					const newItem: ClipboardItem = {
						id: `clip-${Date.now()}`,
						text: current,
						time: "ahora",
						timestamp: Date.now()
					};
					const updated = [newItem, ...filtered].slice(0, 50);
					try {
						localStorage.setItem("caelestia-clipboard-history", JSON.stringify(updated));
					} catch {}
					return updated;
				});
			} catch {}
		};

		checkClipboard();
		const interval = setInterval(checkClipboard, 1500);
		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, []);

	const handleCopy = async (item: ClipboardItem) => {
		try {
			await writeText(item.text);
			setCopiedId(item.id);
			setTimeout(() => setCopiedId(null), 1500);
		} catch {}
	};

	const handleDelete = (id: string) => {
		const updated = items.filter((i) => i.id !== id);
		setItems(updated);
		try {
			localStorage.setItem("caelestia-clipboard-history", JSON.stringify(updated));
		} catch {}
	};

	const handleClearAll = () => {
		setItems([]);
		try {
			localStorage.removeItem("caelestia-clipboard-history");
		} catch {}
	};

	const filtered = items.filter((i) =>
		i.text.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="ctool-subview cclipboard-view">
			{/* Top Bar: Search & Actions */}
			<div className="ctool-action-bar">
				<div className="ctool-search-box">
					<Search size={14} color="rgba(255, 255, 255, 0.4)" />
					<input
						type="text"
						placeholder="Buscar en portapapeles..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="ctool-search-input"
					/>
				</div>
				{items.length > 0 && (
					<button type="button" className="ctool-btn-secondary" onClick={handleClearAll}>
						Limpiar historial
					</button>
				)}
			</div>

			{/* List of items */}
			{filtered.length > 0 ? (
				<div className="cclipboard-list">
					{filtered.map((item) => {
						const isCopied = copiedId === item.id;
						return (
							<div key={item.id} className="cclipboard-card">
								<div className="cclipboard-text" title={item.text}>
									{item.text}
								</div>
								<div className="cclipboard-footer">
									<span className="cclipboard-meta">
										{item.text.length} caracteres
									</span>
									<div className="cclipboard-actions">
										<button
											type="button"
											className={`cclipboard-copy-btn ${isCopied ? "copied" : ""}`}
											onClick={() => handleCopy(item)}
										>
											{isCopied ? (
												<>
													<Check size={12} strokeWidth={2.6} />
													<span>¡Copiado!</span>
												</>
											) : (
												<>
													<Copy size={12} />
													<span>Copiar</span>
												</>
											)}
										</button>
										<button
											type="button"
											className="cclipboard-del-btn"
											title="Eliminar"
											onClick={() => handleDelete(item.id)}
										>
											<Trash2 size={12} />
										</button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="ctool-empty-box">
					<Clipboard size={34} color="rgba(255, 255, 255, 0.25)" />
					<div className="ctool-empty-title">Portapapeles vacío</div>
					<div className="ctool-empty-desc">
						Los textos que copies en Windows aparecerán aquí automáticamente para reutilizarlos.
					</div>
				</div>
			)}
		</div>
	);
}

/* ══════════════════════════════════════════════════════════════════════════
   2. NOTAS (NOTES EDITOR)
   ══════════════════════════════════════════════════════════════════════════ */
function CaelestiaNotesSubView() {
	const [notes, setNotes] = useState<NoteItem[]>(() => {
		try {
			const saved = localStorage.getItem("caelestia-notes");
			if (saved) return JSON.parse(saved);
		} catch {}
		return [
			{
				id: "note-1",
				title: "Recordatorio de tareas",
				content: "Recordatorio de tareas\n- Revisar optimizaciones en Celestial Bloom\n- Sincronizar iconos y atajos de teclado\n- Disfrutar la experiencia fluida",
				updatedAt: Date.now()
			}
		];
	});

	const [activeNoteId, setActiveNoteId] = useState<string>(() => notes[0]?.id || "");
	const [editorText, setEditorText] = useState<string>(() => notes[0]?.content || "");
	const [saveStatus, setSaveStatus] = useState<string>("Guardado");

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newContent = e.target.value;
		setEditorText(newContent);
		setSaveStatus("Guardando...");

		const lines = newContent.split("\n");
		const firstLine = lines[0]?.trim() || "Nota sin título";

		setNotes((prevNotes) => {
			const updated = prevNotes.map((n) =>
				n.id === activeNoteId
					? { ...n, title: firstLine, content: newContent, updatedAt: Date.now() }
					: n
			);
			try {
				localStorage.setItem("caelestia-notes", JSON.stringify(updated));
			} catch {}
			return updated;
		});

		setTimeout(() => {
			setSaveStatus("Guardado");
		}, 400);
	};

	const handleCreateNew = () => {
		const newId = `note-${Date.now()}`;
		const newNote: NoteItem = {
			id: newId,
			title: "Nueva nota",
			content: "",
			updatedAt: Date.now()
		};
		const updated = [newNote, ...notes];
		setNotes(updated);
		setActiveNoteId(newId);
		setEditorText("");
		setSaveStatus("Guardado");
		try {
			localStorage.setItem("caelestia-notes", JSON.stringify(updated));
		} catch {}
	};

	const handleDeleteNote = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const updated = notes.filter((n) => n.id !== id);
		setNotes(updated);
		try {
			localStorage.setItem("caelestia-notes", JSON.stringify(updated));
		} catch {}
		if (activeNoteId === id) {
			if (updated.length > 0) {
				setActiveNoteId(updated[0].id);
				setEditorText(updated[0].content);
			} else {
				setActiveNoteId("");
				setEditorText("");
			}
		}
	};

	const handleSelectNote = (note: NoteItem) => {
		setActiveNoteId(note.id);
		setEditorText(note.content);
		setSaveStatus("Guardado");
	};

	return (
		<div className="cnotes-layout">
			{/* Left Sidebar */}
			<div className="cnotes-sidebar">
				<div className="cnotes-sidebar-header">
					<span className="cnotes-heading">NOTAS</span>
					<button type="button" className="cnotes-new-btn" onClick={handleCreateNew}>
						+ Nueva
					</button>
				</div>

				<div className="cnotes-list">
					{notes.map((note) => {
						const isSelected = note.id === activeNoteId;
						const preview = note.content.split("\n").slice(1).join(" ").trim() || "Sin contenido adicional";
						return (
							<div
								key={note.id}
								className={`cnotes-item-card ${isSelected ? "selected" : ""}`}
								onClick={() => handleSelectNote(note)}
							>
								<div className="cnotes-item-title">{note.title}</div>
								<div className="cnotes-item-preview">{preview}</div>
								<button
									type="button"
									className="cnotes-delete-btn"
									title="Eliminar nota"
									onClick={(e) => handleDeleteNote(note.id, e)}
								>
									<Trash2 size={12} />
								</button>
							</div>
						);
					})}
				</div>
			</div>

			{/* Right Main Editor */}
			<div className="cnotes-editor-wrap">
				<textarea
					className="cnotes-textarea"
					placeholder="Escribe tu nota aquí..."
					value={editorText}
					onChange={handleTextChange}
					autoFocus
				/>

				<div className="cnotes-status-row">
					<span className="cnotes-hint">La primera línea es el título</span>
					<span className="cnotes-saved">{saveStatus}</span>
				</div>
			</div>
		</div>
	);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. BANDEJA TEMPORAL (DESKBOX / FILE SHELF)
   ══════════════════════════════════════════════════════════════════════════ */
function CaelestiaShelfSubView() {
	const [shelfFiles, setShelfFiles] = useState<ShelfItem[]>(() => {
		try {
			const saved = localStorage.getItem("caelestia-shelf-files");
			if (saved) return JSON.parse(saved);
		} catch {}
		return [];
	});

	const handleAddFiles = async () => {
		try {
			const selected = await openFileDialog({
				multiple: true,
				title: "Seleccionar archivos para la bandeja temporal"
			});
			if (!selected) return;
			const paths = Array.isArray(selected) ? selected : [selected];
			const newItems: ShelfItem[] = paths.map((p) => {
				const name = p.split(/[/\\]/).pop() || p;
				return {
					id: `shelf-${Date.now()}-${Math.random()}`,
					name,
					path: p
				};
			});
			const updated = [...newItems, ...shelfFiles];
			setShelfFiles(updated);
			try {
				localStorage.setItem("caelestia-shelf-files", JSON.stringify(updated));
			} catch {}
		} catch {}
	};

	const handleOpenFile = async (path: string) => {
		try {
			await invoke("shelf_open", { path }).catch(async () => {
				await openUrl(path).catch(() => {});
			});
		} catch {}
	};

	const handleRemove = (id: string) => {
		const updated = shelfFiles.filter((f) => f.id !== id);
		setShelfFiles(updated);
		try {
			localStorage.setItem("caelestia-shelf-files", JSON.stringify(updated));
		} catch {}
	};

	const handleClearAll = () => {
		setShelfFiles([]);
		try {
			localStorage.removeItem("caelestia-shelf-files");
		} catch {}
	};

	const getFileIcon = (name: string) => {
		const ext = name.split(".").pop()?.toLowerCase() || "";
		if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
			return <ImageIcon size={18} color="#38bdf8" />;
		}
		if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
			return <Archive size={18} color="#f59e0b" />;
		}
		if (["rs", "ts", "tsx", "js", "jsx", "py", "json", "html", "css"].includes(ext)) {
			return <Code size={18} color="#a855f7" />;
		}
		if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
			return <FileText size={18} color="#ef4444" />;
		}
		return <GenericFileIcon size={18} color="rgba(255, 255, 255, 0.7)" />;
	};

	return (
		<div className="ctool-subview cshelf-view">
			<div className="ctool-action-bar">
				<div className="ctool-heading-title">BANDEJA TEMPORAL (DESKBOX)</div>
				<div className="ctool-actions-right">
					<button type="button" className="ctool-btn-primary" onClick={handleAddFiles}>
						+ Añadir archivos
					</button>
					{shelfFiles.length > 0 && (
						<button type="button" className="ctool-btn-secondary" onClick={handleClearAll}>
							Vaciar
						</button>
					)}
				</div>
			</div>

			{shelfFiles.length > 0 ? (
				<div className="cshelf-files-grid">
					{shelfFiles.map((file) => (
						<div key={file.id} className="cshelf-file-card">
							<div className="cshelf-file-left">
								<div className="cshelf-file-icon">{getFileIcon(file.name)}</div>
								<div className="cshelf-file-meta">
									<div className="cshelf-file-name" title={file.name}>
										{file.name}
									</div>
									<div className="cshelf-file-path" title={file.path}>
										{file.path}
									</div>
								</div>
							</div>
							<div className="cshelf-file-actions">
								<button
									type="button"
									className="cshelf-open-btn"
									onClick={() => handleOpenFile(file.path)}
								>
									Abrir
								</button>
								<button
									type="button"
									className="cshelf-delete-btn"
									title="Eliminar de la bandeja"
									onClick={() => handleRemove(file.id)}
								>
									<Trash2 size={13} />
								</button>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="ctool-empty-box cshelf-drop-area" onClick={handleAddFiles}>
					<Inbox size={36} color="rgba(255, 255, 255, 0.25)" />
					<div className="ctool-empty-title">Bandeja temporal vacía</div>
					<div className="ctool-empty-desc">
						Haz clic en Añadir archivos para guardar fotos, documentos y carpetas temporalmente.
					</div>
				</div>
			)}
		</div>
	);
}

/* ══════════════════════════════════════════════════════════════════════════
   4. ENLACES RÁPIDOS (QUICK BOOKMARKS)
   ══════════════════════════════════════════════════════════════════════════ */
function CaelestiaLinksSubView() {
	const defaultLinks: QuickLinkItem[] = [
		{ id: "l-1", title: "Google", url: "https://www.google.com" },
		{ id: "l-2", title: "YouTube", url: "https://www.youtube.com" },
		{ id: "l-3", title: "GitHub", url: "https://github.com" },
		{ id: "l-4", title: "ChatGPT", url: "https://chatgpt.com" },
		{ id: "l-5", title: "WhatsApp Web", url: "https://web.whatsapp.com" },
		{ id: "l-6", title: "Reddit", url: "https://www.reddit.com" },
		{ id: "l-7", title: "Spotify", url: "https://open.spotify.com" },
		{ id: "l-8", title: "Netflix", url: "https://www.netflix.com" }
	];

	const [links, setLinks] = useState<QuickLinkItem[]>(() => {
		try {
			const saved = localStorage.getItem("caelestia-quick-links");
			if (saved) return JSON.parse(saved);
		} catch {}
		return defaultLinks;
	});

	const [newTitle, setNewTitle] = useState("");
	const [newUrl, setNewUrl] = useState("");
	const [showAddForm, setShowAddForm] = useState(false);

	const handleOpen = (url: string) => {
		openUrl(url).catch(() => {});
	};

	const handleAddCustom = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTitle.trim() || !newUrl.trim()) return;
		let validUrl = newUrl.trim();
		if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
			validUrl = `https://${validUrl}`;
		}
		const newItem: QuickLinkItem = {
			id: `link-${Date.now()}`,
			title: newTitle.trim(),
			url: validUrl,
			isCustom: true
		};
		const updated = [...links, newItem];
		setLinks(updated);
		setNewTitle("");
		setNewUrl("");
		setShowAddForm(false);
		try {
			localStorage.setItem("caelestia-quick-links", JSON.stringify(updated));
		} catch {}
	};

	const handleDelete = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const updated = links.filter((l) => l.id !== id);
		setLinks(updated);
		try {
			localStorage.setItem("caelestia-quick-links", JSON.stringify(updated));
		} catch {}
	};

	return (
		<div className="ctool-subview clinks-view">
			<div className="ctool-action-bar">
				<div className="ctool-heading-title">ENLACES RÁPIDOS</div>
				<button
					type="button"
					className="ctool-btn-primary"
					onClick={() => setShowAddForm((p) => !p)}
				>
					{showAddForm ? "Cancelar" : "+ Añadir enlace"}
				</button>
			</div>

			{/* Inline Add Form */}
			{showAddForm && (
				<form className="clinks-add-form" onSubmit={handleAddCustom}>
					<input
						type="text"
						placeholder="Nombre del sitio (ej. Twitch)"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						className="clinks-form-input"
						autoFocus
					/>
					<input
						type="text"
						placeholder="URL (ej. twitch.tv)"
						value={newUrl}
						onChange={(e) => setNewUrl(e.target.value)}
						className="clinks-form-input"
					/>
					<button type="submit" className="ctool-btn-primary">
						Guardar
					</button>
				</form>
			)}

			{/* Grid of Link Cards */}
			<div className="clinks-grid">
				{links.map((item) => {
					const initial = item.title.slice(0, 1).toUpperCase();
					return (
						<div
							key={item.id}
							className="clinks-card"
							onClick={() => handleOpen(item.url)}
							title={`Abrir ${item.url}`}
						>
							<div className="clinks-card-top">
								<div className="clinks-avatar">{initial}</div>
								{item.isCustom && (
									<button
										type="button"
										className="clinks-del-icon"
										onClick={(e) => handleDelete(item.id, e)}
										title="Eliminar enlace"
									>
										<Trash2 size={12} />
									</button>
								)}
							</div>
							<div className="clinks-title">{item.title}</div>
							<div className="clinks-url">
								{item.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. SELECTOR DE COLOR (COLOR PICKER & PALETTE)
   ══════════════════════════════════════════════════════════════════════════ */
function CaelestiaColorSubView() {
	const [currentColor, setCurrentColor] = useState("#007AFF");
	const [copiedField, setCopiedField] = useState<string | null>(null);
	const [history, setHistory] = useState<string[]>(() => {
		try {
			const saved = localStorage.getItem("caelestia-color-history");
			if (saved) return JSON.parse(saved);
		} catch {}
		return ["#007AFF", "#30D158", "#BF5AF2", "#FF9500", "#FF453A", "#64D2FF", "#FFD60A"];
	});

	const presetColors = [
		"#007AFF", // Blue
		"#30D158", // Green
		"#BF5AF2", // Purple
		"#FF9500", // Orange
		"#FF453A", // Red
		"#64D2FF", // Cyan
		"#FFD60A", // Yellow
		"#5E5CE6", // Indigo
		"#FF2D55", // Pink
		"#A28BFE", // Lavender
		"#34C759", // Emerald
		"#E5E5EA"  // Platinum
	];

	// Convert HEX to RGB
	const hexToRgb = (hex: string) => {
		let c = hex.replace("#", "");
		if (c.length === 3) c = c.split("").map((x) => x + x).join("");
		const num = parseInt(c, 16);
		const r = (num >> 16) & 255;
		const g = (num >> 8) & 255;
		const b = num & 255;
		return { r, g, b, str: `rgb(${r}, ${g}, ${b})` };
	};

	// Convert RGB to HSL
	const rgbToHsl = (r: number, g: number, b: number) => {
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h = 0;
		let s = 0;
		const l = (max + min) / 2;

		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}
		return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
	};

	const rgbObj = hexToRgb(currentColor);
	const hslStr = rgbToHsl(rgbObj.r, rgbObj.g, rgbObj.b);

	const applyColor = (hex: string) => {
		const formatted = hex.toUpperCase();
		setCurrentColor(formatted);
		setHistory((prev) => {
			const filtered = prev.filter((c) => c !== formatted);
			const updated = [formatted, ...filtered].slice(0, 10);
			try {
				localStorage.setItem("caelestia-color-history", JSON.stringify(updated));
			} catch {}
			return updated;
		});
	};

	const handlePickScreenColor = async () => {
		if ("EyeDropper" in window) {
			try {
				const dropper = new (window as any).EyeDropper();
				const result = await dropper.open();
				if (result && result.sRGBHex) {
					applyColor(result.sRGBHex);
				}
			} catch {}
		}
	};

	const handleCopy = async (val: string, field: string) => {
		try {
			await writeText(val);
			setCopiedField(field);
			setTimeout(() => setCopiedField(null), 1400);
		} catch {}
	};

	return (
		<div className="ctool-subview ccolor-view">
			<div className="ctool-action-bar">
				<div className="ctool-heading-title">SELECTOR DE COLOR</div>
				{"EyeDropper" in window && (
					<button
						type="button"
						className="ctool-btn-primary"
						onClick={handlePickScreenColor}
					>
						<Pipette size={13} />
						<span>Gotero de pantalla</span>
					</button>
				)}
			</div>

			<div className="ccolor-main-row">
				{/* Large Preview & Native Picker */}
				<div
					className="ccolor-preview-block"
					style={{ backgroundColor: currentColor }}
				>
					<input
						type="color"
						value={currentColor}
						onChange={(e) => applyColor(e.target.value)}
						className="ccolor-hidden-picker"
						title="Haz clic para abrir selector interactivo"
					/>
					<span className="ccolor-preview-label">{currentColor}</span>
				</div>

				{/* Values Column */}
				<div className="ccolor-values-col">
					{/* HEX */}
					<div
						className="ccolor-val-card"
						onClick={() => handleCopy(currentColor, "hex")}
					>
						<div className="ccolor-val-left">
							<span className="ccolor-val-type">HEX</span>
							<span className="ccolor-val-text">{currentColor}</span>
						</div>
						<button type="button" className="ccolor-val-copy">
							{copiedField === "hex" ? <Check size={14} color="#30d158" /> : <Copy size={14} />}
						</button>
					</div>

					{/* RGB */}
					<div
						className="ccolor-val-card"
						onClick={() => handleCopy(rgbObj.str, "rgb")}
					>
						<div className="ccolor-val-left">
							<span className="ccolor-val-type">RGB</span>
							<span className="ccolor-val-text">{rgbObj.str}</span>
						</div>
						<button type="button" className="ccolor-val-copy">
							{copiedField === "rgb" ? <Check size={14} color="#30d158" /> : <Copy size={14} />}
						</button>
					</div>

					{/* HSL */}
					<div
						className="ccolor-val-card"
						onClick={() => handleCopy(hslStr, "hsl")}
					>
						<div className="ccolor-val-left">
							<span className="ccolor-val-type">HSL</span>
							<span className="ccolor-val-text">{hslStr}</span>
						</div>
						<button type="button" className="ccolor-val-copy">
							{copiedField === "hsl" ? <Check size={14} color="#30d158" /> : <Copy size={14} />}
						</button>
					</div>
				</div>
			</div>

			{/* Palettes Section */}
			<div className="ccolor-swatches-section">
				<span className="ccolor-section-heading">PALETA PREESTABLECIDA</span>
				<div className="ccolor-swatches-row">
					{presetColors.map((hex) => (
						<button
							key={hex}
							type="button"
							className={`ccolor-swatch-circle ${currentColor === hex ? "selected" : ""}`}
							style={{ backgroundColor: hex }}
							onClick={() => applyColor(hex)}
							title={hex}
						/>
					))}
				</div>
			</div>

			{/* Recent History */}
			{history.length > 0 && (
				<div className="ccolor-swatches-section" style={{ marginTop: 12 }}>
					<span className="ccolor-section-heading">HISTORIAL RECIENTE</span>
					<div className="ccolor-swatches-row">
						{history.map((hex, idx) => (
							<button
								key={`${hex}-${idx}`}
								type="button"
								className={`ccolor-swatch-circle ${currentColor === hex ? "selected" : ""}`}
								style={{ backgroundColor: hex }}
								onClick={() => applyColor(hex)}
								title={hex}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN CONTAINER COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
export function CaelestiaNotesTab({ onSwitchTab }: CaelestiaNotesTabProps) {
	const [selectedTool, setSelectedTool] = useState<string>("notes");

	return (
		<div className="caelestia-home-panel cnotes-tab-root" onClick={(e) => e.stopPropagation()}>
			{/* Top Bar with Tools Dropdown */}
			<CaelestiaTopBar
				activeTab="notes"
				onSwitchTab={(t) => onSwitchTab?.(t)}
				onSelectTool={setSelectedTool}
				selectedTool={selectedTool}
			/>

			{/* Render corresponding subview based on selected tool */}
			<div className="ctool-subview-container">
				{selectedTool === "clipboard" && <CaelestiaClipboardSubView />}
				{selectedTool === "notes" && <CaelestiaNotesSubView />}
				{selectedTool === "shelf" && <CaelestiaShelfSubView />}
				{selectedTool === "links" && <CaelestiaLinksSubView />}
				{selectedTool === "color" && <CaelestiaColorSubView />}
			</div>
		</div>
	);
}
