export type MediaErrorCategory =
  | "permission"
  | "quota"
  | "retryable"
  | "validation"
  | "unknown";

export interface NormalizedMediaError {
  category: MediaErrorCategory;
  retryable: boolean;
  provider?: string;
  code?: string;
  statusCode?: number;
  message: string;
  userMessage: string;
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
    return "Unknown media error";
  }

  const candidates = [
    record.error,
    record.message,
    record.msg,
    asRecord(record.details)?.error,
    asRecord(record.details)?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "Unknown media error";
}

function extractStatusCode(value: unknown): number | undefined {
  const record = asRecord(value);
  const candidate =
    record?.statusCode ??
    record?.status ??
    asRecord(record?.context)?.statusCode ??
    asRecord(record?.details)?.status;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function extractCode(value: unknown): string | undefined {
  const record = asRecord(value);
  const candidate =
    record?.code ??
    asRecord(record?.details)?.code ??
    asRecord(record?.context)?.code;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function extractDetails(value: unknown): unknown {
  const record = asRecord(value);
  return record?.details ?? record?.context ?? undefined;
}

function classifyMediaError(message: string, statusCode?: number, code?: string): MediaErrorCategory {
  const lower = `${message} ${code || ""}`.toLowerCase();

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("permission") ||
    lower.includes("api key") ||
    lower.includes("not configured") ||
    lower.includes("credential") ||
    lower.includes("auth")
  ) {
    return "permission";
  }

  if (
    statusCode === 402 ||
    statusCode === 429 ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("insufficient balance") ||
    lower.includes("billing") ||
    lower.includes("resource package")
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
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("connection reset")
  ) {
    return "retryable";
  }

  return "unknown";
}

function buildUserMessage(category: MediaErrorCategory, provider?: string): string {
  const providerLabel = provider ? provider[0].toUpperCase() + provider.slice(1) : "The AI provider";

  switch (category) {
    case "permission":
      return `${providerLabel} is not authorized or configured right now.`;
    case "quota":
      return `${providerLabel} is unavailable because its quota or billing limit was reached.`;
    case "retryable":
      return `${providerLabel} is temporarily unavailable. Please try again.`;
    case "validation":
      return "The request is missing required media details or uses an unsupported input.";
    default:
      return "The media request could not be completed right now.";
  }
}

export function normalizeMediaError(
  error: unknown,
  options: { provider?: string; fallbackMessage?: string } = {},
): NormalizedMediaError {
  const message = extractMessage(error);
  const statusCode = extractStatusCode(error);
  const code = extractCode(error);
  const category = classifyMediaError(message, statusCode, code);

  return {
    category,
    retryable: category === "retryable",
    provider: options.provider,
    code,
    statusCode,
    message,
    userMessage: options.fallbackMessage || buildUserMessage(category, options.provider),
    details: extractDetails(error),
  };
}

export function shouldRetryMediaError(error: NormalizedMediaError) {
  return error.retryable;
}

export function getRetryDelayMs(attempt: number, baseMs = 400, maxMs = 2200) {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 180);
  return exponential + jitter;
}

export function waitForRetry(attempt: number, baseMs?: number, maxMs?: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, getRetryDelayMs(attempt, baseMs, maxMs));
  });
}
