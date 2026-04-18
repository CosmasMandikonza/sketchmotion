"""TC022 — Revision input reruns GLM plan and updates displayed result."""
import asyncio
import json
import re

from playwright.async_api import async_playwright, expect

LOGIN_EMAIL = "betterhorizons.zw@gmail.com"
LOGIN_PASSWORD = "SketchMotion123!"
BASE = "http://localhost:5173"


def _mock_plan_payload(narrative: str, request_id: str, revised: bool) -> dict:
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
        "requestId": request_id,
        "frameAnalyses": [
            {
                "frameId": "frame-1",
                "order": 0,
                "title": "Frame 1",
                "summary": "Medium shot with movement.",
                "subjects": ["lead"],
                "setting": "Rooftop",
                "action": "Turns to camera",
                "cameraIntent": "Steady medium",
                "composition": "medium",
                "continuitySignals": ["same coat"],
                "ambiguityNotes": [],
                "sourceImageUsed": False,
            }
        ],
        "summary": {
            "narrative": narrative,
            "totalScenes": 1,
            "totalShots": 1,
            "estimatedDurationSeconds": 2.5,
            "primaryGoal": "Keep continuity while revising pacing",
        },
        "scenes": [
            {
                "sceneId": "scene-1",
                "order": 0,
                "label": "Beat",
                "summary": "Single story beat",
                "goal": "Deliver clear action",
                "emotionalBeat": "Focused",
                "sourceFrameIds": ["frame-1"],
                "shots": [
                    {
                        "shotId": "shot-1",
                        "order": 0,
                        "label": "Medium move",
                        "shotType": "medium",
                        "camera": "steady",
                        "composition": "medium",
                        "action": "turn",
                        "sourceFrameIds": ["frame-1"],
                        "estimatedDurationSeconds": 2.5,
                        "continuityNotes": ["maintain orientation"],
                        "promptDirectives": ["preserve identity"],
                    }
                ],
            }
        ],
        "continuityConstraints": [
            {
                "id": "cont-1",
                "category": "character",
                "rule": "Preserve costume continuity.",
                "priority": "high",
                "appliesToFrameIds": ["frame-1"],
            }
        ],
        "renderStrategy": {
            "narrativeMode": "single-shot",
            "recommendedAspectRatio": "16:9",
            "consistencyApproach": "Lock style terms across reruns.",
            "transitionStrategy": "No cut.",
            "batchingPlan": ["Render one revised pass."],
        },
        "revisionContext": {
            "appliedInstruction": "Tighten pacing and increase urgency." if revised else None,
            "revisionApplied": revised,
            "changedSections": ["summary"] if revised else [],
            "carryForwardSummary": "Base plan reused for unchanged sections.",
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
        call_count = 0

        async def _storyboard_plan(route):
            nonlocal call_count
            call_count += 1
            body = route.request.post_data_json or {}
            request_bodies.append(body)
            await asyncio.sleep(0.7)
            if call_count == 1:
                payload = _mock_plan_payload("Base plan narrative.", "tc022-run-1", False)
            else:
                payload = _mock_plan_payload("Revised plan narrative with faster pacing.", "tc022-run-2", True)
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(payload),
            )

        await page.route(re.compile(r".*/functions/v1/storyboard-plan.*"), _storyboard_plan)

        try:
            await _login_open_canvas(page)
            await _ensure_frame_exists(page)

            run_button = page.get_by_test_id("glm-run-plan-button")
            await run_button.click()
            await expect(page.get_by_test_id("glm-plan-result")).to_be_visible(timeout=120000)
            await expect(page.get_by_text("Base plan narrative.", exact=True)).to_be_visible()

            revision_input = page.get_by_test_id("glm-revision-input")
            await revision_input.fill("Tighten pacing and increase urgency.")
            await expect(run_button).to_have_text("Apply Revision")
            await run_button.click()

            await expect(run_button).to_have_text(re.compile(r"Revising|Running"))
            await expect(page.get_by_text("Revised plan narrative with faster pacing.", exact=True)).to_be_visible(timeout=120000)

            assert call_count == 2, f"Expected two storyboard-plan calls, got {call_count}"
            assert request_bodies[1].get("revision", {}).get("instruction") == "Tighten pacing and increase urgency."

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
