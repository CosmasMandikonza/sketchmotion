# SketchMotion Testing Strategy

SketchMotion was tested as a product, not just as a collection of pages.

The goal of this suite was straightforward: validate that the app's most important creative workflows work in a browser, then harden the failure states that matter in a real demo or real session.

## Why Round 1 focused on business-critical workflows

Round 1 covered the flows that define whether SketchMotion is a usable product at all:

- landing page entry
- sign-in
- protected dashboard access
- creating and opening boards
- adding and editing frames
- triggering AI polish
- triggering video generation
- sharing and public board access
- export entry points

This round answered the basic product question:

**Can a user get into SketchMotion, make something, use the key AI actions, and reach the final surfaces without the app falling apart?**

That is the right first filter for a premium web application. If those paths are not solid, deeper edge-case coverage does not matter yet.

## Why Round 2 focused on edge cases and failure handling

Once the core workflow was covered, the next priority was resilience.

Round 2 focused on the failures that users and judges actually notice:

- provider failures
- missing image or metadata states
- empty export states
- invalid board handling
- persistence after refresh
- public read-only safety

This round mattered because creative tools are judged on how they behave when the path is not perfect.

Reliable failure handling is part of product quality, not an optional QA layer.

## Why GLM-specific tests were added

The planning workflow is central to SketchMotion's current differentiation, so it deserved its own focused coverage.

The GLM tests were added to verify four specific behaviors:

- a valid storyboard can create a plan
- revision input can rerun and update that plan
- insufficient storyboard input is blocked safely before provider work
- provider failures become readable UI states

This is important because the value of the GLM workflow is not just "model call succeeded." The value is that the planning loop behaves like a trustworthy creative tool.

## Why stable selectors were introduced

Stable selectors were added because browser automation should verify product behavior, not guess at implementation details.

In a visual app like SketchMotion, relying on incidental text or layout is too fragile. The suite needed durable anchors for:

- frame polish actions
- share controls
- floating notifications
- AI video controls
- export empty states
- GLM planning controls and warnings

That selector work improved two things at once:

- automation reliability
- product clarity around key states

## Why preview mode and stable execution matter

For repeatable browser testing, `vite preview` is the right execution target.

Preview mode reduces dev-server timing noise such as:

- hot reload interruptions
- transient loading shifts
- inconsistent asset timing
- flakier UI interactions under automation

That matters especially for a canvas-heavy product with overlays, realtime state, and async provider calls.

The preferred verification path is:

```bash
npx tsc --noEmit
npx vite build
npx vite preview --port 5173
```

## How the suite demonstrates improvement between rounds

The strongest part of this TestSprite work is not the initial pass rate. It is the improvement loop.

The suite exposed real issues:

- hover-only polish affordances
- brittle share-copy behavior
- weak provider-failure visibility
- empty-state ambiguity
- insufficient-input GLM guard rails

Those findings led directly to product changes, not just test adjustments.

That means the suite now demonstrates more than coverage. It demonstrates that SketchMotion got stronger because it was tested.

## What this testing approach proves to judges

This strategy shows that SketchMotion is not a thin demo shell around model calls.

It shows:

- the core workflow is real
- the edge cases were taken seriously
- the GLM planning flow was treated as product behavior
- the UI was hardened without redesigning it
- the app improved measurably between testing rounds

That is the standard we wanted for this submission.
