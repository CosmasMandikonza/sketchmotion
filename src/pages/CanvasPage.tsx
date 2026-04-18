import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { CanvasHeader } from "@/components/canvas/CanvasHeader";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { AIPanel } from "@/components/canvas/AIPanel";
import { InfiniteCanvas } from "@/components/canvas/InfiniteCanvas";
import { Minimap } from "@/components/canvas/Minimap";
import { OnboardingOverlay } from "@/components/canvas/OnboardingOverlay";
import { ConfettiCelebration } from "@/components/canvas/ConfettiCelebration";
import { FrameSketchEditor } from "@/components/canvas/FrameSketchEditor";
import { FloatingNotification } from "@/components/canvas/FloatingNotification";
import { NotificationCenter } from "@/components/canvas/NotificationCenter";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useBoard } from "@/hooks/useBoard";
import { useNotification } from "@/hooks/useNotification";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeBroadcast, throttle, FrameMovement, CursorPosition, FrameSelection } from "@/hooks/useRealtimeBroadcast";
import { RemoteCursors, RemoteCursor, getUserColor } from "@/components/canvas/RemoteCursors";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  MousePointer,
  Plus,
  ArrowLeft,
  ArrowRight,
  Wand2,
  Film,
  Loader2,
  Check,
  ExternalLink,
  Play,
  ShieldCheck,
  Lock,
  FileQuestion,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { polishSketch, polishSketchWithStyle, suggestMotionNotes, checkContinuity } from "@/lib/googleAI";
import {
  clearFramePolishStyle,
  loadFramePolishStyleMap,
  saveFramePolishStyle,
  type PolishStyle,
} from "@/lib/polishStyles";

// Frame status type
type FrameStatus = "sketch" | "polished";

// Canvas Frame interface with all properties
interface CanvasFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  status: FrameStatus;
  sketchDataUrl?: string;
  polishedDataUrl?: string;
  durationMs: number;
  createdAt: number;
  // Legacy properties for compatibility
  description?: string;
  thumbnailColor?: string;
  isPolishing?: boolean;
}

// Animation style types for Veo video generation
type AnimationStyle = "static" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "parallax";

interface Frame {
  id: string;
  title: string;
  description?: string;
  position: { x: number; y: number };
  thumbnail?: string;
  thumbnailColor?: string;
  status: FrameStatus;
  isPolishing?: boolean;
  sketchDataUrl?: string;
  polishedDataUrl?: string;
  durationMs?: number;
  createdAt?: number;
  // Motion notes for animation
  motionNotes?: string;
  animationStyle?: AnimationStyle;
  polishStyle?: PolishStyle;
}

interface Connection {
  id: string;
  from: string;
  to: string;
}

interface CanvasConnection {
  id: string;
  fromFrameId: string;
  toFrameId: string;
}

// Generate a simple unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Demo storyboard data
const demoFrames: Frame[] = [
  {
    id: "demo-1",
    title: "Intro",
    description: "Opening scene with logo animation and brand reveal",
    position: { x: 100, y: 150 },
    thumbnailColor: "from-sm-pink/40 to-sm-coral/40",
    status: "sketch",
  },
  {
    id: "demo-2",
    title: "Product Close-up",
    description: "Detailed view of the product with key features highlighted",
    position: { x: 350, y: 100 },
    thumbnailColor: "from-sm-purple/40 to-sm-soft-purple/40",
    status: "sketch",
  },
  {
    id: "demo-3",
    title: "Feature Highlight",
    description: "Animated demonstration of the main feature in action",
    position: { x: 600, y: 150 },
    thumbnailColor: "from-sm-magenta/40 to-sm-pink/40",
    status: "sketch",
  },
  {
    id: "demo-4",
    title: "Social Proof",
    description: "Customer testimonials and trust indicators",
    position: { x: 475, y: 300 },
    thumbnailColor: "from-sm-mint/40 to-sm-soft-purple/40",
    status: "sketch",
  },
  {
    id: "demo-5",
    title: "Call to Action",
    description: "Final CTA with compelling offer and urgency",
    position: { x: 750, y: 250 },
    thumbnailColor: "from-sm-coral/40 to-sm-magenta/40",
    status: "sketch",
  },
];

const demoConnections: Connection[] = [
  { id: "demo-conn-1", from: "demo-1", to: "demo-2" },
  { id: "demo-conn-2", from: "demo-2", to: "demo-3" },
  { id: "demo-conn-3", from: "demo-3", to: "demo-4" },
  { id: "demo-conn-4", from: "demo-4", to: "demo-5" },
];

