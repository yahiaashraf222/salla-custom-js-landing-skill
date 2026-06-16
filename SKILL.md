---
name: salla-custom-js-landing
description: Build a self-contained custom-JS IIFE that renders a bespoke landing page or product-detail UI on top of an existing Salla storefront. Pasted into Salla page-builder Custom HTML/JS slots — NOT Twilight Bundle components. Use when the user asks to build, fix, or iterate on a Salla "custom landing page", "custom PDP", "jsrefrence-*.js", "<salla-html-content> script", or anything that adds custom HTML+CSS+JS to a specific Salla URL via the page builder. Covers the activator+payload bootstrap, URL gating, idempotency, Salla storefront SDK integration (cart, product, notify), native <salla-*> web components, asset hosting, and known limits we have hit in production.
---

# Salla Custom JS Landing Pages

A pattern playbook for shipping a **self-contained IIFE** that takes over part of a Salla storefront page — either a landing page (`/lp...`) or a product page (`/p...`) — without forking the theme. The script is pasted into Salla page-builder's **Custom HTML** block (rendered by `<salla-html-content>`) or **Custom JS** field, gated by a URL, and renders its own DOM + styles + behaviors on top of the live storefront.

This is **not** for building reusable Twilight Bundle components. That is a different deliverable (Lit + Vite + per-component build, lives in `tw-ezz2part/`). This skill is for `custom-code-landing/` work.

## When to use this skill

Trigger words: "custom landing", "custom PDP", "jsrefrence", "ezz-mehwar2", "ezz-landing-paste", "paste-once", "<salla-html-content>", "Custom HTML block", "Salla page builder Custom JS", "self-contained IIFE for Salla".

Use it when the user wants to:
- Add a bespoke product/landing UI to a specific Salla URL
- Iterate on `jsrefrence*.js` or `ezz-*-paste.html`
- Debug why a paste-once landing isn't booting on a Salla page
- Wire native Salla buttons (`<salla-add-product-button>`, mini cart, installment) into a custom layout
- Replace the default product-details view with a cinematic landing

**Do not** use it when the user wants to build a Twilight Bundle component (those go in `tw-ezz2part/src/components/`).

## The 7 must-know patterns

Every production landing in `custom-code-landing/` is built from these 7 patterns. Read the linked reference for each before writing any code that overlaps it.

| # | Pattern | What it solves | Reference |
|---|---|---|---|
| 1 | **Activator + payload** | `<salla-html-content>` strips `<script>` tags because it renders via `innerHTML` — they exist in DOM but never execute. Two-element bootstrap (`<script type="text/x-…-payload">` + `<img onerror>`) survives this. | `references/activator-pattern.md` |
| 2 | **URL_GATE** | Script can be installed theme-global yet stay silent except on target URL(s). Supports wildcard, single string, or array. | `references/boot-and-init.md` |
| 3 | **Three-layer idempotency** | `__EZZ_*_BOOTED__` (activator) + `__EZZ_*_INITED__` (IIFE) + DOM `data-…-injected` marker (root). Survives double-paste, double-fire, Salla SPA re-mount. | `references/boot-and-init.md` |
| 4 | **5-redundancy init trigger** | Wait for whichever fires first: `Salla.onReady` → `theme::ready` → `DOMContentLoaded+600ms` → `window.load+600ms` → `setTimeout(3s)` / `setTimeout(6s)`. A `fired` flag ensures the work runs exactly once. | `references/boot-and-init.md` |
| 5 | **Helpers** (escHtml, escAttr, pic, injectStyles, log, waitForTarget) | XSS-safe templating + idempotent style injection + DOM-ready waiter + responsive `<picture>` with crop-different desktop/mobile assets. | `references/helpers.js` |
| 6 | **Universal carousel** | Single engine drives every slider in the script: infinite loop, drag (pointer events), autoplay with pause-on-hover, dot pagination. Slides discovered by class polymorphism so one engine serves gallery + reviews + anything else. | `references/carousel.js` |
| 7 | **Mini cart widget** | Floating FAB wired to `salla.cart.api.details()` + `salla.cart.event.onItemAdded/onUpdated/onItemDeleted`. Re-renders live as the storefront cart changes. | `references/mini-cart.md` |

## Salla integration cheat sheet

Always **prefer a native `<salla-*>` web component over hand-rolling**. Native components inherit the theme's variant-picker logic, stock-out states, login redirects, installment widgets, sticky-bar sync, and Apple Pay — and survive Twilight SDK upgrades.

**Highest-leverage native components:**

| Tag | What it gives you for free |
|---|---|
| `<salla-add-product-button product-id="…" quick-buy>` | ATC + redirect-to-checkout, variants, stock, login, sale labels, max-per-order, Tabby/Tamara |
| `<salla-quantity-input product-id="…" value="1" max="500">` | Wired by `product-id` to its sibling `<salla-add-product-button>`; no manual JS bridging |
| `<salla-installment price="250">` | Renders the store's actual installment options based on real config |
| `<salla-count-down date="2026-12-31" end-of-day boxed labeled>` | Live countdown that respects timezone + locale |
| `<salla-product-options product-id="…" options='…'>` | Renders all variant/customization fields and syncs to the ATC button |

