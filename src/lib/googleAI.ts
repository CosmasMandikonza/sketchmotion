import { GoogleGenAI } from "@google/genai";
import { supabase } from "./supabase";
import { POLISH_STYLES } from "./polishStyles";
import {
  normalizeMediaError,
  shouldRetryMediaError,
  waitForRetry,
} from "./mediaErrors";

// Legacy Google/Gemini client path.
// Verified against current Google model listings in April 2026:
// - Image polish/editing: gemini-2.5-flash-image
// - Text, analysis, and director outputs: gemini-2.5-flash
const GOOGLE_IMAGE_MODEL = "gemini-2.5-flash-image";
const GOOGLE_TEXT_MODEL = "gemini-2.5-flash";
type PolishProvider = "replicate" | "google";
const DEFAULT_POLISH_PROMPT =
  POLISH_STYLES.find((style) => style.id === "illustration")?.prompt ||
  "Transform this rough sketch into a polished digital illustration while keeping the same subject, composition, and framing.";

const getAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY not found");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const ai = getAIClient();

async function generateGeminiContent(
  purpose: string,
  model: string,
  request: {
    contents: unknown;
    config?: unknown;
  },
) {
  if (!ai) {
    throw new Error("Google AI not configured. Add VITE_GEMINI_API_KEY to .env");
  }

  try {
    return await ai.models.generateContent({
      model,
      ...request,
    });
  } catch (error) {
    console.error(`[Google AI] ${purpose} failed (${model})`, error);
    const detail =
      error instanceof Error ? error.message : "Unknown Google AI error";
    throw new Error(`${purpose} failed with ${model}. ${detail}`);
  }
}

function getConfiguredPolishProviders(): PolishProvider[] {
  const primary = (import.meta.env.VITE_POLISH_PROVIDER_PRIMARY || "replicate").toLowerCase();
  const fallback = (import.meta.env.VITE_POLISH_PROVIDER_FALLBACK || "google").toLowerCase();
  const providers = [primary, fallback].filter(
    (value): value is PolishProvider => value === "replicate" || value === "google",
  );
  const ordered = providers.length ? providers : (["replicate", "google"] as PolishProvider[]);

  return Array.from(new Set<PolishProvider>(ordered));
}

async function invokeReplicatePolishFunction(
  imageInput: string,
  stylePrompt?: string,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("polish-sketch", {
    body: {
      imageInput,
      stylePrompt: stylePrompt || "",
    },
  });

  if (error) {
    throw new Error(error.message || "Polish request failed");
  }

  if (!data) {
    throw new Error("Polish request returned no data");
  }

  if (data.status === "error") {
    throw new Error(data.error || "Polish request failed");
  }

  return data.imageBase64 || data.outputUrl || null;
}

function extractImageFromGeminiResponse(response: any): string | null {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return null;
  }

  for (const part of parts) {
    if (part?.inlineData?.mimeType?.startsWith?.("image/") && part.inlineData.data) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }

    if (part?.fileData?.fileUri) {
      return String(part.fileData.fileUri);
    }
  }

  return null;
}

function buildStructuredPolishPrompt(stylePrompt?: string): string {
  const resolvedStylePrompt = stylePrompt?.trim() || DEFAULT_POLISH_PROMPT;

  return `
You are polishing a rough storyboard sketch into a finished image.

STYLE BRIEF:
${resolvedStylePrompt}

GLOBAL RULES:
- preserve the original subject, composition, framing, and overall scene intent
- keep the same shot, camera angle, blocking, and silhouette unless the sketch already implies variation
- improve finish, readability, detail, color, lighting, texture, and style execution
- infer missing visual detail carefully without changing the scene concept
- respect negative space and avoid crowding the frame with extra objects
- if the sketch is sparse or rough, fill in missing detail conservatively and stay close to the original layout
- do not invent a different shot, new characters, unrelated props, or a different background concept
- do not return explanatory text, notes, captions, or markup

Return image only.
  `.trim();
}

/**
 * Convert image URL to base64 data URL
 */
