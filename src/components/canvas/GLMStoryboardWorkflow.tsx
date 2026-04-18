import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clapperboard,
  Clock3,
  Copy,
  Film,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { analyzeStoryboardWithProvider } from "@/lib/ai/storyboardPlanning";
import { getConfiguredAIProvider } from "@/lib/ai/provider";
import {
  getStoryboardPlanningErrorDetails,
  type StoryboardPlanningErrorDetails,
} from "@/lib/ai/providers/zai";
import type {
  StoryboardDirectorControls,
  StoryboardFrameAnalysis,
  StoryboardPlanningRequest,
  StoryboardPlanningResult,
} from "@/lib/ai/types";

interface WorkflowFrame {
  id: string;
  title?: string;
  status: "sketch" | "polished";
  durationMs?: number;
  motionNotes?: string;
  thumbnail?: string;
  polishedDataUrl?: string;
  sketchDataUrl?: string;
}

interface GLMStoryboardWorkflowProps {
  boardId?: string;
  frames: WorkflowFrame[];
  selectedFrameIds: string[];
  directorControls?: StoryboardDirectorControls | null;
}

type WorkflowStageId =
  | "analysis"
  | "shot-plan"
  | "continuity"
  | "render"
  | "revision";

type WorkflowStageState =
  | "idle"
  | "pending"
  | "active"
  | "complete"
  | "ready"
  | "error";

type ResultTabId = "analysis" | "shot-plan" | "continuity" | "render";

const WORKFLOW_STAGES: Array<{
  id: WorkflowStageId;
  label: string;
  hint: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "analysis",
    label: "Storyboard Analysis",
    hint: "Reading ordered storyboard metadata",
    icon: Sparkles,
  },
  {
    id: "shot-plan",
    label: "Shot Plan",
    hint: "Grouping scenes and mapping shots",
    icon: Clapperboard,
  },
  {
    id: "continuity",
    label: "Continuity Rules",
    hint: "Locking character, prop, and lighting consistency",
    icon: ShieldCheck,
  },
  {
    id: "render",
    label: "Render Strategy",
    hint: "Choosing the safest generation path",
    icon: Film,
  },
  {
    id: "revision",
    label: "Revision Input",
    hint: "Ready for precise follow-up direction",
    icon: MessageSquare,
  },
];

const RESULT_TABS: Array<{
  id: ResultTabId;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: "analysis", label: "Analysis", icon: Sparkles },
  { id: "shot-plan", label: "Shot Plan", icon: Clapperboard },
  { id: "continuity", label: "Continuity", icon: ShieldCheck },
  { id: "render", label: "Render", icon: Film },
];

const RESULT_TAB_META: Record<
  ResultTabId,
  {
    eyebrow: string;
    hint: string;
  }
