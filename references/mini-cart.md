# Mini Cart Widget

Floating bottom-right cart panel that stays live-synced with the storefront. Subscribes to `salla.cart.event.*` so it updates whether the user adds to cart via your custom button, the native `<salla-add-product-button>`, or the theme's sticky bar — all of them feed the same events.

## Why bother building one

You don't strictly need it — the theme already has its own cart UI. But on a long-scroll landing where the user adds items as they scroll, an always-visible mini-cart with a count badge increases conversion noticeably. It's also a clear "this thing is alive" signal that the page handled the click.

## Markup

Append once to `<body>` (NOT inside the IIFE's root — needs to survive scrolling past the root element):

```html
<div data-ezz-NAME-minicart class="ezz-NAME-mc-root">
    <button data-mc-toggle class="ezz-NAME-mc-fab" aria-label="Cart">
        <!-- Bag icon SVG -->
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M5 7h14l-1 13H6L5 7zM9 7V5a3 3 0 016 0v2"/>
        </svg>
        <span class="ezz-NAME-mc-count" data-mc-count>0</span>
    </button>
    <div class="ezz-NAME-mc-panel" data-mc-panel hidden>
        <div class="ezz-NAME-mc-head">
            <span>سلتك</span>
            <button data-mc-close aria-label="Close">×</button>
        </div>
        <div class="ezz-NAME-mc-items" data-mc-items>
            <p class="ezz-NAME-mc-empty">السلة فارغة</p>
        </div>
        <div class="ezz-NAME-mc-foot">
            <div class="ezz-NAME-mc-total">
                <span>الإجمالي</span>
                <span data-mc-total>0.00</span>
            </div>
            <a class="ezz-NAME-mc-checkout" href="/cart">إتمام الشراء</a>
        </div>
    </div>
</div>
```

## CSS (minimal)

```css
.ezz-NAME-mc-root {
    position: fixed; bottom: 24px; right: 24px;
    z-index: 9990;          /* below modals but above content */
    font-family: 'Tajawal', sans-serif;
}
.ezz-NAME-mc-fab {
    position: relative; width: 56px; height: 56px;
    border-radius: 50%; border: 0; cursor: pointer;
    background: #1a1a1a; color: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
}
.ezz-NAME-mc-count {
    position: absolute; top: -4px; right: -4px;
    background: #d97706; color: #fff;
    border-radius: 999px; min-width: 20px; height: 20px;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    padding: 0 6px;
}
.ezz-NAME-mc-panel {
    position: absolute; bottom: 72px; right: 0;
    width: 340px; max-height: 70vh;
    background: #fff; color: #111;
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 16px 40px rgba(0,0,0,0.2);
    display: flex; flex-direction: column;
}
.ezz-NAME-mc-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px; border-bottom: 1px solid #eee;
    font-weight: 700;
}
.ezz-NAME-mc-head button { background: none; border: 0; font-size: 24px; cursor: pointer; }
.ezz-NAME-mc-items { padding: 8px 0; flex: 1; overflow-y: auto; }
.ezz-NAME-mc-item {
    display: flex; gap: 12px; padding: 10px 16px;
    border-bottom: 1px solid #f5f5f5;
}
.ezz-NAME-mc-item-img { width: 48px; height: 48px; border-radius: 6px; overflow: hidden; background: #f5f5f5; }
.ezz-NAME-mc-item-img img { width: 100%; height: 100%; object-fit: cover; }
.ezz-NAME-mc-item-info { flex: 1; min-width: 0; }
.ezz-NAME-mc-item-name { font-size: 14px; font-weight: 600; }
.ezz-NAME-mc-item-meta { font-size: 12px; color: #666; }
.ezz-NAME-mc-empty { text-align: center; color: #888; padding: 24px; }
.ezz-NAME-mc-foot {
    padding: 14px 16px; border-top: 1px solid #eee;
    display: flex; flex-direction: column; gap: 10px;
}
.ezz-NAME-mc-total { display: flex; justify-content: space-between; font-weight: 700; }
.ezz-NAME-mc-checkout {
    display: block; text-align: center;
    background: #1a1a1a; color: #fff;
    padding: 12px; border-radius: 8px;
    text-decoration: none; font-weight: 700;
}
```

## JS — the wiring

The whole logic lives in `initMiniCart()`, called from `bindBehaviors()`. Three concerns:

1. **Toggle behavior** — open/close panel
2. **Salla subscription** — re-render on every cart event
3. **Render function** — turn cart payload into DOM

```js
function initMiniCart() {
    var root = document.querySelector('[data-ezz-NAME-minicart]');
    if (!root) return;

    var fab        = root.querySelector('[data-mc-toggle]');
    var panel      = root.querySelector('[data-mc-panel]');
    var closeBtn   = root.querySelector('[data-mc-close]');
    var countEl    = root.querySelector('[data-mc-count]');
    var totalEl    = root.querySelector('[data-mc-total]');
    var itemsHost  = root.querySelector('[data-mc-items]');

    // ── 1. Toggle ────────────────────────────────────────────────────────────
    fab.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) refresh();
    });
    closeBtn.addEventListener('click', function () { panel.hidden = true; });
    document.addEventListener('click', function (e) {
        if (!root.contains(e.target) && !panel.hidden) panel.hidden = true;
    });

    // ── 2. Render ────────────────────────────────────────────────────────────
    function render(payload) {
        var cart = payload || {};
        // Salla nests the cart differently across API methods — flatten:
        if (cart.data && cart.data.cart) cart = cart.data.cart;
        else if (cart.data && cart.data.items) cart = cart.data;

        var items = cart.items || [];
        var count = items.reduce(function (a, it) { return a + (it.quantity || 0); }, 0);
        var total = cart.total || cart.sub_total || 0;

        countEl.textContent = String(count);
        totalEl.textContent = fmt(total);

        if (!items.length) {
            itemsHost.innerHTML = '<p class="ezz-NAME-mc-empty">السلة فارغة</p>';
            return;
        }

        itemsHost.innerHTML = items.map(function (it) {
            var img = (it.image && (it.image.url || it.image)) || '';
            return '<div class="ezz-NAME-mc-item">' +
                '<div class="ezz-NAME-mc-item-img">' +
                    (img ? '<img src="' + escAttr(img) + '" alt="">' : '') +
                '</div>' +
                '<div class="ezz-NAME-mc-item-info">' +
                    '<div class="ezz-NAME-mc-item-name">' + escHtml(it.name) + '</div>' +
                    '<div class="ezz-NAME-mc-item-meta">' + it.quantity + ' × ' + fmt(it.price) + '</div>' +
                '</div></div>';
        }).join('');
    }

    // ── 3. Refresh from API ──────────────────────────────────────────────────
    function refresh() {
        if (!window.salla || !window.salla.cart) return;
        if (window.salla.cart.api && typeof window.salla.cart.api.details === 'function') {
            window.salla.cart.api.details()
                .then(render)
                .catch(function () {
                    if (typeof window.salla.cart.api.latest === 'function') {
                        window.salla.cart.api.latest().then(render);
                    }
                });
        }
    }

    // ── 4. Subscribe ─────────────────────────────────────────────────────────
    function subscribeSalla() {
        var s = window.salla;
        if (!s || !s.cart || !s.cart.event) return;
        s.cart.event.onItemAdded   && s.cart.event.onItemAdded(render);
        s.cart.event.onUpdated     && s.cart.event.onUpdated(render);
        s.cart.event.onItemUpdated && s.cart.event.onItemUpdated(render);
        s.cart.event.onItemDeleted && s.cart.event.onItemDeleted(render);
    }

    // ── 5. Boot — wait for Salla, then subscribe + initial refresh ───────────
    if (window.salla && window.salla.cart) {
        subscribeSalla(); refresh();
    } else if (window.Salla && typeof window.Salla.onReady === 'function') {
        window.Salla.onReady(function () { subscribeSalla(); refresh(); });
    } else {
        document.addEventListener('theme::ready', function () { subscribeSalla(); refresh(); }, { once: true });
    }
}
```

## Idempotency — `injectMiniCart`

The mini cart must NOT be injected twice. Guard with a `data-ezz-NAME-minicart` query (note: the attribute lives on a separate root, NOT the main `INJECT_MARKER`):

```js
function injectMiniCart() {
    if (document.querySelector('[data-ezz-NAME-minicart]')) return;
    document.body.insertAdjacentHTML('beforeend', miniCartHtml());
}
```

This is checked separately from the main `INJECT_MARKER` because the mini cart lives on `<body>`, not inside the root container — if a future change removes the root but leaves the mini cart, the main marker check would let the mini cart inject again.

## Why this pattern wins

**`salla.cart.event.*` fires for ALL cart mutations on the page**, no matter the origin. So the mini cart stays in sync without you wiring per-button callbacks. Add a `<salla-add-product-button>` to a related-products card later? Mini cart updates. Add a quantity-stepper that calls `salla.cart.updateItem`? Mini cart updates. The pattern scales without per-button maintenance.

## Cleanup snippet for Playwright tests

When re-injecting via `addScriptTag` in dev, the mini cart needs to be removed separately because it lives on `<body>`:

```js
document.querySelectorAll('[data-ezz-NAME-injected]').forEach(n => n.remove());
document.querySelectorAll('[data-ezz-NAME-minicart]').forEach(n => n.remove());
document.querySelectorAll('style[data-ezz-NAME-style]').forEach(n => n.remove());
window.__EZZ_NAME_INITED__ = 0;
window.__EZZ_NAME_BOOTED__ = 0;
```
