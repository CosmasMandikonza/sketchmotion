"""TC020 — Non-existent board UUID shows board-state-not-found or board-state-empty."""
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

            await page.goto(f"{BASE}/canvas/00000000-0000-0000-0000-000000000099")
            nf = page.get_by_test_id("board-state-not-found")
            em = page.get_by_test_id("board-state-empty")
            await expect(nf.or_(em)).to_be_visible(timeout=60000)

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
