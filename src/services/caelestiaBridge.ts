import { invoke } from "@tauri-apps/api/core";

export interface WorkspaceState {
	name: string;
	displayName: string;
	hasFocus: boolean;
	isDisplayed: boolean;
}

export interface CaelestiaPalette {
	primary: string;
	on_primary: string;
	surface: string;
	surface_container: string;
	on_surface: string;
	outline: string;
}

// 1. Sincroniza variables CSS --md-sys-color-* en el DOM desde Rust (material-colors)
export async function syncMaterialColors(): Promise<void> {
	try {
		const palette = await invoke<CaelestiaPalette>("get_material_palette");
		const root = document.documentElement.style;
		root.setProperty("--md-sys-color-primary", palette.primary);
		root.setProperty("--md-sys-color-on-primary", palette.on_primary);
		root.setProperty("--md-sys-color-surface", palette.surface);
		root.setProperty("--md-sys-color-surface-container", palette.surface_container);
		root.setProperty("--md-sys-color-on-surface", palette.on_surface);
		root.setProperty("--md-sys-color-outline", palette.outline);
	} catch (err) {
		console.warn("[CaelestiaBridge] Fallback paleta por defecto:", err);
		// Fallback Catppuccin / Caelestia si no hay wallpaper accesible
		const root = document.documentElement.style;
		root.setProperty("--md-sys-color-primary", "#cba6f7");
		root.setProperty("--md-sys-color-on-primary", "#11111b");
		root.setProperty("--md-sys-color-surface", "#1e1e2e");
		root.setProperty("--md-sys-color-surface-container", "#181825");
		root.setProperty("--md-sys-color-on-surface", "#cdd6f4");
		root.setProperty("--md-sys-color-outline", "#45475a");
	}
}

// 2. Conexión WebSocket al IPC de GlazeWM (puerto 6123)
export function connectGlazeWM(onWorkspacesChanged: (workspaces: WorkspaceState[]) => void): () => void {
	let ws: WebSocket | null = null;
	let reconnectTimer: number | null = null;
	let disposed = false;

	const connect = () => {
		if (disposed) return;
		try {
			ws = new WebSocket("ws://localhost:6123");

			ws.onopen = () => {
				ws?.send("query workspaces");
				ws?.send("sub -e workspace_activated workspace_deactivated focus_changed");
			};

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data);
					if (msg.messageType === "client_response" && msg.data?.workspaces) {
						onWorkspacesChanged(msg.data.workspaces);
					} else if (msg.messageType === "event_subscription") {
						ws?.send("query workspaces");
					}
				} catch {
					// Ignorar tramas no JSON
				}
			};

			ws.onerror = () => {
				// GlazeWM puede no estar corriendo; reintento silencioso
			};

			ws.onclose = () => {
				if (!disposed) {
					reconnectTimer = window.setTimeout(connect, 4000);
				}
			};
		} catch {
			if (!disposed) {
				reconnectTimer = window.setTimeout(connect, 4000);
			}
		}
	};

	connect();

	return () => {
		disposed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		try {
			ws?.close();
		} catch {}
	};
}
