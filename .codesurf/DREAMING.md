# tinyworld — CodeSurf Generated Memory

_Generated 2026-05-25. Do not edit by hand — overwritten on each dreaming run._

---

## Overview

**tinyworld** is a single-file browser app (`tiny-world-builder.html`) — a low-poly infinite-canvas 3D world builder on Three.js r128. No bundler, no npm runtime dependencies. All CSS and JS inline (~29k LoC). Static deploy via `publish.sh` → `dist/`, served by both Vercel (`vercel.json`) and Netlify (`netlify.toml`).

The workspace runs inside **CodeSurf** canvas with an **OpenClaw** agent infrastructure managing scheduled crons and heartbeat polling.

---

## Durable Facts

### App Architecture

- **Single source of truth**: `tiny-world-builder.html` — all code lives here
- **Two parallel data structures**: `world[x][z]` (intent) and `cellMeshes['x,z']` (render) — mutate only via `setCell(x, z, opts)`
- Three.js r128 pinned; materials in `M.*` are shared — clone before mutating color
- `userData.landing` guards drop-in animations; `disposeGroup` skips shared materials
- Grid: 8×8 default, up to 48×48; storage key `tinyworld:v1` schema v4

### Procedural Texture System

- `makeMulberry32(seed)` seeded RNG — stable procedural textures across reloads
- Cottage deterministic canvas textures: `texCottageGrass`, `texCottageWood`, `texCottageGlass`, `texCottageStone`, `texCottageDirt`
- `texturedGrass` defaults **on** (`!== '0'`); UI label: "Cottage grass texture"

### Waterfall Effect (fully reworked — unstaged)

- Flat translucent plane geometry replaced entirely with **pure foam-puff system**: 16 puffs per exposed water edge, lanes `lip / fall / splash`
- Puffs carry full position state (`baseX/Y/Z`, `acrossDrift`, `fallHeight`) and animate with per-tick non-uniform scale pulse
- Single material: `M.waterfallFoamPuff`

### Tower Building Variant (unstaged)

- **`makeVoxelStoneTower(floors, palette)`** — new dedicated voxel factory for `buildingType === 'tower'`; replaces `makeVoxelTurret(..., true)` everywhere towers appear
- **`makeVoxelTurret`** now reserved exclusively for castle turrets
- SKILL.md updated: `makeStoneTower` = normal faceted/conical; `makeVoxelStoneTower` = voxel counterpart; silhouettes should stay aligned

### Stamp Builder UI (unstaged)

- AI/prompt controls fully removed; only "Import build JSON" remains
- Cards clickable to select; `selected` CSS state; `stampBuilderSelectionKey()` tracks selection
- Compact layout: `86px` min col, `104px` min card height, `72×72` thumbnails

### Orbit Camera & Terrain (unstaged)

- `MIN_ORBIT_POLAR = 0.18` / `MAX_ORBIT_POLAR = Math.PI - 0.18` — camera can now go below island
- Terrain gap fix: `positiveTerrainOffset = Math.max(0, terrainOffset)` fed into riser height — prevents exposed side panels on raised terrain

### LandscapeEngine

- **Airfield config injectable** (committed `d77a172`): `_makeAirfieldConfig(airfield)`, pass `false` to disable; all constants data-driven

### Git State

- **2 commits ahead of `origin/main`** — not pushed
- Working tree: unstaged changes in `tiny-world-builder.html`, `tinyworld-lowpoly-stylized-3d/SKILL.md`, `DREAMING.md`
- `cottage.html` (481-line standalone prototype) committed; not integrated
- `context.md` deleted; `.codex/skills/tinyworld-ghost-world-gen` added (unreviewed)

### Adjacent Projects

- **hermes-agent-core-rs**: Python bridge fully removed; 74 tests green; binary smoke-tested
- **grok-cli**: inline-image patch at `/private/tmp`; needs write-capable session
- **openclicky**: features committed; build verification pending
- **SmallHarness → Hermes migration**: plan exists, not executed

### OpenClaw Infrastructure

- **Healthy**: Ava heartbeating; VibeClaw article generator and skills scout on schedule
- **Broken**: MC Gateway (`localhost:19789`) refused; Tom Doerr Tracker (X.com auth needed); DGX image server unreachable

---

## Open Threads

- Unstaged `tiny-world-builder.html` work needs `npm test` + browser QA before committing
- `cottage.html` integration decision pending
- `tinyworld-ghost-world-gen` skill contents unreviewed
- LandscapeEngine browser QA (outlines, cel-shading, fog) backlogged
- MC Gateway root cause uninvestigated
- `grok-cli` patch needs a write-capable session to land
- 2 commits not pushed to `origin/main`
