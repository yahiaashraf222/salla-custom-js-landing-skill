# Salla Storefront SDK Cookbook

The subset of `window.salla.*` / `window.Salla.*` calls actually used in production landing-page IIFEs. Snippets are battle-tested in `jsrefrence-mehwar2.js` and `jsrefrence-v2.js`.

For a call not listed here, search `D:/dev/ezz-oud/.claude/skills/salla-docs/references/` — the official docs are mirrored locally.

## Readiness handshake

Always wait for one of these before touching `salla.*`:

```js
// Inside the IIFE — already handled by setupInit() (see boot-and-init.md)

// Outside the IIFE — for code that runs later (e.g., a click handler):
function onSallaReady(cb) {
    if (window.app && window.app.status === 'ready') return cb();
    if (window.Salla && window.Salla.onReady) return window.Salla.onReady(cb);
    document.addEventListener('theme::ready', cb, { once: true });
}
```

## Cart

### Add to cart

```js
// Simple product
window.salla.cart.addItem({ id: 1004099572, quantity: 1 })
    .then(function (res) {
        // res.data.cart includes the updated cart
        window.salla.notify.success('تمت الإضافة');
    })
    .catch(function (e) {
        window.salla.notify.error('فشلت الإضافة');
        console.error(e);
    });

// Variable product (with options)
window.salla.cart.addItem({
    id: 1004099572,
    quantity: 1,
    options: {
        '<option_id>': '<option_value_id>'   // select-type
        // text-type: '<option_id>': 'free-form string'
        // upload-type: '<option_id>': '<url returned by upload endpoint>'
    }
});
```

### Read cart for mini-cart / preview

```js
window.salla.cart.api.details()           // full cart with items
    .then(function (payload) {
        // payload.data.cart = { items: [...], total: ..., sub_total: ... }
    });

// Lighter alternative — summary only
window.salla.cart.api.latest()
    .then(function (payload) {
        // payload.data = { items_count, total, ... }
    });
```

### Live cart event subscription

These fire automatically whenever the cart changes — from ANY origin on the page (your custom button, a native Salla button, the sticky bar). Subscribe once and re-render:

```js
window.salla.cart.event.onItemAdded(function (response, product_id) {
    // response.data.cart = updated cart
    refresh();   // your re-render function
});
window.salla.cart.event.onUpdated(function (response) {
    refresh();
});
window.salla.cart.event.onItemUpdated(function (response) {
    refresh();
});
window.salla.cart.event.onItemDeleted(function (response) {
    refresh();
});
```

These are what powers the mini-cart staying in sync with both your custom ATC button AND the native `<salla-add-product-button>`.

### Coupons

```js
window.salla.cart.addCoupon({ coupon: 'SUMMER10' });
window.salla.cart.deleteCoupon();
```

## Product

### Hydrate product details from ID

```js
window.Salla.product.api.getDetails(productId)
    .then(function (res) {
        var p = res.data;
        // p.name, p.price, p.regular_price, p.image.url, p.image.alt, p.options, …
    });
```

Note the **capital S** — `Salla.product.api`, NOT `salla.product.api`. Both `window.Salla` and `window.salla` exist; SDK boundary inconsistency.

### Search

```js
window.Salla.product.api.search({ query: 'محور', per_page: 8 })
    .then(function (res) {
        // res.data = [{ id, name, price, image, … }, …]
    });
```

## Notify

Toast feedback styled by the active theme:

```js
window.salla.notify.success('تمت الإضافة');
window.salla.notify.error('فشلت الإضافة');
window.salla.notify.info('تنبيه');
window.salla.notify.warning('تحذير');
```

Falls back silently if `salla.notify` isn't defined — safe to call without guards.

## URLs & assets

```js
window.salla.url.asset('images/logo.png');   // theme asset path
window.salla.url.cdn('media/photo.jpg');     // Salla CDN
```

We rarely use these in landing-page custom JS because asset URLs come from imgbb / custom CDN (see `asset-hosting.md`). They're useful when you need to reference an asset the merchant has already uploaded through their admin.

## Config

```js
window.salla.config.get('page.id');             // current product/page id
window.salla.config.get('page.slug');
window.salla.config.get('user.currency_code');  // 'SAR'
window.salla.config.get('user.language_code');  // 'ar'
window.salla.config.get('store.name');
window.salla.config.get('store.logo');
window.salla.config.isGuest();                  // boolean
```

## User & auth

```js
window.salla.user.isLoggedIn();   // boolean

// Programmatic open of the login modal — rarely needed because
// <salla-add-product-button quick-buy> handles login redirect itself.
window.salla.event.dispatch('login::open');
```

## Comments / reviews — partial

The storefront SDK exposes a comments API that DOES work for the comments thread:

```js
window.salla.comment.api.fetchComments({ product_id: 1004099572, per_page: 12 })
    .then(function (res) {
        // res.data = [{ id, name, body, rating, created_at, … }, …]
    })
    .catch(function () {
        // Fallback to static reviews — see reviews limit in known-limits.md
    });
```

**Known limit**: there is no `/store/v1/feedbacks` reviews-listing endpoint anymore (returns 410). For a reviews carousel:

1. Try `salla.comment.api.fetchComments` first.
2. If it rejects (or returns empty on a brand-new product), render a hard-coded 12-card static fallback — that's what we do in mehwar2.

```js
function initDynamicReviews() {
    if (!window.salla || !window.salla.comment || !window.salla.comment.api) return;
    window.salla.comment.api.fetchComments({ product_id: PRODUCT_ID, per_page: 12 })
        .then(function (res) {
            var items = (res && res.data) || [];
            if (items.length) replaceReviewsCarousel(items);
        })
        .catch(function () { /* keep static fallback */ });
}
```

## Rating

```js
// Submit product reviews — requires order_id (user must have purchased)
window.salla.rating.products({
    products: [{ product_id: 1004099572, comment: '…', rating: 5 }],
    order_id: 12345
});
```

## Events — generic

```js
// Listen
window.salla.event.on('event::name', function (data) { … });

// Dispatch
window.salla.event.dispatch('event::name', payload);
```

Notable storefront events:

| Event | Fires when |
|---|---|
| `theme::ready` | Salla SDK fully loaded — primary readiness signal |
| `page::changed` | SPA navigation (rare on Salla storefront — product pages are full reloads) |
| `login::open` | Login modal opened (dispatch to open it) |
| `rating::open` | Rating modal opened |

## What we DON'T use

Listed here so you don't go hunting for these:

- **Wishlist API** (`salla.wishlist.*`) — works but irrelevant to most landing-page UIs. The native `<salla-product-card>` already includes the wishlist toggle.
- **Storage** (`salla.storage.*`) — just a localStorage wrapper. Use `localStorage` directly if needed.
- **Lang/translations** (`salla.lang.get`) — landing pages are usually hard-coded Arabic. Use it only if the merchant ships in multiple languages.
- **Money formatter** (`salla.money(amount)`) — prefer it once SDK is ready, but our `fmt(amount)` helper covers the pre-init window.
- **Booking / donation / subscription** product types — out of scope for cosmetic-product landings.

## Common mistake

```js
// BAD — Salla may not be loaded yet
window.salla.cart.addItem({ id: 123 });

// GOOD — wait for ready
onSallaReady(function () {
    window.salla.cart.addItem({ id: 123 });
});
```

The IIFE's `setupInit` only guarantees the boot path is delayed. Click handlers fire whenever the user clicks — which might be before `Salla.onReady` if they're impatient. Always wrap delayed-execution code with `onSallaReady`.
