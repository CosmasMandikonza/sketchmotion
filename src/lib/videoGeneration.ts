import { supabase } from "./supabase";
import { generateStoryboardVideoPrompt as generateGeminiStoryboardVideoPrompt } from "./googleAI";
import {
  getPolishStyleVideoDirection,
  type PolishStyle,
} from "./polishStyles";
import {
  normalizeMediaError,
  shouldRetryMediaError,
  waitForRetry,
} from "./mediaErrors";

export type VideoVisualMode = "Cinematic" | "Animated" | "Realistic" | "Stylized";

export interface StoryboardPromptFrameInput {
  title?: string;
  description?: string;
  imageUrl?: string;
  durationMs?: number;
  motionNotes?: string;
  animationStyle?: string;
  polishStyle?: PolishStyle;
  order?: number;
}

export interface StoryboardVideoPromptResult {
  masterPrompt: string;
  framePrompts: Array<{ frameTitle: string; prompt: string; duration: number }>;
  totalDuration: number;
  technicalNotes: string;
}

const VISUAL_MODE_MAP: Record<VideoVisualMode, string> = {
  Cinematic: "cinematic motion design with premium lighting, controlled depth, and clean editorial framing",
  Animated: "stylized animated motion with expressive timing, readable silhouettes, and designed transitions",
  Realistic: "realistic cinematic movement with believable materials, lens behavior, and natural depth",
  Stylized: "high-style motion treatment with strong graphic choices, deliberate contrast, and art-directed energy",
};

const MOTION_MODE_MAP: Record<string, string> = {
  static: "anchored camera with subtle premium motion",
  "zoom-in": "controlled push-in movement with stable framing",
  "zoom-out": "measured pull-back movement that preserves composition",
  "pan-left": "smooth leftward pan with coherent parallax",
  "pan-right": "smooth rightward pan with coherent parallax",
  parallax: "layered parallax motion with gentle depth separation",
};

function normalizeVideoDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds)) return 6;
  return Math.max(5, Math.min(10, Math.round(durationSeconds)));
}

function getVideoPromptProviders() {
  return {
    primary: (import.meta.env.VITE_VIDEO_PROMPT_PROVIDER || "local").toLowerCase(),
    fallback: (import.meta.env.VITE_VIDEO_PROMPT_PROVIDER_FALLBACK || "gemini").toLowerCase(),
  };
}

function formatFrameTitle(frame: StoryboardPromptFrameInput, index: number) {
  return frame.title?.trim() || `Frame ${index + 1}`;
}

function formatFrameDescription(frame: StoryboardPromptFrameInput) {
  const description = frame.description?.trim();
  if (description) return description;

  const motion = frame.motionNotes?.trim();
  if (motion) return `Storyboard beat with motion notes: ${motion}.`;

  return "Storyboard beat with composition-led visual storytelling.";
}

function resolveMotionMode(
  frames: StoryboardPromptFrameInput[],
  selectedMotionMode?: string | null,
) {
  const explicit = selectedMotionMode?.trim();
  if (explicit) {
    return explicit;
  }

  const frameAnimationStyle = frames.find((frame) => frame.animationStyle)?.animationStyle;
  return frameAnimationStyle || "static";
}

function resolvePolishStyle(
  frames: StoryboardPromptFrameInput[],
  savedPolishStyle?: PolishStyle | null,
) {
  return savedPolishStyle || frames.find((frame) => frame.polishStyle)?.polishStyle || null;
}

function buildFramePrompt(
  frame: StoryboardPromptFrameInput,
  index: number,
  motionMode: string,
  visualMode: VideoVisualMode,
  polishStyleDirection: string | null,
) {
  const title = formatFrameTitle(frame, index);
  const description = formatFrameDescription(frame);
  const motionNotes = frame.motionNotes?.trim();
  const frameMotionMode = MOTION_MODE_MAP[frame.animationStyle || ""] || MOTION_MODE_MAP[motionMode] || motionMode;

  return {
    frameTitle: title,
    prompt: [
      `${title}: ${description}`,
      `Visual treatment: ${VISUAL_MODE_MAP[visualMode]}.`,
      polishStyleDirection ? `Style continuity: ${polishStyleDirection}.` : null,
      motionNotes ? `Motion notes: ${motionNotes}.` : null,
      `Motion mode: ${frameMotionMode}.`,
      "Preserve subject identity, composition, framing, and continuity.",
    ]
      .filter(Boolean)
      .join(" "),
    duration: normalizeVideoDuration((frame.durationMs || 2000) / 1000),
  };
}

