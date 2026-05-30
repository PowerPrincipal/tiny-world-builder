  // -------- flyable plane (stunt-plane flight) --------
  // Ports the arcade flight model from the standalone ships/flight-sim onto the
  // existing crop-duster GLB (skinned with the same Polygon_Plane textures).
  // A placed 'plane' object can be clicked in Select mode to ENTER flight: the
  // camera swaps to a rear chase-cam and WASD/QE + Shift/Ctrl fly the plane with
  // the ships physics. Escape lands you back in the normal editor view.
  //
  // The ships model is tuned for a kilometre-scale world (cruise ~77 m/s), so we
  // run the physics untouched in "sim space" and map it into the tiny scene via
  // a single similarity transform (uniform FLIGHT_SIM_TO_SCENE scale + the placed
  // plane's spawn yaw + its spawn position). Feel is preserved; the visual stays
  // inside the tiny world.

  const FLIGHT_SIM_TO_SCENE = 0.09;        // sim metres -> tiny-world units
  // The stunt_plane GLB's nose is +Z (the crop-duster aligns +Z with travel),
  // but the ships physics forward is -Z. Rotate the rendered model 180 about Y
  // so its visual nose matches the physics nose / direction of motion.
  const FLIGHT_MODEL_FWD_FIX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

  // Tuned flight constants lifted verbatim from ships/flight-sim3.html.
  const FCFG = {
    GRAVITY: 9.81,
    MAX_THRUST: 45,
    IDLE_THRUST_FRAC: 0.13,
    LIFT_K: 0.080,
    CL0: 0.14,
    CL_ALPHA: 4.5,
    DRAG_PARASITE: 0.025,
    DRAG_INDUCED: 0.030,
    GEAR_DRAG: 0.00020,
    GEAR_HEIGHT: 2.3,
    STALL_AOA: 0.30,
    MAX_ANG_VEL: 3.2,
    MAX_PITCH_RATE: 1.55,
    MAX_ROLL_RATE: 2.35,
    MAX_YAW_RATE: 0.82,
  };

  const flightClamp01 = t => Math.max(0, Math.min(1, t));
  function flightSmoothstepRange(edge0, edge1, x) {
    const t = flightClamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }
  function flightShapeInput(value, expo) {
    const v = Math.max(-1, Math.min(1, value));
    const e = expo == null ? 0.04 : expo;
    return v * (1 - e) + v * Math.abs(v) * e;
  }
  function flightSmoothSigned(current, target, dt, rise, fall) {
    const targetAbs = Math.abs(target);
    const currentAbs = Math.abs(current);
    const changingDirection = current * target < -0.001;
    const rate = (targetAbs > currentAbs || changingDirection) ? rise : fall;
    return current + (target - current) * (1 - Math.exp(-rate * dt));
  }

  // -------- flight state --------
  const flightPlane = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    angVel: new THREE.Vector3(),
    throttle: 0,
    throttleTarget: 0,
    gear: 1,
    brake: 0,
    onGround: true,
  };
  const flightCtl = { pitch: 0, roll: 0, yaw: 0, throttleUp: 0, throttleDown: 0 };
  let flightActive = false;
  let flightCam = null;
  let flightPrevCamera = null;
  let flightCell = null;            // { x, z } of the parked plane
  let flightJet = null;             // the cell object group being flown
  let flightProp = null;            // optional propeller child to spin
  let flightSimGroundY = 0;         // flat sim-space takeoff ground height
  let flightLeftGround = false;     // once true, no ground clamp (fly anywhere)
  const flightSceneOrigin = new THREE.Vector3();
  const flightYawQuat = new THREE.Quaternion();
  const flightKeys = {};

  // sim-space -> scene-space similarity transform
  const _flf0 = new THREE.Vector3();
  function flightSimToScene(out, simPos) {
    out.copy(simPos).sub(flightPlane.__simOrigin).multiplyScalar(FLIGHT_SIM_TO_SCENE);
    out.applyQuaternion(flightYawQuat).add(flightSceneOrigin);
    return out;
  }
  flightPlane.__simOrigin = new THREE.Vector3();

  // -------- physics (trimmed port of updatePhysics) --------
  const _flfFwd = new THREE.Vector3();
  const _flfUp = new THREE.Vector3();
  const _flfRight = new THREE.Vector3();
  const _flfInvQ = new THREE.Quaternion();
  const _flfLocalVel = new THREE.Vector3();
  const _flfRightWorld = new THREE.Vector3();
  const _flfWorldUpLocal = new THREE.Vector3();
  const _flfEuler = new THREE.Euler();
  const _flfDQ = new THREE.Quaternion();
  const _flfLift = new THREE.Vector3();
  const _flfSlip = new THREE.Vector3();
  const _flfDrag = new THREE.Vector3();
  const _flfThrust = new THREE.Vector3();
  const _flfAccel = new THREE.Vector3();
  const _flfGravity = new THREE.Vector3();

  function updateFlightPhysics(dt) {
    const p = flightPlane;
    const k = flightKeys;

    // ----- input -----
    const keyPitchIn = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0); // W = nose up / climb
    const keyRollIn = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0);
    const keyYawIn = ((k['KeyE'] || k['ArrowRight']) ? 1 : 0) - ((k['KeyQ'] || k['ArrowLeft']) ? 1 : 0);
    flightCtl.pitch = flightSmoothSigned(flightCtl.pitch, flightShapeInput(keyPitchIn, 0.04), dt, 70, 48);
    flightCtl.roll = flightSmoothSigned(flightCtl.roll, flightShapeInput(keyRollIn, 0.04), dt, 82, 52);
    flightCtl.yaw = flightSmoothSigned(flightCtl.yaw, flightShapeInput(keyYawIn, 0.08), dt, 58, 38);
    const pitchIn = flightCtl.pitch, rollIn = flightCtl.roll, yawIn = flightCtl.yaw;

    const throttleUpIn = (k['ShiftLeft'] || k['ShiftRight'] || k['ArrowUp']) ? 1 : 0;
    const throttleDownIn = (k['ControlLeft'] || k['ControlRight'] || k['ArrowDown']) ? 1 : 0;
    flightCtl.throttleUp += (throttleUpIn - flightCtl.throttleUp) * (1 - Math.exp(-18 * dt));
    flightCtl.throttleDown += (throttleDownIn - flightCtl.throttleDown) * (1 - Math.exp(-18 * dt));
    if (flightCtl.throttleUp > 0.01) p.throttleTarget = Math.min(1, p.throttleTarget + dt * 4.5 * flightCtl.throttleUp);
    if (flightCtl.throttleDown > 0.01) p.throttleTarget = Math.max(0, p.throttleTarget - dt * 3.6 * flightCtl.throttleDown);
    p.throttle += (p.throttleTarget - p.throttle) * (1 - Math.exp(-16 * dt));
    p.brake = k['KeyB'] ? 1 : 0;

    // ----- frames & airspeed -----
    const forward = _flfFwd.set(0, 0, -1).applyQuaternion(p.quat);
    const up = _flfUp.set(0, 1, 0).applyQuaternion(p.quat);
    const right = _flfRight.set(1, 0, 0).applyQuaternion(p.quat);
    const invQ = _flfInvQ.copy(p.quat).invert();
    const localVel = _flfLocalVel.copy(p.vel).applyQuaternion(invQ);
    const forwardSpeed = -localVel.z;
    const speed = p.vel.length();
    let aoa = 0;
    if (Math.abs(forwardSpeed) > 0.5) aoa = Math.atan2(-localVel.y, Math.max(1, forwardSpeed));

    const q = Math.max(0, forwardSpeed);
    const loSpeedFade = Math.max(0.55, Math.min(1, (q - 10) / 30));
    const hiSpeedDamp = 1 / (1 + Math.max(0, (q - 55)) * 0.020);
    const maneuverBand = flightSmoothstepRange(24, 42, q) * (1 - flightSmoothstepRange(58, 88, q));
    const rollScale = Math.sqrt(loSpeedFade) * Math.max(0.50, hiSpeedDamp) * (1 + maneuverBand * 0.18);
    const pitchScale = Math.sqrt(loSpeedFade) * Math.max(0.56, hiSpeedDamp) * (1 + maneuverBand * 0.12);
    const yawScale = loSpeedFade * hiSpeedDamp * (1 + maneuverBand * 0.14);
    const authPitch = Math.min(1.0, q / 34) * pitchScale;
    const authRoll = Math.min(1.0, q / 30) * rollScale;
    const authYaw = Math.min(0.72, q / 72) * yawScale;

    // ----- torque -----
    p.angVel.x += pitchIn * 2.35 * authPitch * dt;
    p.angVel.z += -rollIn * 4.15 * authRoll * dt;
    p.angVel.y += -yawIn * 1.20 * authYaw * dt;
    const rateAuthPitch = Math.max(p.onGround ? 0.40 : 0.62, authPitch);
    const rateAuthRoll = Math.max(p.onGround ? 0.30 : 0.72, authRoll);
    const rateAuthYaw = Math.max(0.46, authYaw);
    if (Math.abs(pitchIn) > 0.015) p.angVel.x += (pitchIn * 2.6 * rateAuthPitch - p.angVel.x) * (1 - Math.exp(-12.0 * dt));
    if (Math.abs(rollIn) > 0.015) p.angVel.z += (-rollIn * 3.6 * rateAuthRoll - p.angVel.z) * (1 - Math.exp(-13.0 * dt));
    if (Math.abs(yawIn) > 0.015) p.angVel.y += (-yawIn * 1.5 * rateAuthYaw - p.angVel.y) * (1 - Math.exp(-10.0 * dt));

    // ----- auto-rudder + self-level (turn coordination) -----
    const rightWorld = _flfRightWorld.set(1, 0, 0).applyQuaternion(p.quat);
    const bankSign = rightWorld.y, bankAmount = Math.abs(bankSign);
    if (bankAmount > 0.17 && q > 25) p.angVel.y += bankSign * bankAmount * 0.24 * authYaw * dt;
    if (Math.abs(rollIn) > 0.01 && q > 25) p.angVel.y += -rollIn * 0.08 * authYaw * dt;
    const worldUpLocal = _flfWorldUpLocal.set(0, 1, 0).applyQuaternion(invQ);
    p.angVel.z += -worldUpLocal.x * 0.6 * authRoll * dt;
    p.angVel.y += -localVel.x * 0.002 * authYaw * dt;

    // ----- damping + clamps -----
    p.angVel.x *= Math.pow(0.22, dt);
    p.angVel.z *= Math.pow(0.05, dt);
    p.angVel.y *= Math.pow(0.08, dt);
    p.angVel.x = Math.max(-FCFG.MAX_PITCH_RATE, Math.min(FCFG.MAX_PITCH_RATE, p.angVel.x));
    p.angVel.z = Math.max(-FCFG.MAX_ROLL_RATE, Math.min(FCFG.MAX_ROLL_RATE, p.angVel.z));
    p.angVel.y = Math.max(-FCFG.MAX_YAW_RATE, Math.min(FCFG.MAX_YAW_RATE, p.angVel.y));
    if (p.angVel.length() > FCFG.MAX_ANG_VEL) p.angVel.setLength(FCFG.MAX_ANG_VEL);

    // integrate rotation
    p.quat.multiply(_flfDQ.setFromEuler(_flfEuler.set(p.angVel.x * dt, p.angVel.y * dt, p.angVel.z * dt, 'XYZ'))).normalize();

    // ----- aerodynamic forces -----
    let cl;
    const aoaAbs = Math.abs(aoa);
    if (aoaAbs <= FCFG.STALL_AOA) {
      cl = FCFG.CL0 + FCFG.CL_ALPHA * aoa;
    } else {
      const peak = FCFG.CL_ALPHA * FCFG.STALL_AOA;
      const excess = aoaAbs - FCFG.STALL_AOA;
      const fade = Math.min(1, excess / 0.20);
      const degraded = peak * (1 - fade * 0.30);
      cl = FCFG.CL0 + Math.sign(aoa) * Math.max(peak * 0.55, degraded);
    }
    const v = Math.max(0, forwardSpeed);
    const aglForGE = Math.max(0, p.pos.y - flightSimGroundY);
    const groundEffect = 1 + 0.35 * Math.exp(-aglForGE / 12);
    const liftMag = FCFG.LIFT_K * v * v * cl * groundEffect;
    const lift = _flfLift.copy(up).multiplyScalar(liftMag);
    const slipSpeed = localVel.x;
    const slipDamping = _flfSlip.copy(right).multiplyScalar(-slipSpeed * Math.min(1.25, q / 42) * (0.68 + bankAmount * 0.32));
    const cd = FCFG.DRAG_PARASITE + FCFG.DRAG_INDUCED * cl * cl + FCFG.GEAR_DRAG * p.gear;
    const dragMag = cd * speed * speed;
    const drag = _flfDrag.set(0, 0, 0);
    if (speed > 0.01) drag.copy(p.vel).normalize().multiplyScalar(-dragMag);
    const engineEngaged = p.throttle > 0.03 || p.throttleTarget > 0.03;
    const effectiveThrottle = p.onGround ? p.throttle : (engineEngaged ? Math.max(FCFG.IDLE_THRUST_FRAC, p.throttle) : 0);
    const takeoffBoost = p.onGround ? 1.78 : (q < 76 && p.throttle > 0.74 ? 1.22 : 1.0);
    const thrust = _flfThrust.copy(forward).multiplyScalar(effectiveThrottle * FCFG.MAX_THRUST * 1.28 * takeoffBoost);
    const gravity = _flfGravity.set(0, -FCFG.GRAVITY, 0);

    // stall protection (stick pusher) near the ground/danger zone
    if (q < 35 && aoa > 0.22 && p.vel.y < 0 && p.pos.y > flightSimGroundY + 3) {
      const urgency = Math.min(1, (0.32 - Math.min(aoa, 0.32)) / 0.10 + (35 - q) / 15);
      p.angVel.x += -1.6 * Math.max(0.3, urgency) * dt;
    }

    const accel = _flfAccel.set(0, 0, 0).add(thrust).add(lift).add(slipDamping).add(drag).add(gravity);
    p.vel.addScaledVector(accel, dt);
    p.pos.addScaledVector(p.vel, dt);

    // ----- ground interaction -----
    // Clamp to the flat takeoff ground only until the plane has clearly left it.
    // Once airborne, flight is UNCONSTRAINED: climb high, dive low, fly under the
    // islands — there is no ground or island collision in the air.
    if (!flightLeftGround) {
      const wheelAlt = (p.pos.y - flightSimGroundY) - FCFG.GEAR_HEIGHT * p.gear;
      if (wheelAlt <= 0.02) {
        p.pos.y = flightSimGroundY + FCFG.GEAR_HEIGHT * p.gear;
        if (p.vel.y < 0) p.vel.y = 0;
        p.onGround = true;
        const fric = p.brake ? 2.4 : 0.5;
        p.vel.x -= p.vel.x * Math.min(1, fric * dt);
        p.vel.z -= p.vel.z * Math.min(1, fric * dt);
      } else {
        p.onGround = false;
        if ((p.pos.y - flightSimGroundY) > FCFG.GEAR_HEIGHT + 2.5) flightLeftGround = true;
      }
    } else {
      p.onGround = false;
    }
  }

  // -------- chase camera (trimmed port of updateCamera) --------
  // Chase cam is framed in SCENE units (the plane is ~1.35 units wide), NOT in
  // sim units — do not run these through flightSimToScene's 0.05 scale.
  const _flCamSceneQuat = new THREE.Quaternion();   // smoothed scene follow orientation
  let _flCamInit = false;
  const _flcamPlanePos = new THREE.Vector3();        // plane position in scene space
  const _flcamPlaneQuat = new THREE.Quaternion();
  const _flcamFwd = new THREE.Vector3();
  const _flcamUp = new THREE.Vector3();
  const _flcamDesired = new THREE.Vector3();
  const _flcamLook = new THREE.Vector3();

  function updateFlightCamera(dt) {
    const p = flightPlane;
    // plane transform in SCENE space
    flightSimToScene(_flcamPlanePos, p.pos);
    _flcamPlaneQuat.copy(flightYawQuat).multiply(p.quat);
    if (!_flCamInit) { _flCamSceneQuat.copy(_flcamPlaneQuat); _flCamInit = true; }
    const catchup = 1 - Math.exp(-(p.onGround ? 14.0 : 8.5) * dt);
    _flCamSceneQuat.slerp(_flcamPlaneQuat, catchup);
    const fwd = _flcamFwd.set(0, 0, -1).applyQuaternion(_flCamSceneQuat).normalize();
    const speedKts = p.vel.length() * 1.94;
    // Scene-unit framing: ~6 units behind, more at speed; ~2.6 up.
    const backDist = 6.0 + flightClamp01((speedKts - 40) / 200) * 4.5;
    const height = 2.6;
    _flcamDesired.copy(_flcamPlanePos).addScaledVector(fwd, -backDist).add(_flcamUp.set(0, height, 0));
    const followK = 8.5, t = 1 - Math.exp(-followK * dt);
    flightCam.position.lerp(_flcamDesired, t);
    flightCam.up.set(0, 1, 0);
    // look slightly above + ahead of the plane so it sits low-centre in frame
    _flcamLook.copy(_flcamPlanePos).addScaledVector(fwd, 2.0).add(_flcamUp.set(0, 0.6, 0));
    flightCam.lookAt(_flcamLook);
  }

  // -------- per-frame tick (called from animate) --------
  const _fljetScenePos = new THREE.Vector3();
  const _fljetQuat = new THREE.Quaternion();
  function tickFlight(dt) {
    if (!flightActive || dt <= 0) return;
    updateFlightPhysics(dt);
    if (flightJet) {
      flightSimToScene(_fljetScenePos, flightPlane.pos);
      flightJet.position.copy(_fljetScenePos);
      flightJet.quaternion.copy(_fljetQuat.copy(flightYawQuat).multiply(flightPlane.quat).multiply(FLIGHT_MODEL_FWD_FIX));
      if (flightProp) flightProp.rotation.z += 220 * dt;
    }
    updateFlightCamera(dt);
  }
  window.tickFlight = tickFlight;

  // -------- enter / exit --------
  // The flyable plane is the existing crop-duster/stunt-plane MODEL-STAMP
  // (models/stunt_plane.glb), placed via the Stamps system as a 'model-stamp'
  // cell. We detect it by the stamp asset signature, not a bespoke kind.
  function isFlyableStampCell(cell) {
    if (!cell || cell.kind !== 'model-stamp') return false;
    const id = cell.appearance && cell.appearance.modelStampId;
    if (!id) return false;
    const asset = (typeof getModelStamp === 'function') ? getModelStamp(id) : null;
    const sig = (asset ? (asset.id + ' ' + (asset.label || '') + ' ' + (asset.path || '')) : id).toLowerCase();
    return /plane|aircraft|airplane|stunt|crop-?duster|jet/.test(sig);
  }
  window.isFlyableStampCell = isFlyableStampCell;

  function enterFlight(x, z) {
    if (flightActive) return false;
    const cell = (typeof getWorldCell === 'function') ? getWorldCell(x, z) : (world[x] && world[x][z]);
    if (!isFlyableStampCell(cell)) return false;
    const entry = cellMeshes[x + ',' + z];
    const jet = entry && entry.object;
    if (!jet) return false;

    flightActive = true;
    flightCell = { x, z };
    flightJet = jet;
    window.__flightJet = jet;
    // find a propeller child to spin (cosmetic; optional)
    flightProp = null;
    jet.traverse(o => {
      if (!flightProp && o.isMesh && /prop(eller)?|blade|spinner|rotor|fan/i.test(o.name || '')) flightProp = o;
    });

    // spawn transform from the parked plane
    jet.getWorldPosition(flightSceneOrigin);
    const yaw = jet.rotation.y || 0;
    flightYawQuat.setFromEuler(new THREE.Euler(0, yaw + Math.PI, 0, 'XYZ'));

    flightPlane.pos.set(0, FCFG.GEAR_HEIGHT, 0);
    flightPlane.__simOrigin.copy(flightPlane.pos);
    flightSimGroundY = 0;
    flightLeftGround = true;            // launch airborne — no runway, instantly flyable
    flightPlane.vel.set(0, 0, -34);     // initial cruise speed along the nose (-Z)
    flightPlane.angVel.set(0, 0, 0);
    flightPlane.quat.identity();
    flightPlane.throttle = 0.6;
    flightPlane.throttleTarget = 0.6;
    flightPlane.gear = 1;
    flightPlane.brake = 0;
    flightPlane.onGround = false;
    flightCtl.pitch = flightCtl.roll = flightCtl.yaw = 0;
    flightCtl.throttleUp = flightCtl.throttleDown = 0;
    for (const key in flightKeys) flightKeys[key] = false;
    _flCamInit = false;

    // dedicated chase camera, swap the render camera
    if (!flightCam) flightCam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 600);
    flightCam.aspect = window.innerWidth / window.innerHeight;
    flightCam.updateProjectionMatrix();
    flightPrevCamera = camera;
    camera = flightCam;

    document.body.classList.add('flight-active');
    window.__flightActive = true;
    showFlightHud(true);
    return true;
  }

  function exitFlight() {
    if (!flightActive) return;
    flightActive = false;
    camera = flightPrevCamera || camera;
    flightPrevCamera = null;
    document.body.classList.remove('flight-active');
    window.__flightActive = false;
    showFlightHud(false);
    // restore the parked plane to its resting transform
    if (flightCell && typeof renderCellObject === 'function') {
      renderCellObject(flightCell.x, flightCell.z, { animate: false, impactDust: false });
    }
    flightJet = null;
    window.__flightJet = null;
    flightCell = null;
    if (typeof updateCamera === 'function') updateCamera();
  }
  window.enterFlight = enterFlight;
  window.exitFlight = exitFlight;

  // -------- minimal HUD + entry menu --------
  let flightHudEl = null;
  function showFlightHud(on) {
    if (on && !flightHudEl) {
      flightHudEl = document.createElement('div');
      flightHudEl.className = 'flight-hud';
      flightHudEl.innerHTML = 'FLYING &middot; W/S pitch &middot; A/D roll &middot; Q/E yaw &middot; Shift/Ctrl throttle &middot; B brake &middot; <b>Esc</b> exit';
      document.body.appendChild(flightHudEl);
    }
    if (flightHudEl) flightHudEl.style.display = on ? 'block' : 'none';
  }

  let flightMenuEl = null;
  function hideFlightMenu() {
    if (flightMenuEl) { flightMenuEl.remove(); flightMenuEl = null; }
  }
  function showFlightMenu(x, z, clientX, clientY) {
    hideFlightMenu();
    const m = document.createElement('div');
    m.className = 'flight-menu';
    m.style.left = clientX + 'px';
    m.style.top = clientY + 'px';
    const fly = document.createElement('button');
    fly.className = 'flight-menu-btn';
    fly.textContent = 'Enter / Fly';
    fly.addEventListener('click', () => { hideFlightMenu(); enterFlight(x, z); });
    m.appendChild(fly);
    document.body.appendChild(m);
    flightMenuEl = m;
    setTimeout(() => {
      window.addEventListener('pointerdown', function onAway(e) {
        if (flightMenuEl && !flightMenuEl.contains(e.target)) { hideFlightMenu(); window.removeEventListener('pointerdown', onAway); }
      });
    }, 0);
  }
  window.showFlightMenu = showFlightMenu;

  // -------- key capture while flying --------
  const FLIGHT_KEYCODES = {
    KeyW: 1, KeyS: 1, KeyA: 1, KeyD: 1, KeyQ: 1, KeyE: 1, KeyB: 1,
    ShiftLeft: 1, ShiftRight: 1, ControlLeft: 1, ControlRight: 1,
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
  };
  window.addEventListener('keydown', e => {
    if (!flightActive) return;
    if (e.code === 'Escape') { exitFlight(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (FLIGHT_KEYCODES[e.code]) {
      flightKeys[e.code] = true;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('keyup', e => {
    if (!flightActive) return;
    if (FLIGHT_KEYCODES[e.code]) {
      flightKeys[e.code] = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('resize', () => {
    if (flightCam) { flightCam.aspect = window.innerWidth / window.innerHeight; flightCam.updateProjectionMatrix(); }
  });

  // track last pointer position so the Select-mode Fly menu can anchor to it
  window.__flightPointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => { window.__flightPointer.x = e.clientX; window.__flightPointer.y = e.clientY; }, true);


