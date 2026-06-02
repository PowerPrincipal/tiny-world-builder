---
name: tinyworld-block-button-style
description: Use when styling any tool/block button, palette tile, icon chip, or new clickable square in Tiny World Builder. The locked-in "block" aesthetic — a raised square with a dark category-colored outline, an inner white line, and a white-bodied glyph outlined in the same dark color. Apply this whenever a new icon button/tile is added so the UI stays consistent.
---

# Tiny World "Block" button style (locked design language)

The canonical look for tool/block buttons (the floating palette `.tool-palette`,
the group popout `.flyout`, and the bottom toolbar `.tool` blocks). Jason signed
off on this as the house style — reuse it for any new icon square/tile.

## The three ingredients

1. **Outlined square** — a `1.5px` border in a *darkened* version of the tile's
   category color, an inner white line, and a slight raised lift.
2. **Outlined glyph** — a white icon body with a matching dark colored outline,
   drawn with `paint-order: stroke` + `vector-effect: non-scaling-stroke` so one
   `stroke-width` looks identical across every glyph viewBox (24, 512, …).
3. **Category color** — the dark outline is the darkened category tint; the
   square keeps a faint translucent category background.

## Category palette

| posType   | background tint            | dark outline (border + glyph stroke) |
|-----------|----------------------------|--------------------------------------|
| terrain   | `rgba(123,194,48,0.16)`    | `#3a6511`                            |
| primary   | `rgba(23,107,235,0.13)`    | `#1e428a`                            |
| tertiary  | `rgba(254,146,14,0.18)`    | `#a05600`                            |
| shield    | `rgba(45,215,255,0.15)`    | `#0e5f7e`                            |
| neutral   | (none)                     | `#2f3b57` (default `--glyph-outline`)|

The dark outline = the category tint darkened ~50–60%. For a new category,
pick the same hue at roughly that lightness.

## Recipe (lives in `styles/tiny-world.css`)

Glyph (white body + colored outline):

```css
.tool .tool-glyph { color: #fff; --glyph-outline: #2f3b57; }
.tool .tool-glyph svg { fill: currentColor; overflow: visible; }
.tool .tool-glyph svg * {
  fill: currentColor;
  stroke: var(--glyph-outline);
  stroke-width: 2.1;
  vector-effect: non-scaling-stroke;
  paint-order: stroke;
  stroke-linejoin: round;
  stroke-linecap: round;
}
/* per posType: set --glyph-outline on the .tool-glyph */
```

Raised, outlined square (per posType; same pattern for `.tool` and
`.tool.flyout-tool[data-pos-type]`):

```css
.tool[data-pos-type="primary"] {
  border: 1.5px solid #1e428a;                 /* dark category outline */
  box-shadow:
    inset 0 0 0 1.5px rgba(255,255,255,0.92),   /* inner white line */
    inset 0 -3px 0 rgba(30,66,138,0.22),        /* bottom bevel */
    0 2px 3px -1px rgba(20,30,50,0.22);         /* raised drop shadow */
}
```

## Applying it to a new button/tile

- Give the tile a `data-pos-type` (terrain/primary/tertiary) — the existing
  rules then paint it automatically. `posTypeForTool()` in
  `19-tools-toolbar.js` maps a tool to its posType.
- Build the icon with `buildToolButton(tool, { flyout: true })` so it reuses the
  `.tool-glyph` / `.tool-icon` machinery and the outline rules.
- Bottom-toolbar utility buttons use `buildToolbarUtilityButton(...)` and the
  same `.tool icon-only` block square. Keep Home and Shield as adjacent utility
  buttons at the front of the bottom toolbar; Shield uses `data-pos-type="shield"`
  and reflects the raised/lowered `VoxelShield` state with `.active` and
  `aria-pressed`.
- Active/pressed toolbar states must override dark/after-hours theme rules: keep
  the category outline color, use a light raised fill, a visible 2px outer ring,
  and a short bottom accent bar so selected tools do not read like pale disabled
  buttons. Because the theme blocks use `body.ui-theme-dark ... !important`,
  add matching `body.ui-theme-dark` active selectors after the generic selected
  block; a lower-specificity late rule is not enough.
- Mono/utility icons (select, erase) use `.tool-icon` and render as
  `fill:none; stroke:currentColor` outlines (the rule is shared between
  `.toolbar`, `.flyout`, and `.tool-palette`). Keep them line-art, not filled.
- Never go back to solid-filled (`fill:currentColor; stroke:none`) glyphs for
  block buttons — that is the *old* look this style replaced.

## Gotchas

- `vector-effect`/`paint-order` must be on the path/shape elements
  (`svg *`), not the `<svg>` — they don't inherit.
- The global `[data-tooltip]{position:relative}` rule can clobber `position` at
  tied specificity; if a styled button mispositions, raise selector specificity
  (e.g. `button.foo`).
- Verify in a real browser, not synthetic events: sample the rendered pixels
  (a primary block reads dark border `30,66,138` → white line `~250` → tint).
