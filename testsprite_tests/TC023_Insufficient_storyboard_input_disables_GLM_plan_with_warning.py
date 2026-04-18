"""TC023 — No storyboard frames keeps GLM plan safely disabled and shows guidance."""
import re

from playwright.async_api import async_playwright, expect

LOGIN_EMAIL = "betterhorizons.zw@gmail.com"
LOGIN_PASSWORD = "SketchMotion123!"
BASE = "http://localhost:5173"


async def run_test():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        context.set_default_timeout(45000)
        page = await context.new_page()

        try:
            await page.goto(f"{BASE}/auth")
            await page.locator("#email").fill(LOGIN_EMAIL)
            await page.locator("#password").fill(LOGIN_PASSWORD)
            await page.get_by_role("button", name="Sign In").click()
            await page.wait_for_url(re.compile(r".*/dashboard"), timeout=60000)

            # Prefer a fresh board path to keep this state deterministic.
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

            run_button = page.get_by_test_id("glm-run-plan-button")
            await expect(run_button).to_be_disabled()

            await expect(
                page.get_by_text(
                    "Add at least one storyboard frame, or clear a stale selection, to build a live plan.",
                    exact=True,
                )
            ).to_be_visible()
            await expect(
                page.get_by_text(
                    "Add storyboard frames to this board, or clear a stale selection, to build a live plan.",
                    exact=True,
                )
            ).to_be_visible()

        finally:
            await context.close()
            await browser.close()


import asyncio
asyncio.run(run_test())
