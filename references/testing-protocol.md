# Playwright Testing Protocol

The fast iteration loop for landing-page custom JS. Test on the LIVE Salla storefront URL — there is no meaningful local equivalent because the IIFE depends on `window.salla`, `theme::ready`, and the merchant's product data.

## Setup

Tools used (all via MCP):

- `mcp__playwright__browser_navigate` — open the live URL
- `mcp__playwright__browser_run_code_unsafe` — inject the IIFE, run cleanup, check state
- `mcp__playwright__browser_take_screenshot` — capture pixel-perfect output
- `mcp__playwright__browser_evaluate` — read live DOM state
- `mcp__playwright__browser_console_messages` — surface IIFE errors

## The fast iteration loop

```
edit jsrefrence-NAME.js
  → node scripts/build-paste-NAME.cjs    (optional — only needed for paste deploy)
  → in Playwright: cleanup + addScriptTag(local path)
  → screenshot to buildscreenshots/
  → eyeball the change
  → repeat
```

You do NOT need to copy-paste into Salla's page-builder between iterations. `addScriptTag` injects the local JS file directly, which is much faster.

## Step 1 — Navigate

```python
mcp__playwright__browser_navigate(url="https://alezz-oud.com/ar/هيرش-محور/p1004099572")
```

URL examples we use:

- `https://alezz-oud.com/ar/هيرش-محور/p1004099572` — mehwar2 product page
- `https://alezz-oud.com/ar/landing/v2` — v2 landing page

## Step 2 — Cleanup before re-injection

If the page was previously visited with the paste deployed, all boot flags are set. Re-injecting via `addScriptTag` would be a no-op. Reset everything:

```js
// Paste this into mcp__playwright__browser_run_code_unsafe `code` param:

await page.evaluate(() => {
    document.querySelectorAll('[data-ezz-NAME-injected]').forEach(n => n.remove());
    document.querySelectorAll('[data-ezz-NAME-minicart]').forEach(n => n.remove());
    document.querySelectorAll('style[data-ezz-NAME-style]').forEach(n => n.remove());
    window.__EZZ_NAME_INITED__ = 0;
    window.__EZZ_NAME_BOOTED__ = 0;
});
```

Replace `NAME` with your actual prefix everywhere.

## Step 3 — Inject the IIFE

```js
await page.addScriptTag({ path: 'D:/dev/ezz-oud/custom-code-landing/jsrefrence-NAME.js' });
```

NOT `addScriptTag({ content: <huge string> })` — Windows path-with-backslashes handles cleaner than embedding the file as a JS string literal.

After injection, the IIFE runs and your DOM appears within ~1–2 s (waits for `Salla.onReady` or one of the fallback triggers).

## Step 4 — Verify it booted

Quick state check:

```js
await page.evaluate(() => ({
    booted: !!window.__EZZ_NAME_BOOTED__,
    inited: !!window.__EZZ_NAME_INITED__,
    hasRoot: !!document.querySelector('[data-ezz-NAME-injected]'),
    sections: Array.from(document.querySelectorAll('[data-ezz-NAME-injected] > section'))
        .map(s => s.className),
    debugEvents: (window.EZZ_NAME_DEBUG?.events || []).map(e => e.stage),
}));
```

Expected:

```
{
  booted: true,
  inited: true,
  hasRoot: true,
  sections: ['ezz-NAME-hero', 'ezz-NAME-gallery', …],
  debugEvents: ['init-trigger', 'target-found', 'styles-injected', 'html-injected', 'mini-cart-mounted', 'behaviors-bound', 'init-done']
}
```

If `debugEvents` ends mid-stage, the next-stage call threw. Check `mcp__playwright__browser_console_messages`.

## Step 5 — Screenshot to `buildscreenshots/`

Per root `CLAUDE.md` section 5: ALL build screenshots go to `D:/dev/ezz-oud/buildscreenshots/`.

```js
mcp__playwright__browser_take_screenshot(
    filename="buildscreenshots/m3-section-hero.png",
    element="hero section",          // or omit for full page
    fullPage=False                   // True only for full-page audit
)
```

Filename conventions:

- `<landing-prefix>-section-<name>.png` for per-section shots: `m3-section-hero.png`, `m3-section-buy.png`
- `<landing-prefix>-<viewport>-full.png` for full pages: `m3-1280-full.png`, `m3-390-full.png`
- `<landing-prefix>-iter<N>-<description>.png` for iteration milestones

