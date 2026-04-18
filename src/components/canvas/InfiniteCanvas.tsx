import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { FrameCard } from "./FrameCard";
import { cn } from "@/lib/utils";

interface RemoteSelection {
  userId: string;
  userName: string;
  color: string;
}

interface Frame {
  id: string;
  position: { x: number; y: number };
  thumbnail?: string;
  isPolished?: boolean;
  isPolishing?: boolean;
  title?: string;
  thumbnailColor?: string;
  durationMs?: number;
  motionNotes?: string;
  isRemoteMoving?: boolean;
  remoteSelection?: RemoteSelection | null;
}

interface Connection {
  id: string;
  from: string;
  to: string;
}

interface InfiniteCanvasProps {
  frames: Frame[];
  connections: Connection[];
  selectedFrames: string[];
  onFrameSelect: (id: string, multiSelect?: boolean) => void;
  onFrameDelete: (id: string) => void;
  onFrameDuplicate: (id: string) => void;
  onCanvasBackgroundClick: () => void;
  onFrameDoubleClick?: (id: string) => void;
  onConnectionDelete?: (id: string) => void;
  onFramePositionChange: (id: string, delta: { dx: number; dy: number }) => void;
  onFramePositionCommit?: (id: string) => void;
  onFramePolish?: (id: string) => void;
  activeTool: string;
  zoom: number;
  connectingFromFrameId?: string | null;
  beatModeEnabled?: boolean;
  onFrameDurationChange?: (id: string, durationMs: number) => void;
  readOnly?: boolean;
}

const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 144;

type ConnectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getSmartConnectionGeometry(from: ConnectionBox, to: ConnectionBox) {
  const fromCenter = {
    x: from.x + from.width / 2,
    y: from.y + from.height / 2,
  };
  const toCenter = {
    x: to.x + to.width / 2,
    y: to.y + to.height / 2,
  };

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  let fromPoint: { x: number; y: number };
  let toPoint: { x: number; y: number };

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      fromPoint = { x: from.x + from.width, y: fromCenter.y };
      toPoint = { x: to.x, y: toCenter.y };
    } else {
      fromPoint = { x: from.x, y: fromCenter.y };
      toPoint = { x: to.x + to.width, y: toCenter.y };
    }
  } else if (dy > 0) {
    fromPoint = { x: fromCenter.x, y: from.y + from.height };
    toPoint = { x: toCenter.x, y: to.y };
  } else {
    fromPoint = { x: fromCenter.x, y: from.y };
    toPoint = { x: toCenter.x, y: to.y + to.height };
  }

  const distance = Math.sqrt(dx * dx + dy * dy);
  const controlOffset = Math.max(distance * 0.35, 50);

  const cp1 =
    Math.abs(dx) > Math.abs(dy)
      ? { x: fromPoint.x + (dx > 0 ? controlOffset : -controlOffset), y: fromPoint.y }
      : { x: fromPoint.x, y: fromPoint.y + (dy > 0 ? controlOffset : -controlOffset) };

  const cp2 =
    Math.abs(dx) > Math.abs(dy)
      ? { x: toPoint.x + (dx > 0 ? -controlOffset : controlOffset), y: toPoint.y }
      : { x: toPoint.x, y: toPoint.y + (dy > 0 ? -controlOffset : controlOffset) };

  return {
    path: `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${toPoint.x} ${toPoint.y}`,
    midpoint: {
      x: (fromPoint.x + toPoint.x) / 2,
      y: (fromPoint.y + toPoint.y) / 2,
    },
  };
}

function getFrameBox(frame: Frame): ConnectionBox {
  return {
    x: frame.position.x,
    y: frame.position.y,
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
  };
}

function getSmartConnectionPath(from: Frame, to: Frame) {
  return getSmartConnectionGeometry(getFrameBox(from), getFrameBox(to));
}

function getPreviewConnectionPath(from: Frame, toPoint: { x: number; y: number }) {
  return getSmartConnectionGeometry(getFrameBox(from), {
    x: toPoint.x,
    y: toPoint.y,
    width: 0,
    height: 0,
  });
}

