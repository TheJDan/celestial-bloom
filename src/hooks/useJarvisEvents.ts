// bloom_repo/src/hooks/useJarvisEvents.ts
// Clean Architecture: Hook React para la integración bidireccional de JARVIS en la Isla de Bloom.
// Conecta por WebSocket local (ws://127.0.0.1:8766) con reconexión automática y tolerancia a fallos.

import { useState, useEffect, useRef, useCallback } from "react";

export interface JarvisApprovalData {
  action_id: string;
  title: string;
  command: string;
  risk_level: string;
  timeout_seconds: number;
}

export interface JarvisEvent {
  type: string;
  session_id: string;
  state: "started" | "listening" | "thinking" | "action_started" | "needs_approval" | "completed" | "error" | "idle" | "approval_resolved";
  label: string;
  timestamp: number;
  data?: Record<string, any>;
}

export function useJarvisEvents() {
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<string>("idle");
  const [label, setLabel] = useState<string>("");
  const [approval, setApproval] = useState<JarvisApprovalData | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket("ws://127.0.0.1:8766");
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setLastActivity(Date.now());
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setLastActivity(Date.now());

          if (msg.type === "jarvis_event" && msg.event) {
            const ev: JarvisEvent = msg.event;
            setState(ev.state);
            setLabel(ev.label || "");

            if (ev.state === "needs_approval" && ev.data) {
              setApproval({
                action_id: ev.data.action_id || ev.data.approval_id || "",
                title: ev.data.title || "Confirmación requerida",
                command: ev.data.command || "",
                risk_level: ev.data.risk_level || "medium",
                timeout_seconds: ev.data.timeout_seconds || 15
              });
            } else if (ev.state === "completed" || ev.state === "error" || ev.state === "idle" || ev.state === "approval_resolved") {
              setApproval(null);
            }
          } else if (msg.type === "approval_result") {
            setApproval(null);
          } else if (msg.type === "state") {
            const st = (msg.value || "").toLowerCase();
            setState(st);
            if (st === "listening") setLabel("Escuchando...");
            if (st === "thinking") setLabel("Pensando...");
            if (st === "idle") {
              setLabel("");
              setApproval(null);
            }
          }
        } catch {
          // Ignore parsing error
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setState("idle");
        setApproval(null);
        reconnectTimeout.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch {
      setIsConnected(false);
      reconnectTimeout.current = window.setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const sendApproval = useCallback(async (actionId: string, approved: boolean) => {
    try {
      await fetch("http://127.0.0.1:8765/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, approval_id: actionId, approved, client_id: "bloom_island" })
      });
      setApproval(null);
    } catch (e) {
      console.warn("Error sending approval:", e);
    }
  }, []);

  return {
    isConnected,
    state,
    label,
    approval,
    lastActivity,
    sendApproval
  };
}
