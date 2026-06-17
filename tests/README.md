# tests/

Self-contained verification harness for the workarounds documented in [`references/known-limits.md`](../references/known-limits.md).

## What it tests

Locally-testable limits (7 of 15):

- **#1** activator+payload survives `innerHTML` mount
- **#6** `aspect-ratio` parent + `<picture>` + img `height: 100%` height propagation
- **#7** nested-flex carousel: viewport/track/slot width collapse
- **#8** `background-image: url(JSON.stringify(...))` style attribute break
- **#10** 5-redundancy `setupInit` — fires exactly once
- **#13** cart-event debounce — coalesces double-fires
- **#14** CSS leak — unscoped rules bleed to host page

For each, the page renders a BAD (reproduces bug) and GOOD (workaround) side-by-side, then a JS aggregator writes pass/fail to `window.__TEST_RESULTS__` and the `#results` `<pre>` element.

## How to run

### Headless Chrome (Windows)

```sh
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
    --virtual-time-budget=2000 --dump-dom \
    "file:///$PWD/limits-verification.html" \
    | grep -A 12 'TEST RESULTS'
```

`--virtual-time-budget=2000` fast-forwards the page's `setTimeout`s so the aggregator runs before the dump.

### Headless Chrome (Mac/Linux)

```sh
google-chrome --headless=new --disable-gpu \
    --virtual-time-budget=2000 --dump-dom \
    "file://$PWD/limits-verification.html" \
    | grep -A 12 'TEST RESULTS'
```

### In a browser (manual)

Open `limits-verification.html` directly. Wait ~1 s. Scroll to the green-on-black `#results` panel at the bottom.

## Expected output (as of 2026-06-17, Chrome 130+)

```
=== TEST RESULTS ===
t1:  bad=pass  good=pass
t6:  bad=FAIL  good=pass
t7:  bad=pass  good=pass
t8:  bad=pass  good=pass
t10:  pass
t13:  pass
t14:  bad=pass  good=pass
```

The single intentional `t6 bad=FAIL` documents that **the standalone repro for #6 no longer fires in modern Chrome** — the workaround is still correct (and shown to give the expected 200px natural height), but the original bug needs a more complex DOM than the minimal harness covers. See entry #6 in `known-limits.md`.

## What this doesn't cover

- **#2** Reviews API — needs a live Salla store
- **#3** Figma rate limit — needs Figma API
- **#4** jsDelivr/video CDN — needs CDN fetches
- **#5** `.m4v` MIME on Android — needs Android Chrome
- **#9** Vite shared chunks — Twilight bundle problem, not landing
- **#11** Native button upgrade timing — needs Salla SDK
- **#12** SPA navigation — not a current problem
- **#15** Sticky cart removal — needs Salla PDP

These are validated by the production landings where they were originally observed.
