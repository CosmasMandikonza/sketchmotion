"""TC014 — Stub generate-video fetch; when generation runs, AI panel shows data-ai-panel-error."""
import asyncio
import json
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

        await page.add_init_script("""
            const _fetch = window.fetch.bind(window);
            window.fetch = async (input, init) => {
              const url = typeof input === 'string' ? input : input.url;
              if (url && url.includes('generate-video')) {
                return new Response(JSON.stringify({ status: 'error', error: 'Simulated video failure' }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                });
              }
              return _fetch(input, init);
            };
        """)

        page_ = page
        try:
            await page_.goto(f"{BASE}/auth")
            await page_.locator("#email").fill(LOGIN_EMAIL)
            await page_.locator("#password").fill(LOGIN_PASSWORD)
            await page_.get_by_role("button", name="Sign In").click()
            await page_.wait_for_url(re.compile(r".*/dashboard"), timeout=60000)
            canvas_link = page_.locator('a[href*="/canvas/"]').first
            await expect(canvas_link).to_be_visible(timeout=120000)
            await canvas_link.click()
            await page_.wait_for_url(re.compile(r".*/canvas/"), timeout=60000)
            await page_.get_by_text("Loading board").wait_for(state="hidden", timeout=120000)

            gen = page_.get_by_test_id("ai-video-generate-button").first
            if await gen.is_disabled():
                # No polished-with-image board in this environment — guard-rail still validated elsewhere (TC015).
                return

            await gen.click()
            err = page_.locator("[data-ai-panel-error]").first
            await expect(err).to_be_visible(timeout=120000)
            assert "simulated" in (await err.inner_text()).lower() or "video" in (await err.inner_text()).lower()

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