function calculateSequenceNumbers(connections: Connection[]) {
  const sequenceMap = new Map<string, number>();
  if (connections.length === 0) return sequenceMap;

  const targetIds = new Set(connections.map((connection) => connection.to));
  const outgoingByFrom = new Map<string, Connection[]>();

  connections.forEach((connection) => {
    const existing = outgoingByFrom.get(connection.from);
    if (existing) {
      existing.push(connection);
    } else {
      outgoingByFrom.set(connection.from, [connection]);
    }
  });

  const visited = new Set<string>();
  let sequence = 1;

  const processChain = (startFromId: string) => {
    let currentFromId: string | undefined = startFromId;

    while (currentFromId) {
      const nextConnection = (outgoingByFrom.get(currentFromId) || []).find(
        (connection) => !visited.has(connection.id)
      );
      if (!nextConnection) break;

      sequenceMap.set(nextConnection.id, sequence);
      visited.add(nextConnection.id);
      sequence += 1;
      currentFromId = nextConnection.to;
    }
  };

  connections.forEach((connection) => {
    if (!targetIds.has(connection.from) && !visited.has(connection.id)) {
      processChain(connection.from);
    }
  });

  connections.forEach((connection) => {
    if (!visited.has(connection.id)) {
      sequenceMap.set(connection.id, sequence);
      visited.add(connection.id);
      sequence += 1;
    }
  });

  return sequenceMap;
}

