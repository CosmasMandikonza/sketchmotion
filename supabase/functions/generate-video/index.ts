import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  ReplicateApiError,
  createOfficialPrediction,
  normalizeDataImageInput,
  splitModelSlug,
} from "../_shared/replicate.ts";
import {
  encodeOperationName,
  getProviderOrder,
  normalizeProviderError,
  type MediaProvider,
  waitForRetry,
} from "../_shared/provider-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIDEO_MODEL =
  Deno.env.get("REPLICATE_VIDEO_MODEL") || "bytedance/seedance-2.0-fast";
const GOOGLE_VIDEO_MODEL = Deno.env.get("GOOGLE_VIDEO_MODEL") || "google-video";
const VIDEO_PROVIDER_PRIMARY = Deno.env.get("VIDEO_PROVIDER_PRIMARY") || "replicate";
const VIDEO_PROVIDER_FALLBACK = Deno.env.get("VIDEO_PROVIDER_FALLBACK") || "google";
const { owner: VIDEO_OWNER, name: VIDEO_NAME } = splitModelSlug(VIDEO_MODEL);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeVideoDuration(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 6;
  return Math.max(5, Math.min(10, Math.round(n)));
}

function parseAspectRatio(value: unknown) {
  const allowed = new Set(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"]);
  const ratio = String(value || "16:9");
  return allowed.has(ratio) ? ratio : "16:9";
}

async function createVideoPrediction(input: Record<string, unknown>) {
  const candidates: Array<Record<string, unknown>> = [
    input,
    { ...input, duration_seconds: input.duration, duration: undefined },
    { ...input, first_frame_image: input.image, image: undefined },
    { ...input, image_input: input.image, image: undefined },
    Object.fromEntries(Object.entries(input).filter(([key]) => key !== "resolution")),
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    const cleaned = Object.fromEntries(
      Object.entries(candidate).filter(([, value]) => value !== undefined),
    );

    try {
      return await createOfficialPrediction(VIDEO_OWNER, VIDEO_NAME, cleaned, {
        waitSeconds: 2,
        cancelAfter: "10m",
      });
    } catch (error) {
      lastError = error;
      if (error instanceof ReplicateApiError && error.status === 422) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All video prediction variants failed");
}

async function startReplicateVideoGeneration(input: Record<string, unknown>) {
  const prediction = await createVideoPrediction(input);

  return {
    provider: "replicate" as const,
    model: VIDEO_MODEL,
    upstreamId: prediction.id,
    status: prediction.status === "succeeded" ? "done" : "processing",
  };
}

async function startGoogleVideoGeneration(_input: Record<string, unknown>) {
  throw new Error("Google video generation is not configured for this deployment.");
}

async function startVideoGenerationWithProvider(
  provider: MediaProvider,
  input: Record<string, unknown>,
) {
  if (provider === "replicate") {
    return startReplicateVideoGeneration(input);
  }

  return startGoogleVideoGeneration(input);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ status: "error", error: "Method not allowed" }, 405);
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ status: "error", error: "Invalid JSON" }, 400);
    }

    const prompt = String(body.prompt || "").trim();
    const rawImageInput = String(body.imageInput || body.imageBase64 || "").trim();
    const duration = normalizeVideoDuration(body.durationSeconds);
    const aspectRatio = parseAspectRatio(body.aspectRatio);

    if (!prompt) {
      return json({ status: "error", error: "Missing prompt" }, 400);
    }

    const imageInput = rawImageInput ? normalizeDataImageInput(rawImageInput) : undefined;

    const baseInput: Record<string, unknown> = {
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      resolution: "720p",
    };

    if (imageInput) {
      baseInput.image = imageInput;
    }

    const providers = getProviderOrder(VIDEO_PROVIDER_PRIMARY, VIDEO_PROVIDER_FALLBACK);
    let lastError: ReturnType<typeof normalizeProviderError> | null = null;

    for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
      const provider = providers[providerIndex];
      const maxAttempts = providerIndex === 0 ? 3 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const started = await startVideoGenerationWithProvider(provider, baseInput);

          return json({
            status: started.status,
            operationName: encodeOperationName(started.provider, started.upstreamId),
            provider: started.provider,
            model: started.model,
            prompt,
          });
        } catch (error) {
          const normalized = normalizeProviderError(provider, error);
          lastError = normalized;
          console.error(`[generate-video] ${provider} attempt ${attempt + 1} failed`, normalized);

          if (attempt < maxAttempts - 1 && normalized.retryable) {
            await waitForRetry(attempt, 350, 1400);
            continue;
          }

          break;
        }
      }
    }

    return json(
      {
        status: "error",
        error: lastError?.userMessage || "Video generation could not be started.",
        category: lastError?.category || "unknown",
        provider: lastError?.provider || providers[0],
        model:
          lastError?.provider === "google"
            ? GOOGLE_VIDEO_MODEL
            : VIDEO_MODEL,
        details: {
          message: lastError?.message,
          code: lastError?.code,
        },
      },
      lastError?.statusCode || 500,
    );
  } catch (error) {
    console.error("generate-video error:", error);

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

    const normalized = normalizeProviderError("replicate", error);
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
        model: VIDEO_MODEL,
      },
      normalized.statusCode,
    );
  }
});
