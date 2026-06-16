# URL_GATE, Boot Guards, and 5-Redundancy Init

The three patterns that get your IIFE running ONLY on the right page, EXACTLY once, AS SOON AS Salla is ready.

## 1. URL_GATE — safe global install

The script can be installed in a theme-global Custom JS slot and still stay completely silent on every page except the one(s) you want. The gate exits the IIFE before any side effect — no DOM touch, no `console.log`, no `EZZ_DEBUG.events` push.

```js
(function () {
    'use strict';

    var URL_GATE = (function () {
        var ovr = window.EZZ_NAME_URL_GATE;          // runtime override hook
        if (ovr === '*' || ovr === '') return null;  // null = match all (no gate)
        if (typeof ovr === 'string') return [ovr];
        if (Array.isArray(ovr)) return ovr.slice();
        return ['/p1004099572', '/lp1304367330'];    // ← defaults: edit these
    })();
    if (URL_GATE !== null) {
        var matched = false;
        for (var gi = 0; gi < URL_GATE.length; gi++) {
            if (location.pathname.indexOf(URL_GATE[gi]) !== -1 ||
                location.href.indexOf(URL_GATE[gi]) !== -1) { matched = true; break; }
        }
        if (!matched) return;
    }
    
    // …rest of IIFE…
})();
```

**Why both `pathname` and `href`?** Salla product URLs sometimes carry Arabic slugs (`/ar/هيرش-محور/p1004099572`) — `pathname` is decoded by the browser, `href` is not. Checking both catches encoded and decoded forms without writing a regex.

**Why substring `indexOf`, not full equality?** Lets one gate value (`/p1004099572`) match both the canonical URL and the Arabic-slug URL.

**Runtime override pattern.** A merchant can flip a switch from the browser console:

```js
window.EZZ_NAME_URL_GATE = '*';   // match all pages
// then reload — the IIFE will now run on every page
```

Or pin to a specific test URL:

```js
window.EZZ_NAME_URL_GATE = ['/test-product'];
```

This is critical for QA on staging URLs without re-building the paste.

## 2. Three-layer idempotency

Three independent flags. Each catches a different class of double-fire:

### Layer 1: IIFE-level boot flag

```js
if (window.__EZZ_NAME_INITED__) return;
window.__EZZ_NAME_INITED__ = 1;
```

Catches: the IIFE itself is somehow re-executed (e.g., the activator fires twice and inserts the payload `<script>` twice). The flag is set BEFORE any side effect.

### Layer 2: DOM marker attribute

The root element gets `data-ezz-NAME-injected="1"`:

```js
function injectHtml(html, target) {
    if (document.querySelector('[' + INJECT_MARKER + '="1"]')) return;
    target.insertAdjacentHTML('beforeend',
        '<div ' + INJECT_MARKER + '="1" class="ezz-NAME-root">' + html + '</div>');
}
```

And the init path checks BEFORE injecting:

```js
function safe(via) {
    if (fired) return;
    fired = true;
    if (document.querySelector('[' + INJECT_MARKER + '="1"]')) return;  // ← here
    waitForTarget(function (target) {
        if (document.querySelector('[' + INJECT_MARKER + '="1"]')) return;  // ← here
        runMainScript(target);
    });
}
```

Catches: the IIFE somehow ran twice with the boot flag reset (e.g., Salla SPA navigation un-set window globals), OR a separate copy of the same script booted from a different paste block on the same page.

### Layer 3: Style tag marker

`injectStyles` short-circuits if its style tag is already present:

```js
function injectStyles(css) {
    if (document.querySelector('style[data-ezz-NAME-style="1"]')) return;
    // …append the style tag with data-ezz-NAME-style="1"…
}
```

Catches: defensive insurance — even if a future refactor calls `injectStyles` twice, you don't get a duplicate stylesheet bloating the page.

### Why all three

Each layer protects a different boundary:
- **Boot flag** protects re-execution of the IIFE body
- **DOM marker** protects re-injection of the same DOM
- **Style marker** protects re-injection of CSS

In production we have seen all three actually trip in different scenarios (Playwright re-injection, double-paste, theme SPA re-mount). The cost is 3 lines of code and they save you from confusing duplicate-DOM bugs.

## 3. The 5-redundancy init trigger

Salla's storefront SDK can be ready by the time your script runs, OR much later. The exact timing depends on the theme, the merchant's customizations, and whether the page is a first-load or SPA navigation. You can't pick the right single signal — so wait for whichever fires first:

