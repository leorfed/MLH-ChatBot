import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
  FaPhone,
  FaTimes,
} from "react-icons/fa";
import { HiSignal } from "react-icons/hi2";
import { useAudioRoom, type RoomStatus } from "@/hooks/useAudioRoom";
import { fetchLiveKitConnection, DEFAULT_ROOM } from "@/lib/livekit";

interface VoiceChatModalProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  RoomStatus,
  { label: string; color: string; bg: string }
> = {
  disconnected: {
    label: "DISCONNECTED",
    color: "text-gray-500",
    bg: "bg-gray-500",
  },
  connecting: {
    label: "CONNECTING",
    color: "text-yellow-400",
    bg: "bg-yellow-400",
  },
  connected: {
    label: "CONNECTED",
    color: "text-[#00ff88]",
    bg: "bg-[#00ff88]",
  },
};

const TOKEN_API_URL = import.meta.env.VITE_LIVEKIT_TOKEN_API ?? "";

export function VoiceChatModal({ open, onClose }: VoiceChatModalProps) {
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState(DEFAULT_ROOM);
  const [quickConnectError, setQuickConnectError] = useState<string | null>(null);
  const [quickConnecting, setQuickConnecting] = useState(false);
  const { status, logs, micEnabled, connect, disconnect, toggleMic, addLog } =
    useAudioRoom();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleConnect = () => {
    if (!serverUrl.trim() || !token.trim()) return;
    connect(serverUrl.trim(), token.trim());
  };

  const handleQuickConnect = async () => {
    if (!TOKEN_API_URL.trim()) {
      setQuickConnectError("Set VITE_LIVEKIT_TOKEN_API in .env (e.g. http://localhost:8765)");
      return;
    }
    setQuickConnectError(null);
    setQuickConnecting(true);
    try {
      addLog("Fetching credentials from backend...", "info");
      const { token: jwt, url } = await fetchLiveKitConnection(
        TOKEN_API_URL,
        roomName.trim() || DEFAULT_ROOM,
        "user"
      );
      setServerUrl(url);
      setToken(jwt);
      addLog("Token received, connecting to LiveKit...", "success");
      connect(url, jwt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setQuickConnectError(msg);
      addLog(`Quick connect failed: ${msg}`, "error");
    } finally {
      setQuickConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const cfg = STATUS_CONFIG[status];
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[61] sm:w-full sm:max-w-lg sm:max-h-[85vh] flex flex-col rounded-2xl overflow-hidden border border-[#00ffff]/15 bg-[#0a0b1a]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#00ffff]/10 bg-[#0a0b1a]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ffff] to-[#0099cc] flex items-center justify-center">
                  <HiSignal className="text-black text-sm" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wider font-display">
                    VOICE LINK
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${cfg.bg} ${
                        status === "connecting" ? "animate-pulse" : ""
                      }`}
                    />
                    <span
                      className={`text-[10px] tracking-wider font-body ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* Quick connect: get token from AI-GF token server and connect */}
              {TOKEN_API_URL && (
                <div className="space-y-2 p-3 rounded-lg border border-[#00ffff]/20 bg-[#00ffff]/5">
                  <span className="text-[10px] font-bold text-[#00ffff]/80 tracking-wider uppercase font-body">
                    Quick connect (AI-GF backend)
                  </span>
                  <div className="flex gap-2 flex-wrap items-center">
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Room name"
                      disabled={isConnected || isConnecting}
                      className="flex-1 min-w-[120px] px-3 py-2 bg-[#050714] border border-[#00ffff]/15 rounded-lg text-white text-sm font-body placeholder:text-gray-600 focus:outline-none focus:border-[#00ffff]/40 disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={handleQuickConnect}
                      disabled={isConnected || isConnecting || quickConnecting}
                      className="px-4 py-2 bg-gradient-to-r from-[#00ffff] to-[#0099cc] text-black font-bold text-xs tracking-wider rounded-lg transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {quickConnecting ? "Connecting…" : "Quick connect"}
                    </button>
                  </div>
                  {quickConnectError && (
                    <p className="text-[10px] text-red-400 font-body">
                      {quickConnectError}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-wider uppercase mb-1.5 font-body">
                    LiveKit Server URL
                  </label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="wss://your-project.livekit.cloud"
                    disabled={isConnected || isConnecting}
                    className="w-full px-3.5 py-2.5 bg-[#050714] border border-[#00ffff]/15 rounded-lg text-white text-sm font-body placeholder:text-gray-700 focus:outline-none focus:border-[#00ffff]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-wider uppercase mb-1.5 font-body">
                    Access Token (JWT)
                  </label>
                  <textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your LiveKit JWT token here..."
                    disabled={isConnected || isConnecting}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-[#050714] border border-[#00ffff]/15 rounded-lg text-white text-sm font-body font-mono placeholder:text-gray-700 focus:outline-none focus:border-[#00ffff]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    disabled={
                      isConnecting || !serverUrl.trim() || !token.trim()
                    }
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#00ffff] to-[#0099cc] text-black font-bold text-xs tracking-wider rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#00ffff]/20 font-display disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <FaPhone className="text-[10px]" />
                    {isConnecting ? "CONNECTING..." : "CONNECT"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMic}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg font-bold text-xs tracking-wider transition-all duration-300 hover:scale-[1.02] font-display ${
                        micEnabled
                          ? "border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10"
                          : "border-[#ff0080]/30 text-[#ff0080] hover:bg-[#ff0080]/10"
                      }`}
                    >
                      {micEnabled ? (
                        <FaMicrophone className="text-sm" />
                      ) : (
                        <FaMicrophoneSlash className="text-sm" />
                      )}
                      {micEnabled ? "MIC ON" : "MUTED"}
                    </button>

                    <button
                      onClick={handleDisconnect}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold text-xs tracking-wider rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-600/20 font-display"
                    >
                      <FaPhoneSlash className="text-[10px]" />
                      DISCONNECT
                    </button>
                  </>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase font-body">
                    Status Log
                  </span>
                  <span className="text-[10px] text-gray-700 font-body">
                    {logs.length} entries
                  </span>
                </div>
                <div className="bg-[#050714] border border-[#00ffff]/10 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
                  {logs.length === 0 && (
                    <span className="text-gray-700">
                      Waiting for connection...
                    </span>
                  )}
                  {logs.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex gap-2 py-0.5 leading-relaxed"
                    >
                      <span className="text-gray-600 flex-shrink-0">
                        [{entry.time}]
                      </span>
                      <span
                        className={
                          entry.type === "error"
                            ? "text-red-400"
                            : entry.type === "success"
                            ? "text-[#00ff88]"
                            : "text-gray-400"
                        }
                      >
                        {entry.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
