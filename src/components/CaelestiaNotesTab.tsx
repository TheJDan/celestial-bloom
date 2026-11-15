import React, { useState, useEffect } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { CaelestiaTopBar, CaelestiaTabKey } from "./CaelestiaTopBar";
import "./CaelestiaTabs.css";

interface NoteItem {
	id: string;
	title: string;
	content: string;
	updatedAt: number;
}

interface CaelestiaNotesTabProps {
	onSwitchTab?: (tab: CaelestiaTabKey) => void;
}

export function CaelestiaNotesTab({ onSwitchTab }: CaelestiaNotesTabProps) {
	const [selectedTool, setSelectedTool] = useState<string>("notes");
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

	const activeNote = notes.find((n) => n.id === activeNoteId);

	// Auto-save note
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
		<div className="caelestia-home-panel cnotes-tab-root" onClick={(e) => e.stopPropagation()}>
			{/* Top Bar with Tools Dropdown */}
			<CaelestiaTopBar
				activeTab="notes"
				onSwitchTab={(t) => onSwitchTab?.(t)}
				onSelectTool={setSelectedTool}
				selectedTool={selectedTool}
			/>

			{/* Notes Layout (Image 8) */}
			<div className="cnotes-layout">
				{/* Left Sidebar: List of Notes */}
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

					{/* Bottom Status Row (Image 8) */}
					<div className="cnotes-status-row">
						<span className="cnotes-hint">La primera línea es el título</span>
						<span className="cnotes-saved">{saveStatus}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
