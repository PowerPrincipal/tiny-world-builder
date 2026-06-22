---
name: tinyworld-tool-icons-and-modes
description: Use when changing Tiny World Builder's mode indicator, boot tool selection, or Esc-to-Select behaviour.
---

# Tiny World Mode Safety

## Mode safety

- Boot always ends on the Select tool: `bootApp` calls
  `selectTool(DEFAULT_TOOL)` *after* `loadState()`, so a restored world's saved
  `toolId` never leaves a fresh session "armed" for building.
- Build/Play mode is separate from Showcase. `#build-play-mode` toggles
  `body.tw-play-mode`, persists `tinyworld:build-play-mode.v1`, and exposes
  `window.__tinyworldIsPlayMode()` / `window.__tinyworldMode`. In PLAY mode,
  build panels and edit radials are hidden, selection/sub-edit state is cleared,
  and mutation paths should be gated through the same edit checks that call
  `mpEditAllowed()`.
- First load goes through `#welcome-modal`: the rounded `.launch-modal` shows
  `assets/twlogo.png` with Tinyverse, Battleworlds, Build, and Play buttons,
  includes the compact "Created by Jason Kneen" footer with `@jasonkneen` and
  `@tinyworldsapp` links, and hides app chrome via `body.welcome-launch-open`.
  Build/Play call `window.__tinyworldMode`; Tinyverse waits for
  `window.__tinyworldWorlds.open()` (or the `tinyworld:worlds-ready` signal)
  and opens the Worlds frontend rather than silently falling back to Build.
  Battleworlds calls `window.__tinyworldBattleworlds.open()` when present and
  otherwise falls back to Play. Do not bring back the old farm/vehicle welcome
  picker for this path, and keep `publish.sh` copying the `assets/` directory
  into `dist/assets/`.
- Showcase mode keeps only a simple top-right circular `#showcase-exit` X
  button visible. Do not turn it back into a wide "Exit Showcase Esc" text pill;
  keep `aria-keyshortcuts="Escape"` and the existing Escape handler that calls
  `setShowcaseActive(false)`.
- `#mode-indicator` (HUD chip, updated in `updateModeIndicator` in
  `19-tools-toolbar.js`) names the current mode and colours itself: calm
  `mode-select`, amber `mode-build`, red `mode-erase`. Keep it
  `pointer-events:none`.
- `Esc` disarms any build/paint/erase tool back to Select (handler in
  `20-input-place-erase.js`, skipped in first-person walk mode).
- The View modes popup has five modes: top-down, isometric, perspective,
  third-person walk (`tp`), and first-person walk (`fp`). Both walk modes are
  driven by the same `fp` controller in `20-input-place-erase.js`; `tp` shows a
  chase camera behind the voxel avatar, while `fp` uses the avatar rig's
  `getEyeWorldPosition()` and hides the head via `setFirstPerson(true)`.
  Keep `tp` in camera-mode schema/import allowlists when touching saved camera
  validation.
- Both walk modes are **home-builder only**. The `fp` avatar is added to the
  shared `worldGroup`, so it must never coexist with a Tinyverse room's own
  networked avatar or the player sees two copies of themselves. `setCameraMode`
  redirects `fp`/`tp` to `perspective` while `window.__tinyworldInWorldRoom` is
  set, and `47-worlds-room.js` `enterRoom` calls `window.__tinyworldExitWalkMode`
  (exposed from `20-input-place-erase.js`) to dispose any active walk avatar
  before spawning the room avatar. The room's own first-person is the surface
  roam zoom-in (`v` key, `_sr*` in `47`), not the builder `fp` controller.

## Gotcha

`npm test` (`tools/check.js` / `smoke-static.js`) reconstructs the split app
from `tiny-world-builder.html` plus `engine/**/*.js`. Update those static guards
when changing boot mode, launcher chrome, or mode persistence.


## Bottom toolbar vs floating block palette

- The grouped bottom `.toolbar` is the default. The **"Show groups"** checkbox in
  Settings → App (`#toolbar-show-groups`, persisted as `tinyworld:showGroups`,
  default on) switches modes. When off, `body.hide-groups` hides `.toolbar` and a
  floating, resizable, draggable `#tool-palette` shows **every** placeable block
  (select + all `TOOL_GROUPS` tools with house variants expanded + erase).
- The palette is a self-contained module: `engine/world/35-tool-palette.js`.
  Blocks are built with `buildToolButton(t, { flyout: true })`, so they keep
  their colors and are highlighted by the same `updateToolActiveStates()` loop.
- **Small screens force grouped mode.** `showGroupsEnabled()` returns true on
  `<=700px` regardless of the stored pref (`isSmallScreenForGroups()`), the
  checkbox is disabled there, and a `resize` listener re-applies across the
  breakpoint. The floating palette is unusable on phones, so never let it open
  there. The phone toolbar is also compacted to icon-only (labels/chevrons
  hidden, smaller buttons) in the `@media (max-width: 700px)` block.
  The grid uses fixed 64px square cells (`repeat(auto-fill, 64px)`), so resizing
  the panel reflows blocks to the nearest square. `buildToolbar()` calls
  `rebuildToolPaletteIfActive()` so toolbar rebuilds refresh an open palette.
- The group **popout** flyout (`.flyout.tool-menu`) lays its icons out as a
  2-row grid block (`gridTemplateColumns: repeat(ceil(n/2), auto)` set in
  `renderToolGroupFlyout`).
- The old vertical `.controls` rail is no longer visible. Keep its element IDs
  in the DOM as stable wiring targets, but put everyday chrome in the bottom
  toolbar: Build/Play, Home, Shield, View modes, Time/weather, Settings, and
  Account. Import/export must remain owner-gated and should not be added to the
  normal user toolbar.
- The old `#mode-indicator` HUD chip has been **removed** from the DOM;
  `updateModeIndicator()` still runs but no-ops on the missing element.
- In Tinyverse multiplayer HUD chrome, account sign-out is the only place that
  should use the door-arrow `leave` icon. The in-world exit that returns to the
  world picker uses `tw-hud-back-worlds`, the `reply` glyph, and
  `worlds.backToWorlds` so it is not confused with logging out.
