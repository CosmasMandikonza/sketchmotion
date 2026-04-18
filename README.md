# 🎬 SketchMotion

**SketchMotion is a storyboard-to-motion workspace for creative teams — built to turn rough frames into polished visuals, style-aware motion tests, and export-ready handoff in one place.**

🚀 **Live App:** https://sketch-motion-main.vercel.app  
🎥 **Demo Video:** https://www.youtube.com/watch?v=7nRd42cjbdw

---

## ✨ What SketchMotion Is

SketchMotion helps creative teams move from **rough storyboard ideas** to **review-ready visuals and motion** without breaking the workflow across disconnected tools.

Instead of bouncing between:
- whiteboards
- docs
- image generators
- prompt notes
- review threads
- export tools

SketchMotion keeps the **board at the center** of the process.

You can:
- sketch directly in frames
- polish rough visuals with AI
- run storyboard-aware planning
- revise the plan without restarting
- generate style-aware motion
- share boards in read-only mode
- export from a stable finishing surface

---

## 🧩 The Problem

Most creative AI tools are good at generating something once.

They are much worse at supporting the **actual workflow** around that output:
- preserving sequence and framing
- keeping revisions attached to the board
- handling missing inputs cleanly
- surviving provider failures
- supporting review and export like real software

That creates a common failure mode:

> teams end up with visuals, but not a dependable storyboard operating surface.

SketchMotion was built to solve that.

---

## 💡 Why SketchMotion Matters

Storyboards are not just pictures.

They carry:
- direction
- framing
- continuity
- timing
- collaboration context
- review intent

The useful product is not:
> “generate a cool frame”

The useful product is:
- keep the board organized
- preserve intent
- plan the next pass
- revise without resetting
- hand off work cleanly
- stay usable when AI workflows hit edge cases

---

## 🛠️ What SketchMotion Does

SketchMotion gives creative teams one place to:

✅ manage boards  
✅ sketch frames directly on canvas  
✅ polish rough sketches into cleaner visuals  
✅ run storyboard-aware planning  
✅ add revision guidance and rerun planning  
✅ generate style-aware video from board imagery  
✅ share boards publicly in read-only mode  
✅ review outputs through a dedicated export flow  

---

## 🔄 Core Workflow

### 1. 📝 Build the board
Create a board and organize frames on the canvas.

### 2. ✏️ Sketch directly in-frame
Draw rough ideas inside the frame editor.

### 3. 🎨 AI polish
Turn rough sketches into cleaner visuals while preserving the scene and composition.

### 4. 🧠 Plan the next pass
Run the planning workflow to generate:
- storyboard analysis
- shot plan
- continuity guidance
- render strategy

### 5. 🔁 Revise and rerun
Add targeted revision input and update the plan without throwing away prior work.

### 6. 🎥 Generate motion
Create style-aware video in different output formats like landscape or vertical.

### 7. 🌍 Share and export
Open boards in public read-only mode and use export as the finishing surface.

---

## 🌟 Why SketchMotion Is Different

SketchMotion is **not** a generic AI prompt box wrapped in pretty UI.

### 🎞️ Storyboard-first
The board is the source of truth. Frames, sequence, continuity, and revision all stay attached to it.

### 🧭 Planning is visible
The planning workflow produces readable analysis, shot structure, continuity rules, and render strategy inside the product.

### 🔁 Revision is part of the system
You can revise and rerun instead of restarting from zero every time feedback lands.

### 🎬 Motion is tied to board state
Video generation inherits real board context, including frame readiness and style direction.

### 🧱 It behaves like a real workspace
Auth, persistence, sharing, export, guardrails, and failure handling are part of the actual product.

---

## 🖥️ Product Surfaces

- **Dashboard** — board management and saved work
- **Canvas** — arrange, sketch, connect, and edit frames
- **Planning Workflow** — analysis, shot plan, continuity, revision
- **Share Flow** — public read-only board access
- **Export Page** — output review and finishing surface

---

## 🏗️ Architecture

