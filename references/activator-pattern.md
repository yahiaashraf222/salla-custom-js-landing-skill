# Activator + Payload Pattern

## The problem

Salla's page-builder Custom HTML block renders content via a `<salla-html-content>` Lit component, which uses **`innerHTML`** to mount the content. Per the HTML spec, **`<script>` tags inserted via `innerHTML` do NOT execute** — they exist in the DOM but the browser never runs them. This applies equally to inline `<script>` and `<script src="…">`.

So pasting your IIFE wrapped in a plain `<script>` does nothing.

## The solution

A two-element pattern that survives `innerHTML`:

1. A `<script>` with a **non-standard `type` attribute** — the browser does not execute unknown script types but preserves `textContent` intact. This carries the IIFE payload inertly.
2. An `<img>` with an **`onerror` handler** — inline event-handler attributes DO fire when inserted via `innerHTML`. The handler grabs the payload's `textContent`, creates a fresh `<script>` via `document.createElement('script')` (which DOES execute), and appends it to `<head>`.

This pattern has been proven on the live Salla storefront via Playwright at commit `c91a230` for `jsrefrence-v2.js` and on the current production paste for `jsrefrence-mehwar2.js`.

## The full HTML output

```html
<!-- Built: <ISO timestamp> -->
<script type="text/x-ezz-NAME-payload" id="ezz-NAME-payload">
  /* The entire IIFE goes here verbatim, including the outer (function(){...})(); */
</script>
<img alt="" src="x" style="display:none" onerror="
(function(){
  if(window.__EZZ_NAME_BOOTED__)return;
  function boot(p){
    if(window.__EZZ_NAME_BOOTED__)return;
    window.__EZZ_NAME_BOOTED__=1;
    var s=document.createElement('script');
    s.setAttribute('data-ezz-NAME-bootstrap','1');
    s.textContent=p.textContent;
    document.head.appendChild(s);
  }
  var p=document.getElementById('ezz-NAME-payload');
  if(p){boot(p);return;}
  var obs=new MutationObserver(function(_,o){
    var n=document.getElementById('ezz-NAME-payload');
    if(n){o.disconnect();boot(n);}
  });
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(function(){obs.disconnect();},15000);
})();this.remove();
">
```

## Two race conditions handled

1. **Parse-order race**: the `<img onerror>` may fire before the `<script type="text/x-...">` is in the DOM (depends on how `innerHTML` parses the string). Fallback is a `MutationObserver` that waits for the payload element, with a 15-second cap to free the observer.

2. **Double-boot**: if the user pastes the block twice, or the activator fires twice (e.g., Salla re-mounts the component), the `window.__EZZ_NAME_BOOTED__` flag prevents re-execution. Notice the guard is checked TWICE — once at the top of the IIFE and once at the top of `boot()` — to handle the synchronous-fire case before the IIFE-level flag is set.

## Critical: no literal `</script>` in the IIFE

The build script defensively bails if the IIFE contains a literal `</script>` sequence — that string would terminate the containing `<script type="text/x-…-payload">` element early and shred the page. If your IIFE needs to write `</script>` (e.g., emitting a script string inside another template), encode it as `<\/script>`.

The build-paste template (below) has this check.

## Coexistence with sibling landings

If you ship multiple landings on the same domain, **each one must use unique markers** so they don't collide:

| Marker | mehwar2 | v2 | (your new one) |
|---|---|---|---|
| Activator boot flag | `__EZZ_MEHWAR2_BOOTED__` | `__EZZ_BOOTED__` | `__EZZ_NAME_BOOTED__` |
| IIFE init flag | `__EZZ_MEHWAR2_INITED__` | `__EZZ_V2_INITED__` | `__EZZ_NAME_INITED__` |
| Payload id | `ezz-mehwar2-payload` | `ezz-payload` | `ezz-NAME-payload` |
| Script type | `text/x-ezz-mehwar2-payload` | `text/x-ezz-payload` | `text/x-ezz-NAME-payload` |
| DOM marker attr | `data-ezz-mehwar2-injected` | `data-ezz-v2-injected` | `data-ezz-NAME-injected` |
| Style marker attr | `data-ezz-mehwar2-style` | `data-ezz-v2-style` | `data-ezz-NAME-style` |

