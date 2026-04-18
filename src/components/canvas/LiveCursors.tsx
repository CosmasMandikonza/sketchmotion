import { motion } from "framer-motion";

interface Cursor {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

interface LiveCursorsProps {
  cursors: Cursor[];
}

// Mock cursors for demo
const mockCursors: Cursor[] = [
  { id: "1", name: "Sarah", color: "#FF6B9D", x: 300, y: 200 },
  { id: "2", name: "Alex", color: "#A78BFA", x: 500, y: 350 },
];

export function LiveCursors({ cursors = mockCursors }: LiveCursorsProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {cursors.map((cursor) => (
        <motion.div
          key={cursor.id}
          className="absolute"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: cursor.x,
            y: cursor.y,
          }}
          transition={{
            type: "spring",
            damping: 30,
            stiffness: 200,
          }}
        >
          {/* Cursor Arrow */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="drop-shadow-lg"
          >
            <path
              d="M5.65376 12.4563L5.65376 12.4563L5.65314 12.4525C5.64132 12.3804 5.64132 12.3069 5.65314 12.2348L5.65376 12.231L5.65376 12.231L8.97939 3.65376L8.97939 3.65376L8.98315 3.64469C9.0215 3.55231 9.08467 3.47213 9.16554 3.41326C9.24641 3.35439 9.34175 3.31903 9.44118 3.31103C9.54061 3.30303 9.64028 3.32268 9.72918 3.36782C9.81808 3.41296 9.89269 3.48178 9.94476 3.56676L9.94476 3.56676L9.94939 3.57439L15.6494 12.5744L15.6494 12.5744L15.6538 12.5813C15.7054 12.6631 15.7333 12.7576 15.7343 12.8543C15.7353 12.951 15.7094 13.0461 15.6594 13.1289C15.6094 13.2117 15.5374 13.2791 15.4515 13.3235C15.3656 13.3679 15.2693 13.3876 15.1729 13.3806L15.1729 13.3806L15.1638 13.38L10.4638 12.88L10.4638 12.88L10.4563 12.8792C10.3804 12.8704 10.3069 12.8704 10.2348 12.8792L10.231 12.88L10.231 12.88L5.53103 13.38L5.53103 13.38L5.52188 13.3806C5.42553 13.3876 5.32918 13.3679 5.24329 13.3235C5.1574 13.2791 5.08537 13.2117 5.03539 13.1289C4.98541 13.0461 4.95949 12.951 4.96049 12.8543C4.96149 12.7576 4.98937 12.6631 5.04103 12.5813L5.04103 12.5813L5.04563 12.5744L5.65376 12.4563Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>

          {/* Name Tag */}
          <div
            className="absolute left-4 top-4 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-lg"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
