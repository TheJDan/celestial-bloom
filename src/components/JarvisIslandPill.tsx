// bloom_repo/src/components/JarvisIslandPill.tsx
// Componente de presencia ambiental de JARVIS para la Isla Dinámica / Notch de Bloom.
// Muestra indicadores sutiles de escucha/pensamiento y expande la tarjeta de aprobación sin robar el foco.

import { useEffect, useState } from "react";
import { useJarvisEvents } from "../hooks/useJarvisEvents";

export function JarvisIslandPill() {
  const { isConnected, state, label, approval, sendApproval } = useJarvisEvents();
  const [timeLeft, setTimeLeft] = useState(15);

  // Cuenta regresiva para aprobaciones
  useEffect(() => {
    if (!approval) return;
    setTimeLeft(approval.timeout_seconds || 15);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          sendApproval(approval.action_id, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [approval, sendApproval]);

  // Si no está conectado o está inactivo sin aprobación, no renderiza nada para no estorbar
  if (!isConnected || (state === "idle" && !approval)) {
    return null;
  }

  // 1. Tarjeta Expandida de Aprobación Crítica
  if (approval) {
    return (
      <div
        style={{
          position: "absolute",
          top: "42px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "360px",
          backgroundColor: "rgba(10, 14, 23, 0.96)",
          border: "1px solid rgba(141, 81, 255, 0.5)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 15px rgba(141, 81, 255, 0.25)",
          borderRadius: "18px",
          padding: "12px 14px",
          zIndex: 9999,
          color: "#f8fafc",
          fontFamily: "'Segoe UI', -apple-system, sans-serif",
          backdropFilter: "blur(16px)",
          animation: "bloomSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px" }}>⚠️</span>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#c084fc", letterSpacing: "0.4px" }}>
              JARVIS REQUIERE APROBACIÓN
            </span>
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "6px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontWeight: "600"
            }}
          >
            {timeLeft}s
          </span>
        </div>

        <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#e2e8f0" }}>
          {approval.title}
        </div>

        {approval.command && (
          <div
            style={{
              fontSize: "10px",
              fontFamily: "Consolas, monospace",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              padding: "6px 8px",
              marginBottom: "10px",
              color: "#38bdf8",
              wordBreak: "break-all"
            }}
          >
            {approval.command}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => sendApproval(approval.action_id, true)}
            style={{
              flex: 1,
              padding: "6px 12px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
            }}
          >
            ✓ Aprobar
          </button>
          <button
            onClick={() => sendApproval(approval.action_id, false)}
            style={{
              flex: 1,
              padding: "6px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(255, 255, 255, 0.05)",
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            ✕ Cancelar
          </button>
        </div>
      </div>
    );
  }

  // 2. Estado Compacto (Listening / Thinking) dentro de la Isla
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const glowColor = isListening ? "#00e5ff" : isThinking ? "#a855f7" : "#10b981";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        border: `1px solid ${glowColor}40`,
        marginLeft: "6px",
        fontSize: "10px",
        color: "#f8fafc",
        fontWeight: "600",
        boxShadow: `0 0 10px ${glowColor}25`
      }}
      title={`JARVIS: ${label || state}`}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: glowColor,
          display: "inline-block",
          boxShadow: `0 0 8px ${glowColor}`
        }}
      />
      <span>{label || (isListening ? "Escuchando..." : isThinking ? "Pensando..." : "JARVIS")}</span>
    </div>
  );
}