Full catalog: `references/native-components.md`.

**Highest-leverage SDK calls (all under `window.salla`):**

| Call | Returns / does |
|---|---|
| `salla.cart.addItem({ id, quantity, options? })` | Adds to cart; fires `onItemAdded` / `onItemAddedFailed` |
| `salla.cart.api.details()` | Full cart with items (`.then(cart => …)`) — use for mini-cart |
| `salla.cart.event.onItemAdded((res) => …)` | Live subscription — fires whenever ANY ATC succeeds |
| `salla.notify.success(msg)` / `.error(msg)` / `.info(msg)` / `.warning(msg)` | Theme-styled toast |
| `salla.url.asset(path)` / `salla.url.cdn(path)` | Resolves theme-asset or CDN URLs |
| `Salla.product.api.getDetails(id)` | Hydrate name/price/image from a product ID |
| `salla.config.get('page.id')` / `'user.currency_code'` / `'store.name'` | Page + user + store context |
| `salla.user.isLoggedIn()` | Guard before guarded actions |

Full cookbook with snippets: `references/salla-sdk-cookbook.md`.

## File structure for a new landing

Put new work in `D:/dev/ezz-oud/custom-code-landing/` (see root `CLAUDE.md` section 5). Layout for a new landing called `mehwar3`:

```
custom-code-landing/
├── jsrefrence-mehwar3.js          ← the IIFE (write this)
├── ezz-mehwar3-paste.html         ← built paste payload (output of build-paste)
└── scripts/
    ├── build-paste-mehwar3.cjs    ← wraps jsrefrence-mehwar3.js → ezz-mehwar3-paste.html
    └── mehwar3-urls.json          ← imgbb URL manifest (output of upload script)
```

The build-paste script is ~50 lines of boilerplate per landing — copy the existing `build-paste-mehwar2.cjs` and swap names + payload-id + boot-guard. Template: `references/activator-pattern.md`.

Asset uploads reuse `scripts/upload-to-imgbb.cjs` (Node) or `scripts/convert-and-upload-mehwar2.py` (Python+PIL for PNG→WebP). API key lives in `tw-ezz2part/.env` (gitignored). See `references/asset-hosting.md` for rules + size caps + the **never-use-jsDelivr-for-videos** rule.

## Recommended IIFE skeleton order

The IIFE is large (mehwar2 = 1457 lines). Order matters because trigger 1 (`Salla.onReady`) can fire synchronously, so the IIFE must be fully self-defined before `setupInit()` is called at the bottom. Layout the file top-to-bottom in this order:

```
(function () {
    'use strict';
    
    // 1. URL_GATE — exit silently if not on target URL
    var URL_GATE = …; if (no match) return;
    
    // 2. Boot flag — exit if IIFE already ran on this page
    if (window.__EZZ_NAME_INITED__) return;
    window.__EZZ_NAME_INITED__ = 1;
    var INJECT_MARKER = 'data-ezz-name-injected';
    
    // 3. Debug breadcrumbs
    var EZZ_DEBUG = window.EZZ_NAME_DEBUG = { events: [] };
    function log(stage, extra) { EZZ_DEBUG.events.push({ stage, t: Date.now(), …extra }); }
    
    // 4. ASSETS map (all CDN URLs in one place — single source of edit)
    var ASSETS = { hero: { desktop, mobile }, … };
    
    // 5. DEFAULTS + config merge (allow window.EZZ_NAME_CONFIG overrides)
    var DEFAULTS = { product: {…}, hero: {…}, … };
    var CFG = deepMerge(DEFAULTS, window.EZZ_NAME_CONFIG || {});
    
    // 6. Init orchestration — waitForTarget + setupInit + runMainScript
    function waitForTarget(cb) { … }
    function setupInit() { … }       // ← registers 5 triggers
    function runMainScript(target) {
        injectStyles(STYLES);
        injectHtml(buildAllSections(), target);
        injectMiniCart();
        bindBehaviors();
    }
    
    // 7. Injection helpers — injectStyles, injectHtml, injectMiniCart
    function injectStyles(css) { … }
    function injectHtml(html, target) { … }
    function injectMiniCart() { … }
    
    // 8. Section builders — buildHero, buildBuy, buildReviews, etc.
    //    Each returns an HTML string; all are concatenated by buildAllSections.
    function buildAllSections() { return buildHero() + buildBuy() + …; }
    function buildHero()    { … }
    function buildBuy()     { … }
    // …
    
    // 9. Helpers — escHtml, escAttr, pic, SVG icons
    function escHtml(s) { … }   // see references/helpers.js
    function pic(asset, alt, cls, opts) { … }
    
    // 10. STYLES array (concatenated CSS)
    var STYLES = [':root { … }', '.ezz-name-root { … }', …];
    
    // 11. Behaviors — bindBehaviors + carousel/video/cart bindings
    function bindBehaviors()      { initCarousels(); initBuyButtons(); initMiniCart(); … }
    function initCarousels()      { /* see references/carousel.js */ }
    function initBuyButtons()     { /* salla.cart.addItem wiring */ }
    function initMiniCart()       { /* see references/mini-cart.md */ }
    
    // 12. Boot — register triggers (this MUST be last)
    setupInit();
})();
```

