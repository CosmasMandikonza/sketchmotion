import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MinimapFrame {
  id: string;
  position: { x: number; y: number };
  isPolished: boolean;
  thumbnail?: string;
}

interface MinimapConnection {
  id: string;
  from: string;
  to: string;
}

interface MinimapProps {
  frames: MinimapFrame[];
  connections?: MinimapConnection[];
  viewportPosition: { x: number; y: number };
  viewportSize: { width: number; height: number };
  canvasSize: { width: number; height: number };
  onNavigate: (position: { x: number; y: number }) => void;
  selectedFrameId?: string;
}

export function Minimap({
  frames,
  connections = [],
  viewportPosition,
  viewportSize,
  canvasSize,
  onNavigate,
  selectedFrameId,
}: MinimapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredFrame, setHoveredFrame] = useState<string | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const minimapWidth = 220;
  const minimapHeight = 160;

  // Calculate bounds from actual frame positions only (ignore canvasSize)
  const FRAME_WIDTH = 400; // actual frame width on canvas
  const FRAME_HEIGHT = 300; // actual frame height on canvas

  const bounds = frames.length > 0
    ? frames.reduce(
        (acc, frame) => ({
          minX: Math.min(acc.minX, frame.position.x),
          maxX: Math.max(acc.maxX, frame.position.x + FRAME_WIDTH),
          minY: Math.min(acc.minY, frame.position.y),
          maxY: Math.max(acc.maxY, frame.position.y + FRAME_HEIGHT),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      )
    : { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };

  // Add padding around content
  const padding = 50;
  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;

  // Scale to fit minimap - use actual content bounds, not canvasSize
  const scale = Math.min(minimapWidth / contentWidth, minimapHeight / contentHeight) * 0.9;

  // Calculate centering offset within minimap
  const scaledContentWidth = contentWidth * scale;
  const scaledContentHeight = contentHeight * scale;
  const centerOffsetX = (minimapWidth - scaledContentWidth) / 2;
  const centerOffsetY = (minimapHeight - scaledContentHeight) / 2;

  // Frame size in minimap
  const frameWidth = 32;
  const frameHeight = 22;

  const handleMouseEnter = () => {
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    collapseTimeoutRef.current = setTimeout(() => setIsExpanded(false), 500);
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Convert click position to canvas coordinates
    const clickX = e.clientX - rect.left - 16; // Account for padding
    const clickY = e.clientY - rect.top - 12;
    const canvasX = (clickX - centerOffsetX) / scale + bounds.minX - padding;
    const canvasY = (clickY - centerOffsetY) / scale + bounds.minY - padding;
    onNavigate({ x: canvasX, y: canvasY });
  };

  const getFramePosition = (frame: MinimapFrame) => ({
    x: (frame.position.x - bounds.minX + padding) * scale + centerOffsetX,
    y: (frame.position.y - bounds.minY + padding) * scale + centerOffsetY,
  });

  const polishedCount = frames.filter(f => f.isPolished).length;

  return (
    <div
      className="fixed bottom-4 right-[340px] z-[35]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // Collapsed state - subtle button
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#12121f]/95 backdrop-blur-2xl border border-white/[0.12] flex items-center justify-center hover:border-white/25 hover:from-[#222240]/90 transition-all group shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            onClick={() => setIsExpanded(true)}
          >
            <Map className="w-5 h-5 text-white/50 group-hover:text-white/80 transition-colors" />
            {/* Frame count badge */}
            {frames.length > 0 && (
              <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center shadow-[0_2px_8px_rgba(236,72,153,0.5)]">
                <span className="text-[10px] font-bold text-white">{frames.length}</span>
              </div>
            )}
          </motion.button>
        ) : (
          // Expanded state - full minimap
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#12121f]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                  <Map className="w-3.5 h-3.5 text-pink-400" />
                </div>
                <span className="text-xs font-semibold text-white/80">Overview</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5 text-white/50" />
              </button>
            </div>

            {/* Minimap Canvas */}
            <div
              className="relative cursor-crosshair"
              style={{ width: minimapWidth + 32, height: minimapHeight + 24, padding: 16 }}
              onClick={handleMinimapClick}
            >
              <div
                className="relative w-full h-full rounded-xl overflow-hidden border border-white/[0.06]"
                style={{
                  background: 'linear-gradient(145deg, #0d0d18 0%, #080810 100%)',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                }}
              >
                {/* Subtle grid */}
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                  }}
                />

                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {connections.map((conn) => {
                    const fromFrame = frames.find(f => f.id === conn.from);
                    const toFrame = frames.find(f => f.id === conn.to);
                    if (!fromFrame || !toFrame) return null;

                    const from = getFramePosition(fromFrame);
                    const to = getFramePosition(toFrame);

                    return (
                      <g key={conn.id}>
                        {/* Glow effect */}
                        <line
                          x1={from.x + frameWidth / 2}
                          y1={from.y + frameHeight / 2}
                          x2={to.x + frameWidth / 2}
                          y2={to.y + frameHeight / 2}
                          stroke="rgba(236, 72, 153, 0.2)"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        {/* Main line */}
                        <line
                          x1={from.x + frameWidth / 2}
                          y1={from.y + frameHeight / 2}
                          x2={to.x + frameWidth / 2}
                          y2={to.y + frameHeight / 2}
                          stroke="rgba(236, 72, 153, 0.6)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Frame rectangles with thumbnails */}
                {frames.map((frame) => {
                  const pos = getFramePosition(frame);
                  const isSelected = frame.id === selectedFrameId;
                  const isHovered = frame.id === hoveredFrame;

                  return (
                    <motion.div
                      key={frame.id}
                      className={cn(
                        "absolute rounded-md overflow-hidden transition-all duration-150",
                        "ring-1 ring-inset",
                        isSelected && "ring-2 ring-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.6)]",
                        !isSelected && frame.isPolished && "ring-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.3)]",
                        !isSelected && !frame.isPolished && "ring-white/20"
                      )}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        width: frameWidth,
                        height: frameHeight,
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: isHovered ? 1.3 : 1,
                        opacity: 1,
                        zIndex: isHovered ? 10 : 1
                      }}
                      transition={{ type: 'spring', damping: 20 }}
                      onMouseEnter={() => setHoveredFrame(frame.id)}
                      onMouseLeave={() => setHoveredFrame(null)}
                    >
                      {/* Thumbnail or placeholder */}
                      {frame.thumbnail ? (
                        <img
                          src={frame.thumbnail}
                          alt=""
                          className="w-full h-full object-cover brightness-110 contrast-105"
                        />
                      ) : (
                        <div className={cn(
                          "w-full h-full flex items-center justify-center",
                          frame.isPolished
                            ? "bg-gradient-to-br from-emerald-500/30 to-emerald-600/20"
                            : "bg-gradient-to-br from-white/10 to-white/5"
                        )}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                        </div>
                      )}

                      {/* Polished indicator */}
                      {frame.isPolished && (
                        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d0d18] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      )}

                      {/* Draft indicator */}
                      {!frame.isPolished && (
                        <div className="absolute inset-0 border border-dashed border-white/30 rounded-md pointer-events-none" />
                      )}
                    </motion.div>
                  );
                })}

                {/* Viewport indicator */}
                <motion.div
                  className="absolute rounded-md pointer-events-none"
                  style={{
                    left: (viewportPosition.x - bounds.minX + padding) * scale + centerOffsetX,
                    top: (viewportPosition.y - bounds.minY + padding) * scale + centerOffsetY,
                    width: Math.max(viewportSize.width * scale, 40),
                    height: Math.max(viewportSize.height * scale, 28),
                    background: 'rgba(255,255,255,0.03)',
                    border: '1.5px solid rgba(255,255,255,0.25)',
                    boxShadow: '0 0 20px rgba(255,255,255,0.1), inset 0 0 20px rgba(255,255,255,0.02)'
                  }}
                  animate={{
                    borderColor: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)'],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </div>
            </div>

            {/* Footer stats */}
            <div className="px-4 py-2.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Polished indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  <span className="text-[11px] font-medium text-white/60">{polishedCount} ready</span>
                </div>
                {/* Draft indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-white/40" />
                  <span className="text-[11px] font-medium text-white/60">{frames.length - polishedCount} draft</span>
                </div>
              </div>
              <span className="text-[10px] text-white/40 font-medium">Click to navigate</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
