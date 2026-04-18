# TestSprite Baseline Report (Round 1)

This file preserves the initial TestSprite baseline used to harden SketchMotion's core web-app workflow.

It should be read together with:

- [BUG_FIX_LOG.md](./BUG_FIX_LOG.md)
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)

Those two documents explain what changed after the baseline run and how the suite expanded into edge cases and GLM-specific behavior.

---

## Round 1 Scope

Round 1 focused on the business-critical product path:

- landing page to auth
- sign-in
- protected dashboard
- create and open board
- frame creation and sketch editing
- AI polish trigger
- video generation trigger
- sharing and public board access
- export entry

The purpose of the round was simple:

**prove that SketchMotion already behaved like a real web application before deeper failure handling was added.**

---

## Baseline Result

- **Executed tests:** 12
- **Passed on the baseline run:** 10
- **Initial issues surfaced:** 2

### Passed in the baseline run

- `TC001` Landing to auth
- `TC002` Sign in to dashboard
- `TC003` Protected-route redirect
- `TC004` Dashboard loads boards or empty state
- `TC005` Create board and land on canvas
- `TC006` Open existing board
- `TC007` Add frame, sketch, and save
- `TC009` Start video generation flow
- `TC011` Open public shared board anonymously
- `TC012` Open export UI and see presets/options

### Issues surfaced in the baseline run

- `TC008` AI polish affordance was too hover-dependent for stable automation targeting.
- `TC010` Share-link copy flow was brittle during interaction and needed stronger selectors plus more reliable copy handling.

---

## Why This Baseline Matters

The baseline showed that SketchMotion was already more than a visual demo:

- auth worked
- protected routes worked
- board creation worked
- canvas editing worked
- public sharing worked
- export entry worked

The failures were also meaningful:

- they were not arbitrary test issues
- they exposed real product-quality gaps in visibility and interaction reliability

That is exactly the kind of signal we wanted from TestSprite.

---

## What Happened After Round 1

The baseline findings led directly to product hardening:

- stable selectors were added
- hover-only affordances were made reliably reachable
- share-link copy behavior was strengthened
- error and empty states were made more explicit
- the suite expanded into provider failures, invalid states, read-only behavior, persistence, and GLM workflow cases

See:

- [BUG_FIX_LOG.md](./BUG_FIX_LOG.md) for the engineering fixes
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for the two-round rationale

---

## Notes

- This file intentionally represents the **baseline** pass, not the final state of the submission.
- Temporary local TestSprite execution artifacts are intentionally excluded from the public-ready repo shape.
- The checked-in `testsprite_tests/` directory is the durable submission artifact; local temp files are not.
