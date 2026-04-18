import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createZAIChatCompletion,
  extractJSONMessageContent,
  getZAICodingApiBaseUrl,
  getZAIPlanningModel,
  ZAIApiError,
  type ZAIChatCompletionResponse,
} from "../_shared/zai-client.ts";
import type {
  StoryboardContinuityConstraint,
  StoryboardDirectorControls,
  StoryboardFrameAnalysis,
  StoryboardFrameInput,
  StoryboardPlanningEndpoints,
  StoryboardPlanningModels,
  StoryboardPlanningRequest,
  StoryboardPlanningResult,
  StoryboardRenderStrategy,
  StoryboardScenePlan,
  StoryboardShotPlan,
} from "../_shared/storyboard-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FRAME_INPUTS = 12;
const DEFAULT_PLANNING_MODEL = "glm-5.1";
const DEFAULT_CODING_ENDPOINT = "https://api.z.ai/api/coding/paas/v4";
const MAX_UPSTREAM_RETRIES = 2;

type StoryboardErrorCategory =
  | "transient_upstream"
  | "billing_quota"
  | "auth_config"
  | "validation";

class StoryboardPlanningError extends Error {
  category: StoryboardErrorCategory;
  status: number;
  code?: string;
  requestId?: string;
  upstreamErrorId?: string;
  model: string;
  retryCount: number;
  selectedFrameIds: string[];
  providerMessage?: string;

