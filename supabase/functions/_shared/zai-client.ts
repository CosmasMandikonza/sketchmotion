interface ZAITextContentPart {
  type: "text";
  text: string;
}

interface ZAIImageContentPart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type ZAIMessageContentPart = ZAITextContentPart | ZAIImageContentPart;
export type ZAIEndpointKind = "general" | "coding";

export interface ZAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ZAIMessageContentPart[];
}

export interface ZAIChatCompletionRequest {
  model: string;
  messages: ZAIChatMessage[];
  response_format?: {
    type: "json_object" | "text";
  };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  thinking?: {
    type: "enabled" | "disabled";
  };
}

export interface ZAIChatCompletionResponse {
  id?: string;
  request_id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ZAIApiErrorDetails {
  status: number;
  code?: string;
  requestId?: string;
  upstreamErrorId?: string;
  model: string;
  endpointKind: ZAIEndpointKind;
  baseUrl: string;
  providerMessage: string;
  payload?: unknown;
}

export class ZAIApiError extends Error {
  details: ZAIApiErrorDetails;

  constructor(message: string, details: ZAIApiErrorDetails) {
    super(message);
    this.name = "ZAIApiError";
    this.details = details;
  }
}

interface ZAIClientConfig {
  apiKey: string;
  generalBaseUrl: string;
  codingBaseUrl: string;
  legacyStoryboardModel?: string;
  legacySharedBaseUrl?: string;
  visionModel: string;
  planningModel: string;
  thinkingType: "enabled" | "disabled";
}

interface ZAIChatCompletionOptions {
  endpointKind?: ZAIEndpointKind;
  baseUrl?: string;
}

const DEFAULT_ZAI_GENERAL_API_BASE_URL = "https://api.z.ai/api/paas/v4";
const DEFAULT_ZAI_CODING_API_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
const DEFAULT_ZAI_VISION_MODEL = "GLM-5V-Turbo";
const DEFAULT_ZAI_PLANNING_MODEL = "glm-5.1";

function readEnv(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function normalizeZAIModelForRequest(model: string): string {
  const trimmed = model.trim();

  switch (trimmed.toLowerCase()) {
    case "glm-5v-turbo":
      return "glm-5v-turbo";
    default:
      return trimmed;
  }
}

function normalizeReportedZAIModel(model: string): string {
  const trimmed = model.trim();

  switch (trimmed.toLowerCase()) {
    case "glm-5v-turbo":
      return "GLM-5V-Turbo";
    default:
      return trimmed;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asCode(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return asString(value);
}

function parseJSONSafely(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getPayloadDetails(payload: unknown): {
  code?: string;
  requestId?: string;
  upstreamErrorId?: string;
  providerMessage?: string;
} {
  if (!isObject(payload)) {
    return {};
  }

  const nestedError = isObject(payload.error) ? payload.error : null;

  return {
    code: asCode(nestedError?.code ?? payload.code),
    requestId:
      asString(payload.request_id) ||
      asString(payload.requestId) ||
      asString(nestedError?.request_id),
    upstreamErrorId:
      asString(payload.error_id) ||
      asString(payload.errorId) ||
      asString(payload.id) ||
      asString(nestedError?.id),
    providerMessage:
      asString(nestedError?.message) ||
      asString(payload.message) ||
      asString(payload.error),
  };
}

export function getZAIConfigFromEnv(): ZAIClientConfig {
  const apiKey = readEnv("ZAI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ZAI_API_KEY");
  }

  const legacyStoryboardModel = readEnv("ZAI_GLM_STORYBOARD_MODEL");
  const legacySharedBaseUrl = readEnv("ZAI_API_BASE_URL");
  const visionModel =
    readEnv("ZAI_GLM_VISION_MODEL") ||
    legacyStoryboardModel ||
    DEFAULT_ZAI_VISION_MODEL;
  const planningModel =
    readEnv("ZAI_GLM_PLANNING_MODEL") ||
    legacyStoryboardModel ||
    DEFAULT_ZAI_PLANNING_MODEL;
  const thinkingType =
    readEnv("ZAI_THINKING_TYPE") === "disabled" ? "disabled" : "enabled";

  return {
    apiKey,
    generalBaseUrl: normalizeBaseUrl(
      readEnv("ZAI_GENERAL_API_BASE_URL") ||
        legacySharedBaseUrl ||
        DEFAULT_ZAI_GENERAL_API_BASE_URL,
    ),
    codingBaseUrl: normalizeBaseUrl(
      readEnv("ZAI_CODING_API_BASE_URL") ||
        legacySharedBaseUrl ||
        DEFAULT_ZAI_CODING_API_BASE_URL,
    ),
    legacyStoryboardModel,
    legacySharedBaseUrl,
    visionModel: normalizeReportedZAIModel(visionModel),
    planningModel: normalizeReportedZAIModel(planningModel),
    thinkingType,
  };
}

export function getZAIBaseUrl(endpointKind: ZAIEndpointKind): string {
  const config = getZAIConfigFromEnv();
  return endpointKind === "coding" ? config.codingBaseUrl : config.generalBaseUrl;
}

export function getZAIGeneralApiBaseUrl(): string {
  return getZAIBaseUrl("general");
}

export function getZAICodingApiBaseUrl(): string {
  return getZAIBaseUrl("coding");
}

export async function createZAIChatCompletion(
  request: ZAIChatCompletionRequest,
  options: ZAIChatCompletionOptions = {},
): Promise<ZAIChatCompletionResponse> {
  const config = getZAIConfigFromEnv();
  const endpointKind = options.endpointKind || "general";
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ||
      (endpointKind === "coding" ? config.codingBaseUrl : config.generalBaseUrl),
  );

  const resolvedModel = normalizeReportedZAIModel(
    request.model || config.planningModel,
  );
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stream: false,
        response_format: { type: "json_object" },
        temperature: 0.3,
        thinking: {
          type: config.thinkingType,
        },
        ...request,
        model: normalizeZAIModelForRequest(request.model || config.planningModel),
      }),
    });
  } catch (error) {
    throw new ZAIApiError("Could not reach Z.AI", {
      status: 503,
      model: resolvedModel,
      endpointKind,
      baseUrl,
      providerMessage:
        error instanceof Error ? error.message : "Network request failed",
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    const payload = parseJSONSafely(errorText);
    const payloadDetails = getPayloadDetails(payload);

    throw new ZAIApiError(
      `Z.AI request failed (${response.status})`,
      {
        status: response.status,
        code: payloadDetails.code,
        requestId:
          payloadDetails.requestId ||
          response.headers.get("x-request-id") ||
          undefined,
        upstreamErrorId: payloadDetails.upstreamErrorId,
        model: resolvedModel,
        endpointKind,
        baseUrl,
        providerMessage: payloadDetails.providerMessage || errorText.trim(),
        payload,
      },
    );
  }

  return await response.json();
}

export function getZAIVisionModel(): string {
  return getZAIConfigFromEnv().visionModel;
}

export function getZAIPlanningModel(): string {
  return getZAIConfigFromEnv().planningModel;
}

export function getDefaultZAIModel(): string {
  return getZAIPlanningModel();
}

export function extractJSONMessageContent(
  response: ZAIChatCompletionResponse,
): string {
  const rawContent = response.choices?.[0]?.message?.content;

  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("Z.AI response did not include assistant JSON content");
  }

  return rawContent
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<\|begin_of_box\|>/g, "")
    .replace(/<\|end_of_box\|>/g, "")
    .trim();
}