## Step 6 — Specific feature tests

### ATC button works (cart event spy)

```js
await page.evaluate(() => {
    window.__CART_EVENTS__ = [];
    if (window.salla?.cart?.event?.onItemAdded) {
        window.salla.cart.event.onItemAdded((res, pid) => {
            window.__CART_EVENTS__.push({ ts: Date.now(), product_id: pid, ok: !!res });
        });
    }
});
// Click your custom ATC, or:
await page.locator('salla-add-product-button.ezz-NAME-atc').click();
await page.waitForTimeout(2000);
const events = await page.evaluate(() => window.__CART_EVENTS__);
// Expect events.length >= 1
```

### Buy Now button redirects to checkout

```js
await page.route('**/checkout**', route => {
    window.__CHECKOUT_HIT__ = true;
    route.continue();
});
await page.locator('salla-add-product-button[quick-buy].ezz-NAME-buy').click();
await page.waitForURL('**/checkout**', { timeout: 5000 });
```

### Mini cart count updates

```js
const before = await page.locator('[data-mc-count]').textContent();
// trigger an ATC click...
await page.waitForTimeout(1500);
const after = await page.locator('[data-mc-count]').textContent();
// Expect after > before
```

### Carousel infinite loop

```js
await page.evaluate(() => {
    const root = document.querySelector('[data-ezz-carousel]');
    const slot = root.querySelector('[data-c-track] > div');
    return { tx: slot.style.transform };
});
// Click "next" until you wrap, verify transform resets to translateX(0px)
```

### Mobile responsive

```js
mcp__playwright__browser_resize(width=390, height=844)   // iPhone 14 Pro
// re-inject, screenshot, compare
mcp__playwright__browser_resize(width=1280, height=800)  // standard desktop
```

## Step 7 — Console hygiene

Surface IIFE errors:

```js
mcp__playwright__browser_console_messages()
// Filter for: [ezz-NAME] errors, generic TypeError/ReferenceError near boot time
```

If you see `Cannot read property 'X' of undefined` referencing `salla.*`, the IIFE touched the SDK before `Salla.onReady`. Wrap the touching code in `onSallaReady()`.

## Visual audit per section

For each section in the landing, take a focused screenshot and diff against the Figma reference:

```js
// Per section:
const sectionEl = await page.locator('.ezz-NAME-hero').boundingBox();
mcp__playwright__browser_take_screenshot(
    filename=`buildscreenshots/m3-section-hero.png`,
    element="hero",
    fullPage=False
);
```

Then visually compare against:
- Figma node screenshot (export from Figma or `mcp__figma__download_figma_images`)
- The previous iteration's screenshot (committed in `buildscreenshots/`)

The user accepts pixel-perfect within ±2px — don't chase exact matches.

## URL_GATE smoke test

Verify the gate prevents accidental global execution. Navigate OFF the target URL with the script loaded:

```js
mcp__playwright__browser_navigate(url="https://alezz-oud.com/cart")
await page.addScriptTag({ path: '…/jsrefrence-NAME.js' });
await page.waitForTimeout(2000);

const state = await page.evaluate(() => ({
    inited: !!window.__EZZ_NAME_INITED__,
    hasRoot: !!document.querySelector('[data-ezz-NAME-injected]'),
    debugEvents: (window.EZZ_NAME_DEBUG?.events || []).length
}));
// Expect: { inited: false, hasRoot: false, debugEvents: 0 }
```

If any of those are truthy on a non-target URL, the URL_GATE is misconfigured.

## Idempotency smoke test

Inject twice in a row; the second injection must be a no-op:

```js
await page.addScriptTag({ path: '…/jsrefrence-NAME.js' });
await page.waitForTimeout(1500);
await page.addScriptTag({ path: '…/jsrefrence-NAME.js' });
await page.waitForTimeout(1500);

const rootCount = await page.evaluate(() =>
    document.querySelectorAll('[data-ezz-NAME-injected]').length
);
// Expect: 1
```

## Don't

- Don't screenshot to the project root or `mehwar2/` — always `buildscreenshots/`.
- Don't `await page.reload()` between iterations — wastes ~3 s. Use cleanup + re-inject.
- Don't `console.log` inside the IIFE in production paste — strip them or wrap in `if (window.EZZ_NAME_DEBUG.verbose)`.
- Don't test on a fresh incognito browser EVERY iteration — slow, and you lose cart state which is useful for mini-cart tests. Reuse the same Playwright tab.
