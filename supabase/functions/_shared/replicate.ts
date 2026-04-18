export class ReplicateApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ReplicateApiError";
    this.status = status;
    this.details = details;
  }
}

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export function getReplicateToken(): string {
  const token = Deno.env.get("REPLICATE_API_TOKEN");
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }
  return token;
}

export function splitModelSlug(slug: string): { owner: string; name: string } {
  const [owner, name] = slug.split("/");
  if (!owner || !name) {
    throw new Error(`Invalid model slug: ${slug}`);
  }
  return { owner, name };
}

export async function replicateFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getReplicateToken();
  const response = await fetch(`${REPLICATE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "detail" in payload
        ? String((payload as { detail?: unknown }).detail)
        : typeof payload === "string"
          ? payload
          : `Replicate API error (${response.status})`;

    throw new ReplicateApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function createOfficialPrediction(
  owner: string,
  model: string,
  input: Record<string, unknown>,
  options: { waitSeconds?: number; cancelAfter?: string } = {},
) {
  const headers: Record<string, string> = {};

  if (options.waitSeconds && options.waitSeconds >= 1 && options.waitSeconds <= 60) {
    headers.Prefer = `wait=${options.waitSeconds}`;
  }

  if (options.cancelAfter) {
    headers["Cancel-After"] = options.cancelAfter;
  }

  return await replicateFetch<{
    id: string;
    status: string;
    output?: unknown;
    error?: unknown;
    logs?: string;
    metrics?: Record<string, unknown>;
  }>(`/models/${owner}/${model}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ input }),
  });
}

export async function getPrediction(id: string) {
  return await replicateFetch<{
    id: string;
    status: string;
    output?: unknown;
    error?: unknown;
    logs?: string;
    metrics?: Record<string, unknown>;
  }>(`/predictions/${id}`);
}

export function normalizePredictionOutputUrl(output: unknown): string | null {
  if (!output) return null;

  if (typeof output === "string") return output;

  if (Array.isArray(output)) {
    for (const item of output) {
      const found = normalizePredictionOutputUrl(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;

    for (const key of ["url", "href", "uri", "src"]) {
      const value = obj[key];
      if (typeof value === "string" && value.length > 0) return value;
    }

    for (const nestedKey of ["output", "file", "video", "image"]) {
      const nested = obj[nestedKey];
      const found = normalizePredictionOutputUrl(nested);
      if (found) return found;
    }
  }

  return null;
}

export function normalizePredictionErrorMessage(prediction: {
  error?: unknown;
  logs?: string;
  status?: string;
}) {
  if (typeof prediction.error === "string" && prediction.error.trim()) {
    return prediction.error.trim();
  }

  if (prediction.error && typeof prediction.error === "object") {
    const maybeDetail = (prediction.error as Record<string, unknown>).detail;
    if (typeof maybeDetail === "string" && maybeDetail.trim()) {
      return maybeDetail.trim();
    }
  }

  if (typeof prediction.logs === "string" && prediction.logs.trim()) {
    const lines = prediction.logs
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      return lines[lines.length - 1];
    }
  }

  return prediction.status ? `Prediction ${prediction.status}` : "Prediction failed";
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeDataImageInput(input: string): string {
  if (!input) return input;

  if (input.startsWith("data:") || input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  return `data:image/png;base64,${input}`;
}

export function inferMimeTypeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/png";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function fetchRemoteAssetAsDataUrl(
  url: string,
  fallbackMimeType: string,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Replicate output (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") || fallbackMimeType;
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}
