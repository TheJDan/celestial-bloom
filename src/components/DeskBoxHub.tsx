import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
	FolderDown,
	Camera,
	Monitor,
	FileText,
	Copy,
	Check,
	Trash2,
	Plus,
	ChevronRight,
	Folder,
	ListTodo,
	Layers
} from "lucide-react";
import "./DeskBoxHub.css";

export type DeskBoxTab = "portals" | "notes" | "tasks";

export interface DeskBoxTask {
	id: string;
	text: string;
	completed: boolean;
	createdAt: number;
}

interface DeskBoxHubProps {
	/** Active tab or initial tab */
	initialTab?: DeskBoxTab;
	/** Number of temporary dropped items in the shelf (if any) */
	droppedItemsCount?: number;
	/** Callback to switch view to active dropped files */
	onViewDroppedFiles?: () => void;
}

export function DeskBoxHub({
	initialTab = "portals",
	droppedItemsCount = 0,
	onViewDroppedFiles
}: DeskBoxHubProps) {
	const [activeTab, setActiveTab] = useState<DeskBoxTab>(initialTab);

	// --- Portales de Carpetas ---
	const portals = [
		{
			id: "downloads",
			name: "Downloads",
			sub: "Recent downloads",
			path: "shell:Downloads",
			icon: <FolderDown size={16} />
		},
		{
			id: "screenshots",
			name: "Screenshots",
			sub: "Saved captures",
			path: "shell:My Pictures\\Screenshots",
			icon: <Camera size={16} />
		},
		{
			id: "desktop",
			name: "Desktop",
			sub: "Desktop files",
			path: "shell:Desktop",
			icon: <Monitor size={16} />
		},
		{
			id: "documents",
			name: "Documents",
			sub: "User files",
			path: "shell:Personal",
			icon: <FileText size={16} />
		}
	];

	const handleOpenPortal = useCallback(async (path: string) => {
		try {
			await invoke("shelf_open", { path });
		} catch (e) {
			console.error("[DeskBox] Failed to open portal:", path, e);
		}
	}, []);

	// --- Quick Notes (Persistente) ---
	const [notes, setNotes] = useState<string>(() => {
		return localStorage.getItem("bloom_deskbox_notes") || "";
	});
	const [copied, setCopied] = useState(false);

	const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setNotes(val);
		localStorage.setItem("bloom_deskbox_notes", val);
	};

	const handleCopyNotes = async () => {
		if (!notes) return;
		try {
			await writeText(notes);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch (err) {
			console.error("Failed to copy notes", err);
		}
	};

	const handleClearNotes = () => {
		setNotes("");
		localStorage.removeItem("bloom_deskbox_notes");
	};

	// --- Tasks / To-Do (Persistente) ---
	const [tasks, setTasks] = useState<DeskBoxTask[]>(() => {
		try {
			const saved = localStorage.getItem("bloom_deskbox_tasks");
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});
	const [newTaskText, setNewTaskText] = useState("");

	useEffect(() => {
		localStorage.setItem("bloom_deskbox_tasks", JSON.stringify(tasks));
	}, [tasks]);

	const handleAddTask = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const trimmed = newTaskText.trim();
		if (!trimmed) return;
		const item: DeskBoxTask = {
			id: Date.now().toString(),
			text: trimmed,
			completed: false,
			createdAt: Date.now()
		};
		setTasks((prev) => [item, ...prev]);
		setNewTaskText("");
	};

	const handleToggleTask = (id: string) => {
		setTasks((prev) =>
			prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
		);
	};

	const handleDeleteTask = (id: string) => {
		setTasks((prev) => prev.filter((t) => t.id !== id));
	};

	const pendingTasksCount = tasks.filter((t) => !t.completed).length;

	return (
		<div className="deskbox-hub" onClick={(e) => e.stopPropagation()}>
			{/* Header con tabs estilo WinUI / DeskBox */}
			<div className="deskbox-header">
				<div className="deskbox-title-wrap">
					<span className="deskbox-badge">DeskBox</span>
					{droppedItemsCount > 0 && onViewDroppedFiles && (
						<button
							className="deskbox-action-btn"
							onClick={onViewDroppedFiles}
							title="View dropped files in Shelf"
						>
							<Layers size={11} />
							<span>Drops ({droppedItemsCount})</span>
						</button>
					)}
				</div>

				<div className="deskbox-tabs">
					<button
						className={`deskbox-tab-btn ${activeTab === "portals" ? "active" : ""}`}
						onClick={() => setActiveTab("portals")}
					>
						<Folder size={12} />
						<span>Portals</span>
					</button>

					<button
						className={`deskbox-tab-btn ${activeTab === "notes" ? "active" : ""}`}
						onClick={() => setActiveTab("notes")}
					>
						<FileText size={12} />
						<span>Notes</span>
					</button>

					<button
						className={`deskbox-tab-btn ${activeTab === "tasks" ? "active" : ""}`}
						onClick={() => setActiveTab("tasks")}
					>
						<ListTodo size={12} />
						<span>Tasks</span>
						{pendingTasksCount > 0 && (
							<span className="tab-badge">{pendingTasksCount}</span>
						)}
					</button>
				</div>
			</div>

			{/* Contenido según el tab seleccionado */}
			<div className="deskbox-body">
				<AnimatePresence mode="wait">
					{activeTab === "portals" && (
						<motion.div
							key="portals"
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -3 }}
							transition={{ duration: 0.15 }}
						>
							<div className="deskbox-portals-grid">
								{portals.map((portal) => (
									<div
										key={portal.id}
										className="deskbox-portal-card"
										onClick={() => handleOpenPortal(portal.path)}
										title={`Open ${portal.name}`}
									>
										<div className="deskbox-portal-icon">{portal.icon}</div>
										<div className="deskbox-portal-info">
											<div className="deskbox-portal-name">{portal.name}</div>
											<div className="deskbox-portal-sub">{portal.sub}</div>
										</div>
										<ChevronRight size={14} className="deskbox-portal-arrow" />
									</div>
								))}
							</div>

							<div className="deskbox-drop-hint">
								<span>💡 Drag & drop files or text directly here to stash</span>
							</div>
						</motion.div>
					)}

					{activeTab === "notes" && (
						<motion.div
							key="notes"
							className="deskbox-notes-view"
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -3 }}
							transition={{ duration: 0.15 }}
						>
							<textarea
								className="deskbox-notes-textarea"
								placeholder="Quick scratchpad... notes stay saved automatically."
								value={notes}
								onChange={handleNotesChange}
								spellCheck={false}
							/>
							<div className="deskbox-notes-footer">
								<span>
									{notes.length} chars • {notes.trim() ? notes.trim().split(/\s+/).length : 0} words
								</span>
								<div className="deskbox-notes-actions">
									{notes.length > 0 && (
										<button
											className="deskbox-action-btn"
											onClick={handleClearNotes}
											title="Clear text"
										>
											<Trash2 size={11} />
											<span>Clear</span>
										</button>
									)}
									<button
										className={`deskbox-action-btn ${copied ? "copied" : ""}`}
										onClick={handleCopyNotes}
										disabled={!notes}
									>
										{copied ? <Check size={11} /> : <Copy size={11} />}
										<span>{copied ? "Copied!" : "Copy"}</span>
									</button>
								</div>
							</div>
						</motion.div>
					)}

					{activeTab === "tasks" && (
						<motion.div
							key="tasks"
							className="deskbox-tasks-view"
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -3 }}
							transition={{ duration: 0.15 }}
						>
							<form className="deskbox-task-input-bar" onSubmit={handleAddTask}>
								<input
									type="text"
									className="deskbox-task-input"
									placeholder="Add a quick to-do and press Enter..."
									value={newTaskText}
									onChange={(e) => setNewTaskText(e.target.value)}
								/>
								<button type="submit" className="deskbox-task-add-btn">
									<Plus size={14} />
								</button>
							</form>

							<div className="deskbox-tasks-list">
								{tasks.length === 0 ? (
									<div className="deskbox-tasks-empty">
										<span>No tasks yet. Type above to add one!</span>
									</div>
								) : (
									tasks.map((task) => (
										<div
											key={task.id}
											className={`deskbox-task-item ${task.completed ? "completed" : ""}`}
										>
											<div
												className="deskbox-task-label"
												onClick={() => handleToggleTask(task.id)}
											>
												<div
													className={`deskbox-checkbox ${task.completed ? "checked" : ""}`}
												>
													{task.completed && <Check size={10} strokeWidth={3} />}
												</div>
												<span className="deskbox-task-text">{task.text}</span>
											</div>
											<button
												className="deskbox-task-del"
												onClick={() => handleDeleteTask(task.id)}
												title="Delete task"
											>
												<Trash2 size={12} />
											</button>
										</div>
									))
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
