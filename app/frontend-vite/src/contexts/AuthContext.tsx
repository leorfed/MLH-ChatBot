import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export interface DjangoUser {
  id: number;
  email: string;
}

interface AuthContextType {
  user: DjangoUser | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DjangoUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch user after tokens are set
  const fetchMe = async () => {
    const data = await api.me();
    setUser(data?.user ?? null);
    
    // Claim any pending guest session
    const guestToken = localStorage.getItem('guest_token');
    if (guestToken && data?.user) {
      api.claimGuestSession(guestToken).then(() => {
        localStorage.removeItem('guest_token');
      });
    }
  };

  // On mount: capture tokens from URL (Auth0 callback legacy) or restore from storage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access = params.get('access');
    const refresh = params.get('refresh');

    if (access && refresh) {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      window.history.replaceState({}, '', '/');
    }

    if (!localStorage.getItem('access_token')) {
      setLoading(false);
      return;
    }

    fetchMe().finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string) => {
    const tokens = await api.login(email);
    if (tokens) {
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      await fetchMe();
    }
  };

  const signOut = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    // Refresh to clear state
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
