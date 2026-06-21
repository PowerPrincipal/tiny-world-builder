import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const universeJs = readFileSync(new URL('../engine/world/46-worlds-universe.js', import.meta.url), 'utf8');
const roomJs = readFileSync(new URL('../engine/world/47-worlds-room.js', import.meta.url), 'utf8');
const hudJs = readFileSync(new URL('../engine/world/48-worlds-harvest-hud.js', import.meta.url), 'utf8');

test('explicit island exits open the world picker instead of exposing a restored selector board', () => {
  assert.match(roomJs, /WS\.exitToWorldPicker\s*=\s*function\s*\(\)/);
  assert.match(roomJs, /function openWorldPickerFromGate\(\)[\s\S]*WS\.exitToWorldPicker\(\)/);
  assert.match(hudJs, /WS\.exitToWorldPicker\(\)/);
});

test('island exit HUD does not reuse the account sign-out icon', () => {
  assert.match(hudJs, /tw-hud-back-worlds/);
  assert.match(hudJs, /T\('worlds\.backToWorlds'\)/);
  assert.match(hudJs, /ic\('reply', 16\)/);
  assert.doesNotMatch(hudJs, /tw-hud-leave[\s\S]*ic\('leave', 16\)/);
});

test('room teardown does not restore builder state as a minimap side effect', () => {
  const match = roomJs.match(/function hideBaseMinimap\(hide\) \{([\s\S]*?)\n    \}/);
  assert.ok(match, 'hideBaseMinimap function exists');
  assert.doesNotMatch(match[1], /restoreFreeform|clearActiveTinyverseSession/);
});

test('legacy multi-gate picker boards are not restored behind the world picker', () => {
  assert.match(universeJs, /function looksLikeLegacyPickerBoard\(state\)/);
  assert.match(universeJs, /stargates >= 4/);
  assert.match(universeJs, /applyState\(looksLikeLegacyPickerBoard\(savedFreeform\) \? \{ v: 4, gridSize: 8, cells: \[\] \} : savedFreeform\)/);
});
