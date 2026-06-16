# Asset Hosting for Landing-Page Custom JS

Where to host images, videos, and posters when the IIFE is self-contained.

## TL;DR

| Asset type | Host | Why |
|---|---|---|
| Photos (jpg/png/webp) | **imgbb** | Free, unlimited bandwidth, 32 MB/file, simple REST upload |
| Videos (mp4) | **custom.makaseb.tools/ezz-…/** | Your own CDN — no caching issues, no size cap |
| Posters (jpg/png/webp) | imgbb | Same as photos |
| Theme assets (logos, etc.) | Salla CDN via `salla.url.cdn(path)` | Already-uploaded merchant assets |

**Never use** for landing assets:

- ❌ **jsDelivr / GitHub raw** — 50 MB repo cap, aggressive CDN caching that fights iteration
- ❌ **i.imgur** — anti-hotlinking, can disable images without warning
- ❌ **Cloudinary free tier** — bandwidth cap surprises mid-month
- ❌ **Direct Salla CDN upload via admin** for landing-only assets — clutters the merchant's media library

## Convert to WebP first

Always transcode PNG/JPG → WebP at quality 82 before uploading. Saves ~50-70% size at visually identical quality.

The Python uploader (`custom-code-landing/scripts/convert-and-upload-mehwar2.py`) does this in one pass:

```python
from PIL import Image

def convert_to_webp(src, out):
    img = Image.open(src)
    if img.width > 2400:                  # web doesn't need bigger
        ratio = 2400 / img.width
        img = img.resize((2400, int(img.height * ratio)), Image.LANCZOS)
    if img.mode == "RGBA":
        img.save(out, "WEBP", quality=82, method=5)
    else:
        img.convert("RGB").save(out, "WEBP", quality=82, method=5)
```

`method=5` is the middle ground — slightly slower encode for noticeably smaller files. Don't bother with `method=6` (negligible improvement, much slower).

## imgbb upload — the working recipe

API key lives in `tw-ezz2part/.env` (gitignored):

```ini
IMGBB_API_KEY=f5f38193baac89ad36dd347563d1f882
```

Upload via REST. Returns a permanent URL:

```python
import base64, json, urllib.request, urllib.parse

def upload_imgbb(api_key, file_path):
    with open(file_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    data = urllib.parse.urlencode({"key": api_key, "image": b64}).encode("ascii")
    req = urllib.request.Request(
        "https://api.imgbb.com/1/upload",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read().decode("utf-8"))
    if j.get("data", {}).get("url"):
        return j["data"]["url"]   # → 'https://i.ibb.co/HASH/filename.webp'
    raise RuntimeError("Upload failed: " + json.dumps(j))
```

Node equivalent in `custom-code-landing/scripts/upload-to-imgbb.cjs` uses the same endpoint.

## URL manifest pattern — resumable uploads

Write each upload result to a JSON manifest BEFORE moving on. Lets you resume if the script dies mid-batch and avoids re-uploading already-done files:

```python
out = {}
if URLS_PATH.exists():
    out = json.loads(URLS_PATH.read_text(encoding="utf-8"))

for src in sources:
    if out.get(src["key"]):
        print(f"skip cached {src['key']}: {out[src['key']]}")
        continue
    url = upload_imgbb(api_key, src["path"])
    out[src["key"]] = url
    URLS_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
```

Naming convention for manifest files in `custom-code-landing/scripts/`:

- `imgbb-urls.json` — generic upload run
- `mehwar2-urls-webp.json` — initial batch for mehwar2
- `mehwar2-urls-extra.json` — supplementary assets discovered later
- `mehwar2-urls-iter6.json` — iteration-6 additions

Append iterations to new files rather than mutating earlier ones — gives a clean per-iteration audit trail.

## Video hosting — custom CDN

`.mp4` files go to `custom.makaseb.tools/ezz-<landing-name>/` via SFTP / SCP (existing CDN, no API).

**Why not jsDelivr / GitHub raw / Vimeo / YouTube:**

- **jsDelivr**: 50 MB repo cap kills HD videos. Aggressive 7-day cache breaks design iteration.
- **GitHub raw**: throttles, no CDN, `Content-Type: text/plain` on some servers.
- **Vimeo / YouTube**: third-party iframe overhead + privacy banners + can't autoplay reliably on iOS.
- **Custom CDN**: full control, no cache wars, plays inline, supports byte-range requests for video scrubbing.

## .m4v → .mp4 rename

Android browsers reject `.m4v` MIME (`video/x-m4v`) by default — silent failure. Rename to `.mp4` before upload, even though the container format is identical:

```bash
mv Nots-22.m4v Nots-22.mp4
```

No transcoding needed.

## Responsive picture — `<picture media>` not `srcset`

For desktop-vs-mobile, the two crops are usually intentionally different aspect ratios (square mobile, 16:9 desktop). Plain `srcset` with `w` descriptors can't switch crops based on viewport — it picks resolution within ONE source. Use `<picture>` with `<source media>` instead:

```html
<picture>
    <source media="(min-width: 768px)" srcset="https://i.ibb.co/.../desktop.webp">
    <img src="https://i.ibb.co/.../mobile.webp" alt="…" loading="lazy" decoding="async">
</picture>
```

Our `pic(asset, alt, cls, opts)` helper in `helpers.js` emits exactly this when given `{desktop, mobile}`.

## Poster swap for videos

Videos take ONE `<video poster>` per element, but the desired poster on mobile (square crop) differs from desktop (landscape crop). At boot time, swap the poster based on `matchMedia`:

```js
function applyResponsivePosters() {
    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    document.querySelectorAll('[data-poster-desktop][data-poster-mobile]').forEach(function (v) {
        v.setAttribute('poster', isMobile ? v.dataset.posterMobile : v.dataset.posterDesktop);
    });
}
// Call from runMainScript AND on window resize (debounced).
```

In markup:

```html
<video data-poster-desktop="https://i.ibb.co/.../desktop-poster.webp"
       data-poster-mobile="https://i.ibb.co/.../mobile-poster.webp"
       muted loop playsinline preload="metadata">
    <source src="https://custom.makaseb.tools/.../film.mp4" type="video/mp4">
</video>
```

## CSS gotcha: `background-image: url(…)` with quotes

```js
// BAD — JSON.stringify(url) adds outer quotes that conflict with the style attr's quotes:
'<div style="background-image: url(' + JSON.stringify(url) + ');">'
// → style="background-image: url("https://...webp");"   ← BROKEN HTML

// GOOD — escAttr handles all quoting safely:
'<div style="background-image: url(' + escAttr(url) + ');">'
```

This bit us in iteration 5 of mehwar2 — be careful.

## Manifest reading pattern in the IIFE

In production we hard-code asset URLs into the `ASSETS` map at the top of the IIFE:

```js
var ASSETS = {
    heroDesktop:    'https://i.ibb.co/KzpDHTHB/63d8ab4a89c0.webp',
    heroMobile:     'https://i.ibb.co/mC69B0wh/d78a237d039e.webp',
    galleryVideos: [
        { mp4: 'https://custom.makaseb.tools/.../01.mp4',
          poster: 'https://i.ibb.co/.../01-poster.webp' },
        // …
    ],
    // …
};
```

Manually copy from the latest `scripts/*-urls-*.json` after each upload run. We don't read the JSON at runtime — the IIFE is self-contained and the URLs are public/permanent.

## Cache busting

imgbb URLs include a hash in the path (`/KzpDHTHB/63d8ab4a89c0.webp`), so re-uploading the same image gets a NEW URL. The old URL stays valid forever. Effectively self-busting — just paste the new URL into `ASSETS` and re-build the paste.

For videos on your own CDN, append `?v=<timestamp>` to bust the CDN cache after re-upload:

```js
filmVideo: 'https://custom.makaseb.tools/ezz-mehwar2/film.mp4?v=2026061601'
```

## Size budget

| Asset class | Cap per file | Why |
|---|---|---|
| Hero / above-fold image | ≤ 250 KB (WebP) | First contentful paint |
| In-page image | ≤ 200 KB (WebP) | Lazy-loaded but still counted toward page weight |
| Poster (video) | ≤ 60 KB (WebP) | Loads immediately with the video element |
| Video (vertical 9:16 short) | ≤ 4 MB (mp4, ~10s) | Mobile data sensitivity |
| Video (landscape 16:9 hero) | ≤ 6 MB (mp4, ~15s) | Desktop tolerance is higher but still budget |

The PIL converter caps width at 2400px — anything larger gets resized. Don't go bigger; modern displays at 2x DPR top out around 1440×2 = 2880 logical pixels for the widest viewport, and you'll never serve that to the whole image.
