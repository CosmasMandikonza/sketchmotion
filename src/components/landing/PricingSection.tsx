import { Link } from "react-router-dom";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PricingSoloIcon, PricingTeamIcon, PricingStudioIcon } from "./SectionIcons";

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "For storyboard artists shaping rough boards and testing the workflow.",
    icon: PricingSoloIcon,
    color: "from-sm-pink to-sm-coral",
    features: [
      "5 boards",
      "Storyboard canvas and frame editing",
      "AI polish",
      "Style-aware video generation",
      "Share links and export basics",
      "No credit card required",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro Review",
    price: "$12",
    originalPrice: "$19",
    period: "/mo",
    description: "For creative leads who need reliable polish, motion, and revision loops.",
    icon: PricingTeamIcon,
    color: "from-sm-magenta to-sm-pink",
    features: [
      "Unlimited boards",
      "Revision-aware planning guidance",
      "Style-aware video workflow",
      "Export surface and version history",
      "Public review links",
      "Visible failure handling and guardrails",
      "Priority support",
    ],
    cta: "Choose Pro",
    popular: true,
  },
  {
    name: "Team Workspace",
    price: "$29",
    originalPrice: "$49",
    period: "/mo",
    description: "For motion teams collaborating across boards, reviews, and handoff.",
    icon: PricingStudioIcon,
    color: "from-sm-purple to-sm-soft-purple",
    features: [
      "Everything in Pro Review",
      "Real-time collaboration",
      "Reviewer-friendly public boards",
      "Shared board visibility",
      "Team-ready exports",
      "Onboarding support",
      "Dedicated support",
    ],
    cta: "Start Team Plan",
    popular: false,
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

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-4 scroll-mt-24">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <PricingSoloIcon className="w-4 h-4" />
            <span className="text-sm font-medium text-white">Plans for artists, leads, and teams</span>
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4">
            Choose the setup{" "}
            <span className="gradient-text">that fits your review loop.</span>
          </h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Start on a single-board workflow, then scale into shared review, revision, and export
            without changing tools.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-6 lg:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={itemVariants}>
              <GlassCard
                className={cn(
                  "p-6 h-full flex flex-col relative",
                  plan.popular && "ring-2 ring-sm-magenta"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-sm-magenta text-white text-sm font-semibold shadow-glow">
                    Most Popular
                  </div>
                )}

                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4 shadow-lg`}
                >
                  <plan.icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="font-display font-bold text-2xl text-white mb-1">{plan.name}</h3>
                <p className="text-white/60 text-sm mb-4">{plan.description}</p>

                <div className="mb-6">
                  {plan.originalPrice && (
                    <span className="text-white/40 line-through text-lg mr-2">{plan.originalPrice}</span>
                  )}
                  <span className="font-display font-bold text-4xl text-white">{plan.price}</span>
                  <span className="text-white/60">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-sm-mint/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-sm-mint" />
                      </div>
                      <span className="text-white/80 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/dashboard">
                  <Button
                    className={cn(
                      "w-full font-semibold transition-all btn-press",
                      plan.popular
                        ? "bg-sm-magenta hover:bg-sm-magenta/90 text-white shadow-glow hover:shadow-glow-lg"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    )}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-white/60">
            Need help choosing?{" "}
            <a href="#" className="text-sm-magenta hover:underline">
              Talk to the team
            </a>{" "}
            and we will point you to the right setup.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
