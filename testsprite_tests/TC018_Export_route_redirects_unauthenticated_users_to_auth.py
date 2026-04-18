"""TC018 — /export/:boardId without session redirects to /auth."""
import asyncio
import re

from playwright.async_api import async_playwright

BASE = "http://localhost:5173"


async def run_test():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()

        try:
            await page.goto(f"{BASE}/export/00000000-0000-0000-0000-000000000001")
            await page.wait_for_url(re.compile(r".*/auth"), timeout=30000)
            assert "/auth" in page.url

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
