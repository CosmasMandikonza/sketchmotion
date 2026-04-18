import type { AIProvider } from "./types";

const DEFAULT_AI_PROVIDER: AIProvider = "google";

export function normalizeAIProvider(value?: string | null): AIProvider {
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
      return DEFAULT_AI_PROVIDER;
  }
}

export function getConfiguredAIProvider(): AIProvider {
  return normalizeAIProvider(import.meta.env.VITE_AI_PROVIDER);
}
