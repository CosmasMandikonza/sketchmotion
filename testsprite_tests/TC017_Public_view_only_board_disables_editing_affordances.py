"""TC017 — Anonymous /board/:id view-only: read-only banner + disabled add frame.

Requires env E2E_PUBLIC_BOARD_URL (full URL or path) for a board with public_access=view.
"""
import asyncio
import os

from playwright.async_api import async_playwright, expect

BASE = "http://localhost:5173"
PUBLIC_URL = os.environ.get("E2E_PUBLIC_BOARD_URL", "").strip()


async def run_test():
    if not PUBLIC_URL:
        raise SystemExit(
            "Set env E2E_PUBLIC_BOARD_URL to a public view-only board URL, e.g. "
            f"{BASE}/board/<board-id>"
        )

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        context.set_default_timeout(60000)
        page = await context.new_page()

        try:
            url = PUBLIC_URL if PUBLIC_URL.startswith("http") else f"{BASE}{PUBLIC_URL}"
            await page.goto(url)
            await page.get_by_text("Loading board").wait_for(state="hidden", timeout=120000)

            await expect(page.get_by_test_id("canvas-read-only-banner")).to_be_visible()
            add = page.get_by_test_id("toolbar-add-frame")
            await expect(add).to_be_disabled()

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
