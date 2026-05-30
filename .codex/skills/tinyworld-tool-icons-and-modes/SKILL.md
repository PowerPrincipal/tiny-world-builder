---
name: tinyworld-tool-icons-and-modes
description: Use when changing Tiny World Builder's mode indicator, boot tool selection, or Esc-to-Select behaviour.
---

# Tiny World Mode Safety

## Mode safety

- Boot always ends on the Select tool: `bootApp` calls
  `selectTool(DEFAULT_TOOL)` *after* `loadState()`, so a restored world's saved
  `toolId` never leaves a fresh session "armed" for building.
- `#mode-indicator` (HUD chip, updated in `updateModeIndicator` in
  `19-tools-toolbar.js`) names the current mode and colours itself: calm
  `mode-select`, amber `mode-build`, red `mode-erase`. Keep it
  `pointer-events:none`.
- `Esc` disarms any build/paint/erase tool back to Select (handler in
  `20-input-place-erase.js`, skipped in first-person walk mode).

## Gotcha

`npm test` (`tools/check.js` / `smoke-static.js`) is stale post-split: it
string-matches the old inline `<script>`/`setCell(` in
`tiny-world-builder.html` and fails regardless of these changes. Verify with a
headless boot (no new console errors) instead.


## Bottom toolbar vs floating block palette

- The grouped bottom `.toolbar` is the default. The **"Show groups"** checkbox in
  Settings → App (`#toolbar-show-groups`, persisted as `tinyworld:showGroups`,
  default on) switches modes. When off, `body.hide-groups` hides `.toolbar` and a
  floating, resizable, draggable `#tool-palette` shows **every** placeable block
  (select + all `TOOL_GROUPS` tools with house variants expanded + erase).
- The palette is a self-contained module: `engine/world/35-tool-palette.js`.
  Blocks are built with `buildToolButton(t, { flyout: true })`, so they keep
  their colors and are highlighted by the same `updateToolActiveStates()` loop.
  The grid uses fixed 64px square cells (`repeat(auto-fill, 64px)`), so resizing
  the panel reflows blocks to the nearest square. `buildToolbar()` calls
  `rebuildToolPaletteIfActive()` so toolbar rebuilds refresh an open palette.
- The group **popout** flyout (`.flyout.tool-menu`) lays its icons out as a
  2-row grid block (`gridTemplateColumns: repeat(ceil(n/2), auto)` set in
  `renderToolGroupFlyout`).
- The old `#mode-indicator` HUD chip has been **removed** from the DOM;
  `updateModeIndicator()` still runs but no-ops on the missing element.