async function imageUrlToBase64(url: string): Promise<string> {
  // If already base64, return as-is
  if (url.startsWith('data:')) {
    return url;
  }
  
  // Fetch image and convert to base64
  const response = await fetch(url);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function invokeGooglePolishFunction(
  imageInput: string,
  stylePrompt: string,
): Promise<string | null> {
  if (!ai) {
    throw new Error("Google image polish is not configured.");
  }

  const base64Image = await imageUrlToBase64(imageInput);
  const response = await generateGeminiContent("Sketch polish", GOOGLE_IMAGE_MODEL, {
    contents: [
      {
        role: "user",
        parts: [
          { text: stylePrompt },
          {
            inlineData: {
              data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
              mimeType: "image/png",
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const imageResult = extractImageFromGeminiResponse(response);
  if (!imageResult) {
    throw new Error("Google image polish returned no image.");
  }

  if (imageResult.startsWith("data:")) {
    return imageResult;
  }

  return imageUrlToBase64(imageResult);
}

async function polishWithProvider(
  provider: PolishProvider,
  imageInput: string,
  stylePrompt: string,
) {
  if (provider === "replicate") {
    return invokeReplicatePolishFunction(imageInput, stylePrompt);
  }

  return invokeGooglePolishFunction(imageInput, stylePrompt);
}

async function runPolishRouter(imageInput: string, stylePrompt?: string): Promise<string | null> {
  if (!imageInput?.trim()) {
    throw new Error("An image is required before starting polish.");
  }

  const structuredPrompt = buildStructuredPolishPrompt(stylePrompt);
  const providers = getConfiguredPolishProviders();
  let lastErrorMessage = "Image polish is temporarily unavailable. Your original sketch is safe.";

  for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
    const provider = providers[providerIndex];
    const maxAttempts = providerIndex === 0 ? 3 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await polishWithProvider(provider, imageInput, structuredPrompt);
      } catch (error) {
        const normalized = normalizeMediaError(error, {
          provider,
          fallbackMessage: "Image polish is temporarily unavailable. Your original sketch is safe.",
        });
        lastErrorMessage = normalized.userMessage;

        console.warn(`[Polish] ${provider} attempt ${attempt + 1} failed`, normalized);

        if (attempt < maxAttempts - 1 && shouldRetryMediaError(normalized)) {
          await waitForRetry(attempt, 350, 1400);
          continue;
        }

        break;
      }
    }
  }

  throw new Error(lastErrorMessage);
}

/**
 * Polish a rough sketch into a professional illustration using Gemini
 * Uses image generation capabilities with responseModalities: ["TEXT", "IMAGE"]
 */
export async function polishSketch(imageInput: string): Promise<string | null> {
  return runPolishRouter(imageInput, DEFAULT_POLISH_PROMPT);
}

/**
 * Polish a sketch with a specific style
 */
export async function polishSketchWithStyle(
  imageInput: string,
  stylePrompt: string
): Promise<string | null> {
  return runPolishRouter(imageInput, stylePrompt);
}

/**
 * Analyze a sketch and describe it for animation purposes
 */
export async function analyzeSketch(imageInput: string): Promise<string> {
  if (!ai) {
    throw new Error("Google AI not configured.");
  }

  // Convert URL to base64 if needed
  const base64Image = await imageUrlToBase64(imageInput);

  const response = await generateGeminiContent("Sketch analysis", GOOGLE_TEXT_MODEL, {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Analyze this storyboard frame briefly. Describe: 1) Main subject/action, 2) Composition, 3) Suggested camera movement for animation. Keep it under 100 words.",
          },
          {
            inlineData: {
              data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
              mimeType: "image/png",
            },
          },
        ],
      },
    ],
  });

  return response.text || "Unable to analyze sketch";
}

/**
 * Generate a video/animation prompt from sketch analysis and user notes
 */