export function InfiniteCanvas({
  frames,
  connections,
  selectedFrames,
  onFrameSelect,
  onFrameDelete,
  onFrameDuplicate,
  onCanvasBackgroundClick,
  onFrameDoubleClick,
  onConnectionDelete,
  onFramePositionChange,
  onFramePositionCommit,
  onFramePolish,
  activeTool,
  zoom,
  connectingFromFrameId,
  beatModeEnabled = false,
  onFrameDurationChange,
  readOnly = false,
}: InfiniteCanvasProps) {
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [hoveredConnectFrameId, setHoveredConnectFrameId] = useState<string | null>(null);
  const [connectPreviewPoint, setConnectPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const canDragFrames = activeTool === "select" && !readOnly;
  const canDeleteConnections = !readOnly && activeTool === "select" && !!onConnectionDelete;
  const isConnectMode = activeTool === "connector" && !readOnly;

  const frameById = useMemo(() => {
    const map = new Map<string, Frame>();
    frames.forEach((frame) => map.set(frame.id, frame));
    return map;
  }, [frames]);

  const connectionPairSet = useMemo(() => {
    const pairs = new Set<string>();
    connections.forEach((connection) => {
      pairs.add(`${connection.from}:${connection.to}`);
      pairs.add(`${connection.to}:${connection.from}`);
    });
    return pairs;
  }, [connections]);

  const selectedFrameSet = useMemo(() => new Set(selectedFrames), [selectedFrames]);

  const sourceFrame = connectingFromFrameId ? frameById.get(connectingFromFrameId) || null : null;

  const hoveredConnectState = useMemo(() => {
    if (!sourceFrame || !hoveredConnectFrameId) return "idle";
    if (hoveredConnectFrameId === sourceFrame.id) return "invalid";
    if (connectionPairSet.has(`${sourceFrame.id}:${hoveredConnectFrameId}`)) return "invalid";
    return "valid";
  }, [connectionPairSet, hoveredConnectFrameId, sourceFrame]);

  const previewConnection = useMemo(() => {
    if (!isConnectMode || !sourceFrame) return null;

    if (hoveredConnectFrameId) {
      const hoveredFrame = frameById.get(hoveredConnectFrameId);
      if (!hoveredFrame) return null;
      return {
        ...getSmartConnectionPath(sourceFrame, hoveredFrame),
        state: hoveredConnectState,
      };
    }

    if (connectPreviewPoint) {
      return {
        ...getPreviewConnectionPath(sourceFrame, connectPreviewPoint),
        state: "preview",
      };
    }

    return null;
  }, [
    connectPreviewPoint,
    frameById,
    hoveredConnectFrameId,
    hoveredConnectState,
    isConnectMode,
    sourceFrame,
  ]);

  useEffect(() => {
    if (!isConnectMode || !sourceFrame) {
      setHoveredConnectFrameId(null);
      setConnectPreviewPoint(null);
    }
  }, [isConnectMode, sourceFrame]);

  const sequenceMap = useMemo(() => calculateSequenceNumbers(connections), [connections]);

  const connectionRenderData = useMemo(() => {
    return connections.flatMap((connection) => {
      const fromFrame = frameById.get(connection.from);
      const toFrame = frameById.get(connection.to);

      if (!fromFrame || !toFrame) {
        return [];
      }

      const { path, midpoint } = getSmartConnectionPath(fromFrame, toFrame);

      return [
        {
          id: connection.id,
          path,
          midpoint,
          sequenceNumber: sequenceMap.get(connection.id) || 1,
        },
      ];
    });
  }, [connections, frameById, sequenceMap]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "pan" || e.button === 1) {
        setIsPanning(true);
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [activeTool, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
        return;
      }

      if (isConnectMode && sourceFrame && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setConnectPreviewPoint({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom,
        });
      }
    },
    [isConnectMode, isPanning, pan.x, pan.y, sourceFrame, startPan, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || e.target === contentRef.current) {
        onCanvasBackgroundClick();
      }
    },
    [onCanvasBackgroundClick]
  );

  return (
    <div
      ref={canvasRef}
      data-testid="canvas-surface"
      className={cn(
        "absolute inset-0 overflow-hidden canvas-grid",
        isPanning
          ? "cursor-grabbing"
          : activeTool === "pan"
          ? "cursor-grab"
          : isConnectMode
          ? "cursor-crosshair"
          : "cursor-default"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <motion.div
        ref={contentRef}
        className="absolute"
        style={{
          x: pan.x,
          y: pan.y,
          scale: zoom,
          transformOrigin: "0 0",
        }}
      >
        <svg className="absolute inset-0 w-[5000px] h-[5000px]" style={{ pointerEvents: "none" }}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <path d="M 0 0 L 10 4 L 0 8 L 2 4 Z" fill="rgba(255, 255, 255, 0.8)" />
            </marker>
            <marker id="arrowheadHover" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto">
              <path d="M 0 0 L 12 5 L 0 10 L 2.5 5 Z" fill="rgba(255, 255, 255, 1)" />
            </marker>
            <filter id="connectionGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {connectionRenderData.map((connection) => {
            const isHovered = hoveredConnection === connection.id;
            const labelX = connection.midpoint.x;
            const labelY = connection.midpoint.y - 18;

            return (
              <g key={connection.id} data-testid={`canvas-connection-${connection.id}`}>
                <path
                  d={connection.path}
                  stroke="transparent"
                  strokeWidth="24"
                  fill="none"
                  style={{
                    pointerEvents: canDeleteConnections ? "stroke" : "none",
                    cursor: canDeleteConnections ? "pointer" : "default",
                  }}
                  onMouseEnter={() => canDeleteConnections && setHoveredConnection(connection.id)}
                  onMouseLeave={() => canDeleteConnections && setHoveredConnection(null)}
                  onClick={(e) => {
                    if (!canDeleteConnections) return;
                    e.stopPropagation();
                    onConnectionDelete?.(connection.id);
                  }}
                />

                <path
                  d={connection.path}
                  stroke={isHovered ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.15)"}
                  strokeWidth={isHovered ? 6 : 4}
                  fill="none"
                  strokeLinecap="round"
                  filter="url(#connectionGlow)"
                  style={{ pointerEvents: "none" }}
                />

                <path
                  d={connection.path}
                  stroke={isHovered ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.7)"}
                  strokeWidth={isHovered ? 3 : 2.5}
                  strokeDasharray={isHovered ? "12 6" : "8 6"}
                  fill="none"
                  markerEnd={isHovered ? "url(#arrowheadHover)" : "url(#arrowhead)"}
                  strokeLinecap="round"
                  style={{
                    pointerEvents: "none",
                    transition: "stroke 0.15s ease, stroke-width 0.15s ease",
                  }}
                />

                <g
                  transform={`translate(${labelX}, ${labelY})`}
                  style={{
                    pointerEvents: canDeleteConnections ? "auto" : "none",
                    cursor: canDeleteConnections ? "pointer" : "default",
                  }}
                  onMouseEnter={() => canDeleteConnections && setHoveredConnection(connection.id)}
                  onMouseLeave={() => canDeleteConnections && setHoveredConnection(null)}
                  onClick={(e) => {
                    if (!canDeleteConnections) return;
                    e.stopPropagation();
                    onConnectionDelete?.(connection.id);
                  }}
                >
                  <circle
                    r={12}
                    fill={isHovered ? "rgba(255, 255, 255, 0.95)" : "rgba(30, 30, 40, 0.9)"}
                    stroke={isHovered ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.6)"}
                    strokeWidth={2}
                    style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                  />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isHovered ? "#1a1a2e" : "white"}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ pointerEvents: "none" }}
                  >
                    {connection.sequenceNumber}
                  </text>
                </g>
              </g>
            );
          })}

          {previewConnection && (
            <g data-testid="canvas-connection-preview">
              <path
                d={previewConnection.path}
                stroke={
                  previewConnection.state === "invalid"
                    ? "rgba(251, 113, 133, 0.75)"
                    : "rgba(34, 211, 238, 0.55)"
                }
                strokeWidth={4}
                strokeDasharray="10 8"
                fill="none"
                strokeLinecap="round"
                style={{ pointerEvents: "none" }}
              />
              <path
                d={previewConnection.path}
                stroke={
                  previewConnection.state === "invalid"
                    ? "rgba(251, 113, 133, 0.95)"
                    : "rgba(255, 255, 255, 0.85)"
                }
                strokeWidth={2}
                strokeDasharray="10 8"
                fill="none"
                strokeLinecap="round"
                style={{ pointerEvents: "none" }}
              />
            </g>
          )}
        </svg>

        {frames.map((frame, index) => (
          <FrameCard
            key={frame.id}
            id={frame.id}
            index={index}
            title={frame.title}
            thumbnail={frame.thumbnail}
            thumbnailColor={frame.thumbnailColor}
            isSelected={selectedFrameSet.has(frame.id)}
            isConnecting={connectingFromFrameId === frame.id}
            isPolished={frame.isPolished}
            isPolishing={frame.isPolishing}
            onClick={activeTool === "pan" ? () => undefined : () => onFrameSelect(frame.id)}
            onDoubleClick={activeTool === "select" ? () => onFrameDoubleClick?.(frame.id) : undefined}
            onConnectHoverStart={() => {
              if (!isConnectMode || !sourceFrame) return;
              setHoveredConnectFrameId(frame.id);
            }}
            onConnectHoverEnd={() => {
              if (!isConnectMode) return;
              setHoveredConnectFrameId((prev) => (prev === frame.id ? null : prev));
            }}
            onDelete={() => onFrameDelete(frame.id)}
            onDuplicate={() => onFrameDuplicate(frame.id)}
            onPolish={() => onFramePolish?.(frame.id)}
            position={frame.position}
            zoom={zoom}
            onPositionChange={(delta) => onFramePositionChange(frame.id, delta)}
            onPositionCommit={() => onFramePositionCommit?.(frame.id)}
            canDrag={canDragFrames}
            readOnly={readOnly}
            connectMode={isConnectMode}
            connectionState={
              isConnectMode && sourceFrame
                ? frame.id === sourceFrame.id
                  ? "source"
                  : hoveredConnectFrameId === frame.id
                  ? connectionPairSet.has(`${sourceFrame.id}:${frame.id}`) || frame.id === sourceFrame.id
                    ? "invalid-hover"
                    : "target-hover"
                  : connectionPairSet.has(`${sourceFrame.id}:${frame.id}`)
                  ? "idle"
                  : "target"
                : "idle"
            }
            beatModeEnabled={beatModeEnabled}
            durationMs={frame.durationMs}
            onDurationChange={(newDuration) => onFrameDurationChange?.(frame.id, newDuration)}
            motionNotes={frame.motionNotes}
            isRemoteMoving={frame.isRemoteMoving}
            remoteSelection={frame.remoteSelection}
          />
        ))}
      </motion.div>
    </div>
  );
}
