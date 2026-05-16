import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const email = window.prompt("This page requires authentication. Please enter your email to sign in:");
      if (email) {
        signIn(email);
      } else {
        window.location.href = '/';
      }
    }
  }, [loading, user, signIn]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#00ffff]/30 border-t-[#00ffff] rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