export async function generateMotionPrompt(
  sketchAnalysis: string,
  userMotionNotes: string
): Promise<string> {
  if (!ai) {
    throw new Error("Google AI not configured");
  }

  const response = await generateGeminiContent(
    "Motion prompt generation",
    GOOGLE_TEXT_MODEL,
    {
    contents: `Create a concise video generation prompt from:

Sketch: ${sketchAnalysis}
Motion Notes: ${userMotionNotes}

Output a single prompt for AI video generation. Include camera movement, timing, transitions. Under 100 words, no explanations.`,
    },
  );

  return response.text || userMotionNotes;
}

/**
 * Suggest motion/camera notes for a frame based on its image
 * Returns cinematic camera direction like "Slow zoom in, subtle parallax"
 */
export async function suggestMotionNotes(imageInput: string): Promise<string> {
  if (!ai) {
    throw new Error("Google AI not configured.");
  }

  const base64Image = await imageUrlToBase64(imageInput);

  const response = await generateGeminiContent(
    "Motion note suggestion",
    GOOGLE_TEXT_MODEL,
    {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a cinematographer. Analyze this storyboard frame and suggest camera movement/animation.

Output ONLY a short camera direction (max 10 words). Examples:
- "Slow zoom in on subject, subtle parallax"
- "Pan left revealing scene, gentle float"
- "Static wide shot, foreground blur"
- "Push in dramatic, rack focus"
- "Crane up and over, drift right"

Be specific to what's in the image. Output only the direction, nothing else.`,
          },
          {
            inlineData: {
              data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
              mimeType: "image/png",
            },
          },
        ],
      },
    ],
  });

  return response.text?.trim() || "Slow zoom in, subtle movement";
}

/**
 * Check visual continuity across multiple frames
 * Returns array of issues found
 */
export async function checkContinuity(
  frames: Array<{ id: string; title: string; imageUrl: string }>
): Promise<Array<{ frameId: string; frameTitle: string; issue: string; severity: 'low' | 'medium' | 'high' }>> {
  if (!ai) {
    throw new Error("Google AI not configured.");
  }

  if (frames.length < 2) {
    return [];
  }

  // Convert all images to base64
  const frameParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  
  frameParts.push({
    text: `You are a continuity supervisor for animation. Analyze these ${frames.length} storyboard frames in sequence and identify visual inconsistencies.

Check for:
- Character appearance changes (clothing, hair, features)
- Color palette shifts between frames
- Lighting direction inconsistencies
- Art style variations
- Background/environment changes that shouldn't occur
- Object continuity (items appearing/disappearing)

Frames in order: ${frames.map((f, i) => `Frame ${i + 1}: "${f.title}"`).join(', ')}

Output JSON array only, no markdown. Format:
[{"frameIndex": 1, "issue": "description", "severity": "low|medium|high"}]

If no issues found, output: []`,
  });

  for (const frame of frames) {
    const base64 = await imageUrlToBase64(frame.imageUrl);
    frameParts.push({
      inlineData: {
        data: base64.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      },
    });
  }

  const response = await generateGeminiContent("Continuity check", GOOGLE_TEXT_MODEL, {
    contents: [
      {
        role: "user",
        parts: frameParts,
      },
    ],
  });

  try {
    const text = response.text?.trim() || "[]";
    // Clean up potential markdown code blocks
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    const issues = JSON.parse(jsonStr);
    
    return issues.map((issue: { frameIndex: number; issue: string; severity: string }) => ({
      frameId: frames[issue.frameIndex]?.id || frames[0].id,
      frameTitle: frames[issue.frameIndex]?.title || `Frame ${issue.frameIndex + 1}`,
      issue: issue.issue,
      severity: issue.severity as 'low' | 'medium' | 'high',
    }));
  } catch (e) {
    console.error("Failed to parse continuity response:", e);
    return [];
  }
}

/**
 * Generate a comprehensive video prompt from storyboard frames
 * Analyzes all frames and creates a master prompt for video generation
 */
