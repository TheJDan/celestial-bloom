// bloom_repo/src/hooks/useJarvisEvents.ts
// Clean Architecture: Hook React para la integración bidireccional de JARVIS en la Isla de Bloom.
// Conecta por WebSocket local (ws://127.0.0.1:8766) con reconexión automática, tolerancia a fallos,
// telemetría de diagnóstico y control por configuración.

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
  const [isEnabled, setIsEnabledState] = useState<boolean>(() => {
    return localStorage.getItem("bloom-jarvis-enabled") !== "false";
  });
  const [islandPillEnabled, setIslandPillEnabledState] = useState<boolean>(() => {
    return localStorage.getItem("bloom-jarvis-island-pill") !== "false";
  });
  const [approvalsEnabled, setApprovalsEnabledState] = useState<boolean>(() => {
    return localStorage.getItem("bloom-jarvis-approvals-enabled") !== "false";
  });

  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<string>("idle");
  const [label, setLabel] = useState<string>("");
  const [approval, setApproval] = useState<JarvisApprovalData | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  // Sincronizar cambios de configuración entre ventanas
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "bloom-jarvis-enabled") {
        setIsEnabledState(e.newValue !== "false");
      } else if (e.key === "bloom-jarvis-island-pill") {
        setIslandPillEnabledState(e.newValue !== "false");
      } else if (e.key === "bloom-jarvis-approvals-enabled") {
        setApprovalsEnabledState(e.newValue !== "false");
      }
    };

    const handleCustom = () => {
      setIsEnabledState(localStorage.getItem("bloom-jarvis-enabled") !== "false");
      setIslandPillEnabledState(localStorage.getItem("bloom-jarvis-island-pill") !== "false");
      setApprovalsEnabledState(localStorage.getItem("bloom-jarvis-approvals-enabled") !== "false");
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("bloom-jarvis-settings-updated", handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("bloom-jarvis-settings-updated", handleCustom);
    };
  }, []);

  const connect = useCallback(() => {
    // Si la integración está desactivada, no conectar
    const currentEnabled = localStorage.getItem("bloom-jarvis-enabled") !== "false";
    if (!currentEnabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setState("idle");
      setApproval(null);
      return;
    }

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
              const currentApprovals = localStorage.getItem("bloom-jarvis-approvals-enabled") !== "false";
              if (currentApprovals) {
                setApproval({
                  action_id: ev.data.action_id || ev.data.approval_id || "",
                  title: ev.data.title || "Confirmación requerida",
                  command: ev.data.command || "",
                  risk_level: ev.data.risk_level || "medium",
                  timeout_seconds: ev.data.timeout_seconds || 15
                });
              }
            } else if (ev.state === "completed" || ev.state === "error" || ev.state === "idle" || ev.state === "approval_resolved") {
              setApproval(null);
            }
          } else if (msg.type === "approval_result") {
            setApproval(null);
          } else if (msg.type === "init") {
            const st = (msg.state || "").toLowerCase();
            if (st === "listening") {
              setState("listening");
              setLabel("Escuchando...");
            } else if (st === "thinking") {
              setState("thinking");
              setLabel("Pensando...");
            } else if (st === "speaking") {
              setState("speaking");
              setLabel("Hablando...");
            } else if (st === "action_started") {
              setState("action_started");
              setLabel("Ejecutando...");
            } else {
              setState("idle");
              setLabel("");
            }
          } else if (msg.type === "state") {
            const st = (msg.value || "").toLowerCase();
            setState(st);
            if (st === "listening") setLabel("Escuchando...");
            else if (st === "thinking") setLabel("Pensando...");
            else if (st === "speaking") setLabel("Hablando...");
            else if (st === "action_started") setLabel("Ejecutando...");
            else if (st === "idle" || st === "sleeping") {
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
        if (localStorage.getItem("bloom-jarvis-enabled") !== "false") {
          reconnectTimeout.current = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch {
      setIsConnected(false);
      if (localStorage.getItem("bloom-jarvis-enabled") !== "false") {
        reconnectTimeout.current = window.setTimeout(connect, 3000);
      }
    }
  }, []);

  useEffect(() => {
    if (isEnabled) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setState("idle");
      setApproval(null);
    }

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect, isEnabled]);

  const sendApproval = useCallback(async (actionId: string, approved: boolean): Promise<boolean> => {
    try {
      const res = await fetch("http://127.0.0.1:8765/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_id: actionId,
          approval_id: actionId,
          approved,
          client_id: "bloom_island"
        })
      });
      setApproval(null);
      return res.ok;
    } catch (e) {
      console.warn("Error sending approval from Bloom:", e);
      setApproval(null);
      return false;
    }
  }, []);

  const pingStatus = useCallback(async (): Promise<{ ok: boolean; latencyMs: number | null; state?: string }> => {
    const start = performance.now();
    try {
      const res = await fetch("http://127.0.0.1:8765/api/status", { cache: "no-store" });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) return { ok: false, latencyMs: null };
      const data = await res.json();
      return { ok: true, latencyMs: latency, state: data.state || "ONLINE" };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }, []);

  const setJarvisEnabled = useCallback((val: boolean) => {
    localStorage.setItem("bloom-jarvis-enabled", String(val));
    setIsEnabledState(val);
    window.dispatchEvent(new CustomEvent("bloom-jarvis-settings-updated"));
  }, []);

  const setJarvisIslandPill = useCallback((val: boolean) => {
    localStorage.setItem("bloom-jarvis-island-pill", String(val));
    setIslandPillEnabledState(val);
    window.dispatchEvent(new CustomEvent("bloom-jarvis-settings-updated"));
  }, []);

  const setJarvisApprovals = useCallback((val: boolean) => {
    localStorage.setItem("bloom-jarvis-approvals-enabled", String(val));
    setApprovalsEnabledState(val);
    window.dispatchEvent(new CustomEvent("bloom-jarvis-settings-updated"));
  }, []);

  return {
    isEnabled,
    islandPillEnabled,
    approvalsEnabled,
    isConnected,
    state,
    label,
    approval,
    lastActivity,
    sendApproval,
    pingStatus,
    setJarvisEnabled,
    setJarvisIslandPill,
    setJarvisApprovals
  };
}
