  // Tinyverse — avatar picker: a pixel/retro gallery for choosing your in-world
  // avatar. It DRIVES the existing class system (WS.setAvatarClass / WS.avatarClasses
  // / WS.avatarClass, defined in 47-worlds-room.js) — it does NOT reimplement avatar
  // switching. Opened from the HUD's person button (48) via WS.openAvatarPicker().
  //
  // Extensible via a provider registry (WS.registerAvatarProvider). A provider mirrors
  // @open-pets/client's pet shape so open-pets pets can plug in as a second category
  // later without touching this file:
  //   provider = { id, label, list(): item[], current(): id|null, select(id) }
  //   item     = { id, displayName, builtIn?, broken?, thumb? }   // thumb: inline CSS
  // (item mirrors @open-pets/client OpenPetsPetListItem { id, displayName, builtIn,
  //  broken }; `thumb` is a background style string for the card preview. An open-pets
  //  provider would call createOpenPetsClient().listPets() in a desktop/Electron host
  //  and map pets -> items, then WS.registerAvatarProvider(it).)
  //
  // NO emoji — all glyphs are SVG via WS.icon. IIFE-wrapped; no globals leak.
  (function wireWorldsAvatarPicker() {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function T(k, p) { return typeof window.t === 'function' ? window.t(k, p) : k; }
    function on(ev, cb) { if (typeof WS.on === 'function') WS.on(ev, cb); }
    function ic(name, size) { return typeof WS.icon === 'function' ? WS.icon(name, size) : document.createElement('span'); }

    function el(tag, attrs, kids) {
      const n = document.createElement(tag);
      if (attrs) for (const k of Object.keys(attrs)) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
      if (kids) for (const c of [].concat(kids)) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      return n;
    }
    function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

    // ---- provider registry ----
    // NOTE: picker UI state is declared up here (not lower down) because
    // WS.registerAvatarProvider references `picker`, and providers register at load
    // BEFORE the UI section runs — a `let` declared later would throw a TDZ
    // ReferenceError and silently abort this whole module (avatar button = no-op).
    let picker = null, gridEl = null, tabsEl = null, activeProviderId = 'classes';
    const providers = [];
    WS.registerAvatarProvider = function (p) {
      if (!p || !p.id || typeof p.list !== 'function' || typeof p.select !== 'function') return null;
      const i = providers.findIndex(x => x.id === p.id);
      if (i >= 0) providers[i] = p; else providers.push(p);
      if (picker) renderTabs();
      return p;
    };

    // A sprite-sheet idle frame-0 as a pixel-art thumbnail. Matches 47's SHEET.idle:
    // 768x512, 12 cols x 8 rows, 64px cells; row 0 / col 0 = idle facing the camera.
    // 84px box × scale 84/64 → background 1008×672 so exactly one cell shows.
    function classThumb(className) {
      const url = (className && className !== 'template')
        ? 'models/people/25D/classes/' + encodeURIComponent(className) + '/idle.png'
        : 'models/people/25D/idle/Sprite Sheet/idle full sprite sheet (transparent BG).png';
      return "background-image:url('" + url + "');background-repeat:no-repeat;background-size:1008px 672px;background-position:0 0";
    }

    // Built-in "classes" provider over the existing 47 class API.
    WS.registerAvatarProvider({
      id: 'classes',
      label: T('worlds.avatarClasses'),
      list() {
        const names = (typeof WS.avatarClasses === 'function') ? WS.avatarClasses() : [];
        return names.map(n => ({ id: n, displayName: cap(n), builtIn: true, broken: false, thumb: classThumb(n) }));
      },
      current() { return (typeof WS.avatarClass === 'function') ? WS.avatarClass() : null; },
      select(id) { if (typeof WS.setAvatarClass === 'function') WS.setAvatarClass(id); },
    });

    // open-pets pets vendored under models/pets/<id>/ (pet.json + spritesheet, the
    // @open-pets/pet-format atlas). Add an entry here per vendored pet. Selecting one
    // drives WS.setAvatarPet (47) to render it in-world as a billboard.
    const PETS = [
      { id: 'boba', displayName: 'Boba', dir: 'models/pets/boba/', sheet: 'spritesheet.webp', fw: 192, fh: 208, cols: 8, rows: 9 },
    ];
    function petThumb(p) {
      // frame 0 (top-left) of the atlas scaled so one cell width fits the 84px box.
      const sc = 84 / p.fw;
      return "background-image:url('" + p.dir + p.sheet + "');background-repeat:no-repeat;background-size:" +
        Math.round(p.cols * p.fw * sc) + "px " + Math.round(p.rows * p.fh * sc) + "px;background-position:0 0";
    }
    if (PETS.length) {
      WS.registerAvatarProvider({
        id: 'pets',
        label: T('worlds.avatarPets'),
        list() { return PETS.map(p => ({ id: p.id, displayName: p.displayName, builtIn: false, broken: false, thumb: petThumb(p) })); },
        current() { return (typeof WS.avatarPet === 'function') ? WS.avatarPet() : null; },
        select(id) { if (typeof WS.setAvatarPet === 'function') WS.setAvatarPet(id); },
      });
    }

    // Side-view STRIP packs (driven by WS.setAvatarStrip / WS.avatarStrip / WS.strips in
    // 47). Each `idle` sheet is a 64px grid: columns are frames, rows are
    // directions. `idleFrames` sizes the thumbnail so one 64px cell shows.
    // ids must match 47's STRIPS keys.
    const STRIP_PACKS = {
      warriors: [
        { id: 'swordsman-l1', displayName: 'Swordsman Lv 1', level: 1, idle: 'models/people/swordsman/PNG/Swordsman_lvl1/Without_shadow/Swordsman_lvl1_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l2', displayName: 'Swordsman Lv 2', level: 2, idle: 'models/people/swordsman/PNG/Swordsman_lvl2/Without_shadow/Swordsman_lvl2_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l3', displayName: 'Swordsman Lv 3', level: 3, idle: 'models/people/swordsman/PNG/Swordsman_lvl3/Without_shadow/Swordsman_lvl3_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l4', displayName: 'Swordsman Lv 4', level: 4, idle: 'models/people/swordsman/PNG/Swordsman_lvl4/Without_shadow/lvl4_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l5', displayName: 'Swordsman Lv 5', level: 5, idle: 'models/people/swordsman/PNG/Swordsman_lvl5/Without_shadow/lvl5_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l6', displayName: 'Swordsman Lv 6', level: 6, idle: 'models/people/swordsman/PNG/Swordsman_lvl6/Without_shadow/lvl6_Idle_without_shadow.png', idleFrames: 12 },
      ],
      orcs: [
        { id: 'orc-1', displayName: 'Orc 1', level: null, idle: 'models/people/orcs/PNG/Orc1/Without_shadow/orc1_idle_without_shadow.png', idleFrames: 4 },
        { id: 'orc-2', displayName: 'Orc 2', level: null, idle: 'models/people/orcs/PNG/Orc2/Without_shadow/orc2_idle_without_shadow.png', idleFrames: 4 },
        { id: 'orc-3', displayName: 'Orc 3', level: null, idle: 'models/people/orcs/PNG/Orc3/Without_shadow/orc3_idle_without_shadow.png', idleFrames: 4 },
      ],
    };
    function stripThumb(p) {
      // frame 0 of a single-row 64x256 idle sheet, scaled so one 64px cell fits the 84px box.
      const sc = 84 / 64;
      return "background-image:url('" + p.idle + "');background-repeat:no-repeat;background-size:" +
        Math.round(p.idleFrames * 64 * sc) + "px " + Math.round(256 * sc) + "px;background-position:0 0";
    }
    WS.registerAvatarProvider({
      id: 'warriors',
      label: T('worlds.avatarWarriors'),
      list() { return STRIP_PACKS.warriors.map(p => ({ id: p.id, displayName: p.displayName, builtIn: false, broken: false, thumb: stripThumb(p) })); },
      current() { return (typeof WS.avatarStrip === 'function') ? WS.avatarStrip() : null; },
      select(id) { if (typeof WS.setAvatarStrip === 'function') WS.setAvatarStrip(id); },
    });
    WS.registerAvatarProvider({
      id: 'orcs',
      label: T('worlds.avatarOrcs'),
      list() { return STRIP_PACKS.orcs.map(p => ({ id: p.id, displayName: p.displayName, builtIn: false, broken: false, thumb: stripThumb(p) })); },
      current() { return (typeof WS.avatarStrip === 'function') ? WS.avatarStrip() : null; },
      select(id) { if (typeof WS.setAvatarStrip === 'function') WS.setAvatarStrip(id); },
    });

    // ---- voxel avatars (real 3D voxel people — the networked identity) ----
    // Drives WS.setAvatarVoxel / WS.avatarVoxel (47), which stores a fully-resolved
    // descriptor and sends it on world.join so other clients render THIS look. A small
    // set of hand-tuned presets plus a "Randomize" tile (random seed -> fresh look).
    // Descriptors are resolved through window.voxelAvatarDescriptor (53) so the stored
    // form is complete and round-trips bit-identically to peers. Thumbs are simple CSS
    // color swatches (the voxel body is 3D — there's no sprite sheet to slice).
    const VOXEL_PRESETS = [
      { id: 'vx-scout',   displayName: 'Scout',    spec: { seed: 11, body: 'Masc', fit: 'Scout',     skin: 1, head: 'Wide', hair: 'Short' },  swatch: '#5d8a4a' },
      { id: 'vx-formal',  displayName: 'Formal',   spec: { seed: 22, body: 'Masc', fit: 'Formal',    skin: 2, head: 'Slim', hair: 'Page' },   swatch: '#262a33' },
      { id: 'vx-sport',   displayName: 'Sport',    spec: { seed: 33, body: 'Fem',  fit: 'Sport',     skin: 0, head: 'Slim', hair: 'Tail' },   swatch: '#e85d75' },
      { id: 'vx-rogue',   displayName: 'Rogue',    spec: { seed: 44, body: 'Fem',  fit: 'Rogue',     skin: 3, head: 'Wide', hair: 'Bob' },    swatch: '#3f4b4e' },
      { id: 'vx-barb',    displayName: 'Barbarian', spec: { seed: 55, body: 'Masc', fit: 'Barbarian', skin: 4, head: 'Wide', hair: 'Mohawk' }, swatch: '#8a4b2a' },
      { id: 'vx-casual',  displayName: 'Casual',   spec: { seed: 66, body: 'Masc', fit: 'Casual',    skin: 1, head: 'Wide', hair: 'Curls' },  swatch: '#4f8ef7' },
      { id: 'vx-random',  displayName: 'Randomize', random: true,                                                                              swatch: '#7bdc2e' },
    ];
    function voxelDesc(spec) {
      return (typeof window.voxelAvatarDescriptor === 'function')
        ? window.voxelAvatarDescriptor(spec)
        : Object.assign({ kind: 'voxel' }, spec);
    }
    function voxelThumb(p) {
      // a flat color swatch with a subtle inner shading so cards read as distinct.
      return 'background:linear-gradient(135deg,' + p.swatch + ' 0%,' + p.swatch + ' 60%,rgba(0,0,0,.35) 100%)';
    }
    // Register the voxel provider at LOAD time (no guard): this file loads BEFORE
    // 53-voxel-avatar.js, so window.voxelAvatarDescriptor is undefined here — a
    // load-time guard would permanently skip the tab. Both cross-file deps are
    // deferred to call-time (post-load): voxelDesc() falls back if 53 is missing, and
    // select() guards WS.setAvatarVoxel. list()/voxelThumb have no cross-file deps.
    // Track "current" by preset id (the room stores a full descriptor, not a preset
    // id); Randomize never stays "selected".
    let voxelCurrentId = null;
    // Use the i18n key if a locale defines one; otherwise a safe English fallback
    // (this file doesn't own engine/i18n/*, so it must not REQUIRE a new key).
    const trVoxel = (k, fb) => { const v = T(k); return (v && v !== k) ? v : fb; };
    WS.registerAvatarProvider({
      id: 'voxel',
      label: trVoxel('worlds.avatarVoxel', 'Voxel'),
      list() { return VOXEL_PRESETS.map(p => ({ id: p.id, displayName: p.displayName, builtIn: true, broken: false, thumb: voxelThumb(p) })); },
      current() { return voxelCurrentId; },
      select(id) {
        if (typeof WS.setAvatarVoxel !== 'function') return;
        const p = VOXEL_PRESETS.find(x => x.id === id);
        if (!p) return;
        if (p.random) { WS.setAvatarVoxel(voxelDesc({ seed: (Math.random() * 0xffffffff) >>> 0 })); voxelCurrentId = null; }
        else { WS.setAvatarVoxel(voxelDesc(p.spec)); voxelCurrentId = id; }
      },
    });

    function injectStyles() {
      if (document.getElementById('tw-avp-style')) return;
      const css = `
  .tw-avp-backdrop{position:fixed;inset:0;z-index:95;display:none;align-items:center;justify-content:center;background:rgba(5,7,14,.62)}
  .tw-avp-backdrop.open{display:flex}
  .tw-avp{width:min(680px,94vw);max-height:86vh;overflow:auto;background:#161a2b;color:#eef3ff;
    font:700 12px 'Pixelify Sans',ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.04em;padding:16px 16px 18px;border-radius:4px;
    box-shadow:0 0 0 2px #05070e, inset 2px 2px 0 #38415f, inset -2px -2px 0 #0a0d18}
  .tw-avp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .tw-avp-title{font-size:15px;text-transform:uppercase;letter-spacing:.08em;text-shadow:1px 1px 0 #05070e}
  .tw-avp-close{display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;color:#dfe6ff;padding:7px;border-radius:3px;background:#222a42;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.16), inset -2px -2px 0 rgba(0,0,0,.45), 0 3px 0 0 rgba(0,0,0,.4);transition:filter .08s,transform .04s}
  .tw-avp-close:hover{filter:brightness(1.18)}
  .tw-avp-close:active{transform:translateY(2px)}
  .tw-avp-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
  .tw-avp-tab{border:0;cursor:pointer;color:#cfd8f5;background:#222a42;padding:7px 12px;border-radius:10px;
    font:700 11px 'Pixelify Sans',ui-monospace,'SF Mono',Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.12), inset -2px -2px 0 rgba(0,0,0,.45);transition:filter .08s}
  .tw-avp-tab:hover{filter:brightness(1.15)}
  .tw-avp-tab.active{color:#fff;background:#2b59d6;box-shadow:inset 2px 2px 0 rgba(255,255,255,.30), inset -2px -2px 0 rgba(0,0,0,.40)}
  .tw-avp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
  .tw-avp-card{position:relative;cursor:pointer;background:#0e1120;padding:10px 10px 12px;border-radius:10px;
    box-shadow:inset 2px 2px 0 #2b3350, inset -2px -2px 0 #05070e;transition:filter .1s,transform .05s}
  .tw-avp-card:hover{filter:brightness(1.16)}
  .tw-avp-card.sel{box-shadow:inset 0 0 0 2px #7bdc2e, inset 2px 2px 0 #2b3350, inset -2px -2px 0 #05070e}
  .tw-avp-thumb{width:84px;height:84px;margin:0 auto;background:#05070e;border-radius:2px;image-rendering:pixelated;
    box-shadow:inset 1px 1px 0 #2b3350, inset -1px -1px 0 #05070e}
  .tw-avp-name{margin-top:8px;text-align:center;text-transform:uppercase;letter-spacing:.05em;font-size:11px}
  .tw-avp-pick{margin-top:8px;width:100%;border:0;cursor:pointer;color:#fff;background:#54bd37;padding:6px;border-radius:10px;
    font:700 10px 'Pixelify Sans',ui-monospace,'SF Mono',Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.30), inset -2px -2px 0 rgba(0,0,0,.40), 0 2px 0 0 rgba(0,0,0,.4);transition:filter .08s,transform .04s}
  .tw-avp-pick:hover{filter:brightness(1.12)}
  .tw-avp-pick:active{transform:translateY(1px)}
  .tw-avp-card.sel .tw-avp-pick{background:#243a52;color:#9bf05a}
  .tw-avp-badge{position:absolute;top:8px;right:8px;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:#9bf05a;background:#05140a;padding:2px 5px;border-radius:2px}
  .tw-avp-empty{opacity:.7;text-align:center;padding:24px 8px;text-transform:uppercase;letter-spacing:.05em;font-size:11px}
  `;
      document.head.appendChild(el('style', { id: 'tw-avp-style', text: css }));
    }

    function buildPicker() {
      if (picker) return;
      injectStyles();
      tabsEl = el('div', { class: 'tw-avp-tabs' });
      gridEl = el('div', { class: 'tw-avp-grid' });
      const panel = el('div', { class: 'tw-avp', onclick: (e) => e.stopPropagation() }, [
        el('div', { class: 'tw-avp-head' }, [
          el('div', { class: 'tw-avp-title', text: T('worlds.avatarTitle') }),
          el('button', { class: 'tw-avp-close', title: T('worlds.close'), 'aria-label': T('worlds.close'), onclick: closePicker }, [ic('close', 16)]),
        ]),
        tabsEl,
        gridEl,
      ]);
      picker = el('div', { class: 'tw-avp-backdrop', onclick: closePicker }, [panel]);
      document.body.appendChild(picker);
    }

    function activeProvider() {
      return providers.find(p => p.id === activeProviderId) || providers[0] || null;
    }

    function renderTabs() {
      if (!tabsEl) return;
      tabsEl.textContent = '';
      // Only show the tab bar when more than one category exists (e.g. once an
      // open-pets pet provider is registered alongside the built-in classes).
      tabsEl.style.display = providers.length > 1 ? '' : 'none';
      if (!activeProvider()) activeProviderId = (providers[0] && providers[0].id) || 'classes';
      providers.forEach(p => {
        if (p.id === 'classes') return;
        tabsEl.appendChild(el('button', {
          class: 'tw-avp-tab' + (p.id === activeProviderId ? ' active' : ''),
          onclick: () => { activeProviderId = p.id; renderTabs(); renderGrid(); },
        }, [p.label || cap(p.id)]));
      });
    }

    function renderGrid() {
      if (!gridEl) return;
      gridEl.textContent = '';
      const prov = activeProvider();
      const items = (prov && prov.list()) || [];
      const current = prov && typeof prov.current === 'function' ? prov.current() : null;
      if (!items.length) {
        gridEl.appendChild(el('div', { class: 'tw-avp-empty', text: '—' }));
        return;
      }
      items.forEach(it => {
        const selected = it.id === current;
        const thumb = el('div', { class: 'tw-avp-thumb' });
        if (it.thumb) thumb.setAttribute('style', it.thumb);
        const card = el('div', {
          class: 'tw-avp-card' + (selected ? ' sel' : '') + (it.broken ? ' broken' : ''),
          title: it.displayName,
          onclick: () => pick(prov, it.id),
        }, [
          it.builtIn ? null : el('span', { class: 'tw-avp-badge', text: 'NEW' }),
          thumb,
          el('div', { class: 'tw-avp-name', text: it.displayName }),
          el('button', { class: 'tw-avp-pick', onclick: (e) => { e.stopPropagation(); pick(prov, it.id); } },
            [selected ? T('worlds.avatarSelected') : T('worlds.avatarSelect')]),
        ]);
        gridEl.appendChild(card);
      });
    }

    function pick(prov, id) {
      if (!prov) return;
      try { prov.select(id); } catch (_) {}
      renderGrid();
    }

    function openPicker() {
      buildPicker();
      renderTabs();
      renderGrid();
      picker.classList.add('open');
    }
    function closePicker() { if (picker) picker.classList.remove('open'); }

    WS.openAvatarPicker = openPicker;
    WS.closeAvatarPicker = closePicker;

    on('leave', closePicker);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picker && picker.classList.contains('open')) closePicker(); });
  })();
