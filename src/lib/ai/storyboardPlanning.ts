import { getConfiguredAIProvider } from "./provider";
import { googleLegacyStoryboardProvider } from "./providers/googleLegacy";
import { zaiStoryboardProvider } from "./providers/zai";
import type {
  AIProvider,
  StoryboardPlanningProvider,
  StoryboardPlanningRequest,
  StoryboardPlanningResult,
} from "./types";

function getStoryboardPlanningProvider(
  provider: AIProvider,
): StoryboardPlanningProvider {
  switch (provider) {
    case "zai":
      return zaiStoryboardProvider;
    case "google":
    default:
      return googleLegacyStoryboardProvider;
  }
}

export async function analyzeStoryboardWithProvider(
  request: StoryboardPlanningRequest,
): Promise<StoryboardPlanningResult> {
  const provider = request.provider ?? getConfiguredAIProvider();
  const adapter = getStoryboardPlanningProvider(provider);

  return adapter.analyzeStoryboard({
    ...request,
    provider,
  });
}
