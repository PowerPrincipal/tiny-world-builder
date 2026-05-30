# tinyworld-flight-sim

Flyable plane flight, ported from the standalone `ships/flight-sim3.html` arcade
model. **The plane is NOT a bespoke tool or object kind** — it is the existing
crop-duster / stunt-plane that the codebase already ships as a **model-stamp**
(`models/stunt_plane.glb`, stamp id `stunt-plane`, label "Stunt Plane"), placed
through the **Stamps** system. The placed cell is therefore
`kind: 'model-stamp'` with `appearance.modelStampId === 'stunt-plane'`.

Do not reintroduce a separate `plane` tool/kind — that was a wrong turn. Flight
attaches to whatever model-stamp the player already placed, detected by signature.

## Where it lives
- `engine/world/34-flight-sim.js` — the whole system: trimmed physics, chase cam,
  `enterFlight`/`exitFlight`, `tickFlight`, HUD, Enter/Fly menu, key capture, and
  `isFlyableStampCell(cell)` (the detector). Loaded between `33-radial-menu.js`
  and `99-late-boot.js`.
- `isFlyableStampCell(cell)` returns true when `cell.kind === 'model-stamp'` and
  the resolved `getModelStamp(appearance.modelStampId)` signature matches
  `/plane|aircraft|airplane|stunt|crop-?duster|jet/`. Exposed as
  `window.isFlyableStampCell`.
- Wiring hooks:
  - `20-input-place-erase.js` — `applyTool` gains `if (window.__flightActive) return;`.
    In the `pointerup` click-resolution block, a **plain (unmodified) click on a
    flyable stamp opens the Enter/Fly menu regardless of the active tool** (you
    still erase it with the eraser). This runs BEFORE the place/select branches so
    a click never stacks/replaces the plane. NOTE: a plain Select click resolves
    here, NOT in `applyTool` (`applyTool` is only reached by non-select tools).
  - `25-animation-loop-schema.js` — `if (window.tickFlight) window.tickFlight(dt);`
    right before `renderScene()`.
  - `styles/tiny-world.css` — `.flight-hud`, `.flight-menu`, `.flight-menu-btn`,
    `body.flight-active`.

## The scale trick (do not "fix" this)
The ships model is tuned for a kilometre-scale world (cruise ~77 m/s). Physics
runs untouched in **sim space**; the flown object (the placed stamp group) position
is mapped into the scene via a single **similarity transform**:
`scenePos = sceneOrigin + yawQuat * ((simPos - simOrigin) * FLIGHT_SIM_TO_SCENE)`
(`FLIGHT_SIM_TO_SCENE = 0.05`). `sceneOrigin`/yaw are captured from the parked
stamp at `enterFlight`. Ground is a flat sim plane at spawn height.
- **Camera is the exception**: the chase cam is framed in **scene units** (~6–10
  units behind, ~2.6 up — the plane is ~1.35 units wide), NOT run through the 0.05
  transform. Running the camera offset through the sim scale parks it inside the
  tail (the original bug). Controls: arrows Up/Down = throttle, Left/Right = rudder.

## Flow
- Place the **Stunt Plane** from Stamps (it is a model-stamp).
- Plain-click the placed plane → `showFlightMenu` → "Enter / Fly" →
  `enterFlight(x,z)`: swaps the global `camera` to a `flightCam` (FOV 60), captures
  keys, and uses the placed stamp group as the flown mesh (`flightJet`); finds a
  propeller child by name to spin (cosmetic, optional).
- Controls: W = climb / S = dive (pitch), A/D roll, Q/E yaw, Shift/Ctrl OR
  ArrowUp/ArrowDown = throttle, ArrowLeft/ArrowRight = rudder, B brake.
- `Escape` → `exitFlight()`: restores the previous camera, calls `updateCamera()`,
  re-renders the cell to re-park the stamp.

## Gotchas
- Module 34 shares the global scope with every other `engine/world` module — all
  its top-level scratch globals are `_fl…`-prefixed to avoid the duplicate-
  identifier instantiation failure (see AGENTS.md "Project shape"). A duplicate
  top-level `const`/`let`/`function` name silently kills the whole module.
- The tool picker is a **search palette** (`#palette-search` → `#palette-results`),
  not a fixed toolbar; the stunt plane is found under Stamps, not a tool button.
- Flight is **arcade + unconstrained for a tiny world**: `enterFlight` launches the
  plane already cruising (initial forward speed + throttle 0.6, `flightLeftGround`
  true) so there is no runway/taxi phase. Once airborne there is NO ground/island
  collision — you can climb, dive, and fly under the islands freely. Tuning lives
  in `FCFG` (MAX_THRUST 45, LIFT_K 0.08, DRAG_PARASITE 0.025, DRAG_INDUCED 0.03)
  and `FLIGHT_SIM_TO_SCENE` (0.09); these are balanced for a ~30–45 m/s controllable
  cruise on an 8–48 unit board, NOT the ships km-scale defaults.

## Verify (real app, real pointer pipeline — not synthetic shortcuts)
`npm run dev`, then via agent-browser `eval`:
1. Place: `setCell(x,z,{terrain:'grass',terrainFloors:1,kind:'model-stamp',floors:1,appearance:{modelStampId:'stunt-plane'}})`;
   `isFlyableStampCell(getWorldCell(x,z))` is true once the GLB loads.
2. Find a screen point where `pickTile(px,py)` resolves to the plane cell (project +
   search a small window — projecting the centre alone misses, terrain raycast is
   angled), then dispatch real `pointerdown`/`pointerup` there → `.flight-menu` appears.
3. Click `.flight-menu-btn` → `camera.fov === 60`, `window.__flightActive === true`.
4. Dispatch `keydown` ShiftLeft+KeyW, run ~2.5s → the stamp's world position moves.
5. `Escape` → `camera.fov === 28`, `__flightActive === false`, stamp re-parked.
