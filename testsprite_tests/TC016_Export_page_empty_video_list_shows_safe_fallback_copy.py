"""TC016 — Export: empty video list shows export-no-videos-hint."""
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

            m = re.search(r"/canvas/([^/]+)", page.url)
            assert m, page.url
            board_id = m.group(1)
            await page.goto(f"{BASE}/export/{board_id}")
            await expect(page.get_by_text("Export Preset", exact=False)).to_be_visible(timeout=120000)

            hint = page.get_by_test_id("export-no-videos-hint")
            await expect(hint).to_be_visible(timeout=30000)
            await expect(hint).to_contain_text("No videos generated yet")

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
