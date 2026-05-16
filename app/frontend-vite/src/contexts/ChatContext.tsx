import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api, type ChatMessage } from "@/lib/api";

interface ChatContextType {
  /** messages[profileId] → sorted message array */
  messages: Record<string | number, ChatMessage[]>;
  loadMessages: (profileId: string | number) => Promise<void>;
  persistMessage: (profileId: string | number, role: "user" | "assistant", content: string) => Promise<void>;
  guestToken: string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Record<string | number, ChatMessage[]>>({});
  const [guestToken, setGuestToken] = useState<string | null>(
    () => localStorage.getItem("guest_token"),
  );
  const initRef = useRef(false);

  // Ensure a guest token exists for anonymous users
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const existing = localStorage.getItem("guest_token");
    if (existing) {
      setGuestToken(existing);
      return;
    }
    // Only issue a guest token when there is no auth token
    if (!localStorage.getItem("access_token")) {
      api.createGuestSession().then((token) => {
        if (token) {
          localStorage.setItem("guest_token", token);
          setGuestToken(token);
        }
      });
    }
  }, []);

  const loadMessages = useCallback(async (profileId: string | number) => {
    const data = await api.getChatHistory(profileId);
    setMessages((prev) => ({ ...prev, [profileId]: data }));
  }, []);

  const persistMessage = useCallback(
    async (profileId: string | number, role: "user" | "assistant", content: string) => {
      const msg = await api.postChatMessage(profileId, role, content);
      if (msg) {
        setMessages((prev) => ({
          ...prev,
          [profileId]: [...(prev[profileId] ?? []), msg],
        }));
      }
    },
    [],
  );

  return (
    <ChatContext.Provider value={{ messages, loadMessages, persistMessage, guestToken }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
