import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { Layout } from "@/Layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { VoiceChatModal } from "@/components/VoiceChatModal";
import { HiSignal } from "react-icons/hi2";
import LandingPage from "@/pages/LandingPage";
import DiscoverPage from "@/pages/DiscoverPage";
import AboutPage from "@/pages/AboutPage";
import ProfileDetailPage from "@/pages/ProfileDetailPage";
import MyProfilePage from "@/pages/MyProfilePage";
import MyImagesPage from "@/pages/MyImagesPage";
import SettingsPage from "@/pages/SettingsPage";
import cyberpunkTheme from "@/theme/theme";

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/discover" replace />;
  return <>{children}</>;
}

function Auth0Redirect() {
  useEffect(() => { window.location.href = '/api/auth/auth0/login/'; }, []);
  return null;
}

// Single shell for all non-landing routes.
// Logged-in: persistent sidebar. Guest: top navbar via Layout.
function AppShell() {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00ffff]/30 border-t-[#00ffff] rounded-full animate-spin" />
    </div>
  );

  if (user) {
    return (
      <div className="flex min-h-screen">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((p) => !p)}
          mobileOpen={mobileOpen}
          onMobileToggle={() => setMobileOpen((p) => !p)}
        />
        <main
          className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${
            collapsed ? "sm:ml-[72px]" : "sm:ml-[240px]"
          }`}
        >
          <Outlet />
        </main>

        <button
          onClick={() => setVoiceOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#00ffff] to-[#0099cc] flex items-center justify-center shadow-lg shadow-[#00ffff]/20 hover:scale-110 transition-all duration-300 hover:shadow-xl hover:shadow-[#00ffff]/30"
          aria-label="Open voice chat"
        >
          <HiSignal className="text-black text-xl" />
        </button>

        <VoiceChatModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      </div>
    );
  }

  return <Layout />;
}

function App() {
  return (
    <ThemeProvider theme={cyberpunkTheme}>
      <CssBaseline />
      <Router>
        <ScrollToTop />
        <AuthProvider>
          <PresenceProvider>
          <ChatProvider>
          <Routes>
            {/* Landing — redirects logged-in users */}
            <Route path="/" element={<RedirectIfAuth><Layout /></RedirectIfAuth>}>
              <Route index element={<LandingPage />} />
              <Route path="login" element={<Auth0Redirect />} />
              <Route path="signup" element={<Auth0Redirect />} />
            </Route>

            {/* All other routes share one shell (sidebar or navbar, never both) */}
            <Route element={<AppShell />}>
              <Route path="about" element={<AboutPage />} />
              <Route path="profile/:id" element={<ProfileDetailPage />} />

              {/* Protected — redirect to Auth0 if not logged in */}
              <Route path="discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
              <Route path="my-profile" element={<ProtectedRoute><MyProfilePage /></ProtectedRoute>} />
              <Route path="my-images" element={<ProtectedRoute><MyImagesPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            </Route>
          </Routes>
          </ChatProvider>
          </PresenceProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
