// bloom_repo/src/components/JarvisIslandPill.tsx
// Componente de presencia ambiental de JARVIS para la Isla Dinámica / Notch de Bloom.
// Incluye micro-animaciones perimetrales por estado, barras de voz en escucha,
// y tarjeta interactiva de aprobación atómica sin robo de foco.

import { useEffect, useState } from "react";
import { useJarvisEvents } from "../hooks/useJarvisEvents";

export function JarvisIslandPill() {
  const {
    isEnabled,
    islandPillEnabled,
    approvalsEnabled,
    isConnected,
    state,
    label,
    approval,
    sendApproval
  } = useJarvisEvents();

  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);
  const [isResolving, setIsResolving] = useState(false);

  // Cuenta regresiva con seguimiento de porcentaje para barra de expiración
  useEffect(() => {
    if (!approval) {
      setIsResolving(false);
      return;
    }
    const total = approval.timeout_seconds || 15;
    setTimeLeft(total);
    setMaxTime(total);
    setIsResolving(false);

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

  // Si la integración o la visualización en la isla están apagadas, no renderizar
  if (!isEnabled || !islandPillEnabled) {
    return null;
  }

  // Si no está conectado o está inactivo sin aprobación, ocultar discretamente
  if (!isConnected || (state === "idle" && !approval)) {
    return null;
  }

  const handleAction = async (approved: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!approval || isResolving) return;
    setIsResolving(true);
    await sendApproval(approval.action_id, approved);
  };

  // 1. Tarjeta Expandida de Aprobación Crítica
  if (approval && approvalsEnabled) {
    const riskUpper = (approval.risk_level || "medium").toUpperCase();
    const isCritical = riskUpper === "HIGH" || riskUpper === "CRITICAL" || riskUpper === "CRÍTICO";
    const isLow = riskUpper === "LOW" || riskUpper === "BAJO";

    const riskBadgeColor = isCritical ? "#ef4444" : isLow ? "#38bdf8" : "#f59e0b";
    const riskBadgeBg = isCritical
      ? "rgba(239, 68, 68, 0.18)"
      : isLow
      ? "rgba(56, 189, 248, 0.18)"
      : "rgba(245, 158, 11, 0.18)";
    const riskBorder = isCritical
      ? "rgba(239, 68, 68, 0.4)"
      : isLow
      ? "rgba(56, 189, 248, 0.4)"
      : "rgba(245, 158, 11, 0.4)";

    const progressPct = maxTime > 0 ? Math.max(0, Math.min(100, (timeLeft / maxTime) * 100)) : 0;

    return (
      <div
        className="jarvis-approval-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "46px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "370px",
          backgroundColor: "rgba(10, 14, 25, 0.96)",
          border: "1px solid rgba(168, 85, 247, 0.45)",
          boxShadow: "0 16px 36px -6px rgba(0, 0, 0, 0.85), 0 0 24px rgba(168, 85, 247, 0.28)",
          borderRadius: "20px",
          padding: "14px 16px",
          zIndex: 99999,
          color: "#f8fafc",
          fontFamily: "'Segoe UI', -apple-system, sans-serif",
          backdropFilter: "blur(20px)",
          animation: "jarvisSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden"
        }}
      >
        {/* Cabecera con advertencia y badge de riesgo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "rgba(168, 85, 247, 0.2)",
                border: "1px solid rgba(168, 85, 247, 0.5)",
                fontSize: "11px"
              }}
            >
              🛡️
            </span>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#c084fc", letterSpacing: "0.5px" }}>
              JARVIS REQUIERE APROBACIÓN
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "9px",
                padding: "2px 7px",
                borderRadius: "6px",
                backgroundColor: riskBadgeBg,
                color: riskBadgeColor,
                border: `1px solid ${riskBorder}`,
                fontWeight: "700",
                letterSpacing: "0.4px"
              }}
            >
              {isCritical ? "CRÍTICO" : isLow ? "NORMAL" : "MODERADO"}
            </span>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 7px",
                borderRadius: "6px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#e2e8f0",
                fontWeight: "600"
              }}
            >
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Título de la acción */}
        <div style={{ fontSize: "12.5px", fontWeight: "600", marginBottom: "6px", color: "#f1f5f9" }}>
          {approval.title}
        </div>

        {/* Comando o detalles en bloque tipo consola */}
        {approval.command && (
          <div
            style={{
              fontSize: "10.5px",
              fontFamily: "Consolas, 'Cascadia Code', monospace",
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              padding: "7px 10px",
              marginBottom: "12px",
              color: "#38bdf8",
              maxHeight: "80px",
              overflowY: "auto",
              wordBreak: "break-all",
              lineHeight: "1.4"
            }}
          >
            {approval.command}
          </div>
        )}

        {/* Botones de acción directa */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            tabIndex={-1}
            disabled={isResolving}
            onClick={(e) => handleAction(true, e)}
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: "11px",
              border: "none",
              background: isResolving
                ? "rgba(16, 185, 129, 0.4)"
                : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              fontSize: "11.5px",
              fontWeight: "700",
              cursor: isResolving ? "default" : "pointer",
              boxShadow: "0 3px 12px rgba(16, 185, 129, 0.35)",
              transition: "transform 0.15s ease, filter 0.15s ease"
            }}
            onMouseEnter={(e) => !isResolving && (e.currentTarget.style.filter = "brightness(1.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
          >
            {isResolving ? "Enviando..." : "✓ Aprobar"}
          </button>

          <button
            type="button"
            tabIndex={-1}
            disabled={isResolving}
            onClick={(e) => handleAction(false, e)}
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: "11px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(255, 255, 255, 0.06)",
              color: "#94a3b8",
              fontSize: "11.5px",
              fontWeight: "600",
              cursor: isResolving ? "default" : "pointer",
              transition: "background 0.15s ease, color 0.15s ease"
            }}
            onMouseEnter={(e) => {
              if (!isResolving) {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.16)";
                e.currentTarget.style.color = "#f87171";
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            }}
          >
            ✕ Denegar
          </button>
        </div>

        {/* Barra de progreso de tiempo decreciente */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "3px",
            backgroundColor: "rgba(255, 255, 255, 0.1)"
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              backgroundColor: riskBadgeColor,
              boxShadow: `0 0 8px ${riskBadgeColor}`,
              transition: "width 1s linear"
            }}
          />
        </div>
      </div>
    );
  }

  // 2. Micro-Animación de Estados en la Isla (Listening / Thinking / Speaking / Executing / Error)
  const isSpeaking = state === "speaking" || (state === "action_started" && label.toLowerCase().includes("hablando"));
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isExecuting = state === "action_started" && !isSpeaking;
  const isError = state === "error";

  const glowColor = isListening
    ? "#00e5ff"
    : isThinking
    ? "#c084fc"
    : isSpeaking
    ? "#10b981"
    : isExecuting
    ? "#f59e0b"
    : isError
    ? "#ef4444"
    : "#10b981";

  const statusText = label || (
    isListening
      ? "Escuchando..."
      : isThinking
      ? "Pensando..."
      : isSpeaking
      ? "Hablando..."
      : isExecuting
      ? "Ejecutando..."
      : isError
      ? "Aviso"
      : "JARVIS"
  );

  return (
    <>
      <style>{`
        @keyframes jarvisSlideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }
        @keyframes jarvisPulseGlow {
          0%, 100% {
            box-shadow: 0 0 8px ${glowColor}40, 0 0 16px ${glowColor}20;
          }
          50% {
            box-shadow: 0 0 14px ${glowColor}70, 0 0 24px ${glowColor}40;
          }
        }
        @keyframes jarvisWave1 {
          0%, 100% { height: 4px; }
          50% { height: 11px; }
        }
        @keyframes jarvisWave2 {
          0%, 100% { height: 9px; }
          50% { height: 4px; }
        }
        @keyframes jarvisWave3 {
          0%, 100% { height: 5px; }
          50% { height: 12px; }
        }
        @keyframes jarvisSpinShimmer {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="jarvis-island-pill"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          padding: "3px 10px",
          borderRadius: "14px",
          backgroundColor: "rgba(10, 14, 23, 0.72)",
          border: `1px solid ${glowColor}50`,
          marginLeft: "8px",
          fontSize: "10.5px",
          color: "#f8fafc",
          fontWeight: "600",
          animation: "jarvisPulseGlow 2.5s ease-in-out infinite",
          backdropFilter: "blur(12px)",
          cursor: "default",
          userSelect: "none"
        }}
        title={`JARVIS: ${statusText}`}
      >
        {/* Indicador visual animado según el estado */}
        {isListening || isSpeaking ? (
          // Ecualizador de 3 barras para voz (escucha o habla)
          <div style={{ display: "inline-flex", alignItems: "center", gap: "2px", height: "12px" }}>
            <span
              style={{
                width: "2.5px",
                backgroundColor: glowColor,
                borderRadius: "2px",
                animation: "jarvisWave1 0.75s ease-in-out infinite"
              }}
            />
            <span
              style={{
                width: "2.5px",
                backgroundColor: glowColor,
                borderRadius: "2px",
                animation: "jarvisWave2 0.75s ease-in-out infinite 0.2s"
              }}
            />
            <span
              style={{
                width: "2.5px",
                backgroundColor: glowColor,
                borderRadius: "2px",
                animation: "jarvisWave3 0.75s ease-in-out infinite 0.4s"
              }}
            />
          </div>
        ) : isThinking ? (
          // Anillo giratorio para procesamiento
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              border: `2px solid ${glowColor}30`,
              borderTopColor: glowColor,
              animation: "jarvisSpinShimmer 0.9s linear infinite"
            }}
          />
        ) : (
          // Punto resplandeciente
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: glowColor,
              display: "inline-block",
              boxShadow: `0 0 10px ${glowColor}`
            }}
          />
        )}

        <span style={{ letterSpacing: "0.2px" }}>{statusText}</span>
      </div>
    </>
  );
}
