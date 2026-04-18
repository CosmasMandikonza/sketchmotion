import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/layout/GlassCard";
import { ArrowRight, GitBranch, PanelRightOpen, RefreshCcw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

function DancingMascot() {
  return (
    <motion.div
      className="flex justify-center mb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      <div className="animate-mascot-dance">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12 md:w-16 md:h-16"
        >
          <rect
            x="16"
            y="20"
            width="32"
            height="28"
            rx="4"
            fill="url(#boardGradient)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2"
          />
          <line x1="16" y1="32" x2="48" y2="32" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="32" y1="20" x2="32" y2="48" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

          <g transform="rotate(-25, 52, 18)">
            <rect x="46" y="4" width="8" height="36" rx="2" fill="url(#penGradient)" />
            <polygon points="46,40 54,40 50,50" fill="#FF3D8F" />
            <rect x="46" y="28" width="8" height="8" fill="rgba(255,255,255,0.3)" rx="1" />
          </g>

          <circle cx="12" cy="16" r="2" fill="#FF6BD5" opacity="0.8" />
          <circle cx="56" cy="52" r="1.5" fill="#A78BFA" opacity="0.8" />
          <circle cx="8" cy="40" r="1" fill="#FF8A33" opacity="0.6" />

          <defs>
            <linearGradient id="boardGradient" x1="16" y1="20" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A78BFA" stopOpacity="0.4" />
              <stop offset="1" stopColor="#C471ED" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="penGradient" x1="46" y1="4" x2="54" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF6B9D" />
              <stop offset="1" stopColor="#C471ED" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </motion.div>
  );
}

function CanvasPreview() {
  return (
    <div
      className="aspect-[4/3] rounded-xl bg-sm-charcoal/60 relative overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
          <PanelRightOpen className="h-3.5 w-3.5 text-sm-magenta" />
          <span className="text-[11px] font-medium text-white/85">Storyboard Workspace</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          <span className="text-[11px] font-medium text-white/85">Review-ready</span>
        </div>
      </div>

      <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 400 300">
        <defs>
          <linearGradient id="previewConnection" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6B9D" />
            <stop offset="100%" stopColor="#C471ED" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 96 110 C 145 92 176 96 214 124"
          stroke="url(#previewConnection)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.45 }}
        />
        <motion.path
          d="M 120 192 C 168 214 186 214 215 188"
          stroke="url(#previewConnection)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.75 }}
        />
      </svg>

      <motion.div
        className="absolute left-6 top-16 w-[132px] rounded-2xl border border-white/15 bg-white/6 p-2 shadow-xl backdrop-blur-sm"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.45 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">Frame 01</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">2.0s</span>
        </div>
        <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-sm-pink/30 to-sm-coral/20" />
        <p className="mt-2 text-xs text-white/80">Hero beat</p>
        <p className="mt-1 text-[11px] text-white/45">Rough board with timing notes</p>
      </motion.div>

      <motion.div
        className="absolute left-8 top-44 w-[132px] rounded-2xl border border-white/15 bg-white/6 p-2 shadow-xl backdrop-blur-sm"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.45 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">Frame 02</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">1.5s</span>
        </div>
        <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-sm-soft-purple/25 to-sm-purple/25" />
        <p className="mt-2 text-xs text-white/80">Polished frame</p>
        <p className="mt-1 text-[11px] text-white/45">Visual style carries into motion</p>
      </motion.div>

      <motion.div
        className="absolute right-5 top-[78px] w-[172px] rounded-[22px] border border-white/15 bg-black/35 p-3 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Review Flow</p>
            <h4 className="mt-1 text-sm font-semibold text-white">Polish, motion, and revision</h4>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60">
            Ready to share
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {["Style-aware", "Review-ready", "Guardrails on"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] text-white/72"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-sm-magenta" />
            <span className="text-xs font-medium text-white/80">Workflow highlights</span>
          </div>
          <ul className="space-y-2 text-[11px] leading-relaxed text-white/63">
            <li>Polish rough frames without changing the shot.</li>
            <li>Carry the chosen visual style into motion generation.</li>
            <li>Revise, share, and export without rebuilding the board.</li>
          </ul>
        </div>

        <div className="mt-3 rounded-2xl border border-sm-magenta/20 bg-sm-magenta/10 px-3 py-2 text-[11px] text-white/82">
          Review note: keep the timing, soften the camera move, and export this pass for feedback.
        </div>
      </motion.div>

      <div className="absolute bottom-5 right-5 left-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Keep the creative loop moving</p>
          <p className="truncate text-xs text-white/75">
            Sketch, polish, motion, review, and export stay in one workspace.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2 py-1 text-[10px] text-white/75">
          <RefreshCcw className="h-3 w-3" />
          Ready to share
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="pt-24 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="lg:hidden">
              <DancingMascot />
            </div>

            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4 text-sm-magenta" />
              <span className="text-sm font-medium text-white">Storyboard-to-motion workspace you can trust</span>
            </motion.div>

            <div className="relative">
              <div className="hidden lg:flex justify-center lg:justify-start mb-4">
                <DancingMascot />
              </div>
              <h1 className="font-display font-extrabold text-5xl md:text-6xl lg:text-7xl text-white leading-tight mb-6">
                From rough boards{" "}
                <span className="gradient-text">to review-ready motion.</span>
              </h1>
            </div>

            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto lg:mx-0">
              SketchMotion gives storyboard artists, creative leads, and motion teams one place to
              sketch frames, polish visuals, generate motion, review revisions, share boards, and
              export with confidence. Built to stay usable where creative tools usually break.
            </p>

            <div className="flex justify-center lg:justify-start">
              <Link to="/dashboard">
                <Button
                  size="lg"
                  className="bg-sm-magenta hover:bg-sm-magenta/90 text-white font-bold text-lg px-8 py-6 shadow-glow hover:shadow-glow-lg transition-all btn-press group"
                >
                  Open SketchMotion
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-3 justify-center lg:justify-start">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sm-pink to-sm-purple flex items-center justify-center">
                <PanelRightOpen className="w-5 h-5 text-white" />
              </div>
              <p className="text-white/70 text-sm">
                Made for storyboard artists, creative leads, motion teams, and reviewers who need
                a dependable handoff from board to polish, motion, and export.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <GlassCard className="p-4 sm:p-6 relative overflow-hidden">
              <CanvasPreview />
            </GlassCard>

            <div className="absolute -top-4 -right-4 w-24 h-24 bg-sm-magenta/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-sm-purple/30 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
