import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

// Storyboard Icon - Stack of 3-4 rounded rectangles in a grid, one slightly offset
export function StoryboardIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="storyboardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="100%" stopColor="#C471ED" />
        </linearGradient>
      </defs>
      {/* Main frame grid */}
      <rect x="4" y="4" width="10" height="8" rx="2" fill="url(#storyboardGrad)" />
      <rect x="16" y="4" width="10" height="8" rx="2" fill="rgba(255,255,255,0.3)" />
      <rect x="4" y="14" width="10" height="8" rx="2" fill="rgba(255,255,255,0.3)" />
      {/* Offset frame for depth */}
      <rect x="18" y="16" width="10" height="8" rx="2" fill="url(#storyboardGrad)" opacity="0.8" />
      {/* Small accent */}
      <rect x="16" y="26" width="6" height="3" rx="1" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

// AI Polish Icon - Frame tile with magic wand/sparkle in corner
export function AIPolishIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="polishGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#FF3D8F" />
        </linearGradient>
      </defs>
      {/* Main frame */}
      <rect x="4" y="6" width="18" height="16" rx="3" fill="rgba(255,255,255,0.25)" stroke="url(#polishGrad)" strokeWidth="1.5" />
      {/* Content lines inside frame */}
      <rect x="7" y="10" width="8" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="7" y="14" width="12" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      {/* Magic wand */}
      <rect x="20" y="2" width="3" height="12" rx="1" fill="url(#polishGrad)" transform="rotate(30 22 8)" />
      {/* Sparkles */}
      <circle cx="26" cy="6" r="1.5" fill="#FF6B9D" />
      <circle cx="28" cy="10" r="1" fill="#C471ED" />
      <circle cx="24" cy="3" r="1" fill="#A78BFA" />
    </svg>
  );
}

// Collaboration Icon - Overlapping cursors/avatars around a frame
export function CollaborationIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="collabGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      {/* Central frame */}
      <rect x="8" y="8" width="14" height="12" rx="2" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      {/* Cursor 1 - pink */}
      <path d="M4 4 L4 14 L7 11 L10 14 L11 13 L8 10 L11 10 Z" fill="#FF6B9D" />
      {/* Cursor 2 - purple */}
      <path d="M24 6 L24 14 L26 12 L28 14 L29 13 L27 11 L29 11 Z" fill="#A78BFA" />
      {/* Avatar dots */}
      <circle cx="6" cy="26" r="3" fill="url(#collabGrad)" />
      <circle cx="14" cy="26" r="3" fill="#FF6B9D" />
      <circle cx="22" cy="26" r="3" fill="#C471ED" />
    </svg>
  );
}

// Export Icon - Frame with play button and arrow pointing outward
export function ExportIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="exportGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C471ED" />
          <stop offset="100%" stopColor="#FF3D8F" />
        </linearGradient>
      </defs>
      {/* Frame */}
      <rect x="4" y="6" width="16" height="14" rx="3" fill="rgba(255,255,255,0.2)" stroke="url(#exportGrad)" strokeWidth="1.5" />
      {/* Play button */}
      <path d="M10 10 L10 16 L15 13 Z" fill="url(#exportGrad)" />
      {/* Export arrow */}
      <path d="M22 12 L28 12 M28 12 L25 9 M28 12 L25 15" stroke="url(#exportGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Small accent bar */}
      <rect x="4" y="24" width="12" height="3" rx="1.5" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

// Pricing Solo Icon - Single pen + frame motif
export function PricingSoloIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="soloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="100%" stopColor="#FF8E53" />
        </linearGradient>
      </defs>
      {/* Frame */}
      <rect x="4" y="10" width="16" height="14" rx="3" fill="rgba(255,255,255,0.2)" stroke="url(#soloGrad)" strokeWidth="1.5" />
      {/* Content lines */}
      <rect x="7" y="14" width="10" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="7" y="18" width="6" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      {/* Pen */}
      <rect x="22" y="4" width="4" height="16" rx="1.5" fill="url(#soloGrad)" transform="rotate(15 24 12)" />
      <polygon points="22,20 26,20 24,26" fill="#FF3D8F" transform="rotate(15 24 23)" />
    </svg>
  );
}

// Pricing Team Icon - 2-3 avatars around a frame
export function PricingTeamIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="teamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF3D8F" />
          <stop offset="100%" stopColor="#FF6B9D" />
        </linearGradient>
      </defs>
      {/* Central frame */}
      <rect x="8" y="10" width="14" height="12" rx="2" fill="rgba(255,255,255,0.2)" stroke="url(#teamGrad)" strokeWidth="1.5" />
      {/* Content */}
      <rect x="11" y="14" width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)" />
      <rect x="11" y="17" width="5" height="1.5" rx="0.75" fill="rgba(255,255,255,0.2)" />
      {/* Avatars */}
      <circle cx="6" cy="8" r="4" fill="url(#teamGrad)" />
      <circle cx="24" cy="8" r="4" fill="#A78BFA" />
      <circle cx="15" cy="28" r="3" fill="#C471ED" />
    </svg>
  );
}

