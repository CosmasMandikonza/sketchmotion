export type PolishStyle =
  | "illustration"
  | "anime"
  | "realistic"
  | "watercolor"
  | "3d-render"
  | "comic";

export interface PolishStyleOption {
  id: PolishStyle;
  label: string;
  description: string;
  prompt: string;
}

export const POLISH_STYLES: PolishStyleOption[] = [
  {
    id: "illustration",
    label: "Digital Illustration",
    description: "Clean, professional storyboard style",
    prompt: `
Transform this rough sketch into a polished digital illustration.

GOAL:
Create a clean professional storyboard frame suitable for a premium motion design workflow.

KEEP STRICTLY:
- same subject
- same silhouette
- same composition
- same pose/blocking
- same camera framing

STYLE:
- clean linework
- tasteful color palette
- soft cinematic shading
- readable foreground/background separation
- premium editorial illustration finish

DO NOT:
- add new objects
- change anatomy or proportions dramatically
- move subjects
- crop differently
- turn it into abstract art
`.trim(),
  },
  {
    id: "anime",
    label: "Anime",
    description: "Japanese animation style",
    prompt: `
Transform this rough sketch into a polished anime frame.

KEEP STRICTLY:
- same subject
- same composition
- same pose
- same framing

STYLE:
- Japanese animation aesthetic
- crisp inked linework
- cel shading
- expressive but clean shapes
- vibrant but controlled colors
- polished background treatment if implied by sketch

DO NOT:
- redesign the scene
- add random props
- over-detail beyond the sketch intent
- distort the original layout
`.trim(),
  },
  {
    id: "realistic",
    label: "Realistic",
    description: "Photorealistic rendering",
    prompt: `
Transform this rough sketch into a realistic cinematic still.

KEEP STRICTLY:
- same composition
- same subject placement
- same overall structure
- same action/gesture

STYLE:
- realistic lighting
- believable materials
- cinematic depth
- high detail
- premium film still look

DO NOT:
- change the scene concept
- invent extra characters
- alter framing
- make it surreal unless sketch implies it
`.trim(),
  },
  {
    id: "watercolor",
    label: "Watercolor",
    description: "Soft, artistic watercolor painting",
    prompt: `
Transform this rough sketch into a watercolor illustration.

KEEP STRICTLY:
- same subject
- same layout
- same shape language
- same framing

STYLE:
- watercolor wash
- soft pigment bloom
- elegant paper-like texture
- painterly edges
- artistic but readable composition

DO NOT:
- lose the main subject
- over-muddy the image
- change proportions
- add unnecessary detail
`.trim(),
  },
  {
    id: "3d-render",
    label: "3D Render",
    description: "Modern 3D visualization",
    prompt: `
Transform this rough sketch into a polished 3D-rendered frame.

KEEP STRICTLY:
- same composition
- same subject placement
- same camera framing
- same overall scene structure

STYLE:
- premium 3D animated film render
- clean forms
- cinematic lighting
- global illumination feel
- smooth high-quality surfaces
- production-ready 3D concept frame

DO NOT:
- alter scene layout
- introduce new props
- change subject count
- make it look like a different shot
`.trim(),
  },
  {
    id: "comic",
    label: "Comic Book",
    description: "Bold comic book art style",
    prompt: `
Transform this rough sketch into a polished comic-book panel.

KEEP STRICTLY:
- same subject
- same silhouette
- same composition
- same framing
- same gesture/action

STYLE:
- bold inked outlines
- strong graphic shadow shapes
- halftone comic shading
- punchy contrast
- vibrant comic-book coloring
- polished graphic novel panel quality

DO NOT:
- keep it looking like a raw white doodle on dark background
- leave it under-rendered
- change the scene layout
- add unrelated objects
- flatten everything into a near-identical trace

IMPORTANT:
This should feel like a finished comic panel, not just the original sketch with minor enhancement.
`.trim(),
  },
];

export const POLISH_STYLE_VIDEO_MAP: Record<PolishStyle, string> = {
  illustration: "clean professional storyboard illustration, cinematic motion design look",
  anime: "anime-style motion, cel-shaded animation feel, expressive camera movement",
  realistic: "realistic cinematic motion, film-like lighting and depth",
  watercolor: "painterly watercolor motion, soft organic transitions",
  "3d-render": "premium 3D animated film look, polished lighting and depth",
  comic: "graphic novel motion, bold comic shading, dynamic panel energy",
};

const FRAME_POLISH_STYLE_KEY_PREFIX = "sketchmotion_frame_polish_styles";

function getFramePolishStyleStorageKey(boardId: string) {
  return `${FRAME_POLISH_STYLE_KEY_PREFIX}:${boardId}`;
}

function isPolishStyle(value: string): value is PolishStyle {
  return POLISH_STYLES.some((style) => style.id === value);
}

export function getPolishStyleVideoDirection(style?: PolishStyle | null): string | null {
  if (!style) return null;
  return POLISH_STYLE_VIDEO_MAP[style] || null;
}

export function loadFramePolishStyleMap(boardId?: string | null): Record<string, PolishStyle> {
  if (!boardId || typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(getFramePolishStyleStorageKey(boardId));
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, style]) => isPolishStyle(style)),
    ) as Record<string, PolishStyle>;
  } catch {
    return {};
  }
}

function persistFramePolishStyleMap(boardId: string, map: Record<string, PolishStyle>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getFramePolishStyleStorageKey(boardId), JSON.stringify(map));
}

export function saveFramePolishStyle(boardId: string, frameId: string, style: PolishStyle) {
  const next = {
    ...loadFramePolishStyleMap(boardId),
    [frameId]: style,
  };
  persistFramePolishStyleMap(boardId, next);
  return next;
}

export function clearFramePolishStyle(boardId: string, frameId: string) {
  const next = { ...loadFramePolishStyleMap(boardId) };
  delete next[frameId];
  persistFramePolishStyleMap(boardId, next);
  return next;
}
