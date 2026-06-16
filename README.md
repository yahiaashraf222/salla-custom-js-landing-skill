# salla-custom-js-landing

A [Claude Code Skill](https://docs.claude.com/en/docs/claude-code/skills) that teaches an agent how to build, debug, and ship **self-contained custom-JS landing pages** for the [Salla](https://salla.sa) e-commerce platform.

It is the codified, production-tested playbook from shipping two such landings:
- `jsrefrence-mehwar2.js` — the cinematic editorial PDP for [Ezz Oud / "هيرش محور"](https://alezz-oud.com/ar/هيرش-محور/p1004099572)
- `jsrefrence-v2.js` — the v2 landing on the same storefront

Both are pasted into Salla page-builder's Custom HTML block and take over the live storefront page without forking the theme.

## What's in the box

```
salla-custom-js-landing/
├── SKILL.md                          ← main entry, when-to-use, cheat sheet, IIFE skeleton
└── references/
    ├── activator-pattern.md           ← <salla-html-content> innerHTML workaround + build-paste template
    ├── boot-and-init.md               ← URL_GATE + 3-layer idempotency + 5-redundancy init triggers
    ├── helpers.js                     ← copy-paste escHtml/escAttr/pic/injectStyles/log/waitForTarget
    ├── salla-sdk-cookbook.md          ← every salla.* call we use in production
    ├── native-components.md           ← <salla-*> web component catalog with priority tiers
    ├── carousel.js                    ← universal carousel (infinite + drag + autoplay + dots)
    ├── mini-cart.md                   ← floating cart wired to salla.cart.event.*
    ├── asset-hosting.md               ← imgbb + custom CDN + WebP rules, and why jsDelivr is banned
    ├── testing-protocol.md            ← Playwright iteration loop + verification scripts
    └── known-limits.md                ← 15 production gotchas with reproductions + workarounds
```

## What it teaches an agent to do

When a user says **"build me a Salla landing page custom JS"** or **"fix this jsrefrence script"**, the skill makes the agent know:

1. **How to make scripts actually execute** inside `<salla-html-content>` (which silently inerts `<script>` tags via `innerHTML`).
2. **How to URL-gate** the script so it's safe to install theme-global.
3. **How to wait for Salla** — five different ready signals, exactly-one-fires logic.
4. **How to use native `<salla-add-product-button>`** instead of hand-rolling ATC (and inherit variants/stock/login/installment/sticky-bar sync for free).
5. **How to wire a live mini-cart** via `salla.cart.event.*` subscriptions.
6. **Where to host images & videos** (imgbb for images, custom CDN for videos — never jsDelivr for videos).
7. **The 15 limits we already hit** (no reviews-listing API, `.m4v` MIME on Android, `aspect-ratio` parent breaking child `height: 100%`, etc.) and the working workaround for each.
8. **How to test on the live storefront** via Playwright with a clean cleanup-and-reinject loop.

## Installation

### As a Claude Code user

Clone into your global skills directory:

```sh
mkdir -p ~/.claude/skills
cd ~/.claude/skills
git clone https://github.com/yahiaashraf222/salla-custom-js-landing-skill.git salla-custom-js-landing
```

Claude Code auto-discovers any subdirectory with a `SKILL.md` frontmatter block and registers it on next launch.

### As a project-scoped skill

If you only want it for one project, drop it under that project's `.claude/skills/` instead:

```sh
mkdir -p .claude/skills
cd .claude/skills
git clone https://github.com/yahiaashraf222/salla-custom-js-landing-skill.git salla-custom-js-landing
```

## When the skill triggers

The agent loads it automatically when the user mentions:

- "custom landing page" / "custom PDP" for Salla
- "jsrefrence" / "ezz-mehwar2" / "ezz-landing-paste" / "paste-once"
- `<salla-html-content>` / "Custom HTML block" / "page-builder Custom JS"
- "self-contained IIFE for Salla"

Or you can force-load it explicitly: `/skill salla-custom-js-landing`.

## What this skill is NOT

- ❌ A guide to building reusable **Twilight Bundle components** (those are Lit + Vite per-component, different deliverable — they live in a separate repo per project).
- ❌ A Salla theme tutorial.
- ❌ A Salla App development guide.
- ❌ A Salla Merchant API reference (for those, mirror the official docs at https://docs.salla.dev).

This skill is **specifically** for the pattern of "I want to drop a self-contained chunk of JS into Salla's page-builder Custom HTML/JS slot and have it render a bespoke UI on a specific URL, on top of the existing storefront."

## Battle-tested patterns

Every snippet, every workaround, every CSS rule in this skill came from actually shipping in production. Several came from debugging sessions that cost hours we don't want anyone else to spend:

- The activator+payload pattern (problem first observed at commit `c91a230`, fix proven via live Playwright)
- The 5-redundancy init trigger (after 3 separate "why didn't my IIFE boot on this theme?" incidents)
- The `aspect-ratio` parent / child `height: 100%` propagation break (iteration 5 of mehwar2)
- The 15-entry `known-limits.md` is what an agent skips re-learning by using this skill

## Contributing

Open an issue with a specific Salla quirk + reproduction. New patterns (additional native components, new helpers, alternative paste mechanisms) welcome via PR. Don't add patterns from "I read somewhere that …" — only from "I personally shipped this and it works on the live storefront."

## License

[MIT](./LICENSE)
