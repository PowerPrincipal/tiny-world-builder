---
name: tinyworld-25d-template-sprites
description: Use when changing the playable 2.5D template sprite, cloning it into character classes, or wiring idle/walk/attack sprite-sheet playback.
---

# TinyWorld 25D Template Sprites

This is not the crowd system. Do not route playable template work through
`vendor/tiny-crowd-layer.js`, `crowd/`, or `engine/world/11-vehicle-crowd.js`.

Runtime:

- `engine/world/47-worlds-room.js` owns the playable in-world/player-room
  avatar from these template sheets.
- The character is runtime-only and must not write into `world[x][z]`,
  `cellMeshes`, export JSON, saved worlds, or crowd people.
- Movement uses WASD/arrows. Jump uses Space. Attack uses `F`. Class cycling
  uses `[` / `]`.
- The world-room avatar class API is exposed via `window.__tinyworldWorlds`:
  `setAvatarClass(name)`, `cycleAvatarClass(delta)`, `avatarClass()`, and
  `avatarClasses()`.

Assets:

- Source template sheets live under `models/people/25D/`.
- Idle/walk/run sheets are 64px grid sheets.
- Attack sheets are 96px grid sheets.
- Rows are ordered: `down`, `downRight`, `right`, `upRight`, `up`, `upLeft`,
  `left`, `downLeft`.
- Generated class sheets live under `models/people/25D/classes/<class>/` as
  `idle.png`, `walk.png`, and `attack.png`.
- Regenerate class sheets with `python3 tools/generate-playable-25d-classes.py`.

When adding a class:

1. Add the class name to `CLASSES` and an overlay function in
   `tools/generate-playable-25d-classes.py`.
2. Add the class name to `AVATAR_CLASSES` in
   `engine/world/47-worlds-room.js`.
3. Regenerate sheets, then run `npm test` and `npm run build`.
