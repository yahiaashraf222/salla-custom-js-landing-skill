# Native `<salla-*>` Web Components

Use these instead of hand-rolling equivalent UI. They auto-wire to the storefront SDK, inherit theme styling, and survive Twilight SDK upgrades. The single most leveraged decision in our production landings.

## Why prefer native components

Building a custom "Add to Cart" button manually means re-implementing:

- Variant selection prompt + validation
- Out-of-stock disable state
- Login redirect for guest carts (when the merchant requires it)
- Sale-price labelling
- Max-per-order caps
- Donation / booking / subscription product type flows
- Sticky-bar sync (the mobile sticky cart at page bottom)
- Apple Pay button render

`<salla-add-product-button>` does all of this for free.

Same logic for installments (`<salla-installment>`), countdowns (`<salla-count-down>`), product card grids (`<salla-product-card>`).

## Highest-leverage components

### `<salla-add-product-button>`

The single most important component. Drop it into a custom layout and ATC just works.

```html
<!-- Standard Add to Cart -->
<salla-add-product-button
    product-id="1004099572"
    class="ezz-NAME-atc"
    width="wide"
    loader-position="end">
    أضف للسلة
</salla-add-product-button>

<!-- Buy Now (ATC + redirect to /checkout) -->
<salla-add-product-button
    product-id="1004099572"
    quick-buy
    class="ezz-NAME-buy"
    width="wide"
    loader-position="end">
    اشترِ الآن
</salla-add-product-button>
```

**Key attributes:**

| Attribute | Values | Purpose |
|---|---|---|
| `product-id` | numeric | The product (required) |
| `quick-buy` | boolean | When present, behaves as Buy Now — ATC + redirect to checkout |
| `product-status` | `sale` / `draft` | Read from product data |
| `product-type` | `simple` / `variable` / `booking` / `donating` | Read from product data |
| `width` | `wide` / nothing | `wide` makes it 100% of container |
| `loader-position` | `start` / `end` / `center` | Where the spinner appears |
| `fill` | `solid` / `outline` | Visual style |
| `color` | `primary` / `light` / `dark` / hex | Visual style |

**Styling via CSS parts** (Twilight 2.x+):

```css
.ezz-NAME-atc::part(button) {
    background: #1a1a1a;
    color: #fff;
    border-radius: 8px;
    height: 56px;
    font-family: 'Tajawal', sans-serif;
    font-weight: 700;
}
.ezz-NAME-atc::part(button):hover {
    background: #000;
}
```

**Auto-wiring with siblings.** All `<salla-*>` components sharing the same `product-id` on the page auto-sync. So a `<salla-quantity-input product-id="1004099572">` next to your `<salla-add-product-button product-id="1004099572">` automatically passes its value to the ATC call — no manual JS bridging needed.

### `<salla-quantity-input>`

Plain input wrapper with +/- buttons.

```html
<salla-quantity-input
    product-id="1004099572"
    value="1"
    min="1"
    max="500">
</salla-quantity-input>
```

When placed near a `<salla-add-product-button>` with the same `product-id`, the button reads this input's value at click time.

### `<salla-installment>`

Renders the merchant's actual installment options (Tabby / Tamara / Apple Pay Later) based on real configuration. Do NOT hand-roll a fake "قسّمها على 4 دفعات" badge — use this.

```html
<salla-installment
    product-id="1004099572"
    price="250">
</salla-installment>
```

If the merchant hasn't enabled installments, it renders nothing (graceful degradation).

### `<salla-product-options>`

Renders ALL customization fields the product has (color, size, date, upload, text) and emits a `changed` event with the selected option data. Necessary for variable products if you're building a custom Buy Now flow.

```html
<salla-product-options
    product-id="1004099572"
    options='[…JSON from product.options…]'>
</salla-product-options>
```

The simpler path: include `<salla-product-options>` AND `<salla-add-product-button>` with the same `product-id` and they auto-sync. The ATC button reads the selected options without you writing any JS.

### `<salla-count-down>`

For flash-sale / limited-offer countdowns.

```html
<salla-count-down
    date="2026-12-31"
    end-of-day
    boxed
    labeled>
</salla-count-down>
```

| Attribute | Purpose |
|---|---|
| `date` | ISO date string (timezone-aware via `end-of-day`) |
| `end-of-day` | Triggers at 23:59 of the date instead of 00:00 |
| `boxed` | Render hours/min/sec as boxes instead of inline text |
| `labeled` | Show "ساعة" / "دقيقة" / "ثانية" labels |

## Often-useful components

### `<salla-product-card>`

Full product tile with image, price, ATC, wishlist toggle. Drop into a grid for related-products sections.