> = {
  analysis: {
    eyebrow: "Frame Read",
    hint: "Ordered storyboard cues interpreted from metadata and motion notes.",
  },
  "shot-plan": {
    eyebrow: "Shot Assembly",
    hint: "Scenes, shots, and timing shaped into a revision-ready plan.",
  },
  continuity: {
    eyebrow: "Continuity Guard",
    hint: "Rules that keep subjects, lighting, and props from drifting between shots.",
  },
  render: {
    eyebrow: "Render Strategy",
    hint: "The safest generation route chosen from the current storyboard plan.",
  },
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function hasCustomStoryboardTitle(title?: string): boolean {
  if (!title) {
    return false;
  }

  const trimmed = title.trim();
  return trimmed.length > 0 && !/^Frame \d+$/i.test(trimmed);
}

function formatNarrativeMode(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStageStateLabel(state: WorkflowStageState): string {
  switch (state) {
    case "active":
      return "Running";
    case "complete":
      return "Ready";
    case "pending":
      return "Queued";
    case "ready":
      return "Awaiting input";
    case "error":
      return "Needs attention";
    case "idle":
    default:
      return "Ready";
  }
}

function getStageStateClasses(state: WorkflowStageState): string {
  switch (state) {
    case "active":
      return "border-cyan-400/30 bg-cyan-500/10 text-cyan-300";
    case "complete":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
    case "pending":
      return "border-white/10 bg-white/5 text-white/45";
    case "ready":
      return "border-violet-400/25 bg-violet-500/10 text-violet-300";
    case "error":
      return "border-red-400/25 bg-red-500/10 text-red-300";
    case "idle":
    default:
      return "border-white/10 bg-white/5 text-white/50";
  }
}

function getStageIndicatorIcon(state: WorkflowStageState) {
  switch (state) {
    case "active":
      return Loader2;
    case "complete":
      return CheckCircle2;
    case "pending":
      return Clock3;
    case "ready":
      return Bot;
    case "error":
      return AlertCircle;
    case "idle":
    default:
      return Circle;
  }
}

function summarizeFrameAnalysis(analysis: StoryboardFrameAnalysis): string {
  const parts = [
    analysis.summary,
    analysis.cameraIntent !== "Unspecified camera intent"
      ? analysis.cameraIntent
      : null,
    analysis.action !== "Unspecified action" ? analysis.action : null,
  ].filter(Boolean);

  return parts.join(" | ");
}

function getDirectorControlSummary(
  controls: StoryboardDirectorControls | null | undefined,
): string[] {
  if (!controls) {
    return [];
  }

  const summary = [
    controls.mood ? `Mood: ${controls.mood}` : null,
    controls.pacing ? `Pacing: ${controls.pacing}` : null,
    controls.camera ? `Camera: ${controls.camera}` : null,
    controls.lens ? `Lens: ${controls.lens}` : null,
    controls.lighting ? `Lighting: ${controls.lighting}` : null,
    controls.colorGrade ? `Color: ${controls.colorGrade}` : null,
    typeof controls.motionIntensity === "number"
      ? `Motion: ${controls.motionIntensity}%`
      : null,
    typeof controls.continuityStrictness === "number"
      ? `Continuity: ${controls.continuityStrictness}%`
      : null,
    controls.avoidList && controls.avoidList.length > 0
      ? `Avoid: ${controls.avoidList.join(", ")}`
      : null,
  ].filter(Boolean);

  return summary as string[];
}

function formatWorkflowErrorMessage(
  error: unknown,
  options: { hasExistingResult: boolean } = { hasExistingResult: false },
): string {
  const fallback = "Live Plan could not complete.";
  const details = getStoryboardPlanningErrorDetails(error);

  if (details) {
    switch (details.category) {
      case "transient_upstream":
        return options.hasExistingResult
          ? "Live Plan could not refresh right now. Keeping the last successful plan visible while the planning service recovers."
          : "Live Plan is temporarily unavailable. Please try again in a moment.";
      case "billing_quota":
        return options.hasExistingResult
          ? "Live Plan could not refresh because the planning service account is out of capacity. The last successful plan is still available below."
          : "Live Plan is unavailable because the planning service account is out of capacity.";
      case "auth_config":
        return "Live Plan is not fully configured for this environment. Verify the deployed credentials and model access, then try again.";
      case "validation":
        return "Live Plan needs clearer storyboard input. Add ordered frames, timing, or motion notes and try again.";
      default:
        break;
    }
  }

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  const normalized = message.toLowerCase();

  if (
    normalized.includes("failed to send a request to the edge function") ||
    normalized.includes("fetch failed")
  ) {
    return "Could not reach Live Plan. Confirm the `storyboard-plan` service is deployed and this app is connected to the correct project.";
  }

  if (normalized.includes("edge function returned a non-2xx status code")) {
    return options.hasExistingResult
      ? "Live Plan could not refresh because the planning service returned an error. The current plan is still available below."
      : "Live Plan returned an error. Check the service logs and verify the planning configuration.";
  }

  if (normalized.includes("missing zai_api_key")) {
    return "Live Plan is missing `ZAI_API_KEY`. Add that server env var to the deployed service before trying again.";
  }

  if (
    normalized.includes("429") ||
    normalized.includes("1113") ||
    normalized.includes("insufficient balance") ||
    normalized.includes("no resource package")
  ) {
    return options.hasExistingResult
      ? "Live Plan could not refresh because the planning service account is out of capacity. The last successful plan is still available below."
      : "Live Plan is unavailable because the planning service account is out of capacity.";
  }

  if (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "Live Plan could not authenticate with the planning service. Verify the deployed credentials and model access, then try again.";
  }

  if (normalized.includes("invalid storyboard planning response")) {
    return options.hasExistingResult
      ? "Live Plan returned an incomplete response. The last successful plan is still available below."
      : "Live Plan returned an incomplete response. Try again, then verify the deployed service version if it persists.";
  }

  if (normalized.includes("missing supabase environment variables")) {
    return "This app is missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`, so it cannot reach the storyboard service.";
  }

  if (normalized.includes("only implemented for the z.ai")) {
    return "Live Plan is only available when `VITE_AI_PROVIDER=zai`. Restart the app after changing the env var.";
  }

  return message || fallback;
}

export function GLMStoryboardWorkflow({
  boardId,
  frames,
  selectedFrameIds,
  directorControls,
}: GLMStoryboardWorkflowProps) {
  const provider = getConfiguredAIProvider();
  const isZAIEnabled = provider === "zai";
  const [result, setResult] = useState<StoryboardPlanningResult | null>(null);
  const [revisionInput, setRevisionInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [preflightWarnings, setPreflightWarnings] = useState<string[]>([]);
  const [errorDetails, setErrorDetails] =
    useState<StoryboardPlanningErrorDetails | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [errorStageId, setErrorStageId] = useState<WorkflowStageId | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<ResultTabId>("analysis");
  const [lastRunSignature, setLastRunSignature] = useState<string | null>(null);
  const runTokenRef = useRef(0);
  const activeStageIndexRef = useRef(0);

  const scopedFrames = useMemo(() => {
    if (selectedFrameIds.length === 0) {
      return frames;
    }

    const selectedSet = new Set(selectedFrameIds);
    return frames.filter((frame) => selectedSet.has(frame.id));
  }, [frames, selectedFrameIds]);

  const frameScopeLabel =
    selectedFrameIds.length > 0
      ? `${scopedFrames.length} selected frame${scopedFrames.length === 1 ? "" : "s"}`
      : `${scopedFrames.length} storyboard frame${scopedFrames.length === 1 ? "" : "s"}`;

  const frameSignature = useMemo(
    () =>
      JSON.stringify(
        {
          selectedFrameIds,
          frames: scopedFrames.map((frame) => ({
            id: frame.id,
            title: frame.title,
            status: frame.status,
            durationMs: frame.durationMs,
            motionNotes: frame.motionNotes,
          })),
        },
      ),
    [scopedFrames, selectedFrameIds],
  );

  const isResultStale = !!result && lastRunSignature !== frameSignature;
  const isRevisionRun = !!result && revisionInput.trim().length > 0;
  const hasSufficientStoryboardInput = useMemo(() => {
    if (scopedFrames.length === 0) {
      return false;
    }

    const meaningfulFrameCount = scopedFrames.filter((frame) => {
      const hasMotionNotes = !!frame.motionNotes?.trim();
      const hasCustomDuration =
        typeof frame.durationMs === "number" && frame.durationMs > 500;

      return (
        hasCustomStoryboardTitle(frame.title) ||
        hasMotionNotes ||
        hasCustomDuration ||
        frame.status === "polished"
      );
    }).length;

    if (meaningfulFrameCount > 0) {
      return true;
    }

    return scopedFrames.length === 1;
  }, [scopedFrames]);
  const insufficientInputMessage = useMemo(() => {
    if (hasSufficientStoryboardInput) {
      return null;
    }

    return scopedFrames.length === 0
      ? null
      : "Add at least one storyboard frame, or clear a stale selection, to build a live plan.";
  }, [hasSufficientStoryboardInput, scopedFrames.length]);
  const directorControlSummary = useMemo(
    () => getDirectorControlSummary(directorControls),
    [directorControls],
  );
  const canRun =
    isZAIEnabled &&
    scopedFrames.length > 0 &&
    hasSufficientStoryboardInput &&
    !isRunning;
  const displayWarnings = useMemo(
    () => uniqueStrings([...(result?.warnings || []), ...preflightWarnings]),
    [preflightWarnings, result?.warnings],
  );

  useEffect(() => {
    activeStageIndexRef.current = activeStageIndex;
  }, [activeStageIndex]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveStageIndex((current) => Math.min(current + 1, 3));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (!result) {
      return;
    }

    setActiveResultTab("analysis");
  }, [result?.generatedAt, result?.requestId]);

  const progressValue = isRunning
    ? [18, 42, 68, 88][activeStageIndex] ?? 12
    : result
      ? 100
      : 0;
  const isSinglePathRun =
    !!result &&
    result.models.vision === result.models.planning &&
    result.endpoints.vision === result.endpoints.planning;

  const stageStates = useMemo(
    () =>
      WORKFLOW_STAGES.map((stage, index) => {
        let state: WorkflowStageState = "idle";

        if (errorStageId === stage.id) {
          state = "error";
        } else if (isRunning) {
          if (stage.id === "revision") {
            state = "pending";
          } else if (index < activeStageIndex) {
            state = "complete";
          } else if (index === activeStageIndex) {
            state = "active";
          } else {
            state = "pending";
          }
        } else if (result) {
          state = stage.id === "revision" ? "ready" : "complete";
        }

        return {
          ...stage,
          state,
        };
      }),
    [activeStageIndex, errorStageId, isRunning, result],
  );
  const activeResultMeta = RESULT_TAB_META[activeResultTab];
  const hasTechnicalDetails = !!result || !!errorDetails;

  async function buildRequestFrames() {
    const warnings: string[] = [];
    warnings.push(
      "This run used the metadata-first planning architecture and combined ordered storyboard metadata with the current Direction settings.",
    );

    if (selectedFrameIds.length > 0) {
      warnings.push(
        `Using the ${scopedFrames.length} currently selected frame ID${scopedFrames.length === 1 ? "" : "s"} as the active planning scope.`,
      );
    }

    const storyboardFrames = scopedFrames.map((frame, index) => {
      const frameLabel = frame.title || `Frame ${index + 1}`;
      const summaryParts = [
        frame.status === "polished" ? "Polished storyboard frame" : "Sketch storyboard frame",
        frame.motionNotes ? `Motion notes: ${frame.motionNotes}` : null,
      ].filter(Boolean);

      return {
        id: frame.id,
        order: index,
        title: frameLabel,
        imageUrl: null,
        durationMs: frame.durationMs || 2000,
        motionNotes: frame.motionNotes || null,
        description: summaryParts.length > 0 ? summaryParts.join(". ") : null,
        dialogue: null,
      };
    });

    return {
      storyboardFrames,
      warnings: uniqueStrings(warnings),
    };
  }

  async function handleRunWorkflow() {
    if (!canRun) {
      return;
    }

    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    setIsRunning(true);
    setRunError(null);
    setPreflightWarnings([]);
    setErrorDetails(null);
    setErrorStageId(null);
    setActiveStageIndex(0);

    try {
      const { storyboardFrames, warnings } = await buildRequestFrames();

      if (runTokenRef.current !== runToken) {
        return;
      }

      setPreflightWarnings(warnings);

      const request: StoryboardPlanningRequest = {
        boardId,
        selectedFrameIds:
          selectedFrameIds.length > 0
            ? scopedFrames.map((frame) => frame.id)
            : undefined,
        directorControls,
        provider: "zai",
        frames: storyboardFrames,
        revision: revisionInput.trim()
          ? {
              instruction: revisionInput.trim(),
            }
          : null,
        previousPlan: result,
      };

      const nextResult = await analyzeStoryboardWithProvider(request);
      if (runTokenRef.current !== runToken) {
        return;
      }

      setResult(nextResult);
      setLastRunSignature(frameSignature);
      setActiveStageIndex(3);
      setErrorStageId(null);
      setErrorDetails(null);
    } catch (error) {
      if (runTokenRef.current !== runToken) {
        return;
      }

      setErrorStageId(
        WORKFLOW_STAGES[Math.min(activeStageIndexRef.current, 3)].id,
      );
      setErrorDetails(getStoryboardPlanningErrorDetails(error));
      setRunError(
        formatWorkflowErrorMessage(error, { hasExistingResult: !!result }),
      );
    } finally {
      if (runTokenRef.current === runToken) {
        setIsRunning(false);
      }
    }
  }

  async function handleCopyRawPlan() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="p-4 border-b border-white/10" data-testid="glm-storyboard-workflow">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-cyan-300" />
        <span className="text-xs font-medium text-white/70">
          Live Plan
        </span>
        <span
          className={cn(
            "text-[8px] px-1.5 py-0.5 rounded border",
            isZAIEnabled
              ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/20"
              : "bg-white/5 text-white/45 border-white/10",
          )}
        >
          {isZAIEnabled ? "Available" : "Inactive"}
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-4">
        <div className="space-y-3">
          <div className="min-w-0">
            <p className="text-[11px] text-white/80 leading-relaxed">
              Build a scene map, shot plan, continuity cues, and render strategy
              from your ordered storyboard and saved direction.
            </p>
            {directorControlSummary.length > 0 ? (
              <p className="text-[10px] text-white/45 leading-relaxed mt-2">
                Direction is shaping mood, camera language, continuity, and render
                strategy for this run.
              </p>
            ) : (
              <p className="text-[10px] text-white/40 leading-relaxed mt-2">
                Add direction above if you want the plan to follow a specific
                mood, camera, lighting, or continuity brief.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[9px] px-2 py-1 rounded-full bg-white/5 text-white/55 border border-white/10">
                {frameScopeLabel}
              </span>
              {directorControlSummary.length > 0 && (
                <span className="text-[9px] px-2 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  direction active
                </span>
              )}
              {selectedFrameIds.length > 0 && (
                <span className="text-[9px] px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  selection locked
                </span>
              )}
            </div>
            {directorControlSummary.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {directorControlSummary.slice(0, 4).map((item) => (
                  <span
                    key={item}
                    className="text-[9px] px-2 py-1 rounded-full bg-black/10 text-white/50 border border-white/5"
                  >
                    {item}
                  </span>
                ))}
                {directorControlSummary.length > 4 && (
                  <span className="text-[9px] px-2 py-1 rounded-full bg-black/10 text-white/40 border border-white/5">
                    +{directorControlSummary.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>

          {result && (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.16em] text-white/45">
                Status
              </p>
              <p className="text-[10px] font-medium text-white/80">
                {isResultStale ? "Plan needs refresh" : "Plan ready"}
              </p>
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {(isRunning || result) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
              data-testid="glm-plan-progress"
            >
              <div className="flex justify-between text-[10px]">
                <span className="text-white/50">
                  {isRunning
                    ? stageStates[Math.min(activeStageIndex, 3)]?.label ||
                      "Running agent"
                    : "Workflow complete"}
                </span>
                <span className="text-white/70 font-mono">
                  {Math.round(progressValue)}%
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-400 to-sky-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressValue}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          {stageStates.map((stage) => {
            const StageIcon = stage.icon;
            const StageStateIcon = getStageIndicatorIcon(stage.state);

            return (
              <div
                key={stage.id}
                className={cn(
                  "rounded-xl border p-2.5 transition-all",
                  getStageStateClasses(stage.state),
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center shrink-0">
                      <StageIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-white/85">
                        {stage.label}
                      </p>
                      <p className="text-[9px] text-white/45 mt-0.5">
                        {stage.hint}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <StageStateIcon
                      className={cn(
                        "w-3.5 h-3.5",
                        stage.state === "active" && "animate-spin",
                      )}
                    />
                    <span className="text-[9px] uppercase tracking-[0.14em]">
                      {getStageStateLabel(stage.state)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isZAIEnabled && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] text-white/65 leading-relaxed">
              Live Plan is turned off in this environment. Enable{" "}
              <span className="font-mono text-white/80">VITE_AI_PROVIDER=zai</span>
              {" "}and restart the app to use it in this panel.
            </p>
          </div>
        )}

        {isZAIEnabled && scopedFrames.length === 0 && (
          <div
            className="rounded-xl border border-white/10 bg-white/5 p-3"
            data-testid="glm-insufficient-input-warning"
          >
            <p className="text-[10px] text-white/65 leading-relaxed">
              Add storyboard frames to this board, or clear a stale selection, to
              build a live plan.
            </p>
          </div>
        )}

        {isZAIEnabled && scopedFrames.length > 0 && !hasSufficientStoryboardInput && (
          <div
            className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"
            data-testid="glm-insufficient-input-warning"
          >
            <p className="text-[10px] text-amber-200 leading-relaxed">
              Add storyboard frames to this board, or clear a stale selection, to build a live plan.
            </p>
            {insufficientInputMessage && (
              <p className="text-[10px] text-amber-200/80 leading-relaxed mt-2">
                {insufficientInputMessage}
              </p>
            )}
          </div>
        )}

        {runError && (
          <div
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-3"
            data-testid="glm-plan-error"
          >
            <p className="text-[10px] text-red-300 leading-relaxed">{runError}</p>
          </div>
        )}

        {isResultStale && !isRunning && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-[10px] text-amber-200 leading-relaxed">
              The visible plan reflects an earlier frame selection or timing. Run it
              again to refresh Live Plan against the current storyboard.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div
                className="rounded-xl border border-white/10 bg-white/5 p-3"
                data-testid="glm-plan-result"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Live Plan
                      </span>
                    </div>
                    <p className="text-[11px] text-white/80 leading-relaxed mt-2">
                      {result.summary.narrative}
                    </p>
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {isSinglePathRun ? "current plan" : "latest run"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-black/10 p-2">
                    <p className="text-[9px] text-white/35 uppercase tracking-wider">
                      Scenes
                    </p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {result.summary.totalScenes}
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/10 p-2">
                    <p className="text-[9px] text-white/35 uppercase tracking-wider">
                      Shots
                    </p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {result.summary.totalShots}
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/10 p-2">
                    <p className="text-[9px] text-white/35 uppercase tracking-wider">
                      Duration
                    </p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {result.summary.estimatedDurationSeconds.toFixed(1)}s
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-black/10 p-1.5">
                  {RESULT_TABS.map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = activeResultTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveResultTab(tab.id)}
                        className={cn(
                          "min-w-0 rounded-lg px-2 py-2 text-[10px] font-medium transition-all flex items-center justify-center gap-1.5",
                          isActive
                            ? "bg-white/10 text-white border border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
                            : "text-white/45 hover:text-white/70",
                        )}
                      >
                        <TabIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-white/5 bg-black/10">
                  <div className="border-b border-white/5 bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-white/40">
                      {activeResultMeta.eyebrow}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-white/56">
                      {activeResultMeta.hint}
                    </p>
                  </div>

                  <div className="min-h-[220px] p-3">
                  {activeResultTab === "analysis" && (
                    <div className="space-y-2 max-h-[248px] overflow-y-auto pr-1">
                      {result.frameAnalyses.length > 0 ? (
                        result.frameAnalyses.map((analysis) => (
                          <div
                            key={analysis.frameId}
                            className="rounded-lg border border-white/5 bg-white/5 p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 break-words text-[10px] text-white/80 font-medium">
                                {analysis.title || `Frame ${analysis.order + 1}`}
                              </span>
                              <span className="shrink-0 text-[9px] text-white/35">
                                {analysis.sourceImageUsed ? "image" : "metadata"}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/55 mt-1 leading-relaxed">
                              {summarizeFrameAnalysis(analysis)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/45 leading-relaxed">
                          No frame-by-frame analysis was returned for this run. Refresh
                          the workflow to request a fuller pass.
                        </p>
                      )}
                    </div>
                  )}

                  {activeResultTab === "shot-plan" && (
                    <div className="space-y-2 max-h-[248px] overflow-y-auto pr-1">
                      {result.scenes.length > 0 ? (
                        result.scenes.map((scene) => (
                          <div
                            key={scene.sceneId}
                            className="rounded-lg border border-white/5 bg-white/5 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-white/85">
                                  {scene.label}
                                </p>
                                <p className="mt-0.5 break-words text-[10px] text-white/45">
                                  {scene.summary}
                                </p>
                              </div>
                              <span className="shrink-0 text-[9px] px-2 py-1 rounded-full bg-white/5 text-white/45 border border-white/10">
                                {scene.shots.length} shot{scene.shots.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div className="space-y-2 mt-3">
                              {scene.shots.map((shot) => (
                                <div
                                  key={shot.shotId}
                                  className="rounded-lg bg-black/10 p-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 break-words text-[10px] text-white/80 font-medium">
                                      {shot.label}
                                    </span>
                                    <span className="shrink-0 text-[9px] text-white/35">
                                      {shot.estimatedDurationSeconds.toFixed(1)}s
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-white/55 mt-1 leading-relaxed">
                                    {shot.camera} | {shot.action}
                                  </p>
                                  <p className="text-[9px] text-white/40 mt-1 leading-relaxed">
                                    {shot.composition}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/45 leading-relaxed">
                          No structured scenes were returned for this run. Refresh the
                          workflow to ask for a fuller shot breakdown.
                        </p>
                      )}
                    </div>
                  )}

                  {activeResultTab === "continuity" && (
                    <>
                      {result.continuityConstraints.length > 0 ? (
                        <div className="space-y-2 max-h-[248px] overflow-y-auto pr-1">
                          {result.continuityConstraints.map((constraint) => (
                            <div
                              key={constraint.id}
                              className="rounded-lg border border-white/5 bg-white/5 p-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-white/70 uppercase tracking-wider">
                                  {constraint.category}
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px] px-2 py-1 rounded-full border",
                                    constraint.priority === "high"
                                      ? "bg-red-500/10 border-red-500/20 text-red-300"
                                      : constraint.priority === "medium"
                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
                                  )}
                                >
                                  {constraint.priority}
                                </span>
                              </div>
                              <p className="text-[10px] text-white/75 mt-1.5 leading-relaxed">
                                {constraint.rule}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-white/45 leading-relaxed">
                          No additional continuity risks were called out in this pass.
                        </p>
                      )}
                    </>
                  )}

                  {activeResultTab === "render" && (
                    <div className="space-y-3 max-h-[248px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-[9px] text-white/35 uppercase tracking-wider">
                            Narrative Mode
                          </p>
                          <p className="text-[10px] text-white/80 mt-1">
                            {formatNarrativeMode(result.renderStrategy.narrativeMode)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-[9px] text-white/35 uppercase tracking-wider">
                            Aspect Ratio
                          </p>
                          <p className="text-[10px] text-white/80 mt-1">
                            {result.renderStrategy.recommendedAspectRatio}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/35 uppercase tracking-wider">
                          Consistency Approach
                        </p>
                        <p className="text-[10px] text-white/75 mt-1 leading-relaxed">
                          {result.renderStrategy.consistencyApproach}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/35 uppercase tracking-wider">
                          Transition Strategy
                        </p>
                        <p className="text-[10px] text-white/75 mt-1 leading-relaxed">
                          {result.renderStrategy.transitionStrategy}
                        </p>
                      </div>
                      {result.renderStrategy.batchingPlan.length > 0 && (
                        <div>
                          <p className="text-[9px] text-white/35 uppercase tracking-wider">
                            Batch Plan
                          </p>
                          <div className="space-y-1 mt-1">
                            {result.renderStrategy.batchingPlan.map((step, index) => (
                              <p
                                key={`${step}-${index}`}
                                className="text-[10px] text-white/60 leading-relaxed"
                              >
                                - {step}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-violet-300" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              Revision Input
            </span>
          </div>
          <Textarea
            data-testid="glm-revision-input"
            value={revisionInput}
            onChange={(event) => setRevisionInput(event.target.value)}
            placeholder={
              result
                ? "Ask for a pacing change, a cleaner continuity rule, or a tighter render plan..."
                : "Optional: add a brief creative instruction before the first run."
            }
            className="min-h-[84px] resize-none rounded-xl border-white/10 bg-white/5 text-[11px] text-white/80 placeholder:text-white/30 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          <div className="mt-3 flex flex-col gap-3">
            <div className="text-[9px] text-white/35 leading-relaxed">
              {!isZAIEnabled
                ? "Enable the planning provider and restart the app to use Live Plan here."
                : scopedFrames.length === 0 || !hasSufficientStoryboardInput
                  ? "Add at least one storyboard frame, or clear a stale selection, to build a live plan."
                  : result
                ? "The next run will preserve the current plan where possible and revise only the requested parts."
                : "The first run builds a baseline plan from ordered storyboard metadata and the active Direction settings."}
            </div>

            <button
              type="button"
              onClick={handleRunWorkflow}
              disabled={!canRun}
              data-testid="glm-run-plan-button"
              className={cn(
                "w-full px-3 py-2 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-2",
                canRun
                  ? "bg-gradient-to-r from-cyan-500 to-sky-500 text-white hover:shadow-[0_4px_18px_rgba(34,211,238,0.22)] hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-white/5 text-white/30 cursor-not-allowed",
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {isRevisionRun ? "Revising..." : "Running..."}
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  {isRevisionRun
                    ? "Apply Revision"
                    : result
                      ? "Refresh Plan"
                      : "Create Plan"}
                </>
              )}
            </button>
          </div>
        </div>

        {hasTechnicalDetails && (
          <div className="rounded-xl border border-white/10 bg-white/5">
            <button
              onClick={() => setTechnicalOpen((open) => !open)}
              className="w-full px-3 py-2.5 flex items-center justify-between text-[10px] text-white/55 hover:text-white/75 transition-colors"
            >
              <span className="uppercase tracking-[0.16em]">Technical Details</span>
              {technicalOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <AnimatePresence initial={false}>
              {technicalOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-3 pb-3 space-y-3"
                >
                  {isSinglePathRun && result && (
                    <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2">
                      <p className="text-[10px] text-cyan-200 leading-relaxed">
                        This run stayed on the metadata-first planning architecture.
                        Analysis and planning were both served by glm-5.1 on the
                        Z.AI coding endpoint.
                      </p>
                    </div>
                  )}
                  {result && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-black/10 p-2">
                          <p className="text-[9px] text-white/35 uppercase tracking-wider">
                            Analysis
                          </p>
                          <p className="text-[10px] text-white/80 mt-1">
                            {result.models.vision}
                          </p>
                          <p className="text-[9px] text-white/35 mt-1 break-all">
                            {result.endpoints.vision}
                          </p>
                        </div>
                        <div className="rounded-lg bg-black/10 p-2">
                          <p className="text-[9px] text-white/35 uppercase tracking-wider">
                            Planning
                          </p>
                          <p className="text-[10px] text-white/80 mt-1">
                            {result.models.planning}
                          </p>
                          <p className="text-[9px] text-white/35 mt-1 break-all">
                            {result.endpoints.planning}
                          </p>
                        </div>
                      </div>

                      {result.requestId && (
                        <div className="rounded-lg bg-black/10 p-2">
                          <p className="text-[9px] text-white/35 uppercase tracking-wider">
                            Request ID
                          </p>
                          <p className="text-[10px] text-white/70 mt-1 break-all font-mono">
                            {result.requestId}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {errorDetails && (
                    <div className="rounded-lg bg-black/10 p-2 space-y-2">
                      <p className="text-[9px] text-white/35 uppercase tracking-wider">
                        Latest Service Issue
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] text-white/35">Category</p>
                          <p className="text-[10px] text-white/75 mt-1">
                            {errorDetails.category.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/35">Retry Count</p>
                          <p className="text-[10px] text-white/75 mt-1">
                            {errorDetails.retryCount ?? 0}
                          </p>
                        </div>
                        {errorDetails.model && (
                          <div>
                            <p className="text-[9px] text-white/35">Model</p>
                            <p className="text-[10px] text-white/75 mt-1">
                              {errorDetails.model}
                            </p>
                          </div>
                        )}
                        {errorDetails.code && (
                          <div>
                            <p className="text-[9px] text-white/35">Provider Code</p>
                            <p className="text-[10px] text-white/75 mt-1">
                              {errorDetails.code}
                            </p>
                          </div>
                        )}
                      </div>

                      {(errorDetails.requestId || errorDetails.upstreamErrorId) && (
                        <div className="grid grid-cols-1 gap-2">
                          {errorDetails.requestId && (
                            <div>
                              <p className="text-[9px] text-white/35 uppercase tracking-wider">
                                Request ID
                              </p>
                              <p className="text-[10px] text-white/70 mt-1 break-all font-mono">
                                {errorDetails.requestId}
                              </p>
                            </div>
                          )}
                          {errorDetails.upstreamErrorId && (
                            <div>
                              <p className="text-[9px] text-white/35 uppercase tracking-wider">
                                Upstream Error ID
                              </p>
                              <p className="text-[10px] text-white/70 mt-1 break-all font-mono">
                                {errorDetails.upstreamErrorId}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {errorDetails.selectedFrameIds &&
                        errorDetails.selectedFrameIds.length > 0 && (
                          <div>
                            <p className="text-[9px] text-white/35 uppercase tracking-wider">
                              Selected Frames
                            </p>
                            <p className="text-[10px] text-white/70 mt-1 break-all font-mono">
                              {errorDetails.selectedFrameIds.join(", ")}
                            </p>
                          </div>
                        )}

                      {errorDetails.providerMessage && (
                        <div>
                          <p className="text-[9px] text-white/35 uppercase tracking-wider">
                            Provider Message
                          </p>
                          <p className="text-[10px] text-white/60 mt-1 leading-relaxed break-words font-mono">
                            {errorDetails.providerMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {displayWarnings.length > 0 && (
                    <div className="rounded-lg bg-black/10 p-2">
                      <p className="text-[9px] text-white/35 uppercase tracking-wider">
                        Workflow Notes
                      </p>
                      <div className="space-y-1 mt-2">
                        {displayWarnings.map((warning, index) => (
                          <p
                            key={`${warning}-${index}`}
                            className="text-[10px] text-white/60 leading-relaxed"
                          >
                            - {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {result && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setRawOpen((open) => !open)}
                          className="text-[10px] text-white/55 hover:text-white/75 transition-colors"
                        >
                          {rawOpen ? "Hide raw plan" : "Show raw plan"}
                        </button>

                        <button
                          onClick={handleCopyRawPlan}
                          className="text-[10px] text-white/55 hover:text-white/75 transition-colors flex items-center gap-1.5"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy JSON
                            </>
                          )}
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {rawOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="rounded-lg bg-black/20 border border-white/5 p-2 max-h-52 overflow-y-auto"
                          >
                            <pre className="text-[9px] text-white/60 whitespace-pre-wrap leading-relaxed font-mono">
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