export async function generateStoryboardVideoPrompt(
  frames: Array<{
    title: string;
    imageUrl: string;
    durationMs: number;
    motionNotes?: string;
    order: number;
  }>,
  style: 'Cinematic' | 'Animated' | 'Realistic' | 'Stylized'
): Promise<{
  masterPrompt: string;
  framePrompts: Array<{ frameTitle: string; prompt: string; duration: number }>;
  totalDuration: number;
  technicalNotes: string;
}> {
  if (!ai) {
    throw new Error("Google AI not configured. Add VITE_GEMINI_API_KEY to .env");
  }

  // Build content with all frame images
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

  const frameDescriptions = frames.map((f, i) =>
    `Frame ${i + 1}: "${f.title}" (${f.durationMs / 1000}s)${f.motionNotes ? ` - Motion: ${f.motionNotes}` : ''}`
  ).join('\n');

  parts.push({
    text: `You are a professional video director. Analyze these ${frames.length} storyboard frames and create a comprehensive video generation prompt.

FRAMES:
${frameDescriptions}

STYLE: ${style}
TOTAL DURATION: ${frames.reduce((acc, f) => acc + f.durationMs, 0) / 1000} seconds

OUTPUT JSON (no markdown, pure JSON):
{
  "masterPrompt": "A single cohesive prompt describing the entire video narrative, visual style, and flow",
  "framePrompts": [
    {"frameTitle": "title", "prompt": "specific scene prompt", "duration": seconds}
  ],
  "technicalNotes": "Camera work, transitions, pacing notes"
}

Be specific about visual elements you see. Include camera movements, lighting, mood, and transitions between scenes.`
  });

  // Add all frame images
  for (const frame of frames) {
    if (frame.imageUrl) {
      const base64 = await imageUrlToBase64(frame.imageUrl);
      parts.push({
        inlineData: {
          data: base64.replace(/^data:image\/\w+;base64,/, ""),
          mimeType: "image/png",
        },
      });
    }
  }

  const response = await generateGeminiContent(
    "Storyboard video prompt generation",
    GOOGLE_TEXT_MODEL,
    {
    contents: [{ role: "user", parts }],
    },
  );

  try {
    const text = response.text?.trim() || "{}";
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(jsonStr);

    return {
      masterPrompt: result.masterPrompt || "Generate a smooth cinematic video sequence",
      framePrompts: result.framePrompts || frames.map(f => ({
        frameTitle: f.title,
        prompt: f.motionNotes || "Smooth transition",
        duration: f.durationMs / 1000,
      })),
      totalDuration: frames.reduce((acc, f) => acc + f.durationMs, 0) / 1000,
      technicalNotes: result.technicalNotes || `${style} style, ${frames.length} scenes`,
    };
  } catch (e) {
    console.error("Failed to parse video prompt response:", e);
    // Return fallback
    return {
      masterPrompt: `Create a ${style.toLowerCase()} video sequence with ${frames.length} scenes. Smooth transitions, consistent visual style.`,
      framePrompts: frames.map(f => ({
        frameTitle: f.title,
        prompt: f.motionNotes || "Smooth pan with gentle movement",
        duration: f.durationMs / 1000,
      })),
      totalDuration: frames.reduce((acc, f) => acc + f.durationMs, 0) / 1000,
      technicalNotes: `${style} style rendering with fluid transitions`,
    };
  }
}

/**
 * Generate video using Veo 3 via Gemini API
 * Supports text prompts and image conditioning from storyboard frames
 */
