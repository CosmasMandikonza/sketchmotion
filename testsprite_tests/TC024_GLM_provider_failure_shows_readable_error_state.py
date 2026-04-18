"""TC024 — GLM/provider failure surfaces readable Live Plan error state."""
import asyncio
import json
import re

from playwright.async_api import async_playwright, expect

LOGIN_EMAIL = "betterhorizons.zw@gmail.com"
LOGIN_PASSWORD = "SketchMotion123!"
BASE = "http://localhost:5173"


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

        async def _storyboard_failure(route):
            await route.fulfill(
                status=503,
                content_type="application/json",
                body=json.dumps(
                    {
                        "error": "Temporary upstream outage",
                        "category": "transient_upstream",
                        "status": 503,
                    }
                ),
            )

        await page.route(re.compile(r".*/functions/v1/storyboard-plan.*"), _storyboard_failure)

        try:
            await _login_open_canvas(page)
            await _ensure_frame_exists(page)

            run_button = page.get_by_test_id("glm-run-plan-button")
            await expect(run_button).to_be_enabled()
            await run_button.click()

            error_box = page.get_by_test_id("glm-plan-error")
            await expect(error_box).to_be_visible(timeout=120000)
            await expect(error_box).to_contain_text("Live Plan is temporarily unavailable")
            await expect(error_box).to_contain_text("try again")
            await expect(run_button).to_have_text("Create Plan")

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