```html
<salla-product-card
    product='{"id":1004099572,"name":"…","price":250,…}'
    minimal="false"
    special="true"
    shadow-on-hover="true">
</salla-product-card>
```

Attributes: `minimal`, `special`, `horizontal`, `full-image`, `hide-add-btn`, `show-quantity`.

For a custom-styled related-products grid, you can either:
- Use multiple `<salla-product-card>` (theme-styled), or
- Hand-roll HTML with `<salla-add-product-button>` per card (custom-styled)

We typically choose the latter to match the landing aesthetic.

### `<salla-products-list>` / `<salla-products-slider>`

Auto-fetch and render product lists by source.

```html
<salla-products-list
    source="latest"
    limit="5"
    horizontal-cards="true">
</salla-products-list>
```

Sources: `latest`, `search`, `offers`, `related`, `selected`, `categories`, `brands`, `tags`, `json`.

`related` requires `product-id` to be set. Useful for "you may also like" sections without writing fetch code.

### `<salla-image>`

Smart image with placeholder fallback.

```html
<salla-image
    src="https://…"
    alt="…"
    lazy>
</salla-image>
```

In a custom landing, we usually use plain `<img>` or our `pic()` helper instead because the `<salla-image>` styling is hard to override and we already have responsive `<picture>` logic.

### `<salla-search>`

Drop-in search bar.

```html
<salla-search inline="true" height="50" oval="true"></salla-search>
```

### `<salla-cart-summary>`

Cart icon with item-count badge. Useful in a custom nav.

```html
<salla-cart-summary show-cart-label="true"></salla-cart-summary>
```

Exposes `.animateToCart(imageEl)` method for fly-to-cart animations.

### `<salla-reviews>` — but as a hidden data source, NOT a visible widget

[Official docs](https://docs.salla.dev/508226m0). Fetches and renders real store reviews. For a custom-design reviews section, **mount it hidden** and DOM-scrape its rendered testimonials, then render in your own card grid. Full pattern in `reviews-harvest-pattern.md`.

```html
<div data-ezz-reviews-twilight aria-hidden="true">
    <salla-reviews source="store" limit="20" display-all-link="false"></salla-reviews>
</div>
```

| Attribute | Purpose |
|---|---|
| `source` | `store` (all store reviews) / `all` / `categories` / `products` / `json` |
| `source-value` | IDs (comma-separated) or JSON for the chosen source |
| `limit` | Max reviews to fetch (default 5; bump to 20–30 for filtering) |
| `display-all-link` | Show/hide the "View all" link |

After hydration the component's DOM contains `.s-reviews-testimonial` cards with `.s-reviews-testimonial__info` (name), `.s-reviews-testimonial__text` (body), `.s-reviews-testimonial__avatar` (image), and `.s-rating-stars-wrapper` + `.s-rating-stars-selected` (stars). The scraper in `reviews-harvest-pattern.md` extracts all of these and filters to only reviews with both a name and non-empty body text.

## Components we generally avoid

| Component | Why we skip it |
|---|---|
| `<salla-rating-stars>` | Read-only static stars; we render inline SVG to match the design exactly |
| `<salla-comments>` | Threaded Q&A section is too heavy for a marketing landing; use static review cards or harvest from `<salla-reviews>` instead |
| `<salla-quick-buy>` | Same as `<salla-add-product-button quick-buy>` but more rigid; prefer the latter |

## Render timing caveat

Web components register when the Salla SDK script loads. If your IIFE injects DOM before the SDK is ready, the components render as plain text initially and upgrade once the SDK arrives.

In practice: just inject your DOM whenever your `runMainScript` fires. Salla's SDK will upgrade the elements automatically — you do NOT need to wait for the components to be defined.

Exception: if a click handler queries an attribute that only exists after upgrade (e.g., the spinner state on `<salla-add-product-button>`), wrap that handler with `onSallaReady()`.

## Don't do this

```html
<!-- BAD — wrapping in a hand-rolled button kills the native click handling -->
<button class="my-atc">
    <salla-add-product-button product-id="123"></salla-add-product-button>
</button>

<!-- GOOD — let the native component BE the button -->
<salla-add-product-button product-id="123" class="my-atc">
    أضف للسلة
</salla-add-product-button>
```

```html
<!-- BAD — manually calling salla.cart.addItem in a click handler reimplements
     variant/stock/login logic. Use the native component. -->
<button onclick="salla.cart.addItem({id:123, quantity:1})">Add</button>

<!-- GOOD -->
<salla-add-product-button product-id="123">Add</salla-add-product-button>
```

There IS a place for `salla.cart.addItem` in hand-written JS: upsell cards, mini-cart "+" buttons on already-added items, and any context where the user is not on the actual product page. For the main ATC on a PDP, always use the native component.
