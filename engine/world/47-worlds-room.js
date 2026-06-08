  // Worlds MMO — published-world room client. Connects to the authoritative
  // PartyKit room ('world-<slug>'), keeps the local mirror of you / peers / nodes /
  // animals, renders a 2D minimap, and turns input into server-validated move /
  // harvest requests. The 3D scene shows the world's tiles via applyState().
  //
  // Exposes window.__tinyworldWorlds.enterRoom/leaveRoom/harvest + a tiny event
  // emitter the HUD (48) subscribes to. IIFE-wrapped; no globals leak.
  (function wireWorldsRoom() {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function T(k, p) { return typeof window.t === 'function' ? window.t(k, p) : k; }
    function toast(m) { if (typeof twToast === 'function') twToast(m); else console.log('[worlds]', m); }
  
    // ---- tiny event emitter ----
    const listeners = {};
    function on(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); }
    function emit(ev, data) { (listeners[ev] || []).forEach(cb => { try { cb(data); } catch (_) {} }); }
    WS.on = on;
  
    // ---- room state ----
    let socket = null;
    let world = null;
    let token = '';
    let role = 'play';
    let gridSize = 8;
    let taxPercent = null;
    let you = { x: 0, z: 0, hearts: 10, role: 'play' };
    let myId = '';
    const peers = new Map();
    let nodes = {};
    let animals = [];
    let cells = [];           // tile cells for minimap (from world.data)
    let connected = false;
  
    function host() {
      const explicit = window.__TINY_WORLD_PARTYKIT_HOST__ || '';
      const h = String(explicit || '').trim().replace(/\/+$/, '');
      if (h) return h.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://localhost:1999';
      return 'wss://tinyworld-shared-building.jasonkneen.partykit.dev';
    }
    function connToken() {
      try {
        let v = localStorage.getItem('tinyworld:multiplayer:client-id');
        if (!v) { v = 'u_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('tinyworld:multiplayer:client-id', v); }
        return v;
      } catch (_) { return 'u_' + Math.random().toString(36).slice(2, 10); }
    }
    function playerName() {
      try { return (localStorage.getItem('tinyworld:multiplayer:name') || '').slice(0, 48) || 'Player'; } catch (_) { return 'Player'; }
    }
  
    function send(obj) { if (socket && socket.readyState === 1) socket.send(JSON.stringify(obj)); }

    // Compact [x,z,terrain,kind?] tuples — small enough for the join envelope and
    // exactly what the server's deriveWorldState() consumes to seed nodes.
    function compactCells(data) {
      const out = [];
      const cs = (data && Array.isArray(data.cells)) ? data.cells : [];
      for (const c of cs) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z;
        if (x == null || z == null) continue;
        const ter = (Array.isArray(c) ? c[2] : c.terrain) || 'grass';
        const k = Array.isArray(c) ? c[3] : c.kind;
        out.push(k ? [x, z, ter, k] : [x, z, ter]);
        if (out.length >= 1500) break;
      }
      return out;
    }

    let stateTimer = null, sawWorldState = false;
    function enterRoom(w, joinToken) {
      leaveRoom();
      world = w; token = joinToken || ''; role = 'play';
      gridSize = w.gridSize || 8; taxPercent = w.taxPercent != null ? w.taxPercent : null;
      cells = w.data && Array.isArray(w.data.cells) ? w.data.cells : [];
      rebuildBlocked();
      if (w.data && typeof applyState === 'function') { try { applyState(w.data); } catch (_) {} }
      // One map: hide the builder's own minimap, and lock out builder tools.
      hideBaseMinimap(true);
      if (typeof WS.setPlayChrome === 'function') WS.setPlayChrome(true);
      emit('enter', { world: w, role });
      const roomId = 'world-' + w.slug;
      const url = host() + '/party/' + encodeURIComponent(roomId) + '?_pk=' + encodeURIComponent(connToken());
      try { socket = new WebSocket(url); } catch (_) { toast(T('worlds.error')); return; }
      sawWorldState = false;
      socket.addEventListener('open', () => {
        connected = true;
        send({
          type: 'world.join', token, worldId: w.id, name: playerName(),
          role, profileId: (WS.myProfileId != null ? WS.myProfileId : null),
          gridSize, cells: compactCells(w.data), taxPercent: w.taxPercent, ownerProfileId: w.ownerProfileId,
        });
        emit('status', { connected: true });
        // If the room never answers with world.state, it's an un-upgraded server.
        if (stateTimer) clearTimeout(stateTimer);
        stateTimer = setTimeout(() => { if (!sawWorldState) { toast(T('worlds.serverOld')); WS.leaveRoom(); } }, 4000);
      });
      socket.addEventListener('close', () => { connected = false; emit('status', { connected: false }); });
      socket.addEventListener('message', (e) => { const d = safeParse(e.data); if (d) onMessage(d); });
      bindInput();
      showMinimap();
      startAvatars();
    }
    WS.enterRoom = enterRoom;
  
    function leaveRoom() {
      cancelWalk();
      stopAvatars();
      if (socket) { try { socket.close(); } catch (_) {} socket = null; }
      connected = false; peers.clear(); nodes = {}; animals = [];
      unbindInput(); hideMinimap();
      hideBaseMinimap(false);
      if (typeof WS.setPlayChrome === 'function') WS.setPlayChrome(false);
      emit('leave', {});
    }

    // Hide/restore the builder's own minimap so there's a single in-world map.
    let baseMapEl = null, baseMapPrevDisplay = '';
    function hideBaseMinimap(hide) {
      baseMapEl = baseMapEl || document.getElementById('minimap-wrap');
      if (!baseMapEl) return;
      if (hide) { baseMapPrevDisplay = baseMapEl.style.display; baseMapEl.style.display = 'none'; }
      else { baseMapEl.style.display = baseMapPrevDisplay || ''; }
    }
    WS.leaveRoom = function () {
      leaveRoom();
      if (typeof WS.restoreFreeform === 'function') WS.restoreFreeform();
    };
  
    function safeParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }
  
    function onMessage(d) {
      switch (d.type) {
        case 'welcome':
          myId = d.id || myId; role = 'play'; emit('status', { connected: true, role });
          // An upgraded world server flags the welcome; an old collab server does
          // not — bail out so the minimap/HUD don't linger over the builder.
          if (d.world !== true) { sawWorldState = true; toast(T('worlds.serverOld')); WS.leaveRoom(); }
          break;
        case 'world.state':
          sawWorldState = true;
          gridSize = d.gridSize || gridSize; taxPercent = d.taxPercent != null ? d.taxPercent : taxPercent;
          you = Object.assign(you, d.you || {});
          you.role = 'play';
          nodes = d.nodes || {}; animals = d.animals || [];
          peers.clear(); (d.peers || []).forEach(p => { if (p.id && p.id !== myId) peers.set(p.id, p); });
          role = 'play';
          emit('state', snapshot()); drawMinimap(); updateSelfAvatar(); updatePeerAvatars(); break;
        case 'presence': {
          const p = d.presence; if (!p || !p.id) break;
          if (p.id === myId) {
            // Our own presence echo carries the authoritative position + hearts.
            if (p.cursor) { you.x = p.cursor.x; you.z = p.cursor.z; }
            if (p.hearts != null) you.hearts = p.hearts;
            emit('you', you); updateSelfAvatar();
          } else {
            peers.set(p.id, p);
            emit('peers', Array.from(peers.values())); updatePeerAvatars();
          }
          drawMinimap(); break;
        }
        case 'leave': peers.delete(d.id); emit('peers', Array.from(peers.values())); updatePeerAvatars(); drawMinimap(); break;
        case 'node.update': if (d.node && d.node.id) { if (d.node.gone) delete nodes[d.node.id]; else nodes[d.node.id] = d.node; emit('nodes', nodes); drawMinimap(); } break;
        case 'animal.spawn': if (d.animal) { animals.push(d.animal); drawMinimap(); } break;
        case 'animal.remove': animals = animals.filter(a => a.id !== d.id); drawMinimap(); break;
        case 'harvest.progress': if (d.hearts != null) { you.hearts = d.hearts; emit('you', you); } emit('progress', d); break;
        case 'harvest.result':
          if (d.hearts != null) { you.hearts = d.hearts; emit('you', you); }
          emit('result', d);
          // Track local resource counts for the HUD (server is the bank of record).
          addLocalResource(d.resource, Math.floor((d.harvesterMilli || 0) / 1000));
          break;
        case 'harvest.deny': emit('deny', d); break;
        case 'chat': emit('chat', d); break;
        case 'chat.typing': emit('typing', d); break;
        default: break;
      }
    }
  
    // Local optimistic resource tally (whole units). The authoritative balance is
    // in Postgres; this just gives the HUD immediate feedback.
    const localRes = { fish: 0, meat: 0, plants: 0, ore: 0 };
    function addLocalResource(r, n) { if (localRes[r] != null && n > 0) { localRes[r] += n; emit('resources', Object.assign({}, localRes)); } }
    WS.getResources = () => Object.assign({}, localRes);
  
    function myPresencePos() {
      // The server tracks our position and broadcasts it in presence.cursor; mirror
      // it from the latest 'you' we last saw plus presence echoes.
      return { x: you.x, z: you.z };
    }
  
    function snapshot() {
      return { world, role, gridSize, taxPercent, you, peers: Array.from(peers.values()), nodes, animals };
    }
    WS.getState = snapshot;
  
    // ---- movement + click-to-walk pathfinding ----
    const BLOCKED_KINDS = new Set(['house', 'tree', 'rock', 'fence', 'bush', 'voxel-build', 'model-stamp']);
    let blocked = new Set();   // 'x,z' cells you cannot stand on (mirrors server)
    function rebuildBlocked() {
      blocked = new Set();
      for (const c of cells) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z;
        if (x == null || z == null) continue;
        const ter = Array.isArray(c) ? c[2] : c.terrain, k = Array.isArray(c) ? c[3] : c.kind;
        if (ter === 'water' || ter === 'lava' || ter === 'stone' || (k && BLOCKED_KINDS.has(k))) blocked.add(x + ',' + z);
      }
    }
    function standable(x, z) { return x >= 0 && z >= 0 && x < gridSize && z < gridSize && !blocked.has(x + ',' + z); }

    function step(dx, dz) {
      const nx = Math.max(0, Math.min(gridSize - 1, you.x + dx));
      const nz = Math.max(0, Math.min(gridSize - 1, you.z + dz));
      if (nx === you.x && nz === you.z) return;
      if (!standable(nx, nz)) return;
      you.x = nx; you.z = nz;       // optimistic; server presence will correct
      send({ type: 'move', x: nx, z: nz });
      emit('you', you); drawMinimap(); updateSelfAvatar();
    }

    // BFS over standable cells; returns the ordered list of steps to (tx,tz).
    function findPath(tx, tz) {
      if (!standable(tx, tz)) return null;
      const start = you.x + ',' + you.z, goal = tx + ',' + tz;
      if (start === goal) return [];
      const q = [[you.x, you.z]]; const prev = new Map([[start, null]]); let head = 0;
      while (head < q.length) {
        const [x, z] = q[head++];
        if (x + ',' + z === goal) break;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz, nk = nx + ',' + nz;
          if (prev.has(nk) || !standable(nx, nz)) continue;
          prev.set(nk, x + ',' + z); q.push([nx, nz]);
        }
      }
      if (!prev.has(goal)) return null;
      const path = []; let cur = goal;
      while (cur && cur !== start) { const [x, z] = cur.split(',').map(Number); path.push([x, z]); cur = prev.get(cur); }
      return path.reverse();
    }
    let walkTimer = null;
    function cancelWalk() { if (walkTimer) { clearTimeout(walkTimer); walkTimer = null; } }
    function walkTo(tx, tz) {
      cancelWalk();
      const path = findPath(tx, tz);
      if (!path || !path.length) return;
      let i = 0;
      const next = () => {
        if (i >= path.length) { walkTimer = null; return; }
        const [nx, nz] = path[i++];
        you.x = nx; you.z = nz; send({ type: 'move', x: nx, z: nz }); emit('you', you); drawMinimap(); updateSelfAvatar();
        walkTimer = setTimeout(next, 170);
      };
      next();
    }
  
    // ---- harvest ----
    function nodeKindToAction(type) { return type === 'fish' ? 'fish' : type === 'ore' ? 'mine' : 'gather'; }
    function reach(a, b) { return Math.abs(a.x - b.x) <= 1 && Math.abs(a.z - b.z) <= 1; }
    function nodeCellPos(n) { if (!n.cell) return null; const p = n.cell.split(',').map(Number); return { x: p[0], z: p[1] }; }
  
    // Find an in-reach node/animal that matches `action` and request a harvest.
    function harvest(action) {
      cancelWalk();
      if (role !== 'play') { toast(T('worlds.observing')); return; }
      if (action === 'hunt') {
        const a = animals.find(an => reach(you, an));
        if (!a) { toast(T('worlds.actionHunt') + ' — no animal nearby'); return; }
        send({ type: 'harvest.start', action: 'hunt', animalId: a.id }); return;
      }
      for (const id of Object.keys(nodes)) {
        const n = nodes[id];
        if (!n || nodeKindToAction(n.type) !== action) continue;
        const pos = nodeCellPos(n);
        if (!pos || !reach(you, pos)) continue;
        if ((n.charges || 0) < 1 || n.locked) continue;
        send({ type: 'harvest.start', action, x: pos.x, z: pos.z }); return;
      }
      toast('No ' + action + ' node in reach');
    }
    WS.harvest = harvest;
    WS.sendChat = (text) => { const t2 = String(text || '').slice(0, 280).trim(); if (t2) send({ type: 'chat', text: t2 }); };
  
    // ---- input ----
    function onKey(e) {
      if (!connected) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      let handled = true;
      const k = e.key.toLowerCase();
      // Movement is relative to the camera/player view (his up/down/left/right).
      if (k === 'arrowup' || k === 'w') { cancelWalk(); const [x, z] = worldStepFromScreen(0, 1); step(x, z); }
      else if (k === 'arrowdown' || k === 's') { cancelWalk(); const [x, z] = worldStepFromScreen(0, -1); step(x, z); }
      else if (k === 'arrowleft' || k === 'a') { cancelWalk(); const [x, z] = worldStepFromScreen(-1, 0); step(x, z); }
      else if (k === 'arrowright' || k === 'd') { cancelWalk(); const [x, z] = worldStepFromScreen(1, 0); step(x, z); }
      else if (k === ' ' || k === 'spacebar') startJump();
      else if (k === ATTACK_KEY) startAttack();
      else if (e.code === 'BracketLeft' || k === '[') cycleAvatarClass(-1);
      else if (e.code === 'BracketRight' || k === ']') cycleAvatarClass(1);
      else handled = false;
      if (handled) e.preventDefault();
    }
    function bindInput() { window.addEventListener('keydown', onKey); }
    function unbindInput() { window.removeEventListener('keydown', onKey); }
  
    // ---- minimap ----
    let mapWrap = null, canvas = null, ctx = null;
    const CELL = 16;
    function showMinimap() {
      if (mapWrap) { mapWrap.style.display = 'block'; drawMinimap(); return; }
      if (!document.getElementById('tw-worlds-map-style')) {
        const css = '.tw-worlds-map{position:fixed;right:12px;top:72px;z-index:65;background:#0c1424dd;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px;box-shadow:0 10px 28px -10px rgba(0,0,0,.5)}'
          + '.tw-worlds-map h4{margin:0 0 6px;font:600 11px system-ui;color:#cfe0ff;text-transform:uppercase;letter-spacing:.05em;cursor:grab;user-select:none;display:flex;align-items:center;gap:6px}'
          + '.tw-worlds-map.dragging h4{cursor:grabbing}'
          + '.tw-worlds-map canvas{display:block;border-radius:6px;cursor:pointer;background:#13243f}';
        document.head.appendChild(Object.assign(document.createElement('style'), { id: 'tw-worlds-map-style', textContent: css }));
      }
      mapWrap = document.createElement('div'); mapWrap.className = 'tw-worlds-map';
      const h = document.createElement('h4'); h.textContent = T('worlds.minimap');
      canvas = document.createElement('canvas');
      canvas.addEventListener('click', onMapClick);
      mapWrap.appendChild(h); mapWrap.appendChild(canvas);
      document.body.appendChild(mapWrap);
      restoreMapPos();
      makeMapDraggable(h);
      ctx = canvas.getContext('2d');
      drawMinimap();
    }
    function hideMinimap() { if (mapWrap) mapWrap.style.display = 'none'; }

    function restoreMapPos() {
      try {
        const saved = JSON.parse(localStorage.getItem('tinyworld:worlds.map.pos') || 'null');
        if (saved && saved.left && saved.top) { mapWrap.style.left = saved.left; mapWrap.style.top = saved.top; mapWrap.style.right = 'auto'; mapWrap.style.bottom = 'auto'; }
      } catch (_) {}
    }
    function makeMapDraggable(handle) {
      let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
      handle.addEventListener('pointerdown', (e) => {
        drag = true; mapWrap.classList.add('dragging');
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        const r = mapWrap.getBoundingClientRect(); ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
        mapWrap.style.right = 'auto'; mapWrap.style.bottom = 'auto'; mapWrap.style.left = ox + 'px'; mapWrap.style.top = oy + 'px';
        e.preventDefault();
      });
      handle.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const nx = Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx));
        const ny = Math.max(0, Math.min(window.innerHeight - 40, oy + e.clientY - sy));
        mapWrap.style.left = nx + 'px'; mapWrap.style.top = ny + 'px';
      });
      const end = () => {
        if (!drag) return; drag = false; mapWrap.classList.remove('dragging');
        try { localStorage.setItem('tinyworld:worlds.map.pos', JSON.stringify({ left: mapWrap.style.left, top: mapWrap.style.top })); } catch (_) {}
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }
  
    function onMapClick(e) {
      const rect = canvas.getBoundingClientRect();
      const cx = Math.floor((e.clientX - rect.left) / CELL);
      const cz = Math.floor((e.clientY - rect.top) / CELL);
      if (cx < 0 || cz < 0 || cx >= gridSize || cz >= gridSize) return;
      // Walk (auto-path) to the clicked tile; the server still validates each
      // one-cell step. Arrow/WASD keys interrupt the walk.
      walkTo(cx, cz);
    }
  
    function terrainColor(t) {
      return t === 'water' ? '#2f6fb0' : t === 'stone' ? '#7d8794' : t === 'sand' ? '#cdb98a'
        : t === 'dirt' ? '#7a5a3a' : t === 'path' ? '#b9a06a' : t === 'lava' ? '#c0431f' : t === 'snow' ? '#e6eef6' : '#3f8f53';
    }

    // Shared isometric 2D tile preview (used by the universe cards in 46). This
    // intentionally avoids Three.js so the Worlds screen can show many islands
    // as cheap pixel-style atlas thumbnails.
    const PREVIEW_PLANTS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
    const PREVIEW_ISO_KIND_COLORS = {
      tree: '#1f6f3a',
      bush: '#2f8b49',
      rock: '#9ba8ae',
      house: '#c76e46',
      fence: '#7a4b2c',
      cow: '#f0d8b8',
      sheep: '#f7f1dc',
    };
    function previewShade(hex, amt) {
      const h = String(hex || '#000000').replace('#', '');
      const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
      const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
      const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
      const b = Math.max(0, Math.min(255, (n & 255) + amt));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    function previewCellTuple(c) {
      if (!c) return null;
      if (Array.isArray(c)) return { x: c[0], z: c[1], terrain: c[2] || 'grass', kind: c[3] || '' };
      return { x: c.x, z: c.z, terrain: c.terrain || 'grass', kind: c.kind || '' };
    }
    function drawPreviewDiamond(ctx, cx, cy, hw, hh, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }
    function drawPreviewSide(ctx, cx, cy, hw, hh, depth, side, fill) {
      ctx.beginPath();
      if (side === 'right') {
        ctx.moveTo(cx + hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx, cy + hh + depth);
        ctx.lineTo(cx + hw, cy + depth);
      } else {
        ctx.moveTo(cx - hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx, cy + hh + depth);
        ctx.lineTo(cx - hw, cy + depth);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    function drawPreviewObject(ctx, cx, cy, s, kind) {
      const k = PREVIEW_PLANTS.has(kind) ? 'plant' : kind;
      if (k === 'tree' || k === 'bush' || k === 'plant') {
        ctx.fillStyle = k === 'plant' ? '#d5df57' : PREVIEW_ISO_KIND_COLORS[k];
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.34, s * (k === 'tree' ? 0.22 : 0.16), 0, Math.PI * 2);
        ctx.fill();
        if (k === 'tree') {
          ctx.fillStyle = '#7b5434';
          ctx.fillRect(cx - s * 0.035, cy - s * 0.28, s * 0.07, s * 0.28);
        }
      } else if (k === 'rock') {
        ctx.fillStyle = PREVIEW_ISO_KIND_COLORS.rock;
        drawPreviewDiamond(ctx, cx, cy - s * 0.18, s * 0.16, s * 0.09, '#9ba8ae', '#65737b');
      } else if (k === 'house') {
        ctx.fillStyle = '#c76e46';
        ctx.fillRect(cx - s * 0.18, cy - s * 0.34, s * 0.36, s * 0.26);
        ctx.fillStyle = '#7b3340';
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.22, cy - s * 0.34);
        ctx.lineTo(cx, cy - s * 0.56);
        ctx.lineTo(cx + s * 0.22, cy - s * 0.34);
        ctx.closePath();
        ctx.fill();
      } else if (PREVIEW_ISO_KIND_COLORS[k]) {
        ctx.fillStyle = PREVIEW_ISO_KIND_COLORS[k];
        ctx.fillRect(cx - s * 0.08, cy - s * 0.28, s * 0.16, s * 0.16);
      }
    }
    function renderPreview(cnv, preview) {
      if (!cnv || !preview) return;
      const g = Math.max(1, preview.gridSize || 8);
      const suppliedList = Array.isArray(preview.cells) ? preview.cells : [];
      const list = suppliedList.map(previewCellTuple).filter(Boolean);
      const cssW = cnv.clientWidth || cnv.width || 320;
      const cssH = cnv.clientHeight || cnv.height || 200;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      cnv.width = Math.round(cssW * dpr); cnv.height = Math.round(cssH * dpr);
      const c2 = cnv.getContext('2d');
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2.clearRect(0, 0, cssW, cssH);
      const bg = c2.createLinearGradient(0, 0, 0, cssH);
      bg.addColorStop(0, '#070911');
      bg.addColorStop(1, '#030509');
      c2.fillStyle = bg;
      c2.fillRect(0, 0, cssW, cssH);
      c2.fillStyle = 'rgba(169,199,255,.22)';
      for (let i = 0; i < 26; i++) {
        const sx = (i * 47 + g * 13) % Math.max(1, cssW);
        const sy = (i * 31 + g * 7) % Math.max(1, cssH);
        c2.fillRect(sx, sy, 1, 1);
      }
      const map = new Map();
      for (let z = 0; z < g; z++) for (let x = 0; x < g; x++) map.set(x + ',' + z, { x, z, terrain: 'grass', kind: '' });
      for (const cell of list) {
        const x = Number(cell.x), z = Number(cell.z);
        if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x >= g || z >= g) continue;
        map.set(x + ',' + z, cell);
      }
      const tileW = Math.max(14, Math.min(30, cssW / (g + 2.4)));
      const tileH = tileW * 0.5;
      const depth = Math.max(8, tileH * 0.9);
      const originX = cssW * 0.5;
      const originY = Math.max(18, (cssH - (g * tileH + depth)) * 0.38);
      const sorted = Array.from(map.values()).sort((a, b) => ((Number(a.x) + Number(a.z)) - (Number(b.x) + Number(b.z))) || (Number(a.z) - Number(b.z)));
      for (const cell of sorted) {
        const x = Number(cell.x), z = Number(cell.z);
        const cx = originX + (x - z) * tileW * 0.5;
        const cy = originY + (x + z) * tileH * 0.5;
        const top = terrainColor(cell.terrain);
        if (!map.has((x + 1) + ',' + z)) drawPreviewSide(c2, cx, cy, tileW * 0.5, tileH * 0.5, depth, 'right', previewShade(top, -62));
        if (!map.has(x + ',' + (z + 1))) drawPreviewSide(c2, cx, cy, tileW * 0.5, tileH * 0.5, depth, 'left', previewShade(top, -42));
      }
      for (const cell of sorted) {
        const x = Number(cell.x), z = Number(cell.z);
        const cx = originX + (x - z) * tileW * 0.5;
        const cy = originY + (x + z) * tileH * 0.5;
        const top = terrainColor(cell.terrain);
        drawPreviewDiamond(c2, cx, cy, tileW * 0.5, tileH * 0.5, top, 'rgba(3,5,9,.36)');
      }
      for (const cell of sorted) {
        if (!cell.kind) continue;
        const x = Number(cell.x), z = Number(cell.z);
        const cx = originX + (x - z) * tileW * 0.5;
        const cy = originY + (x + z) * tileH * 0.5;
        drawPreviewObject(c2, cx, cy, tileW, cell.kind);
      }
    }
    WS.renderPreview = renderPreview;

    // ---- in-world avatars: 2.5D animated sprite-sheet billboards (models/people/25D) ----
    // Each sheet is 8 direction-rows x N frame-cols of 64x64 cells. Facing comes from
    // the movement direction (8-way); state is idle vs walk. No fallback — if a sheet
    // fails to load we surface an error.
    const SHEET = {
      idle: { baseUrl: 'models/people/25D/idle/Sprite Sheet/idle full sprite sheet (transparent BG).png', sw: 768, sh: 512, frame: 64, cols: 12, fps: 8 },
      walk: { baseUrl: 'models/people/25D/walk/Sprite Sheet/walk complete sprite sheet (transparent BG).png', sw: 512, sh: 512, frame: 64, cols: 8, fps: 12 },
      attack: { baseUrl: 'models/people/25D/attack/Sprite Sheet/attack full sprite sheet (transparent BG).png', sw: 672, sh: 768, frame: 96, cols: 7, fps: 16 },
    };
    const AVATAR_CLASSES = ['knight', 'baird', 'wizard', 'knave', 'template'];
    const JUMP_MS = 460, ATTACK_KEY = 'f';
    // Sheet row (top->bottom) for each movement sector. Sectors: 0=S 1=SE 2=E 3=NE
    // 4=N 5=NW 6=W 7=SW. If a character faces the wrong way, reorder this array.
    const SECTOR_TO_ROW = [0, 1, 2, 3, 4, 5, 6, 7];
    let selfEnt = null;
    const peerEnts = new Map();
    let avatarRaf = null;
    let avatarErrored = false;
    let avatarClassName = 'knight';
    let _texLoader = null;

    function avatarParent() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }
    function hashId(s) { s = String(s); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
    function dirSector(dx, dz) { if (!dx && !dz) return null; return ((Math.round(Math.atan2(dx, dz) / (Math.PI / 4)) % 8) + 8) % 8; }
    // Camera-relative ground axes from the orbit azimuth (a classic-script global).
    function camGround() {
      const az = (typeof azimuth === 'number') ? azimuth : 0;
      return { f: { x: -Math.cos(az), z: -Math.sin(az) }, r: { x: Math.sin(az), z: -Math.cos(az) } };
    }
    // Facing relative to the player's view: rotate a world delta into screen space so
    // S = toward the camera, N = away, E = his right, W = his left.
    function screenSector(dx, dz) {
      const { f, r } = camGround();
      return dirSector(dx * r.x + dz * r.z, -(dx * f.x + dz * f.z));
    }
    // Screen input (right=+x, forward=+y) -> the single grid step that best matches it.
    function worldStepFromScreen(sxi, syi) {
      const { f, r } = camGround();
      const wx = r.x * sxi + f.x * syi, wz = r.z * sxi + f.z * syi;
      return (Math.abs(wx) >= Math.abs(wz)) ? [Math.sign(wx), 0] : [0, Math.sign(wz)];
    }
    function startAttack() { if (selfEnt && selfEnt.sprite && !selfEnt.attacking) { selfEnt.attacking = true; selfEnt.state = 'attack'; selfEnt.frame = 0; selfEnt.frameTime = 0; selfEnt.sprite.material.map = selfEnt.tex.attack; } }
    function startJump() { if (selfEnt && !selfEnt.jumpStart) selfEnt.jumpStart = Date.now(); }
    function avatarError(msg) {
      if (avatarErrored) return; avatarErrored = true;
      try { console.error('[worlds] avatar sprite failed:', msg); } catch (_) {}
      toast('Avatar sprites failed to load');
    }
    function avatarSheetUrl(action, className) {
      const s = SHEET[action];
      if (className && className !== 'template') return 'models/people/25D/classes/' + encodeURIComponent(className) + '/' + action + '.png';
      return s.baseUrl;
    }
    function loadSheetTexture(url) {
      _texLoader = _texLoader || new THREE.TextureLoader();
      const t = _texLoader.load(url, undefined, undefined, () => avatarError(url));
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      else if ('encoding' in t && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
      return t;
    }
    function disposeAvatarTextures(ent) {
      if (!ent || !ent.tex) return;
      Object.keys(ent.tex).forEach(k => { if (ent.tex[k] && typeof ent.tex[k].dispose === 'function') ent.tex[k].dispose(); });
      ent.tex = {};
    }
    function loadAvatarTextures(ent, className) {
      if (!ent) return;
      disposeAvatarTextures(ent);
      ent.avatarClassName = className;
      for (const k of Object.keys(SHEET)) {
        const s = SHEET[k];
        const t = loadSheetTexture(avatarSheetUrl(k, className));
        t.repeat.set(s.frame / s.sw, s.frame / s.sh);
        t.offset.set(0, 1 - s.frame / s.sh);
        ent.tex[k] = t;
      }
      if (ent.sprite && ent.sprite.material) ent.sprite.material.map = ent.tex[ent.state] || ent.tex.idle;
    }
    function setAvatarClass(name) {
      const next = AVATAR_CLASSES.includes(name) ? name : 'knight';
      avatarClassName = next;
      if (selfEnt) loadAvatarTextures(selfEnt, avatarClassName);
      return avatarClassName;
    }
    function cycleAvatarClass(delta) {
      const current = Math.max(0, AVATAR_CLASSES.indexOf(avatarClassName));
      return setAvatarClass(AVATAR_CLASSES[(current + delta + AVATAR_CLASSES.length) % AVATAR_CLASSES.length]);
    }
    WS.setAvatarClass = setAvatarClass;
    WS.cycleAvatarClass = cycleAvatarClass;
    WS.avatarClasses = () => AVATAR_CLASSES.slice();
    WS.avatarClass = () => avatarClassName;
    // A fresh texture per avatar+sheet so each can hold its own frame/row offset.
    function createAvatar() {
      const ent = { x: 0, z: 0, sector: 0, lastMove: 0, lastDx: 0, lastDz: 0, state: 'idle', frame: 0, frameTime: 0, tex: {}, sprite: null, disposed: false, avatarClassName };
      if (typeof THREE === 'undefined') { avatarError('THREE unavailable'); return ent; }
      loadAvatarTextures(ent, avatarClassName);
      const mat = new THREE.SpriteMaterial({ map: ent.tex.idle, transparent: true, depthWrite: false, alphaTest: 0.2 });
      ent.sprite = new THREE.Sprite(mat);
      ent.sprite.center.set(0.5, 0.12);  // anchor near the feet (cells have transparent padding below)
      ent.sprite.scale.set(1.7, 1.7, 1);
      ent.sprite.renderOrder = 10;
      const par = avatarParent(); if (par) par.add(ent.sprite);
      return ent;
    }
    function placeEntity(ent) {
      if (!ent || !ent.sprite || typeof tilePos !== 'function') return;
      const p = tilePos(ent.x, ent.z);
      ent.sprite.position.set(p.x, 0.02, p.z);
    }
    function moveEntity(ent, x, z) {
      if (!ent) return;
      const dx = x - ent.x, dz = z - ent.z;
      const s = screenSector(dx, dz); if (s != null) ent.sector = s;
      if (dx || dz) {
        ent.lastMove = Date.now();
        ent.lastDx = dx;
        ent.lastDz = dz;
      }
      ent.x = x; ent.z = z; placeEntity(ent);
    }
    function disposeEntity(ent) {
      if (!ent) return; ent.disposed = true;
      if (ent.sprite && ent.sprite.parent) ent.sprite.parent.remove(ent.sprite);
      disposeAvatarTextures(ent);
    }
    function animEntity(ent, dt) {
      if (!ent.sprite) return;
      const state = ent.attacking ? 'attack' : ((Date.now() - ent.lastMove) < 200 ? 'walk' : 'idle');
      if (state !== ent.state) { ent.state = state; ent.frame = 0; ent.frameTime = 0; ent.sprite.material.map = ent.tex[state]; }
      const sh = SHEET[state];
      ent.frameTime += dt;
      const fdur = 1 / sh.fps;
      while (ent.frameTime >= fdur) {
        ent.frameTime -= fdur; ent.frame += 1;
        if (ent.frame >= sh.cols) { ent.frame = 0; if (ent.attacking) ent.attacking = false; }   // attack plays once
      }
      const row = ent === selfEnt ? 0 : (SECTOR_TO_ROW[ent.sector] || 0);
      ent.tex[ent.state].offset.set(ent.frame * (sh.frame / sh.sw), 1 - (row + 1) * (sh.frame / sh.sh));
      let y = 0.02;
      if (ent.jumpStart) { const jt = (Date.now() - ent.jumpStart) / JUMP_MS; if (jt >= 1) ent.jumpStart = 0; else y += Math.sin(jt * Math.PI) * 0.8; }
      ent.sprite.position.y = y;
    }
    function avatarAngleLerp(a, b, t) {
      const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
      return a + d * t;
    }
    function updateAvatarCameraOrbit(dt) {
      if (!selfEnt || !selfEnt.sprite || typeof tilePos !== 'function' || typeof updateCamera !== 'function' || typeof target === 'undefined' || !target) return;
      const p = tilePos(selfEnt.x, selfEnt.z);
      target.x += (p.x - target.x) * 0.15;
      target.z += (p.z - target.z) * 0.15;
      if (typeof azimuth === 'number' && (selfEnt.lastDx || selfEnt.lastDz) && Date.now() - selfEnt.lastMove < 900) {
        const desired = Math.atan2(-selfEnt.lastDz, -selfEnt.lastDx);
        azimuth = avatarAngleLerp(azimuth, desired, Math.min(0.18, Math.max(0.04, dt * 5)));
      }
      updateCamera();
    }

    function updateSelfAvatar() {
      if (!selfEnt) selfEnt = createAvatar();
      moveEntity(selfEnt, you.x, you.z);
    }
    function updatePeerAvatars() {
      const seen = new Set();
      peers.forEach((p) => {
        if (!p || p.id == null || p.id === myId) return;   // never draw yourself as a peer
        const pos = p.cursor || p; if (pos.x == null) return;
        seen.add(p.id);
        let ent = peerEnts.get(p.id);
        if (!ent) { ent = createAvatar(); peerEnts.set(p.id, ent); }
        moveEntity(ent, pos.x, pos.z);
      });
      peerEnts.forEach((ent, id) => { if (!seen.has(id)) { disposeEntity(ent); peerEnts.delete(id); } });
    }
    function startAvatars() {
      if (avatarRaf || typeof requestAnimationFrame !== 'function') return;
      let prev = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const tick = () => {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
        if (selfEnt) animEntity(selfEnt, dt);
        peerEnts.forEach((e) => animEntity(e, dt));
        // Follow camera: keep the player centered and orbit behind recent movement.
        updateAvatarCameraOrbit(dt);
        avatarRaf = requestAnimationFrame(tick);
      };
      avatarRaf = requestAnimationFrame(tick);
    }
    function stopAvatars() {
      if (avatarRaf) { cancelAnimationFrame(avatarRaf); avatarRaf = null; }
      disposeEntity(selfEnt); selfEnt = null;
      peerEnts.forEach((e) => disposeEntity(e)); peerEnts.clear();
      avatarErrored = false;
    }

    function drawMinimap() {
      if (!ctx || !canvas) return;
      canvas.width = gridSize * CELL; canvas.height = gridSize * CELL;
      ctx.fillStyle = '#13243f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      // base grass
      ctx.fillStyle = '#3f8f53'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      // tiles
      for (const c of cells) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z, ter = Array.isArray(c) ? c[2] : c.terrain;
        if (x == null || z == null || x < 0 || z < 0 || x >= gridSize || z >= gridSize) continue;
        ctx.fillStyle = terrainColor(ter); ctx.fillRect(x * CELL, z * CELL, CELL, CELL);
      }
      // nodes
      for (const id of Object.keys(nodes)) {
        const n = nodes[id]; const pos = nodeCellPos(n); if (!pos && n.type !== 'fish') continue;
        const p = pos || null; if (!p) continue;
        ctx.fillStyle = n.charges > 0 ? (n.type === 'ore' ? '#d8c150' : '#9fe0ff') : '#555';
        ctx.beginPath(); ctx.arc(p.x * CELL + CELL / 2, p.z * CELL + CELL / 2, 4, 0, 7); ctx.fill();
      }
      // animals
      ctx.fillStyle = '#f0c0a0';
      for (const a of animals) { ctx.fillRect(a.x * CELL + 4, a.z * CELL + 4, CELL - 8, CELL - 8); }
      // peers
      for (const p of peers.values()) {
        const pos = p.cursor || p; if (pos.x == null) continue;
        ctx.fillStyle = p.color || '#ffd166';
        ctx.beginPath(); ctx.arc(pos.x * CELL + CELL / 2, pos.z * CELL + CELL / 2, 5, 0, 7); ctx.fill();
      }
      // you
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1f6feb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(you.x * CELL + CELL / 2, you.z * CELL + CELL / 2, 5, 0, 7); ctx.fill(); ctx.stroke();
    }
  })();
