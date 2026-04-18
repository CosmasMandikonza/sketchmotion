import { cn } from "@/lib/utils";

interface SketchMotionLogoProps {
  className?: string;
}

export function SketchMotionLogo({ className }: SketchMotionLogoProps) {
  return (
    <div className={cn("relative", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6 md:w-8 md:h-8"
      >
        {/* Storyboard tile with animation */}
        <g className="origin-center animate-logo-board motion-reduce:animate-none">
          <rect
            x="4"
            y="8"
            width="18"
            height="16"
            rx="3"
            fill="url(#logoBoard)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
          />
          {/* Horizontal lines on board */}
          <line
            x1="7"
            y1="13"
            x2="19"
            y2="13"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
          />
          <line
            x1="7"
            y1="17"
            x2="16"
            y2="17"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
          />
        </g>

        {/* Pen leaning on board with wiggle animation */}
        <g
          className="origin-[24px_20px] animate-logo-pen motion-reduce:animate-none"
          transform="rotate(-15, 24, 20)"
        >
          <rect
            x="21"
            y="4"
            width="6"
            height="20"
            rx="1.5"
            fill="url(#logoPen)"
          />
          {/* Pen tip */}
          <polygon points="21,24 27,24 24,30" fill="#FF3D8F" />
          {/* Pen grip band */}
          <rect
            x="21"
            y="16"
            width="6"
            height="4"
            fill="rgba(255,255,255,0.25)"
            rx="0.5"
          />
        </g>

        <defs>
          <linearGradient
            id="logoBoard"
            x1="4"
            y1="8"
            x2="22"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#A78BFA" stopOpacity="0.5" />
            <stop offset="1" stopColor="#C471ED" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient
            id="logoPen"
            x1="21"
            y1="4"
            x2="27"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FF6B9D" />
            <stop offset="1" stopColor="#C471ED" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