export async function generateVideoWithVeo(
  prompt: string,
  referenceImages?: string[], // Base64 images from polished frames
  config?: {
    duration?: number; // seconds (5-60)
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;
  }
): Promise<{
  status: 'success' | 'processing' | 'error';
  videoUrl?: string;
  operationId?: string;
  message: string;
}> {
  if (!ai) {
    throw new Error("Google AI not configured. Add VITE_GEMINI_API_KEY to .env");
  }

  try {
    // Build the content parts
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    // Add the video generation prompt
    parts.push({
      text: `Generate a smooth, cinematic video based on this storyboard sequence:

${prompt}

Style: ${config?.style || 'Cinematic, professional quality'}
Duration: ${config?.duration || 10} seconds
Aspect Ratio: ${config?.aspectRatio || '16:9'}

Create fluid transitions between scenes. Maintain visual consistency throughout.`
    });

    // Add reference images from storyboard frames (image conditioning)
    if (referenceImages && referenceImages.length > 0) {
      for (const imageBase64 of referenceImages) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: "image/png",
          },
        });
      }
    }

    // Call Veo 3 via Gemini API
    // Note: The exact model name may vary - check Google AI Studio for current model ID
    const response = await ai.models.generateContent({
      model: "veo-3-fast", // or "veo-3.1-fast" - check AI Studio
      contents: [
        {
          role: "user",
          parts: parts,
        },
      ],
      config: {
        // Video generation config
        responseModalities: ["VIDEO"],
      },
    });

    // Extract video from response
    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        // Check for video data
        if (part.inlineData?.mimeType?.startsWith('video/')) {
          // Return base64 video data URL
          return {
            status: 'success',
            videoUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            message: 'Video generated successfully!',
          };
        }
        // Check for file URI (Google may return a hosted URL)
        if (part.fileData?.fileUri) {
          return {
            status: 'success',
            videoUrl: part.fileData.fileUri,
            message: 'Video generated successfully!',
          };
        }
      }
    }

    // Check for async operation (long video generation)
    if (response.candidates?.[0]?.content?.parts?.[0]?.text?.includes('operation')) {
      return {
        status: 'processing',
        message: 'Video generation started. This may take a few minutes.',
        operationId: response.candidates[0].content.parts[0].text,
      };
    }

    return {
      status: 'error',
      message: 'No video in response. The model may not support video generation yet.',
    };

  } catch (error) {
    console.error("Veo video generation error:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('invalid model')) {
        return {
          status: 'error',
          message: 'Veo model not available. Try veo-3-fast or check Google AI Studio for current model names.',
        };
      }
      if (error.message.includes('quota') || error.message.includes('rate')) {
        return {
          status: 'error',
          message: 'API quota exceeded. Try again later or check billing.',
        };
      }
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Video generation failed',
    };
  }
}

/**
 * Generate video from storyboard with full context
 * Combines prompt generation + Veo video generation
 */
export async function generateStoryboardVideo(
  frames: Array<{
    title: string;
    imageUrl: string;
    durationMs: number;
    motionNotes?: string;
    order: number;
  }>,
  style: 'Cinematic' | 'Animated' | 'Realistic' | 'Stylized'
): Promise<{
  status: 'success' | 'processing' | 'error';
  videoUrl?: string;
  prompt?: string;
  message: string;
}> {
  // Step 1: Generate the video prompt using Gemini
  const promptResult = await generateStoryboardVideoPrompt(frames, style);

  // Step 2: Collect reference images (first frame from each scene)
  const referenceImages: string[] = [];
  for (const frame of frames.slice(0, 4)) { // Limit to 4 reference images
    if (frame.imageUrl) {
      const base64 = await imageUrlToBase64(frame.imageUrl);
      referenceImages.push(base64);
    }
  }

  // Step 3: Generate video with Veo
  const totalDuration = frames.reduce((acc, f) => acc + f.durationMs, 0) / 1000;

  const videoResult = await generateVideoWithVeo(
    promptResult.masterPrompt,
    referenceImages,
    {
      duration: Math.min(Math.max(totalDuration, 5), 60), // Clamp 5-60s
      aspectRatio: '16:9',
      style: style,
    }
  );

  return {
    ...videoResult,
    prompt: promptResult.masterPrompt,
  };
}

// ============================================================================
// AI Creative Director Functions
// ============================================================================

/**
 * Director configuration type matching the UI options
 */
export interface DirectorConfig {
  mood: string | null;
  pacing: 'Slow' | 'Medium' | 'Fast';
  camera: string | null;
  lens: string | null;
  lighting: string | null;
  colorGrade: string | null;
  motionIntensity: number; // 0-100
  continuityStrictness: number; // 0-100
  noGoList: string[];
}

/**
 * Generate a professional Director's Treatment document
 * Analyzes frames with director settings to create a cinematic treatment
 */