```mermaid
flowchart LR
  User["🎨 Creative Team"] --> App["🖥️ SketchMotion Web App<br/>React + TypeScript + Vite"]

  App --> Auth["🔐 Supabase Auth"]
  App --> DB["🗄️ Supabase Postgres"]
  App --> Storage["📦 Supabase Storage"]
  App --> Realtime["⚡ Supabase Realtime / Presence"]
  App --> Edge["🧩 Supabase Edge Functions"]

  Edge --> Plan["🧠 storyboard-plan"]
  Edge --> Polish["🎨 polish-sketch"]
  Edge --> VideoStart["🎥 generate-video"]
  Edge --> VideoPoll["🔄 check-video-status"]

  Plan --> GLM["🤖 Z.AI coding endpoint<br/>glm-5.1"]
  Polish --> ReplicatePolish["🖼️ Replicate<br/>FLUX Kontext Pro"]
  VideoStart --> ReplicateVideo["🎞️ Replicate<br/>Seedance 2.0 Fast"]
  VideoPoll --> ReplicateVideo

  Here’s a more alive, polished README version with emojis, stronger framing, your **live app link**, your **demo video link**, and a cleaner architecture section.


## ⚙️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Framer Motion
* Radix primitives

### Backend Platform

* Supabase Auth
* Supabase Postgres
* Supabase Storage
* Supabase Realtime / Presence
* Supabase Edge Functions

### AI / Media

* **Planning:** GLM 5.1 through Z.AI coding endpoint
* **Image polish:** Replicate / FLUX Kontext Pro
* **Video generation:** Replicate / Seedance 2.0 Fast
* **Prompt strategy:** deterministic local prompt builder with extensible provider routing

### Testing

* TestSprite-generated Playwright flows
* two-round product hardening approach
* core workflow coverage + edge/failure handling

---

## 🧪 Tested With TestSprite

This submission was strengthened through **real TestSprite-driven iteration**, not just cosmetic testing.

### Round 1

Core user journeys:

* landing page
* auth
* protected dashboard
* board creation/opening
* frame editing
* AI polish
* video entry points
* public board access
* export basics

### Round 2

Edge and failure handling:

* provider failure states
* missing image / missing metadata guards
* export empty state
* invalid board state
* persistence after refresh
* GLM insufficient-input safeguards
* read-only non-mutating behavior

### What testing improved

TestSprite helped harden:

* polish trigger accessibility
* share/copy stability
* provider failure UX
* video readiness guards
* export empty-state handling
* insufficient-input planning guards
* canvas drag / pan / connect behavior

📁 See: `testsprite_tests/`
📝 See also: `testsprite_tests/BUG_FIX_LOG.md`
📘 And: `testsprite_tests/TESTING_STRATEGY.md`

---

## 🚀 Live Demo

### 🌐 Production

[https://sketch-motion-main.vercel.app](https://sketch-motion-main.vercel.app)

### 🎥 Demo Video

[https://www.youtube.com/watch?v=7nRd42cjbdw](https://www.youtube.com/watch?v=7nRd42cjbdw)

### Suggested demo path

1. Sign in
2. Open the dashboard
3. Open a board
4. Sketch in a frame
5. Polish the frame
6. Run planning
7. Generate motion
8. Show sharing
9. Open export
10. Show TestSprite artifacts

---

## 🧭 Running Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Add local environment variables

Create a `.env` file:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

VITE_AI_PROVIDER=zai
VITE_VIDEO_PROMPT_PROVIDER=local
VITE_VIDEO_PROMPT_PROVIDER_FALLBACK=gemini
VITE_POLISH_PROVIDER_PRIMARY=replicate
VITE_POLISH_PROVIDER_FALLBACK=google
```

### 3. Add required server-side secrets

Set these in Supabase Edge Function secrets:

```bash
STORYBOARD_AI_PROVIDER=zai
ZAI_API_KEY=your_zai_api_key
ZAI_CODING_API_BASE_URL=https://api.z.ai/api/coding/paas/v4
ZAI_GLM_PLANNING_MODEL=glm-5.1
ZAI_THINKING_TYPE=enabled

REPLICATE_API_TOKEN=your_replicate_token
REPLICATE_POLISH_MODEL=black-forest-labs/flux-kontext-pro
REPLICATE_VIDEO_MODEL=bytedance/seedance-2.0-fast
VIDEO_PROVIDER_PRIMARY=replicate
VIDEO_PROVIDER_FALLBACK=google
```

### 4. Deploy edge functions

Deploy:

* `storyboard-plan`
* `polish-sketch`
* `generate-video`
* `check-video-status`

### 5. Run the app

```bash
npm run dev
```

For stable preview:

```bash
npx tsc --noEmit
npx vite build
npx vite preview --port 5173
```

---

## 📌 Known Limitations

* planning quality improves when storyboard metadata is stronger
* motion generation is currently a board-driven downstream step, not full multi-shot orchestration
* some optional legacy provider paths remain configurable, but the current reliable path uses the migrated planning and media stack
* the checked-in frontend suite is strong for product behavior, but not a substitute for broader load or model-quality benchmarking

---

## 🏁 Why This Submission Is Strong

SketchMotion stands out because it behaves like a real product:

* ✅ real auth and persistence
* ✅ real storyboard canvas workflow
* ✅ planning integrated into the working UI
* ✅ image polish and motion generation
* ✅ share and export surfaces
* ✅ visible handling for failure states
* ✅ genuine TestSprite usage with product improvements

This is not a one-click toy demo.

It is a storyboard-first creative workflow that was built, tested, and hardened like real software.


