import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
}

interface ConfettiCelebrationProps {
  isActive: boolean;
  onComplete?: () => void;
}

const colors = ["#FF6B9D", "#FF8E53", "#C471ED", "#A78BFA", "#6EE7B7", "#FF3D8F"];

export function ConfettiCelebration({ isActive, onComplete }: ConfettiCelebrationProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (isActive) {
      const newPieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        rotation: Math.random() * 720 - 360,
      }));
      setPieces(newPieces);

      const timer = setTimeout(() => {
        setPieces([]);
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {pieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{
                x: `${piece.x}vw`,
                y: "50vh",
                scale: 0,
                rotate: 0,
              }}
              animate={{
                y: "-20vh",
                scale: [0, 1, 1, 0.5],
                rotate: piece.rotation,
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 2,
                delay: piece.delay,
                ease: "easeOut",
              }}
              className="absolute w-3 h-3 rounded-sm"
              style={{ backgroundColor: piece.color }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
