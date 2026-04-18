import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MousePointer2,
  Hand,
  ArrowRight,
  Plus,
  LayoutGrid,
  Play,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Clock,
  Video,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddFrame?: () => void;
  onAutoArrange?: () => void;
  onPreview?: () => void;
  onBatchPolish?: () => void;
  frameCount?: number;
  beatModeEnabled?: boolean;
  onBeatModeToggle?: () => void;
  onMotionSuggest?: () => void;
  onContinuityCheck?: () => void;
  isMotionSuggesting?: boolean;
  isContinuityChecking?: boolean;
  polishedFrameCount?: number;
  readOnly?: boolean;
}

export function CanvasToolbar({
  activeTool,
  onToolChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onAddFrame,
  onAutoArrange,
  onPreview,
  onBatchPolish,
  frameCount = 0,
  beatModeEnabled = false,
  onBeatModeToggle,
  onMotionSuggest,
  onContinuityCheck,
  isMotionSuggesting = false,
  isContinuityChecking = false,
  polishedFrameCount = 0,
  readOnly = false,
}: CanvasToolbarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-xl bg-[#1a1a2e]/80 backdrop-blur-md border border-white/10 shadow-lg">
        <div className="flex flex-col items-center gap-1">
          
          {/* Select */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="toolbar-select-tool"
                onClick={() => onToolChange("select")}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  activeTool === "select"
                    ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <MousePointer2 className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Select (V)</TooltipContent>
          </Tooltip>

          {/* Pan */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="toolbar-pan-tool"
                onClick={() => onToolChange("pan")}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  activeTool === "pan"
                    ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <Hand className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Pan (Space)</TooltipContent>
          </Tooltip>

          {/* Connector */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="toolbar-connector-tool"
                aria-disabled={readOnly || undefined}
                disabled={readOnly}
                onClick={() => !readOnly && onToolChange("connector")}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  readOnly
                    ? "text-white/20 cursor-not-allowed"
                    : activeTool === "connector"
                    ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Connect (C)</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px w-full bg-white/10 my-2" />

          {/* Add Frame */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="toolbar-add-frame"
                aria-disabled={readOnly || undefined}
                disabled={readOnly}
                onClick={() => !readOnly && onAddFrame?.()}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  readOnly
                    ? "text-white/20 cursor-not-allowed"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <Plus className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Add Frame (N)</TooltipContent>
          </Tooltip>

          {/* Auto-Arrange */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAutoArrange}
                disabled={frameCount < 2}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  frameCount < 2
                    ? "text-white/25 cursor-not-allowed"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Auto-Arrange</TooltipContent>
          </Tooltip>

          {/* Batch Polish */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="toolbar-batch-polish"
                onClick={() => !readOnly && onBatchPolish?.()}
                disabled={readOnly || frameCount < 1}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  readOnly || frameCount < 1
                    ? "text-white/25 cursor-not-allowed"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Polish All</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px w-full bg-white/10 my-2" />

          {/* Beat Mode */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onBeatModeToggle}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  beatModeEnabled
                    ? "bg-gradient-to-br from-orange-500 to-red-500 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <Clock className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Beat Mode</TooltipContent>
          </Tooltip>

          {/* Motion Suggest */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMotionSuggest}
                disabled={polishedFrameCount < 1 || isMotionSuggesting}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  polishedFrameCount < 1
                    ? "text-white/25 cursor-not-allowed"
                    : isMotionSuggesting
                    ? "bg-gradient-to-br from-violet-500 to-purple-500 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                {isMotionSuggesting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Video className="w-5 h-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Motion Suggest</TooltipContent>
          </Tooltip>

          {/* Continuity Check */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onContinuityCheck}
                disabled={polishedFrameCount < 2 || isContinuityChecking}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  polishedFrameCount < 2
                    ? "text-white/25 cursor-not-allowed"
                    : isContinuityChecking
                    ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                {isContinuityChecking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Continuity Check</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px w-full bg-white/10 my-2" />

          {/* Preview */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onPreview}
                disabled={frameCount < 1}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  frameCount < 1
                    ? "text-white/25 cursor-not-allowed"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <Play className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Preview</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px w-full bg-white/10 my-2" />

          {/* Zoom Out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onZoomOut}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom Out</TooltipContent>
          </Tooltip>

          {/* Zoom Percentage */}
          <div className="text-xs font-mono text-white/50">
            {Math.round(zoom * 100)}%
          </div>

          {/* Zoom In */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onZoomIn}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom In</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
