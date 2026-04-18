"""TC013 — Polish edge: Supabase polish-sketch failure -> error notification."""
import asyncio
import json
import re

from playwright.async_api import async_playwright, expect

LOGIN_EMAIL = "betterhorizons.zw@gmail.com"
LOGIN_PASSWORD = "SketchMotion123!"
BASE = "http://localhost:5173"


async def _login_and_open_board(page):
    await page.goto(f"{BASE}/auth")
    await page.locator("#email").fill(LOGIN_EMAIL)
    await page.locator("#password").fill(LOGIN_PASSWORD)
    await page.get_by_role("button", name="Sign In").click()
    await page.wait_for_url(re.compile(r".*/dashboard"), timeout=60000)
    canvas_link = page.locator('a[href*="/canvas/"]').first
    create_new = page.get_by_text("Create New Board", exact=True)
    create_first = page.get_by_text("Create your first board", exact=True)
    await expect(canvas_link.or_(create_new).or_(create_first)).to_be_visible(timeout=120000)
    if await page.locator('a[href*="/canvas/"]').count() > 0:
        await canvas_link.click()
    elif await create_new.count() > 0:
        await create_new.click()
    else:
        await create_first.click()
    await page.wait_for_url(re.compile(r".*/canvas/"), timeout=60000)
    await page.get_by_text("Loading board").wait_for(state="hidden", timeout=120000)


async def run_test():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        context.set_default_timeout(45000)
        page = await context.new_page()

        await page.route(
            re.compile(r".*/functions/v1/polish-sketch.*"),
            lambda route: route.fulfill(
                status=400,
                content_type="application/json",
                body=json.dumps({"error": "Simulated polish provider failure"}),
            ),
        )

        try:
            await _login_and_open_board(page)

            await page.get_by_test_id("toolbar-add-frame").click()
            await asyncio.sleep(1)
            card = page.locator('[data-testid^="frame-card-"]').first
            await expect(card).to_be_visible(timeout=30000)
            await card.dblclick()

            canvas = page.locator("canvas").first
            await expect(canvas).to_be_visible(timeout=15000)
            box = await canvas.bounding_box()
            assert box
            await page.mouse.move(box["x"] + 40, box["y"] + 40)
            await page.mouse.down()
            await page.mouse.move(box["x"] + 120, box["y"] + 80)
            await page.mouse.up()

            await page.get_by_role("button", name=re.compile("Save Draft", re.I)).click()
            await asyncio.sleep(1)

            polish = page.get_by_test_id("frame-polish-ai")
            await expect(polish).to_be_visible(timeout=15000)
            await polish.click()

            notif = page.get_by_test_id("floating-notification")
            await expect(notif).to_be_visible(timeout=30000)
            await expect(notif).to_have_attribute("data-notification-type", "error")
            text = await notif.inner_text()
            assert "polish" in text.lower() or "failed" in text.lower(), text

        finally:
            await context.close()
            await browser.close()


asyncio.run(run_test())