export async function generateDirectorsTreatment(
  frames: Array<{
    title: string;
    imageUrl: string;
    durationMs: number;
    motionNotes?: string;
    order: number;
  }>,
  style: 'Cinematic' | 'Animated' | 'Realistic' | 'Stylized',
  directorConfig: DirectorConfig
): Promise<string> {
  if (!ai) {
    throw new Error("Google AI not configured. Add VITE_GEMINI_API_KEY to .env");
  }

  if (frames.length === 0) {
    return "No frames available for treatment generation.";
  }

  // Build content with frame images
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

  const totalDuration = frames.reduce((acc, f) => acc + (f.durationMs || 2000), 0) / 1000;
  const frameDescriptions = frames.map((f, i) =>
    `Frame ${i + 1}: "${f.title}" (${(f.durationMs || 2000) / 1000}s)${f.motionNotes ? ` — Motion: ${f.motionNotes}` : ''}`
  ).join('\n');

  const configSummary = [
    directorConfig.mood ? `Mood: ${directorConfig.mood}` : null,
    `Pacing: ${directorConfig.pacing}`,
    directorConfig.camera ? `Camera: ${directorConfig.camera}` : null,
    directorConfig.lens ? `Lens: ${directorConfig.lens}` : null,
    directorConfig.lighting ? `Lighting: ${directorConfig.lighting}` : null,
    directorConfig.colorGrade ? `Color Grade: ${directorConfig.colorGrade}` : null,
    `Motion Intensity: ${directorConfig.motionIntensity}%`,
    `Continuity Strictness: ${directorConfig.continuityStrictness}%`,
    directorConfig.noGoList.length > 0 ? `Avoid: ${directorConfig.noGoList.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  parts.push({
    text: `You are an award-winning film director creating a Director's Treatment document for a ${totalDuration.toFixed(1)}-second ${style.toLowerCase()} video project.

STORYBOARD FRAMES:
${frameDescriptions}

DIRECTOR'S VISION:
${configSummary}

STYLE: ${style}

Analyze the storyboard frames visually and write a professional Director's Treatment that includes:

1. PROJECT OVERVIEW - A compelling one-paragraph summary of the visual story
2. VISUAL APPROACH - Describe the cinematography philosophy based on the director's settings
3. LIGHTING DIRECTION - How light will be used (informed by the lighting setting)
4. COLOR PHILOSOPHY - The color grading approach and emotional impact
5. NARRATIVE ARC - How each frame contributes to the story progression
6. PACING & RHYTHM - Edit rhythm based on the pacing setting
7. MOTION PHILOSOPHY - Camera movement approach (${directorConfig.motionIntensity}% intensity)
8. CONTINUITY NOTES - Rules for visual consistency (${directorConfig.continuityStrictness}% strictness)
${directorConfig.noGoList.length > 0 ? `9. RESTRICTIONS - Elements to avoid: ${directorConfig.noGoList.join(', ')}` : ''}

Format as a professional treatment document with clear section headers.
End with the signature line: "Make it feel directed, not generated."

Output ONLY the treatment text, no explanations or markdown code blocks.`
  });

  // Add frame images for visual analysis
  for (const frame of frames.slice(0, 6)) { // Limit to 6 frames for API limits
    if (frame.imageUrl) {
      try {
        const base64 = await imageUrlToBase64(frame.imageUrl);
        parts.push({
          inlineData: {
            data: base64.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: "image/png",
          },
        });
      } catch (e) {
        console.warn(`Failed to load frame image for treatment: ${e}`);
      }
    }
  }

  const response = await generateGeminiContent(
    "Director treatment generation",
    GOOGLE_TEXT_MODEL,
    {
    contents: [{ role: "user", parts }],
    },
  );

  return response.text?.trim() || "Failed to generate treatment.";
}

/**
 * Generate a professional Shot List document
 * Creates detailed shot-by-shot breakdown with technical specifications
 */
export async function generateShotList(
  frames: Array<{
    title: string;
    imageUrl: string;
    durationMs: number;
    motionNotes?: string;
    order: number;
  }>,
  style: 'Cinematic' | 'Animated' | 'Realistic' | 'Stylized',
  directorConfig: DirectorConfig
): Promise<string> {
  if (!ai) {
    throw new Error("Google AI not configured. Add VITE_GEMINI_API_KEY to .env");
  }

  if (frames.length === 0) {
    return "No frames available for shot list generation.";
  }

  // Build content with frame images
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

  const totalDuration = frames.reduce((acc, f) => acc + (f.durationMs || 2000), 0) / 1000;
  const frameDescriptions = frames.map((f, i) =>
    `Frame ${i + 1}: "${f.title}" (${(f.durationMs || 2000) / 1000}s)${f.motionNotes ? ` — Motion: ${f.motionNotes}` : ''}`
  ).join('\n');

  const configSummary = [
    directorConfig.camera ? `Camera Style: ${directorConfig.camera}` : 'Camera: Director\'s choice',
    directorConfig.lens ? `Lens: ${directorConfig.lens}` : 'Lens: Varies by shot',
    directorConfig.lighting ? `Lighting: ${directorConfig.lighting}` : 'Lighting: Natural',
    directorConfig.colorGrade ? `Color Grade: ${directorConfig.colorGrade}` : 'Color: Natural',
    `Motion Intensity: ${directorConfig.motionIntensity}%`,
  ].join('\n');

  parts.push({
    text: `You are a professional 1st AD (Assistant Director) creating a detailed Shot List for a ${totalDuration.toFixed(1)}-second ${style.toLowerCase()} video production.

STORYBOARD FRAMES:
${frameDescriptions}

TECHNICAL PARAMETERS:
${configSummary}

Analyze each storyboard frame visually and create a professional shot list with:

HEADER:
- Total Shots: ${frames.length}
- Total Duration: ${totalDuration.toFixed(1)}s
- Camera Style: ${directorConfig.camera || 'Mixed'}
- Visual Grade: ${directorConfig.colorGrade || 'Natural'}

FOR EACH SHOT (analyze the actual image content):
┌─────────────────────────────────────────
│ SHOT XX — "Frame Title"
│ Duration:    Xs
│ Shot Type:   [Wide/Medium/Close-up/etc based on image]
│ Camera:      [Movement based on settings + what suits the image]
│ Lens:        [From settings or appropriate choice]
│ Lighting:    [From settings or inferred from image]
│ Action:      [What's happening in the frame]
│ Motion:      [Camera movement notes]
│ Transition:  [To next shot]
└─────────────────────────────────────────

End with: "Shot list aligned to your storyboard."

Output ONLY the shot list text, formatted with the box characters shown. No markdown code blocks.`
  });

  // Add frame images for visual analysis
  for (const frame of frames.slice(0, 8)) { // Limit to 8 frames
    if (frame.imageUrl) {
      try {
        const base64 = await imageUrlToBase64(frame.imageUrl);
        parts.push({
          inlineData: {
            data: base64.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: "image/png",
          },
        });
      } catch (e) {
        console.warn(`Failed to load frame image for shot list: ${e}`);
      }
    }
  }

  const response = await generateGeminiContent(
    "Shot list generation",
    GOOGLE_TEXT_MODEL,
    {
    contents: [{ role: "user", parts }],
    },
  );

  return response.text?.trim() || "Failed to generate shot list.";
}

/**
 * Rewrite/enhance a master prompt with director's guidance
 * Takes an existing prompt and enhances it with creative direction
 */
export async function rewriteMasterPrompt(
  originalMasterPrompt: string,
  directorConfig: DirectorConfig
): Promise<string> {
  if (!ai) {
    throw new Error("Google AI not configured. Add VITE_GEMINI_API_KEY to .env");
  }

  if (!originalMasterPrompt || originalMasterPrompt.trim().length === 0) {
    return "No original prompt provided to rewrite.";
  }

  // Build director guidance block
  const guidanceLines: string[] = [];

  if (directorConfig.mood) {
    const moodDescriptions: Record<string, string> = {
      'Dreamy': 'ethereal, soft-focus quality with a dreamlike atmosphere',
      'Tense': 'building suspense with tight framing and dramatic timing',
      'Epic': 'sweeping grandeur with heroic scale and emotional weight',
      'Cozy': 'warm, intimate feeling with comfortable visual warmth',
      'Whimsical': 'playful, lighthearted energy with creative visual surprises',
      'Noir': 'dramatic shadows, high contrast, mysterious atmosphere',
      'Energetic': 'dynamic, vibrant movement with kinetic energy',
      'Minimal': 'clean, purposeful restraint with elegant simplicity',
      'Documentary': 'authentic, observational style with natural realism',
    };
    guidanceLines.push(`Mood: ${directorConfig.mood} — ${moodDescriptions[directorConfig.mood] || directorConfig.mood}`);
  }

  const pacingDescriptions: Record<string, string> = {
    'Slow': 'languid, contemplative rhythm allowing moments to breathe',
    'Medium': 'balanced, natural flow with comfortable pacing',
    'Fast': 'energetic quick cuts maintaining momentum',
  };
  guidanceLines.push(`Pacing: ${pacingDescriptions[directorConfig.pacing]}`);

  if (directorConfig.camera) {
    const cameraDescriptions: Record<string, string> = {
      'Static tripod': 'locked-off, stable compositions',
      'Handheld doc': 'intimate, documentary-style organic movement',
      'Smooth dolly': 'graceful lateral tracking movements',
      'Crane/jib': 'sweeping vertical reveals and elevated perspectives',
      'Orbit': 'circular movement around subjects',
      'FPV drift': 'immersive first-person floating perspective',
    };
    guidanceLines.push(`Camera: ${cameraDescriptions[directorConfig.camera] || directorConfig.camera}`);
  }

  if (directorConfig.lens) {
    guidanceLines.push(`Lens: ${directorConfig.lens} perspective and depth of field`);
  }

  if (directorConfig.lighting) {
    guidanceLines.push(`Lighting: ${directorConfig.lighting} aesthetic`);
  }

  if (directorConfig.colorGrade) {
    guidanceLines.push(`Color grade: ${directorConfig.colorGrade} look`);
  }

  const motionLabel = directorConfig.motionIntensity < 33 ? 'subtle' : directorConfig.motionIntensity > 66 ? 'dynamic' : 'moderate';
  guidanceLines.push(`Motion intensity: ${motionLabel} movement (${directorConfig.motionIntensity}%)`);

  const continuityLabel = directorConfig.continuityStrictness < 33 ? 'loose' : directorConfig.continuityStrictness > 66 ? 'strict' : 'balanced';
  guidanceLines.push(`Continuity: ${continuityLabel} — ${
    directorConfig.continuityStrictness > 50
      ? 'maintain consistent character appearance, preserve scene composition, no new objects unless story-implied'
      : 'allow creative interpretation between shots while maintaining overall coherence'
  }`);

  if (directorConfig.noGoList.length > 0) {
    guidanceLines.push(`MUST AVOID: ${directorConfig.noGoList.join(', ')}`);
  }

  const response = await generateGeminiContent(
    "Master prompt rewrite",
    GOOGLE_TEXT_MODEL,
    {
    contents: `You are a master cinematographer and creative director. Rewrite and enhance the following video generation prompt by incorporating the director's guidance seamlessly.

ORIGINAL PROMPT:
${originalMasterPrompt}

DIRECTOR'S GUIDANCE:
${guidanceLines.join('\n')}

INSTRUCTIONS:
1. Preserve the core narrative and visual content from the original prompt
2. Weave the director's guidance naturally into the prompt
3. Make specific visual recommendations based on the mood, camera, and lighting choices
4. If there are items to avoid, ensure the prompt explicitly excludes them
5. Keep the enhanced prompt concise but comprehensive (under 300 words)
6. Write in a clear, directive style suitable for AI video generation

Output ONLY the enhanced prompt text. Do not include explanations, headers, or markdown formatting.`,
    },
  );

  return response.text?.trim() || originalMasterPrompt;
}
