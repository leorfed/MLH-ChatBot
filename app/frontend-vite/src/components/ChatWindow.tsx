import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPaperPlane, FaRobot, FaUser, FaLock } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { createChatSocket } from "@/lib/api";
import type { Profile } from "@/lib/types";

interface Props {
  profile: Profile;
}

export function ChatWindow({ profile }: Props) {
  const { messages, loadMessages, persistMessage } = useChat();
  const { user } = useAuth();
  const profileMessages = messages[profile.id] ?? [];

  const [input, setInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadMessages(profile.id);
  }, [profile.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [profileMessages]);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setIsConnecting(true);

    const ws = createChatSocket(
      profile.id,
      async (data) => {
        setIsTyping(false);
        const content = (data.message as string) || (data.content as string) || JSON.stringify(data);
        await persistMessage(profile.id, "assistant", content);
      },
      () => {
        setIsConnecting(false);
        setIsTyping(false);
        wsRef.current = null;
      },
    );

    ws.onopen = () => setIsConnecting(false);
    wsRef.current = ws;
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");

    // Persist user message
    await persistMessage(profile.id, "user", text);

    // Send over WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsTyping(true);
      wsRef.current.send(JSON.stringify({ message: text }));
    } else {
      // Auto-connect and send
      connect();
      // Message is persisted; user can hit send again once connected
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  return (
    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col" style={{ height: "500px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <HiSparkles className="text-[#00ffff]" />
          <div>
            <span className="text-sm font-bold text-white font-display tracking-wider">
              CHAT WITH {profile.display_name.toUpperCase()}
            </span>
            {!user && (
              <p className="text-[10px] text-gray-500 font-body mt-0.5">
                Guest session — history saves on login
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!user && (
            <a
              href="/api/auth/auth0/login/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ff0080]/30 text-[#ff0080] text-[10px] font-bold tracking-wider font-display hover:bg-[#ff0080]/10 transition-all"
            >
              <FaLock className="text-[8px]" />
              SIGN IN
            </a>
          )}
          <button
            onClick={connect}
            disabled={isConnected || isConnecting}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider font-display transition-all ${
              isConnected
                ? "border border-[#00ff88]/30 text-[#00ff88] cursor-default"
                : isConnecting
                  ? "border border-gray-700 text-gray-500 cursor-wait"
                  : "border border-[#00ffff]/30 text-[#00ffff] hover:bg-[#00ffff]/10"
            }`}
          >
            {isConnected ? "CONNECTED" : isConnecting ? "CONNECTING…" : "CONNECT"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
        {profileMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <HiSparkles className="text-[#00ffff]/30 text-3xl" />
            <p className="text-gray-600 text-sm font-body">
              Start a conversation with {profile.display_name}
            </p>
            {!isConnected && (
              <p className="text-gray-700 text-xs font-body">
                Click CONNECT to enable live AI responses
              </p>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {profileMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                  msg.role === "user"
                    ? "bg-[#ff0080]/20 text-[#ff0080]"
                    : "bg-[#00ffff]/20 text-[#00ffff]"
                }`}
              >
                {msg.role === "user" ? <FaUser /> : <FaRobot />}
              </div>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-body leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#ff0080]/15 border border-[#ff0080]/20 text-white rounded-tr-sm"
                    : "bg-[#00ffff]/8 border border-[#00ffff]/15 text-gray-200 rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2.5"
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00ffff]/20 text-[#00ffff] flex items-center justify-center text-xs">
              <FaRobot />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#00ffff]/8 border border-[#00ffff]/15">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ffff]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ffff]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ffff]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Message ${profile.display_name}…`}
          className="flex-1 bg-[#0a0b1a]/80 border border-[#00ffff]/15 rounded-xl px-4 py-2.5 text-sm text-white font-body placeholder:text-gray-600 focus:outline-none focus:border-[#00ffff]/40 transition-colors"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#00ffff]/20 to-[#0099cc]/20 border border-[#00ffff]/30 text-[#00ffff] flex items-center justify-center hover:from-[#00ffff]/30 hover:to-[#0099cc]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FaPaperPlane className="text-xs" />
        </button>
      </div>
    </div>
  );
}
