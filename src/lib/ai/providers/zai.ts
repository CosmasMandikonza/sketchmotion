import { supabase } from "@/lib/supabase";
import type {
  StoryboardFrameAnalysis,
  StoryboardPlanningEndpoints,
  StoryboardPlanningProvider,
  StoryboardPlanningRequest,
  StoryboardPlanningResult,
  StoryboardScenePlan,
  StoryboardShotPlan,
  StoryboardContinuityConstraint,
  StoryboardPlanningModels,
} from "../types";

const STORYBOARD_PLAN_FUNCTION = "storyboard-plan";

export type StoryboardPlanningErrorCategory =
  | "transient_upstream"
  | "billing_quota"
  | "auth_config"
  | "validation"
  | "unknown";

export interface StoryboardPlanningErrorDetails {
  category: StoryboardPlanningErrorCategory;
  status?: number;
  code?: string;
  requestId?: string;
  upstreamErrorId?: string;
  model?: string;
  retryCount?: number;
  selectedFrameIds?: string[];
  providerMessage?: string;
}

export class StoryboardPlanningProviderError extends Error {
  details: StoryboardPlanningErrorDetails;

  constructor(message: string, details: StoryboardPlanningErrorDetails) {
    super(message);
    this.name = "StoryboardPlanningProviderError";
    this.details = details;
  }
}

