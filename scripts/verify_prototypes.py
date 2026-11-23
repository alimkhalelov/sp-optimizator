import sys
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX_URI = (ROOT / "index.html").as_uri()
SHOTS_DIR = ROOT / "assets" / "screenshots"
SHOTS_DIR.mkdir(parents=True, exist_ok=True)


def assert_layout_and_fonts(page, label: str):
    check = page.evaluate("""() => {
        const doc = document.documentElement;
        const badFonts = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.nodeValue || !node.nodeValue.trim()) continue;
            const el = node.parentElement;
            if (!el) continue;
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            const fs = parseFloat(style.fontSize);
            if (fs < 13.9) {
                badFonts.push({ text: node.nodeValue.trim().slice(0, 40), fontSize: fs, tag: el.tagName });
            }
        }
        return {
            scrollW: doc.scrollWidth,
            clientW: doc.clientWidth,
            scrollH: doc.scrollHeight,
            clientH: doc.clientHeight,
            text: document.body.innerText,
            badFonts,
            overlaps: (() => {
                const issues = [];
                const ftr = document.querySelector('.morph-footer')?.getBoundingClientRect();
                const stage = document.querySelector('.morph-stage-col')?.getBoundingClientRect();
                const box = document.querySelector('.morph-box')?.getBoundingClientRect();
                const readout = document.querySelector('.readout-strip')?.getBoundingClientRect();
                const sub = document.querySelector('.stage-sub');
                const subRect = sub && getComputedStyle(sub).display !== 'none' ? sub.getBoundingClientRect() : null;
                if (ftr && stage && stage.bottom > ftr.top + 1) issues.push(`stage(${stage.bottom}) > ftr(${ftr.top})`);
                if (ftr && readout && readout.bottom > ftr.top + 1) issues.push(`readout(${readout.bottom}) > ftr(${ftr.top})`);
                if (ftr && subRect && subRect.bottom > ftr.top + 1) issues.push(`sub(${subRect.bottom}) > ftr(${ftr.top})`);
                if (box && readout && box.bottom > readout.top + 1) issues.push(`box(${box.bottom}) > readout(${readout.top})`);
                return issues;
            })()
        };
    }""")
    assert check["scrollW"] <= check["clientW"] + 1, f"[{label}] Horizontal overflow: {check['scrollW']} > {check['clientW']}"
    assert check["scrollH"] <= check["clientH"] + 2, f"[{label}] Vertical overflow: {check['scrollH']} > {check['clientH']}"
    assert len(check["overlaps"]) == 0, f"[{label}] Element overlap detected: {check['overlaps']}"
    assert "—" not in check["text"], f"[{label}] Forbidden em-dash rendered"
    assert "·" not in check["text"], f"[{label}] Forbidden middle-dot rendered"
    assert "01 / 09" not in check["text"] and "02 / 09" not in check["text"], f"[{label}] Slide counter should be removed"
    assert len(check["badFonts"]) == 0, f"[{label}] Text below 14px floor: {check['badFonts'][:5]}"


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))

        # Desktop 1280x800 full 9-slide walkthrough
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(INDEX_URI, wait_until="load")

        # Wait briefly for bubbles to wipe in
        page.wait_for_timeout(1400)
        assert page.locator(".bubble-row.is-visible").count() >= 2, "Expected messenger bubbles to animate in"
        # Progressive calculator: only 1 row on Slide 01
        assert page.locator(".calc-row").count() == 1, "Future calculator steps should stay hidden on Slide 01"
        page.screenshot(path=str(SHOTS_DIR / "morph_s1_chat.png"))

        # Wait for full opening token morph + rAF counter + rate equation + subtitle (~6.4s)
        page.wait_for_timeout(5500)
        assert page.locator(".tok-chip").count() >= 10, "Expected colored BPE token chips after bubbles"
        assert page.locator(".readout-strip").count() == 0, "Slide 01 should not duplicate readout strip"
        assert page.locator("text='Replay'").count() == 0, "Replay button should be removed"
        # Confirm math-cascade is outside .morph-box
        in_box = page.evaluate("!!document.querySelector('.morph-box #mathCascade')")
        assert not in_box, "mathCascade should sit centered outside .morph-box"
        assert page.locator(".triangle-svg").count() == 1, "Expected ultra-minimalist Iron Triangle SVG"

        init_tri_y = page.evaluate("document.querySelector('.triangle-panel')?.getBoundingClientRect().top")

        box_center = page.evaluate("""() => {
            const r = document.querySelector('.morph-stage-col').getBoundingClientRect();
            return r.left + r.width / 2;
        }""")
        assert abs(box_center - 640) < 16, f"Morph stage center off-axis: {box_center}px"

        assert_layout_and_fonts(page, "s1-desktop")
        page.screenshot(path=str(SHOTS_DIR / "morph_s1_tokens.png"))

        # Advance through slides 02 -> 09
        for slide_num in range(2, 10):
            page.locator("[data-action='next-slide']").click()
            if slide_num == 2:
                page.wait_for_timeout(150)
                t_hid = page.evaluate("document.getElementById('stageTitle').classList.contains('is-stage-hidden')")
                b_hid = page.evaluate("document.getElementById('belowBoxSlot').classList.contains('is-stage-hidden')")
                assert t_hid and b_hid, "Expected form morph before title and bottom readout appear"
                page.screenshot(path=str(SHOTS_DIR / "s2_during_morph.png"))
                page.wait_for_timeout(1850)
                assert not page.evaluate("document.getElementById('stageTitle').classList.contains('is-stage-hidden')")
                assert not page.evaluate("document.getElementById('belowBoxSlot').classList.contains('is-stage-hidden')")
            else:
                page.wait_for_timeout(2000)
            expected_calc_rows = min(slide_num, 8)
            assert page.locator(".calc-row").count() == expected_calc_rows, (
                f"Expected {expected_calc_rows} calculator rows on slide {slide_num}, got {page.locator('.calc-row').count()}"
            )
            assert page.locator(".triangle-svg circle").count() == slide_num, (
                f"Expected {slide_num} onion-skin dots on slide {slide_num}"
            )
            cur_tri_y = page.evaluate("document.querySelector('.triangle-panel')?.getBoundingClientRect().top")
            assert abs(cur_tri_y - init_tri_y) < 2.0, f"Triangle jumped on slide {slide_num}: {cur_tri_y} vs {init_tri_y}"
            assert_layout_and_fonts(page, f"s{slide_num}-desktop")
            if slide_num == 3:
                assert "$1,536/mo" in page.evaluate("document.body.innerText")
                page.locator("[data-action='toggle-step'][data-step='2']").click()
                page.wait_for_timeout(120)
                assert "$1,441/mo" in page.evaluate("document.body.innerText"), "Unchecking Pretty JSON did not update total"
                page.locator("[data-action='toggle-step'][data-step='2']").click()
                page.wait_for_timeout(120)
                page.screenshot(path=str(SHOTS_DIR / "morph_s3_json.png"))
            elif slide_num == 5:
                page.screenshot(path=str(SHOTS_DIR / "morph_s5_pxpipe.png"))
                page.locator("[data-action='zoom-png']").first.click()
                page.wait_for_timeout(150)
                page.locator("[data-action='close-dialog']").click()
                page.wait_for_timeout(150)
            elif slide_num == 8:
                page.screenshot(path=str(SHOTS_DIR / "morph_s8_flash_lite.png"))
            elif slide_num == 9:
                page.wait_for_timeout(400)
                assert page.locator("#morphCode").count() == 1, "Expected pure #morphCode on Slide 09"
                assert page.locator("[data-action='set-volume']").count() == 0, "Expected volume pills removed on Slide 09"
                assert page.locator("#morphTag").count() == 0, "Expected stage tags removed on Slide 09"
                t_vis = page.evaluate("getComputedStyle(document.getElementById('stageTitle')).display")
                assert t_vis == "none", f"Expected title hidden on Slide 09, got {t_vis}"
                txt_a = page.evaluate("document.getElementById('morphCode')?.innerText || ''")
                page.wait_for_timeout(1200)
                txt_b = page.evaluate("document.getElementById('morphCode')?.innerText || ''")
                assert txt_a != txt_b, "Expected fast looped morph progression on Slide 09"
                page.screenshot(path=str(SHOTS_DIR / "morph_s9_final.png"))

        # Tall desktop 1440x900 centering & spacing screenshot check
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto(INDEX_URI, wait_until="load")
        page.wait_for_timeout(4300)
        assert_layout_and_fonts(page, "s1-1440x900")
        page.screenshot(path=str(SHOTS_DIR / "morph_s1_1440x900.png"))

        # Short laptop Chrome viewport 1280x640 verification (all 9 slides)
        page.set_viewport_size({"width": 1280, "height": 640})
        page.goto(INDEX_URI, wait_until="load")
        page.wait_for_timeout(4300)
        assert_layout_and_fonts(page, "s1-laptop640")
        page.screenshot(path=str(SHOTS_DIR / "morph_s1_laptop640.png"))
        for s_idx in range(2, 10):
            page.locator("[data-action='next-slide']").click()
            page.wait_for_timeout(1800)
            assert_layout_and_fonts(page, f"s{s_idx}-laptop640")

        # Mobile 390x844 verification
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(INDEX_URI, wait_until="load")
        page.wait_for_timeout(3900)
        assert_layout_and_fonts(page, "s1-mobile")
        page.screenshot(path=str(SHOTS_DIR / "morph_s1_mobile.png"))
        for _ in range(8):
            page.locator("[data-action='next-slide']").click()
            page.wait_for_timeout(260)
        page.wait_for_timeout(600)
        assert_layout_and_fonts(page, "s9-mobile")
        page.screenshot(path=str(SHOTS_DIR / "morph_s9_mobile.png"))

        browser.close()

    if errors:
        print("ERRORS:", errors)
        sys.exit(1)
    print("MORPH V4 PROGRESSIVE + CHECKBOX LEDGER + TOP RECLAIM VERIFIED AT 1280x800, 1280x640, AND 390x844 (0 ERRORS)")


if __name__ == "__main__":
    main()
