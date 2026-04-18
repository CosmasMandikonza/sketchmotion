export type StoryboardProvider = "google" | "zai";

export interface StoryboardFrameInput {
  id: string;
  order: number;
  title?: string | null;
  imageUrl?: string | null;
  durationMs?: number | null;
  motionNotes?: string | null;
  description?: string | null;
  dialogue?: string | null;
}

export interface StoryboardRevisionRequest {
  instruction: string;
  focus?: string[];
}

export interface StoryboardDirectorControls {
  mood?: string | null;
  pacing?: string | null;
  camera?: string | null;
  lens?: string | null;
  lighting?: string | null;
  colorGrade?: string | null;
  motionIntensity?: number | null;
  continuityStrictness?: number | null;
  avoidList?: string[];
}

export interface StoryboardFrameAnalysis {
  frameId: string;
  order: number;
  title?: string | null;
  summary: string;
  subjects: string[];
  setting: string;
  action: string;
  cameraIntent: string;
  composition: string;
  continuitySignals: string[];
  ambiguityNotes: string[];
  sourceImageUsed: boolean;
}

export interface StoryboardShotPlan {
  shotId: string;
  order: number;
  label: string;
  shotType: string;
  camera: string;
  composition: string;
  action: string;
  sourceFrameIds: string[];
  estimatedDurationSeconds: number;
  dialogueOrVO?: string | null;
  continuityNotes: string[];
  promptDirectives: string[];
}

export interface StoryboardScenePlan {
  sceneId: string;
  order: number;
  label: string;
  summary: string;
  goal: string;
  emotionalBeat: string;
  sourceFrameIds: string[];
  shots: StoryboardShotPlan[];
}

export interface StoryboardContinuityConstraint {
  id: string;
  category: "character" | "environment" | "prop" | "lighting" | "camera" | "timing" | "style";
  rule: string;
  priority: "high" | "medium" | "low";
  appliesToFrameIds: string[];
}

export interface StoryboardRenderStrategy {
  narrativeMode: "single-pass-video" | "shot-per-shot" | "hybrid";
  recommendedAspectRatio: string;
  anchorFrameIds: string[];
  consistencyApproach: string;
  motionStyle: string;
  transitionStrategy: string;
  batchingPlan: string[];
  revisionHooks: string[];
}

export interface StoryboardPlanningSummary {
  projectTitle?: string | null;
  narrative: string;
  totalScenes: number;
  totalShots: number;
  estimatedDurationSeconds: number;
}

export interface StoryboardRevisionContext {
  canRevise: true;
  suggestedNextInputs: string[];
}

export interface StoryboardPlanningUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface StoryboardPlanningModels {
  vision: string;
  planning: string;
  continuity: string;
  renderStrategy: string;
  revisionReasoning: string;
}

export interface StoryboardPlanningEndpoints {
  vision: string;
  planning: string;
  continuity: string;
  renderStrategy: string;
  revisionReasoning: string;
}

export interface StoryboardPlanningResult {
  provider: StoryboardProvider;
  model: string;
  models: StoryboardPlanningModels;
  endpoints: StoryboardPlanningEndpoints;
  generatedAt: string;
  requestId?: string;
  frameAnalyses: StoryboardFrameAnalysis[];
  summary: StoryboardPlanningSummary;
  scenes: StoryboardScenePlan[];
  continuityConstraints: StoryboardContinuityConstraint[];
  renderStrategy: StoryboardRenderStrategy;
  revisionContext: StoryboardRevisionContext;
  warnings: string[];
  usage?: StoryboardPlanningUsage;
}

export interface StoryboardPlanningRequest {
  boardId?: string;
  projectTitle?: string;
  creativeBrief?: string;
  aspectRatio?: string;
  selectedFrameIds?: string[];
  directorControls?: StoryboardDirectorControls | null;
  provider?: StoryboardProvider;
  frames: StoryboardFrameInput[];
  revision?: StoryboardRevisionRequest | null;
  previousPlan?: StoryboardPlanningResult | null;
}