  constructor(params: {
    message: string;
    category: StoryboardErrorCategory;
    status: number;
    code?: string;
    requestId?: string;
    upstreamErrorId?: string;
    model: string;
    retryCount: number;
    selectedFrameIds: string[];
    providerMessage?: string;
  }) {
    super(params.message);
    this.name = "StoryboardPlanningError";
    this.category = params.category;
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
    this.upstreamErrorId = params.upstreamErrorId;
    this.model = params.model;
    this.retryCount = params.retryCount;
    this.selectedFrameIds = params.selectedFrameIds;
    this.providerMessage = params.providerMessage;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeProvider(value?: string | null): "google" | "zai" {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "zai":
    case "z.ai":
    case "glm":
    case "glm-5":
    case "glm-5.1":
      return "zai";
    case "google":
    case "gemini":
    default:
      return "google";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function formatSelectedFrameIds(
  request: StoryboardPlanningRequest,
  frames: StoryboardFrameInput[],
): string[] {
  const selectedFrameIds = asStringArray(request.selectedFrameIds);
  return selectedFrameIds.length > 0
    ? selectedFrameIds
    : frames.map((frame) => frame.id);
}

function getRetryDelayMs(retryCount: number): number {
  const baseDelay = 450 * 2 ** retryCount;
  const jitter = Math.floor(Math.random() * 220);
  return baseDelay + jitter;
}

function classifyStoryboardError(
  error: unknown,
  model: string,
  selectedFrameIds: string[],
  retryCount: number,
): StoryboardPlanningError {
  if (error instanceof StoryboardPlanningError) {
    return error;
  }

  if (error instanceof ZAIApiError) {
    const providerMessage = error.details.providerMessage;
    const normalizedMessage = providerMessage.toLowerCase();
    const normalizedCode = error.details.code?.toLowerCase();
    const isBillingFailure =
      error.details.status === 429 ||
      normalizedCode === "1113" ||
      normalizedMessage.includes("insufficient balance") ||
      normalizedMessage.includes("no resource package");
    const isAuthOrConfig =
      error.details.status === 401 ||
      error.details.status === 403 ||
      normalizedMessage.includes("unauthorized") ||
      normalizedMessage.includes("forbidden") ||
      normalizedMessage.includes("api key");
    const isTransientUpstream =
      error.details.status >= 500 ||
      normalizedCode === "1234" ||
      normalizedMessage.includes("temporarily unavailable") ||
      normalizedMessage.includes("network") ||
      normalizedMessage.includes("timeout");

    if (isBillingFailure) {
      return new StoryboardPlanningError({
        message:
          "The planning service is unavailable because the upstream Z.AI account has no active balance or resource package.",
        category: "billing_quota",
        status: 429,
        code: error.details.code,
        requestId: error.details.requestId,
        upstreamErrorId: error.details.upstreamErrorId,
        model,
        retryCount,
        selectedFrameIds,
        providerMessage,
      });
    }

    if (isAuthOrConfig) {
      return new StoryboardPlanningError({
        message:
          "The planning service could not authenticate with Z.AI. Verify the deployed credentials and model access.",
        category: "auth_config",
        status: error.details.status >= 500 ? 500 : error.details.status,
        code: error.details.code,
        requestId: error.details.requestId,
        upstreamErrorId: error.details.upstreamErrorId,
        model,
        retryCount,
        selectedFrameIds,
        providerMessage,
      });
    }

    if (isTransientUpstream) {
      return new StoryboardPlanningError({
        message:
          "The planning service is temporarily unavailable while the upstream provider recovers.",
        category: "transient_upstream",
        status: 503,
        code: error.details.code,
        requestId: error.details.requestId,
        upstreamErrorId: error.details.upstreamErrorId,
        model,
        retryCount,
        selectedFrameIds,
        providerMessage,
      });
    }

    return new StoryboardPlanningError({
      message:
        "The planning service rejected the current request. Review the provider response before retrying.",
      category: "validation",
      status: 400,
      code: error.details.code,
      requestId: error.details.requestId,
      upstreamErrorId: error.details.upstreamErrorId,
      model,
      retryCount,
      selectedFrameIds,
      providerMessage,
    });
  }

  const message = error instanceof Error ? error.message : "Storyboard planning failed";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("missing zai_api_key") ||
    normalizedMessage.includes("missing supabase environment variables")
  ) {
    return new StoryboardPlanningError({
      message:
        "The planning service is missing required configuration. Verify the deployed environment variables.",
      category: "auth_config",
      status: 500,
      model,
      retryCount,
      selectedFrameIds,
      providerMessage: message,
    });
  }

  if (
    normalizedMessage.includes("request body must be a json object") ||
    normalizedMessage.includes("request must include a non-empty frames array") ||
    normalizedMessage.includes("must be an object")
  ) {
    return new StoryboardPlanningError({
      message:
        "The storyboard input is incomplete. Add at least one ordered frame with timing or notes and try again.",
      category: "validation",
      status: 400,
      model,
      retryCount,
      selectedFrameIds,
      providerMessage: message,
    });
  }

  return new StoryboardPlanningError({
    message:
      "The planning service hit an unexpected error. Try again shortly and review the latest logs if it persists.",
    category: "transient_upstream",
    status: 503,
    model,
    retryCount,
    selectedFrameIds,
    providerMessage: message,
  });
}

function logStoryboardFailure(
  level: "warn" | "error",
  details: StoryboardPlanningError,
) {
  console[level]("[storyboard-plan]", {
    category: details.category,
    status: details.status,
    code: details.code,
    requestId: details.requestId,
    upstreamErrorId: details.upstreamErrorId,
    selectedFrameIds: details.selectedFrameIds,
    model: details.model,
    retryCount: details.retryCount,
    providerMessage: details.providerMessage,
  });
}

function normalizeDirectorControls(
  raw: unknown,
): StoryboardDirectorControls | null {
  if (!isObject(raw)) {
    return null;
  }

  const avoidList = asStringArray(raw.avoidList ?? raw.noGoList);

  return {
    mood: asString(raw.mood) || null,
    pacing: asString(raw.pacing) || null,
    camera: asString(raw.camera) || null,
    lens: asString(raw.lens) || null,
    lighting: asString(raw.lighting) || null,
    colorGrade: asString(raw.colorGrade) || null,
    motionIntensity:
      raw.motionIntensity == null ? null : asNumber(raw.motionIntensity, 0),
    continuityStrictness:
      raw.continuityStrictness == null
        ? null
        : asNumber(raw.continuityStrictness, 0),
    avoidList,
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildDirectorControlsBlock(
  controls: StoryboardDirectorControls | null | undefined,
): string {
  if (!controls) {
    return "Director controls: none provided.";
  }

  const lines = [
    controls.mood ? `- Mood: ${controls.mood}` : null,
    controls.pacing ? `- Pacing: ${controls.pacing}` : null,
    controls.camera ? `- Camera: ${controls.camera}` : null,
    controls.lens ? `- Lens: ${controls.lens}` : null,
    controls.lighting ? `- Lighting: ${controls.lighting}` : null,
    controls.colorGrade ? `- Color grade: ${controls.colorGrade}` : null,
    typeof controls.motionIntensity === "number"
      ? `- Motion intensity: ${controls.motionIntensity}%`
      : null,
    typeof controls.continuityStrictness === "number"
      ? `- Continuity strictness: ${controls.continuityStrictness}%`
      : null,
    controls.avoidList && controls.avoidList.length > 0
      ? `- Avoid list: ${controls.avoidList.join(", ")}`
      : null,
  ].filter(Boolean);

  if (lines.length === 0) {
    return "Director controls: none provided.";
  }

  return `Director controls:\n${(lines as string[]).join("\n")}`;
}

function formatReportedModelName(model: string): string {
  const normalized = model.trim().toLowerCase();

  switch (normalized) {
    case "glm-5v-turbo":
      return "GLM-5V-Turbo";
    default:
      return model.trim();
  }
}

function parseRequest(raw: unknown): StoryboardPlanningRequest {
  if (!isObject(raw)) {
    throw new Error("Request body must be a JSON object");
  }

  if (!Array.isArray(raw.frames) || raw.frames.length === 0) {
    throw new Error("Request must include a non-empty frames array");
  }

  const frames: StoryboardFrameInput[] = raw.frames.map((frame, index) => {
    if (!isObject(frame)) {
      throw new Error(`Frame ${index + 1} must be an object`);
    }

    const id = asString(frame.id, `frame-${index + 1}`);
    const order = asNumber(frame.order, index);

    return {
      id,
      order,
      title: asString(frame.title) || null,
      imageUrl: asString(frame.imageUrl) || null,
      durationMs: frame.durationMs == null ? null : asNumber(frame.durationMs, 0),
      motionNotes: asString(frame.motionNotes) || null,
      description: asString(frame.description) || null,
      dialogue: asString(frame.dialogue) || null,
    };
  });

  let revision: StoryboardPlanningRequest["revision"] = null;
  if (isObject(raw.revision)) {
    const instruction = asString(raw.revision.instruction);
    if (instruction) {
      revision = {
        instruction,
        focus: asStringArray(raw.revision.focus),
      };
    }
  }

  const previousPlan = isObject(raw.previousPlan)
    ? (raw.previousPlan as StoryboardPlanningRequest["previousPlan"])
    : null;
  const directorControls = normalizeDirectorControls(raw.directorControls);

  return {
    boardId: asString(raw.boardId) || undefined,
    projectTitle: asString(raw.projectTitle) || undefined,
    creativeBrief: asString(raw.creativeBrief) || undefined,
    aspectRatio: asString(raw.aspectRatio) || undefined,
    selectedFrameIds: asStringArray(raw.selectedFrameIds),
    directorControls,
    provider: normalizeProvider(
      asString(raw.provider) || Deno.env.get("STORYBOARD_AI_PROVIDER") || "zai",
    ),
    frames,
    revision,
    previousPlan,
  };
}

function buildFrameMetadataBlock(frame: StoryboardFrameInput, index: number): string {
  return `Frame ${index + 1} metadata:
id=${frame.id}
order=${frame.order}
title=${frame.title || `Frame ${index + 1}`}
duration_ms=${frame.durationMs ?? 2000}
motion_notes=${frame.motionNotes || "none"}
description=${frame.description || "none"}
dialogue=${frame.dialogue || "none"}`;
}

function buildSelectionContextBlock(
  request: StoryboardPlanningRequest,
  frames: StoryboardFrameInput[],
): string {
  const frameIds = new Set(frames.map((frame) => frame.id));
  const selectedFrameIds = asStringArray(request.selectedFrameIds).filter((id) =>
    frameIds.has(id)
  );

  if (selectedFrameIds.length === 0) {
    return `Selection context:
- No explicit selection override was provided.
- Plan the full ordered sequence of ${frames.length} frame(s) included in this request.`;
  }

  return `Selection context:
- Selected frame IDs: ${selectedFrameIds.join(", ")}
- Only plan the ordered frame subset included in this request.
- Preserve those frame IDs exactly in analyses, continuity rules, and shot references.`;
}

function normalizeFrameAnalysis(
  raw: unknown,
  frame: StoryboardFrameInput,
  index: number,
): StoryboardFrameAnalysis {
  const analysis = isObject(raw) ? raw : {};

  return {
    frameId: asString(analysis.frameId, frame.id),
    order: asNumber(analysis.order, frame.order ?? index),
    title: asString(analysis.title, frame.title || "") || null,
    summary: asString(
      analysis.summary,
      frame.description || frame.title || `Storyboard frame ${index + 1}`,
    ),
    subjects: asStringArray(analysis.subjects),
    setting: asString(analysis.setting, "Unspecified setting"),
    action: asString(
      analysis.action,
      frame.motionNotes || frame.description || "Unspecified action",
    ),
    cameraIntent: asString(
      analysis.cameraIntent,
      frame.motionNotes || "Unspecified camera intent",
    ),
    composition: asString(
      analysis.composition,
      frame.description || "Unspecified composition",
    ),
    continuitySignals: asStringArray(analysis.continuitySignals),
    ambiguityNotes: asStringArray(analysis.ambiguityNotes),
    sourceImageUsed: asBoolean(analysis.sourceImageUsed, false),
  };
}

function normalizeFrameAnalyses(
  parsed: unknown,
  frames: StoryboardFrameInput[],
  localWarnings: string[],
): {
  frameAnalyses: StoryboardFrameAnalysis[];
  warnings: string[];
} {
  const data = isObject(parsed) ? parsed : {};
  const rawAnalyses = Array.isArray(data.frameAnalyses) ? data.frameAnalyses : [];
  const rawWarnings = asStringArray(data.warnings);

  if (rawAnalyses.length === 0) {
    localWarnings.push(
      "The coding-only planning stage returned no structured frame analyses, so fallback analyses were synthesized from frame metadata.",
    );
  }

  const frameAnalyses = frames.map((frame, index) =>
    normalizeFrameAnalysis(rawAnalyses[index], frame, index)
  );

  return {
    frameAnalyses,
    warnings: uniqueStrings(rawWarnings),
  };
}

function buildPlanningInstruction(
  request: StoryboardPlanningRequest,
  frames: StoryboardFrameInput[],
  localWarnings: string[],
): string {
  const directorControlsBlock = buildDirectorControlsBlock(
    request.directorControls,
  );
  const selectionContextBlock = buildSelectionContextBlock(request, frames);
  const revisionBlock = request.revision
    ? `Revision request:
- Instruction: ${request.revision.instruction}
- Focus areas: ${
        request.revision.focus && request.revision.focus.length > 0
          ? request.revision.focus.join(", ")
          : "global update"
      }`
    : "Revision request: none. Produce the first baseline plan.";

  const previousPlanBlock = request.previousPlan
    ? `Previous plan summary:
- Scenes: ${request.previousPlan.summary.totalScenes}
- Shots: ${request.previousPlan.summary.totalShots}
- Narrative: ${request.previousPlan.summary.narrative}
Keep stable scene and shot IDs where possible for unaffected parts of the plan.`
    : "Previous plan summary: none.";

  const frameList = frames
    .map((frame, index) => {
      const title = frame.title || `Frame ${index + 1}`;
      const durationMs = frame.durationMs ?? 2000;
      const notes = frame.motionNotes || "none";
      const description = frame.description || "none";
      const dialogue = frame.dialogue || "none";

      return [
        `Frame ${index + 1}`,
        `id=${frame.id}`,
        `order=${frame.order}`,
        `title=${title}`,
        `duration_ms=${durationMs}`,
        `motion_notes=${notes}`,
        `description=${description}`,
        `dialogue=${dialogue}`,
      ].join(" | ");
    })
    .join("\n");

  return `You are the storyboard planning and revision reasoning stage for SketchMotion. Return a JSON object only.

This run must operate entirely through the Z.AI coding endpoint using glm-5.1.
Do not rely on image fetching, multimodal analysis, or remote image URLs.
Use only the ordered storyboard metadata, selection context, director controls, revision request, and previous plan context provided below.

Goals:
1. Understand the ordered storyboard narrative across all frames.
2. Produce metadata-first frame analyses that stay grounded in titles, timing, motion notes, and any lightweight descriptions.
3. Group frames into scenes when appropriate.
4. Produce a production-ready shot plan for each scene.
5. Synthesize explicit continuity constraints that future image/video generation must preserve.
6. Recommend a render strategy for downstream generation and revisions.
7. Be revision-ready: the output must make later change requests easy to apply.

Project context:
- Project title: ${request.projectTitle || "Untitled storyboard"}
- Aspect ratio: ${request.aspectRatio || "16:9"}
- Creative brief: ${request.creativeBrief || "Not provided"}
- Board id: ${request.boardId || "Not provided"}

${directorControlsBlock}

${selectionContextBlock}

${revisionBlock}

${previousPlanBlock}

Frame metadata in order:
${frameList}

Local warnings from the request pipeline:
${
    localWarnings.length > 0
      ? localWarnings.map((warning) => `- ${warning}`).join("\n")
      : "- none"
  }

Return JSON with exactly this top-level shape:
{
  "frameAnalyses": [
    {
      "frameId": "frame-id",
      "order": 1,
      "title": "string or null",
      "summary": "string",
      "subjects": ["string"],
      "setting": "string",
      "action": "string",
      "cameraIntent": "string",
      "composition": "string",
      "continuitySignals": ["string"],
      "ambiguityNotes": ["string"],
      "sourceImageUsed": false
    }
  ],
  "summary": {
    "projectTitle": "string or null",
    "narrative": "string",
    "totalScenes": 0,
    "totalShots": 0,
    "estimatedDurationSeconds": 0
  },
  "scenes": [
    {
      "sceneId": "stable-scene-id",
      "order": 1,
      "label": "string",
      "summary": "string",
      "goal": "string",
      "emotionalBeat": "string",
      "sourceFrameIds": ["frame-id"],
      "shots": [
        {
          "shotId": "stable-shot-id",
          "order": 1,
          "label": "string",
          "shotType": "wide | medium | close-up | insert | over-the-shoulder | other",
          "camera": "string",
          "composition": "string",
          "action": "string",
          "sourceFrameIds": ["frame-id"],
          "estimatedDurationSeconds": 0,
          "dialogueOrVO": "string or null",
          "continuityNotes": ["string"],
          "promptDirectives": ["string"]
        }
      ]
    }
  ],
  "continuityConstraints": [
    {
      "id": "constraint-id",
      "category": "character | environment | prop | lighting | camera | timing | style",
      "rule": "string",
      "priority": "high | medium | low",
      "appliesToFrameIds": ["frame-id"]
    }
  ],
  "renderStrategy": {
    "narrativeMode": "single-pass-video | shot-per-shot | hybrid",
    "recommendedAspectRatio": "string",
    "anchorFrameIds": ["frame-id"],
    "consistencyApproach": "string",
    "motionStyle": "string",
    "transitionStrategy": "string",
    "batchingPlan": ["string"],
    "revisionHooks": ["string"]
  },
  "revisionContext": {
    "canRevise": true,
    "suggestedNextInputs": ["string"]
  },
  "warnings": ["string"]
}

Planning rules:
- Return one frameAnalyses item per input frame in the same order.
- Treat frame analyses as metadata-first storyboard reasoning. Do not claim to have seen image details.
- Always set "sourceImageUsed" to false for this planning path.
- Base the plan on the actual ordered frame metadata and the frame analyses you derive from that metadata.
- Treat the director controls as high-priority direction for emotional tone, shot language, motion style, continuity strictness, and negative constraints.
- If multiple consecutive frames belong to one scene, group them.
- Keep scenes and shots concise, but specific enough for downstream rendering.
- Continuity constraints should be explicit and actionable.
- Reflect the avoid list in continuity constraints, prompt directives, and render strategy when relevant.
- Render strategy should state whether to render one full sequence, shot-by-shot, or hybrid, and why.
- Revision hooks should make future partial updates easy.
- If metadata leaves a frame ambiguous, call that out in ambiguityNotes or warnings instead of inventing image-only detail.
- Never wrap the JSON in markdown.`;
}

function normalizeShot(
  raw: unknown,
  shotIndex: number,
  fallbackFrameIds: string[],
): StoryboardShotPlan {
  const shot = isObject(raw) ? raw : {};
  const sourceFrameIds = asStringArray(shot.sourceFrameIds);

  return {
    shotId: asString(shot.shotId, `shot-${shotIndex + 1}`),
    order: asNumber(shot.order, shotIndex + 1),
    label: asString(shot.label, `Shot ${shotIndex + 1}`),
    shotType: asString(shot.shotType, "other"),
    camera: asString(shot.camera, "Unspecified camera movement"),
    composition: asString(shot.composition, "Unspecified composition"),
    action: asString(shot.action, "Unspecified action"),
    sourceFrameIds: sourceFrameIds.length > 0 ? sourceFrameIds : fallbackFrameIds,
    estimatedDurationSeconds: Math.max(asNumber(shot.estimatedDurationSeconds, 2), 0.5),
    dialogueOrVO: asString(shot.dialogueOrVO) || null,
    continuityNotes: asStringArray(shot.continuityNotes),
    promptDirectives: asStringArray(shot.promptDirectives),
  };
}

function normalizeScene(raw: unknown, sceneIndex: number): StoryboardScenePlan {
  const scene = isObject(raw) ? raw : {};
  const sourceFrameIds = asStringArray(scene.sourceFrameIds);
  const rawShots = Array.isArray(scene.shots) ? scene.shots : [];

  return {
    sceneId: asString(scene.sceneId, `scene-${sceneIndex + 1}`),
    order: asNumber(scene.order, sceneIndex + 1),
    label: asString(scene.label, `Scene ${sceneIndex + 1}`),
    summary: asString(scene.summary, "No scene summary provided"),
    goal: asString(scene.goal, "No scene goal provided"),
    emotionalBeat: asString(scene.emotionalBeat, "Neutral"),
    sourceFrameIds,
    shots: rawShots.map((shot, shotIndex) =>
      normalizeShot(shot, shotIndex, sourceFrameIds)
    ),
  };
}

function normalizeContinuityConstraint(
  raw: unknown,
  constraintIndex: number,
): StoryboardContinuityConstraint {
  const constraint = isObject(raw) ? raw : {};
  const allowedCategories = new Set([
    "character",
    "environment",
    "prop",
    "lighting",
    "camera",
    "timing",
    "style",
  ]);
  const allowedPriorities = new Set(["high", "medium", "low"]);
  const category = asString(constraint.category, "style");
  const priority = asString(constraint.priority, "medium");

  return {
    id: asString(constraint.id, `constraint-${constraintIndex + 1}`),
    category: (
      allowedCategories.has(category) ? category : "style"
    ) as StoryboardContinuityConstraint["category"],
    rule: asString(constraint.rule, "Maintain visual consistency"),
    priority: (
      allowedPriorities.has(priority) ? priority : "medium"
    ) as StoryboardContinuityConstraint["priority"],
    appliesToFrameIds: asStringArray(constraint.appliesToFrameIds),
  };
}

function normalizeRenderStrategy(raw: unknown): StoryboardRenderStrategy {
  const strategy = isObject(raw) ? raw : {};
  const allowedModes = new Set(["single-pass-video", "shot-per-shot", "hybrid"]);
  const narrativeMode = asString(strategy.narrativeMode, "hybrid");

  return {
    narrativeMode: (
      allowedModes.has(narrativeMode) ? narrativeMode : "hybrid"
    ) as StoryboardRenderStrategy["narrativeMode"],
    recommendedAspectRatio: asString(strategy.recommendedAspectRatio, "16:9"),
    anchorFrameIds: asStringArray(strategy.anchorFrameIds),
    consistencyApproach: asString(
      strategy.consistencyApproach,
      "Use the clearest anchor frames as references and preserve character, lighting, and prop identity across revisions.",
    ),
    motionStyle: asString(
      strategy.motionStyle,
      "Favor smooth, cinematic motion that follows the storyboard pacing.",
    ),
    transitionStrategy: asString(
      strategy.transitionStrategy,
      "Match transitions to scene changes and use continuity-preserving cuts within scenes.",
    ),
    batchingPlan: asStringArray(strategy.batchingPlan),
    revisionHooks: asStringArray(strategy.revisionHooks),
  };
}

function mergeUsage(
  ...usages: Array<ZAIChatCompletionResponse["usage"] | undefined>
): StoryboardPlanningResult["usage"] | undefined {
  const promptTokens = usages.reduce(
    (sum, usage) => sum + (usage?.prompt_tokens || 0),
    0,
  );
  const completionTokens = usages.reduce(
    (sum, usage) => sum + (usage?.completion_tokens || 0),
    0,
  );
  const totalTokens = usages.reduce(
    (sum, usage) => sum + (usage?.total_tokens || 0),
    0,
  );

  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return undefined;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

async function runPlanningStage(
  request: StoryboardPlanningRequest,
  frames: StoryboardFrameInput[],
  localWarnings: string[],
): Promise<{
  parsed: unknown;
  model: string;
  endpoint: string;
  requestId?: string;
  warnings: string[];
  usage?: StoryboardPlanningResult["usage"];
}> {
  const requestedPlanningModel = getZAIPlanningModel() || DEFAULT_PLANNING_MODEL;
  const codingEndpoint = getZAICodingApiBaseUrl() || DEFAULT_CODING_ENDPOINT;
  const selectedFrameIds = formatSelectedFrameIds(request, frames);

  for (let retryCount = 0; retryCount <= MAX_UPSTREAM_RETRIES; retryCount += 1) {
    try {
      const response = await createZAIChatCompletion(
        {
          model: requestedPlanningModel,
          messages: [
            {
              role: "system",
              content:
                "You are a structured storyboard planning and revision reasoning model. Return JSON only, operate on storyboard metadata rather than multimodal image analysis, and preserve revision stability for scene and shot IDs when prior plans are provided.",
            },
            {
              role: "user",
              content: buildPlanningInstruction(request, frames, localWarnings),
            },
          ],
        },
        {
          endpointKind: "coding",
        },
      );

      const parsed = JSON.parse(extractJSONMessageContent(response));
      const data = isObject(parsed) ? parsed : {};

      return {
        parsed,
        model: formatReportedModelName(response.model || requestedPlanningModel),
        endpoint: codingEndpoint,
        requestId: response.request_id,
        warnings: asStringArray(data.warnings),
        usage: mergeUsage(response.usage),
      };
    } catch (error) {
      const failure = classifyStoryboardError(
        error,
        formatReportedModelName(requestedPlanningModel),
        selectedFrameIds,
        retryCount,
      );
      const shouldRetry =
        failure.category === "transient_upstream" &&
        retryCount < MAX_UPSTREAM_RETRIES;

      logStoryboardFailure(shouldRetry ? "warn" : "error", failure);

      if (!shouldRetry) {
        throw failure;
      }

      await wait(getRetryDelayMs(retryCount));
    }
  }

  throw new StoryboardPlanningError({
    message:
      "The planning service exhausted all retry attempts before a valid plan was returned.",
    category: "transient_upstream",
    status: 503,
    model: formatReportedModelName(requestedPlanningModel),
    retryCount: MAX_UPSTREAM_RETRIES,
    selectedFrameIds,
  });
}

function normalizeResult(
  parsed: unknown,
  request: StoryboardPlanningRequest,
  frames: StoryboardFrameInput[],
  frameAnalyses: StoryboardFrameAnalysis[],
  warnings: string[],
  requestId: string | undefined,
  models: StoryboardPlanningModels,
  endpoints: StoryboardPlanningEndpoints,
  usage?: StoryboardPlanningResult["usage"],
): StoryboardPlanningResult {
  const data = isObject(parsed) ? parsed : {};
  let scenes = (Array.isArray(data.scenes) ? data.scenes : []).map(normalizeScene);
  if (scenes.length === 0) {
    scenes = [
      {
        sceneId: "scene-1",
        order: 1,
        label: "Scene 1",
        summary: "Fallback scene generated because the planning model did not return structured scenes.",
        goal: "Preserve the storyboard order for downstream revision and rendering.",
        emotionalBeat: "Unspecified",
        sourceFrameIds: frames.map((frame) => frame.id),
        shots: frameAnalyses.map((analysis, index) => ({
          shotId: `shot-${index + 1}`,
          order: index + 1,
          label: analysis.title || `Shot ${index + 1}`,
          shotType: "other",
          camera: analysis.cameraIntent,
          composition: analysis.composition,
          action: analysis.action,
          sourceFrameIds: [analysis.frameId],
          estimatedDurationSeconds: Math.max(
            (frames[index]?.durationMs || 2000) / 1000,
            0.5,
          ),
          dialogueOrVO: frames[index]?.dialogue || null,
          continuityNotes: analysis.continuitySignals,
          promptDirectives: [],
        })),
      },
    ];
    warnings.push(
      "The planning model returned no structured scenes, so a fallback plan was synthesized from the ordered frame analyses.",
    );
  }

  const totalShots = scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  const estimatedDurationSeconds = scenes.reduce(
    (sum, scene) =>
      sum +
      scene.shots.reduce(
        (sceneSum, shot) => sceneSum + shot.estimatedDurationSeconds,
        0,
      ),
    0,
  );

  const summary = isObject(data.summary) ? data.summary : {};
  const revisionContext = isObject(data.revisionContext) ? data.revisionContext : {};

  return {
    provider: "zai",
    model: models.planning,
    models,
    endpoints,
    generatedAt: new Date().toISOString(),
    requestId,
    frameAnalyses,
    summary: {
      projectTitle: asString(summary.projectTitle, request.projectTitle || "") || null,
      narrative: asString(summary.narrative, "Structured storyboard analysis completed."),
      totalScenes: asNumber(summary.totalScenes, scenes.length),
      totalShots: asNumber(summary.totalShots, totalShots),
      estimatedDurationSeconds: asNumber(
        summary.estimatedDurationSeconds,
        estimatedDurationSeconds,
      ),
    },
    scenes,
    continuityConstraints: (
      Array.isArray(data.continuityConstraints) ? data.continuityConstraints : []
    ).map(normalizeContinuityConstraint),
    renderStrategy: normalizeRenderStrategy(data.renderStrategy),
    revisionContext: {
      canRevise: true,
      suggestedNextInputs:
        asStringArray(revisionContext.suggestedNextInputs).length > 0
          ? asStringArray(revisionContext.suggestedNextInputs)
          : [
              "Ask for a pacing revision if shot durations feel off.",
              "Specify which scene or shot IDs should change next.",
              "Call out any character, lighting, or prop continuity issues to preserve.",
            ],
    },
    warnings: uniqueStrings(warnings),
    usage,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = parseRequest(body);
    const configuredProvider = normalizeProvider(
      request.provider || Deno.env.get("STORYBOARD_AI_PROVIDER") || "zai",
    );

    if (configuredProvider !== "zai") {
      return jsonResponse(
        {
          error:
            "The storyboard planning edge function only implements the Z.AI / GLM path right now. The existing Google path remains in the current client workflow.",
        },
        501,
      );
    }

    const orderedFrames = [...request.frames].sort((a, b) => a.order - b.order);
    const localWarnings: string[] = [];

    if (orderedFrames.length > MAX_FRAME_INPUTS) {
      localWarnings.push(
        `Received ${orderedFrames.length} frames; only the first ${MAX_FRAME_INPUTS} ordered frames were sent through the live planning pipeline.`,
      );
    }

    const framesForModel = orderedFrames.slice(0, MAX_FRAME_INPUTS);
    localWarnings.push(
      "This run stayed on the metadata-first planning architecture through GLM 5.1 on the Z.AI coding endpoint.",
    );

    if (framesForModel.some((frame) => !!frame.imageUrl)) {
      localWarnings.push(
        "Frame image URLs were provided, but this plan intentionally used ordered storyboard metadata only.",
      );
    }

    const planningStage = await runPlanningStage(
      request,
      framesForModel,
      [
        ...localWarnings,
      ],
    );
    const normalizedFrameAnalyses = normalizeFrameAnalyses(
      planningStage.parsed,
      framesForModel,
      localWarnings,
    );

    const models: StoryboardPlanningModels = {
      vision: planningStage.model || DEFAULT_PLANNING_MODEL,
      planning: planningStage.model || DEFAULT_PLANNING_MODEL,
      continuity: planningStage.model || DEFAULT_PLANNING_MODEL,
      renderStrategy: planningStage.model || DEFAULT_PLANNING_MODEL,
      revisionReasoning: planningStage.model || DEFAULT_PLANNING_MODEL,
    };
    const endpoints: StoryboardPlanningEndpoints = {
      vision: planningStage.endpoint || DEFAULT_CODING_ENDPOINT,
      planning: planningStage.endpoint || DEFAULT_CODING_ENDPOINT,
      continuity: planningStage.endpoint || DEFAULT_CODING_ENDPOINT,
      renderStrategy: planningStage.endpoint || DEFAULT_CODING_ENDPOINT,
      revisionReasoning: planningStage.endpoint || DEFAULT_CODING_ENDPOINT,
    };

    const result = normalizeResult(
      planningStage.parsed,
      request,
      framesForModel,
      normalizedFrameAnalyses.frameAnalyses,
      [
        ...localWarnings,
        ...normalizedFrameAnalyses.warnings,
        ...planningStage.warnings,
      ],
      planningStage.requestId,
      models,
      endpoints,
      planningStage.usage,
    );

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof StoryboardPlanningError) {
      return jsonResponse(
        {
          error: error.message,
          category: error.category,
          status: error.status,
          code: error.code,
          requestId: error.requestId,
          upstreamErrorId: error.upstreamErrorId,
          selectedFrameIds: error.selectedFrameIds,
          model: error.model,
          retryCount: error.retryCount,
          providerMessage: error.providerMessage,
        },
        error.status,
      );
    }

    console.error("[storyboard-plan] Error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Storyboard planning failed",
        category: "transient_upstream",
        status: 500,
        model: formatReportedModelName(
          getZAIPlanningModel() || DEFAULT_PLANNING_MODEL,
        ),
        retryCount: 0,
        selectedFrameIds: [],
      },
      500,
    );
  }
});
