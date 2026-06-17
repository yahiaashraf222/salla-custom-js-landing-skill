# Known Limits — Reproductions & Workarounds

Every entry here is something we hit in production on `jsrefrence-mehwar2.js` or `jsrefrence-v2.js` (or while building the surrounding tooling). Listed by severity (most-likely-to-bite first).

## Verification status (2026-06-17)

Locally testable entries were run through a headless-Chrome harness at [`tests/limits-verification.html`](../tests/limits-verification.html). Re-run any time with:

```sh
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
    --virtual-time-budget=2000 --dump-dom \
    "file:///D:/path/to/skill/tests/limits-verification.html" \
    | grep -A 12 'TEST RESULTS'
```

| # | Bug reproduces in current Chrome? | Workaround verified? | Notes |
|---|---|---|---|
| 1 — `<salla-html-content>` scripts inert | ✅ yes (plain script via innerHTML stays inert) | ✅ activator+payload executes the IIFE | — |
| 6 — `aspect-ratio` parent + img `height:100%` | ⚠️ **no longer reproduces in minimal case** | ✅ workaround still correct + safe | Modern Chrome propagates correctly through `<picture>`. Bug was observed in a more complex DOM (sticky/transform ancestor?) — the workaround is still recommended as a defensive default. |
| 7 — nested flex carousel collapse | ✅ yes (viewport collapses to 310px instead of 600px) | ✅ `width:100%; min-width:100%` fills correctly | — |
| 8 — `background-image: url(JSON.stringify(...))` | ✅ yes (style attribute terminates early) | ✅ `escAttr()` keeps style intact | — |
| 10 — 5-redundancy `setupInit` | n/a (algorithmic check) | ✅ fires exactly once across 5 simulated triggers | — |
| 13 — cart-event debounce | n/a (algorithmic check) | ✅ 3 triggers within 50ms coalesce to 1 render | — |
| 14 — CSS leak from unscoped rules | ✅ yes (outside button picks up the rule) | ✅ `.ezz-root` scoping blocks the leak | — |

Entries #2, #3, #4, #5, #9, #11, #12, #15 are not locally testable without external services (Salla SDK, Figma API, Android Chrome, mp4 servers) — their workarounds are validated by the production landings where they were originally observed.

## 1. `<salla-html-content>` makes `<script>` tags inert

**Symptom.** Pasting `<script>(function(){…})();</script>` into a Salla Custom HTML block does nothing. The script is in the DOM (visible in DevTools) but never executes. No console error.

**Root cause.** `<salla-html-content>` is a Lit component that mounts its content via `element.innerHTML = ...`. Per HTML spec, `<script>` tags inserted via `innerHTML` are NOT executed. Same applies to `<script src="…">`.

**Workaround.** The **activator + payload** pattern — see `activator-pattern.md`. Inert `<script type="text/x-…-payload">` carries the IIFE; `<img onerror>` (which DOES fire from `innerHTML`) bootstraps it by creating a fresh `<script>` via `document.createElement`.

**Validated.** Playwright on the live storefront, commit `c91a230` (v2) and current production (mehwar2). Both paste-once files boot reliably.

## 2. Reviews listing — use `<salla-reviews>` harvest, NOT the raw HTTP API

**Symptom.** Trying to GET `/store/v1/feedbacks` returns **HTTP 410 Gone**. There is no clean public JSON endpoint that lists store-wide reviews with ratings.

