import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Loader2,
  Link2,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Wand2,
  FileText,
  Film,
  Clapperboard,
  X,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GLMStoryboardWorkflow } from "@/components/canvas/GLMStoryboardWorkflow";
import { getConfiguredAIProvider } from "@/lib/ai/provider";
import type { StoryboardDirectorControls } from "@/lib/ai/types";
import {
  generateDirectorsTreatment,
  generateShotList as generateShotListAI,
  rewriteMasterPrompt,
  DirectorConfig,
} from "@/lib/googleAI";
import {
  buildStoryboardVideoPrompt,
  enhanceStoryboardVideoPrompt,
  generateVideoFromFrame,
} from "@/lib/videoGeneration";
import { supabase } from "@/lib/supabase";
import {
  getPolishStyleVideoDirection,
  type PolishStyle,
} from "@/lib/polishStyles";

interface Frame {
  id: string;
  title?: string;
  description?: string;
  status: "sketch" | "polished";
  durationMs?: number;
  motionNotes?: string;
  animationStyle?: string;
  thumbnail?: string;
  polishedDataUrl?: string;
  sketchDataUrl?: string;
  polishStyle?: PolishStyle;
}

interface AIPanelProps {
  selectedFrames: string[];
  frames: Frame[];
  onPolish: () => void;
  onAnimate: () => void;
  isPolishing?: boolean;
  hasPolishedFrames?: boolean;
  onDuplicate?: (frameId: string) => void;
  onDelete?: (frameId: string) => void;
  onDurationChange?: (frameId: string, durationMs: number) => void;
  onSelectFrame?: (frameId: string) => void;
  onPreview?: () => void;
}

type VideoStyle = "Cinematic" | "Animated" | "Realistic" | "Stylized";

interface GeneratedPrompt {
  masterPrompt: string;
  framePrompts: Array<{ frameTitle: string; prompt: string; duration: number }>;
  totalDuration: number;
  technicalNotes: string;
}

// Creative Director types - Updated per spec
type Mood = "Dreamy" | "Tense" | "Epic" | "Cozy" | "Whimsical" | "Noir" | "Energetic" | "Minimal" | "Documentary";
type Pacing = "Slow" | "Medium" | "Fast";
type CameraLanguage = "Static tripod" | "Handheld doc" | "Smooth dolly" | "Crane/jib" | "Orbit" | "FPV drift";
type Lens = "14mm wide" | "24mm" | "35mm" | "50mm" | "85mm portrait";
type Lighting = "Soft key" | "High contrast" | "Neon night" | "Golden hour" | "Studio clean";
type ColorGrade = "Teal & orange" | "Pastel" | "Monochrome" | "Film grain" | "Vibrant";

interface CreativeDirectorSettings {
  mood: Mood | null;
  pacing: Pacing;
  camera: CameraLanguage | null;
  lens: Lens | null;
  lighting: Lighting | null;
  colorGrade: ColorGrade | null;
  motionIntensity: number;
  continuityStrictness: number;
  noGoList: string[];
}

type DirectorOutputTab = "treatment" | "shotlist" | "prompt";

const DEFAULT_DIRECTOR_SETTINGS: CreativeDirectorSettings = {
  mood: null,
  pacing: "Medium",
  camera: null,
  lens: null,
  lighting: null,
  colorGrade: null,
  motionIntensity: 50,
  continuityStrictness: 70,
  noGoList: [],
};

// Kestra AI Director types
interface KestraFrameUpdate {
  frame_id: string;
  recommended_duration_ms: number;
  recommended_animation_style: string;
  confidence: number;
  reason: string;
}

interface KestraDirectorOutput {
  storyboard_analysis: {
    board_id: string;
    total_frames: number;
    narrative: string;
  };
  external_summary: {
    pacing_trends: string[];
    sources: string[];
  };
  decisions: {
    frame_updates: KestraFrameUpdate[];
  };
  optimization_score: number;
}

// Parser utility for Kestra output
const parseKestraOutput = (rawOutput: string): KestraDirectorOutput | null => {
  try {
    let parsed = rawOutput;
    if (parsed.startsWith('"') && parsed.endsWith('"')) {
      parsed = JSON.parse(parsed);
    }
    parsed = parsed.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(parsed);
  } catch (error) {
    console.error('Failed to parse Kestra output:', error);
    return null;
  }
};

const KESTRA_URL = import.meta.env.VITE_KESTRA_URL || 'http://localhost:8080';

function formatDirectionValue(value: string | number | null | undefined, fallback = "Not set") {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "number") {
    return `${value}%`;
  }

  return value;
}

function SidebarAccordion({
  title,
  icon: Icon,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  icon: typeof Play;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.08]">
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-3.5 py-3 flex items-center justify-between transition-colors",
          open ? "bg-white/[0.04]" : "hover:bg-white/[0.02]",
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-7 h-7 rounded-xl border flex items-center justify-center transition-colors",
              open
                ? "border-white/15 bg-white/[0.06]"
                : "border-white/10 bg-black/10",
            )}
          >
            <Icon className="w-3.5 h-3.5 text-white/60" />
          </div>
          <span className="text-[11px] font-medium text-white/70">{title}</span>
          {badge && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/45">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Storage key for director settings per board
function getDirectorStorageKey(boardId: string | undefined): string {
  return `creative_director_${boardId || 'default'}`;
}

// Load director settings from localStorage
function loadDirectorSettings(boardId: string | undefined): CreativeDirectorSettings {
  try {
    const key = getDirectorStorageKey(boardId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_DIRECTOR_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load director settings:", e);
  }
  return { ...DEFAULT_DIRECTOR_SETTINGS };
}

// Save director settings to localStorage (debounced in component)
function saveDirectorSettings(boardId: string | undefined, settings: CreativeDirectorSettings): void {
  try {
    const key = getDirectorStorageKey(boardId);
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save director settings:", e);
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeSetSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Quota or disabled storage; fail silently (we still show prompt in UI)
  }
}

function getFrameImageUrl(f: Frame): string | null {
  return f.polishedDataUrl || f.thumbnail || f.sketchDataUrl || null;
}

async function toBase64DataUrl(imageUrl: string, timeoutMs = 15000): Promise<string> {
  if (imageUrl.startsWith("data:")) return imageUrl;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);

    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read image as base64"));
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error converting image to base64";
    throw new Error(`Could not access frame image. If this is a remote URL, it may be blocked by CORS. (${msg})`);
  } finally {
    clearTimeout(t);
  }
}

// Build director guidance string for Veo prompt enhancement
function buildDirectorGuidance(frames: Frame[], settings: CreativeDirectorSettings): string {
  const lines: string[] = ["DIRECTOR GUIDANCE:"];

  if (settings.mood) lines.push(`Mood: ${settings.mood} — evoke this emotional tone throughout.`);
  lines.push(`Pacing: ${settings.pacing} — ${settings.pacing === "Slow" ? "languid, contemplative rhythm" : settings.pacing === "Fast" ? "energetic, quick cuts" : "balanced, natural flow"}.`);
  if (settings.camera) lines.push(`Camera: ${settings.camera} movement style.`);
  if (settings.lens) lines.push(`Lens: ${settings.lens} perspective and depth of field.`);
  if (settings.lighting) lines.push(`Lighting: ${settings.lighting} aesthetic.`);
  if (settings.colorGrade) lines.push(`Color grade: ${settings.colorGrade} look.`);

  const motionLabel = settings.motionIntensity < 33 ? "subtle" : settings.motionIntensity > 66 ? "dynamic" : "moderate";
  lines.push(`Motion intensity: ${motionLabel} (${settings.motionIntensity}%).`);

  const continuityLabel = settings.continuityStrictness < 33 ? "loose" : settings.continuityStrictness > 66 ? "strict" : "balanced";
  lines.push(`Continuity: ${continuityLabel} — ${settings.continuityStrictness > 50 ? "maintain consistent character appearance, preserve scene composition, no new objects unless story-implied" : "allow creative interpretation between shots"}.`);

  if (settings.noGoList.length > 0) {
    lines.push(`Avoid: ${settings.noGoList.join(", ")}.`);
  }

  lines.push("Rules: Keep visual consistency across all frames. Smooth transitions. No jarring cuts unless intentional.");

  return lines.join("\n");
}

