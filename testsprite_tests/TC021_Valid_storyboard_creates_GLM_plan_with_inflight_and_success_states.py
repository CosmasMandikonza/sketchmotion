"""TC021 — Valid storyboard triggers GLM plan, shows in-flight and success UI states."""
import asyncio
import json
import re

from playwright.async_api import async_playwright, expect

LOGIN_EMAIL = "betterhorizons.zw@gmail.com"
LOGIN_PASSWORD = "SketchMotion123!"
BASE = "http://localhost:5173"


def _mock_plan_payload(narrative: str) -> dict:
    return {
        "provider": "zai",
        "model": "glm-5.1",
        "models": {
            "vision": "glm-5.1",
            "planning": "glm-5.1",
            "continuity": "glm-5.1",
            "renderStrategy": "glm-5.1",
            "revisionReasoning": "glm-5.1",
        },
        "endpoints": {
            "vision": "z.ai/coding",
            "planning": "z.ai/coding",
            "continuity": "z.ai/coding",
            "renderStrategy": "z.ai/coding",
            "revisionReasoning": "z.ai/coding",
        },
        "generatedAt": "2026-04-17T12:00:00.000Z",
        "requestId": "tc021-run-1",
        "frameAnalyses": [
            {
                "frameId": "frame-1",
                "order": 0,
                "title": "Frame 1",
                "summary": "Wide establishing view with forward movement.",
                "subjects": ["lead"],
                "setting": "Street at dusk",
                "action": "Lead steps forward",
                "cameraIntent": "Slow push-in",
                "composition": "Wide",
                "continuitySignals": ["same jacket"],
                "ambiguityNotes": [],
                "sourceImageUsed": False,
            }
        ],
        "summary": {
            "narrative": narrative,
            "totalScenes": 1,
            "totalShots": 1,
            "estimatedDurationSeconds": 2.0,
            "primaryGoal": "Open the sequence with stable context",
        },
        "scenes": [
            {
                "sceneId": "scene-1",
                "order": 0,
                "label": "Opening",
                "summary": "Scene opening beat",
                "goal": "Establish location",
                "emotionalBeat": "Calm",
                "sourceFrameIds": ["frame-1"],
                "shots": [
                    {
                        "shotId": "shot-1",
                        "order": 0,
                        "label": "Establishing",
                        "shotType": "wide",
                        "camera": "push-in",
                        "composition": "wide",
                        "action": "move forward",
                        "sourceFrameIds": ["frame-1"],
                        "estimatedDurationSeconds": 2.0,
                        "continuityNotes": ["hold framing"],
                        "promptDirectives": ["keep dusk lighting"],
                    }
                ],
            }
        ],
        "continuityConstraints": [
            {
                "id": "cont-1",
                "category": "character",
                "rule": "Maintain wardrobe continuity.",
                "priority": "medium",
                "appliesToFrameIds": ["frame-1"],
            }
        ],
        "renderStrategy": {
            "narrativeMode": "single-shot",
            "recommendedAspectRatio": "16:9",
            "consistencyApproach": "Reuse base style tokens across shots.",
            "transitionStrategy": "Single continuous move.",
            "batchingPlan": ["Render opening beat as one batch."],
        },
        "revisionContext": {
            "appliedInstruction": None,
            "revisionApplied": False,
            "changedSections": [],
            "carryForwardSummary": "Initial baseline run",
        },
        "warnings": [],
    }


async def _login_open_canvas(page):
    await page.goto(f"{BASE}/auth")
    await page.locator("#email").fill(LOGIN_EMAIL)
    await page.locator("#password").fill(LOGIN_PASSWORD)
    await page.get_by_role("button", name="Sign In").click()
    await page.wait_for_url(re.compile(r".*/dashboard"), timeout=60000)

    create_new = page.get_by_text("Create New Board", exact=True)
    create_first = page.get_by_text("Create your first board", exact=True)
    if await create_new.count() > 0:
        await create_new.click()
    elif await create_first.count() > 0:
        await create_first.click()
    else:
        await page.locator('a[href*="/canvas/"]').first.click()

    await page.wait_for_url(re.compile(r".*/canvas/"), timeout=60000)
    await page.get_by_text("Loading board").wait_for(state="hidden", timeout=120000)


async def _ensure_frame_exists(page):
    if await page.locator('[data-testid^="frame-card-"]').count() == 0:
        await page.get_by_test_id("toolbar-add-frame").click()
    await expect(page.locator('[data-testid^="frame-card-"]').first).to_be_visible(timeout=30000)


async def run_test():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        context.set_default_timeout(45000)
        page = await context.new_page()

        request_bodies = []

        async def _storyboard_plan(route):
            request_bodies.append(route.request.post_data_json or {})
            await asyncio.sleep(1.2)
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(_mock_plan_payload("Baseline GLM storyboard plan created.")),
            )

        await page.route(re.compile(r".*/functions/v1/storyboard-plan.*"), _storyboard_plan)

        try:
            await _login_open_canvas(page)
            await _ensure_frame_exists(page)

            run_button = page.get_by_test_id("glm-run-plan-button")
            await expect(run_button).to_be_enabled()
            await expect(run_button).to_have_text(re.compile(r"Create Plan|Refresh Plan"))
            await run_button.click()

            await expect(page.get_by_test_id("glm-plan-progress")).to_be_visible()
            await expect(run_button).to_have_text(re.compile(r"Running|Revising"))

            result = page.get_by_test_id("glm-plan-result")
            await expect(result).to_be_visible(timeout=120000)
            await expect(page.get_by_text("Plan ready", exact=True)).to_be_visible()
            await expect(run_button).to_have_text("Refresh Plan")

            assert len(request_bodies) == 1, f"Expected one storyboard-plan call, got {len(request_bodies)}"
            frames = request_bodies[0].get("frames", [])
            assert len(frames) >= 1, "Expected at least one storyboard frame in request payload"

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
