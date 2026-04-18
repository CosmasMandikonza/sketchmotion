export type MediaProvider = "replicate" | "google";

export type ProviderErrorCategory =
  | "permission"
  | "quota"
  | "retryable"
  | "validation"
  | "unknown";

export interface NormalizedProviderError {
  provider: MediaProvider;
  category: ProviderErrorCategory;
  retryable: boolean;
  message: string;
  userMessage: string;
  statusCode: number;
  code?: string;
  details?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function extractMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value instanceof Error && value.message.trim()) {
    return value.message.trim();
  }

  const record = asRecord(value);
  if (!record) {
    return "Unknown provider error";
  }

  const candidates = [
    record.error,
    record.message,
    record.detail,
    asRecord(record.details)?.error,
    asRecord(record.details)?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "Unknown provider error";
}

function extractStatusCode(value: unknown): number | undefined {
  const record = asRecord(value);
  const numeric = Number(
    record?.statusCode ??
      record?.status ??
      asRecord(record?.details)?.status ??
      asRecord(record?.details)?.statusCode,
  );
  return Number.isFinite(numeric) ? numeric : undefined;
}

function extractCode(value: unknown): string | undefined {
  const record = asRecord(value);
  const code = record?.code ?? asRecord(record?.details)?.code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

function classifyProviderError(
  message: string,
  statusCode?: number,
  code?: string,
): ProviderErrorCategory {
  const lower = `${message} ${code || ""}`.toLowerCase();

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("permission") ||
    lower.includes("api key") ||
    lower.includes("credential") ||
    lower.includes("auth") ||
    lower.includes("not configured")
  ) {
    return "permission";
  }

  if (
    statusCode === 402 ||
    statusCode === 429 ||
    code === "1113" ||
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("insufficient balance") ||
    lower.includes("resource package") ||
    lower.includes("rate limit")
  ) {
    return "quota";
  }

  if (
    statusCode === 400 ||
    statusCode === 404 ||
    statusCode === 409 ||
    statusCode === 422 ||
    lower.includes("missing") ||
    lower.includes("required") ||
    lower.includes("invalid") ||
    lower.includes("malformed") ||
    lower.includes("unsupported")
  ) {
    return "validation";
  }

  if (
    statusCode === 408 ||
    (statusCode !== undefined && statusCode >= 500) ||
    code === "1234" ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("network") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("connection reset")
  ) {
    return "retryable";
  }

  return "unknown";
}

function defaultUserMessage(category: ProviderErrorCategory, provider: MediaProvider) {
  const label = provider === "replicate" ? "Replicate" : "Google";

  switch (category) {
    case "permission":
      return `${label} is not authorized or configured right now.`;
    case "quota":
      return `${label} is unavailable because its quota or billing limit was reached.`;
    case "retryable":
      return `${label} is temporarily unavailable. Please try again.`;
    case "validation":
      return "The request is missing required inputs or uses an unsupported payload.";
    default:
      return "The media provider could not complete the request.";
  }
}

export function normalizeProviderError(
  provider: MediaProvider,
  error: unknown,
  fallbackMessage?: string,
): NormalizedProviderError {
  const message = extractMessage(error);
  const statusCode = extractStatusCode(error) ?? 500;
  const code = extractCode(error);
  const category = classifyProviderError(message, statusCode, code);

  return {
    provider,
    category,
    retryable: category === "retryable",
    message,
    userMessage: fallbackMessage || defaultUserMessage(category, provider),
    statusCode:
      category === "permission"
        ? 403
        : category === "quota"
          ? 429
          : category === "validation"
            ? 400
            : category === "retryable"
              ? 502
              : 500,
    code,
    details: asRecord(error)?.details,
  };
}

export function getRetryDelayMs(attempt: number, baseMs = 400, maxMs = 2200) {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 180);
  return exponential + jitter;
}

export async function waitForRetry(attempt: number, baseMs?: number, maxMs?: number) {
  await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(attempt, baseMs, maxMs)));
}

export function encodeOperationName(provider: MediaProvider, upstreamId: string) {
  return `${provider}:${upstreamId}`;
}

export function parseOperationName(operationName: string): {
  provider: MediaProvider;
  upstreamId: string;
} {
  const trimmed = operationName.trim();
  const separatorIndex = trimmed.indexOf(":");

  if (separatorIndex <= 0) {
    return { provider: "replicate", upstreamId: trimmed };
  }

  const provider = trimmed.slice(0, separatorIndex) as MediaProvider;
  const upstreamId = trimmed.slice(separatorIndex + 1);

  if ((provider === "replicate" || provider === "google") && upstreamId) {
    return { provider, upstreamId };
  }

  return { provider: "replicate", upstreamId: trimmed };
}

export function getProviderOrder(
  primary: string | undefined,
  fallback: string | undefined,
): MediaProvider[] {
  const providers = [primary || "replicate", fallback || "google"]
    .map((value) => value.toLowerCase())
    .filter((value): value is MediaProvider => value === "replicate" || value === "google");

  return [...new Set(providers.length ? providers : ["replicate", "google"])];
}
