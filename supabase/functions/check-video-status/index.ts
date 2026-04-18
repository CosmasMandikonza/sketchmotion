import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  ReplicateApiError,
  getPrediction,
  normalizePredictionErrorMessage,
  normalizePredictionOutputUrl,
} from "../_shared/replicate.ts";
import {
  normalizeProviderError,
  parseOperationName,
  type MediaProvider,
} from "../_shared/provider-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIDEO_MODEL =
  Deno.env.get("REPLICATE_VIDEO_MODEL") || "bytedance/seedance-2.0-fast";
const GOOGLE_VIDEO_MODEL = Deno.env.get("GOOGLE_VIDEO_MODEL") || "google-video";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pollReplicateVideoGeneration(upstreamId: string) {
  const prediction = await getPrediction(upstreamId);

  if (prediction.status === "succeeded") {
    const videoUrl = normalizePredictionOutputUrl(prediction.output);
    if (!videoUrl) {
      throw new Error("Prediction succeeded but no video URL was returned");
    }

    return {
      status: "done" as const,
      videoUrl,
      provider: "replicate" as const,
      model: VIDEO_MODEL,
    };
  }

  if (["failed", "canceled", "aborted"].includes(prediction.status)) {
    throw new Error(normalizePredictionErrorMessage(prediction));
  }

  const progress =
    prediction.status === "starting" ? 20 : prediction.status === "processing" ? 60 : 40;

  return {
    status: "processing" as const,
    progress,
    provider: "replicate" as const,
    model: VIDEO_MODEL,
  };
}

async function pollGoogleVideoGeneration(_upstreamId: string) {
  throw new Error("Google video generation is not configured for this deployment.");
}

async function pollVideoGenerationWithProvider(provider: MediaProvider, upstreamId: string) {
  if (provider === "replicate") {
    return pollReplicateVideoGeneration(upstreamId);
  }

  return pollGoogleVideoGeneration(upstreamId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ status: "error", error: "Method not allowed" }, 405);
  }

  let activeProvider: MediaProvider = "replicate";

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ status: "error", error: "Invalid JSON" }, 400);
    }

    const operationName = String(body.operationName || "").trim();
    if (!operationName) {
      return json({ status: "error", error: "operationName required" }, 400);
    }

    const { provider, upstreamId } = parseOperationName(operationName);
    activeProvider = provider;
    const result = await pollVideoGenerationWithProvider(provider, upstreamId);
    return json(result);
  } catch (error) {
    console.error("check-video-status error:", error);

    if (error instanceof ReplicateApiError) {
      const normalized = normalizeProviderError("replicate", error);
      return json(
        {
          status: "error",
          error: normalized.userMessage,
          category: normalized.category,
          details: {
            message: normalized.message,
            code: normalized.code,
            raw: error.details,
          },
          provider: normalized.provider,
          model: VIDEO_MODEL,
        },
        normalized.statusCode,
      );
    }

    const normalized = normalizeProviderError(activeProvider, error);
    return json(
      {
        status: "error",
        error: normalized.userMessage,
        category: normalized.category,
        details: {
          message: normalized.message,
          code: normalized.code,
        },
        provider: normalized.provider,
        model: activeProvider === "google" ? GOOGLE_VIDEO_MODEL : VIDEO_MODEL,
      },
      normalized.statusCode,
    );
  }
});
