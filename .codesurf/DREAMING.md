# CodeSurf Workspace Memory — tinyworld

Generated: 2026-05-30

---

## Overview

Tiny World Builder is a single-file (vanilla ES6, no bundler) 3D world editor built on Three.js r128. The app shipped as `tiny-world-builder.html` but has been progressively refactored: the main logic now lives in ~34 numbered engine modules under `engine/world/`, assembled at build time. Total codebase is approximately 38k lines. The project is deployed via Vercel and Netlify from a `dist/` directory produced by `publish.sh`.

---

## Durable Facts

**Architecture**
- Primary file: `tiny-world-builder.html` (~1.4k lines, mostly HTML shell and wiring after the refactor)
- Engine modules: `engine/world/00-prelude.js` through `engine/world/99-late-boot.js` (34 modules, numbered by load order)
- Skills: 18 `.codex/skills/tinyworld-*` SKILL.md files covering every major subsystem; `tinyworld-tool-icons-and-modes` is the newest (added 2026-05-30)
- Extra skills: `tinyworld-ghost-world-gen` and `threejs-primitive-reconstructor` exist in `.codex/skills/` but are not yet listed in AGENTS.md routing table — open thread
- Three.js pinned to r128; bumping is risky (shadow/material color-space changes)

**Data layer contract (never break these)**
- `world[x][z]` — intent: `{ terrain, terrainFloors, kind, floors }`
- `cellMeshes['x,z']` — render: `{ tile: Group, object: Group|null }`
- All mutations must go through `setCell(x, z, opts)` — direct writes to `world[x][z]` desync intent from rendering
- Materials in `M.*` are shared; never mutate in place, clone first
- `userData.landing` guards drop-in animations; never remove these checks

**Build / test**
- `npm test` — static checks
- `npm run build` — generates `dist/`
- `npm run icons` — re-bakes PNG tool icons (must run after adding new tool kinds)
- `publish.sh` — copies `styles/`, `icons/`, and `data/` into `dist/`

**Persistence**
- Runtime state in localStorage; `twSafeSetItem` wraps all writes (surfacing quota errors)
- World save/load via `29-persistence-api.js`; custom voxel stamps embedded in world save payload
- Defaults pipeline: `tinyworld-defaults.json` + `/api/save-defaults`
- URL param `?world=<same-origin-url>` loads a remote world at boot

**House style**
- Semicolons used throughout (follow existing file)
- 2-space indent, trailing commas, single quotes
- Section headers: `// -------- name --------`
- No npm packages, no bundler — single-file constraint is intentional

---

## Active Subsystems and Recent Additions

**Editable Islands (latest major feature — landed 2026-05-30)**
- Islands now render terrain per-cell, matching home island parity (`ensureEditableIslandCellTiles`)
- 8-slot placement workflow: hologram snapping, nearest-slot selection, hover/placement wired through `20-input-place-erase.js`
- Radial menu (`33-radial-menu.js`) recognizes island selections and restricts to move/rotate; rebuilds ring on selection type change
- Mooring cable routing now avoids engine hazards (`MOORING_HAZARD_CLEARANCE`, `avoidMooringHazards`)

**Crowd / vehicle pathfinding (2026-05-30)**
- BFS grid pathfinder added to `11-vehicle-crowd.js` with segment/check/simplify utilities
- Path-biased wander routes: crowds favor road cells, avoid obstacles
- Spawn logic prefers path cells; walkable terrain set expanded

**Engine model system**
- Shared lift-engine system (`buildHomeIslandEngines`) — home and island engines unified
- Engine types: propeller (tinted), rocket (heavy variant), and standard
- Selected engines now reveal the agent panel (`28-generate-panel-agent.js`)

**Storage / asset utilities (2026-05-30)**
- `twToast`, `twSafeSetItem`, `twDownloadJSON`, `twPickJSONFile` added to `00-prelude.js`
- Asset library export/import: `exportAssetLibrary`, `importAssetLibrary`
- Custom voxel-build stamps: `referencedVoxelBuildStamps`, `registerEmbeddedVoxelBuildStamps`

**Layers panel** — `32-layers-panel.js` (clouds kept off build plane)

**Radial menu** — `33-radial-menu.js`, context-sensitive ring rebuilt on selection type change

**Ghost preview** — tile plates no longer cast or receive shadows

**Publish** — `publish.sh` now copies `data/` to `dist/data` for same-origin world JSON

---

## Skill Routing Reference

| Subsystem | Skill |
|---|---|
| Repo workflow / single-file constraints | `tinyworld-single-file` |
| Auto palette inference / cache | `tinyworld-auto-batching` |
| Ghost boards, panning, opacity torch | `tinyworld-opacity-torch` |
| Repeat-click levels, terrain variation | `tinyworld-tile-variation` |
| Selection, freehand draw, clipboard, Stamps nav | `tinyworld-asset-editing` |
| Browser checks, visual QA | `tinyworld-visual-qa` |
| Renderer, shadows, clouds, GPU budget | `tinyworld-render-performance` |
| Settings modal, tabs, accessibility | `tinyworld-settings` |
| WebXR AR/VR | `tinyworld-webxr` |
| 2.5D crowd sprites | `tinyworld-crowd-layer` |
| Low-poly world prompting | `tinyworld-lowpoly-world-prompt` |
| Low-poly asset design / import | `tinyworld-lowpoly-stylized-3d` |
| API, webhook, SSE, MCP, plugin | `tinyworld-integrations` |
| localStorage, defaults, audio, camera | `tinyworld-runtime-state` |
| Home island, sponsor banner, planes | `tinyworld-island-and-planes` |
| Tool icons (PNG bake), ghost billboard, mode indicator | `tinyworld-tool-icons-and-modes` |

Skills not yet in AGENTS.md routing table (may need wiring):
- `tinyworld-ghost-world-gen`
- `threejs-primitive-reconstructor`

---

## Open Threads

- Two skills (`tinyworld-ghost-world-gen`, `threejs-primitive-reconstructor`) exist on disk but are absent from the AGENTS.md skill routing table
- `fork-improvements-report.md` added 2026-05-30 — documents fork findings and recommended lifts; review pending
- OpenClaw cron runs (VibeClaw Article Generator, Wallpaper Generator, Skills Scout) are failing repeatedly — platform-level instability in OpenClaw cron execution
- OpenClaw `mc-gateway` session has repeated assistant turn failures; lead-agent heartbeat (Ava, board `c3f78d0c`) remains healthy
- Tom Doerr tweet tracker blocked by X.com login wall; Nitter fallback also unavailable
- `split-god-file.js` workflow in `.claude/workflows/` — purpose/status not confirmed in recent sessions

---

## Memory Notes

- No emoji anywhere — user strictly prohibits emoji in UI, code, and output
- Do not rebuild existing components; reuse as-is
- Verify UI/interaction behavior via 3D math (positions, bbox, ray math) — not browser screenshots or synthetic clicks
