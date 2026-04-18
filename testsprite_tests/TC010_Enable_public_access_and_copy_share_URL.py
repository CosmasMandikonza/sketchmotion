"""
TC010 — Share board: public access + copy link (UI success criteria only).

Asserts product-visible behavior, not clipboard API contents.
"""
import asyncio
import re

from playwright.async_api import async_playwright, expect

LOGIN_EMAIL = "betterhorizons.zw@gmail.com"
LOGIN_PASSWORD = "SketchMotion123!"
BASE = "http://localhost:5173"


async def run_test():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            permissions=["clipboard-read", "clipboard-write"],
        )
        context.set_default_timeout(45000)
        page = await context.new_page()

        try:
            # Sign in
            await page.goto(f"{BASE}/auth")
            await page.locator("#email").fill(LOGIN_EMAIL)
            await page.locator("#password").fill(LOGIN_PASSWORD)
            await page.get_by_role("button", name="Sign In").click()
            await page.wait_for_url(re.compile(r".*/dashboard"), timeout=60000)

            # Open a board (first canvas link, or create via dashboard entrypoints — not all are <button>)
            canvas_link = page.locator('a[href*="/canvas/"]').first
            create_new = page.get_by_text("Create New Board", exact=True)
            create_first = page.get_by_text("Create your first board", exact=True)
            await expect(canvas_link.or_(create_new).or_(create_first)).to_be_visible(
                timeout=120000
            )

            if await page.locator('a[href*="/canvas/"]').count() > 0:
                await canvas_link.click()
            elif await create_new.count() > 0:
                await create_new.click()
            else:
                await create_first.click()

            await page.wait_for_url(re.compile(r".*/canvas/"), timeout=60000)
            await page.get_by_text("Loading board").wait_for(state="hidden", timeout=120000)

            # Share UI
            await page.get_by_test_id("share-open-button").click()
            await expect(page.get_by_text("Share Board")).to_be_visible()

            # Enable public view
            pub = page.get_by_test_id("share-public-access-select")
            await pub.select_option("view")
            await expect(pub).to_have_value("view", timeout=60000)

            selected_label = await pub.evaluate(
                "el => (el.options[el.selectedIndex] && el.options[el.selectedIndex].text) || ''"
            )
            assert "Anyone with link can view" in selected_label, (
                f"Public access should show 'Anyone with link can view'; got {selected_label!r}"
            )

            # Share URL field
            link_input = page.get_by_test_id("share-link-input")
            url_val = await link_input.input_value()
            assert "/board/" in url_val, f"Share URL should contain /board/; got {url_val!r}"

            # Copy — success = visible Copied! (or equivalent) on the button; do not assert clipboard bytes
            await page.get_by_test_id("share-copy-link-button").click()
            copy_btn = page.get_by_test_id("share-copy-link-button")
            await expect(copy_btn).to_contain_text("Copied!", timeout=20000)

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
