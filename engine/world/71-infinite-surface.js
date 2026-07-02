  // -------- infinite procedural water + islands GPU surface --------
  // When the plane flies down toward the planet, the finite baked poser sea
  // (57-poser-surface.js) covers only ~240 world units around the spawn. This
  // module lays an ENDLESS camera-following shader plane at the same sea level:
  // a single 600x600 mesh whose vertices are displaced by world-anchored FBM
  // noise, so flying in any direction reveals fresh islands forever and the far
  // edge melts into the live sky via in-shader fog.
  //
  // The geometry recenters on the camera (snapped to a coarse grid so vertices
  // never swim), but the noise is sampled in WORLD space via modelMatrix — the
  // field is anchored to the world, the mesh merely slides under it. Lit by the
  // same day/night sun + ambient that tint everything else, so night reads dark
  // and blue, midday bright.
  //
  // Exposed as window.__tinyworldInfiniteSurface.{show,hide,tick,isActive}.
  // flight-sim (34) calls show()/hide() on veil begin/end; the surface animates
  // on its own rAF. IIFE — no top-level identifiers leak into the shared scope.
  (function infiniteSurfaceBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;
    if (window.__tinyworldInfiniteSurface) return;   // guard against double-install

    // ---- placement (matches the poser surface so the two seas are coplanar) ----
    const SEA_Y = -60.3;          // poser DROP is -60; sit a hair below to avoid z-fight
    const PLANE = 600, SEGS = 300; // 600u wide, 2u per segment
    const SNAP = 4;               // recenter grid = 2 segments (integer multiple; no swim)
    const FOG_NEAR = 120, FOG_FAR = 420;  // in-shader fog, independent of the poser's scene.fog

    // ---- shared-scene references (in-scope for engine <script> modules) ----
    function parentNode() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }
    function sceneRef() { return (typeof scene !== 'undefined') ? scene : null; }
    function cameraRef() { return (typeof camera !== 'undefined') ? camera : null; }

    // ===================== shaders =====================
    // Value-noise FBM shared by vertex (displacement) and fragment (foam detail).
    const NOISE_GLSL = [
      'float vhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }',
      'float vnoise(vec2 p){',
      '  vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);',
      '  return mix(mix(vhash(i), vhash(i+vec2(1.0,0.0)), f.x),',
      '             mix(vhash(i+vec2(0.0,1.0)), vhash(i+vec2(1.0,1.0)), f.x), f.y);',
      '}',
      'float fbm(vec2 p){',
      '  float a = 0.5, s = 0.0;',
      '  for (int i = 0; i < 5; i++){ s += a*vnoise(p); p *= 2.02; a *= 0.5; }',
      '  return s;',   // ~[0,1]
      '}',
      // continent field -> world elevation (water near 0, islands rise). Shared by
      // vertex displacement and the fragment normal so both agree exactly.
      'uniform float uFreq; uniform float uHeight; uniform float uSea; uniform float uTime;',
      'float terrainH(vec2 wp){',
      '  float cont = fbm(wp * uFreq);',
      '  float land = smoothstep(uSea, uSea + 0.05, cont);',
      '  float elev = max(0.0, cont - uSea) * uHeight;',
      '  elev += fbm(wp * uFreq * 4.0) * land * (uHeight * 0.22);',   // ridged detail on land only
      '  float wave = sin(wp.x*0.35 + uTime*1.3)*0.06 + sin(wp.y*0.31 - uTime*1.1)*0.05;',
      '  return mix(wave, elev, land);',
      '}',
    ].join('\n');

    const VERT = [
      NOISE_GLSL,
      'varying vec3 vWorldPos; varying vec3 vNormal; varying float vCont; varying float vLand;',
      'void main(){',
      '  vec4 wp4 = modelMatrix * vec4(position, 1.0);',   // world XZ, parent-transform safe
      '  vec2 wp = wp4.xz;',
      '  float h = terrainH(wp);',
      '  float e = 2.0;',                                   // finite-diff step for analytic normal
      '  float hx = terrainH(wp + vec2(e, 0.0));',
      '  float hz = terrainH(wp + vec2(0.0, e));',
      '  vNormal = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));',
      '  vCont = fbm(wp * uFreq);',
      '  vLand = smoothstep(uSea, uSea + 0.05, vCont);',
      '  vec3 dp = position; dp.y += h;',                  // displace in local space (plane is flat)
      '  vec4 world = modelMatrix * vec4(dp, 1.0);',
      '  vWorldPos = world.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * world;',
      '}',
    ].join('\n');

    const FRAG = [
      NOISE_GLSL,
      'varying vec3 vWorldPos; varying vec3 vNormal; varying float vCont; varying float vLand;',
      'uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uAmbient; uniform vec3 uSky;',
      'uniform float uFogNear; uniform float uFogFar;',
      'void main(){',
      '  float e = vWorldPos.y;',                           // world elevation (water ~0, islands up)
      '  vec3 col;',
      '  if (vLand < 0.5){',                                // ---- water ----
      '    float depth = clamp((uSea - vCont) * 6.0, 0.0, 1.0);',
      '    vec3 deep = vec3(0.02, 0.14, 0.24);',
      '    vec3 shallow = vec3(0.08, 0.44, 0.52);',
      '    col = mix(shallow, deep, depth);',
      '    float sp = vnoise(vWorldPos.xz*1.6 + vec2(uTime*0.17, uTime*0.11));',
      '    float sp2 = vnoise(vWorldPos.xz*3.4 - vec2(uTime*0.12, uTime*0.19));',
      '    float spark = pow(clamp(1.0 - abs(sin(sp*6.2831)+sin(sp2*6.2831))*0.5, 0.0, 1.0), 4.0);',
      '    col += spark * vec3(0.22, 0.28, 0.30);',
      '  } else {',                                          // ---- land ----
      // Low ground uses the dark island-underside gravel tone (matches
      // M.islandUnder 0x34373b) instead of a bright sandy beach, which read as
      // an overblown yellow. Grass/rock/snow climb from there with elevation.
      '    vec3 shore = vec3(0.205, 0.216, 0.231);',
      '    vec3 grass = vec3(0.22, 0.44, 0.20);',
      '    vec3 rock = vec3(0.34, 0.32, 0.30);',
      '    vec3 snow = vec3(0.90, 0.92, 0.96);',
      '    col = shore;',
      '    col = mix(col, grass, smoothstep(0.35, 1.1, e));',
      '    col = mix(col, rock, smoothstep(3.0, 6.0, e));',
      '    col = mix(col, snow, smoothstep(7.0, 10.0, e));',
      '    col *= 0.92 + fbm(vWorldPos.xz*0.5)*0.16;',       // gentle tonal variation
      '  }',
      // foam ribbon hugging the waterline (both sides of the coast transition)
      '  float foam = (1.0 - smoothstep(0.0, 0.06, abs(vLand - 0.5))) * 0.6;',
      '  foam *= 0.6 + 0.4*vnoise(vWorldPos.xz*2.5 + uTime*0.6);',
      '  col = mix(col, vec3(0.96, 0.98, 1.0), clamp(foam, 0.0, 1.0));',
      // Lambert diffuse from the live sun + day/night ambient
      '  float diff = max(dot(normalize(vNormal), normalize(uSunDir)), 0.0);',
      '  col = col * (uAmbient + uSunColor * diff);',
      // fog: melt the far edge into the sky (independent of scene.fog)
      '  float dist = distance(cameraPosition, vWorldPos);',
      '  float fog = smoothstep(uFogNear, uFogFar, dist);',
      '  col = mix(col, uSky, fog);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n');

    // ===================== state =====================
    let mesh = null, mat = null, built = false, raf = null;
    let sunLight = null, sunSearched = false;
    let last = 0, tSec = 0;
    const _sky = new THREE.Color(0x9fb8d0);
    const _sunC = new THREE.Color(0xffffff);
    const _amb = new THREE.Color(0x404850);
    const _sunDir = new THREE.Vector3(0.4, 1.0, 0.3).normalize();

    function build() {
      if (built) return mesh;
      const geo = new THREE.PlaneGeometry(PLANE, PLANE, SEGS, SEGS);
      geo.rotateX(-Math.PI / 2);
      mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uFreq: { value: 0.012 },
          uHeight: { value: 11.0 },
          uSea: { value: 0.52 },
          uSunDir: { value: _sunDir },
          uSunColor: { value: _sunC },
          uAmbient: { value: _amb },
          uSky: { value: _sky },
          uFogNear: { value: FOG_NEAR },
          uFogFar: { value: FOG_FAR },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        fog: false,   // all fog is in-shader; ignore the poser's short scene.fog
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'infiniteSurface';
      mesh.frustumCulled = false;   // it recenters every frame; bounds would be stale
      mesh.renderOrder = -2;        // behind the detailed poser sea/islands near centre
      mesh.visible = false;
      built = true;
      return mesh;
    }

    // The day/night sun is the one shadow-casting directional light (02-cameras-
    // lighting.js:233); the scene also holds several decorative/fill directionals,
    // so castShadow uniquely identifies it. Cache once; read colour+intensity live.
    function findSun() {
      if (sunSearched) return sunLight;
      const sc = sceneRef();
      if (!sc) return null;   // retry next tick once scene exists
      sunSearched = true;
      let best = null, bestI = -1;
      sc.traverse((o) => {
        if (!o.isDirectionalLight) return;
        const shadowed = o.castShadow ? 1e6 : 0;   // prefer the shadow caster
        const score = shadowed + o.intensity;
        if (score > bestI) { bestI = score; best = o; }
      });
      sunLight = best;
      return sunLight;
    }

    function updateUniforms() {
      if (!mat) return;
      const sc = sceneRef();
      // sky / fog colour from the live day-night background (dark blue at night,
      // bright at midday) — the single source that makes the surface obey the clock.
      if (sc && sc.background && sc.background.isColor) _sky.copy(sc.background);
      // sun direction (constant SUN_OFFSET) + live colour*intensity; target moves
      // in flight, so use position - target, never raw position.
      const sun = findSun();
      if (sun) {
        _sunDir.copy(sun.position);
        if (sun.target) _sunDir.sub(sun.target.position);
        if (_sunDir.lengthSq() < 1e-6) _sunDir.set(0.4, 1.0, 0.3);
        _sunDir.normalize();
        _sunC.copy(sun.color).multiplyScalar(Math.min(1.4, sun.intensity));
      } else {
        _sunC.setRGB(1, 1, 1);
      }
      // Ambient is the sky bounced back off the water: derive it from the live sky
      // colour (so night stays dark/blue, midday bright) with a small floor so land
      // is never pure black. A live hemisphere light, if present, tints the ground.
      _amb.setRGB(
        Math.min(1, _sky.r * 1.15 + 0.05),
        Math.min(1, _sky.g * 1.15 + 0.05),
        Math.min(1, _sky.b * 1.15 + 0.06),
      );
      mat.uniforms.uTime.value = tSec;
    }

    function recenter() {
      const cam = cameraRef();
      if (!mesh || !cam) return;
      const cx = Math.round(cam.position.x / SNAP) * SNAP;
      const cz = Math.round(cam.position.z / SNAP) * SNAP;
      mesh.position.set(cx, SEA_Y, cz);
    }

    // Self-driven tick (like the poser sea). Also exposed for 34 to call if it wants.
    function tick(now) {
      if (!mesh || !mesh.visible) return;
      const t = (typeof now === 'number') ? now
        : ((performance && performance.now) ? performance.now() : Date.now());
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      tSec += dt;
      recenter();
      updateUniforms();
    }

    function startTick() {
      if (raf) return;
      last = 0;
      const loop = (now) => { tick(now); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }
    function stopTick() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    function show() {
      build();
      const par = parentNode();
      if (!par) return false;
      if (mesh.parent !== par) par.add(mesh);
      recenter();
      mesh.visible = true;
      updateUniforms();
      startTick();
      return true;
    }

    function hide() {
      stopTick();
      if (mesh) {
        if (mesh.parent) mesh.parent.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
        mesh.visible = false;
      }
      // reset lazy-build state so a re-show rebuilds fresh GPU buffers
      mesh = null; mat = null; built = false;
      sunLight = null; sunSearched = false;
      tSec = 0; last = 0;
    }

    function isActive() { return !!(mesh && mesh.visible); }

    window.__tinyworldInfiniteSurface = { show, hide, tick, isActive };
  })();
