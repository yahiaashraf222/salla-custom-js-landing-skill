// Copy-paste utility helpers for a Salla custom-JS landing IIFE.
// All helpers are pure (no external dependencies) and safe to copy verbatim
// into any new jsrefrence-NAME.js file.
//
// Tested in production: jsrefrence-mehwar2.js (1457 LOC) and jsrefrence-v2.js.

// ─────────────────────────────────────────────────────────────────────────────
// escHtml / escAttr — XSS-safe templating
// ─────────────────────────────────────────────────────────────────────────────
// Use escHtml for text content. Use escAttr for attribute values.
// Order matters: & must be escaped FIRST or other escapes get double-escaped.
function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escAttr(s) { return escHtml(s); }

// Usage:
//   '<p>' + escHtml(userReview.body) + '</p>'
//   '<img alt="' + escAttr(productName) + '">'
//   '<input value="' + escAttr(userInput) + '">'
//
// DO NOT use these for inline <script> contexts — only HTML/attr contexts.
// DO NOT use JSON.stringify(url) for inline style attrs — use escAttr.

// ─────────────────────────────────────────────────────────────────────────────
// pic(asset, alt, className, opts) — responsive <picture> element
// ─────────────────────────────────────────────────────────────────────────────
// Renders one of:
//   - plain <img> if asset is a string
//   - <picture> with desktop/mobile <source media> if asset is {desktop, mobile}
//
// Mobile breakpoint is 768px. opts.eager = true removes lazy-loading
// (use for above-the-fold hero images).
function pic(asset, alt, className, opts) {
    opts = opts || {};
    var cls = className ? ' class="' + escAttr(className) + '"' : '';
    var loading = opts.eager ? '' : ' loading="lazy" decoding="async"';

    if (typeof asset === 'string') {
        return '<img src="' + escAttr(asset) + '" alt="' + escAttr(alt || '') + '"' + cls + loading + '>';
    }

    if (asset && asset.desktop && asset.mobile) {
        return '<picture>' +
                   '<source media="(min-width: 768px)" srcset="' + escAttr(asset.desktop) + '">' +
                   '<img src="' + escAttr(asset.mobile) + '" alt="' + escAttr(alt || '') + '"' + cls + loading + '>' +
               '</picture>';
    }

    return '<img src="" alt="' + escAttr(alt || '') + '"' + cls + loading + '>';
}

// Usage:
//   pic('https://i.ibb.co/.../photo.webp', 'Product photo', 'ezz-m2-photo')
//   pic({ desktop: '…/desktop.webp', mobile: '…/mobile.webp' }, 'Hero', 'ezz-m2-hero-img', { eager: true })

// ─────────────────────────────────────────────────────────────────────────────
// injectStyles(css) — idempotent single-style-tag injection
// ─────────────────────────────────────────────────────────────────────────────
// Accepts a string OR an array of strings (array.join('\n')).
// Short-circuits if the style tag is already present (matched by marker attr).
// Always replace NAME with your prefix.
function injectStyles(css) {
    if (document.querySelector('style[data-ezz-NAME-style="1"]')) return;
    var body = Array.isArray(css) ? css.join('\n') : (css || '');
    if (!body) return;
    var tag = document.createElement('style');
    tag.setAttribute('data-ezz-NAME-style', '1');
    tag.textContent = body;
    document.head.appendChild(tag);
}

// Usage:
//   var STYLES = ['.ezz-NAME-root { color: black; }', '.ezz-NAME-hero { … }'];
//   injectStyles(STYLES);
//
// Always use textContent, never innerHTML — CSS is plain text and innerHTML
// triggers the HTML parser unnecessarily.

// ─────────────────────────────────────────────────────────────────────────────
// log(stage, extra) — debug breadcrumbs
// ─────────────────────────────────────────────────────────────────────────────
// Push every interesting transition to window.EZZ_NAME_DEBUG.events.
// First thing to inspect when something's broken in production.
var EZZ_DEBUG = window.EZZ_NAME_DEBUG = { events: [] };
function log(stage, extra) {
    EZZ_DEBUG.events.push({
        stage: stage,
        t: Date.now(),
        extra: extra || null
    });
}

// In the live console:
//   window.EZZ_NAME_DEBUG.events
// → [{ stage: 'init-trigger', extra: { via: 'Salla.onReady' }, t: 1712345678 }, …]

// ─────────────────────────────────────────────────────────────────────────────
// waitForTarget(callback) — wait for the host DOM element
// ─────────────────────────────────────────────────────────────────────────────
// Looks for <main> first (primary target on product pages).
// Falls back via MutationObserver, with a 10s cap then last-resort fallback.
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

// ─────────────────────────────────────────────────────────────────────────────
// deepMerge(target, source) — config override merge
// ─────────────────────────────────────────────────────────────────────────────
// Lets users set window.EZZ_NAME_CONFIG = { product: { id: '999' } } to
// override specific defaults without specifying the whole tree.
function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    var out = {};
    var k;
    for (k in target) out[k] = target[k];
    for (k in source) {
        if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k]) &&
            target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
            out[k] = deepMerge(target[k], source[k]);
        } else {
            out[k] = source[k];
        }
    }
    return out;
}

// Usage:
//   var DEFAULTS = { product: { id: '1004099572', price: 250 }, hero: { … } };
//   var CFG = deepMerge(DEFAULTS, window.EZZ_NAME_CONFIG || {});

// ─────────────────────────────────────────────────────────────────────────────
// fmt(amount) — currency formatter
// ─────────────────────────────────────────────────────────────────────────────
// Prefer salla.money(amount) when SDK is ready — it respects the merchant's
// currency. Use this as a fallback for pre-init contexts.
function fmt(n) {
    if (n == null || isNaN(n)) return '0.00';
    return Number(n).toFixed(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// onSallaReady(callback) — single-call ready wrapper
// ─────────────────────────────────────────────────────────────────────────────
// Use this in code paths that touch window.salla.* but are not the IIFE
// boot path (e.g., a button click handler that fires before SDK readiness).
function onSallaReady(callback) {
    if (typeof window === 'undefined') return;
    var w = window;
    if (w.app && w.app.status === 'ready') {
        callback();
    } else if (w.Salla && typeof w.Salla.onReady === 'function') {
        w.Salla.onReady(callback);
    } else {
        document.addEventListener('theme::ready', callback, { once: true });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG icons — inline (no external requests, no font icons)
// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG is faster than loading icon fonts AND respects currentColor for
// theming. Keep each icon to a single function returning a string.

function starSvg(filled) {
    var fill = filled ? 'currentColor' : 'none';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + fill +
           '" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
           '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
           '</svg>';
}

function starsRow(n) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += starSvg(i <= n);
    return '<span class="ezz-NAME-stars" aria-label="' + n + ' out of 5 stars">' + out + '</span>';
}

function playSvg() {
    return '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
           '<circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.55)"/>' +
           '<path d="M19 16l14 8-14 8V16z" fill="#fff"/>' +
           '</svg>';
}

function chevronSvg(dir) {
    // dir: 'left' | 'right'
    var d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           '<path d="' + d + '"/></svg>';
}

function iconBag() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.5" aria-hidden="true">' +
           '<path d="M5 7h14l-1 13H6L5 7zM9 7V5a3 3 0 016 0v2"/></svg>';
}
