// tests/appearance-surface.test.mjs
// Exercises the REAL normalizeAppearance from engine/world/04-textures.js for the
// inspector-v2 surface fields (emissive, opacity, finish, light): allowlist
// behaviour + clamping + enum guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildEngineFns } from './helpers/extract-fn.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEXTURES = join(__dirname, '..', 'engine', 'world', '04-textures.js');

// materialTextureMap is a closure global used by normalizeMaterialTextureKey; an
// empty stub makes every key normalize to 'default', which is all we need here.
const { normalizeAppearance } = buildEngineFns(
  TEXTURES,
  ['normalizeHexColor', 'normalizeMaterialTextureKey', 'normalizeMaterialTextureScale', 'normalizeAppearance'],
  'const materialTextureMap = {};'
);

test('emissive + opacity round-trip and clamp', () => {
  const a = normalizeAppearance({ emissiveColor: '#ffcc88', emissiveIntensity: 5, opacity: -1 });
  assert.equal(a.emissiveColor, '#ffcc88');
  assert.equal(a.emissiveIntensity, 2);   // clamped to hi
  assert.equal(a.opacity, 0);             // clamped to lo
});

test('opacity of 1 and emissiveIntensity 0 are dropped (defaults)', () => {
  assert.equal(normalizeAppearance({ opacity: 1, emissiveIntensity: 0 }), null);
});

test('finish enum guard; matte is default-dropped', () => {
  assert.equal(normalizeAppearance({ finish: 'satin' }).finish, 'satin');
  assert.equal(normalizeAppearance({ finish: 'glow' }).finish, 'glow');
  assert.equal(normalizeAppearance({ finish: 'matte' }), null);
  assert.equal(normalizeAppearance({ finish: 'bogus' }), null);
});

test('light normalizes type/color/intensity/range and clamps', () => {
  const a = normalizeAppearance({ light: { type: 'point', color: 'ffffff', intensity: 9, range: 99 } });
  assert.deepEqual(a.light, { type: 'point', color: '#ffffff', intensity: 4, range: 20 });
});

test('light defaults fill when omitted, invalid type drops whole spec', () => {
  const a = normalizeAppearance({ light: { type: 'spot' } });
  assert.deepEqual(a.light, { type: 'spot', color: '#ffd9a0', intensity: 1, range: 6 });
  assert.equal(normalizeAppearance({ light: { type: 'laser' } }), null);
});

test('unknown keys still dropped (allowlist intact)', () => {
  assert.equal(normalizeAppearance({ metalness: 0.5, roughness: 0.2 }), null);
});
