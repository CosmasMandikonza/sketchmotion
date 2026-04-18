"""TC019 — Add frame then reload; frame-card-* still present."""
import asyncio
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

            n_before = await page.locator('[data-testid^="frame-card-"]').count()
            await page.get_by_test_id("toolbar-add-frame").click()
            await asyncio.sleep(2)
            n_after = await page.locator('[data-testid^="frame-card-"]').count()
            assert n_after >= n_before + 1, (n_before, n_after)

            await page.reload()
            await page.get_by_text("Loading board").wait_for(state="hidden", timeout=120000)
            n_reload = await page.locator('[data-testid^="frame-card-"]').count()
            assert n_reload >= 1

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