export function CanvasPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { success, error: notifyError, info } = useNotification();
  const { user } = useAuth();

  // Supabase board data
  const {
    board,
    loading: boardLoading,
    error: boardError,
    errorType: boardErrorType,
    isReadOnly,
    refresh: refreshBoard,
    createFrame,
    updateFrame,
    saveFrameImage,
    deleteFrame,
    updateFramePosition,
    createConnection,
    deleteConnection,
    updateBoardName,
  } = useBoard(boardId || null);

  // Real-time collaboration broadcast
  const {
    broadcastFrameMove,
    broadcastCursor,
    broadcastFrameSelect,
    onFrameMove,
    onCursorMove,
    onFrameSelect,
  } = useRealtimeBroadcast(boardId, user?.id);

  // Remote collaboration state
  const [remotePositions, setRemotePositions] = useState<Record<string, { x: number; y: number; userId: string }>>({});
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [remoteSelections, setRemoteSelections] = useState<Record<string, { userId: string; userName: string; color: string }>>({});
  const userColor = useMemo(() => user?.id ? getUserColor(user.id) : '#ec4899', [user?.id]);
  const userName = useMemo(() => user?.email?.split('@')[0] || 'Anonymous', [user?.email]);

  const [isSaving, setIsSaving] = useState(false);

  // Canvas state
  const [activeTool, setActiveTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
  
  // Track frame positions during drag to avoid stale state issues
  const workingPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const pendingDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragAnimationFrameRef = useRef<number | null>(null);

  // Ref for notification bell (for fly-to animation)
  const bellRef = useRef<HTMLButtonElement>(null);
  
  // State to track positions during drag (triggers re-render for connection updates)
  const [dragPositions, setDragPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Onboarding state - check localStorage to avoid re-showing after dismissal
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (!boardId) return false;
    return localStorage.getItem(`onboarding_dismissed_${boardId}`) === 'true';
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Frame editor state
  const [editingFrame, setEditingFrame] = useState<Frame | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Connection mode state
  const [connectingFromFrameId, setConnectingFromFrameId] = useState<string | null>(null);
  const isCreatingConnectionRef = useRef(false);

  // Sketch editor state
  const [isSketchEditorOpen, setIsSketchEditorOpen] = useState(false);
  const [sketchEditorFrameId, setSketchEditorFrameId] = useState<string | null>(null);

  // AI workflow state
  const [isPolishing, setIsPolishing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [showAnimationModal, setShowAnimationModal] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Beat Mode & AI features
  const [beatModeEnabled, setBeatModeEnabled] = useState(false);
  const [isMotionSuggesting, setIsMotionSuggesting] = useState(false);
  const [isContinuityChecking, setIsContinuityChecking] = useState(false);
  const [continuityIssues, setContinuityIssues] = useState<Array<{
    frameId: string;
    frameTitle: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>>([]);
  const [showContinuityModal, setShowContinuityModal] = useState(false);
  const [framePolishStyles, setFramePolishStyles] = useState<Record<string, PolishStyle>>(() =>
    loadFramePolishStyleMap(boardId),
  );

  useEffect(() => {
    setFramePolishStyles(loadFramePolishStyleMap(boardId));
  }, [boardId]);

  // Convert Supabase board data to component format
  const frames = useMemo<Frame[]>(() => {
    if (!board) return [];
    return board.frames.map(f => ({
      id: f.id,
      title: f.title,
      position: { x: f.x, y: f.y },
      status: f.status,
      sketchDataUrl: f.sketchUrl || undefined,
      polishedDataUrl: f.polishedUrl || undefined,
      thumbnail: f.polishedUrl || f.sketchUrl || undefined,
      thumbnailColor: "from-sm-pink/40 to-sm-coral/40",
      durationMs: f.durationMs,
      motionNotes: f.motionNotes || undefined,
      animationStyle: (f.animationStyle as AnimationStyle) || undefined,
      polishStyle: framePolishStyles[f.id],
    }));
  }, [board, framePolishStyles]);

  const connections = useMemo<Connection[]>(() => {
    if (!board) return [];
    return board.connections.map(c => ({
      id: c.id,
      from: c.fromFrameId,
      to: c.toFrameId,
    }));
  }, [board]);

  const framePositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    frames.forEach((frame) => {
      map.set(frame.id, frame.position);
    });
    return map;
  }, [frames]);

  // Listen for remote frame movements
  useEffect(() => {
    onFrameMove((movement: FrameMovement) => {
      setRemotePositions(prev => ({
        ...prev,
        [movement.frameId]: {
          x: movement.position.x,
          y: movement.position.y,
          userId: movement.userId,
        },
      }));

      // Clear position after movement stops (debounce 150ms)
      setTimeout(() => {
        setRemotePositions(prev => {
          const next = { ...prev };
          delete next[movement.frameId];
          return next;
        });
      }, 150);
    });
  }, [onFrameMove]);

  // Listen for remote cursor movements
  useEffect(() => {
    onCursorMove((cursor: CursorPosition) => {
      setRemoteCursors(prev => {
        const existing = prev.findIndex(c => c.userId === cursor.userId);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = cursor;
          return next;
        }
        return [...prev, cursor];
      });

      // Remove cursor after 3s of inactivity
      setTimeout(() => {
        setRemoteCursors(prev => prev.filter(c => c.userId !== cursor.userId));
      }, 3000);
    });
  }, [onCursorMove]);

  // Listen for remote frame selections
  useEffect(() => {
    onFrameSelect((selection: FrameSelection) => {
      if (selection.frameId) {
        setRemoteSelections(prev => ({
          ...prev,
          [selection.frameId!]: {
            userId: selection.userId,
            userName: selection.userName,
            color: selection.color,
          },
        }));
      } else {
        // User deselected - remove their selection
        setRemoteSelections(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(frameId => {
            if (next[frameId].userId === selection.userId) {
              delete next[frameId];
            }
          });
          return next;
        });
      }
    });
  }, [onFrameSelect]);

  // Throttled cursor broadcast (50ms = 20fps)
  const throttledCursorBroadcast = useMemo(
    () => throttle((x: number, y: number) => {
      broadcastCursor(x, y, userName, userColor);
    }, 50),
    [broadcastCursor, userName, userColor]
  );

  // Throttled frame move broadcast (33ms = 30fps)
  const throttledFrameMoveBroadcast = useMemo(
    () => throttle((frameId: string, position: { x: number; y: number }) => {
      broadcastFrameMove(frameId, position);
    }, 33),
    [broadcastFrameMove]
  );

  const flushPendingDragPositions = useCallback(() => {
    dragAnimationFrameRef.current = null;

    if (pendingDragPositionsRef.current.size === 0) {
      return;
    }

    setDragPositions((prev) => {
      const next = new Map(prev);
      pendingDragPositionsRef.current.forEach((position, id) => {
        next.set(id, position);
      });
      pendingDragPositionsRef.current.clear();
      return next;
    });
  }, []);

  const scheduleDragPositionFlush = useCallback(() => {
    if (dragAnimationFrameRef.current !== null) {
      return;
    }

    dragAnimationFrameRef.current = window.requestAnimationFrame(flushPendingDragPositions);
  }, [flushPendingDragPositions]);

  // Handle mouse move for cursor broadcasting
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    throttledCursorBroadcast(e.clientX, e.clientY);
  }, [throttledCursorBroadcast]);

  // Show onboarding for new boards (only if not previously dismissed)
  useEffect(() => {
    if (!boardLoading && board && board.frames.length === 0 && !onboardingDismissed) {
      setShowOnboarding(true);
    }
  }, [board, boardLoading, onboardingDismissed]);

  // Cleanup: save any pending positions when component unmounts
  useEffect(() => {
    return () => {
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
      }
      
      workingPositionsRef.current.forEach((pos, id) => {
        void updateFramePosition(id, pos.x, pos.y);
      });
    };
  }, [updateFramePosition]);

  const handleBoardNameChange = useCallback(async (name: string) => {
    setIsSaving(true);
    await updateBoardName(name);
    setTimeout(() => setIsSaving(false), 1000);
  }, [updateBoardName]);

  const handleToolChange = useCallback((tool: string) => {
    if (isReadOnly && tool === "connector") {
      return;
    }

    setActiveTool(tool);
    // Clear connection state when switching away from connector tool
    if (tool !== "connector") {
      setConnectingFromFrameId(null);
    }
  }, [isReadOnly]);

  useEffect(() => {
    if (isReadOnly && activeTool === "connector") {
      setActiveTool("select");
      setConnectingFromFrameId(null);
    }
  }, [activeTool, isReadOnly]);

  // Delete a connection
  const handleConnectionDelete = useCallback(async (connectionId: string) => {
    if (isReadOnly) return;

    const deleted = await deleteConnection(connectionId);
    if (deleted) {
      info("🔗 Connection removed");
    }
  }, [deleteConnection, info, isReadOnly]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.1, 0.25));
  }, []);

  const handleUndo = useCallback(() => {
    info("↩️ Action undone");
  }, [info]);

  const handleRedo = useCallback(() => {
    info("↪️ Action redone");
  }, [info]);

  const handleFrameSelect = useCallback(async (id: string, multiSelect?: boolean) => {
    // Handle connector tool mode
    if (activeTool === "connector") {
      if (isReadOnly) return;
      if (!connectingFromFrameId) {
        // First click - set the "from" frame
        setConnectingFromFrameId(id);
        setSelectedFrames([id]);
        broadcastFrameSelect(id, userName, userColor);
        info("🔗 Click another frame to connect");
      } else if (connectingFromFrameId !== id) {
        if (isCreatingConnectionRef.current) {
          return;
        }

        // Second click - create the connection
        const existingConnection = connections.find(
          c => (c.from === connectingFromFrameId && c.to === id) ||
               (c.from === id && c.to === connectingFromFrameId)
        );

        if (!existingConnection) {
          isCreatingConnectionRef.current = true;
          const newConnection = await createConnection(connectingFromFrameId, id);
          isCreatingConnectionRef.current = false;
          if (newConnection) {
            success(`🔗 Connection ${connections.length + 1} created`);
            broadcastFrameSelect(null, userName, userColor);
            setConnectingFromFrameId(null);
            setSelectedFrames([]);
          }
        } else {
          info("Those frames are already connected");
          return;
        }
      } else {
        // Clicked the same frame - cancel connection
        setConnectingFromFrameId(null);
        setSelectedFrames([]);
        broadcastFrameSelect(null, userName, userColor);
        info("Connection cancelled");
      }
      return;
    }

    // Normal selection behavior
    setSelectedFrames((prev) => {
      const newSelection = multiSelect
        ? prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
        : prev.includes(id) && prev.length === 1 ? [] : [id];

      // Broadcast selection to other collaborators
      const selectedId = newSelection.length === 1 ? newSelection[0] : null;
      broadcastFrameSelect(selectedId, userName, userColor);

      return newSelection;
    });
  }, [activeTool, connectingFromFrameId, connections, createConnection, info, success, broadcastFrameSelect, userName, userColor, isReadOnly]);

  const handleFrameDelete = useCallback(async (id: string) => {
    if (isReadOnly) return;
    await deleteFrame(id);
    setSelectedFrames((prev) => prev.filter((f) => f !== id));
  }, [deleteFrame, isReadOnly]);

  // Handle frame position change during drag.
  // Keep updates local-first and paint them at most once per animation frame.
  const handleFramePositionChange = useCallback((id: string, { dx, dy }: { dx: number; dy: number }) => {
    if (isReadOnly) return;
    const basePos = workingPositionsRef.current.get(id) || framePositionMap.get(id);
    if (!basePos) return;

    const nextPos = {
      x: basePos.x + dx,
      y: basePos.y + dy,
    };

    workingPositionsRef.current.set(id, nextPos);
    pendingDragPositionsRef.current.set(id, nextPos);
    scheduleDragPositionFlush();

    // Broadcast movement to other collaborators (throttled)
    throttledFrameMoveBroadcast(id, nextPos);
  }, [framePositionMap, scheduleDragPositionFlush, throttledFrameMoveBroadcast, isReadOnly]);

  const handleFramePositionCommit = useCallback(async (id: string) => {
    if (isReadOnly) return;
    const finalPos = workingPositionsRef.current.get(id) || framePositionMap.get(id);
    if (!finalPos) return;

    pendingDragPositionsRef.current.delete(id);
    await updateFramePosition(id, finalPos.x, finalPos.y);

    workingPositionsRef.current.delete(id);
    setDragPositions((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, [framePositionMap, updateFramePosition, isReadOnly]);

  const handleFrameDuplicate = useCallback(async (id: string) => {
    if (isReadOnly) return;
    const frame = frames.find((f) => f.id === id);
    if (frame) {
      const newFrame = await createFrame(
        `${frame.title} (Copy)`,
        frame.position.x + 50,
        frame.position.y + 50
      );
      
      // Copy all properties including images to the new frame
      if (newFrame) {
        await updateFrame(newFrame.id, {
          status: frame.status,
          sketchUrl: frame.sketchDataUrl || null,
          polishedUrl: frame.polishedDataUrl || null,
          motionNotes: frame.motionNotes || null,
          animationStyle: frame.animationStyle || 'static',
          durationMs: frame.durationMs || 2000,
        });

        if (boardId && frame.polishStyle) {
          setFramePolishStyles(saveFramePolishStyle(boardId, newFrame.id, frame.polishStyle));
        }
      }
    }
  }, [boardId, frames, createFrame, updateFrame, isReadOnly]);

  const getNextFramePlacement = useCallback(() => {
    const nextIndex = frames.length;
    const column = nextIndex % 4;
    const row = Math.floor(nextIndex / 4);

    return {
      x: 180 + column * 240,
      y: 140 + row * 190,
    };
  }, [frames.length]);

  const handleAddFrameAtPosition = useCallback(async (position: { x: number; y: number }) => {
    if (isReadOnly) return;
    // Extract existing frame numbers and find the max to ensure unique incrementing titles
    const existingNumbers = frames
      .map(f => {
        const match = f.title.match(/^Frame (\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const maxFrameNumber = Math.max(0, ...existingNumbers);

    const newFrame = await createFrame(
      `Frame ${maxFrameNumber + 1}`,
      position.x,
      position.y
    );
    if (newFrame) {
      setSelectedFrames([newFrame.id]);
      success(`${newFrame.title} added to canvas`);
    }
  }, [frames, createFrame, success, isReadOnly]);

  const handleCanvasBackgroundClick = useCallback(() => {
    if (activeTool === "connector") {
      if (connectingFromFrameId || selectedFrames.length > 0) {
        setConnectingFromFrameId(null);
        setSelectedFrames([]);
        broadcastFrameSelect(null, userName, userColor);
        info("🔗 Connection cancelled");
      }
      return;
    }

    if (selectedFrames.length > 0) {
      setSelectedFrames([]);
      broadcastFrameSelect(null, userName, userColor);
    }
  }, [
    activeTool,
    connectingFromFrameId,
    selectedFrames.length,
    broadcastFrameSelect,
    userName,
    userColor,
    info,
  ]);

  // Handle frame double-click to open sketch editor
  const handleFrameDoubleClick = useCallback((id: string) => {
    if (isReadOnly) return;
    const frame = frames.find(f => f.id === id);
    if (frame) {
      // Open sketch editor instead of text editor
      setSketchEditorFrameId(id);
      setIsSketchEditorOpen(true);
    }
  }, [frames, isReadOnly]);

  // Handle polishing a single frame (used by FrameCard quick polish and sketch editor)
  const handlePolishSingleFrame = useCallback(async (frameId: string) => {
    if (isReadOnly) return;
    const frame = frames.find(f => f.id === frameId);
    if (!frame?.sketchDataUrl) return;

    try {
      info(`✨ Polishing "${frame.title}"...`);

      const polished = await polishSketch(frame.sketchDataUrl);
      if (polished) {
        // Save polished image to Supabase
        await saveFrameImage(frameId, polished, 'polished');
        success(`✨ Polished: ${frame.title}`);
      } else {
        notifyError("Polish returned no image");
      }
    } catch (error) {
      console.error("Polish failed:", error);
      notifyError(`Polish failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [frames, saveFrameImage, success, notifyError, info, isReadOnly]);

  // Batch polish ALL frames with sketches for storyboard consistency
  const handleBatchPolishAll = useCallback(async () => {
    if (isReadOnly) return;
    // Find ALL frames that have sketches but aren't polished yet
    const framesToPolish = frames.filter(f => f.sketchDataUrl && f.status !== "polished");

    if (framesToPolish.length === 0) {
      const alreadyPolished = frames.filter(f => f.status === "polished").length;
      if (alreadyPolished > 0) {
        info("All frames already polished");
      } else {
        info("Draw sketches first (double-click a frame)");
      }
      return;
    }

    setIsPolishing(true);

    // Consistent style prompt for cohesive animation
    const consistentStyle = "Professional digital animation style, clean vector-like lines, vibrant colors, consistent lighting from top-left, soft shadows, suitable for storyboard animation sequence";

    info(`✨ Batch polishing ${framesToPolish.length} frames...`);

    let successCount = 0;

    for (let i = 0; i < framesToPolish.length; i++) {
      const frame = framesToPolish[i];
      try {
        info(`Polishing ${i + 1}/${framesToPolish.length}: ${frame.title}`);

        // Use polishSketchWithStyle for consistent look across all frames
        const polishedImage = await polishSketchWithStyle(frame.sketchDataUrl!, consistentStyle);

        if (polishedImage) {
          await saveFrameImage(frame.id, polishedImage, 'polished');
          successCount++;
        }
      } catch (error) {
        console.error(`Polish failed for ${frame.title}:`, error);
        notifyError(`Failed: ${frame.title}`);
      }
    }

    setIsPolishing(false);

    if (successCount > 0) {
      // Refresh to show updated thumbnails
      await refreshBoard();

      success(`🎨 ${successCount}/${framesToPolish.length} frames polished!`);
    }
  }, [frames, saveFrameImage, refreshBoard, info, success, notifyError, isReadOnly]);

  // Handle saving sketch from editor (with optional polish)
  // When isPolished=true, dataUrl contains the already-polished image from the preview
  // originalSketchData contains the original sketch that should be saved first
  const handleSaveSketch = useCallback(async (
    dataUrl: string,
    isPolished: boolean = false,
    motionNotes?: string,
    animationStyle?: AnimationStyle,
    originalSketchData?: string,
    polishStyle?: PolishStyle
  ) => {
    if (isReadOnly) return;
    if (sketchEditorFrameId) {
      // If this is a polished save, save the original sketch FIRST
      if (isPolished && originalSketchData) {
        await saveFrameImage(sketchEditorFrameId, originalSketchData, 'sketch');
        console.log('Original sketch saved before polished version');
      }

      // Save the main image (sketch or polished)
      await saveFrameImage(sketchEditorFrameId, dataUrl, isPolished ? 'polished' : 'sketch');

      // Update motion notes and animation style if provided
      if (motionNotes || animationStyle) {
        await updateFrame(sketchEditorFrameId, {
          motionNotes,
          animationStyle,
        });
      }

      success(isPolished ? "✨ Polished & Saved!" : "Sketch saved to frame");

      if (boardId) {
        if (isPolished && polishStyle) {
          setFramePolishStyles(saveFramePolishStyle(boardId, sketchEditorFrameId, polishStyle));
        } else {
          setFramePolishStyles(clearFramePolishStyle(boardId, sketchEditorFrameId));
        }
      }

      // Refresh board data to update UI with new images
      await refreshBoard();

      setIsSketchEditorOpen(false);
      setSketchEditorFrameId(null);
    }
  }, [boardId, sketchEditorFrameId, saveFrameImage, updateFrame, success, refreshBoard, isReadOnly]);

  // Get frame for sketch editor
  const sketchEditorFrame = useMemo(() => {
    if (!sketchEditorFrameId) return null;
    const frame = frames.find(f => f.id === sketchEditorFrameId);
    if (!frame) return null;
    return {
      id: frame.id,
      title: frame.title,
      sketchDataUrl: frame.sketchDataUrl,
      motionNotes: frame.motionNotes,
      animationStyle: frame.animationStyle,
      polishStyle: frame.polishStyle,
    };
  }, [sketchEditorFrameId, frames]);

  // Save frame edits
  const handleSaveFrameEdit = useCallback(async () => {
    if (isReadOnly) return;
    if (editingFrame) {
      await updateFrame(editingFrame.id, {
        title: editTitle,
      });
      setEditingFrame(null);
      success("Frame updated");
    }
  }, [editingFrame, editTitle, updateFrame, success, isReadOnly]);

  // Load demo storyboard
  const handleLoadDemo = useCallback(async () => {
    // Create demo frames in Supabase
    for (const frame of demoFrames) {
      await createFrame(frame.title, frame.position.x, frame.position.y);
    }

    // Note: For connections, we'd need to wait for frame IDs and create them
    // For now, just update the board name
    await updateBoardName("Product Launch Animation");
    setSelectedFrames([]);
    success("🎬 Demo storyboard loaded!");
  }, [createFrame, updateBoardName, success]);

  // Get frames in sequence order (following connections)
  // Handles multiple outgoing connections from a single frame (breadth-first)
  const getSequencedFrames = useCallback(() => {
    if (connections.length === 0) return frames;

    const targetIds = new Set(connections.map(c => c.to));
    const rootFrames = frames.filter(f => !targetIds.has(f.id));

    const ordered: Frame[] = [];
    const visited = new Set<string>();

    // Breadth-first traversal to handle multiple outgoing connections
    const traverse = (frameId: string) => {
      if (visited.has(frameId)) return;
      const frame = frames.find(f => f.id === frameId);
      if (!frame) return;

      visited.add(frameId);
      ordered.push(frame);

      // Find ALL outgoing connections from this frame (not just the first)
      const outgoingConns = connections.filter(c => c.from === frameId);
      outgoingConns.forEach(conn => traverse(conn.to));
    };

    rootFrames.forEach(f => traverse(f.id));
    // Add any unvisited frames (orphans or in cycles)
    frames.forEach(f => {
      if (!visited.has(f.id)) ordered.push(f);
    });

    return ordered;
  }, [frames, connections]);

  // Get separate chains for better visual grouping
  // Returns array of chains, where each chain is an array of frames
  const getConnectionChains = useCallback((): Frame[][] => {
    if (connections.length === 0) return [frames];

    const targetIds = new Set(connections.map(c => c.to));
    const rootFrames = frames.filter(f => !targetIds.has(f.id));

    const chains: Frame[][] = [];
    const visited = new Set<string>();

    // Build a chain starting from a root frame
    const buildChain = (startFrameId: string): Frame[] => {
      const chain: Frame[] = [];
      const queue: string[] = [startFrameId];

      while (queue.length > 0) {
        const frameId = queue.shift()!;
        if (visited.has(frameId)) continue;

        const frame = frames.find(f => f.id === frameId);
        if (!frame) continue;

        visited.add(frameId);
        chain.push(frame);

        // Find all outgoing connections and add to queue
        const outgoingConns = connections.filter(c => c.from === frameId);
        outgoingConns.forEach(conn => {
          if (!visited.has(conn.to)) {
            queue.push(conn.to);
          }
        });
      }

      return chain;
    };

    // Build chains starting from each root
    rootFrames.forEach(rootFrame => {
      if (!visited.has(rootFrame.id)) {
        const chain = buildChain(rootFrame.id);
        if (chain.length > 0) {
          chains.push(chain);
        }
      }
    });

    // Collect orphan frames (not connected to anything)
    const orphans = frames.filter(f => !visited.has(f.id));
    if (orphans.length > 0) {
      chains.push(orphans);
    }

    return chains;
  }, [frames, connections]);

  // Auto-arrange frames in a clean grid layout
  // Groups connected chains together for better visual organization
  const handleAutoArrange = useCallback(async () => {
    if (frames.length < 2) return;

      // CRITICAL: Clear all pending drag state FIRST to prevent stale positions
      // This fixes the bug where connections point to empty space after auto-arrange
      // because dragPositions had priority over the new calculated positions
      setDragPositions(new Map());
      workingPositionsRef.current.clear();
      pendingDragPositionsRef.current.clear();
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }

    // Layout constants
    const frameWidth = 220;
    const frameHeight = 180;
    const gapX = 80;
    const gapY = 100;  // Gap between rows/chains
    const startX = 100;
    const startY = 120;

    // Collect all position updates to batch them
    const positionUpdates: Array<{ id: string; x: number; y: number }> = [];

    if (connections.length > 0) {
      // Build a proper linear chain following connections in order
      // Find the root frames (frames that are NOT targets of any connection)
      const targetIds = new Set(connections.map(c => c.to));
      const rootFrames = frames.filter(f => !targetIds.has(f.id));

      const visited = new Set<string>();
      let currentY = startY;

      // Process each chain starting from root frames
      rootFrames.forEach(rootFrame => {
        if (visited.has(rootFrame.id)) return;

        // Build linear chain by following connections one by one
        const chain: Frame[] = [];
        let currentFrameId: string | null = rootFrame.id;

        while (currentFrameId && !visited.has(currentFrameId)) {
          const frame = frames.find(f => f.id === currentFrameId);
          if (!frame) break;

          visited.add(currentFrameId);
          chain.push(frame);

          // Find the next frame in the sequence (first outgoing connection)
          const nextConnection = connections.find(c => c.from === currentFrameId);
          currentFrameId = nextConnection?.to || null;
        }

        // Position all frames in this chain on a single horizontal row
        chain.forEach((frame, colIndex) => {
          const x = startX + colIndex * (frameWidth + gapX);
          const y = currentY;
          positionUpdates.push({ id: frame.id, x, y });
        });

        // Move to next row for the next chain
        if (chain.length > 0) {
          currentY += frameHeight + gapY;
        }
      });

      // Handle any orphan frames (not connected to anything)
      const orphans = frames.filter(f => !visited.has(f.id));
      if (orphans.length > 0) {
        orphans.forEach((frame, colIndex) => {
          const x = startX + colIndex * (frameWidth + gapX);
          const y = currentY;
          positionUpdates.push({ id: frame.id, x, y });
        });
      }
    } else {
      // No connections - arrange in grid
      const cols = Math.ceil(Math.sqrt(frames.length));

      frames.forEach((frame, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (frameWidth + gapX);
        const y = startY + row * (frameHeight + gapY);
        positionUpdates.push({ id: frame.id, x, y });
      });
    }

    // Batch update all positions concurrently for better performance
    await Promise.all(
      positionUpdates.map(({ id, x, y }) => updateFramePosition(id, x, y))
    );

    // Refresh board data to ensure UI has latest positions for connection rendering
    // This fixes race condition where concurrent state updates cause stale frame positions
    await refreshBoard();

    success("✨ Frames arranged");
  }, [frames, connections, updateFramePosition, refreshBoard, success]);

  // Handle preview
  const handlePreview = useCallback(() => {
    if (frames.length < 1) return;
    setPreviewIndex(0);
    setShowPreviewModal(true);
    setIsPreviewPlaying(true);
  }, [frames.length]);

  // Auto-advance preview with actual frame durations
  useEffect(() => {
    if (!showPreviewModal || !isPreviewPlaying) return;
    
    const sequencedFrames = getSequencedFrames();
    if (previewIndex >= sequencedFrames.length - 1) {
      setIsPreviewPlaying(false);
      return;
    }
    
    const currentFrame = sequencedFrames[previewIndex];
    const duration = currentFrame?.durationMs || 2000;
    
    const timer = setTimeout(() => {
      setPreviewIndex(prev => prev + 1);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [showPreviewModal, isPreviewPlaying, previewIndex, getSequencedFrames]);

  // Computed value for polished frame count
  const polishedFrameCount = useMemo(() => 
    frames.filter(f => f.status === 'polished').length,
  [frames]);

  // Toggle Beat Mode
  const handleBeatModeToggle = useCallback(() => {
    setBeatModeEnabled(prev => !prev);
    info(beatModeEnabled ? "🎵 Beat Mode Off" : "🎵 Beat Mode On");
  }, [beatModeEnabled, info]);

  // Handle duration change for a frame
  const handleFrameDurationChange = useCallback(async (frameId: string, newDurationMs: number) => {
    await updateFrame(frameId, { durationMs: newDurationMs });
  }, [updateFrame]);

  // AI Motion Suggest - fills motion notes for all polished frames
  const handleMotionSuggest = useCallback(async () => {
    const polishedFrames = frames.filter(f => f.status === 'polished' && (f.polishedDataUrl || f.sketchDataUrl));

    if (polishedFrames.length === 0) {
      info("Polish frames first for motion suggestions");
      return;
    }

    setIsMotionSuggesting(true);

    info(`🎬 Analyzing ${polishedFrames.length} frames...`);

    let successCount = 0;

    for (const frame of polishedFrames) {
      try {
        const imageUrl = frame.polishedDataUrl || frame.sketchDataUrl;
        if (!imageUrl) continue;

        const motionNote = await suggestMotionNotes(imageUrl);
        await updateFrame(frame.id, { motionNotes: motionNote });
        successCount++;
      } catch (error) {
        console.error(`Motion suggest failed for ${frame.title}:`, error);
      }
    }

    setIsMotionSuggesting(false);

    if (successCount > 0) {
      await refreshBoard();
      success(`🎬 Motion notes added to ${successCount} frames`);
    }
  }, [frames, updateFrame, refreshBoard, info, success]);

  // AI Continuity Check
  const handleContinuityCheck = useCallback(async () => {
    const polishedFrames = frames.filter(f => f.status === 'polished' && (f.polishedDataUrl || f.sketchDataUrl));

    if (polishedFrames.length < 2) {
      info("Need 2+ polished frames for continuity check");
      return;
    }

    setIsContinuityChecking(true);

    info(`🔍 Checking ${polishedFrames.length} frames...`);

    try {
      // Get frames in sequence order
      const sequencedFrames = getSequencedFrames().filter(f => f.status === 'polished');

      const framesToCheck = sequencedFrames.map(f => ({
        id: f.id,
        title: f.title,
        imageUrl: f.polishedDataUrl || f.sketchDataUrl || '',
      })).filter(f => f.imageUrl);

      const issues = await checkContinuity(framesToCheck);

      setContinuityIssues(issues);
      setShowContinuityModal(true);

      if (issues.length === 0) {
        success("✅ Continuity check passed!");
      } else {
        info(`⚠️ Found ${issues.length} issue${issues.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error("Continuity check failed:", error);
      notifyError(`Check failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    setIsContinuityChecking(false);
  }, [frames, getSequencedFrames, info, success, notifyError]);

  // AI Polish handler - transforms sketches into polished illustrations
  const handlePolish = useCallback(async () => {
    if (selectedFrames.length === 0) {
      info("Select frames to polish");
      return;
    }

    const framesToPolish = frames.filter(
      f => selectedFrames.includes(f.id) && f.sketchDataUrl
    );

    if (framesToPolish.length === 0) {
      info("Draw sketches first (double-click a frame)");
      return;
    }

    setIsPolishing(true);

    let successCount = 0;

    for (const frame of framesToPolish) {
      try {
        info(`✨ Polishing "${frame.title}"...`);

        const polishedImage = await polishSketch(frame.sketchDataUrl!);

        if (polishedImage) {
          // Save polished image to Supabase
          await saveFrameImage(frame.id, polishedImage, 'polished');
          successCount++;
        }
      } catch (error) {
        console.error(`Polish failed for ${frame.title}:`, error);
        notifyError(`Failed to polish "${frame.title}"`);
      }
    }

    setIsPolishing(false);

    if (successCount > 0) {
      success(`🎨 ${successCount} frame${successCount !== 1 ? 's' : ''} polished!`);
    }
  }, [selectedFrames, frames, saveFrameImage, info, success, notifyError]);

  // AI Animate handler
  const handleAnimate = useCallback(() => {
    const polishedFrames = frames.filter(f => selectedFrames.includes(f.id) && f.status === "polished");
    if (polishedFrames.length === 0) {
      info("Polish frames first before animating");
      return;
    }

    setShowAnimationModal(true);
    setIsAnimating(true);
    setAnimationProgress(0);
    setAnimationComplete(false);

    // Simulate animation generation
    const interval = setInterval(() => {
      setAnimationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnimating(false);
          setAnimationComplete(true);
          setShowConfetti(true);
          return 100;
        }
        return prev + 3;
      });
    }, 100);
  }, [frames, selectedFrames, info]);

  const handleMinimapNavigate = useCallback((position: { x: number; y: number }) => {
    console.log("Navigate to:", position);
  }, []);

  // Check if there are polished frames
  const hasPolishedFrames = useMemo(() =>
    frames.some(f => f.status === "polished"),
  [frames]);

  // Keyboard shortcuts
  const shortcuts = useMemo(
    () => [
      { key: "v", action: () => handleToolChange("select") },
      { key: "p", action: () => handleToolChange("pencil") },
      { key: "r", action: () => handleToolChange("rectangle") },
      { key: "o", action: () => handleToolChange("ellipse") },
      { key: "t", action: () => handleToolChange("text") },
      { key: "i", action: () => handleToolChange("image") },
      { key: "c", action: () => handleToolChange("connector") },
      { key: " ", action: () => handleToolChange("pan") },
      { key: "z", ctrl: true, action: handleUndo },
      { key: "z", ctrl: true, shift: true, action: handleRedo },
      { key: "=", ctrl: true, action: handleZoomIn },
      { key: "-", ctrl: true, action: handleZoomOut },
      { key: "n", ctrl: true, action: () => handleAddFrameAtPosition(getNextFramePlacement()) },
      {
        key: "Delete",
        action: () => {
          selectedFrames.forEach((id) => handleFrameDelete(id));
        },
      },
      {
        key: "Backspace",
        action: () => {
          selectedFrames.forEach((id) => handleFrameDelete(id));
        },
      },
    ],
    [handleToolChange, handleUndo, handleRedo, handleZoomIn, handleZoomOut, selectedFrames, handleFrameDelete, handleAddFrameAtPosition, getNextFramePlacement]
  );

  useKeyboardShortcuts(shortcuts);

  // Compute frames with drag positions and remote positions for real-time updates.
  const displayFrames = useMemo(() => {
    return frames.map((frame) => {
      const dragPos = dragPositions.get(frame.id);
      const remotePos = remotePositions[frame.id];
      const remoteSelection = remoteSelections[frame.id];

      return {
        id: frame.id,
        position: dragPos || (remotePos ? { x: remotePos.x, y: remotePos.y } : frame.position),
        thumbnail: frame.thumbnail,
        isPolished: frame.status === "polished",
        isPolishing: frame.isPolishing,
        title: frame.title,
        thumbnailColor: frame.thumbnailColor,
        durationMs: frame.durationMs || 2000,
        motionNotes: frame.motionNotes,
        isRemoteMoving: !!remotePos,
        remoteSelection: remoteSelection || null,
      };
    });
  }, [dragPositions, frames, remotePositions, remoteSelections]);

  // Show loading state only on initial load when no cached data
  // If we have board data (from cache), skip the loading screen
  if (boardLoading && !board) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl font-display">Loading board...</div>
        </div>
      </GradientBackground>
    );
  }

  // Show error state if board failed to load
  if (boardError || boardErrorType) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            {boardErrorType === 'access_denied' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-red-400" />
                </div>
                <h1 data-testid="board-state-access-denied" className="text-xl font-semibold text-white mb-2">Access Denied</h1>
                <p className="text-white/60 mb-6">
                  You don't have permission to view this board. Ask the owner to invite you.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 font-medium hover:bg-pink-500/30 transition-colors"
                >
                  Go to Dashboard
                </button>
              </>
            ) : boardErrorType === 'not_found' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <FileQuestion className="w-8 h-8 text-amber-400" />
                </div>
                <h1 data-testid="board-state-not-found" className="text-xl font-semibold text-white mb-2">Board Not Found</h1>
                <p className="text-white/60 mb-6">
                  This board doesn't exist or has been deleted.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 font-medium hover:bg-pink-500/30 transition-colors"
                >
                  Go to Dashboard
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h1 data-testid="board-state-load-failed" className="text-xl font-semibold text-white mb-2">Failed to Load</h1>
                <p className="text-white/60 mb-6">
                  Something went wrong loading this board. Please try again.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => refreshBoard()}
                    className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-4 py-2 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 font-medium hover:bg-pink-500/30 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </GradientBackground>
    );
  }

  // Board not found
  if (!board) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="w-8 h-8 text-amber-400" />
            </div>
            <h1 data-testid="board-state-empty" className="text-xl font-semibold text-white mb-2">Board Not Found</h1>
            <p className="text-white/60 mb-6">
              This board doesn't exist or the URL is incorrect.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 font-medium hover:bg-pink-500/30 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground animated={false} className="bg-sm-charcoal">
      {/* Confetti Celebration */}
      <ConfettiCelebration
        isActive={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

      {/* Header with Back Button */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-1.5">
        <GlassCard className="max-w-full mx-auto px-3 py-1.5 flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs hidden sm:inline">Dashboard</span>
            </Link>

            <div className="h-5 w-px bg-white/20" />

            <Link to="/" className="flex items-center">
              {/* SketchMotion Logo */}
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-indigo-500/20 flex items-center justify-center border border-white/[0.1] shadow-lg">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="url(#logoGradient)" strokeWidth="1.5" />
                  <rect x="5" y="5" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" />
                  <rect x="5" y="10" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" />
                  <rect x="5" y="15" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" />
                  <rect x="17" y="5" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" />
                  <rect x="17" y="10" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" />
                  <rect x="17" y="15" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" />
                  <path d="M9 14 Q12 8 15 12" stroke="url(#motionGradient)" strokeWidth="2" strokeLinecap="round" fill="none" />
                  <path d="M8 12 L6.5 11" stroke="rgba(236,72,153,0.4)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 14 L6 14" stroke="rgba(236,72,153,0.3)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 16 L6.5 17" stroke="rgba(236,72,153,0.2)" strokeWidth="1.5" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="motionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </Link>

            <div className="h-5 w-px bg-white/20" />

            {/* Board Name - Inline Edit */}
            <CanvasHeader
              boardName={board?.name || "Untitled Board"}
              onBoardNameChange={handleBoardNameChange}
              boardId={boardId}
              isSaving={isSaving}
            />
          </div>

          {/* Right Section - Notifications only */}
          <div className="flex items-center">
            <NotificationCenter ref={bellRef} />
          </div>
        </GlassCard>
      </header>

      {isReadOnly && (
        <div
          data-testid="canvas-read-only-banner"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 px-4 py-2 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-100 text-sm font-medium"
          role="status"
        >
          View only — editing is disabled on this link
        </div>
      )}

      {!isReadOnly && activeTool === "connector" && (
        <div
          data-testid="canvas-connect-status"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 mt-12 rounded-full border border-cyan-400/25 bg-[#111217]/88 px-4 py-2 text-xs font-medium tracking-[0.08em] text-cyan-100 shadow-lg backdrop-blur-md"
          role="status"
        >
          {connectingFromFrameId
            ? "Connect mode: choose a target frame, or click empty canvas to cancel."
            : "Connect mode: choose the source frame to start a link."}
        </div>
      )}

      {/* Left Toolbar */}
      <CanvasToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onUndo={handleUndo}
        onRedo={handleRedo}
        frameCount={frames.length}
        onAddFrame={() => handleAddFrameAtPosition(getNextFramePlacement())}
        onAutoArrange={handleAutoArrange}
        onPreview={handlePreview}
        onBatchPolish={handleBatchPolishAll}
        beatModeEnabled={beatModeEnabled}
        onBeatModeToggle={handleBeatModeToggle}
        onMotionSuggest={handleMotionSuggest}
        onContinuityCheck={handleContinuityCheck}
        isMotionSuggesting={isMotionSuggesting}
        isContinuityChecking={isContinuityChecking}
        polishedFrameCount={polishedFrameCount}
        readOnly={isReadOnly}
      />

      {/* Remote Cursors Layer */}
      <RemoteCursors cursors={remoteCursors} />

      {/* Main Canvas */}
      <div className="fixed inset-0 pt-16" onMouseMove={handleCanvasMouseMove}>
        <InfiniteCanvas
          frames={displayFrames}
          connections={connections}
          selectedFrames={selectedFrames}
          onFrameSelect={handleFrameSelect}
          onFrameDelete={handleFrameDelete}
          onFrameDuplicate={handleFrameDuplicate}
          onCanvasBackgroundClick={handleCanvasBackgroundClick}
          onFrameDoubleClick={handleFrameDoubleClick}
          onConnectionDelete={handleConnectionDelete}
          onFramePositionChange={handleFramePositionChange}
          onFramePositionCommit={handleFramePositionCommit}
          onFramePolish={handlePolishSingleFrame}
          activeTool={activeTool}
          zoom={zoom}
          connectingFromFrameId={connectingFromFrameId}
          beatModeEnabled={beatModeEnabled}
          onFrameDurationChange={handleFrameDurationChange}
          readOnly={isReadOnly}
        />

        {/* Empty State Hint */}
        <AnimatePresence>
          {frames.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <GlassCard className="p-8 text-center max-w-md pointer-events-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sm-magenta/20 to-sm-purple/20 flex items-center justify-center mx-auto mb-4">
                  <MousePointer className="w-8 h-8 text-white/60" />
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-2">
                  Add your first frame to start the board
                </h3>
                <p className="text-white/60 mb-4">
                  Use the Add Frame control or load a demo storyboard to see the full workflow in action
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => handleAddFrameAtPosition({ x: 200, y: 150 })}
                    className="bg-sm-magenta hover:bg-sm-magenta/90 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Frame
                  </Button>
                  <Button
                    onClick={handleLoadDemo}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Load Demo
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Panel - AI Workflow */}
      <AIPanel
        selectedFrames={selectedFrames}
        frames={frames}
        onPolish={handlePolish}
        onAnimate={handleAnimate}
        isPolishing={isPolishing}
        hasPolishedFrames={hasPolishedFrames}
      />

      {/* Frame Editor Panel */}
      <AnimatePresence>
        {editingFrame && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed right-[340px] top-20 bottom-4 w-80 z-40"
          >
            <GlassCard className="h-full p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg text-white">Edit Frame</h3>
                <button
                  onClick={() => setEditingFrame(null)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <label className="text-sm text-white/60 block mb-1">Title</label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-white/10 border-white/20 text-white"
                    placeholder="Frame title..."
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 block mb-1">What happens in this frame?</label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="bg-white/10 border-white/20 text-white min-h-[120px]"
                    placeholder="Describe the scene, action, or content..."
                  />
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleSaveFrameEdit}
                    className="w-full bg-sm-magenta hover:bg-sm-magenta/90 text-white"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animation Generation Modal */}
      <AnimatePresence>
        {showAnimationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center pb-8 px-4"
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => animationComplete && setShowAnimationModal(false)} />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-lg"
            >
              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    animationComplete 
                      ? "bg-sm-mint/20" 
                      : "bg-gradient-to-br from-sm-magenta to-sm-pink"
                  )}>
                    {isAnimating ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Film className="w-6 h-6 text-sm-mint" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-white">
                      {animationComplete ? "Animation Ready!" : "Generating Animation..."}
                    </h3>
                    <p className="text-sm text-white/60">
                      {animationComplete 
                        ? "Your video is ready to export" 
                        : "This may take a few moments"}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                {!animationComplete && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/60">Progress</span>
                      <span className="text-white font-mono">{animationProgress}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-sm-magenta to-sm-pink"
                        initial={{ width: 0 }}
                        animate={{ width: `${animationProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Preview Thumbnail */}
                <div className={cn(
                  "aspect-video rounded-lg overflow-hidden mb-4 relative",
                  animationComplete ? "bg-sm-charcoal" : "bg-white/5"
                )}>
                  {animationComplete ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-sm-pink/20 to-sm-purple/20 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Film className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-sm-magenta animate-spin" />
                    </div>
                  )}
                </div>

                {/* Actions */}
                {animationComplete && (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-white/20 text-white hover:bg-white/10"
                      onClick={() => setShowAnimationModal(false)}
                    >
                      Close
                    </Button>
                    <Button
                      className="flex-1 bg-sm-magenta hover:bg-sm-magenta/90 text-white"
                      onClick={() => navigate(`/export/${boardId}`)}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View in Export & Share
                    </Button>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimap */}
      <Minimap
        frames={frames.map(f => ({
          id: f.id,
          position: f.position,
          isPolished: f.status === "polished",
          thumbnail: f.polishedDataUrl || f.sketchDataUrl
        }))}
        connections={connections}
        viewportPosition={{ x: 0, y: 0 }}
        viewportSize={{ width: window.innerWidth, height: window.innerHeight }}
        canvasSize={{ width: 5000, height: 3000 }}
        onNavigate={handleMinimapNavigate}
        selectedFrameId={selectedFrames[0]}
      />

      {/* Onboarding Overlay */}
      <OnboardingOverlay
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          setOnboardingDismissed(true);
          if (boardId) {
            localStorage.setItem(`onboarding_dismissed_${boardId}`, 'true');
          }
        }}
      />

      {/* Sketch Editor Modal */}
      <FrameSketchEditor
        frame={sketchEditorFrame}
        open={isSketchEditorOpen}
        onClose={() => {
          setIsSketchEditorOpen(false);
          setSketchEditorFrameId(null);
        }}
        onSave={handleSaveSketch}
      />

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 left-20 z-30">
        <GlassCard className="px-3 py-2 text-xs text-white/50">
          <span className="font-mono">V</span> Select • 
          <span className="font-mono ml-2">C</span> Connect • 
          <span className="font-mono ml-2">Space</span> Pan • 
          <span className="font-mono ml-2">Ctrl+N</span> New Frame
        </GlassCard>
      </div>

      {/* Preview Sequence Modal */}
      <AnimatePresence>
        {showPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowPreviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display font-bold text-xl text-white">
                      Storyboard Preview
                    </h3>
                    <p className="text-sm text-white/60">
                      Frame {previewIndex + 1} of {getSequencedFrames().length}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
                
                {/* Preview Frame */}
                <div className="aspect-video bg-sm-charcoal rounded-xl overflow-hidden mb-4 relative">
                  {(() => {
                    const sequencedFrames = getSequencedFrames();
                    const currentFrame = sequencedFrames[previewIndex];
                    if (!currentFrame) return null;
                    
                    const imageUrl = currentFrame.polishedDataUrl || currentFrame.sketchDataUrl;
                    
                    return (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentFrame.id}
                          initial={{ opacity: 0, scale: 1.05 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-0"
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={currentFrame.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                                  <Film className="w-8 h-8 text-white/40" />
                                </div>
                                <p className="text-white/40">No image</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Frame title overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                            <p className="text-white font-medium">{currentFrame.title}</p>
                            {currentFrame.motionNotes && (
                              <p className="text-white/60 text-sm mt-1">{currentFrame.motionNotes}</p>
                            )}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    );
                  })()}
                  
                  {/* Progress bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
                    <motion.div
                      className="h-full bg-sm-magenta"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${((previewIndex + 1) / getSequencedFrames().length) * 100}%` 
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
                
                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                    disabled={previewIndex === 0}
                    className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  
                  <button
                    onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}
                    className={cn(
                      "p-4 rounded-xl transition-all",
                      isPreviewPlaying
                        ? "bg-white/20 hover:bg-white/30"
                        : "bg-sm-magenta hover:bg-sm-magenta/80"
                    )}
                  >
                    {isPreviewPlaying ? (
                      <span className="w-5 h-5 flex items-center justify-center">
                        <span className="w-3 h-3 bg-white rounded-sm" />
                      </span>
                    ) : (
                      <Play className="w-5 h-5 text-white" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => setPreviewIndex(Math.min(getSequencedFrames().length - 1, previewIndex + 1))}
                    disabled={previewIndex === getSequencedFrames().length - 1}
                    className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ArrowRight className="w-5 h-5 text-white" />
                  </button>
                </div>
                
                {/* Frame thumbnails */}
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                  {getSequencedFrames().map((frame, idx) => (
                    <button
                      key={frame.id}
                      onClick={() => {
                        setPreviewIndex(idx);
                        setIsPreviewPlaying(false);
                      }}
                      className={cn(
                        "flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all",
                        idx === previewIndex
                          ? "border-sm-magenta scale-105"
                          : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      {(frame.polishedDataUrl || frame.sketchDataUrl) ? (
                        <img
                          src={frame.polishedDataUrl || frame.sketchDataUrl}
                          alt={frame.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/10" />
                      )}
                    </button>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Notification */}
      <FloatingNotification bellRef={bellRef} />

      {/* Continuity Check Modal */}
      <AnimatePresence>
        {showContinuityModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowContinuityModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      continuityIssues.length === 0 
                        ? "bg-sm-mint/20" 
                        : "bg-yellow-500/20"
                    )}>
                      <ShieldCheck className={cn(
                        "w-5 h-5",
                        continuityIssues.length === 0 ? "text-sm-mint" : "text-yellow-400"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-white">
                        Continuity Report
                      </h3>
                      <p className="text-sm text-white/60">
                        {continuityIssues.length === 0 
                          ? "No issues detected" 
                          : `${continuityIssues.length} issue${continuityIssues.length > 1 ? 's' : ''} found`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowContinuityModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>

                {continuityIssues.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-sm-mint/20 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-sm-mint" />
                    </div>
                    <p className="text-white/80">Your storyboard has consistent visual style!</p>
                    <p className="text-sm text-white/50 mt-2">All frames maintain character and environment continuity.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {continuityIssues.map((issue, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "p-3 rounded-lg border",
                          issue.severity === 'high' && "bg-red-500/10 border-red-500/30",
                          issue.severity === 'medium' && "bg-yellow-500/10 border-yellow-500/30",
                          issue.severity === 'low' && "bg-blue-500/10 border-blue-500/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium uppercase",
                            issue.severity === 'high' && "bg-red-500/20 text-red-300",
                            issue.severity === 'medium' && "bg-yellow-500/20 text-yellow-300",
                            issue.severity === 'low' && "bg-blue-500/20 text-blue-300"
                          )}>
                            {issue.severity}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{issue.frameTitle}</p>
                            <p className="text-sm text-white/70 mt-1">{issue.issue}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/10">
                  <Button
                    onClick={() => setShowContinuityModal(false)}
                    className="w-full bg-white/10 hover:bg-white/20 text-white"
                  >
                    Close Report
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GradientBackground>
  );
}