Two landings on the same domain with the same markers will mutually clobber each other's boots.

## The build-paste template (~80 lines)

Copy this verbatim to `custom-code-landing/scripts/build-paste-NAME.cjs` and replace `NAME` everywhere:

```js
// Build a single-paste HTML payload for Salla page-builder's <salla-html-content>
// for the NAME landing/product-page script.
//
// PROBLEM: <salla-html-content> is a Lit component that renders via innerHTML.
//   Per HTML spec, <script> tags inserted via innerHTML do NOT execute.
//
// SOLUTION: activator+payload pair — see references/activator-pattern.md

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jsPath = path.join(root, 'jsrefrence-NAME.js');
const outPath = path.join(root, 'ezz-NAME-paste.html');

const js = fs.readFileSync(jsPath, 'utf8');

if (/<\/script\s*>/i.test(js)) {
    throw new Error('jsrefrence-NAME.js contains a literal "</script>" sequence. Encode it (e.g. "<\\/script>") before rebuilding.');
}

const ACTIVATOR = [
    "(function(){",
        "if(window.__EZZ_NAME_BOOTED__)return;",
        "function boot(p){",
            "if(window.__EZZ_NAME_BOOTED__)return;",
            "window.__EZZ_NAME_BOOTED__=1;",
            "var s=document.createElement('script');",
            "s.setAttribute('data-ezz-NAME-bootstrap','1');",
            "s.textContent=p.textContent;",
            "document.head.appendChild(s);",
        "}",
        "var p=document.getElementById('ezz-NAME-payload');",
        "if(p){boot(p);return;}",
        "var obs=new MutationObserver(function(_,o){",
            "var n=document.getElementById('ezz-NAME-payload');",
            "if(n){o.disconnect();boot(n);}",
        "});",
        "obs.observe(document.documentElement,{childList:true,subtree:true});",
        "setTimeout(function(){obs.disconnect();},15000);",
    "})();this.remove();"
].join('');

const header =
    '<!-- NAME landing — paste-once payload for Salla page-builder Custom HTML block.\n' +
    '     ▸ Self-contained: no CDN, no second paste required.\n' +
    '     ▸ Survives Salla\'s innerHTML rendering via activator+payload pair.\n' +
    '     ▸ Idempotent: re-pasting is a no-op (__EZZ_NAME_BOOTED__ guard).\n' +
    '     Built: ' + new Date().toISOString() + ' -->\n';

const out =
    header +
    '<script type="text/x-ezz-NAME-payload" id="ezz-NAME-payload">\n' +
    js +
    '\n</script>\n' +
    '<img alt="" src="x" style="display:none" onerror="' + ACTIVATOR + '">\n';

fs.writeFileSync(outPath, out);
console.log('Wrote', outPath);
console.log('  size:', out.length, 'bytes');
console.log('  payload size:', js.length, 'bytes');
console.log('  activator size:', ACTIVATOR.length, 'chars');
```

## Verification

After running the build-paste script, the output file should be ~88-90 KB for a full landing (the mehwar2 paste is exactly 88,679 bytes). If it's much smaller, the IIFE probably wasn't written.

To verify the paste actually boots on the live page:

```js
// in DevTools console on the live Salla page after pasting:
window.__EZZ_NAME_BOOTED__   // should be 1
window.__EZZ_NAME_INITED__   // should be 1
document.querySelector('[data-ezz-NAME-injected]')  // should be the root element
window.EZZ_NAME_DEBUG.events // should include 'init-done' as the last entry
```

If `__EZZ_NAME_BOOTED__` is set but `__EZZ_NAME_INITED__` is not, the payload script was inserted but the IIFE threw before its init flag line. Open `console.error` history.

If both flags are set but no DOM appeared, check `EZZ_NAME_DEBUG.events` — `init-trigger` should be followed by `init-done`. If it's followed by `init-error`, the section builders threw.

## Alternative: Custom JS slot

Some Salla themes expose a "Custom JS" field (not Custom HTML) that takes raw JavaScript. There you can paste `jsrefrence-NAME.js` directly — no activator needed — because that field uses `appendChild(scriptEl)` semantics, which DOES execute scripts.

The built paste-HTML payload works in BOTH slots (Custom HTML AND Custom JS), so prefer it for portability.
