import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { VoiceChatModal } from "@/components/VoiceChatModal";
import { HiSignal } from "react-icons/hi2";

export function AuthenticatedLayout() {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen((prev) => !prev)}
      />
      <main
        className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "sm:ml-[72px]" : "sm:ml-[240px]"
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