export function buildStoryboardVideoPrompt(options: {
  frames: StoryboardPromptFrameInput[];
  revisionInput?: string;
  selectedMotionMode?: string | null;
  selectedVisualMode?: VideoVisualMode;
  savedPolishStyle?: PolishStyle | null;
}): StoryboardVideoPromptResult {
  const frames = options.frames || [];
  const visualMode = options.selectedVisualMode || "Cinematic";
  const motionMode = resolveMotionMode(frames, options.selectedMotionMode);
  const polishStyle = resolvePolishStyle(frames, options.savedPolishStyle);
  const polishStyleDirection = getPolishStyleVideoDirection(polishStyle);
  const revisionInput = options.revisionInput?.trim();
  const totalDuration =
    frames.reduce((total, frame) => total + (frame.durationMs || 2000), 0) / 1000 || 6;

  const framePrompts =
    frames.length > 0
      ? frames.map((frame, index) =>
          buildFramePrompt(frame, index, motionMode, visualMode, polishStyleDirection),
        )
      : [
          {
            frameTitle: "Storyboard Frame",
            prompt: [
              "Create a polished animated shot from the current storyboard frame.",
              `Visual treatment: ${VISUAL_MODE_MAP[visualMode]}.`,
              polishStyleDirection ? `Style continuity: ${polishStyleDirection}.` : null,
              `Motion mode: ${MOTION_MODE_MAP[motionMode] || motionMode}.`,
              "Preserve the original composition and subject identity.",
            ]
              .filter(Boolean)
              .join(" "),
            duration: 6,
          },
        ];

  const sequenceSummary =
    frames.length > 0
      ? frames
          .map((frame, index) => {
            const title = formatFrameTitle(frame, index);
            const description = formatFrameDescription(frame);
            return `${title}: ${description}`;
          })
          .join(" Then ")
      : "A single storyboard-driven shot with premium motion and continuity.";

  return {
    masterPrompt: [
      "Create a style-aware video from this storyboard sequence.",
      `Visual mode: ${VISUAL_MODE_MAP[visualMode]}.`,
      `Motion mode: ${MOTION_MODE_MAP[motionMode] || motionMode}.`,
      polishStyleDirection ? `Saved polish style: ${polishStyleDirection}.` : null,
      `Sequence: ${sequenceSummary}`,
      revisionInput ? `Revision focus: ${revisionInput}.` : null,
      "Rules: preserve subject identity, composition, framing, continuity, and shot order. No new objects, no scene rewrites, and no camera teleporting.",
    ]
      .filter(Boolean)
      .join(" "),
    framePrompts,
    totalDuration,
    technicalNotes: [
      "Local prompt builder",
      `Visual mode: ${visualMode}`,
      `Motion mode: ${motionMode}`,
      polishStyle ? `Polish style: ${polishStyle}` : null,
      revisionInput ? "Revision-aware" : null,
    ]
      .filter(Boolean)
      .join(" • "),
  };
}

export async function enhanceStoryboardVideoPrompt(
  basePrompt: StoryboardVideoPromptResult,
  options: {
    frames: StoryboardPromptFrameInput[];
    selectedVisualMode?: VideoVisualMode;
  },
): Promise<StoryboardVideoPromptResult> {
  const { primary, fallback } = getVideoPromptProviders();
  const geminiEnabled =
    primary === "gemini" ||
    fallback === "gemini" ||
    fallback === "google" ||
    primary === "google";

  if (!geminiEnabled || !import.meta.env.VITE_GEMINI_API_KEY) {
    return basePrompt;
  }

  const enhancerFrames = (options.frames || [])
    .filter((frame) => !!frame.imageUrl)
    .map((frame, index) => ({
      title: formatFrameTitle(frame, index),
      imageUrl: frame.imageUrl || "",
      durationMs: frame.durationMs || 2000,
      motionNotes: frame.motionNotes,
      order: frame.order ?? index,
    }));

  if (enhancerFrames.length === 0) {
    return basePrompt;
  }

  try {
    const enhanced = await generateGeminiStoryboardVideoPrompt(
      enhancerFrames,
      options.selectedVisualMode || "Cinematic",
    );

    return {
      masterPrompt: enhanced.masterPrompt?.trim() || basePrompt.masterPrompt,
      framePrompts: enhanced.framePrompts?.length ? enhanced.framePrompts : basePrompt.framePrompts,
      totalDuration: basePrompt.totalDuration,
      technicalNotes: `${basePrompt.technicalNotes} • Gemini enhancement applied`,
    };
  } catch (error) {
    const normalized = normalizeMediaError(error, {
      provider: "gemini",
      fallbackMessage: "Gemini prompt enhancement was unavailable. Using the local prompt instead.",
    });
    console.warn("[Video Prompt] Gemini enhancement unavailable, using local prompt.", normalized);
    return {
      ...basePrompt,
      technicalNotes: `${basePrompt.technicalNotes} • Local fallback active`,
    };
  }
}

