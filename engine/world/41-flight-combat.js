// engine/world/41-flight-combat.js
// -------- flight combat: guns, targeting HUD, missiles --------
// Scene-space combat for the stunt plane. Hooked from 34-flight-sim.js via
// optional globals (same pattern as window.__tinyworldMultiplayer.broadcastFlight).
// Reads the rendered plane transform off window.__flightJet each tick; never
// touches the sim-space flight physics.
(function flightCombatModule() {
  'use strict';
  if (typeof THREE === 'undefined') return;

  // Step 1 muzzle-flash path: 23-particles-clouds.js exposes only weather/splash
  // emitters (emitSplash, emitWeatherBuildSurface, emitRainSurface, etc.) via
  // module-private closures — none are published as globals. No reusable burst
  // emitter is reachable from this module. Tracer meshes carry the visual for
  // now; muzzle flash deferred to a later refinement task.

  let active = false;
  let jet = null; // window.__flightJet while flying

  // ---- target adapter ----
  // Uniform target interface so guns/missiles/HUD never special-case kinds:
  //   { id, kind, getWorldPos(out), radius, isAlive(), label(), speedKts(),
  //     applyDamage(amount, hitScenePos, source) }
  const targets = [];                 // rebuilt each frame
  const _prevGhostPos = new Map();    // id -> THREE.Vector3 (last frame) for speed est

  function makeGhostTarget(g, dt) {
    const pos = new THREE.Vector3();
    g.group.getWorldPosition(pos);
    let speed = 0;
    const prev = _prevGhostPos.get(g.id);
    if (prev && dt > 0) speed = prev.distanceTo(pos) / dt;
    if (prev) prev.copy(pos); else _prevGhostPos.set(g.id, pos.clone());
    return {
      id: 'ghost:' + g.id,
      kind: 'player',
      _pos: pos,
      getWorldPos(out) { return (out || new THREE.Vector3()).copy(this._pos); },
      radius: 1.6,
      isAlive() { return true; }, // players don't die locally; handled by hit messaging later
      label() { return 'PLAYER'; },
      speedKts() { return speed * 1.94; },
      applyDamage(amount, hitPos, source) { onHitPlayer(g.id, amount, source); },
    };
  }

  function onHitPlayer(/* peerId, amount, source */) { /* implemented in a later task */ }

  function collectTargets(dt) {
    targets.length = 0;
    const mp = window.__tinyworldMultiplayer;
    if (mp && typeof mp.flightGhosts === 'function') {
      const ghosts = mp.flightGhosts();
      for (const g of ghosts) targets.push(makeGhostTarget(g, dt));
      // prune stale speed-estimate entries for ghosts that vanished
      if (_prevGhostPos.size > ghosts.length + 4) {
        const live = new Set(ghosts.map(g => g.id));
        for (const id of Array.from(_prevGhostPos.keys())) if (!live.has(id)) _prevGhostPos.delete(id);
      }
    }
    // world-cell targets appended in a later task
  }

  // ---- tracers ----
  const TRACER_POOL = 48;
  const TRACER_SPEED = 46;     // scene units/sec
  const TRACER_LIFE = 0.55;
  const FIRE_COOLDOWN = 0.11;
  let tracerGroup = null;
  const tracers = [];
  let fireCooldown = 0;
  let shotsFired = 0;
  const gunMuzzleL = new THREE.Vector3(); // jet-local offsets, set in onEnter
  const gunMuzzleR = new THREE.Vector3();
  const _muzzleWorld = new THREE.Vector3();
  const _fireDir = new THREE.Vector3();
  const _tracerQuat = new THREE.Quaternion();
  const _projForward = new THREE.Vector3(0, 0, 1);

  function ensureTracerPool() {
    if (tracerGroup) return;
    tracerGroup = new THREE.Group();
    tracerGroup.name = 'tw_flight_tracers';
    scene.add(tracerGroup);
    const geo = new THREE.BoxGeometry(0.03, 0.03, 0.6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffce6a, toneMapped: false, transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0; i < TRACER_POOL; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      m.renderOrder = 30;
      m.raycast = () => {};
      tracerGroup.add(m);
      tracers.push({ mesh: m, vel: new THREE.Vector3(), life: 0, active: false });
    }
  }

  function spawnTracer(origin, dir) {
    const t = tracers.find(s => !s.active);
    if (!t) return;
    t.active = true;
    t.life = TRACER_LIFE;
    t.vel.copy(dir).multiplyScalar(TRACER_SPEED);
    t.mesh.position.copy(origin);
    t.mesh.quaternion.copy(_tracerQuat.setFromUnitVectors(_projForward, dir));
    t.mesh.visible = true;
  }

  function updateTracers(dt) {
    for (const t of tracers) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) { t.active = false; t.mesh.visible = false; continue; }
      t.mesh.position.addScaledVector(t.vel, dt);
    }
  }

  function fireGuns() {
    if (!jet) return;
    const dir = window.__flightSceneForward
      ? window.__flightSceneForward(_fireDir)
      : _fireDir.set(0, 0, -1);
    for (const local of [gunMuzzleL, gunMuzzleR]) {
      _muzzleWorld.copy(local);
      jet.localToWorld(_muzzleWorld);
      spawnTracer(_muzzleWorld, dir);
      attemptInstantHit(_muzzleWorld, dir); // no-op until a later task
    }
    shotsFired++;
  }

  function attemptInstantHit(origin, dir) { /* implemented in a later task */ }

  // ---- bbox-derived muzzle offsets ----
  // _bbox yields WORLD-space extents. Because fireGuns uses jet.localToWorld
  // (which re-applies the jet's world scale), we convert the world extents to
  // LOCAL units by dividing out that scale before storing them as offsets.
  // deriveMuzzles() also guards the GLB load race: a not-yet-loaded model gives
  // a tiny placeholder box (<0.3 world units); in that case it returns false and
  // tick() retries each frame until the real geometry is present.
  const _bbox = new THREE.Box3();
  const _bsize = new THREE.Vector3();
  const _bscale = new THREE.Vector3();
  let muzzlesReady = false;

  function deriveMuzzles() {
    if (!jet) return false;
    jet.updateMatrixWorld(true);
    _bbox.setFromObject(jet);
    if (_bbox.isEmpty()) return false;
    _bbox.getSize(_bsize);
    // Guard the load race: a not-yet-loaded GLB gives a tiny placeholder box.
    const maxDim = Math.max(_bsize.x, _bsize.y, _bsize.z);
    if (maxDim < 0.3) return false; // model not loaded yet; retry next tick
    // _bsize is WORLD size; convert to LOCAL units by dividing out the jet's
    // world scale, because fireGuns applies jet.localToWorld (which re-applies
    // that scale). Storing world-size as a local offset would double-count it.
    jet.getWorldScale(_bscale);
    const localX = _bsize.x / (Math.abs(_bscale.x) || 1);
    const localY = _bsize.y / (Math.abs(_bscale.y) || 1);
    const localZ = _bsize.z / (Math.abs(_bscale.z) || 1);
    // jet carries FLIGHT_MODEL_FWD_FIX so the VISUAL nose is +Z in jet-local.
    // Muzzles sit out along local X (wings), toward the visual nose (+Z),
    // slightly below center.
    const halfSpan = localX * 0.5 * 0.62;
    const noseZ = localZ * 0.5 * 0.55;
    const dropY = -localY * 0.05;
    gunMuzzleL.set(-halfSpan, dropY, noseZ);
    gunMuzzleR.set(halfSpan, dropY, noseZ);
    return true;
  }

  // ---- HUD overlay + reticle ----
  let overlayEl = null, reticleEl = null;

  // ---- target HUD pool ----
  const HUD_TARGET_LIMIT = 6;
  const hudPool = [];
  let lockId = ''; // set by the lock system in a later task
  function ensureHudPool() {
    if (hudPool.length || !overlayEl) return;
    for (let i = 0; i < HUD_TARGET_LIMIT; i++) {
      const bracket = document.createElement('div');
      bracket.className = 'fc-target-bracket';
      bracket.style.display = 'none';
      const card = document.createElement('div');
      card.className = 'fc-target-card';
      card.style.display = 'none';
      overlayEl.appendChild(bracket);
      overlayEl.appendChild(card);
      hudPool.push({ bracket, card });
    }
  }

  const _tpos = new THREE.Vector3();
  const _tproj = new THREE.Vector3();
  const _camPos = new THREE.Vector3();
  function updateTargetHud() {
    if (!overlayEl) return;
    camera.getWorldPosition(_camPos);
    let used = 0;
    for (const tgt of targets) {
      if (used >= HUD_TARGET_LIMIT) break;
      tgt.getWorldPos(_tpos);
      _tproj.copy(_tpos).project(camera);
      if (_tproj.z > 1) continue; // behind camera / beyond far plane
      const sx = (_tproj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_tproj.y * 0.5 + 0.5) * window.innerHeight;
      const dist = _camPos.distanceTo(_tpos);
      const px = Math.max(18, Math.min(160, (tgt.radius * 2 / Math.max(0.001, dist)) * window.innerHeight * 0.9));
      const slot = hudPool[used++];
      slot.bracket.style.display = 'block';
      slot.bracket.style.left = (sx - px / 2) + 'px';
      slot.bracket.style.top = (sy - px / 2) + 'px';
      slot.bracket.style.width = px + 'px';
      slot.bracket.style.height = px + 'px';
      slot.bracket.classList.toggle('locked', tgt.id === lockId);
      slot.card.style.display = 'block';
      slot.card.style.left = (sx + px / 2 + 4) + 'px';
      slot.card.style.top = (sy - px / 2) + 'px';
      const altU = Math.round(tgt._pos ? tgt._pos.y : 0);
      slot.card.textContent =
        tgt.label() + '\nDST ' + Math.round(dist) +
        '\nSPD ' + Math.round(tgt.speedKts()) + 'kt' +
        '\nALT ' + altU;
    }
    for (let i = used; i < hudPool.length; i++) {
      hudPool[i].bracket.style.display = 'none';
      hudPool[i].card.style.display = 'none';
    }
  }
  const reticleState = { x: 0, y: 0, vx: 0, vy: 0, init: false };
  const _aimWorld = new THREE.Vector3();
  const _aimProj = new THREE.Vector3();
  const _aimUp = new THREE.Vector3();

  function ensureOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'flight-combat-overlay';
    reticleEl = document.createElement('div');
    reticleEl.id = 'flight-reticle';
    overlayEl.appendChild(reticleEl);
    document.body.appendChild(overlayEl);
  }

  function updateReticle(dt) {
    if (!jet || !reticleEl) return;
    const dir = window.__flightSceneForward(_fireDir);
    jet.getWorldPosition(_aimWorld);
    // Aim point: lookahead along the fire dir, biased slightly up so the sight
    // sits above the nose for practical gunnery.
    _aimWorld.addScaledVector(dir, 60).add(_aimUp.set(0, 1.2, 0));
    _aimProj.copy(_aimWorld).project(camera); // NDC -1..1
    const tx = (_aimProj.x * 0.5 + 0.5) * window.innerWidth;
    const ty = (-_aimProj.y * 0.5 + 0.5) * window.innerHeight;
    if (!reticleState.init) { reticleState.x = tx; reticleState.y = ty; reticleState.init = true; }
    // critically-damped-ish spring for natural lag
    const k = 90, c = 18;
    reticleState.vx += (-(reticleState.x - tx) * k - reticleState.vx * c) * dt;
    reticleState.vy += (-(reticleState.y - ty) * k - reticleState.vy * c) * dt;
    reticleState.x += reticleState.vx * dt;
    reticleState.y += reticleState.vy * dt;
    const behind = _aimProj.z > 1;
    reticleEl.style.display = behind ? 'none' : 'block';
    reticleEl.style.left = reticleState.x + 'px';
    reticleEl.style.top = reticleState.y + 'px';
  }

  function onEnter(flyingJet) {
    jet = flyingJet || window.__flightJet || null;
    active = true;
    fireCooldown = 0;
    shotsFired = 0;
    ensureTracerPool();
    ensureOverlay();
    ensureHudPool();
    reticleState.init = false;
    muzzlesReady = deriveMuzzles();
  }

  function onExit() {
    active = false;
    jet = null;
    for (const slot of hudPool) { slot.bracket.style.display = 'none'; slot.card.style.display = 'none'; }
  }

  function tick(dt) {
    if (!active || !(dt > 0)) return;
    fireCooldown = Math.max(0, fireCooldown - dt);
    if (!muzzlesReady) muzzlesReady = deriveMuzzles();
    collectTargets(dt);
    const keys = window.__flightKeys || {};
    const firing = !!keys['Space'] || !!window.__flightFireHeld;
    if (firing && fireCooldown <= 0) {
      fireGuns();
      fireCooldown = FIRE_COOLDOWN;
    }
    updateTracers(dt);
    updateReticle(dt);
    updateTargetHud();
  }

  function telemetry() {
    const dir = (active && window.__flightSceneForward)
      ? window.__flightSceneForward(_fireDir).clone() : null;
    return {
      active, hasJet: !!jet, shotsFired,
      fireDir: dir ? { x: dir.x, y: dir.y, z: dir.z } : null,
      muzzleL: jet ? jet.localToWorld(gunMuzzleL.clone()).toArray() : null,
      muzzleR: jet ? jet.localToWorld(gunMuzzleR.clone()).toArray() : null,
      reticle_x: reticleState.x,
      reticle_y: reticleState.y,
      targetCount: targets.length,
    };
  }

  window.__flightCombat = { onEnter, onExit, tick, telemetry };
})();
