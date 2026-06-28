# TinyWorld Driver.js Onboarding

Use this skill when changing the TinyWorld onboarding tour, Guide button, or Driver.js integration.

## Current Shape

- Driver.js is vendored under `vendor/driverjs/` and loaded from `tiny-world-builder.html`.
- The tour module is `engine/world/70-onboarding-driver.js`; it is a classic script, so keep top-level names unique.
- The toolbar replay entry is `#toolbar-guide` in `engine/world/19-tools-toolbar.js`.
- Tour styling lives in `styles/tiny-world.css` under `/* ---- Driver.js onboarding ---- */`.

## Behavior Contract

- The first-run dismissal key is `tinyworld:onboarding:driver.v1`.
- Users can force the tour with `?tour=1`, reset the dismissal with `?tour=reset`, or disable it for a page load with `?tour=0`.
- Auto-start waits until the welcome modal is closed and skips preview, room/collab, and play-mode sessions.
- The module exposes `window.__tinyworldOnboarding.start({ force: true })` for replay controls.

## Persistence

- Keep the onboarding dismissal out of shipped defaults. `tools/dev-server.js` excludes `tinyworld:onboarding:driver.v*`; mirror that exclusion if another defaults-save path becomes active.

## Checks

- Run `node --check engine/world/70-onboarding-driver.js`.
- Run `npm test` and `npm run build`.
- Browser-check `http://localhost:3000/tiny-world-builder?tour=1` after dismissing the welcome modal; confirm the popover uses the yellow TinyWorld UI style and the Guide button replays the tour.
