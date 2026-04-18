import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  ReplicateApiError,
  createOfficialPrediction,
  fetchRemoteAssetAsDataUrl,
  getPrediction,
  normalizeDataImageInput,
  normalizePredictionErrorMessage,
  normalizePredictionOutputUrl,
  sleep,
  splitModelSlug,
} from "../_shared/replicate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POLISH_MODEL =
  Deno.env.get("REPLICATE_POLISH_MODEL") || "black-forest-labs/flux-kontext-pro";
const { owner: POLISH_OWNER, name: POLISH_NAME } = splitModelSlug(POLISH_MODEL);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildPolishPrompt(stylePrompt?: string) {
  const style = stylePrompt?.trim()
    ? `Style direction: ${stylePrompt.trim()}.`
    : "Style direction: polished professional storyboard frame, clean digital illustration, strong readability.";

  return [
    "Edit this storyboard sketch into a polished production-quality frame.",
    style,
    "Keep the exact same composition, subject placement, camera angle, silhouette, and scene layout.",
    "Preserve story intent and readability.",
    "Upgrade line quality, color, shading, and lighting while keeping the frame recognizable.",
    "Do not add extra characters, props, text, or major layout changes.",
    "Return only the edited image.",
  ].join(" ");
}

async function parseBody(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    throw json({ status: "error", error: "Invalid JSON" }, 400);
  }
}

async function createPolishPrediction(imageInput: string, prompt: string) {
  const candidates: Array<Record<string, unknown>> = [
    {
      prompt,
      input_image: imageInput,
      aspect_ratio: "match_input_image",
      output_format: "png",
      safety_tolerance: 2,
    },
    {
      prompt,
      input_image: imageInput,
      output_format: "png",
      safety_tolerance: 2,
    },
    {
      prompt,
      image: imageInput,
      aspect_ratio: "match_input_image",
      output_format: "png",
    },
  ];

  let lastError: unknown = null;

  for (const input of candidates) {
    try {
      return await createOfficialPrediction(POLISH_OWNER, POLISH_NAME, input, {
        waitSeconds: 30,
        cancelAfter: "90s",
      });
    } catch (error) {
      lastError = error;
      if (error instanceof ReplicateApiError && error.status === 422) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All polish prediction variants failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ status: "error", error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseBody(req);
    const rawImageInput = String(body.imageInput || body.imageBase64 || "").trim();
    const stylePrompt = typeof body.stylePrompt === "string" ? body.stylePrompt : "";

    if (!rawImageInput) {
      return json({ status: "error", error: "imageInput is required" }, 400);
    }

    const imageInput = normalizeDataImageInput(rawImageInput);
    const prompt = buildPolishPrompt(stylePrompt);

    let prediction = await createPolishPrediction(imageInput, prompt);
    const terminalStates = new Set(["succeeded", "failed", "canceled"]);

    for (let attempt = 0; !terminalStates.has(prediction.status) && attempt < 24; attempt += 1) {
      await sleep(2500);
      prediction = await getPrediction(prediction.id);
    }

    if (prediction.status !== "succeeded") {
      return json(
        {
          status: "error",
          error: normalizePredictionErrorMessage(prediction),
          provider: "replicate",
          model: POLISH_MODEL,
        },
        502,
      );
    }

    const outputUrl = normalizePredictionOutputUrl(prediction.output);
    if (!outputUrl) {
      return json(
        {
          status: "error",
          error: "Replicate returned no output image URL",
          provider: "replicate",
          model: POLISH_MODEL,
        },
        502,
      );
    }

    const imageBase64 = await fetchRemoteAssetAsDataUrl(outputUrl, "image/png");

    return json({
      status: "success",
      provider: "replicate",
      model: POLISH_MODEL,
      outputUrl,
      imageBase64,
    });
  } catch (error) {
    console.error("polish-sketch error:", error);

    if (error instanceof Response) {
      return error;
    }

    if (error instanceof ReplicateApiError) {
      const status = [400, 401, 402, 403, 404, 409, 422, 429].includes(error.status)
        ? error.status
        : 502;
      return json(
        {
          status: "error",
          error: error.message,
          details: error.details,
          provider: "replicate",
          model: POLISH_MODEL,
        },
        status,
      );
    }

    return json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown polish error",
        provider: "replicate",
        model: POLISH_MODEL,
      },
      500,
    );
  }
});