**The real solution — `<salla-reviews>` harvest pattern.** Salla ships an official component (`<salla-reviews>`, [docs](https://docs.salla.dev/508226m0)) that DOES fetch real store reviews. Mount it hidden, wait for it to hydrate, DOM-scrape the testimonials with name/text/stars/avatar, and render them in your own card grid. This is what `jsrefrence-v2.js` does — see the full pattern in `reviews-harvest-pattern.md`.

**Quick TL;DR:**

```html
<div data-ezz-reviews-twilight data-timeout="3500" aria-hidden="true">
    <salla-reviews source="store" limit="20" display-all-link="false"></salla-reviews>
</div>
<div data-ezz-reviews-grid data-page-size="3"></div>
```

```js
// Poll until salla-reviews has .hydrated + .s-reviews-testimonial children;
// then harvest with cleanText/cleanName scrapers (clone-and-strip the embedded
// star widgets + name labels), filter for !!i.text, and render in your design.
hydrateReviewsFromTwilight();
```

**`salla.comment.api.fetchComments` is a separate tool, not a replacement.** It returns the product Q&A thread (a different data shape — no ratings, no verified-purchase, no store-wide source). Use it when you want a Q&A section, not for star-rated testimonials.

**Static fallback is still worth keeping** for three edge cases:
1. Merchant has zero published reviews → `harvestTestimonials` returns `[]`.
2. Brand new store → `salla-reviews` doesn't get `.hydrated` class within 3.5 s.
3. All reviews are name-only with empty text → the `.filter(i => !!i.text)` drops them.

Render the static fallback hidden by default; `showFallback()` only runs if the harvest timeout fires without data.

## 3. Figma API rate limit (~500 req/hour on shared PAT)

**Symptom.** After ~10-15 `mcp__figma__get_figma_data` calls in quick succession, the next call returns 429 with `Retry-After: ~18 hours`.

**Root cause.** Figma's free-tier rate limit on shared Personal Access Tokens; node data responses can be huge (50K+ token JSON) and each counts as multiple requests internally.

**Workaround we used.** After 429, open the Figma file URL directly in Playwright:

```js
mcp__playwright__browser_navigate(url="https://www.figma.com/design/<file-key>/...?node-id=189-147")
```

The page loads behind a login wall but renders at 27% zoom — the inspector panel on the right shows node dimensions, fonts, colors. You can extract enough to fix CSS values manually.

**Better long-term.** Set up your own Figma PAT (per-user quota), and/or cache `mcp__figma__get_figma_data` responses to `custom-code-landing/scripts/figma-cache/<nodeId>.json` for re-use across iterations.

## 4. jsDelivr / GitHub raw not usable for videos

**Symptom.** mp4 hosted via jsDelivr from a GitHub repo: 50 MB hard cap per repo, aggressive 7-day CDN caching that ignores `?v=…` busters, occasional `Content-Type: text/plain` from GitHub raw breaking video playback.

**Workaround.** Use a custom CDN. We use `custom.makaseb.tools/ezz-<landing>/`. Files uploaded via SFTP, no quota issues, no caching wars. See `asset-hosting.md`.

## 5. `.m4v` MIME breaks Android

**Symptom.** Video tile renders but never plays on Android Chrome. Console shows no error.

**Root cause.** Android browsers reject `video/x-m4v` MIME by default. Some servers don't even send it — they return `application/octet-stream`, which is also rejected.

**Workaround.** Rename `.m4v` → `.mp4` before upload. The container is identical, just the file extension matters for MIME negotiation. No transcoding needed:

```bash
mv Nots-22.m4v Nots-22.mp4
```

## 6. `<picture>` + `aspect-ratio` parent — height propagation gotcha

**Symptom we observed in iteration 5 of mehwar2.** Background image inside an absolute-positioned overlay setup rendered at ~637px instead of filling its 1142×1110 container.

**What the harness now shows.** The minimal repro (parent `aspect-ratio: 4/3` → `<picture>` → img `height: 100%; object-fit: cover`) **propagates correctly in current Chrome** — img gets the parent's 300px height as expected. So the standalone bug as I originally described it is either fixed in Chrome 130+ or only triggers with additional conditions (sticky/transform ancestor, source-srcset media query, very specific parent dimensions). The harness assertion fails BAD-side intentionally to flag this.

**Workaround is still recommended as a defensive default.** Drop `aspect-ratio` on the parent and let the natural image size drive layout:

```css
.parent {
    /* aspect-ratio: 1142 / 1110;  ← REMOVED */
    width: 100%;
    max-width: 1142px;
    margin: 0 auto;
}
.parent img {
    width: 100%;
    height: auto;          /* ← was 100% */
    object-fit: contain;   /* ← was cover */
    display: block;
}
```

For a card to overlay on top, position the card with `position: absolute` instead of relying on parent dimensions.

## 7. Universal carousel: flex-basis collapse

**Symptom.** Carousel renders at zero width on first paint. The viewport, track, and slot all have `width: 0`. Slides render but are invisible.

**Root cause.** Inside a flex parent, child width defaults to `auto` which collapses if there's no intrinsic content width. The viewport > track > slot chain inherits this.

**Workaround.** Force explicit width on every layer:

```css
.ezz-NAME-c-viewport { width: 100%; min-width: 100%; overflow: hidden; }
.ezz-NAME-c-track    { width: 100%; min-width: 100%; }
/* .ezz-NAME-c-slot inherits via display:flex; */
```

`min-width: 100%` is critical — `width: 100%` alone can be overridden by flex sizing.

## 8. `style="background-image: url(…)"` breaks with nested quotes

**Symptom.** Page renders with broken HTML — the styles attribute terminates early, the rest of the markup becomes orphaned.

**Reproduction.** This pattern:

```js
'<div style="background-image: url(' + JSON.stringify(url) + ');">'
// → <div style="background-image: url("https://...webp");">
```

`JSON.stringify(url)` adds outer double-quotes that conflict with the style attribute's own double-quotes. HTML parser sees `url("` as closing the attribute and treats `https://...webp")` as new tags/attributes.

**Workaround.** Use `escAttr(url)` instead:

```js
'<div style="background-image: url(' + escAttr(url) + ');">'
// → <div style="background-image: url(https://...webp);">  ← clean
```

## 9. Vite multi-entry shared chunks 404 on Salla CDN

**Symptom.** Twilight bundle components fail to render in production. Network tab shows 404s on `style-<hash>.js` chunks.

**Root cause.** Salla's CDN serves ONE self-contained ES module per component (`/themes/<bundle>/latest/<component>.js`). When `vite build --lib` produces multi-entry output, Rollup hoists shared code (like `landing-shared/style.ts`) into hash-named chunks. The component does `import "./style-<hash>.js"` → 404 on the CDN → the module never evaluates → the component never registers.

**This is a Twilight Bundle problem, NOT a landing-page IIFE problem.** Listed here so future agents don't try to factor shared helpers in `custom-code-landing/` into separate ES modules. The IIFE must stay **self-contained** — one file, no imports.

**Twilight bundle fix.** Single-entry library build per component, `inlineDynamicImports: true`, shared code duplicated per component file. See `tw-ezz2part/scripts/build.mjs` for the working build script.

## 10. `theme::ready` may fire before or after the IIFE

**Symptom.** Sometimes `salla.*` is `undefined` when the IIFE tries to use it; sometimes it's available immediately.

**Root cause.** Salla SDK load order is not deterministic across themes. Some themes load and fire `theme::ready` before the page-builder Custom HTML block renders; others fire it later.

**Workaround.** The 5-redundancy `setupInit` (see `boot-and-init.md`) — listen for `Salla.onReady`, `theme::ready`, `DOMContentLoaded+600ms`, `window.load+600ms`, AND two hard timeouts. Whichever fires first wins. The `fired` flag prevents double-execution.

## 11. `<salla-add-product-button>` upgrade timing

**Symptom.** Programmatically clicking the button right after injecting it does nothing — the click handler isn't bound yet.

**Root cause.** The custom element is registered when the Salla SDK script loads. If your IIFE injects DOM before the SDK finishes loading, the elements render as plain unstyled text initially and upgrade asynchronously.

**Workaround.** Don't programmatically click before SDK is ready:

```js
onSallaReady(function () {
    document.querySelector('salla-add-product-button.ezz-NAME-atc').click();
});
```

For user-initiated clicks (real user, mouse/touch event), this is a non-issue — by the time a user can see and click, the SDK has had time to upgrade.

## 12. SPA navigation considerations

**Symptom.** None observed in production — listed here as a potential future issue.

**Status.** Salla storefront product pages are full page reloads, not SPA navigation. The IIFE re-runs on every navigation; the boot flags reset because `window` is fresh.

**If Salla adds SPA navigation in the future**, you'd need to listen for `page::changed` and re-run `setupInit` after resetting flags. Don't preemptively add this — `page::changed` doesn't fire on storefront product pages today, so wiring it up would be dead code.

## 13. Cart event sometimes fires twice

**Symptom.** `onItemAdded` callback fires 2x for a single ATC click. Mini-cart count jumps by 2 instead of 1.

**Root cause.** Some Salla themes wire a redundant cart event re-emission from their own JS. The double-fire happens whether or not your IIFE is involved.

**Workaround.** Debounce the render call:

```js
var renderTimer;
window.salla.cart.event.onItemAdded(function (res) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { render(res); }, 100);
});
```

100ms is enough to coalesce the duplicates without feeling sluggish.

## 14. CSS leaks into the host page

**Symptom.** Your custom button styles bleed into the theme's other buttons; the theme's `body` margin reset disrupts your full-bleed sections.

**Workaround.** Scope ALL CSS to the root container class:

```css
/* BAD — leaks */
button { padding: 16px 32px; }

/* GOOD — scoped */
.ezz-NAME-root button { padding: 16px 32px; }
.ezz-NAME-root .ezz-NAME-atc::part(button) { padding: 16px 32px; }
```

The only legitimate unscoped rules are the ones that HIDE the theme's default product view:

```css
main > .container--product-details,
main > .s-blocks-wrapper.s-before-product-info { display: none !important; }
```

These are intentional cross-cutting concerns.

## 15. Removing the native product view kills sticky-cart wiring

**Symptom.** Hiding `.container--product-details` with `display: none` works, but the page's native `.sticky-cart-single` element loses its data binding to product info.

**Root cause.** `.sticky-cart-single` reads product data from `.container--product-details` via JS at page-ready. If the container is `display: none`, Salla's JS still finds it (display:none doesn't unmount the DOM); but if you `remove()` the container, the sticky cart goes dark.

**Workaround.** Always `display: none`, never `remove()`. The DOM cost is negligible and the wiring survives:

```css
main > .container--product-details { display: none !important; }   /* OK */
```

```js
// document.querySelector('.container--product-details').remove();    ← DON'T
```
