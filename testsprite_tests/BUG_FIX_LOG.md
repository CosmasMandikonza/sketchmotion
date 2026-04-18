# SketchMotion Bug Fix Log

This log captures the highest-value issues uncovered during TestSprite-driven hardening and the concrete product fixes applied in SketchMotion.

## TC008 - AI polish trigger accessibility

- **Test case / area:** `TC008` / single-frame AI polish
- **Issue:** Automation could not reliably start polish for a sketched frame.
- **Root cause:** The polish affordance was effectively hover-only and too brittle for stable targeting.
- **Fix:** Made the polish trigger reliably accessible, added a stable selector, and kept the action available when polish is valid.
- **Impact:** AI polish became consistently triggerable in both automation and normal use.

## TC010 - Share link copy reliability

- **Test case / area:** `TC010` / public sharing and copy-link flow
- **Issue:** The copy action was flaky during public-access changes and could become stale or non-interactable.
- **Root cause:** Clipboard behavior relied on a single browser path, selectors were not stable enough, and sharing state could reset during the interaction.
- **Fix:** Hardened copy behavior with clipboard-first plus fallback copy logic, added stable selectors and `aria-label`s, kept optimistic local sharing state, and avoided resetting the modal during public-access updates.
- **Impact:** Public link sharing became much more reliable in automation and in real browser sessions.

## Selector hardening across core surfaces

- **Test case / area:** AI panel, frame cards, notifications, export page, share controls, GLM workflow
- **Issue:** Several important controls were visually present but too brittle for dependable end-to-end automation.
- **Root cause:** The UI relied too heavily on layout or incidental text targeting instead of stable product selectors.
- **Fix:** Added and standardized selectors such as:
  - `frame-polish-ai`
  - `share-open-button`
  - `share-copy-link-button`
  - `share-link-input`
  - `floating-notification`
  - `ai-video-generate-button`
  - `ai-video-frames-not-ready`
  - `export-no-videos-hint`
  - `glm-run-plan-button`
  - `glm-insufficient-input-warning`
- **Impact:** Product behavior is easier to validate without weakening the tests or changing the UI design.

## TC013 - Polish provider failure handling

- **Test case / area:** `TC013` / polish failure state
- **Issue:** A polish-provider failure could be visible only inline in the editor flow, making the failure less obvious and harder to automate reliably.
- **Root cause:** The shared floating-notification path was not guaranteed to be the primary user-visible signal for polish failure.
- **Fix:** Routed polish failures through the shared notification system, ensured the error is user-readable, and returned the editor to a retryable state without losing the original sketch.
- **Impact:** Polish failures now surface as a clear product error state instead of a silent or ambiguous failure.

## TC015 - Missing frame images before video generation

- **Test case / area:** `TC015` / video guard rails
- **Issue:** Users could reach video-generation controls before frames were actually ready for generation.
- **Root cause:** The app needed stronger readiness checks and clearer warning copy around missing image assets.
- **Fix:** Kept the generate CTA disabled when frames are not ready, exposed a visible warning state, and improved the explanatory copy around missing polish or missing frame images.
- **Impact:** Users are blocked earlier and more clearly, before unnecessary provider calls happen.

## TC016 - Export empty-state stability

- **Test case / area:** `TC016` / export page with zero videos
- **Issue:** The export page needed to settle into a safe, readable branch when a board had no generated videos.
- **Root cause:** Empty and error cases were too easy to conflate during async loading.
- **Fix:** Explicitly resolved export loading into stable states and guaranteed a visible empty-state hint when the video list is empty.
- **Impact:** `/export/:boardId` remains usable and readable even when nothing has been rendered yet.

## Read-only and public-board safeguards

- **Test case / area:** public board access and anonymous viewing
- **Issue:** Public board flows needed stronger guarantees that view-only users could not accidentally hit edit affordances.
- **Root cause:** Shared canvas surfaces needed explicit read-only treatment in the public-view path.
- **Fix:** Preserved the public share flow while adding and validating read-only guard rails where appropriate.
- **Impact:** Shared boards feel safer and more intentional for external viewers.

## GLM workflow input guard rails

- **Test case / area:** `TC023` / insufficient storyboard input
- **Issue:** Placeholder or effectively empty storyboard state could still feel close to runnable.
- **Root cause:** Input sufficiency was not strict enough around blank or low-signal frame states.
- **Fix:** Tightened insufficient-input detection, disabled plan creation earlier, and surfaced visible guidance explaining what storyboard input is missing.
- **Impact:** The GLM workflow now behaves more like a real creative system and less like a blind provider call.

## GLM workflow failure readability

- **Test case / area:** GLM provider failure handling
- **Issue:** Planning failures needed to be readable to users instead of surfacing raw provider behavior.
- **Root cause:** Provider errors are not product language.
- **Fix:** Normalized planning failures into clearer UI states while preserving richer details in technical surfaces only where appropriate.
- **Impact:** The planning flow is easier to trust because failures are explained as product states, not as backend noise.

## Media pipeline reliability

- **Test case / area:** sketch polish and video generation
- **Issue:** Media generation reliability was too dependent on brittle provider assumptions.
- **Root cause:** Prompt generation and media calls needed stronger routing and fallback behavior.
- **Fix:** Added local prompt building, provider routing, Replicate-backed polish and video generation, and provider-aware polling while keeping Google-compatible paths available by configuration.
- **Impact:** SketchMotion's media features are more dependable without locking the product into a single permanent provider choice.

## Product-level outcome

- Business-critical flows remained intact.
- Failure states became more visible and more user-readable.
- The GLM planning experience became safer to demo.
- The TestSprite suite now reflects a stronger product, not just a more instrumented UI.