export function getStoryboardPlanningErrorDetails(
  error: unknown,
): StoryboardPlanningErrorDetails | null {
  if (error instanceof StoryboardPlanningProviderError) {
    return error.details;
  }

  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function extractInvokeErrorDetails(
  error: unknown,
  selectedFrameIds: string[],
): Promise<StoryboardPlanningErrorDetails & { message: string }> {
  if (!error || typeof error !== "object") {
    return {
      message: "The storyboard planning request failed.",
      category: "unknown",
      selectedFrameIds,
    };
  }

  const invokeError = error as {
    message?: string;
    context?: {
      status?: number;
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
      clone?: () => {
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      };
    };
  };

  const baseMessage =
    invokeError.message?.trim() || "The storyboard planning request failed.";
  const responseLike = invokeError.context;

  if (!responseLike || typeof responseLike !== "object") {
    return {
      message: baseMessage,
      category: "transient_upstream",
      selectedFrameIds,
    };
  }

  const readableResponse =
    typeof responseLike.clone === "function" ? responseLike.clone() : responseLike;

  try {
    if (typeof readableResponse.json === "function") {
      const payload = await readableResponse.json();
      if (isObject(payload)) {
        const categoryValue = asString(payload.category);
        return {
          message: asString(payload.error) || baseMessage,
          category:
            categoryValue === "transient_upstream" ||
            categoryValue === "billing_quota" ||
            categoryValue === "auth_config" ||
            categoryValue === "validation"
              ? categoryValue
              : "unknown",
          status: asNumber(payload.status) || invokeError.context?.status,
          code: asString(payload.code),
          requestId: asString(payload.requestId),
          upstreamErrorId: asString(payload.upstreamErrorId),
          model: asString(payload.model),
          retryCount: asNumber(payload.retryCount),
          selectedFrameIds:
            Array.isArray(payload.selectedFrameIds) &&
            payload.selectedFrameIds.every((item) => typeof item === "string")
              ? (payload.selectedFrameIds as string[])
              : selectedFrameIds,
          providerMessage: asString(payload.providerMessage),
        };
      }
    }
  } catch {
    // Fall through to text or base message
  }

  try {
    if (typeof readableResponse.text === "function") {
      const text = (await readableResponse.text()).trim();
      if (text) {
        return {
          message: baseMessage,
          category:
            invokeError.context?.status && invokeError.context.status >= 500
              ? "transient_upstream"
              : "unknown",
          status: invokeError.context?.status,
          selectedFrameIds,
          providerMessage: text,
        };
      }
    }
  } catch {
    // Fall through to base message
  }

  return {
    message: baseMessage,
    category:
      invokeError.context?.status && invokeError.context.status >= 500
        ? "transient_upstream"
        : "unknown",
    status: invokeError.context?.status,
    selectedFrameIds,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isShotPlan(value: unknown): value is StoryboardShotPlan {
  if (!value || typeof value !== "object") return false;

  const shot = value as Record<string, unknown>;
  return (
    typeof shot.shotId === "string" &&
    typeof shot.order === "number" &&
    typeof shot.label === "string" &&
    typeof shot.shotType === "string" &&
    typeof shot.camera === "string" &&
    typeof shot.composition === "string" &&
    typeof shot.action === "string" &&
    Array.isArray(shot.sourceFrameIds) &&
    typeof shot.estimatedDurationSeconds === "number" &&
    isStringArray(shot.continuityNotes) &&
    isStringArray(shot.promptDirectives)
  );
}

function isScenePlan(value: unknown): value is StoryboardScenePlan {
  if (!value || typeof value !== "object") return false;

  const scene = value as Record<string, unknown>;
  return (
    typeof scene.sceneId === "string" &&
    typeof scene.order === "number" &&
    typeof scene.label === "string" &&
    typeof scene.summary === "string" &&
    typeof scene.goal === "string" &&
    typeof scene.emotionalBeat === "string" &&
    Array.isArray(scene.sourceFrameIds) &&
    Array.isArray(scene.shots) &&
    scene.shots.every(isShotPlan)
  );
}

function isContinuityConstraint(
  value: unknown,
): value is StoryboardContinuityConstraint {
  if (!value || typeof value !== "object") return false;

  const constraint = value as Record<string, unknown>;
  return (
    typeof constraint.id === "string" &&
    typeof constraint.category === "string" &&
    typeof constraint.rule === "string" &&
    typeof constraint.priority === "string" &&
    Array.isArray(constraint.appliesToFrameIds)
  );
}

function isFrameAnalysis(value: unknown): value is StoryboardFrameAnalysis {
  if (!value || typeof value !== "object") return false;

  const analysis = value as Record<string, unknown>;
  return (
    typeof analysis.frameId === "string" &&
    typeof analysis.order === "number" &&
    typeof analysis.summary === "string" &&
    isStringArray(analysis.subjects) &&
    typeof analysis.setting === "string" &&
    typeof analysis.action === "string" &&
    typeof analysis.cameraIntent === "string" &&
    typeof analysis.composition === "string" &&
    isStringArray(analysis.continuitySignals) &&
    isStringArray(analysis.ambiguityNotes) &&
    typeof analysis.sourceImageUsed === "boolean"
  );
}

function isPlanningModels(value: unknown): value is StoryboardPlanningModels {
  if (!value || typeof value !== "object") return false;

  const models = value as Record<string, unknown>;
  return (
    typeof models.vision === "string" &&
    typeof models.planning === "string" &&
    typeof models.continuity === "string" &&
    typeof models.renderStrategy === "string" &&
    typeof models.revisionReasoning === "string"
  );
}

function isPlanningEndpoints(
  value: unknown,
): value is StoryboardPlanningEndpoints {
  if (!value || typeof value !== "object") return false;

  const endpoints = value as Record<string, unknown>;
  return (
    typeof endpoints.vision === "string" &&
    typeof endpoints.planning === "string" &&
    typeof endpoints.continuity === "string" &&
    typeof endpoints.renderStrategy === "string" &&
    typeof endpoints.revisionReasoning === "string"
  );
}

function isStoryboardPlanningResult(
  value: unknown,
): value is StoryboardPlanningResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;
  return (
    typeof result.provider === "string" &&
    typeof result.model === "string" &&
    isPlanningModels(result.models) &&
    isPlanningEndpoints(result.endpoints) &&
    typeof result.generatedAt === "string" &&
    Array.isArray(result.frameAnalyses) &&
    result.frameAnalyses.every(isFrameAnalysis) &&
    !!result.summary &&
    typeof result.summary === "object" &&
    Array.isArray(result.scenes) &&
    result.scenes.every(isScenePlan) &&
    Array.isArray(result.continuityConstraints) &&
    result.continuityConstraints.every(isContinuityConstraint) &&
    !!result.renderStrategy &&
    typeof result.renderStrategy === "object" &&
    !!result.revisionContext &&
    typeof result.revisionContext === "object" &&
    Array.isArray(result.warnings)
  );
}

export const zaiStoryboardProvider: StoryboardPlanningProvider = {
  id: "zai",
  async analyzeStoryboard(request: StoryboardPlanningRequest) {
    const { data, error } = await supabase.functions.invoke(
      STORYBOARD_PLAN_FUNCTION,
      {
        body: {
          ...request,
          provider: "zai",
        },
      },
    );

    if (error) {
      const selectedFrameIds =
        request.selectedFrameIds && request.selectedFrameIds.length > 0
          ? request.selectedFrameIds
          : request.frames.map((frame) => frame.id);
      const details = await extractInvokeErrorDetails(error, selectedFrameIds);
      throw new StoryboardPlanningProviderError(details.message, details);
    }

    if (!isStoryboardPlanningResult(data)) {
      throw new StoryboardPlanningProviderError(
        "The planning service returned an incomplete response.",
        {
          category: "transient_upstream",
          selectedFrameIds:
            request.selectedFrameIds && request.selectedFrameIds.length > 0
              ? request.selectedFrameIds
              : request.frames.map((frame) => frame.id),
          providerMessage: "Invalid storyboard planning response from edge function",
        },
      );
    }

    return data;
  },
};