export async function startVideoGeneration(options: {
  prompt: string;
  imageInput?: string;
  imageBase64?: string;
  durationSeconds?: number;
}) {
  const prompt = options.prompt?.trim();
  const imageInput = (options.imageInput || options.imageBase64 || "").trim();

  if (!prompt) {
    return { status: "error" as const, error: "Video prompt is required." };
  }

  if (!imageInput) {
    return { status: "error" as const, error: "A frame image is required to start video generation." };
  }

  const { data, error } = await supabase.functions.invoke("generate-video", {
    body: {
      prompt,
      imageInput,
      durationSeconds: normalizeVideoDuration(options.durationSeconds || 6),
    },
  });

  if (error) {
    const normalized = normalizeMediaError(error, { provider: "video" });
    return { status: "error" as const, error: normalized.userMessage };
  }

  if (data?.status === "error") {
    const normalized = normalizeMediaError(data, { provider: String(data.provider || "video") });
    return {
      ...data,
      status: "error" as const,
      error: normalized.userMessage,
      providerError: normalized,
    };
  }

  return data;
}

export async function checkVideoStatus(operationName: string) {
  const { data, error } = await supabase.functions.invoke("check-video-status", {
    body: { operationName },
  });

  if (error) {
    const normalized = normalizeMediaError(error, { provider: "video" });
    return { status: "error" as const, error: normalized.userMessage };
  }

  if (data?.status === "error") {
    const normalized = normalizeMediaError(data, { provider: String(data.provider || "video") });
    return {
      ...data,
      status: "error" as const,
      error: normalized.userMessage,
      providerError: normalized,
    };
  }

  return data;
}

export async function generateVideoFromFrame(
  prompt: string,
  imageInput: string,
  durationSeconds: number = 6,
  onProgress?: (progress: number, status: string) => void,
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  if (!imageInput?.trim()) {
    return {
      status: "error",
      error: "Add or polish a frame image before starting video generation.",
    };
  }

  onProgress?.(5, "Starting video generation...");

  const startResult = await startVideoGeneration({
    prompt,
    imageInput,
    durationSeconds,
  });

  if (startResult?.status === "error") {
    return { status: "error", error: startResult.error };
  }

  if (!startResult?.operationName) {
    return { status: "error", error: "No operation name returned" };
  }

  onProgress?.(10, "Video generation started...");

  for (let attempt = 0; attempt < 72; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusResult = await checkVideoStatus(startResult.operationName);

    if (statusResult?.status === "done") {
      onProgress?.(100, "Video ready!");
      return { status: "done", videoUrl: statusResult.videoUrl };
    }

    if (statusResult?.status === "error") {
      const normalized = normalizeMediaError(statusResult, {
        provider: String(statusResult.provider || "video"),
      });

      if (attempt < 2 && shouldRetryMediaError(normalized)) {
        await waitForRetry(attempt, 350, 1500);
        continue;
      }

      return { status: "error", error: normalized.userMessage };
    }

    const progress =
      typeof statusResult?.progress === "number"
        ? statusResult.progress
        : Math.min(95, 12 + attempt);
    onProgress?.(progress, "Generating video...");
  }

  return { status: "error", error: "Video generation timed out." };
}

export async function generateVideoWithPolling(
  options: { prompt: string; imageInput?: string; imageBase64?: string; durationSeconds?: number },
  onProgress?: (progress: number, status: string) => void,
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  return generateVideoFromFrame(
    options.prompt,
    options.imageInput || options.imageBase64 || "",
    options.durationSeconds || 6,
    onProgress,
  );
}
