// Universal carousel engine — infinite loop + drag + autoplay + dots.
//
// One function drives every slider in the landing (gallery, reviews, related
// products, anything). Slides are discovered by class so the same engine
// works for different markup — extend the selector list if you add new types.
//
// Usage: place markup like below in your section builders, then call
//        initCarousels() from bindBehaviors().

// ─── Required markup per slider ──────────────────────────────────────────────
//
// <div data-ezz-carousel data-autoplay="5000" data-loop="1" data-drag="1">
//     <button class="ezz-NAME-c-nav is-prev" data-c-prev>‹</button>
//     <div class="ezz-NAME-c-viewport">
//         <div class="ezz-NAME-c-track" data-c-track>
//             <div class="ezz-NAME-c-slot is-active">
//                 <figure class="ezz-NAME-gal-slide">…slide 1…</figure>
//                 <figure class="ezz-NAME-gal-slide">…slide 2…</figure>
//                 …
//             </div>
//         </div>
//     </div>
//     <button class="ezz-NAME-c-nav is-next" data-c-next>›</button>
//     <div class="ezz-NAME-c-dots" data-c-dots></div>
// </div>
//
// Attributes:
//   data-autoplay  — autoplay interval in ms (omit / "0" = off)
//   data-loop      — "1" for infinite loop, "0" / omit for clamp
//   data-drag      — "1" to enable pointer drag, "0" / omit for click-only

// ─── Required CSS — the flex-basis-collapse fix is critical ──────────────────
//
// .ezz-NAME-c-viewport { width: 100%; min-width: 100%; overflow: hidden; touch-action: pan-y; }
// .ezz-NAME-c-track    { width: 100%; min-width: 100%; }
// .ezz-NAME-c-slot     { display: flex; gap: 16px; will-change: transform;
//                        transition: transform .45s cubic-bezier(.22,.61,.36,1); }
// .ezz-NAME-c-slot.is-active { transition: transform .45s cubic-bezier(.22,.61,.36,1); }
// .ezz-NAME-gal-slide  { flex: 0 0 auto; width: clamp(240px, 32vw, 400px); }
// .ezz-NAME-c-dots     { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
// .ezz-NAME-c-dots button {
//     width: 8px; height: 8px; border-radius: 50%; border: 0;
//     background: rgba(255,255,255,0.3); cursor: pointer; padding: 0;
//     transition: background .2s, transform .2s;
// }
// .ezz-NAME-c-dots button.is-active { background: #fff; transform: scale(1.4); }

// ─── The engine ──────────────────────────────────────────────────────────────

function initCarousels() {
    var roots = document.querySelectorAll('[data-ezz-carousel]');
    roots.forEach(function (root) {
        if (root.__ezzCarouselInited) return;
        root.__ezzCarouselInited = true;
        bindOneCarousel(root);
    });
}

