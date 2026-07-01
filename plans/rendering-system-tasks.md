# Rendering system task list

Source: high-level rendering review, 3D-modeling guidance, and `.codex/skills/tinyworld-render-performance`.

## Phase 1 — Guardrails and docs

- [x] Document render-layer ownership: parent group, culling, shadows, disposal, picking.
- [x] Add a shared disposal path for explicitly owned per-instance materials/textures.
- [x] Add a lightweight static/report check for fresh geometry constructors in hot render factories (`node tools/render-audit.mjs`).
- [ ] Add a model-stamp import diagnostics overlay/report for triangle count, mesh count, material count, texture count, bounds, and animations.

## Phase 2 — Terrain and batching

- [ ] Chunk the settled home-terrain bake so large boards do not block the main thread.
- [ ] Make terrain bake default-on after chunking, while preserving unbake-on-edit.
- [ ] Audit repeated authored voxel/object factories and route remaining obvious repeats through cached geometry or local instancing.
- [ ] Verify every merged/instanced render system computes correct bounding boxes/spheres.

## Phase 3 — Shadows, imports, and LOD

- [ ] Formalize decorative systems as non-shadowing by default.
- [ ] Add heavy model-stamp warnings/LOD policy for expensive GLBs.
- [ ] Add optional simplified/non-shadowing shadow proxy behavior for heavy imported stamps.
- [ ] Re-run stats on blank, dense, ghost-preview, LandscapeEngine, and Tinyverse scenes.

## Current implementation notes

- Started with low-risk guardrails first: documentation and explicit owned-resource disposal.
- Added `tools/render-audit.mjs` to report direct `new THREE.*Geometry(...)` usage and flag hot factory candidates.
- Converted the rock/bridge hot path in `06-history-object-factories.js` to cached geometry helpers.
- Added cached cone/plane/torus geometry helpers in `03-geometry-materials.js` for future cleanup passes.
- Terrain-bake defaulting is intentionally deferred until the merge path is chunked; the existing synchronous path can warn above 50ms.
