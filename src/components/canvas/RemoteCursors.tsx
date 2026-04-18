import { motion, AnimatePresence } from 'framer-motion';

export interface RemoteCursor {
  x: number;
  y: number;
  userId: string;
  userName: string;
  color: string;
}

interface RemoteCursorsProps {
  cursors: RemoteCursor[];
}

export function RemoteCursors({ cursors }: RemoteCursorsProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <AnimatePresence>
        {cursors.map((cursor) => (
          <motion.div
            key={cursor.userId}
            className="absolute"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: cursor.x,
              y: cursor.y,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 500,
              opacity: { duration: 0.2 },
            }}
          >
            {/* Cursor arrow SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={cursor.color}
              className="drop-shadow-lg"
            >
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z" />
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
                fill="none"
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>

            {/* Name label */}
            <div
              className="absolute left-5 top-5 px-2 py-0.5 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-lg"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Helper to generate consistent colors for users
const USER_COLORS = [
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export function getUserColor(userId: string): string {
  // Generate a consistent color based on user ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