function bindOneCarousel(root) {
    var viewport  = root.querySelector('.ezz-NAME-c-viewport');
    var track     = root.querySelector('[data-c-track]');
    var slot      = track.querySelector('.ezz-NAME-c-slot');
    var prevBtn   = root.querySelector('[data-c-prev]');
    var nextBtn   = root.querySelector('[data-c-next]');
    var dotsHost  = root.querySelector('[data-c-dots]');

    if (!viewport || !track || !slot) return;

    // Slide class polymorphism — add your section's slide class here:
    function slides() {
        return slot.querySelectorAll(
            '.ezz-NAME-gal-slide, .ezz-NAME-rv-slide, .ezz-NAME-card-slide'
        );
    }

    var autoplayMs = parseInt(root.getAttribute('data-autoplay') || '0', 10);
    var canLoop    = root.getAttribute('data-loop') === '1';
    var canDrag    = root.getAttribute('data-drag') === '1';
    var index      = 0;
    var autoplayTimer = null;
    var dragState  = null;

    function slideStep() {
        var s = slides()[0];
        if (!s) return 0;
        var styles = getComputedStyle(slot);
        var gap = parseFloat(styles.gap) || 0;
        return s.getBoundingClientRect().width + gap;
    }

    function visibleCount() {
        var step = slideStep();
        if (!step) return 1;
        return Math.max(1, Math.round(viewport.offsetWidth / step));
    }

    function maxIndex() {
        var total = slides().length;
        var v = visibleCount();
        return Math.max(0, total - v);
    }

    function goto(i, animated) {
        var max = maxIndex();
        if (canLoop) {
            if (i > max) i = 0;
            else if (i < 0) i = max;
        } else {
            i = Math.max(0, Math.min(max, i));
        }
        index = i;
        update(animated !== false);
    }

    function next() { goto(index + 1); }
    function prev() { goto(index - 1); }

    function update(animated) {
        var step = slideStep();
        slot.style.transition = animated === false ? 'none' : '';
        slot.style.transform = 'translateX(' + (-index * step) + 'px)';
        renderDots();
    }

    function renderDots() {
        if (!dotsHost) return;
        var pages = maxIndex() + 1;
        if (dotsHost.children.length !== pages) {
            dotsHost.innerHTML = '';
            for (var i = 0; i < pages; i++) {
                var b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('aria-label', 'Slide ' + (i + 1));
                b.addEventListener('click', (function (j) {
                    return function () {
                        stopAutoplay();
                        goto(j);
                        startAutoplay();
                    };
                })(i));
                dotsHost.appendChild(b);
            }
        }
        Array.prototype.forEach.call(dotsHost.children, function (d, i) {
            d.classList.toggle('is-active', i === index);
        });
    }

    function startAutoplay() {
        stopAutoplay();
        if (!autoplayMs || maxIndex() === 0) return;
        autoplayTimer = setInterval(next, autoplayMs);
    }
    function stopAutoplay() {
        if (autoplayTimer) clearInterval(autoplayTimer);
        autoplayTimer = null;
    }

    // ── Drag ─────────────────────────────────────────────────────────────────
    if (canDrag) {
        viewport.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;  // left-click only
            stopAutoplay();
            var tx = (function () {
                var m = slot.style.transform.match(/translateX\(([-\d.]+)px\)/);
                return m ? parseFloat(m[1]) : 0;
            })();
            dragState = { startX: e.clientX, startTx: tx, step: slideStep() };
            slot.style.transition = 'none';
            try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
        });

        viewport.addEventListener('pointermove', function (e) {
            if (!dragState) return;
            var dx = e.clientX - dragState.startX;
            slot.style.transform = 'translateX(' + (dragState.startTx + dx) + 'px)';
        });

        function endDrag(e) {
            if (!dragState) return;
            var dx = e.clientX - dragState.startX;
            var threshold = dragState.step * 0.18;
            slot.style.transition = '';
            if (Math.abs(dx) > threshold) {
                if (dx > 0) index--;
                else index++;
            }
            goto(index);
            try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
            dragState = null;
            startAutoplay();
        }
        viewport.addEventListener('pointerup', endDrag);
        viewport.addEventListener('pointercancel', endDrag);
    }

    // ── Buttons ──────────────────────────────────────────────────────────────
    if (prevBtn) prevBtn.addEventListener('click', function () { stopAutoplay(); prev(); startAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stopAutoplay(); next(); startAutoplay(); });

    // ── Hover pauses autoplay ────────────────────────────────────────────────
    root.addEventListener('mouseenter', stopAutoplay);
    root.addEventListener('mouseleave', startAutoplay);

    // ── Recalc on resize ─────────────────────────────────────────────────────
    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            goto(Math.min(index, maxIndex()), false);
        }, 120);
    });

    // ── Initial render ───────────────────────────────────────────────────────
    update(false);
    startAutoplay();
}

// ─── Why each piece exists ───────────────────────────────────────────────────
//
// • slideStep / visibleCount         — recomputed each call; survives resize
// • maxIndex                          — clamps so the last page is fully visible
//                                       (clamp mode) or wraps around (loop mode)
// • renderDots paginated by visible   — dots = pages, not slides; matches actual paging
// • setPointerCapture                 — ensures pointermove fires even if user drags
//                                       outside the viewport bounds
// • dragState.step * 0.18 threshold   — 18% of one slide width to commit a swipe;
//                                       smaller = too sensitive, larger = sluggish
// • try/catch around pointer capture  — Safari 14 occasionally throws on capture
// • debounced resize (120ms)          — avoids 60fps re-layout while user drags window
// • __ezzCarouselInited flag          — re-running initCarousels is a no-op
//
// ─── Known pitfalls ──────────────────────────────────────────────────────────
//
// 1. Without explicit width:100%/min-width:100% on .viewport / .track / .slot,
//    flexbox collapses them to fit content and the carousel renders zero-width.
//
// 2. If slides have different widths, slideStep returns the width of the FIRST
//    slide only. Either make all slides equal width OR adjust slideStep to
//    sum widths over the visible range.
//
// 3. Drag-end + click conflict: clicking a slide while dragging shouldn't
//    trigger the click handler. If you bind click handlers on slides, gate
//    them with a "did drag happen?" check using a small dx threshold.
