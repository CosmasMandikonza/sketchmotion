import { useState } from "react";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Pencil,
  ArrowRight,
  Wand2,
  Film,
  Sparkles,
} from "lucide-react";

interface OnboardingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    title: "Welcome to SketchMotion!",
    description: "Let's take a quick tour of the canvas editor. You'll be creating amazing animations in no time.",
    icon: Sparkles,
    color: "from-sm-magenta to-sm-pink",
  },
  {
    title: "Create Frames",
    description: "Use the Add Frame control to place a new frame on the canvas. Double-click a frame to enter sketch mode and start drawing.",
    icon: Pencil,
    color: "from-sm-pink to-sm-coral",
    shortcut: "Ctrl+N",
  },
  {
    title: "Connect Your Sequence",
    description: "Use the connector tool to link frames together. This defines the order of your animation sequence.",
    icon: ArrowRight,
    color: "from-sm-coral to-sm-purple",
    shortcut: "C",
  },
  {
    title: "AI Polish",
    description: "Select your frames and click 'Polish' to let AI clean up your sketches and apply a consistent art style.",
    icon: Wand2,
    color: "from-sm-soft-purple to-sm-purple",
  },
  {
    title: "Generate Animation",
    description: "Once polished, click 'Animate' to generate a smooth video from your storyboard sequence. Magic!",
    icon: Film,
    color: "from-sm-magenta to-sm-pink",
  },
];

export function OnboardingOverlay({ isOpen, onClose }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="pointer-events-auto"
          >
            <GlassCard className="w-full max-w-lg p-8 relative">
              {/* Close Button */}
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentStep
                        ? "w-8 bg-sm-magenta"
                        : index < currentStep
                        ? "w-4 bg-sm-magenta/50"
                        : "w-4 bg-white/20"
                    }`}
                  />
                ))}
              </div>

              {/* Icon */}
              <div className="flex justify-center mb-6">
                <motion.div
                  key={currentStep}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 20 }}
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-glow`}
                >
                  <step.icon className="w-10 h-10 text-white" />
                </motion.div>
              </div>

              {/* Content */}
              <motion.div
                key={`content-${currentStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center mb-8"
              >
                <h2 className="font-display font-bold text-2xl text-white mb-3">
                  {step.title}
                </h2>
                <p className="text-white/70 leading-relaxed">
                  {step.description}
                </p>
                {step.shortcut && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
                    <span className="text-sm text-white/60">Shortcut:</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/20 text-white text-sm font-mono">
                      {step.shortcut}
                    </kbd>
                  </div>
                )}
              </motion.div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-white/50 hover:text-white hover:bg-white/10"
                >
                  Skip Tour
                </Button>

                <Button
                  onClick={handleNext}
                  className="bg-sm-magenta hover:bg-sm-magenta/90 text-white font-semibold shadow-glow hover:shadow-glow-lg transition-all btn-press"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      Get Started
                      <Sparkles className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
