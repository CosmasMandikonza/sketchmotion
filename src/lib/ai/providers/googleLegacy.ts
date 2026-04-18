import type {
  StoryboardPlanningProvider,
  StoryboardPlanningRequest,
} from "../types";

export const googleLegacyStoryboardProvider: StoryboardPlanningProvider = {
  id: "google",
  async analyzeStoryboard(_request: StoryboardPlanningRequest) {
    throw new Error(
      "Structured storyboard planning is only implemented for the Z.AI edge-function path right now. The existing Google/Gemini UI flow remains unchanged.",
    );
  },
};