## Build & test loop

The fast iteration cycle that worked best for us:

1. Edit `jsrefrence-NAME.js` (the IIFE).
2. `node scripts/build-paste-NAME.cjs` → produces fresh `ezz-NAME-paste.html`.
3. (Optional) Test live without re-pasting: open the live URL in Playwright, run the **cleanup snippet** below, then `await page.addScriptTag({ path: 'D:/dev/ezz-oud/custom-code-landing/jsrefrence-NAME.js' })`. Inject it as many times as you want without leaving the tab.
4. When happy, copy `ezz-NAME-paste.html` into the Salla page-builder Custom HTML block.

The **mandatory cleanup snippet** before re-injecting in Playwright (the page already has the previous paste loaded, which set the boot flags):

```js
document.querySelectorAll('[data-ezz-NAME-injected]').forEach(n => n.remove());
document.querySelectorAll('[data-ezz-NAME-minicart]').forEach(n => n.remove());
document.querySelectorAll('style[data-ezz-NAME-style]').forEach(n => n.remove());
window.__EZZ_NAME_INITED__ = 0;
window.__EZZ_NAME_BOOTED__ = 0;
```

Replace `NAME` with the actual marker prefix (e.g. `mehwar2`, `v2`).

Per project CLAUDE.md section 5: **every Playwright build screenshot goes to `D:/dev/ezz-oud/buildscreenshots/`**, not the project root or `mehwar2/`. Use `mcp__playwright__browser_take_screenshot` with `filename: 'buildscreenshots/m3-section-hero.png'` (or full absolute path).

Full test protocol: `references/testing-protocol.md`.

## Known limits we have hit

Don't re-learn these from scratch:

| Limit | Workaround |
|---|---|
| `<salla-html-content>` renders via `innerHTML` → `<script>` tags inert | The **activator + payload** pattern (see `references/activator-pattern.md`) |
| Salla storefront has **no public reviews-listing API** — `/store/v1/feedbacks` returns 410 | Use static fallback reviews OR `salla.comment.api.fetchComments({product_id, per_page})` (works for the comments thread; reviews-summary endpoint is gone) |
| Figma MCP rate limit (~500 req/hour on shared PAT) | After 429, use Playwright on the Figma URL directly (login-walled but readable at 27% zoom); cache responses to `scripts/figma-cache/{nodeId}.json` going forward |
| jsDelivr unusable for videos (50 MB repo cap + aggressive caching) | Host mp4 on `custom.makaseb.tools/...`; never on GitHub raw / jsDelivr |
| `.m4v` MIME breaks Android browsers | Rename to `.mp4` before upload, keep the container as-is |
| `<picture>` with `aspect-ratio` parent doesn't propagate `height: 100%` to `<img>` through implicit-aspect containers | Drop `aspect-ratio` on the parent and let the natural image size drive layout, or set `height: auto; object-fit: contain` on the img |
| Universal carousel flex-basis collapse | Explicit `width: 100%; min-width: 100%` on `.viewport`, `.track`, and `.slot` |
| `style="background-image: url(…)"` breaks when URL contains quotes | Use the `escAttr()` helper, never `JSON.stringify(url)` for inline styles |
| Vite multi-entry shared chunks (`style-*.js`) 404 on Salla CDN | Twilight bundle only — irrelevant for custom-code-landing. (Mentioned here so future agents don't try to factor shared helpers into separate ES modules — the IIFE must stay self-contained.) |

Full catalog with reproduction details: `references/known-limits.md`.

## Quick reference index

When working on landing-page custom JS, Read the reference that matches the work:

| Working on… | Read |
|---|---|
| Bootstrap / paste payload doesn't execute | `references/activator-pattern.md` |
| URL gating, boot guards, init triggers | `references/boot-and-init.md` |
| Templating, picture, styles, log | `references/helpers.js` |
| ATC, mini cart, notify, product hydration | `references/salla-sdk-cookbook.md` |
| Native `<salla-*>` components | `references/native-components.md` |
| Any kind of slider | `references/carousel.js` |
| Floating cart panel | `references/mini-cart.md` |
| Uploading images / videos / WebP | `references/asset-hosting.md` |
| Playwright test loop | `references/testing-protocol.md` |
| Anything unexpected | `references/known-limits.md` |
