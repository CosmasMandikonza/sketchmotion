import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "left" | "right" | "top" | "bottom";
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, position, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white/12 backdrop-blur-2xl border border-white/20 shadow-xl",
          {
            "rounded-r-2xl": position === "left",
            "rounded-l-2xl": position === "right",
            "rounded-b-2xl": position === "top",
            "rounded-t-2xl": position === "bottom",
            "rounded-2xl": !position,
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";
