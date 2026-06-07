The file looks clean and accurate. Here is the full replacement content for `.codesurf/DREAMING.md`:

---

# CodeSurf Workspace Memory — tinyworld

Generated: 2026-06-07

---

## Overview

Tiny World Builder is a vanilla ES6, no-bundler 3D world editor built on Three.js r128. The app shell lives in `tiny-world-builder.html` (~1.4k lines); business logic is split across 47 `.js` modules under `engine/world/` (00–44 + 09b + 99-late-boot.js) plus one companion ES module (`flight-combat-math.mjs`), plus `engine/landscape/`. Total JS is ~40k+ lines. Deployed via Vercel and Netlify from `dist/` produced by `publish.sh`.

---

## Durable Facts

**Architecture**
- Primary file: `tiny-world-builder.html` — HTML shell, boot config, ordered `<script src>` tags only; styles in `styles/tiny-world.css` (~5.2k lines)
- Engine modules: 47 `.js` files (00–44 + 09b + 99-late-boot.js) + `flight-combat-math.mjs` (ES module companion, not a classic script); all `.js` modules share one global scope
- Duplicate top-level identifiers silently kill the declaring module without affecting others; prefix module-local scratch globals (e.g. `_fl…` for flight)
- Three.js pinned to r128; materials in `M.*` are shared — clone before mutating color
- `disposeGroup(group)` disposes geometries but not materials (they are shared); per-particle smoke clones its material and disposes on death
- `setCell(x, z, opts)` is the only sanctioned way to mutate world state; never write `world[x][z]` directly outside init
- No bundler, no npm runtime dependencies; `npm test` for static checks, `npm run build` for dist

**Module reference (higher-numbered / newer modules)**
- `34-flight-sim.js` — flyable plane via existing `stunt-plane` model-stamp; placed via Stamps, not a bespoke tool; click-to-Enter/Fly, rear chase-cam, Escape exits; `flight-combat-math.mjs` is its companion ES module
- `38-multiplayer-partykit.js` — multiplayer via PartyKit
- `39-atmosphere-effects.js` — atmosphere/day-night effects; time-progression not yet wired to any UI
- `40-shield-system.js` — shield system
- `41-flight-combat.js` — flight combat system
- `42-account-wallet-players.js` — account/JWT/cloud-save (subscription system fully removed 2026-05-31)
- `43-drag-drop-import.js` — GLB/model drag-drop import pipeline; captures `.mtl` + texture sidecars on drop
- `44-sub-object-edit.js` — part-level selection, hover hulls, transform delegation for voxel objects

**Wallet / cloud-save**
- Subscription tiers, upgrade prompts, paywall gate, premium flags, and `SUBSCRIPTION_TIER` global removed (2026-05-31)
- Only neutral JWT save/load and anonymous fallback remain; wallet status text is "Account cloud unavailable"

**Island side faces / strata**
- `13-distant-dressing-ghost.js` — `M.boardSideEdge` on all four full-height side faces
- `textures/island-side-strata-gpt.png` (1024×192) loaded as `CanvasTexture` with shadow-lift processing and shader clamp

**Island warp-in arrival (ccf8a49)**
- `startEditableIslandWarpArrival` / `tickEditableIslandWarpArrivals` in `14-editable-islands-moorings.js`
- Blue/white streak → ring/flash → overshoot → settle; runs after LOD updates; skipped when `skipSave` set

**Default world (a8ce7f9)**
- `default_island.json` is the default world on fresh session and Reset; procedural fallback if file is missing

**Cloud sea render order (verified 2026-06-02)**
- `31-cloud-sea.js` — `renderOrder = 18`, depth test on; enforced by `tools/check.js` guard; do not revert

**Terrain adjacency**
- Stone and path share one `sameTerrainEdgeFamily`; no border bricks/risers between adjacent stone/path cells

---

## Shipped Features

**Voxel window interior-mapping glass (2026-06-06, PRs #24–#29)**
- `M.windowInterior` in `03-geometry-materials.js` — `ShaderMaterial` on unit `PlaneGeometry`; pane faces +z, callers scale to opening size
- Shader raycasts a virtual room box for parallax interior; correct under perspective and ortho
- Per-pane uniforms: `uTint`, `uDark`, `uBright`, `uReflect`, `uInteriorBright`, `uLit`
- Global config: `window.__tinyworldWindow`; per-build override: `setActiveWindowOverride` / `_activeWindowOverride`
- `windowGlassRatio(override)` computes glass/frame ratio
- Settings → Materials → "Building windows"; per-object inspector controls; interior panes excluded from batcher
- Window frame occlusion and steep-angle ortho interior fix landed (f307e05)

**Model stamp import formats**
- `glb` / `gltf` — primary, PBR→Lambert adaptation
- `fbx` — `vendor/three/FBXLoader.r128.js` (3876 lines), same pipeline
- `vox` — MagicaVoxel via `THREE.VOXLoader` + `THREE.VOXMesh`; placement crash fixed
- `obj` — rainbow fallback for untextured; `.mtl` + texture sidecar capture on drop
- `vdb` — `vendor/three/VDBLoader.r128.js`; `vdbGridSpec()` + `vdbToMesh()` in `09-model-stamp-loader.js`; z-up → y-up; frame sequence auto-detection via `vdbSequenceKey()`; `userData.modelStampHydrated = 'vdb'`

---

## Workflow Notes

- **Completion convention (2026-06-07):** Default to a short natural-language sentence plus any verification result. Use the structured CHANGES MADE / DIDN'T TOUCH / CONCERNS card only for substantial work: multi-file changes, long-running tasks, risky edits, migrations, debugging sessions, or anything needing a durable handoff.

---

## Open Threads

- AGENTS.md skill routing is stale — modules 38–44 and `34-flight-sim.js` have no routing entries in `.codex/skills/`
- `tinyworld-ghost-world-gen` and `threejs-primitive-reconstructor` skills exist on disk but are not listed in AGENTS.md routing
- Four liftable fork items remain unapplied: schema validation, URL param world loading, minimap touch-action, `publish.sh` data copy
- `39-atmosphere-effects.js` — day-night time-progression not wired to any UI control
- Window interior system (PRs #24–#29) has no corresponding `.codex/skills/` entry yet
