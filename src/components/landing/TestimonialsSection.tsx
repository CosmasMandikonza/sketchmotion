import { GlassCard } from "@/components/layout/GlassCard";
import { motion } from "framer-motion";
import {
  BenefitSpeedIcon,
  BenefitConsistencyIcon,
  CollaborationIcon,
  ExportIcon,
} from "./SectionIcons";

const benefits = [
  {
    icon: BenefitSpeedIcon,
    heading: "Missing inputs are caught early",
    description:
      "Video and planning flows warn before they run when the board is missing the assets or metadata they need.",
  },
  {
    icon: BenefitConsistencyIcon,
    heading: "Failures stay visible",
    description:
      "Polish and planning failures surface as readable product states instead of silent dead ends.",
  },
  {
    icon: CollaborationIcon,
    heading: "Share and review stay stable",
    description:
      "Public access, copy-link behavior, and read-only review flows are built to hold up during real collaboration.",
  },
  {
    icon: ExportIcon,
    heading: "Export stays usable",
    description:
      "Even when no video exists yet, the export surface resolves safely and stays readable instead of collapsing into a blank page.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 px-4 scroll-mt-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <BenefitSpeedIcon className="w-4 h-4" />
            <span className="text-sm font-medium text-white">Reliable at the edges</span>
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4">
            Built for the moments{" "}
            <span className="gradient-text">creative tools usually break.</span>
          </h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            SketchMotion is designed so review loops keep moving through missing inputs, provider
            failures, share-state changes, and empty export states.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <motion.div key={benefit.heading} variants={itemVariants}>
                <GlassCard className="p-6 h-full flex flex-col">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sm-magenta/20 to-sm-purple/20 flex items-center justify-center mb-4 border border-white/10">
                    <Icon className="w-6 h-6 text-sm-magenta" />
                  </div>

                  <h3 className="font-display font-bold text-xl text-white mb-2">{benefit.heading}</h3>
                  <p className="text-white/70 leading-relaxed">{benefit.description}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
