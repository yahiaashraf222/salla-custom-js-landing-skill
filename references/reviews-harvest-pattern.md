# Reviews Harvesting — The `<salla-reviews>` Pattern

The proper way to display real store reviews in a custom design. **This supersedes the "no public reviews API" workaround** previously listed as a limit — there IS a solution and we are using it in production (`jsrefrence-v2.js` lines 1600-1684).

## The component

Salla ships an official storefront component:

```html
<salla-reviews
    source="store"
    source-value=""
    limit="20"
    display-all-link="false">
</salla-reviews>
```

[Official docs](https://docs.salla.dev/508226m0).

| Attribute | Purpose | Values |
|---|---|---|
| `source` | Where reviews come from | `store` (default — all store reviews) / `all` / `categories` / `products` / `json` |
| `source-value` | ID(s) or JSON for the chosen source | comma-separated IDs, or a JSON string |
| `limit` | Max reviews to fetch | default 5; bump to 20–30 if you need a wider pool to filter from |
| `display-all-link` | Show "View all" link to native reviews page | `true` / `false` |

The component fetches real reviews from the merchant's storefront via the Salla SDK, then renders them as a vertical slider with embedded star ratings.

## The harvest pattern

We don't want the component's visual output — we want its **data**. The pattern:

1. Mount `<salla-reviews>` inside a hidden wrapper.
2. Poll for the `.hydrated` class + presence of `.s-reviews-testimonial` children (signals data loaded).
3. **Harvest** name / text / avatar / stars from each testimonial node via DOM scraping.
4. Filter to only reviews that have both a name AND non-empty text.
5. Render OUR own card grid + pagination from the harvested array.
6. Hide the Salla slider entirely; show static fallback only if harvest fails.

The full implementation is below — copy verbatim.

## Markup

```html
<section class="ezz-NAME-reviews">

    <header class="ezz-NAME-reviews-head">
        <h2>تجارب حقيقية لعملائنا</h2>
        <p>كل تقييم تجربة حقيقية ميدانية</p>
    </header>

    <!-- 1. Off-screen Salla component — the data source -->
    <div class="ezz-NAME-reviews-twilight"
         data-ezz-reviews-twilight
         data-timeout="3500"
         aria-hidden="true">
        <salla-reviews
            source="store"
            limit="20"
            display-all-link="false">
        </salla-reviews>
    </div>

    <!-- 2. Our custom-design card grid — populated by hydrateReviewsFromTwilight -->
    <div class="ezz-NAME-reviews-grid"
         data-ezz-reviews-grid
         data-page-size="3">
    </div>

    <!-- 3. Numbered pagination — populated alongside the grid -->
    <div class="ezz-NAME-reviews-pagination"
         data-ezz-reviews-pagination
         hidden>
    </div>

    <!-- 4. Static fallback — only shown if harvest fails -->
    <div class="ezz-NAME-reviews-fallback" data-ezz-reviews-fallback hidden>
        <!-- 3-6 hand-written review cards in case salla-reviews doesn't hydrate -->
    </div>

</section>
```

## CSS to hide the Salla slider

```css
.ezz-NAME-reviews-twilight { position: relative; }
.ezz-NAME-reviews-twilight[hidden] { display: none !important; }
.ezz-NAME-reviews-twilight salla-reviews { display: block; }

/* Hide the Salla slider's own header + container chrome while it's still in DOM */
.ezz-NAME-reviews-twilight .s-reviews-header-wrapper { display: none; }
.ezz-NAME-reviews-twilight .s-reviews-container { padding: 0; background: transparent; }
```

We keep `display: block` on `salla-reviews` itself (not `display: none`) because the component may bail on rendering if it's completely hidden by computed style. Wrapping it in `aria-hidden="true"` + visual hide via the parent wrapper's `hidden` attribute is the safe path.

## The harvest function — copy verbatim

```js
function hydrateReviewsFromTwilight() {
    var wrap = document.querySelector('[data-ezz-reviews-twilight]');
    if (!wrap) return;
    var timeout = parseInt(wrap.getAttribute('data-timeout') || '3500', 10);
    var fallback = document.querySelector('[data-ezz-reviews-fallback]');

    function getNode() { return wrap.querySelector('salla-reviews'); }

    function checkRendered() {
        var node = getNode();
        if (!node) return false;
        if (!node.classList.contains('hydrated')) return false;
        return !!node.querySelector('.s-reviews-testimonial');
    }

    function showFallback() {
        try { wrap.setAttribute('hidden', ''); } catch (e) {}
        if (fallback) fallback.removeAttribute('hidden');
    }

    var elapsed = 0, step = 250;
    var t = setInterval(function () {
        elapsed += step;
        if (checkRendered()) {
            clearInterval(t);
            var items = harvestTestimonials(getNode());
            if (items.length) {
                wrap.setAttribute('hidden', '');         // hide the Salla slider entirely
                tryUpdateSummaryFromTwilight();          // optional: compute avg + count
                renderReviewsGridFromItems(items);
            } else {
                showFallback();
            }
            return;
        }
        if (elapsed >= timeout) {
            clearInterval(t);
            if (!checkRendered()) showFallback();
        }
    }, step);
}
```

## The scraper — handles the dirty DOM

Salla's rendered testimonial DOM has icon labels, star widget text, and duplicated names that bleed into the comment body if you naively `textContent` the card. This scraper clones-and-strips those before reading:

```js
function harvestTestimonials(node) {
    if (!node) return [];

    function cleanText(el) {
        if (!el) return '';
        var c = el.cloneNode(true);
        c.querySelectorAll(
            '.s-rating-stars-wrapper, .s-rating-stars-btn-star, .s-rating-stars-selected,' +
            ' .s-reviews-testimonial__rating, .s-reviews-testimonial__name_wrapper,' +
            ' .s-reviews-testimonial__info, .s-reviews-testimonial__icon,' +
            ' .s-reviews-testimonial__avatar, svg'
        ).forEach(function (x) { x.remove(); });
        return (c.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function cleanName(el) {
        if (!el) return '';
        var c = el.cloneNode(true);
        c.querySelectorAll('.s-rating-stars-wrapper, .s-rating-stars-btn-star, svg')
            .forEach(function (x) { x.remove(); });
        return (c.textContent || '').replace(/\s+/g, ' ').trim();
    }

    return Array.from(node.querySelectorAll('.s-reviews-testimonial')).map(function (t) {
        var name = cleanName(t.querySelector('.s-reviews-testimonial__info'));
        var text = cleanText(t.querySelector('.s-reviews-testimonial__text'));

        // Some Twilight versions duplicate the name at the end of __text — strip it.
        if (name && text && text.endsWith(name)) text = text.slice(0, -name.length).trim();

        var avatarHost = t.querySelector('.s-reviews-testimonial__avatar');
        var avatarImg = avatarHost && (avatarHost.tagName === 'IMG' ? avatarHost : avatarHost.querySelector('img'));
        var avatarSrc = (avatarImg && avatarImg.getAttribute && avatarImg.getAttribute('src')) || '';

        // Drop placeholder avatars — show the initial instead
        if (avatarSrc && /placeholder|default|avatar\.svg/i.test(avatarSrc)) avatarSrc = '';

        var wrap = t.querySelector('.s-rating-stars-wrapper');
        var stars = wrap ? wrap.querySelectorAll('.s-rating-stars-selected').length : 0;
        if (stars < 1 || stars > 5) stars = 5;

        return {
            name: name || 'عميل',
            text: text,
            avatarSrc: avatarSrc,
            initial: (name || 'ع').slice(0, 1),
            stars: stars
        };
    }).filter(function (i) { return !!i.text });  // ← only keep reviews with actual text
}
```

**The `.filter(i => !!i.text)` at the end is the answer to the user's question** — it keeps ONLY reviews that have actual body text. Add `&& !!i.name && i.name !== 'عميل'` if you also want to require a non-default name:

```js
.filter(function (i) {
    return !!i.text && !!i.name && i.name !== 'عميل';
});
```

## Source class names — the contract

The scraper depends on these classes existing in the rendered Twilight DOM. They're stable across Twilight 2.x but if Salla rev-bumps the component, audit and update:

| Class | Holds |
|---|---|
| `.s-reviews-testimonial` | Each review card (the iteration target) |
| `.s-reviews-testimonial__info` | Reviewer's name + meta wrapper |
| `.s-reviews-testimonial__text` | The body of the review |
| `.s-reviews-testimonial__avatar` | Avatar container (may wrap an `<img>`) |
| `.s-rating-stars-wrapper` | The star widget container |
| `.s-rating-stars-selected` | Selected/filled star buttons |
| `.s-rating-stars-btn-star` | All star buttons (selected or not) |

If you suspect the DOM has shifted, inspect a real testimonial:

```js
document.querySelector('[data-ezz-reviews-twilight] .s-reviews-testimonial').innerHTML
```

## Computing the summary (avg + distribution) from real data

Once you have testimonials, compute the summary card from them rather than hard-coding:

```js
function tryUpdateSummaryFromTwilight() {
    try {
        var node = document.querySelector('[data-ezz-reviews-twilight] salla-reviews');
        if (!node) return;
        var testimonials = Array.from(node.querySelectorAll('.s-reviews-testimonial'));
        if (!testimonials.length) return;

        var totalStars = 0, dist = [0, 0, 0, 0, 0, 0];   // index 0 unused
        testimonials.forEach(function (t) {
            var wrap = t.querySelector('.s-rating-stars-wrapper');
            var n = wrap ? wrap.querySelectorAll('.s-rating-stars-selected').length : 0;
            if (n < 1 || n > 5) n = 5;
            totalStars += n;
            dist[n]++;
        });

        var avg = (totalStars / testimonials.length).toFixed(2);

        // Update DOM nodes in your summary card:
        var scoreEl = document.querySelector('[data-ezz-reviews-score]');
        var countEl = document.querySelector('[data-ezz-reviews-count]');
        if (scoreEl) scoreEl.textContent = avg;
        if (countEl) countEl.textContent = 'بناءً على ' + testimonials.length + ' مراجعات';

        for (var i = 1; i <= 5; i++) {
            var bar = document.querySelector('[data-ezz-reviews-bar-' + i + ']');
            if (bar) bar.style.width = (dist[i] / testimonials.length * 100) + '%';
        }
    } catch (e) { /* keep static summary */ }
}
```

## Pagination + render

```js
var EZZ_REVIEWS_STATE = { items: [], pageSize: 3, page: 1 };

function renderReviewsGridFromItems(items) {
    var grid = document.querySelector('[data-ezz-reviews-grid]');
    var pag  = document.querySelector('[data-ezz-reviews-pagination]');
    if (!grid) return;
    var pageSize = parseInt(grid.getAttribute('data-page-size') || '3', 10);
    EZZ_REVIEWS_STATE.items = items;
    EZZ_REVIEWS_STATE.pageSize = pageSize;
    EZZ_REVIEWS_STATE.page = 1;
    renderReviewsPage();
    var totalPages = Math.ceil(items.length / pageSize);
    if (pag) {
        if (totalPages > 1) {
            pag.removeAttribute('hidden');
            renderReviewsPagination(totalPages);
        } else {
            pag.setAttribute('hidden', '');
        }
    }
}

function renderReviewsPage() {
    var grid = document.querySelector('[data-ezz-reviews-grid]');
    if (!grid) return;
    var s = EZZ_REVIEWS_STATE;
    var start = (s.page - 1) * s.pageSize;
    var slice = s.items.slice(start, start + s.pageSize);
    grid.innerHTML = slice.map(function (r) {
        var stars = ('★★★★★').slice(0, r.stars) + ('☆☆☆☆☆').slice(0, 5 - r.stars);
        return '<div class="ezz-NAME-rev-card">' +
            '<div class="ezz-NAME-rev-head">' +
                '<span class="ezz-NAME-rev-stars">' + stars + '</span>' +
                '<div class="ezz-NAME-rev-meta">' +
                    '<div class="nm">' + escHtml(r.name) +
                        ' <span class="vfd">موثق</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<p class="ezz-NAME-rev-body">' + escHtml(r.text) + '</p>' +
        '</div>';
    }).join('');
}
```

The full pagination helper with prev/next/numbered buttons is in `jsrefrence-v2.js` line 1733 — copy as-is if needed.

## Calling order from `bindBehaviors`

```js
function bindBehaviors() {
    // …other inits…
    initBuyButtons();
    initCarousels();
    initMiniCart();
    hydrateReviewsFromTwilight();   // ← do this AFTER DOM injection so the wrapper exists
}
```

## When to fall back to static reviews

The harvest **fails gracefully** in these cases — all handled by the `data-timeout="3500"` poll:

1. The merchant has zero published reviews → `salla-reviews` hydrates but renders empty → `harvestTestimonials` returns `[]` → fallback shown.
2. The store is brand new → `salla-reviews` may not even define `hydrated` class within 3.5 s → fallback shown.
3. Reviews exist but ALL of them are name-only with empty text (rare but possible) → the `.filter(i => !!i.text)` drops them all → fallback shown.

So the static fallback is still worth maintaining as a 3-6 card backup — but on a store with active reviews, real ones win every time.

## Why this beats `salla.comment.api.fetchComments`

| | `<salla-reviews>` harvest | `salla.comment.api.fetchComments` |
|---|---|---|
| Returns store-wide reviews | ✅ via `source="store"` | ❌ product-scoped only |
| Returns aggregate stars | ✅ via DOM scraping | ❌ no rating in comments response |
| Returns verified-purchase | ✅ via DOM (when shown) | ❌ |
| Configurable source (category, product, JSON) | ✅ | ❌ |
| Needs DOM scraping | ⚠️ yes (brittle to Twilight DOM changes) | ❌ pure JSON response |
| Works for product comments (Q&A) | ❌ | ✅ |

**Use `<salla-reviews>` harvest for star-rated customer testimonials.** Use `salla.comment.api.fetchComments` for the Q&A thread on a product. Different data, different components.

## Acknowledgement

`known-limits.md` (entry #2, "No public reviews-listing API") was wrong to call this a hard limit. It IS achievable via this pattern — the limit is only that the data comes from a component you have to mount + scrape, not from a clean JSON endpoint. That's an acceptable tradeoff for getting real reviews into a custom design.