```js
function setupInit() {
    var fired = false;
    function safe(via) {
        if (fired) return;
        fired = true;
        log('init-trigger', { via: via });
        if (document.querySelector('[' + INJECT_MARKER + '="1"]')) return;
        waitForTarget(function (target) {
            if (document.querySelector('[' + INJECT_MARKER + '="1"]')) return;
            try { runMainScript(target); log('init-done'); }
            catch (e) {
                log('init-error', { msg: e && e.message });
                if (window.console) console.error('[ezz-NAME]', e);
            }
        });
    }

    // 1. Salla.onReady — preferred, fires when SDK is hydrated
    if (window.Salla && typeof window.Salla.onReady === 'function') {
        try { window.Salla.onReady(function () { safe('Salla.onReady'); }); } catch (e) {}
    }

    // 2. theme::ready — some themes dispatch this instead of (or in addition to) Salla.onReady
    try {
        document.addEventListener('theme::ready', function () { safe('theme::ready'); }, { once: true });
    } catch (e) {
        document.addEventListener('theme::ready', function () { safe('theme::ready'); });
    }

    // 3. DOMContentLoaded — DOM-ready fallback (600ms delay lets Salla attach onReady first)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(function () { safe('DOMContentLoaded'); }, 600);
        });
    }

    // 4. window.load — final browser readiness signal
    if (document.readyState !== 'complete') {
        window.addEventListener('load', function () {
            setTimeout(function () { safe('window.load'); }, 600);
        });
    }

    // 5. Hard timeouts — last resort, runs even if all signals failed
    setTimeout(function () { safe('timeout-3000'); }, 3000);
    setTimeout(function () { safe('timeout-6000'); }, 6000);
}

// At the END of the IIFE:
setupInit();
```

### Why 600ms after DOMContentLoaded / load

If the theme attaches `Salla.onReady` later in the page (e.g., from the bottom of `<body>`), `DOMContentLoaded` may fire before `window.Salla` exists. The 600ms gives the theme a chance to register; if `Salla.onReady` fires inside that window, it wins the `fired` flag and the timeout-triggered call is a no-op.

### Why TWO timeouts

`setTimeout(3000)` and `setTimeout(6000)` — both fire, but the `fired` flag means only one wins. The pair is insurance against an event loop blocked for >3 s but freeing before 6 s.

### Why register `Salla.onReady` inside a try/catch

Some themes redefine `Salla.onReady` to throw if called after a certain page state. The try/catch makes that non-fatal — we still have 4 other triggers.

### `waitForTarget` — wait for the host element

`runMainScript` needs a target to inject into. On a Salla product page, that's `<main>`. On a landing page, it might be the `<salla-html-content>` itself, the page-builder section container, or `<body>`. The waiter tries each in turn and falls back via MutationObserver:

```js
var WAIT_TIMEOUT_MS = 10000;

function findPrimary() {
    return document.querySelector('main');
}

function findFallback() {
    return document.querySelector('main') ||
           document.querySelector('[id*="custom-html"]') ||
           document.querySelector('.s-blocks-wrapper') ||
           document.body;
}

function waitForTarget(callback) {
    var t = findPrimary();
    if (t) return callback(t);
    var start = Date.now();
    var obs = new MutationObserver(function () {
        var n = findPrimary();
        if (n) { obs.disconnect(); callback(n); return; }
        if (Date.now() - start > WAIT_TIMEOUT_MS) {
            obs.disconnect();
            var f = findFallback();
            if (f) callback(f);
        }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () {
        obs.disconnect();
        if (!document.querySelector('[' + INJECT_MARKER + '="1"]')) {
            var f = findFallback();
            if (f) callback(f);
        }
    }, WAIT_TIMEOUT_MS);
}
```

## 4. Debug breadcrumbs — `EZZ_NAME_DEBUG`

Sprinkle `log()` calls at every interesting transition. The events array is the first thing to inspect when something is wrong in production:

```js
var EZZ_DEBUG = window.EZZ_NAME_DEBUG = { events: [] };
function log(stage, extra) {
    EZZ_DEBUG.events.push({
        stage: stage,
        t: Date.now(),
        extra: extra || null
    });
}
```

In the live console:

```js
window.EZZ_NAME_DEBUG.events
// → [
//     { stage: 'init-trigger', t: …, extra: { via: 'Salla.onReady' } },
//     { stage: 'target-found', t: …, extra: { tag: 'MAIN' } },
//     { stage: 'styles-injected', t: …, extra: null },
//     { stage: 'html-injected', t: …, extra: { bytes: 87282 } },
//     { stage: 'mini-cart-mounted', t: … },
//     { stage: 'behaviors-bound', t: … },
//     { stage: 'init-done', t: … },
//   ]
```

If the chain stops at `init-trigger` without reaching `init-done`, find the missing stage and you've found the bug.

## 5. Order matters — IIFE bottom

`setupInit()` MUST be the last line of the IIFE because trigger #1 (`Salla.onReady`) can fire **synchronously** if the SDK is already loaded:

```js
// BAD — Salla.onReady fires immediately, runMainScript runs before
//       buildHero / injectStyles / STYLES are defined
setupInit();
function buildHero() { … }
var STYLES = [ … ];
// ReferenceError: buildHero is not defined

// GOOD — everything is defined first, setupInit runs at the bottom
function buildHero() { … }
var STYLES = [ … ];
setupInit();   // ← only now is it safe for Salla.onReady to fire
```

This is why the recommended IIFE skeleton in `SKILL.md` lists `setupInit()` as step 12 (last).
