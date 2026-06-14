  // -------- poser surface: the ACTUAL voxel-poser island + sea system --------
  // Lifted verbatim from voxel-poser.html (the discrete kidney isles in a calm
  // banded sea, with foam ribbons) and transplanted as the flooded planet's
  // surface. This is NOT a re-derived height field — it is the poser's own
  // SATS / ISLE / groundH geometry, sand+meadow meshes, animated water shader
  // and foam, dropped under the floating islands so fly-down lands on it.
  //
  // Exposed as window.__tinyworldPoserSurface.{show,hide,build}. fly-down (54)
  // calls show()/hide() on descend/ascend; the sea animates on its own rAF.
  // IIFE — no top-level identifiers leak into the shared global scope.
  (function poserSurfaceBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    // ===== lifted from voxel-poser.html (lines ~432-497): island/sea geometry =====
    const SATS = [                                       // five satellite isles, ringed wide
      { cx: 46, cz: 9,  rot: 0.6, k1: 0.9, k2: 2.1 },
      { cx: 14, cz: -46, rot: 2.2, k1: 2.4, k2: 0.4 },
      { cx: -40, cz: -26, rot: 4.0, k1: 4.2, k2: 3.3 },
      { cx: -44, cz: 22, rot: 1.1, k1: 1.6, k2: 5.0 },
      { cx: 10, cz: 50, rot: 3.1, k1: 5.3, k2: 1.2 }];
    function satRAt(sat, th) {
      return 9.2 * (0.74 + 0.18 * Math.cos(2 * th + sat.k1) + 0.11 * Math.sin(th + sat.k2));
    }
    function satSd(sat, x, z) {
      const dx = x - sat.cx, dz = z - sat.cz;
      return satRAt(sat, Math.atan2(dz, dx) - sat.rot) - Math.hypot(dx, dz);
    }
    const ISLE = {
      r: 9.2, sx: 2.6, sz: 1.54, t: 0, sea: null, seaU: null, meadow: null,
      rAt(th) {
        const base = this.r * (0.74 + 0.18 * Math.cos(2 * th) + 0.11 * Math.sin(th));
        return base * (this.sx * this.sz) / Math.hypot(this.sz * Math.cos(th), this.sx * Math.sin(th));
      },
    };
    // wildflower spots: the meadow rises gently around each one
    const FLOWERS = (() => {
      const out = [];
      let h = 12345;
      const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
      for (let i = 0; i < 140 && out.length < 46; i++) {
        const th = rnd() * Math.PI * 2, rr = ISLE.rAt(th) * (0.12 + rnd() * 0.5);
        const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
        const sd = ISLE.rAt(Math.atan2(z, x)) - Math.hypot(x, z);
        if (sd > 2.4) out.push({ x, z });
      }
      return out;
    })();
    const _ss = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
    function isleH(sd, x, z, flowers) {
      if (sd <= 0) return Math.max(-0.55, sd * 0.16);       // sloping down to the seabed
      let h = _ss(0.1, 2.8, sd) * 0.3;                      // the raised green heart
      h += (Math.sin(x * 1.1 + z * 1.37) + Math.sin(x * 1.73 - z * 0.61)) * 0.013 * _ss(0.5, 1.4, sd);  // lumps
      if (flowers) for (const f of FLOWERS) {               // a swell of earth under each flower bed
        const fd = Math.hypot(x - f.x, z - f.z);
        if (fd < 0.42) { const k = 1 - fd / 0.42; h += k * k * 0.055; }
      }
      return h;
    }
    function nearestIsle(x, z) {                            // [isleIndex, sd] for the closest landmass
      let bi = 0, bsd = ISLE.rAt(Math.atan2(z, x)) - Math.hypot(x, z);
      for (let i = 0; i < SATS.length; i++) {
        const sd = satSd(SATS[i], x, z);
        if (sd > bsd) { bsd = sd; bi = i + 1; }
      }
      return [bi, bsd];
    }
    function groundH(x, z) {
      const [bi, sd] = nearestIsle(x, z);
      return isleH(sd, x, z, bi === 0);
    }

    // ===== textures (poser's sand gradient; a simple grass speckle for the meadow) =====
    function sandTexture() {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 512;
      const g = cv.getContext('2d');
      const grad = g.createRadialGradient(256, 256, 30, 256, 256, 256);
      grad.addColorStop(0, '#dcca9c'); grad.addColorStop(0.55, '#d2bd8a');
      grad.addColorStop(0.82, '#c7ad77'); grad.addColorStop(0.94, '#b89c66');
      grad.addColorStop(1, '#a98c55');
      g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
      g.globalAlpha = 0.05;
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = Math.random() < 0.5 ? '#b89f6e' : '#fff6dd';
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      g.globalAlpha = 1;
      return new THREE.CanvasTexture(cv);
    }
    function grassTexture() {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 256;
      const g = cv.getContext('2d');
      g.fillStyle = '#6f9d3c'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2200; i++) {
        const r = Math.random();
        g.fillStyle = r < 0.4 ? '#5c8a31' : r < 0.75 ? '#7fae47' : '#90b85a';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    let group = null, foams = [], built = false, raf = null;

    function parentNode() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }

    // ===== build the surface group (lifted from voxel-poser.html lines ~659-787) =====
    function build() {
      if (built) return group;
      group = new THREE.Group();
      group.name = 'poserSurface';
      group.visible = false;

      const sandTex = sandTexture();   // (kept for parity; vertex colors carry the sand)
      const grassTex = grassTexture();

      // voxel-finish heightfield: raised meadow heart, sloping sand, and a true seabed
      const G = 0.2, pos = [], col = [], idx = [];
      const mpos = [], muv = [], midx = [];
      const SAND = [[0.80, 0.70, 0.51], [0.76, 0.66, 0.47], [0.84, 0.74, 0.55], [0.72, 0.62, 0.43]];
      const QH = (x, z) => Math.round(groundH(x, z) / 0.014) * 0.014;
      const quad = (x0, z0, x1, z1, c) => {
        const b = pos.length / 3;
        pos.push(x0, QH(x0, z0), z0, x1, QH(x1, z0), z0, x1, QH(x1, z1), z1, x0, QH(x0, z1), z1);
        for (let q = 0; q < 4; q++) col.push(c[0], c[1], c[2]);
        idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      };
      const REGIONS = [{ x0: -29, x1: 29, z0: -21, z1: 21, sat: null }];
      for (const sat of SATS) REGIONS.push({ x0: sat.cx - 14.5, x1: sat.cx + 14.5, z0: sat.cz - 14.5, z1: sat.cz + 14.5, sat });
      for (const R of REGIONS)
        for (let gx = R.x0; gx <= R.x1; gx += G) {
          for (let gz = R.z0; gz <= R.z1; gz += G) {
            const cx = gx + G / 2, cz = gz + G / 2;
            const th = R.sat ? Math.atan2(cz - R.sat.cz, cx - R.sat.cx) - R.sat.rot : Math.atan2(cz, cx);
            const shoreD = R.sat ? satSd(R.sat, cx, cz) : ISLE.rAt(th) - Math.hypot(cx, cz);
            if (shoreD < -4.4) continue;                    // seabed levels off and ends
            const wob = (Math.sin(cx * 3.1 + cz * 1.7) + Math.sin(cx * 1.3 - cz * 2.6)) * 0.34;
            if (shoreD > 2.0 + wob) {                        // the grassy heart
              const u0 = cx * 0.55, v0 = cz * 0.55;
              const mb = mpos.length / 3;
              mpos.push(gx, QH(gx, gz) + 0.003, gz, gx + G, QH(gx + G, gz) + 0.003, gz,
                gx + G, QH(gx + G, gz + G) + 0.003, gz + G, gx, QH(gx, gz + G) + 0.003, gz + G);
              muv.push(u0, v0, u0 + G * 0.55, v0, u0 + G * 0.55, v0 + G * 0.55, u0, v0 + G * 0.55);
              midx.push(mb, mb + 2, mb + 1, mb, mb + 3, mb + 2);
              continue;
            }
            let c = SAND[(Math.abs((cx * 73856093 ^ cz * 19349663) | 0)) % 4];
            if (shoreD < 0) {                                // underwater sand, deepening blue
              const k = Math.min(1, -shoreD / 3.6);
              c = [c[0] * (1 - k) + 0.13 * k, c[1] * (1 - k) + 0.30 * k, c[2] * (1 - k) + 0.46 * k];
            } else if (shoreD < 0.55) {
              c = [c[0] * 0.92, c[1] * 0.92, c[2] * 0.95];   // damp band
            }
            quad(gx, gz, gx + G, gz + G, c);
          }
        }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      gg.setIndex(idx);
      gg.computeVertexNormals();
      const island = new THREE.Mesh(gg,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
      island.receiveShadow = true;
      group.add(island);

      if (mpos.length) {
        const mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.Float32BufferAttribute(mpos, 3));
        mg.setAttribute('uv', new THREE.Float32BufferAttribute(muv, 2));
        mg.setIndex(midx);
        mg.computeVertexNormals();
        const meadow = new THREE.Mesh(mg,
          new THREE.MeshStandardMaterial({ map: grassTex, color: 0xaecb66, roughness: 1, metalness: 0 }));
        meadow.receiveShadow = true;
        group.add(meadow);
        ISLE.meadow = meadow;
      }

      // sea: a soft-banded disc, vertices bob for gentle swell
      const seaGeo = new THREE.PlaneGeometry(150, 150, 80, 80);
      seaGeo.rotateX(-Math.PI / 2);
      {
        const n = seaGeo.attributes.position.count;
        const sc = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i++) sc[i] = 1;
        seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
      }
      const sea = new THREE.Mesh(seaGeo,
        new THREE.MeshStandardMaterial({
          color: 0x356f9e, vertexColors: true, roughness: 0.4, metalness: 0.05,
          transparent: true, opacity: 0.92,
        }));
      sea.material.onBeforeCompile = (sh) => {              // fully procedural water shading
        sh.uniforms.uT = { value: 0 };
        ISLE.seaU = sh.uniforms;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vWp;')
          .replace('#include <begin_vertex>',
            '#include <begin_vertex>\nvWp = (modelMatrix*vec4(position,1.0)).xz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', ['#include <common>',
            'varying vec2 vWp; uniform float uT;',
            'float vhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }',
            'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);',
            '  return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), f.x),',
            '             mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), f.x), f.y); }',
          ].join('\n'))
          .replace('#include <color_fragment>', ['#include <color_fragment>',
            '{',
            '  float n1 = vnoise(vWp*1.5 + vec2(uT*0.17, uT*0.11));',
            '  float n2 = vnoise(vWp*3.2 - vec2(uT*0.12, uT*0.19));',
            '  float ca = pow(clamp(1.0 - abs(sin(n1*6.2831) + sin(n2*6.2831))*0.5, 0.0, 1.0), 3.0);',
            '  diffuseColor.rgb += ca*vec3(0.2, 0.28, 0.3);',
            '  diffuseColor.rgb *= 0.95 + vnoise(vWp*0.6 + uT*0.05)*0.1;',
            '}',
          ].join('\n'));
      };
      sea.material.fog = false;
      sea.position.y = -0.02;
      group.add(sea);
      ISLE.sea = sea;

      // foam ribbons hugging every shoreline, conforming to the terrain
      const foamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
        side: THREE.DoubleSide, fog: false,
      });
      foams = [];
      const mkFoam = (rAtFn, ox, oz, rot) => {
        const fpos = [], fidx = [];
        for (let i = 0; i <= 160; i++) {
          const th = i / 160 * Math.PI * 2, r = rAtFn(th);
          const cx = Math.cos(th + rot), sz = Math.sin(th + rot);
          const ix = ox + cx * (r - 0.03), iz = oz + sz * (r - 0.03);
          const oxw = ox + cx * (r + 0.24), ozw = oz + sz * (r + 0.24);
          fpos.push(ix, Math.max(0, groundH(ix, iz)) + 0.006, iz, oxw, 0.006, ozw);
          if (i < 160) { const b = i * 2; fidx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
        }
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
        fg.setIndex(fidx);
        const foam = new THREE.Mesh(fg, foamMat);
        group.add(foam);
        foams.push(foam);
        return foam;
      };
      mkFoam(th => ISLE.rAt(th), 0, 0, 0);
      for (const sat of SATS) mkFoam(th => satRAt(sat, th), sat.cx, sat.cz, sat.rot);

      // island materials shouldn't be washed by the home scene's near distance fog
      island.material.fog = false;
      if (ISLE.meadow) ISLE.meadow.material.fog = false;

      built = true;
      return group;
    }

    // World placement: native poser units (~150 wide, ~0.9 tall relief) are scaled
    // up and dropped to where fly-down points the descent gaze. Y is boosted only
    // slightly so the islands stay low + gentle like the poser (not tall cliffs).
    // Tune SCALE/Y_BOOST/DROP if the framing needs it.
    const SCALE = 1.6, Y_BOOST = 3, DROP = 60;

    function show() {
      build();
      const par = parentNode();
      if (!par) return false;
      if (group.parent !== par) par.add(group);
      const tx = (typeof target !== 'undefined' && target) ? target.x : 0;
      const tz = (typeof target !== 'undefined' && target) ? target.z : 0;
      group.scale.set(SCALE, SCALE * Y_BOOST, SCALE);
      group.position.set(tx, -DROP, tz);
      group.visible = true;
      // (The old streaming voxel underlay is kept permanently hidden in module 27,
      // so there is nothing to hide here — the poser surface is the only terrain.)
      startTick();
      return true;
    }

    function hide() {
      if (group) group.visible = false;
      stopTick();
    }

    function startTick() {
      if (raf) return;
      let last = (performance && performance.now) ? performance.now() : Date.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        ISLE.t += dt;
        if (ISLE.seaU && ISLE.seaU.uT) ISLE.seaU.uT.value = ISLE.t;
        const k = 0.5 + 0.18 * Math.sin(ISLE.t * 0.9);     // gentle foam shimmer
        for (const f of foams) if (f.material) f.material.opacity = k;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    function stopTick() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    window.__tinyworldPoserSurface = { show, hide, build, group: () => group };
  })();
