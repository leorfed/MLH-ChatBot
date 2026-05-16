/**
 * Tracks user activity (mouse moves, clicks, keypresses) and sends a
 * heartbeat to the backend while the user is active. The backend marks
 * last_seen on each heartbeat; profiles are considered online when
 * last_seen is within the last 3 minutes.
 *
 * Active  → heartbeat every 30 s
 * Idle    → no heartbeat (user appears offline after 3 min)
 * Idle threshold: 90 seconds of no activity
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const IDLE_TIMEOUT_MS = 90_000;   // 90 s no activity → idle
const HEARTBEAT_MS   = 30_000;   // send heartbeat every 30 s while active

interface PresenceContextType {
  /** Call to manually signal activity (e.g. from chat input) */
  ping: () => void;
}

const PresenceContext = createContext<PresenceContextType>({ ping: () => {} });

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = useCallback(async () => {
    if (!user) return;
    const idle = Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS;
    if (!idle) {
      await api.heartbeat();
    }
  }, [user]);

  const ping = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Activity listeners
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Send immediately on login, then on interval
    sendHeartbeat();
    heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [user, sendHeartbeat]);

  return (
    <PresenceContext.Provider value={{ ping }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
