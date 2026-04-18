import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "dark" | "light";
  hover?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", hover = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl transition-all duration-300",
          {
            "bg-white/10 backdrop-blur-xl border border-white/20 shadow-glass": variant === "default",
            "bg-black/20 backdrop-blur-xl border border-white/10 shadow-glass": variant === "dark",
            "bg-white/80 backdrop-blur-xl border border-white/40 shadow-glass": variant === "light",
          },
          hover && "hover:translate-y-[-4px] hover:scale-[1.02] hover:shadow-glass-lg cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
