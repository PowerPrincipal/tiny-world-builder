  // -------- PartyKit shared building --------
  (function wirePartyKitMultiplayer() {
    const params = new URLSearchParams(location.search);
    const rawRoom = params.get('party') || params.get('room') || params.get('collab') || '';
    const shareId = params.get('share') || '';
    const roomId = sanitizeMultiplayerId((rawRoom === '1' || rawRoom === 'true') ? shareId : rawRoom);
    if (!roomId) return;

    const MP_CLIENT_ID_LS = 'tinyworld:multiplayer:client-id';
    const MP_NAME_LS = 'tinyworld:multiplayer:name';
    const MP_HOST_LS = 'tinyworld:multiplayer:party-host';
    const peers = new Map();
    const peerRoot = new THREE.Group();
    peerRoot.name = 'multiplayer-peers';
    xrWorldRoot.add(peerRoot);
    let socket = null;
    let reconnectTimer = null;
    let reconnectDelay = 800;
    let statusEl = null;
    let serverClientId = '';
    let applyingRemote = false;
    let lastPresenceSent = 0;
    let presenceTimer = null;
    let lastPresenceKey = '';
    let lastHoverKey = '';

    const localClientId = (() => {
      try {
        const existing = localStorage.getItem(MP_CLIENT_ID_LS);
        if (existing) return existing;
        const next = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem(MP_CLIENT_ID_LS, next);
        return next;
      } catch (_) {
        return 'u_' + Math.random().toString(36).slice(2, 10);
      }
    })();

    function sanitizeMultiplayerId(value) {
      return String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    }

    function hashNumber(text) {
      let h = 2166136261;
      const s = String(text || '');
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    function colorForId(id) {
      const hue = hashNumber(id) % 360;
      const c = new THREE.Color();
      c.setHSL(hue / 360, 0.72, 0.56);
      return '#' + c.getHexString();
    }

    function cssColorToHex(color) {
      const c = new THREE.Color(color || '#3c82f7');
      return c.getHex();
    }

    function multiplayerHost() {
      const explicit = params.get('partyHost')
        || window.__TINY_WORLD_PARTYKIT_HOST__
        || (() => { try { return localStorage.getItem(MP_HOST_LS); } catch (_) { return ''; } })();
      const host = String(explicit || '').trim().replace(/\/+$/, '');
      if (host) return host.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://localhost:1999';
      return 'wss://' + location.host;
    }

    function multiplayerSocketUrl() {
      return multiplayerHost() + '/party/' + encodeURIComponent(roomId);
    }

    function localName() {
      try {
        const stored = localStorage.getItem(MP_NAME_LS);
        if (stored) return stored.slice(0, 48);
      } catch (_) {}
      if (window.TinyWorldAuth && window.__loggedIn) return 'Builder';
      return 'Guest ' + localClientId.slice(-4).toUpperCase();
    }

    function ensureStatus() {
      if (statusEl) return statusEl;
      statusEl = document.createElement('div');
      statusEl.className = 'multiplayer-status';
      statusEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(statusEl);
      return statusEl;
    }

    function setStatus(state, text) {
      const el = ensureStatus();
      el.dataset.state = state;
      el.textContent = text;
    }

    function sendMessage(message) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch (_) {
        return false;
      }
    }

    function localSelection() {
      const api = window.__tinyworldSelection;
      if (!api || typeof api.worldCoords !== 'function') return [];
      try {
        return api.worldCoords().slice(0, 64).map(c => ({ x: Math.round(c.x), z: Math.round(c.z) }));
      } catch (_) {
        return [];
      }
    }

    function localCursor() {
      if (!currentHover) return null;
      const x = Math.round(currentHover.x + (currentHover.boardX || 0) * GRID);
      const z = Math.round(currentHover.z + (currentHover.boardZ || 0) * GRID);
      let y = 0.05;
      try { y = hoverHeightForCell(currentHover) + 0.03; } catch (_) {}
      return { x, z, y };
    }

    function localToolLabel() {
      if (!selectedTool) return '';
      return selectedTool.label || selectedTool.id || selectedTool.kind || selectedTool.terrain || '';
    }

    function localPresence() {
      return {
        id: serverClientId || localClientId,
        name: localName(),
        color: colorForId(localClientId),
        cursor: localCursor(),
        selection: localSelection(),
        tool: localToolLabel(),
        ts: Date.now(),
      };
    }

    function schedulePresence(force = false) {
      if (presenceTimer) return;
      const wait = force ? 0 : Math.max(0, 90 - (Date.now() - lastPresenceSent));
      presenceTimer = setTimeout(() => {
        presenceTimer = null;
        publishPresence(force);
      }, wait);
    }

    function publishPresence(force = false) {
      const presence = localPresence();
      const key = JSON.stringify({
        cursor: presence.cursor,
        selection: presence.selection,
        tool: presence.tool,
      });
      if (!force && key === lastPresenceKey) return;
      lastPresenceKey = key;
      lastPresenceSent = Date.now();
      sendMessage({ type: 'presence', presence });
    }

    function makeNameSprite(name, color) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      const label = String(name || 'Builder').slice(0, 28);
      const width = Math.min(230, Math.max(72, ctx.measureText(label).width + 28));
      ctx.fillStyle = 'rgba(24, 28, 38, 0.84)';
      roundRect(ctx, (256 - width) / 2, 12, width, 36, 12);
      ctx.fill();
      ctx.fillStyle = color || '#3c82f7';
      ctx.beginPath();
      ctx.arc((256 - width) / 2 + 18, 30, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 31);
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1.55, 0.38, 1);
      sprite.renderOrder = 1500;
      return sprite;
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }

    function ensurePeer(id, presence) {
      let peer = peers.get(id);
      if (peer) return peer;
      const color = presence.color || colorForId(id);
      const group = new THREE.Group();
      group.name = 'multiplayer-peer-' + id;
      const ringMat = new THREE.MeshBasicMaterial({
        color: cssColorToHex(color),
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.43, 0.54, 36), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 1400;
      group.add(ring);
      const beacon = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.34, 18),
        new THREE.MeshBasicMaterial({ color: cssColorToHex(color), transparent: true, opacity: 0.86, depthTest: false })
      );
      beacon.position.y = 0.34;
      beacon.renderOrder = 1401;
      group.add(beacon);
      const label = makeNameSprite(presence.name, color);
      label.position.y = 0.86;
      group.add(label);
      const selection = new THREE.Group();
      selection.name = 'multiplayer-selection-' + id;
      group.add(selection);
      peerRoot.add(group);
      peer = { id, group, ring, beacon, label, selection, presence: null, color };
      peers.set(id, peer);
      return peer;
    }

    function disposeObject3d(obj) {
      if (!obj) return;
      obj.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(mat => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        }
      });
    }

    function removePeer(id) {
      const peer = peers.get(id);
      if (!peer) return;
      peerRoot.remove(peer.group);
      disposeObject3d(peer.group);
      peers.delete(id);
    }

    function clearGroup(group) {
      while (group.children.length) {
        const child = group.children.pop();
        disposeObject3d(child);
      }
    }

    function cellY(x, z) {
      try { return hoverHeightForCell({ x, z, boardX: 0, boardZ: 0 }) + 0.012; } catch (_) { return 0.04; }
    }

    function updatePeerSelection(peer, selection) {
      clearGroup(peer.selection);
      const cells = Array.isArray(selection) ? selection.slice(0, 64) : [];
      if (!cells.length) return;
      const color = cssColorToHex(peer.color);
      const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, depthTest: false });
      const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthWrite: false, depthTest: false });
      cells.forEach(cell => {
        const x = Math.round(Number(cell.x));
        const z = Math.round(Number(cell.z));
        if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        const p = tilePos(x, z);
        const y = cellY(x, z);
        const fill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.018, 0.92), fillMat);
        fill.position.set(p.x, y, p.z);
        fill.renderOrder = 1390;
        peer.selection.add(fill);
        const edgeN = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.025, 0.045), edgeMat);
        const edgeS = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.025, 0.045), edgeMat);
        const edgeW = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.96), edgeMat);
        const edgeE = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.96), edgeMat);
        edgeN.position.set(p.x, y + 0.018, p.z - 0.48);
        edgeS.position.set(p.x, y + 0.018, p.z + 0.48);
        edgeW.position.set(p.x - 0.48, y + 0.018, p.z);
        edgeE.position.set(p.x + 0.48, y + 0.018, p.z);
        [edgeN, edgeS, edgeW, edgeE].forEach(edge => { edge.renderOrder = 1391; peer.selection.add(edge); });
      });
    }

    function updatePeerPresence(presence) {
      if (!presence || !presence.id || presence.id === serverClientId) return;
      const peer = ensurePeer(presence.id, presence);
      peer.presence = presence;
      if (presence.color && presence.color !== peer.color) peer.color = presence.color;
      if (presence.cursor) {
        const p = tilePos(Math.round(Number(presence.cursor.x)), Math.round(Number(presence.cursor.z)));
        const y = Number.isFinite(Number(presence.cursor.y)) ? Number(presence.cursor.y) : cellY(presence.cursor.x, presence.cursor.z);
        peer.group.position.set(p.x, y + 0.015, p.z);
        peer.group.visible = true;
      } else {
        peer.group.visible = false;
      }
      updatePeerSelection(peer, presence.selection);
    }

    function cleanCellForSend(cell) {
      if (!cell || typeof cell !== 'object') return null;
      try { return JSON.parse(JSON.stringify(cell)); } catch (_) { return null; }
    }

    function sendCellSnapshot(x, z, cell) {
      if (applyingRemote || !cell) return;
      const copy = cleanCellForSend(cell);
      if (!copy) return;
      sendMessage({
        type: 'cell.set',
        op: {
          id: localClientId + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 6),
          kind: 'cell.set',
          x: Math.round(Number(x)),
          z: Math.round(Number(z)),
          cell: copy,
          ts: Date.now(),
        },
      });
    }

    function applyRemoteCell(op) {
      if (!op || !op.cell) return;
      const x = Math.round(Number(op.x));
      const z = Math.round(Number(op.z));
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      applyingRemote = true;
      const oldHistoryMuted = typeof worldHistoryMuted !== 'undefined' ? worldHistoryMuted : false;
      try {
        if (typeof worldHistoryMuted !== 'undefined') worldHistoryMuted = true;
        setCell(x, z, Object.assign({}, op.cell, {
          animate: false,
          impactDust: false,
          forceTile: true,
        }));
      } catch (err) {
        console.warn('[multiplayer] remote cell failed:', err);
      } finally {
        if (typeof worldHistoryMuted !== 'undefined') worldHistoryMuted = oldHistoryMuted;
        applyingRemote = false;
      }
    }

    function handleMessage(event) {
      let data = null;
      try { data = JSON.parse(String(event.data || '')); } catch (_) { return; }
      if (!data || !data.type) return;
      if (data.type === 'welcome') {
        serverClientId = data.id || serverClientId;
        (Array.isArray(data.peers) ? data.peers : []).forEach(updatePeerPresence);
        publishPresence(true);
      } else if (data.type === 'presence') {
        updatePeerPresence(data.presence);
      } else if (data.type === 'leave') {
        removePeer(data.id);
      } else if (data.type === 'cell.set') {
        applyRemoteCell(data.op);
      }
    }

    function connect() {
      clearTimeout(reconnectTimer);
      setStatus('connecting', 'Shared room: connecting');
      try {
        socket = new WebSocket(multiplayerSocketUrl());
      } catch (err) {
        setStatus('offline', 'Shared room: offline');
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(8000, reconnectDelay * 1.5);
        return;
      }
      socket.addEventListener('open', () => {
        reconnectDelay = 800;
        setStatus('online', 'Shared room: ' + roomId);
        publishPresence(true);
      });
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('close', () => {
        peers.forEach((_, id) => removePeer(id));
        setStatus('offline', 'Shared room: reconnecting');
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(8000, reconnectDelay * 1.5);
      });
      socket.addEventListener('error', () => {
        setStatus('offline', 'Shared room: offline');
      });
    }

    window.addEventListener('tinyworld:world-changed', e => {
      const d = e && e.detail;
      if (!d || !Number.isFinite(Number(d.x)) || !Number.isFinite(Number(d.z))) return;
      sendCellSnapshot(d.x, d.z, d.cell);
    });
    window.addEventListener('tinyworld:selection-changed', () => schedulePresence(true));
    renderer.domElement.addEventListener('pointermove', () => {
      const c = localCursor();
      const key = c ? c.x + ',' + c.z : '';
      if (key !== lastHoverKey) {
        lastHoverKey = key;
        schedulePresence(false);
      }
    }, { passive: true });
    renderer.domElement.addEventListener('pointerleave', () => schedulePresence(true), { passive: true });
    setInterval(() => schedulePresence(true), 2500);

    window.__tinyworldMultiplayer = {
      roomId,
      connect,
      presence: localPresence,
      peers: () => Array.from(peers.keys()),
      url: multiplayerSocketUrl,
    };

    connect();
  })();
