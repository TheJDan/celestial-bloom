// bloom_repo/src/settings/JarvisTab.tsx
// Pestaña de configuración y diagnóstico de JARVIS para Bloom.
// Permite activar/desactivar la integración, configurar la visibilidad en la Isla,
// y verificar la salud y latencia del enlace WebSocket en tiempo real.

import { useState } from "react";
import { Bot, Wifi, ShieldCheck, Radio, Zap, Activity, Cpu } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useJarvisEvents } from "../hooks/useJarvisEvents";

export function JarvisTab() {
  const {
    isEnabled,
    islandPillEnabled,
    approvalsEnabled,
    isConnected,
    state,
    lastActivity,
    pingStatus,
    setJarvisEnabled,
    setJarvisIslandPill,
    setJarvisApprovals
  } = useJarvisEvents();

  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ latency: number | null; state?: string } | null>(null);

  const handlePing = async () => {
    setIsTestingPing(true);
    const res = await pingStatus();
    setPingResult(res.ok ? { latency: res.latencyMs, state: res.state } : { latency: null });
    setIsTestingPing(false);
  };

  const secondsAgo = Math.max(0, Math.round((Date.now() - lastActivity) / 1000));

  return (
    <>
      <div className="setting-group-label">Integración Principal</div>
      <div className="setting-group">
        <SettingRow
          icon={Bot}
          label="Habilitar JARVIS en Bloom"
          desc="Conectar la isla interactiva de Bloom con el núcleo de JARVIS"
        >
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setJarvisEnabled(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </SettingRow>

        <SettingRow
          icon={Radio}
          label="Presencia en la Isla Notch"
          desc="Mostrar micro-animaciones perimetrales de voz y pensamiento en la barra superior"
        >
          <label className="toggle-switch">
            <input
              type="checkbox"
              disabled={!isEnabled}
              checked={islandPillEnabled}
              onChange={(e) => setJarvisIslandPill(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </SettingRow>

        <SettingRow
          icon={ShieldCheck}
          label="Aprobaciones en Pantalla"
          desc="Desplegar tarjeta en el notch para autorizar comandos de terminal de alto impacto"
          divider={false}
        >
          <label className="toggle-switch">
            <input
              type="checkbox"
              disabled={!isEnabled}
              checked={approvalsEnabled}
              onChange={(e) => setJarvisApprovals(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </SettingRow>
      </div>

      <div className="setting-group-label">Diagnóstico y Estado en Tiempo Real</div>
      <div className="setting-group">
        <SettingRow
          icon={Wifi}
          label="Canal Local (WebSocket)"
          desc="ws://127.0.0.1:8766 (Gateway Bidireccional de Eventos)"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isConnected ? "#10b981" : "#ef4444",
                boxShadow: isConnected ? "0 0 8px #10b981" : "0 0 6px #ef4444"
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: isConnected ? "#10b981" : "#94a3b8"
              }}
            >
              {isConnected ? "Conectado" : "Desconectado"}
            </span>
          </div>
        </SettingRow>

        <SettingRow
          icon={Activity}
          label="Estado del Asistente"
          desc={
            isConnected
              ? `Última señal recibida hace ${secondsAgo}s`
              : "Esperando a que JARVIS se inicie en segundo plano"
          }
        >
          <span
            style={{
              fontSize: "10.5px",
              padding: "2px 8px",
              borderRadius: "6px",
              backgroundColor:
                state === "listening"
                  ? "rgba(0, 229, 255, 0.15)"
                  : state === "thinking"
                  ? "rgba(192, 132, 252, 0.15)"
                  : state === "action_started"
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(255, 255, 255, 0.08)",
              color:
                state === "listening"
                  ? "#00e5ff"
                  : state === "thinking"
                  ? "#c084fc"
                  : state === "action_started"
                  ? "#f59e0b"
                  : "#94a3b8",
              fontWeight: "700"
            }}
          >
            {state.toUpperCase()}
          </span>
        </SettingRow>

        <SettingRow
          icon={Zap}
          label="Prueba de Latencia Local"
          desc={
            pingResult
              ? pingResult.latency !== null
                ? `⚡ Respuesta en ${pingResult.latency} ms (Estado: ${pingResult.state || "Activo"})`
                : "❌ JARVIS no responde en http://127.0.0.1:8765"
              : "Mide la latencia de respuesta directa al gateway REST"
          }
        >
          <button
            type="button"
            disabled={isTestingPing}
            onClick={handlePing}
            style={{
              padding: "4px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: "600",
              cursor: isTestingPing ? "default" : "pointer"
            }}
          >
            {isTestingPing ? "Probando..." : "Probar Ping"}
          </button>
        </SettingRow>

        <SettingRow
          icon={Cpu}
          label="Arbitraje con Coucou (Móvil)"
          desc="Resolución atómica en SQLite WAL. La primera aprobación descarta la tarjeta en todos los clientes"
          divider={false}
        >
          <span
            style={{
              fontSize: "10.5px",
              padding: "2px 7px",
              borderRadius: "6px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              fontWeight: "700"
            }}
          >
            Activo
          </span>
        </SettingRow>
      </div>
    </>
  );
}