export function AIPanel({
  selectedFrames,
  frames,
  onAnimate,
  onDurationChange,
  onSelectFrame,
  onPreview,
}: AIPanelProps) {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const aiProvider = getConfiguredAIProvider();
  const isZAIEnabled = aiProvider === "zai";

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<
    "idle" | "analyzing" | "prompting" | "generating" | "complete"
  >("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState<VideoStyle>("Cinematic");

  // Generated prompt state
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Creative Director state - loaded from localStorage per board
  const [showDirector, setShowDirector] = useState(false);
  const [directorSettings, setDirectorSettings] = useState<CreativeDirectorSettings>(() => loadDirectorSettings(boardId));
  const [draftDirectorSettings, setDraftDirectorSettings] = useState<CreativeDirectorSettings>(() => loadDirectorSettings(boardId));
  const [directorEnabled, setDirectorEnabled] = useState(false);
  const [draftDirectorEnabled, setDraftDirectorEnabled] = useState(false);
  const [draftNoGoInput, setDraftNoGoInput] = useState("");
  const [noGoInput, setNoGoInput] = useState("");
  const [directorOutputTab, setDirectorOutputTab] = useState<DirectorOutputTab>("treatment");
  const [directorOutputs, setDirectorOutputs] = useState<{
    treatment: string;
    shotlist: string;
    prompt: string;
  }>({ treatment: "", shotlist: "", prompt: "" });
  const [showDirectorOutputs, setShowDirectorOutputs] = useState(false);
  const [directorCopied, setDirectorCopied] = useState(false);
  const [isGeneratingDirectorOutput, setIsGeneratingDirectorOutput] = useState(false);
  const [showGoogleAssistTools, setShowGoogleAssistTools] = useState(false);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);

  // Kestra AI Director state
  const [isRunningKestra, setIsRunningKestra] = useState(false);
  const [kestraResult, setKestraResult] = useState<KestraDirectorOutput | null>(null);
  const [kestraError, setKestraError] = useState<string | null>(null);
  const [kestraPolling, setKestraPolling] = useState(false);

  // Debounced save of director settings
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Save settings debounced
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDirectorSettings(boardId, directorSettings);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [directorSettings, boardId]);

  // Reload settings when boardId changes
  useEffect(() => {
    const nextSettings = loadDirectorSettings(boardId);
    setDirectorSettings(nextSettings);
    setDraftDirectorSettings(nextSettings);
  }, [boardId]);

  useEffect(() => {
    if (showDirectorOutputs) {
      setShowGoogleAssistTools(true);
    }
  }, [showDirectorOutputs]);

  useEffect(() => {
    if (isGenerating || (generatedPrompt && generationStep === "complete")) {
      setShowVideoPanel(true);
    }
  }, [generatedPrompt, generationStep, isGenerating]);

  useEffect(() => {
    if (!showDirector) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDirector(false);
        setDraftDirectorSettings(directorSettings);
        setDraftDirectorEnabled(directorEnabled);
        setDraftNoGoInput("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDirector, directorEnabled, directorSettings]);

  useEffect(() => {
    if (!showDirector) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showDirector]);

  // Run-safety
  const runIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const previousFramesNotReadyWarningRef = useRef<string | null>(null);
  const previousVideoErrorRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const polishedCount = useMemo(
    () => frames.filter((f) => f.status === "polished").length,
    [frames]
  );
  const totalFrames = frames.length;

  const totalDuration = useMemo(() => {
    return frames.reduce((acc, f) => acc + (f.durationMs || 2000), 0) / 1000;
  }, [frames]);

  const selectedFrame = useMemo(() => {
    return selectedFrames.length === 1
      ? frames.find((f) => f.id === selectedFrames[0]) || null
      : null;
  }, [selectedFrames, frames]);

  const frameImageStats = useMemo(() => {
    const missingImage = frames.filter((f) => !getFrameImageUrl(f)).length;
    const unpolished = frames.filter((f) => f.status !== "polished").length;
    return { missingImage, unpolished };
  }, [frames]);

  const durationTooShort = totalDuration < 5;
  const durationTooLong = totalDuration > 60;
  const activeDirectorControls = useMemo<StoryboardDirectorControls | null>(() => {
    if (!directorEnabled) {
      return null;
    }

    return {
      mood: directorSettings.mood,
      pacing: directorSettings.pacing,
      camera: directorSettings.camera,
      lens: directorSettings.lens,
      lighting: directorSettings.lighting,
      colorGrade: directorSettings.colorGrade,
      motionIntensity: directorSettings.motionIntensity,
      continuityStrictness: directorSettings.continuityStrictness,
      avoidList: directorSettings.noGoList,
    };
  }, [directorEnabled, directorSettings]);
  const directionSummaryRows = useMemo(
    () => [
      { label: "Mood", value: formatDirectionValue(directorSettings.mood, "Open brief") },
      { label: "Pacing", value: formatDirectionValue(directorSettings.pacing, "Medium") },
      { label: "Camera", value: formatDirectionValue(directorSettings.camera, "Flexible") },
      { label: "Lighting", value: formatDirectionValue(directorSettings.lighting, "Open") },
      { label: "Color", value: formatDirectionValue(directorSettings.colorGrade, "Open") },
      {
        label: "Continuity",
        value: formatDirectionValue(directorSettings.continuityStrictness, "70%"),
      },
    ],
    [directorSettings],
  );
  const isDirectorDirty =
    draftDirectorEnabled !== directorEnabled ||
    JSON.stringify(draftDirectorSettings) !== JSON.stringify(directorSettings);

  const canGenerate =
    totalFrames > 0 &&
    !isGenerating &&
    frameImageStats.unpolished === 0 &&
    frameImageStats.missingImage === 0;

  useEffect(() => {
    if (!generatedPrompt || generationStep !== "complete") return;

    const currentDuration =
      frames.reduce((acc, f) => acc + (f.durationMs || 2000), 0) / 1000;

    const durationDrift = Math.abs(currentDuration - generatedPrompt.totalDuration);
    if (durationDrift > 0.5) {
      setGeneratedPrompt(null);
      setGenerationStep("idle");
      setShowPromptDetails(false);
    }
  }, [frames, generatedPrompt, generationStep]);

  const setProgressSafe = useCallback((p: number) => {
    if (!mountedRef.current) return;
    setGenerationProgress(Math.round(clamp(p, 0, 100)));
  }, []);

  // Convert CreativeDirectorSettings to DirectorConfig for API calls
  const toDirectorConfig = (settings: CreativeDirectorSettings): DirectorConfig => ({
    mood: settings.mood,
    pacing: settings.pacing,
    camera: settings.camera,
    lens: settings.lens,
    lighting: settings.lighting,
    colorGrade: settings.colorGrade,
    motionIntensity: settings.motionIntensity,
    continuityStrictness: settings.continuityStrictness,
    noGoList: settings.noGoList,
  });

  // Prepare frames for API calls
  const prepareFramesForAPI = () => {
    return frames.map((f, index) => ({
      title: f.title || `Frame ${index + 1}`,
      imageUrl: getFrameImageUrl(f) || "",
      durationMs: f.durationMs || 2000,
      motionNotes: f.motionNotes,
      order: index,
    })).filter((f) => !!f.imageUrl);
  };

  // Director output handlers - API-based
  const handleGenerateTreatment = async () => {
    if (isGeneratingDirectorOutput || totalFrames === 0) return;

    setShowGoogleAssistTools(true);
    setIsGeneratingDirectorOutput(true);
    setError(null);
    setDirectorOutputTab("treatment");
    setShowDirectorOutputs(true);
    setDirectorOutputs((prev) => ({ ...prev, treatment: "Generating treatment..." }));

    try {
      const orderedFrames = prepareFramesForAPI();
      const treatment = await generateDirectorsTreatment(
        orderedFrames,
        selectedStyle,
        toDirectorConfig(directorSettings)
      );
      if (mountedRef.current) {
        setDirectorOutputs((prev) => ({ ...prev, treatment }));
      }
    } catch (err) {
      console.error("Failed to generate treatment:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to generate treatment");
        setDirectorOutputs((prev) => ({ ...prev, treatment: "Generation failed. Please try again." }));
      }
    } finally {
      if (mountedRef.current) {
        setIsGeneratingDirectorOutput(false);
      }
    }
  };

  const handleGenerateShotList = async () => {
    if (isGeneratingDirectorOutput || totalFrames === 0) return;

    setShowGoogleAssistTools(true);
    setIsGeneratingDirectorOutput(true);
    setError(null);
    setDirectorOutputTab("shotlist");
    setShowDirectorOutputs(true);
    setDirectorOutputs((prev) => ({ ...prev, shotlist: "Generating shot list..." }));

    try {
      const orderedFrames = prepareFramesForAPI();
      const shotlist = await generateShotListAI(
        orderedFrames,
        selectedStyle,
        toDirectorConfig(directorSettings)
      );
      if (mountedRef.current) {
        setDirectorOutputs((prev) => ({ ...prev, shotlist }));
      }
    } catch (err) {
      console.error("Failed to generate shot list:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to generate shot list");
        setDirectorOutputs((prev) => ({ ...prev, shotlist: "Generation failed. Please try again." }));
      }
    } finally {
      if (mountedRef.current) {
        setIsGeneratingDirectorOutput(false);
      }
    }
  };

  const handleRewritePrompt = async () => {
    if (isGeneratingDirectorOutput) return;

    // Need a base prompt to rewrite - either from generated prompt or build a simple one
    const basePrompt = generatedPrompt?.masterPrompt ||
      frames.map((f, i) => f.title || `Scene ${i + 1}`).join(", then ");

    if (!basePrompt || basePrompt.trim().length === 0) {
      setError("Generate a video prompt first, then rewrite with director settings.");
      return;
    }

    setShowGoogleAssistTools(true);
    setIsGeneratingDirectorOutput(true);
    setError(null);
    setDirectorOutputTab("prompt");
    setShowDirectorOutputs(true);
    setDirectorOutputs((prev) => ({ ...prev, prompt: "Rewriting prompt with director guidance..." }));

    try {
      const rewrittenPrompt = await rewriteMasterPrompt(
        basePrompt,
        toDirectorConfig(directorSettings)
      );
      if (mountedRef.current) {
        setDirectorOutputs((prev) => ({ ...prev, prompt: rewrittenPrompt }));
      }
    } catch (err) {
      console.error("Failed to rewrite prompt:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to rewrite prompt");
        setDirectorOutputs((prev) => ({ ...prev, prompt: "Generation failed. Please try again." }));
      }
    } finally {
      if (mountedRef.current) {
        setIsGeneratingDirectorOutput(false);
      }
    }
  };

  const handleCopyDirectorOutput = async () => {
    const content = directorOutputs[directorOutputTab];
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setDirectorCopied(true);
      setTimeout(() => setDirectorCopied(false), 2000);
    } catch {
      setError("Clipboard blocked. Select and copy manually.");
    }
  };

  const openDirectionStudio = () => {
    setDraftDirectorSettings(directorSettings);
    setDraftDirectorEnabled(directorEnabled);
    setDraftNoGoInput("");
    setShowDirector(true);
  };

  const closeDirectionStudio = () => {
    setShowDirector(false);
    setDraftDirectorSettings(directorSettings);
    setDraftDirectorEnabled(directorEnabled);
    setDraftNoGoInput("");
  };

  const applyDirectionStudio = () => {
    setDirectorSettings(draftDirectorSettings);
    setDirectorEnabled(draftDirectorEnabled);
    setDraftNoGoInput("");
    setShowDirector(false);
  };

  const handleAddNoGo = () => {
    const trimmed = draftNoGoInput.trim();
    if (trimmed && !draftDirectorSettings.noGoList.includes(trimmed)) {
      setDraftDirectorSettings((prev) => ({
        ...prev,
        noGoList: [...prev.noGoList, trimmed],
      }));
      setDraftNoGoInput("");
    }
  };

  const handleRemoveNoGo = (item: string) => {
    setDraftDirectorSettings((prev) => ({
      ...prev,
      noGoList: prev.noGoList.filter((x) => x !== item),
    }));
  };

  // Kestra AI Director handlers - demo-only fallback flow
  // TODO: Swap back to the real Kestra webhook implementation when needed
  const handleRunKestraDirector = async () => {
    if (!boardId || isRunningKestra) return;

    setIsRunningKestra(true);
    setKestraError(null);
    setKestraResult(null);
    setKestraPolling(true);

    try {
      // DEMO MODE: Fake the multi-agent processing with realistic console logs
      console.log('[AI Director] 🎬 Initializing Creative Intelligence Hub...');
      await new Promise((r) => setTimeout(r, 400));

      console.log('[AI Director] 📊 Market Analyst processing... analyzing trending content patterns');
      await new Promise((r) => setTimeout(r, 600));

      console.log('[AI Director] 📝 Story Editor analyzing... evaluating narrative structure');
      await new Promise((r) => setTimeout(r, 700));

      console.log('[AI Director] 🎥 Producer reviewing... optimizing frame durations and pacing');
      await new Promise((r) => setTimeout(r, 600));

      console.log('[AI Director] 🎭 Director synthesizing... generating final recommendations');
      await new Promise((r) => setTimeout(r, 500));

      if (!mountedRef.current) return;

      // Query Supabase for existing director_runs data
      console.log('[AI Director] 💾 Fetching orchestrated results from database...');
      const { data, error } = await supabase
        .from('director_runs')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.error('[AI Director] No results found:', error);
        throw new Error('No stored Kestra director run was found for this board. Run the external Kestra workflow first.');
      }

      console.log('[AI Director] ✅ Results retrieved successfully');
      const parsed = parseKestraOutput(data.agent_output);

      if (!parsed) {
        throw new Error('Failed to parse AI Director output');
      }

      console.log('[AI Director] 🎯 Optimization Score:', parsed.optimization_score);
      console.log('[AI Director] 📋 Frame Updates:', parsed.decisions.frame_updates.length);

      if (mountedRef.current) {
        setKestraResult(parsed);
      }
    } catch (err) {
      console.error('[AI Director] ❌ Error:', err);
      if (mountedRef.current) {
        setKestraError(err instanceof Error ? err.message : 'Failed to run AI Director');
      }
    } finally {
      if (mountedRef.current) {
        setIsRunningKestra(false);
        setKestraPolling(false);
      }
    }
  };

  // Apply Kestra recommendations to frames
  const handleApplyKestraRecommendation = (update: KestraFrameUpdate) => {
    if (onDurationChange) {
      onDurationChange(update.frame_id, update.recommended_duration_ms);
    }
  };

  const handleGenerateVideo = async () => {
    if (!canGenerate) return;

    setShowVideoPanel(true);
    const runId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    runIdRef.current = runId;

    setIsGenerating(true);
    setError(null);
    setProgressSafe(0);
    setGenerationStep("analyzing");

    try {
      setProgressSafe(10);

      const orderedFrames = frames
        .map((f, index) => ({
          title: f.title || `Frame ${index + 1}`,
          description: f.description,
          imageUrl: getFrameImageUrl(f) || "",
          durationMs: f.durationMs || 2000,
          motionNotes: f.motionNotes,
          animationStyle: f.animationStyle,
          order: index,
          polishStyle: f.polishStyle,
        }))
        .filter((f) => !!f.imageUrl);

      if (orderedFrames.length === 0) {
        throw new Error("No frame images available (missing thumbnails/polished/sketch images)");
      }

      const firstFrame = orderedFrames[0];
      if (!firstFrame?.imageUrl) throw new Error("First frame has no usable image URL");

      setProgressSafe(20);
      setGenerationStep("prompting");

      const selectedMotionMode =
        selectedFrame?.animationStyle ||
        orderedFrames.find((frame) => frame.animationStyle)?.animationStyle ||
        "static";
      const localPromptResult = buildStoryboardVideoPrompt({
        frames: orderedFrames,
        selectedVisualMode: selectedStyle,
        selectedMotionMode,
        savedPolishStyle:
          orderedFrames.find((frame) => frame.polishStyle)?.polishStyle || null,
        revisionInput: "",
      });
      const promptResult = await enhanceStoryboardVideoPrompt(localPromptResult, {
        frames: orderedFrames,
        selectedVisualMode: selectedStyle,
      });

      if (runIdRef.current !== runId || !mountedRef.current) return;

      setGeneratedPrompt(promptResult);
      setProgressSafe(40);
      setGenerationStep("generating");

      const imageInput = firstFrame.imageUrl;

      if (runIdRef.current !== runId || !mountedRef.current) return;

      const requestedSecondsRaw = Math.round((firstFrame.durationMs || 2000) / 1000);
      const requestedSeconds = clamp(requestedSecondsRaw, 5, 10);

      // Build the final Veo prompt - enhance with director guidance if enabled
      const basePrompt = promptResult?.masterPrompt || "Animate this scene with smooth motion";
      const styleReferenceFrame =
        orderedFrames.find((frame) => frame.polishStyle) || firstFrame;
      const polishStyleDirection = getPolishStyleVideoDirection(styleReferenceFrame.polishStyle);
      const veoPromptSections = [
        basePrompt,
        polishStyleDirection
          ? `VISUAL STYLE:\n${polishStyleDirection}\n\nSTYLE RULES:\n- preserve the exact subject and composition\n- keep the same framing and visual identity\n- no new objects or shot changes\n- motion should feel intentional and premium`
          : null,
        directorEnabled ? buildDirectorGuidance(frames, directorSettings) : null,
      ].filter(Boolean);
      const veoPrompt = veoPromptSections.join("\n\n");

      const videoResult = await generateVideoFromFrame(
        veoPrompt,
        imageInput,
        requestedSeconds,
        (progress, status) => {
          const scaled = 40 + clamp(progress, 0, 100) * 0.6;
          setProgressSafe(scaled);
          console.log(`[Video Gen] ${status}: ${progress}%`);
        }
      );

      if (runIdRef.current !== runId || !mountedRef.current) return;

      setProgressSafe(100);
      // Store both original and directed prompts in sessionStorage
      safeSetSession("generatedVideoPromptOriginal", basePrompt);
      safeSetSession("generatedVideoPromptDirected", veoPrompt);
      safeSetSession("generatedVideoPrompt", veoPrompt); // Keep for backwards compat
      setGenerationStep("complete");

      if (videoResult?.status === "done" && videoResult.videoUrl) {
        safeSetSession("generatedVideoUrl", videoResult.videoUrl);
        onAnimate();

        setTimeout(() => {
          if (!mountedRef.current) return;
          navigate(`/export/${boardId}`);
        }, 1200);
        return;
      }

      if (videoResult?.status === "error") {
        setError(videoResult.error || "Video generation failed");
        return;
      }

      console.warn("Video generation returned unexpected result:", videoResult);
      setTimeout(() => {
        if (!mountedRef.current) return;
        navigate(`/export/${boardId}`);
      }, 1200);
    } catch (err) {
      console.error("Generation failed:", err);
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Generation failed");
      setGenerationStep("idle");
    } finally {
      if (!mountedRef.current) return;
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!generatedPrompt) return;

    const fullPrompt = `MASTER PROMPT:\n${generatedPrompt.masterPrompt}\n\nFRAME PROMPTS:\n${generatedPrompt.framePrompts
      .map((fp, i) => `${i + 1}. ${fp.frameTitle} (${fp.duration}s):\n${fp.prompt}`)
      .join("\n\n")}\n\nTECHNICAL NOTES:\n${generatedPrompt.technicalNotes}`;

    try {
      await navigator.clipboard.writeText(fullPrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      setError("Clipboard blocked. Copy manually from the prompt panel.");
      setShowPromptDetails(true);
    }
  };

  const handleExportToPDF = () => {
    navigate(`/export/${boardId}`);
  };

  const styles: VideoStyle[] = ["Cinematic", "Animated", "Realistic", "Stylized"];
  const moods: Mood[] = ["Dreamy", "Tense", "Epic", "Cozy", "Whimsical", "Noir", "Energetic", "Minimal", "Documentary"];
  const pacings: Pacing[] = ["Slow", "Medium", "Fast"];
  const cameras: CameraLanguage[] = ["Static tripod", "Handheld doc", "Smooth dolly", "Crane/jib", "Orbit", "FPV drift"];
  const lenses: Lens[] = ["14mm wide", "24mm", "35mm", "50mm", "85mm portrait"];
  const lightings: Lighting[] = ["Soft key", "High contrast", "Neon night", "Golden hour", "Studio clean"];
  const colorGrades: ColorGrade[] = ["Teal & orange", "Pastel", "Monochrome", "Film grain", "Vibrant"];

  const getStepLabel = () => {
    switch (generationStep) {
      case "analyzing":
        return "Analyzing frames...";
      case "prompting":
        return "Crafting video prompt...";
      case "generating":
        return "Generating video...";
      case "complete":
        return "Ready!";
      default:
        return "";
    }
  };

  const framesNotReadyWarning =
    totalFrames === 0
      ? null
      : frameImageStats.unpolished > 0
      ? `Polish ${frameImageStats.unpolished} frame${frameImageStats.unpolished > 1 ? "s" : ""} first. Video generation needs image-ready storyboard frames before it can run.`
      : frameImageStats.missingImage > 0
      ? `Missing images for ${frameImageStats.missingImage} frame${frameImageStats.missingImage > 1 ? "s" : ""}. Add or polish those frames before generating video.`
      : null;

  useEffect(() => {
    const shouldOpenForWarning =
      !!framesNotReadyWarning &&
      previousFramesNotReadyWarningRef.current !== framesNotReadyWarning;

    if (!showVideoPanel && shouldOpenForWarning) {
      setShowVideoPanel(true);
    }

    previousFramesNotReadyWarningRef.current = framesNotReadyWarning;
  }, [framesNotReadyWarning, showVideoPanel]);

  useEffect(() => {
    const shouldOpenForError = !!error && previousVideoErrorRef.current !== error;

    if (!showVideoPanel && shouldOpenForError) {
      setShowVideoPanel(true);
    }

    previousVideoErrorRef.current = error;
  }, [error, showVideoPanel]);

  // Compact select component
  const CompactSelect = ({
    value,
    options,
    onChange,
    placeholder,
  }: {
    value: string | null;
    options: string[];
    onChange: (v: string | null) => void;
    placeholder: string;
  }) => (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white/80 focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 4px center", backgroundRepeat: "no-repeat", backgroundSize: "16px" }}
    >
      <option value="" className="bg-[#1a1a2e]">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#1a1a2e]">{opt}</option>
      ))}
    </select>
  );

  return (
    <>
    <div className="fixed right-4 top-20 bottom-4 w-72 z-40 bg-[#0b1020]/88 backdrop-blur-2xl border border-white/[0.08] rounded-[28px] shadow-[0_20px_60px_rgba(5,8,20,0.45)] overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Sequence Strip */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-white/70">Sequence</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onPreview}
                disabled={totalFrames === 0}
                className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30"
              >
                <Play className="w-4 h-4 text-white/70" />
              </button>
              <span className="text-xs font-mono text-white/50">
                {totalDuration.toFixed(1)}s
              </span>
            </div>
          </div>

          {totalFrames > 0 ? (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {frames.map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => onSelectFrame?.(frame.id)}
                    className={cn(
                      "flex-shrink-0 w-14 h-10 rounded-md border transition-all relative overflow-hidden",
                      selectedFrames.includes(frame.id)
                        ? "border-pink-500 ring-1 ring-pink-500/30"
                        : "border-white/10 hover:border-white/20"
                    )}
                  >
                    {getFrameImageUrl(frame) ? (
                      <img
                        src={getFrameImageUrl(frame)!}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full bg-white/5" />
                    )}
                    <div
                      className={cn(
                        "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
                        frame.status === "polished" ? "bg-emerald-400" : "bg-white/20"
                      )}
                    />
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-white/40 mt-2">
                {polishedCount}/{totalFrames} polished
              </p>

              {(durationTooShort || durationTooLong) && (
                <p className="text-[10px] text-amber-400/70 mt-2">
                  {durationTooShort
                    ? "Total duration is under 5s (Veo may reject)."
                    : "Total duration exceeds 60s (will be clamped)."}
                </p>
              )}
            </>
          ) : (
            <div className="h-12 rounded-md border border-dashed border-white/10 flex items-center justify-center">
              <span className="text-[10px] text-white/30">Add frames to canvas</span>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-cyan-400/15 border border-violet-400/20 flex items-center justify-center shrink-0">
                  <Clapperboard className="w-3.5 h-3.5 text-violet-200" />
                </div>
                <span className="text-[11px] font-semibold tracking-[0.01em] text-white/92">
                  Direction
                </span>
                <span
                  className={cn(
                    "text-[8px] px-1.5 py-0.5 rounded-full border",
                    directorEnabled
                      ? "bg-violet-500/14 text-violet-100 border-violet-300/25"
                      : "bg-white/[0.07] text-white/65 border-white/15",
                  )}
                >
                  {directorEnabled ? "Direction Active" : "Saved Direction"}
                </span>
              </div>

              <p className="mt-1.5 text-[10px] leading-relaxed text-white/62">
                {directorEnabled
                  ? "Saved cues are shaping the current plan and revision loop."
                  : "Saved cues are ready for the next plan when you want a more directed pass."}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {directionSummaryRows.map((row) => (
                  <span
                    key={row.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1.5 text-[9px] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    <span className="uppercase tracking-[0.14em] text-white/56">
                      {row.label}
                    </span>
                    <span className="font-medium text-white/92">{row.value}</span>
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={openDirectionStudio}
              className="shrink-0 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-violet-500/85 to-fuchsia-500/85 hover:from-violet-500 hover:to-fuchsia-500 text-[11px] text-white transition-all border border-violet-300/20 shadow-[0_10px_30px_rgba(168,85,247,0.26)] flex items-center justify-center gap-2"
            >
              <Sliders className="w-3.5 h-3.5" />
              Edit Direction
            </button>
          </div>
        </div>

        {false && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setShowDirector(!showDirector)}
            className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-white/70">Director Controls</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 font-medium border border-purple-500/20">
                {isZAIEnabled ? "GLM" : "Pro"}
              </span>
            </div>
            {showDirector ? (
              <ChevronUp className="w-4 h-4 text-white/40" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/40" />
            )}
          </button>

          <AnimatePresence>
            {showDirector && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50">
                      {isZAIEnabled ? "Use in GLM workflow" : "Apply to generation"}
                    </span>
                    <button
                      onClick={() => setDirectorEnabled(!directorEnabled)}
                      className={cn(
                        "w-8 h-4 rounded-full transition-all relative",
                        directorEnabled ? "bg-purple-500" : "bg-white/10"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                          directorEnabled ? "left-4.5" : "left-0.5"
                        )}
                        style={{ left: directorEnabled ? "calc(100% - 14px)" : "2px" }}
                      />
                    </button>
                  </div>

                  <p className="text-[9px] text-white/30 italic">
                    {isZAIEnabled
                      ? "These direction inputs shape the GLM storyboard plan and revision loop."
                      : '"Make it feel directed, not generated."'}
                  </p>

                  {/* Directing Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sliders className="w-3 h-3 text-white/40" />
                      <span className="text-[10px] text-white/50 uppercase tracking-wider">
                        {isZAIEnabled ? "GLM Direction Inputs" : "Directing Controls"}
                      </span>
                    </div>

                    {/* Mood */}
                    <div>
                      <label className="text-[9px] text-white/40 mb-1 block">Mood</label>
                      <CompactSelect
                        value={directorSettings.mood}
                        options={moods}
                        onChange={(v) => setDirectorSettings((s) => ({ ...s, mood: v as Mood | null }))}
                        placeholder="Select mood..."
                      />
                    </div>

                    {/* Pacing - Segmented */}
                    <div>
                      <label className="text-[9px] text-white/40 mb-1 block">Pacing</label>
                      <div className="flex gap-1">
                        {pacings.map((p) => (
                          <button
                            key={p}
                            onClick={() => setDirectorSettings((s) => ({ ...s, pacing: p }))}
                            className={cn(
                              "flex-1 py-1 text-[10px] rounded-md transition-all",
                              directorSettings.pacing === p
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Camera */}
                    <div>
                      <label className="text-[9px] text-white/40 mb-1 block">Camera</label>
                      <CompactSelect
                        value={directorSettings.camera}
                        options={cameras}
                        onChange={(v) => setDirectorSettings((s) => ({ ...s, camera: v as CameraLanguage | null }))}
                        placeholder="Camera style..."
                      />
                    </div>

                    {/* Lens */}
                    <div>
                      <label className="text-[9px] text-white/40 mb-1 block">Lens</label>
                      <CompactSelect
                        value={directorSettings.lens}
                        options={lenses}
                        onChange={(v) => setDirectorSettings((s) => ({ ...s, lens: v as Lens | null }))}
                        placeholder="Lens choice..."
                      />
                    </div>

                    {/* Lighting */}
                    <div>
                      <label className="text-[9px] text-white/40 mb-1 block">Lighting</label>
                      <CompactSelect
                        value={directorSettings.lighting}
                        options={lightings}
                        onChange={(v) => setDirectorSettings((s) => ({ ...s, lighting: v as Lighting | null }))}
                        placeholder="Lighting style..."
                      />
                    </div>

                    {/* Color Grade */}
                    <div>
                      <label className="text-[9px] text-white/40 mb-1 block">Color Grade</label>
                      <CompactSelect
                        value={directorSettings.colorGrade}
                        options={colorGrades}
                        onChange={(v) => setDirectorSettings((s) => ({ ...s, colorGrade: v as ColorGrade | null }))}
                        placeholder="Color look..."
                      />
                    </div>

                    {/* Motion Intensity Slider */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[9px] text-white/40">Motion Intensity</label>
                        <span className="text-[9px] text-white/50 font-mono">{directorSettings.motionIntensity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={directorSettings.motionIntensity}
                        onChange={(e) => setDirectorSettings((s) => ({ ...s, motionIntensity: Number(e.target.value) }))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <div className="flex justify-between text-[8px] text-white/30 mt-0.5">
                        <span>Subtle</span>
                        <span>Dynamic</span>
                      </div>
                    </div>

                    {/* Continuity Strictness Slider */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[9px] text-white/40">Continuity</label>
                        <span className="text-[9px] text-white/50 font-mono">{directorSettings.continuityStrictness}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={directorSettings.continuityStrictness}
                        onChange={(e) => setDirectorSettings((s) => ({ ...s, continuityStrictness: Number(e.target.value) }))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <div className="flex justify-between text-[8px] text-white/30 mt-0.5">
                        <span>Loose</span>
                        <span>Strict</span>
                      </div>
                      <p className="text-[8px] text-white/25 mt-1 italic">Consistency rules prevent AI drift.</p>
                    </div>

                    {/* No-Go List */}
                    <div>
                      <label className="text-[9px] text-white/40 mb-1 block">Avoid List</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={noGoInput}
                          onChange={(e) => setNoGoInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddNoGo()}
                          placeholder="e.g. camera shake"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/80 placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                        />
                        <button
                          onClick={handleAddNoGo}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/60 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {directorSettings.noGoList.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {directorSettings.noGoList.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 text-red-300 text-[9px] rounded-md border border-red-500/20"
                            >
                              {item}
                              <button
                                onClick={() => handleRemoveNoGo(item)}
                                className="hover:text-red-200 transition-colors"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Director Output Buttons */}
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Film className="w-3 h-3 text-white/40" />
                      <span className="text-[10px] text-white/50 uppercase tracking-wider">
                        {isZAIEnabled ? "Legacy Google Tools" : "Director Outputs"}
                      </span>
                    </div>

                    {isZAIEnabled && (
                      <p className="text-[9px] text-white/30 leading-relaxed">
                        Live Plan remains the primary workflow below. These Google helpers remain available as optional side tools.
                      </p>
                    )}

                    <button
                      onClick={handleGenerateTreatment}
                      disabled={totalFrames === 0 || isGeneratingDirectorOutput}
                      className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isGeneratingDirectorOutput && directorOutputTab === "treatment" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      Generate Director's Treatment
                    </button>

                    <button
                      onClick={handleGenerateShotList}
                      disabled={totalFrames === 0 || isGeneratingDirectorOutput}
                      className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isGeneratingDirectorOutput && directorOutputTab === "shotlist" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Clapperboard className="w-3 h-3" />
                      )}
                      Generate Shot List
                    </button>

                    <button
                      onClick={handleRewritePrompt}
                      disabled={totalFrames === 0 || isGeneratingDirectorOutput}
                      className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isGeneratingDirectorOutput && directorOutputTab === "prompt" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      Rewrite Master Prompt
                    </button>

                    {totalFrames === 0 && (
                      <p className="text-[8px] text-white/30 text-center">Add frames to enable outputs</p>
                    )}

                    {/* Kestra AI Director - Multi-Agent */}
                    {!isZAIEnabled && (
                    <div className="pt-3 mt-3 border-t border-white/10">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-white/50 uppercase tracking-wider">Multi-Agent Director</span>
                        <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20">
                          Kestra Demo
                        </span>
                      </div>

                      <button
                        onClick={handleRunKestraDirector}
                        disabled={isRunningKestra}
                        className={cn(
                          "w-full py-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-2",
                          isRunningKestra
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30"
                        )}
                      >
                        {isRunningKestra ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {kestraPolling ? "Loading demo director flow..." : "Starting..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Run Demo Director
                          </>
                        )}
                      </button>

                      <p className="text-[8px] text-white/30 text-center mt-1.5">
                        Market Analyst • Story Editor • Producer • Director
                      </p>

                      {kestraError && (
                        <p className="text-[9px] text-red-400 text-center mt-2">{kestraError}</p>
                      )}
                    </div>
                    )}

                    {/* Kestra Results Display */}
                    <AnimatePresence>
                      {!isZAIEnabled && kestraResult && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t border-white/10"
                        >
                          {/* Score */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] text-white/50">Optimization Score</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-green-400"
                                  style={{ width: `${kestraResult.optimization_score}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-emerald-400">
                                {kestraResult.optimization_score}
                              </span>
                            </div>
                          </div>

                          {/* Narrative */}
                          <div className="mb-3">
                            <span className="text-[9px] text-white/40 uppercase tracking-wider">AI Narrative</span>
                            <p className="text-[10px] text-white/70 mt-1 leading-relaxed italic">
                              "{kestraResult.storyboard_analysis.narrative}"
                            </p>
                          </div>

                          {/* Recommendations */}
                          <div>
                            <span className="text-[9px] text-white/40 uppercase tracking-wider mb-2 block">
                              Frame Recommendations
                            </span>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {kestraResult.decisions.frame_updates.map((update, i) => {
                                const frame = frames.find((f) => f.id === update.frame_id);
                                return (
                                  <div
                                    key={i}
                                    className="bg-white/5 rounded-lg p-2 border border-white/5"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-white/80 font-medium">
                                        {frame?.title || `Frame ${i + 1}`}
                                      </span>
                                      <span className="text-[9px] text-emerald-400 font-mono">
                                        {update.confidence}% confident
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] text-white/50 mb-1">
                                      <span>→ {update.recommended_duration_ms}ms</span>
                                      <span>•</span>
                                      <span>{update.recommended_animation_style}</span>
                                    </div>
                                    <p className="text-[9px] text-white/40 line-clamp-2">
                                      {update.reason}
                                    </p>
                                    <button
                                      onClick={() => handleApplyKestraRecommendation(update)}
                                      className="mt-1.5 w-full py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-[9px] text-emerald-400 transition-all"
                                    >
                                      Apply Duration
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Pacing Trends */}
                          {kestraResult.external_summary.pacing_trends.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-white/5">
                              <span className="text-[9px] text-white/40 uppercase tracking-wider">Market Insights</span>
                              <ul className="mt-1 space-y-1">
                                {kestraResult.external_summary.pacing_trends.map((trend, i) => (
                                  <li key={i} className="text-[9px] text-white/50 flex items-start gap-1">
                                    <span className="text-purple-400 mt-0.5">•</span>
                                    {trend}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Director Notes Panel */}
                  <AnimatePresence>
                    {showDirectorOutputs && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-2 border-t border-white/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-white/50">Director Notes</span>
                          <button
                            onClick={() => setShowDirectorOutputs(false)}
                            className="p-0.5 hover:bg-white/10 rounded transition-colors"
                          >
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 mb-2">
                          {(["treatment", "shotlist", "prompt"] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setDirectorOutputTab(tab)}
                              className={cn(
                                "flex-1 py-1 text-[9px] rounded-md transition-all capitalize",
                                directorOutputTab === tab
                                  ? "bg-purple-500/20 text-purple-300"
                                  : "bg-white/5 text-white/40 hover:text-white/60"
                              )}
                            >
                              {tab === "shotlist" ? "Shot List" : tab}
                            </button>
                          ))}
                        </div>

                        {/* Content */}
                        <div className="bg-white/5 rounded-lg p-2 max-h-32 overflow-y-auto">
                          <pre className="text-[9px] text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                            {directorOutputs[directorOutputTab] || "Generate content above..."}
                          </pre>
                        </div>

                        {/* Copy button */}
                        <button
                          onClick={handleCopyDirectorOutput}
                          disabled={!directorOutputs[directorOutputTab]}
                          className="w-full mt-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
                        >
                          {directorCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        )}

        <GLMStoryboardWorkflow
          boardId={boardId}
          frames={frames}
          selectedFrameIds={selectedFrames}
          directorControls={activeDirectorControls}
        />

        <SidebarAccordion
          title="Drafting Tools"
          icon={Wand2}
          open={showGoogleAssistTools}
          onToggle={() => setShowGoogleAssistTools((open) => !open)}
          badge={isZAIEnabled ? "Secondary" : undefined}
        >
          <div className="space-y-3">
            {isZAIEnabled && (
              <p className="text-[10px] text-white/35 leading-relaxed">
                Live Plan remains the primary workflow here. These drafting tools
                are still available for treatments, shot lists, and prompt work.
              </p>
            )}

            <div className="space-y-2">
              <button
                onClick={handleGenerateTreatment}
                disabled={totalFrames === 0 || isGeneratingDirectorOutput}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {isGeneratingDirectorOutput && directorOutputTab === "treatment" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                Generate Director&apos;s Treatment
              </button>

              <button
                onClick={handleGenerateShotList}
                disabled={totalFrames === 0 || isGeneratingDirectorOutput}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {isGeneratingDirectorOutput && directorOutputTab === "shotlist" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Clapperboard className="w-3 h-3" />
                )}
                Generate Shot List
              </button>

              <button
                onClick={handleRewritePrompt}
                disabled={totalFrames === 0 || isGeneratingDirectorOutput}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {isGeneratingDirectorOutput && directorOutputTab === "prompt" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wand2 className="w-3 h-3" />
                )}
                Rewrite Master Prompt
              </button>
            </div>

            {totalFrames === 0 && (
              <p className="text-[9px] text-white/30 text-center">
                Add frames to enable assist tools.
              </p>
            )}

            {!isZAIEnabled && (
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">
                    Multi-Agent Director
                  </span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20">
                    Kestra Demo
                  </span>
                </div>

                <button
                  onClick={handleRunKestraDirector}
                  disabled={isRunningKestra}
                  className={cn(
                    "w-full py-2 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-2",
                    isRunningKestra
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30",
                  )}
                >
                  {isRunningKestra ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {kestraPolling ? "Loading demo director flow..." : "Starting..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Run Demo Director
                    </>
                  )}
                </button>

                {kestraError && (
                  <p className="text-[9px] text-red-400 text-center">{kestraError}</p>
                )}

                {kestraResult && (
                  <div className="rounded-xl border border-white/5 bg-black/10 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/50">Optimization Score</span>
                      <span className="text-[11px] font-mono text-amber-300">
                        {kestraResult.optimization_score}%
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      {kestraResult.storyboard_analysis.narrative}
                    </p>
                    {kestraResult.decisions.frame_updates.slice(0, 2).map((update) => {
                      const frame = frames.find((f) => f.id === update.frame_id);
                      return (
                        <div
                          key={update.frame_id}
                          className="rounded-lg bg-white/5 p-2 border border-white/5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-white/70 font-medium">
                              {frame?.title || update.frame_id}
                            </span>
                            <span className="text-[9px] text-emerald-400">
                              {(update.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[9px] text-white/45 mt-1">
                            → {update.recommended_duration_ms}ms • {update.recommended_animation_style}
                          </p>
                          <button
                            onClick={() => handleApplyKestraRecommendation(update)}
                            className="mt-2 w-full py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-[9px] text-emerald-400 transition-all"
                          >
                            Apply Duration
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <AnimatePresence initial={false}>
              {showDirectorOutputs && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-3 border-t border-white/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-white/50">Director Notes</span>
                    <button
                      onClick={() => setShowDirectorOutputs(false)}
                      className="p-0.5 hover:bg-white/10 rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-white/40" />
                    </button>
                  </div>

                  <div className="flex gap-1 mb-2">
                    {(["treatment", "shotlist", "prompt"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDirectorOutputTab(tab)}
                        className={cn(
                          "flex-1 py-1 text-[9px] rounded-md transition-all capitalize",
                          directorOutputTab === tab
                            ? "bg-purple-500/20 text-purple-300"
                            : "bg-white/5 text-white/40 hover:text-white/60",
                        )}
                      >
                        {tab === "shotlist" ? "Shot List" : tab}
                      </button>
                    ))}
                  </div>

                  <div className="bg-white/5 rounded-lg p-2 max-h-32 overflow-y-auto">
                    <pre className="text-[9px] text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                      {directorOutputs[directorOutputTab] || "Generate content above..."}
                    </pre>
                  </div>

                  <button
                    onClick={handleCopyDirectorOutput}
                    disabled={!directorOutputs[directorOutputTab]}
                    className="w-full mt-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
                  >
                    {directorCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SidebarAccordion>

        <SidebarAccordion
          title="Generate Video"
          icon={Film}
          open={showVideoPanel}
          onToggle={() => setShowVideoPanel((open) => !open)}
          badge={directorEnabled ? "+Director" : undefined}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {styles.map((style) => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  disabled={isGenerating}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                    selectedStyle === style
                      ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                      : "bg-white/5 text-white/50 border border-transparent hover:text-white/70 hover:bg-white/10",
                    isGenerating && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {style}
                </button>
              ))}
            </div>

            <AnimatePresence initial={false}>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-white/50">{getStepLabel()}</span>
                    <span className="text-white/70 font-mono">{generationProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${generationProgress}%` }}
                      transition={{ ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              data-testid="ai-video-generate-button"
              onClick={handleGenerateVideo}
              disabled={!canGenerate}
              className={cn(
                "w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                canGenerate
                  ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-[0_4px_20px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-white/5 text-white/30 cursor-not-allowed",
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : generationStep === "complete" ? (
                <>
                  <Check className="w-4 h-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Video
                </>
              )}
            </button>

            <p className="text-[10px] text-white/40 text-center">
              Style-aware AI video generation
            </p>

            {error && (
              <p data-ai-panel-error role="alert" className="text-[10px] text-red-400 text-center">
                {error}
              </p>
            )}

            {framesNotReadyWarning && !isGenerating && (
              <p
                data-testid="ai-video-frames-not-ready"
                className="text-[10px] text-amber-400/70 text-center"
              >
                {framesNotReadyWarning}
              </p>
            )}

            <AnimatePresence initial={false}>
              {generatedPrompt && generationStep === "complete" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-3 border-t border-white/10"
                >
                  <button
                    onClick={() => setShowPromptDetails(!showPromptDetails)}
                    className="w-full flex items-center justify-between text-xs font-medium text-white/70 hover:text-white/90 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>AI Video Prompt</span>
                    </div>
                    {showPromptDetails ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {showPromptDetails && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-3"
                      >
                        <div>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider">
                            Master Prompt
                          </span>
                          <p className="text-xs text-white/80 mt-1 leading-relaxed">
                            {generatedPrompt.masterPrompt}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider">
                            Scene Breakdown
                          </span>
                          <div className="mt-1 space-y-2 max-h-32 overflow-y-auto">
                            {generatedPrompt.framePrompts.map((fp, i) => (
                              <div
                                key={i}
                                className="text-[10px] text-white/60 bg-white/5 rounded-lg p-2"
                              >
                                <span className="text-white/80 font-medium">
                                  {fp.frameTitle}
                                </span>
                                <span className="text-white/40 ml-2">
                                  ({fp.duration}s)
                                </span>
                                <p className="mt-0.5 line-clamp-2">{fp.prompt}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider">
                            Technical
                          </span>
                          <p className="text-[10px] text-white/50 mt-1">
                            {generatedPrompt.technicalNotes}
                          </p>
                        </div>

                        <button
                          onClick={handleCopyPrompt}
                          className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all flex items-center justify-center gap-2"
                        >
                          {promptCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Full Prompt
                            </>
                          )}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SidebarAccordion>

        {false && (
        <>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-medium text-white/70">Generate Video</span>
            {directorEnabled && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/20">
                +Director
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {styles.map((style) => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                disabled={isGenerating}
                className={cn(
                  "py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                  selectedStyle === style
                    ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                    : "bg-white/5 text-white/50 border border-transparent hover:text-white/70 hover:bg-white/10",
                  isGenerating && "opacity-50 cursor-not-allowed"
                )}
              >
                {style}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-white/50">{getStepLabel()}</span>
                  <span className="text-white/70 font-mono">{generationProgress}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${generationProgress}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            data-testid="ai-video-generate-button"
            onClick={handleGenerateVideo}
            disabled={!canGenerate}
            className={cn(
              "w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
              canGenerate
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-[0_4px_20px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : generationStep === "complete" ? (
              <>
                <Check className="w-4 h-4" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Video
              </>
            )}
          </button>

          <p className="text-[10px] text-white/40 text-center mt-2">
            Style-aware AI video generation
          </p>

          {error && (
            <p data-ai-panel-error role="alert" className="text-[10px] text-red-400 text-center mt-2">
              {error}
            </p>
          )}

          {framesNotReadyWarning && !isGenerating && (
            <p
              data-testid="ai-video-frames-not-ready"
              className="text-[10px] text-amber-400/70 text-center mt-2"
            >
              {framesNotReadyWarning}
            </p>
          )}
        </div>

        <AnimatePresence>
          {generatedPrompt && generationStep === "complete" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/10"
            >
              <div className="p-4">
                <button
                  onClick={() => setShowPromptDetails(!showPromptDetails)}
                  className="w-full flex items-center justify-between text-xs font-medium text-white/70 hover:text-white/90 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>AI Video Prompt</span>
                  </div>
                  {showPromptDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                <AnimatePresence>
                  {showPromptDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-3"
                    >
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">
                          Master Prompt
                        </span>
                        <p className="text-xs text-white/80 mt-1 leading-relaxed">
                          {generatedPrompt.masterPrompt}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">
                          Scene Breakdown
                        </span>
                        <div className="mt-1 space-y-2 max-h-32 overflow-y-auto">
                          {generatedPrompt.framePrompts.map((fp, i) => (
                            <div
                              key={i}
                              className="text-[10px] text-white/60 bg-white/5 rounded-lg p-2"
                            >
                              <span className="text-white/80 font-medium">
                                {fp.frameTitle}
                              </span>
                              <span className="text-white/40 ml-2">
                                ({fp.duration}s)
                              </span>
                              <p className="mt-0.5 line-clamp-2">{fp.prompt}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">
                          Technical
                        </span>
                        <p className="text-[10px] text-white/50 mt-1">
                          {generatedPrompt.technicalNotes}
                        </p>
                      </div>

                      <button
                        onClick={handleCopyPrompt}
                        className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all flex items-center justify-center gap-2"
                      >
                        {promptCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Full Prompt
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}

        {/* Selected Frame Details */}
        <AnimatePresence>
          {selectedFrame && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 border-b border-white/10"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/70">Selected</span>
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full",
                    selectedFrame.status === "polished"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-white/5 text-white/40"
                  )}
                >
                  {selectedFrame.status === "polished" ? "Ready" : "Draft"}
                </span>
              </div>

              <p className="text-sm text-white mb-3">
                {selectedFrame.title || "Untitled"}
              </p>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/40">Duration</span>
                  <span className="text-xs font-mono text-white/70">
                    {((selectedFrame.durationMs || 2000) / 1000).toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={100}
                  value={selectedFrame.durationMs || 2000}
                  onChange={(e) =>
                    onDurationChange?.(selectedFrame.id, Number(e.target.value))
                  }
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-pink-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>

              {selectedFrame.motionNotes && (
                <div>
                  <span className="text-[10px] text-white/40">Motion</span>
                  <p className="text-xs text-white/60 mt-1 italic">
                    "{selectedFrame.motionNotes}"
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <SidebarAccordion
          title="Export"
          icon={Link2}
          open={showExportPanel}
          onToggle={() => setShowExportPanel((open) => !open)}
        >
          <div className="flex gap-2">
            <button
              onClick={handleExportToPDF}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all"
            >
              PDF
            </button>
            <button
              onClick={() => navigate(`/export/${boardId}`)}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all"
            >
              Video
            </button>
            <button
              onClick={async () => {
                try {
                  const url = `${window.location.origin}/board/${boardId}`;
                  await navigator.clipboard.writeText(url);
                } catch {
                  setError("Clipboard blocked. Copy link from address bar.");
                }
              }}
              className="w-10 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-all flex items-center justify-center"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </SidebarAccordion>

        {false && (
        <SidebarAccordion
          title="Export"
          icon={Link2}
          open={showExportPanel}
          onToggle={() => setShowExportPanel((open) => !open)}
        >
          <div className="flex gap-2">
            <button
              onClick={handleExportToPDF}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all"
            >
              ↓ PDF
            </button>
            <button
              onClick={() => navigate(`/export/${boardId}`)}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all"
            >
              ↓ Video
            </button>
            <button
              onClick={async () => {
                try {
                  const url = `${window.location.origin}/board/${boardId}`;
                  await navigator.clipboard.writeText(url);
                } catch {
                  setError("Clipboard blocked. Copy link from address bar.");
                }
              }}
              className="w-10 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-all flex items-center justify-center"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </SidebarAccordion>
        )}

        {false && (
        <div className="p-4">
          <span className="text-xs font-medium text-white/70">Export</span>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleExportToPDF}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all"
            >
              ↓ PDF
            </button>
            <button
              onClick={() => navigate(`/export/${boardId}`)}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-all"
            >
              ↓ Video
            </button>
            <button
              onClick={async () => {
                try {
                  const url = `${window.location.origin}/board/${boardId}`;
                  await navigator.clipboard.writeText(url);
                } catch {
                  setError("Clipboard blocked. Copy link from address bar.");
                }
              }}
              className="w-10 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-all flex items-center justify-center"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>

    <AnimatePresence>
      {showDirector && (
        <>
          <motion.button
            type="button"
            aria-label="Close Direction Studio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#05070d]/60 backdrop-blur-md"
            onClick={closeDirectionStudio}
          />

          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-label="Direction Studio"
            className="fixed inset-y-0 right-0 z-[60] w-[min(460px,100vw)] border-l border-white/10 bg-[#0b1020]/96 backdrop-blur-2xl shadow-[-24px_0_80px_rgba(5,8,20,0.48)] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-5 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-400/20 flex items-center justify-center">
                      <Sliders className="w-4 h-4 text-violet-200" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-white">Direction Studio</h3>
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-200">
                          Right-side sheet
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40">
                        Adjust the saved direction without crowding the sidebar.
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed max-w-[320px]">
                    These controls guide the next live plan and stay available for revisions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDirectionStudio}
                  className="w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/85 transition-colors flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      Plan Feed
                    </p>
                    <p className="text-sm text-white/80 mt-1">
                      {draftDirectorEnabled ? "Direction is active for the next plan." : "Saved direction is ready when you want to apply it."}
                    </p>
                  </div>

                  <button
                    onClick={() => setDraftDirectorEnabled((enabled) => !enabled)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-all relative shrink-0",
                      draftDirectorEnabled ? "bg-purple-500" : "bg-white/10",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        draftDirectorEnabled ? "left-[calc(100%-18px)]" : "left-0.5",
                      )}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Mood", value: formatDirectionValue(draftDirectorSettings.mood, "Open brief") },
                    { label: "Pacing", value: formatDirectionValue(draftDirectorSettings.pacing, "Medium") },
                    { label: "Camera", value: formatDirectionValue(draftDirectorSettings.camera, "Flexible") },
                    { label: "Lighting", value: formatDirectionValue(draftDirectorSettings.lighting, "Open") },
                    { label: "Color", value: formatDirectionValue(draftDirectorSettings.colorGrade, "Open") },
                    { label: "Continuity", value: formatDirectionValue(draftDirectorSettings.continuityStrictness, "70%") },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
                    >
                      <p className="text-[9px] uppercase tracking-[0.14em] text-white/35">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-white/80 mt-1 leading-snug">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/15 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-3.5 h-3.5 text-purple-300" />
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Direction Inputs
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-white/45 mb-1.5 block">Mood</label>
                  <CompactSelect
                    value={draftDirectorSettings.mood}
                    options={moods}
                    onChange={(value) =>
                      setDraftDirectorSettings((state) => ({
                        ...state,
                        mood: value as Mood | null,
                      }))
                    }
                    placeholder="Select mood..."
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/45 mb-1.5 block">Pacing</label>
                  <div className="flex gap-1.5">
                    {pacings.map((pacing) => (
                      <button
                        key={pacing}
                        onClick={() =>
                          setDraftDirectorSettings((state) => ({
                            ...state,
                            pacing,
                          }))
                        }
                        className={cn(
                          "flex-1 py-2 text-[10px] rounded-xl transition-all border",
                          draftDirectorSettings.pacing === pacing
                            ? "bg-purple-500/15 text-purple-200 border-purple-500/30"
                            : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white/70",
                        )}
                      >
                        {pacing}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/45 mb-1.5 block">Camera</label>
                    <CompactSelect
                      value={draftDirectorSettings.camera}
                      options={cameras}
                      onChange={(value) =>
                        setDraftDirectorSettings((state) => ({
                          ...state,
                          camera: value as CameraLanguage | null,
                        }))
                      }
                      placeholder="Camera style..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-white/45 mb-1.5 block">Lens</label>
                    <CompactSelect
                      value={draftDirectorSettings.lens}
                      options={lenses}
                      onChange={(value) =>
                        setDraftDirectorSettings((state) => ({
                          ...state,
                          lens: value as Lens | null,
                        }))
                      }
                      placeholder="Lens choice..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/45 mb-1.5 block">Lighting</label>
                    <CompactSelect
                      value={draftDirectorSettings.lighting}
                      options={lightings}
                      onChange={(value) =>
                        setDraftDirectorSettings((state) => ({
                          ...state,
                          lighting: value as Lighting | null,
                        }))
                      }
                      placeholder="Lighting style..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-white/45 mb-1.5 block">Color Grade</label>
                    <CompactSelect
                      value={draftDirectorSettings.colorGrade}
                      options={colorGrades}
                      onChange={(value) =>
                        setDraftDirectorSettings((state) => ({
                          ...state,
                          colorGrade: value as ColorGrade | null,
                        }))
                      }
                      placeholder="Color look..."
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-white/45">Motion Intensity</label>
                    <span className="text-[10px] text-white/60 font-mono">
                      {draftDirectorSettings.motionIntensity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draftDirectorSettings.motionIntensity}
                    onChange={(event) =>
                      setDraftDirectorSettings((state) => ({
                        ...state,
                        motionIntensity: Number(event.target.value),
                      }))
                    }
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <div className="flex justify-between text-[9px] text-white/30">
                    <span>Subtle</span>
                    <span>Dynamic</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-white/45">Continuity Strictness</label>
                    <span className="text-[10px] text-white/60 font-mono">
                      {draftDirectorSettings.continuityStrictness}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draftDirectorSettings.continuityStrictness}
                    onChange={(event) =>
                      setDraftDirectorSettings((state) => ({
                        ...state,
                        continuityStrictness: Number(event.target.value),
                      }))
                    }
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <div className="flex justify-between text-[9px] text-white/30">
                    <span>Loose</span>
                    <span>Strict</span>
                  </div>
                  <p className="text-[9px] text-white/30 leading-relaxed">
                    Tight continuity gives the plan more consistency rules and fewer jumps between shots.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-red-300" />
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Avoid List
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draftNoGoInput}
                    onChange={(event) => setDraftNoGoInput(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleAddNoGo()}
                    placeholder="e.g. camera shake"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white/80 placeholder:text-white/30 focus:outline-none focus:border-purple-500/40"
                  />
                  <button
                    onClick={handleAddNoGo}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] text-white/70 transition-colors border border-white/10"
                  >
                    Add
                  </button>
                </div>

                {draftDirectorSettings.noGoList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {draftDirectorSettings.noGoList.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 text-red-200 text-[10px] rounded-full border border-red-500/20"
                      >
                        {item}
                        <button
                          onClick={() => handleRemoveNoGo(item)}
                          className="hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-white/35">
                    Add a few constraints to keep the plan clean and on-brief.
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-white/10 bg-[#080c17]/98">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] text-white/35 leading-relaxed max-w-[220px]">
                  Apply these settings to the next plan or close without changing the current one.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeDirectionStudio}
                    className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] text-white/70 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyDirectionStudio}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 text-[11px] font-medium text-white shadow-[0_8px_24px_rgba(168,85,247,0.28)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Apply to Plan
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
