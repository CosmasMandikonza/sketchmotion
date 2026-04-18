import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/layout/GlassCard";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <GlassCard className="p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-sm-magenta/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-sm-purple/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sm-magenta/20 border border-sm-magenta/30 mb-6">
                <Sparkles className="w-4 h-4 text-sm-magenta" />
                <span className="text-sm font-medium text-white">Reliable creative workflow</span>
              </div>

              <h2 className="font-display font-bold text-3xl md:text-5xl text-white mb-4">
                Keep the board moving{" "}
                <span className="gradient-text">from sketch to handoff.</span>
              </h2>

              <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
                Open a board, polish rough frames, generate motion, revise what changed, and export
                the result without resetting the workflow every time something goes wrong.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
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

              <p className="mt-6 text-sm text-white/50">
                Built for storyboard artists, creative leads, motion teams, and reviewers working
                through real feedback cycles.
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}
