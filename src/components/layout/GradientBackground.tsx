import { cn } from "@/lib/utils";

interface GradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
  animated?: boolean;
}

export function GradientBackground({ 
  children, 
  className,
  animated = true 
}: GradientBackgroundProps) {
  return (
    <div 
      className={cn(
        "min-h-screen w-full relative",
        className
      )}
    >
      {/* Primary blue core gradient - centered at bottom */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(
              ellipse 85% 45% at 50% 100%,
              #1E3A8A 0%,
              #2563EB 18%,
              rgba(59, 130, 246, 0.5) 35%,
              transparent 60%
            ),
            #030712
          `,
        }}
      />
      
      {/* Secondary purple accent - offset left, subtle */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(
              ellipse 55% 35% at 30% 105%,
              rgba(139, 92, 246, 0.35) 0%,
              rgba(167, 139, 250, 0.2) 30%,
              transparent 60%
            )
          `,
        }}
      />
      
      {/* Tertiary pink accent - offset right, very subtle */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(
              ellipse 50% 30% at 70% 105%,
              rgba(236, 72, 153, 0.25) 0%,
              rgba(255, 107, 157, 0.15) 25%,
              transparent 50%
            )
          `,
        }}
      />
      
      {/* Warm accent - very minimal orange glow */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(
              ellipse 30% 20% at 50% 100%,
              rgba(249, 115, 22, 0.12) 0%,
              transparent 40%
            )
          `,
        }}
      />
      
      {/* Top fade for depth */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: `
            linear-gradient(
              to bottom,
              #030712 0%,
              transparent 30%
            )
          `,
        }}
      />
      
      {/* Noise texture overlay for grain */}
      <div 
        className="fixed inset-0 z-[1] opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
