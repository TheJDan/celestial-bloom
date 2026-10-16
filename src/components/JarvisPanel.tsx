import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	ChevronLeft,
	Mic,
	MicOff,
	Send,
	Sparkles,
	Bot,
	LoaderCircle,
	RefreshCw
} from "lucide-react";
import "./QuickPanel.css";

interface JarvisStatus {
	online: boolean;
	state: string;
	muted: boolean;
	last_command: string;
	last_response: string;
}

interface JarvisPanelProps {
	onBack: () => void;
}

export function JarvisPanel({ onBack }: JarvisPanelProps) {
	const [status, setStatus] = useState<JarvisStatus | null>(null);
	const [prompt, setPrompt] = useState("");
	const [sending, setSending] = useState(false);
	const [togglingMute, setTogglingMute] = useState(false);
	const [lastReply, setLastReply] = useState<string | null>(null);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await invoke<JarvisStatus>("get_jarvis_status");
			setStatus(res);
			if (res.last_response && !lastReply) {
				setLastReply(res.last_response);
			}
		} catch (e) {
			console.error("Failed to fetch JARVIS status:", e);
		}
	}, [lastReply]);

	useEffect(() => {
		void fetchStatus();
		const interval = setInterval(fetchStatus, 1500);
		return () => clearInterval(interval);
	}, [fetchStatus]);

	const toggleMute = useCallback(async () => {
		setTogglingMute(true);
		try {
			const isMuted = await invoke<boolean>("jarvis_toggle_mute");
			setStatus((prev) => (prev ? { ...prev, muted: isMuted } : null));
		} catch (e) {
			console.error("Failed to toggle mute:", e);
		} finally {
			setTogglingMute(false);
		}
	}, []);

	const sendPrompt = useCallback(async () => {
		const text = prompt.trim();
		if (!text || sending) return;
		setSending(true);
		try {
			const reply = await invoke<string>("jarvis_send_prompt", { text });
			setLastReply(reply);
			setPrompt("");
			void fetchStatus();
		} catch (e) {
			console.error("Failed to send prompt to JARVIS:", e);
		} finally {
			setSending(false);
		}
	}, [prompt, sending, fetchStatus]);

	const stateLabel = (s?: string) => {
		switch (s?.toUpperCase()) {
			case "LISTENING":
				return "Escuchando…";
			case "THINKING":
				return "Procesando…";
			case "SPEAKING":
				return "Hablando…";
			case "ONLINE":
			case "IDLE":
				return "Listo / En espera";
			default:
				return "Desconectado";
		}
	};

	return (
		<div className="qp" onClick={(e) => e.stopPropagation()}>
			<div className="qp-header">
				<button className="qp-icon-btn" onClick={onBack} aria-label="Volver">
					<ChevronLeft />
				</button>
				<span className="qp-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<Bot style={{ width: 15, height: 15, color: "#38bdf8" }} />
					JARVIS • Coucou
				</span>
				<button
					className="qp-icon-btn"
					onClick={toggleMute}
					disabled={togglingMute || !status?.online}
					title={status?.muted ? "Reactivar micrófono" : "Silenciar micrófono"}
					style={{
						color: status?.muted ? "#ef4444" : "#22c55e"
					}}
				>
					{status?.muted ? <MicOff /> : <Mic />}
				</button>
				<button
					className="qp-icon-btn"
					onClick={() => void fetchStatus()}
					title="Refrescar estado"
				>
					<RefreshCw />
				</button>
			</div>

			<div className="qp-body" style={{ gap: 8 }}>
				{/* Status badge */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						background: "var(--bloom-group-bg, rgba(255, 255, 255, 0.06))",
						padding: "6px 10px",
						borderRadius: 10,
						fontSize: 11
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<span
							style={{
								width: 8,
								height: 8,
								borderRadius: "50%",
								background: status?.online ? (status.muted ? "#f59e0b" : "#22c55e") : "#64748b",
								boxShadow: status?.online
									? status.muted
										? "0 0 6px #f59e0b"
										: "0 0 6px #22c55e"
									: "none"
							}}
						/>
						<span>{status?.online ? stateLabel(status.state) : "JARVIS no iniciado"}</span>
					</div>
					{status?.online && (
						<span style={{ opacity: 0.6 }}>{status.muted ? "Silenciado" : "Mic activo"}</span>
					)}
				</div>

				{/* Conversation / Response Box */}
				<div
					style={{
						flex: 1,
						minHeight: 60,
						maxHeight: 120,
						overflowY: "auto",
						background: "var(--bloom-group-bg, rgba(255, 255, 255, 0.04))",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						borderRadius: 10,
						padding: "8px 10px",
						display: "flex",
						flexDirection: "column",
						gap: 4
					}}
				>
					<div
						style={{
							fontSize: 10,
							textTransform: "uppercase",
							letterSpacing: "0.5px",
							color: "#38bdf8",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: 4
						}}
					>
						<Sparkles style={{ width: 11, height: 11 }} />
						Última respuesta
					</div>
					<div
						style={{
							fontSize: 12,
							lineHeight: 1.4,
							color: "var(--bloom-text, white)",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word"
						}}
					>
						{lastReply || status?.last_response || (status?.online ? "Esperando comando…" : "Inicia JARVIS en tu PC")}
					</div>
				</div>

				{/* Quick input bar */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void sendPrompt();
					}}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						background: "var(--bloom-group-bg, rgba(255, 255, 255, 0.08))",
						borderRadius: 10,
						padding: "4px 8px"
					}}
				>
					<input
						type="text"
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Escribe una orden a JARVIS…"
						disabled={sending || !status?.online}
						style={{
							flex: 1,
							background: "transparent",
							border: "none",
							outline: "none",
							color: "var(--bloom-text, white)",
							fontSize: 11,
							padding: "4px 0"
						}}
					/>
					<button
						type="submit"
						disabled={!prompt.trim() || sending || !status?.online}
						style={{
							background: "transparent",
							border: "none",
							padding: 4,
							cursor: "pointer",
							color: prompt.trim() && !sending ? "#38bdf8" : "rgba(255, 255, 255, 0.3)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center"
						}}
					>
						{sending ? (
							<LoaderCircle className="qp-spin" style={{ width: 14, height: 14 }} />
						) : (
							<Send style={{ width: 14, height: 14 }} />
						)}
					</button>
				</form>
			</div>

			<button
				className="qp-footer"
				onClick={() => {
					invoke("open_app", { path: "http://127.0.0.1:8765" }).catch(() => {});
				}}
			>
				Abrir consola completa de JARVIS (Web)
			</button>
		</div>
	);
}