// Pricing Studio Icon - Larger frame with 3 tiny windows/panels
export function PricingStudioIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="studioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C471ED" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      {/* Main large frame */}
      <rect x="4" y="4" width="24" height="20" rx="3" fill="rgba(255,255,255,0.15)" stroke="url(#studioGrad)" strokeWidth="1.5" />
      {/* Three panels inside */}
      <rect x="7" y="8" width="6" height="5" rx="1" fill="url(#studioGrad)" />
      <rect x="15" y="8" width="6" height="5" rx="1" fill="#FF6B9D" opacity="0.8" />
      <rect x="7" y="15" width="14" height="5" rx="1" fill="rgba(255,255,255,0.25)" />
      {/* Crown accent */}
      <path d="M23 15 L25 12 L27 15 L29 12 L29 18 L23 18 Z" fill="url(#studioGrad)" />
    </svg>
  );
}

// Benefit Speed Icon - Frame with motion trail/speed lines
export function BenefitSpeedIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="100%" stopColor="#FF3D8F" />
        </linearGradient>
      </defs>
      {/* Speed lines */}
      <rect x="2" y="10" width="8" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      <rect x="4" y="14" width="6" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
      <rect x="2" y="18" width="8" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      {/* Main frame with motion */}
      <rect x="12" y="6" width="16" height="14" rx="3" fill="url(#speedGrad)" />
      {/* Lightning bolt inside */}
      <path d="M20 9 L17 14 L20 14 L18 19 L24 13 L21 13 L23 9 Z" fill="white" />
      {/* Trail effect */}
      <rect x="10" y="8" width="2" height="10" rx="1" fill="url(#speedGrad)" opacity="0.4" />
    </svg>
  );
}

// Benefit Consistency Icon - 3 frames in a row with matching shapes inside
export function BenefitConsistencyIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="consistGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#C471ED" />
        </linearGradient>
      </defs>
      {/* Three frames */}
      <rect x="2" y="8" width="8" height="10" rx="2" fill="rgba(255,255,255,0.2)" stroke="url(#consistGrad)" strokeWidth="1" />
      <rect x="12" y="8" width="8" height="10" rx="2" fill="rgba(255,255,255,0.2)" stroke="url(#consistGrad)" strokeWidth="1" />
      <rect x="22" y="8" width="8" height="10" rx="2" fill="rgba(255,255,255,0.2)" stroke="url(#consistGrad)" strokeWidth="1" />
      {/* Matching circles inside each frame */}
      <circle cx="6" cy="13" r="2" fill="url(#consistGrad)" />
      <circle cx="16" cy="13" r="2" fill="url(#consistGrad)" />
      <circle cx="26" cy="13" r="2" fill="url(#consistGrad)" />
      {/* Checkmark accent */}
      <path d="M14 22 L16 24 L20 20" stroke="#6EE7B7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Benefit Workflow Icon - Mini flow of 3 frames connected by arrows (Sketch → Polish → Animate)
export function BenefitWorkflowIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="workflowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="100%" stopColor="#C471ED" />
        </linearGradient>
      </defs>
      {/* Frame 1 - Sketch */}
      <rect x="2" y="10" width="7" height="8" rx="1.5" fill="rgba(255,255,255,0.2)" stroke="#FF6B9D" strokeWidth="1" />
      <path d="M4 14 L7 12 L5 16" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75" />
      {/* Arrow 1 */}
      <path d="M10 14 L12 14" stroke="url(#workflowGrad)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="14" r="1" fill="#FF6B9D" />
      {/* Frame 2 - Polish */}
      <rect x="13" y="10" width="7" height="8" rx="1.5" fill="rgba(255,255,255,0.2)" stroke="#A78BFA" strokeWidth="1" />
      <circle cx="16.5" cy="14" r="2" fill="#A78BFA" opacity="0.6" />
      {/* Arrow 2 */}
      <path d="M21 14 L23 14" stroke="url(#workflowGrad)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="23" cy="14" r="1" fill="#C471ED" />
      {/* Frame 3 - Animate */}
      <rect x="24" y="10" width="7" height="8" rx="1.5" fill="url(#workflowGrad)" />
      <path d="M26 12 L26 16 L29 14 Z" fill="white" />
      {/* Labels */}
      <rect x="2" y="22" width="7" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
      <rect x="13" y="22" width="7" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
      <rect x="24" y="22" width="7" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

// Version History Icon - Stacked frames with time indicator
export function VersionHistoryIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="versionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8E53" />
          <stop offset="100%" stopColor="#FF6B9D" />
        </linearGradient>
      </defs>
      {/* Stacked frames */}
      <rect x="8" y="4" width="14" height="10" rx="2" fill="rgba(255,255,255,0.1)" />
      <rect x="6" y="7" width="14" height="10" rx="2" fill="rgba(255,255,255,0.15)" />
      <rect x="4" y="10" width="14" height="10" rx="2" fill="rgba(255,255,255,0.2)" stroke="url(#versionGrad)" strokeWidth="1" />
      {/* Clock */}
      <circle cx="24" cy="20" r="6" fill="rgba(255,255,255,0.2)" stroke="url(#versionGrad)" strokeWidth="1.5" />
      <path d="M24 17 L24 20 L26 22" stroke="url(#versionGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Animation Icon - Frame with motion waves
export function AnimationIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="animGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF3D8F" />
          <stop offset="100%" stopColor="#FF6B9D" />
        </linearGradient>
      </defs>
      {/* Main frame */}
      <rect x="6" y="6" width="16" height="14" rx="3" fill="url(#animGrad)" />
      {/* Play symbol */}
      <path d="M12 10 L12 16 L17 13 Z" fill="white" />
      {/* Motion waves */}
      <path d="M24 8 Q26 10 24 12 Q26 14 24 16" stroke="url(#animGrad)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M27 6 Q30 10 27 14 Q30 18 27 22" stroke="url(#animGrad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}
