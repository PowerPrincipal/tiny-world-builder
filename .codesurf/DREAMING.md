# CodeSurf Workspace Memory — tinyworld

Generated: 2026-06-03

---

## Overview

Tiny World Builder is a vanilla ES6, no-bundler 3D world editor built on Three.js r128. The app shell lives in `tiny-world-builder.html` (~1.4k lines); business logic is split across 44 ordered modules under `engine/world/` (00–41 + 09b + 99-late-boot.js), plus `engine/landscape/`. Total JS is approximately 40k+ lines. Deployed via Vercel and Netlify from `dist/` produced by `publish.sh`.

---

## Durable Facts

**Architecture**
- Primary file: `tiny-world-builder.html` — HTML shell, boot config, and ordered `<script src>` tags only
- Engine modules: 44 files total (00–41 + 09b + 99-late-boot.js), loaded in strict numeric order
- Notable late additions: `38-multiplayer-partykit.js`, `39-atmosphere-effects.js`, `40-shield-system.js`, `41-flight-combat.js` + `flight-combat-math.mjs` (ES module, not classic script)
- Skills on disk: 20 `.codex/skills/` directories — 19 `tinyworld-*` plus `threejs-primitive-reconstructor`; `threejs-primitive-reconstructor` and `tinyworld-ghost-world-gen` are on disk but absent from AGENTS.md routing
- Three.js pinned to r128; all engine modules share one global scope — duplicate top-level identifiers silently kill the declaring module

**Wallet / cloud-save (subscription system removed 2026-05-31)**
- Subscription tiers, upgrade prompts, paywall gate, premium flags, and `SUBSCRIPTION_TIER` global are all gone from `21-wallet.js`, `23-settings.js`, and `00-prelude.js`
- Only neutral JWT save/load and anonymous fallback remain
- Wallet status text is now "Account cloud unavailable" (never "Local DB offline")

**Island side faces (fixed 2026-06-02/03)**
- `13-distant-dressing-ghost.js` — `M.boardSideEdge` directly on all four full-height side faces; thin overlay-strip approach is gone
- `04-textures.js` — `boardSideEdge` whitelisted as an explicit material name
- Live probe: height=11 on all four faces, `brownSideFaces: 0`, console clean

**Cloud sea render order (verified 2026-06-02)**
- `31-cloud-sea.js` — `renderOrder = 18` (late), depth test on; `tools/check.js` guard enforces this; do not revert

---

## Open Threads

- Four unrouted subsystems need skills and AGENTS.md entries: multiplayer (38), atmosphere effects (39), shield system (40), flight combat (41)
- `tinyworld-ghost-world-gen` and `threejs-primitive-reconstructor` skills on disk but not routed in AGENTS.md — wire or remove
- `fork-improvements-report.md` at repo root — eight improvement areas; action status unknown
- `.claude/workflows/split-god-file.js` — purpose/status unconfirmed
- Blast door concept — waiting on user mockup; no code yet

---

## Recent Session Notes (2026-06-03)

- Island side-face shader fully fixed and live-verified
- Cloud sea render order regression fixed; Netlify build green
- Wallet/subscription/premium system fully removed (2026-05-31); neutral cloud-save preserved
- Flight combat module shipped (2026-05-31): guns, targeting HUD, lock-on missiles, MAX_HEALTH=100
