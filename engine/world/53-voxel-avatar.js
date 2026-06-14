  // -------- voxel avatars (real 3D voxel people, not 2.5D sprite "stripes") --------
  // A self-contained humanoid voxel-character builder. Exposes ONE global:
  //   window.makeVoxelAvatar(opts) -> { group, setHeading, setHeadingFromDelta,
  //                                     setState, update, dispose, cfg }
  // The voxel geometry/skin builders (mesher, wardrobe, face/hair) are ported from
  // voxel-poser.html (Three.js r128) but encapsulated PER-INSTANCE so many distinct
  // people can render at once — the source renders exactly one global singleton.
  //
  // v1 scope: static voxel geometry built ONCE at construction, animated purely by
  // rotating limb Groups (sinusoidal walk / idle / attack). No IK, no ragdoll, no
  // articulated fingers, no networked identity (skins are seeded locally from id).
  // IIFE-wrapped so NO top-level identifiers leak into the shared global scope
  // (tools/check.js fails the build on any duplicate top-level name).
  (function voxelAvatarBoot() {
    'use strict';
    if (typeof window === 'undefined') return;
    if (typeof THREE === 'undefined') { window.makeVoxelAvatar = function () { return null; }; return; }

    // Build the skeleton at 1 unit / voxel, then scale the root to AVATAR_HEIGHT.
    const VS = 1;
    // World scale: TILE=1, a house door is 0.48 tall, wall-per-floor 0.55. A person
    // reads right at roughly door height. The old 1.7 sprite had transparent padding
    // so its drawn body was much smaller than 1.7; a solid voxel body at 1.7 dwarfed
    // the doors. Build at ~0.62 so the figure stands a touch above a 0.48 door.
    const AVATAR_HEIGHT = 0.5;
    const _col = new THREE.Color();

    // ---- deterministic per-voxel hash (subtle color jitter so flat color reads textured) ----
    function hash3(x, y, z) {
      const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
      return s - Math.floor(s);
    }
    function makePrng(seed) {
      let s = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
    }

    // ---- voxel mesher: Map("x,y,z"->hex) -> BufferGeometry with baked vertex colors ----
    // Neighbor-aware beveled mesher ported verbatim from voxel-poser voxGeo; `bevel`
    // is a param (was global cfg.bevel). Output uses vertexColors materials.
    function voxGeo(map, cx, cy, cz, bevel) {
      const pos = [], nor = [], col = [], idx = [];
      const PK = (x, y, z) => ((x + 64) << 14) | ((y + 64) << 7) | (z + 64);
      const occ = new Set();
      const cells = [];
      for (const [k, hex] of map) {
        const p = k.split(',');
        const x = +p[0], y = +p[1], z = +p[2];
        occ.add(PK(x, y, z));
        cells.push(x, y, z, hex);
      }
      const has = (x, y, z) => occ.has(PK(x, y, z));
      const b = bevel ? 0.24 : 0;
      const quad = (pts, n, r, g, bl) => {
        const base = pos.length / 3;
        for (const p of pts) {
          pos.push(p[0] * VS, p[1] * VS, p[2] * VS);
          nor.push(n[0], n[1], n[2]);
          col.push(r, g, bl);
        }
        idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      };
      for (let ci = 0; ci < cells.length; ci += 4) {
        const x = cells[ci], y = cells[ci + 1], z = cells[ci + 2];
        _col.set(cells[ci + 3]).convertSRGBToLinear();
        const j = 0.94 + hash3(x, y, z) * 0.10;
        const r = _col.r * j, g = _col.g * j, bl = _col.b * j;
        const C = [x - cx, y - cy, z - cz];
        for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
          const n = [0, 0, 0]; n[a] = s;
          if (has(x + n[0], y + n[1], z + n[2])) continue;
          const ua = (a + 1) % 3, va = (a + 2) % 3;
          const conv = (ax, ss) => { const e = [0, 0, 0]; e[ax] = ss; return !has(x + e[0], y + e[1], z + e[2]); };
          const corner = (su, sv) => {
            const p = [C[0], C[1], C[2]];
            p[a] += s * 0.5;
            p[ua] += su * (0.5 - (conv(ua, su) ? b : 0));
            p[va] += sv * (0.5 - (conv(va, sv) ? b : 0));
            return p;
          };
          quad([corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)], n, r, g, bl);
        }
        if (b > 0) {
          for (let a = 0; a < 3; a++) for (const s of [1, -1])
            for (let a2 = a + 1; a2 < 3; a2++) for (const s2 of [1, -1]) {
              const n = [0, 0, 0]; n[a] = s;
              const e = [0, 0, 0]; e[a2] = s2;
              if (has(x + n[0], y + n[1], z + n[2]) || has(x + e[0], y + e[1], z + e[2])) continue;
              const w = 3 - a - a2;
              const endB = sw => { const t = [0, 0, 0]; t[w] = sw; return !has(x + t[0], y + t[1], z + t[2]) ? b : 0; };
              const P = (side, sw) => {
                const p = [C[0], C[1], C[2]];
                if (side === 0) { p[a] += s * 0.5; p[a2] += s2 * (0.5 - b); }
                else { p[a2] += s2 * 0.5; p[a] += s * (0.5 - b); }
                p[w] += sw * (0.5 - endB(sw));
                return p;
              };
              const nn = [0, 0, 0]; nn[a] = s * 0.7071; nn[a2] = s2 * 0.7071;
              quad([P(0, -1), P(0, 1), P(1, -1), P(1, 1)], nn, r * 1.05, g * 1.05, bl * 1.05);
            }
          for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
            if (has(x + sx, y, z) || has(x, y + sy, z) || has(x, y, z + sz)) continue;
            const base = pos.length / 3;
            const m = 0.5773;
            for (let axis = 0; axis < 3; axis++) {
              const p = [
                C[0] + (axis === 0 ? sx * 0.5 : sx * (0.5 - b)),
                C[1] + (axis === 1 ? sy * 0.5 : sy * (0.5 - b)),
                C[2] + (axis === 2 ? sz * 0.5 : sz * (0.5 - b)),
              ];
              pos.push(p[0] * VS, p[1] * VS, p[2] * VS);
              nor.push(sx * m, sy * m, sz * m);
              col.push(r * 1.05, g * 1.05, bl * 1.05);
            }
            idx.push(base, base + 1, base + 2);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeBoundingBox();
      return geo;
    }

    // ---- wardrobe (ported from voxel-poser) ----
    const SKINS = ['#fcdca0', '#eab38f', '#c98a5f', '#9c6644', '#6e482e'];
    const HAIRC = ['#241f26', '#54371f', '#d9a441', '#b05f28', '#a83a2a', '#5a6fd1', '#cdd3dc'];
    const HAIRS = ['Buzz', 'Short', 'Spike', 'Mohawk', 'Curls', 'Page', 'Bob', 'Tail', 'Knot'];
    const OUTFITS = {
      Casual: { shirt: '#4f8ef7', sleeve: 'short', pants: '#39496b', shoes: '#e8e6e1', belt: '#262b38' },
      Formal: { shirt: '#262a33', sleeve: 'long', pants: '#262a33', shoes: '#16171c', belt: '#16171c', collar: '#f0efe9', tie: '#a8392a' },
      Scout: { shirt: '#5d8a4a', sleeve: 'long', pants: '#7a6248', shoes: '#4a3526', belt: '#a87f3f', boots: true },
      Sport: { shirt: '#e85d75', sleeve: 'long', pants: '#2c2f38', shoes: '#f2b441', belt: '#222630' },
      Rogue: { shirt: '#3f4b4e', sleeve: 'long', pants: '#320632', shoes: '#2c2c2c', belt: '#b05f28', boots: true, sash: '#c3cbdb', skirt: '#560b28' },
      Barbarian: { bare: true, sleeve: 'short', barelegs: true, shoes: '#9c4528', belt: '#5a3018', boots: true, bootTall: true, harness: '#7e8a96', emblem: '#b8341f', fur: '#8a4b2a', fur2: '#6e3a1f', brace: '#6b4226', skirt: '#6e3a1f', shirt: '#000', pants: '#000' },
    };
    const OUTFIT_KEYS = Object.keys(OUTFITS);

    function fill(map, x0, x1, y0, y1, z0, z1, color) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
        map.set(x + ',' + y + ',' + z, color);
    }
    function shade(hex, f) {
      _col.set(hex).multiplyScalar(f);
      _col.r = Math.min(_col.r, 1); _col.g = Math.min(_col.g, 1); _col.b = Math.min(_col.b, 1);
      return '#' + _col.getHexString();
    }

    // ---- head (skin + face + hair) ----  (ported; viseme/Talk simplified to a static mouth)
    function buildHeadMap(cfg, skin, hair) {
      const HW = cfg.head === 'Slim' ? 6 : 8;
      const X1 = HW - 1;
      const ex = HW === 8 ? [2, 5] : [1, 4];
      const ca = HW / 2 - 1, cb = HW / 2;
      const H = new Map();
      fill(H, 0, X1, 0, 7, 0, 7, skin);
      const cut = (x, y, z) => H.delete(x + ',' + y + ',' + z);
      for (let x = 0; x < HW; x++) for (let z = 0; z < 8; z++) {
        if (x === 0 || x === X1 || z === 0 || z === 7) { cut(x, 7, z); cut(x, 0, z); }
      }
      for (const x of [0, X1]) for (const z of [0, 7]) { cut(x, 6, z); cut(x, 1, z); }
      fill(H, ca, cb, -1, -1, 2, 5, shade(skin, 0.93));            // neck
      fill(H, -1, -1, 3, 4, 3, 4, shade(skin, 0.97));              // ears
      fill(H, HW, HW, 3, 4, 3, 4, shade(skin, 0.97));
      const DARK = '#1d2028', LITE = '#dfe5ee';
      const eL = [ex[0] - 1, ex[0]], eR = [ex[1], ex[1] + 1];
      for (const c of [...eL, ...eR]) for (const y of [3, 4, 5]) H.set(c + ',' + y + ',7', LITE);  // sclera
      const pup = (() => {
        switch (cfg.eyes) {
          case 'Happy': return [[eL[0], 4], [eL[1], 4], [eR[0], 4], [eR[1], 4]];
          default: return [[eL[1], 4], [eR[0], 4]];                // Focus
        }
      })();
      for (const [c, y] of pup) H.set(c + ',' + y + ',7', DARK);
      fill(H, ca, cb, 3, 3, 8, 8, shade(skin, 0.97));              // nose
      const m0 = ca - 1, m1 = cb + 1;
      const mouth = (x, y) => H.set(x + ',' + y + ',7', DARK);
      if (cfg.mouth === 'Smile') { mouth(m0, 2); mouth(m1, 2); for (let x = ca; x <= cb; x++) mouth(x, 1); }
      else if (cfg.mouth === 'Frown') { mouth(m0, 1); mouth(m1, 1); for (let x = ca; x <= cb; x++) mouth(x, 2); }
      else { for (let x = m0; x <= m1; x++) mouth(x, 2); for (let x = ca; x <= cb; x++) mouth(x, 1); } // Open/default
      // hair
      const paint = (x, y, z) => { const k = x + ',' + y + ',' + z; if (H.has(k)) H.set(k, hair); };
      for (let x = 0; x < HW; x++) for (let z = 0; z < 8; z++) paint(x, 7, z);
      if (cfg.hair !== 'Buzz') {
        for (let x = 0; x < HW; x++) for (let z = 0; z < 8; z++) paint(x, 6, z);
        for (let y = 3; y <= 5; y++) for (let x = 0; x < HW; x++) { paint(x, y, 0); paint(x, y, 1); }
        for (let y = 4; y <= 5; y++) for (let z = 0; z < 7; z++) { paint(0, y, z); paint(X1, y, z); }
      } else {
        for (let x = 0; x < HW; x++) for (let z = 0; z <= 2; z++) paint(x, 6, z);
      }
      if (cfg.hair === 'Bob') {
        fill(H, -1, -1, 2, 7, 0, 6, hair); fill(H, HW, HW, 2, 7, 0, 6, hair);
        fill(H, 0, X1, 2, 7, -1, -1, hair); fill(H, -1, HW, 8, 8, -1, 7, hair);
      } else if (cfg.hair === 'Tail') {
        fill(H, ca, cb, 2, 6, -1, -1, hair); fill(H, ca, cb, -3, 1, -2, -2, hair);
      } else if (cfg.hair === 'Knot') {
        fill(H, ca, cb, 8, 8, 2, 3, '#f2bf57'); fill(H, ca - 1, cb + 1, 9, 10, 1, 4, hair);
        fill(H, ca, cb, 3, 6, -1, -1, hair); fill(H, ca, cb, -2, 2, -2, -2, hair);
      } else if (cfg.hair === 'Spike') {
        const h3 = shade(hair, 1.12);
        fill(H, 0, X1, 8, 8, 1, 6, hair);
        for (let x = 0; x < HW; x++) { const fwd = (x % 2 === 0); fill(H, x, x, 9, 9, 4, 6, hair); if (fwd) fill(H, x, x, 10, 10, 5, 6, h3); }
        fill(H, 0, X1, 9, 9, 6, 6, h3);
      } else if (cfg.hair === 'Mohawk') {
        const h3 = shade(hair, 1.1);
        fill(H, ca, cb, 8, 9, 0, 7, hair); fill(H, ca, cb, 10, 10, 1, 6, hair); fill(H, ca, cb, 11, 11, 2, 5, h3);
      } else if (cfg.hair === 'Curls') {
        fill(H, -1, HW, 8, 9, -1, 7, hair); fill(H, -2, -2, 3, 8, 0, 6, hair); fill(H, HW + 1, HW + 1, 3, 8, 0, 6, hair);
        fill(H, -1, HW, 2, 8, -2, -2, hair); fill(H, -1, HW, 10, 10, 2, 5, hair);
      } else if (cfg.hair === 'Page') {
        fill(H, -1, -1, 3, 8, -1, 7, hair); fill(H, HW, HW, 3, 8, -1, 7, hair);
        fill(H, 0, X1, 2, 8, -1, -1, hair); fill(H, -1, HW, 8, 8, -1, 7, hair);
      }
      return [H, (HW - 1) / 2, -0.5, 3.5];
    }

    // ---- full body part maps (ported; articulated fingers dropped, hand = single block) ----
    function buildParts(cfg) {
      const skin = SKINS[cfg.skin];
      const hair = HAIRC[cfg.hairC];
      const fit = { ...OUTFITS[cfg.fit] };
      if (fit.bare) fit.shirt = skin;
      if (fit.barelegs) fit.pants = skin;
      const fem = cfg.body === 'Fem';
      const maps = {};
      maps.head = buildHeadMap(cfg, skin, hair);

      // chest
      const C = new Map();
      const topX0 = fem ? 0 : -1, topX1 = fem ? 7 : 8;
      if (fem) { fill(C, 0, 7, 0, 0, 0, 3, fit.shirt); fill(C, 1, 6, 1, 2, 0, 3, fit.shirt); fill(C, 0, 7, 3, 7, 0, 3, fit.shirt); }
      else { fill(C, 0, 7, 0, 2, 0, 3, fit.shirt); fill(C, topX0, topX1, 3, 7, 0, 3, fit.shirt); }
      if (fit.collar) {
        for (let x = topX0; x <= topX1; x++) for (let z = 0; z < 4; z++) { const k = x + ',7,' + z; if (C.has(k)) C.set(k, fit.collar); }
        fill(C, 3, 4, 4, 6, 3, 3, fit.tie);
      }
      if (fit.sash) {
        const pc = (x, y, z) => { const k = x + ',' + y + ',' + z; if (C.has(k)) C.set(k, fit.sash); };
        for (let y = 2; y <= 7; y++) { const xx = Math.round(1 + (y - 2) * (topX1 - 2) / 5); pc(xx, y, 3); pc(xx - 1, y, 3); pc(xx, y, 0); pc(xx - 1, y, 0); }
      }
      if (fit.harness) {
        const pc = (x, y, z, c) => { const k = x + ',' + y + ',' + z; if (C.has(k)) C.set(k, c); };
        for (const z of [3, 0]) { for (let x = 0; x < 8; x++) pc(x, 4, z, fit.harness); for (let y = 5; y <= 6; y++) { pc(1, y, z, fit.harness); pc(6, y, z, fit.harness); } }
        for (const x of [1, 6]) for (let z = 0; z < 4; z++) pc(x, 7, z, fit.harness);
        pc(3, 5, 3, fit.emblem); pc(4, 5, 3, fit.emblem); pc(3, 4, 3, fit.emblem); pc(4, 4, 3, fit.emblem);
        pc(3, 3, 3, fit.emblem); pc(4, 3, 3, fit.emblem); pc(2, 4, 3, fit.emblem); pc(5, 4, 3, fit.emblem);
      }
      maps.chest = [C, 3.5, -0.5, 1.5];

      // pelvis
      const P = new Map();
      const pw = fem ? 9 : 8, px1 = pw - 1;
      fill(P, 0, px1, 0, 3, 0, 3, fit.pants);
      if (fit.fur) { fill(P, 0, px1, 0, 2, 0, 3, fit.fur); for (let x = 0; x <= px1; x++) for (let z = 0; z < 4; z++) if ((x + z) & 1) P.set(x + ',0,' + z, fit.fur2); }
      for (let x = 0; x <= px1; x++) for (let z = 0; z < 4; z++) P.set(x + ',3,' + z, fit.belt);
      if (fit.skirt) { for (let x = -1; x <= px1 + 1; x++) for (let z = -1; z <= 4; z++) { if (x > -1 && x < px1 + 1 && z > -1 && z < 4) continue; fill(P, x, x, -3, -1, z, z, fit.skirt); } }
      maps.pelvis = [P, (pw - 1) / 2, 1.5, 1.5];

      // arms (upper from shoulder, fore from elbow)
      const sleeveU = fit.shirt;
      const sleeveF = fit.sleeve === 'long' ? fit.shirt : skin;
      const AU = new Map(); fill(AU, 0, 2, -6, -1, 0, 2, sleeveU);
      const AF = new Map(); fill(AF, 0, 2, -4, -1, 0, 2, sleeveF);
      if (fit.brace) { fill(AF, 0, 2, -4, -3, 0, 2, fit.brace); fill(AF, 0, 2, -3, -3, 0, 2, shade(fit.brace, 1.2)); }
      maps.upperL = [AU, 1, -0.5, 1]; maps.upperR = [new Map(AU), 1, -0.5, 1];
      maps.foreL = [AF, 1, -0.5, 1]; maps.foreR = [new Map(AF), 1, -0.5, 1];

      // hands (single stubby block at wrist; origin at wrist)
      const HB = new Map(); fill(HB, 0, 2, -2, -1, 0, 2, skin);
      for (let z = 0; z < 3; z++) HB.set('1,-1,' + z, shade(skin, 0.92));
      maps.handL = [HB, 1, -0.5, 1]; maps.handR = [new Map(HB), 1, -0.5, 1];

      // legs (thigh from hip, shin from knee)
      const TH = new Map(); fill(TH, 0, 3, -7, -1, 0, 3, fit.pants);
      if (fit.fur) { fill(TH, 0, 3, -2, -1, 0, 3, fit.fur); for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) if ((x + z) & 1) TH.set(x + ',-3,' + z, fit.fur2); }
      const SH = new Map(); fill(SH, 0, 2, -7, -1, 0, 3, fit.pants);
      if (fit.boots) fill(SH, 0, 2, -7, fit.bootTall ? -4 : -5, 0, 3, fit.shoes);
      if (fit.bootTall) fill(SH, 0, 2, -4, -4, 0, 3, shade(fit.shoes, 1.25));
      maps.thighL = [TH, 1.5, -0.5, 1.5]; maps.thighR = [new Map(TH), 1.5, -0.5, 1.5];
      maps.shinL = [SH, 1, -0.5, 1.5]; maps.shinR = [new Map(SH), 1, -0.5, 1.5];

      // feet (origin: ankle, toe +z)
      const F = new Map();
      fill(F, 0, 3, -2, -1, -2, 3, fit.shoes);
      for (let x = 0; x < 4; x++) for (let z = -2; z <= 3; z++) F.set(x + ',-2,' + z, shade(fit.shoes, 0.7));
      maps.footL = [F, 1.5, -0.5, 0.5]; maps.footR = [new Map(F), 1.5, -0.5, 0.5];

      // survivor grime — deterministic per-seed so distinct avatars weather differently
      applyGrime(maps, cfg.seed >>> 0);
      return maps;
    }

    function applyGrime(maps, seed) {
      const HSH = (x, y, z, k) => { let h = (x * 374761 + y * 668265 + z * 9301 + ((seed * 10) | 0 + k) * 2654435761) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
      const MUD = [0x6b, 0x57, 0x42];
      const ZONES = { shinL: 0.55, shinR: 0.55, thighL: 0.4, thighR: 0.4, footL: 0.6, footR: 0.6, chest: 0.2, pelvis: 0.3, upperL: 0.26, upperR: 0.26, foreL: 0.34, foreR: 0.34 };
      const amt = 0.6;
      for (const part in ZONES) {
        if (!maps[part]) continue;
        const map = maps[part][0];
        for (const [k, c] of map) {
          const p = k.split(','), x = +p[0], y = +p[1], z = +p[2];
          if (HSH(x >> 1, y >> 1, z >> 1, 11) > ZONES[part] * amt) continue;
          const f = 0.45 + HSH(x, y, z, 23) * 0.3;
          const r = (parseInt(c.slice(1, 3), 16) * (1 - f) + MUD[0] * f) | 0;
          const g2 = (parseInt(c.slice(3, 5), 16) * (1 - f) + MUD[1] * f) | 0;
          const bb = (parseInt(c.slice(5, 7), 16) * (1 - f) + MUD[2] * f) | 0;
          map.set(k, '#' + ((1 << 24) + (r << 16) + (g2 << 8) + bb).toString(16).slice(1));
        }
      }
    }

    // ---- descriptor: explicit opts win; anything unset is derived deterministically
    //      from the seed so peers/bots render as DISTINCT people pre-networked-identity ----
    function deriveCfg(opts) {
      opts = opts || {};
      let seed = opts.seed;
      if (typeof seed === 'string') { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; seed = h; }
      seed = (seed >>> 0) || 1;
      const r = makePrng(seed);
      const pick = (arr) => arr[(r() * arr.length) | 0];
      return {
        body: opts.body || (r() < 0.5 ? 'Masc' : 'Fem'),
        skin: opts.skin != null ? opts.skin : (r() * SKINS.length) | 0,
        hairC: opts.hairC != null ? opts.hairC : (r() * HAIRC.length) | 0,
        hair: opts.hair || pick(HAIRS),
        fit: opts.fit || pick(OUTFIT_KEYS),
        head: opts.head || (r() < 0.5 ? 'Wide' : 'Slim'),
        bevel: opts.bevel != null ? opts.bevel : false,   // flat voxels: fewer verts, render-budget friendly
        eyes: opts.eyes || 'Focus',
        mouth: opts.mouth || 'Smile',
        seed,
      };
    }

    // ---- assemble a posed skeleton of limb Groups from the part meshes ----
    function makeVoxelAvatar(opts) {
      const cfg = deriveCfg(opts);
      const maps = buildParts(cfg);
      // side: DoubleSide is REQUIRED — the ported voxGeo mesher emits inconsistent
      // face winding (voxel-poser's voxMat used DoubleSide too). With the default
      // FrontSide, wrong-wound faces get backface-culled and thin/carved parts
      // (slim heads, bare arms) render see-through.
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide });
      const geos = [];                                   // own everything; dispose() frees it
      const meshPart = (name) => {
        const m = maps[name]; if (!m) return null;
        const g = voxGeo(m[0], m[1], m[2], m[3], cfg.bevel);
        geos.push(g);
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        if (g.boundingBox) mesh.userData.bb = g.boundingBox.clone();
        return mesh;
      };
      const grp = (parent, x, y, z) => { const g = new THREE.Group(); if (x || y || z) g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; };

      const root = new THREE.Group();
      root.name = 'voxel-avatar';
      const body = grp(root, 0, 0, 0);                   // animated bob lives here
      const hips = grp(body, 0, 0, 0);

      const pelvis = meshPart('pelvis'); hips.add(pelvis);
      const pbb = pelvis.userData.bb;

      const chest = grp(hips, 0, pbb.max.y, 0);
      const chestMesh = meshPart('chest'); chest.add(chestMesh);
      const cbb = chestMesh.userData.bb;

      const head = grp(chest, 0, cbb.max.y, 0);
      head.add(meshPart('head'));

      // arms: shoulder pivots at the upper chest, just outside the torso edge
      const shY = cbb.max.y - 1.2;
      const shX = cbb.max.x + 0.2;
      const arm = (side) => {
        const sh = grp(chest, side * shX, shY, 0);
        const up = meshPart(side < 0 ? 'upperL' : 'upperR'); sh.add(up);
        const elbow = grp(sh, 0, up.userData.bb.min.y, 0);
        const fore = meshPart(side < 0 ? 'foreL' : 'foreR'); elbow.add(fore);
        const wrist = grp(elbow, 0, fore.userData.bb.min.y, 0);
        wrist.add(meshPart(side < 0 ? 'handL' : 'handR'));
        return { sh, elbow };
      };
      const armL = arm(-1), armR = arm(1);

      // legs: hip pivots under the pelvis
      const hipY = pbb.min.y;
      const hipX = Math.max(0.8, pbb.max.x * 0.5);
      const leg = (side) => {
        const hip = grp(hips, side * hipX, hipY, 0);
        const th = meshPart(side < 0 ? 'thighL' : 'thighR'); hip.add(th);
        const knee = grp(hip, 0, th.userData.bb.min.y, 0);
        const shin = meshPart(side < 0 ? 'shinL' : 'shinR'); knee.add(shin);
        const ankle = grp(knee, 0, shin.userData.bb.min.y, 0);
        ankle.add(meshPart(side < 0 ? 'footL' : 'footR'));
        return { hip, knee };
      };
      const legL = leg(-1), legR = leg(1);

      // anchor feet to y=0 and scale the whole rig to AVATAR_HEIGHT
      const fullBB = new THREE.Box3().setFromObject(body);
      const bobBase = -fullBB.min.y;          // lift so lowest voxel sits at y=0
      body.position.y = bobBase;
      const rawH = (fullBB.max.y - fullBB.min.y) || 1;
      root.scale.setScalar(AVATAR_HEIGHT / rawH);

      // ---- animation: rotate limb Groups only; geometry is never rebuilt ----
      const A = {                              // amplitudes (radians) — kept modest so
        // thin limbs don't fling far in z (which an iso camera projects as "scatter")
        walkLimb: 0.42, walkKnee: 0.55, idleArm: 0.05, attackArm: 1.3,
      };
      const inst = {
        group: root, cfg, _mat: mat, _geos: geos,
        _t: 0, _phase: 0, _state: 'idle', _attackT: 0, _heading: 0, _bobBase: bobBase,
        setHeading(yaw) { if (typeof yaw === 'number') { this._heading = yaw; root.rotation.y = yaw; } },
        setHeadingFromDelta(dx, dz) { if (dx || dz) this.setHeading(Math.atan2(dx, dz)); },
        getState() { return this._state; },
        setState(s) {
          if (s === this._state) return;
          if (s === 'attack') this._attackT = 0;
          this._state = (s === 'walk' || s === 'attack') ? s : 'idle';
        },
        update(dt) {
          dt = Math.min(dt || 0, 0.05);
          this._t += dt;
          const st = this._state;
          if (st === 'walk') {
            this._phase += dt * 9;
            const s = Math.sin(this._phase);
            armL.sh.rotation.x = s * A.walkLimb; armR.sh.rotation.x = -s * A.walkLimb;
            legL.hip.rotation.x = -s * A.walkLimb; legR.hip.rotation.x = s * A.walkLimb;
            legL.knee.rotation.x = Math.max(0, s) * A.walkKnee; legR.knee.rotation.x = Math.max(0, -s) * A.walkKnee;
            armL.elbow.rotation.x = -Math.max(0, -s) * 0.3; armR.elbow.rotation.x = -Math.max(0, s) * 0.3;
            body.position.y = bobBase + Math.abs(Math.cos(this._phase)) * 0.4;
          } else if (st === 'attack') {
            this._attackT += dt;
            const a = Math.min(this._attackT / 0.35, 1);
            const swing = Math.sin(a * Math.PI);              // raise then return
            armR.sh.rotation.x = -A.attackArm * swing; armR.elbow.rotation.x = -1.1 * swing;
            armL.sh.rotation.x = 0.2 * swing; legL.hip.rotation.x = 0; legR.hip.rotation.x = 0;
            legL.knee.rotation.x = 0; legR.knee.rotation.x = 0;
            body.position.y = bobBase;
            if (a >= 1) this.setState('idle');
          } else {                                             // idle: gentle breathing sway
            const b = Math.sin(this._t * 1.6);
            armL.sh.rotation.x = b * A.idleArm; armR.sh.rotation.x = -b * A.idleArm;
            legL.hip.rotation.x = 0; legR.hip.rotation.x = 0;
            legL.knee.rotation.x = 0; legR.knee.rotation.x = 0;
            armL.elbow.rotation.x = 0; armR.elbow.rotation.x = 0;
            body.position.y = bobBase + b * 0.04;
          }
        },
        dispose() {
          root.traverse((o) => { if (o.isMesh && o.geometry) { try { o.geometry.dispose(); } catch (_) {} } });
          if (root.parent) root.parent.remove(root);
          try { mat.dispose(); } catch (_) {}
          geos.length = 0;
        },
      };
      return inst;
    }

    window.makeVoxelAvatar = makeVoxelAvatar;

    // ---- networked descriptor: a strict, fully-RESOLVED subset of makeVoxelAvatar
    //      opts, safe to send over the wire so every client renders the SAME look.
    //      Returns { kind:'voxel', seed, body, skin, hairC, hair, fit, head } with
    //      ALL look fields populated (deriveCfg fills any unset from seed). Storing
    //      the resolved form (not seed-only) is deliberate: deriveCfg derives later
    //      fields via short-circuit PRNG calls, so an under-specified descriptor
    //      reshuffles — a complete one makes deriveCfg do zero PRNG work and renders
    //      bit-identically on self and on peers. Field domains (keep in sync with the
    //      server's cleanAvatar in party/index.js): body Masc|Fem; skin int 0..4
    //      (SKINS.length); hairC int 0..6 (HAIRC.length); hair in HAIRS; fit in
    //      OUTFIT_KEYS; head Wide|Slim.
    function voxelAvatarDescriptor(opts) {
      const c = deriveCfg(opts);
      return {
        kind: 'voxel',
        seed: c.seed >>> 0,
        body: c.body,
        skin: c.skin,
        hairC: c.hairC,
        hair: c.hair,
        fit: c.fit,
        head: c.head,
      };
    }
    // Expose the wardrobe option lists so the picker (49) can build preset/random
    // voxel looks without re-declaring them (single source of truth).
    voxelAvatarDescriptor.SKINS = SKINS.length;
    voxelAvatarDescriptor.HAIRC = HAIRC.length;
    voxelAvatarDescriptor.HAIRS = HAIRS.slice();
    voxelAvatarDescriptor.OUTFITS = OUTFIT_KEYS.slice();
    window.voxelAvatarDescriptor = voxelAvatarDescriptor;
  })();
