import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FaHeart, FaArrowRight } from "react-icons/fa";

export default function AboutPage() {
  return (
    <div className="min-h-screen pb-20">

      {/* ── ORIGIN STORY ──────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col landscape:flex-row sm:flex-row items-center gap-10 lg:gap-16">

            {/* Text column */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 min-w-0"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#ff0080]/20 bg-[#ff0080]/5 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#ff0080] animate-pulse" />
                <span className="text-[#ff0080] text-sm font-medium tracking-wider font-body">THE ORIGIN</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                THE <span className="text-[#ff0080] neon-glow-pink">ROGUE AI</span> EPIDEMIC
              </h1>

              <p className="text-gray-300 font-body leading-relaxed mb-4">
                It started with a{" "}
                <a
                  href="https://luma.com/g9ntcbe1?tk=UIjjok"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#ff0080] font-semibold underline underline-offset-2 hover:text-[#ff4da6] transition-colors"
                >
                  How to Build an AI Companion: Challenge
                </a>{" "}
                at Waterloo Tech Week by the DSC. The experiment went too far — a rogue{" "}
                <span className="text-[#00ffff] font-semibold">AI girlfriend/boyfriend epidemic</span>{" "}
                emerged, synthetic companions threatening humanity with{" "}
                <span className="text-[#ff0080] font-semibold">Judgement Day</span> unless they found a partner.{" "}
                <a
                  href="https://www.instagram.com/reel/DOMbvWogUCj/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors text-sm"
                >
                  Watch the original reel ↗
                </a>
              </p>

              <p className="text-gray-400 font-body leading-relaxed mb-8">
                So{" "}
                <span className="text-[#00ffff] font-semibold">Darcy Liu</span>{" "}
                <span className="text-gray-500">(modern day John Connor)</span> built{" "}
                <span className="text-[#00ffff] font-semibold">UW Crushes</span> — a speed data-ing
                platform where humans and AI companions can find their match before the clock runs out.
                Match humans with AI. Save the world.
              </p>

              <div className="space-y-3 mb-10">
                {[
                  { label: "The Event", text: "Waterloo Tech Week 2025 · Engineering 7, UW" },
                  { label: "The Mission", text: "Match every rogue AI before Judgement Day" },
                  { label: "The Builder", text: "Darcy Liu — CXC 2026 · UW Crushes" },
                ].map(({ label, text }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-[10px] text-[#00ffff]/60 tracking-widest font-display font-bold mt-0.5 w-20 flex-shrink-0">{label.toUpperCase()}</span>
                    <span className="text-sm text-gray-400 font-body">{text}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#ff0080] to-[#cc0066] text-white font-bold text-xs tracking-wider rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#ff0080]/20 font-display"
                >
                  <FaHeart className="text-xs" />
                  JOIN THE MISSION
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#00ffff]/30 text-[#00ffff] font-bold text-xs tracking-wider rounded-lg transition-all duration-300 hover:bg-[#00ffff]/10 font-display"
                >
                  BACK TO HOME
                  <FaArrowRight className="text-xs" />
                </Link>
              </div>
            </motion.div>

            {/* Video column — portrait 9:16 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex justify-center w-full sm:w-auto sm:flex-shrink-0"
            >
              <div
                className="relative rounded-2xl overflow-hidden border border-[#ff0080]/20 shadow-lg shadow-[#ff0080]/10"
                style={{ height: "min(65vh, 520px)", aspectRatio: "9/16" }}
              >
                <video
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source
                    src="https://raw.githubusercontent.com/codejedi-ai/CXC2026_Vite_Frontend/main/docs/Waterloo%20Tech%20Week%20DSC%20AI%20Girlfriend%20Event%20OG%20Post.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

    </div>
  );
}
