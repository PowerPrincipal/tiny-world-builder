  // -------- drag/drop imports --------
  (function initTinyWorldDropImports() {
    const MODEL_DROP_EXT_RE = /\.(glb|gltf|obj|fbx)$/i;
    const IMAGE_DROP_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;
    const MODEL_DROP_STATUS_MS = 2600;
    let agentAttachments = [];
    let dropStatusTimer = 0;
    let dropStatusEl = null;

    function droppedFiles(evt) {
      return Array.from((evt && evt.dataTransfer && evt.dataTransfer.files) || []);
    }

    function modelFiles(files) {
      return (files || []).filter(file => MODEL_DROP_EXT_RE.test(file.name || ''));
    }

    function imageFiles(files) {
      return (files || []).filter(file => (file.type && /^image\//i.test(file.type)) || IMAGE_DROP_EXT_RE.test(file.name || ''));
    }

    function hasDropFiles(evt, kind) {
      const files = droppedFiles(evt);
      if (!files.length) {
        const types = Array.from((evt && evt.dataTransfer && evt.dataTransfer.types) || []);
        return types.includes('Files');
      }
      if (kind === 'model') return modelFiles(files).length > 0;
      if (kind === 'image') return imageFiles(files).length > 0;
      return modelFiles(files).length > 0 || imageFiles(files).length > 0;
    }

    function stripExt(name) {
      return String(name || 'asset').replace(/\.[^.]+$/, '') || 'asset';
    }

    function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
    }

    function showDropStatus(text, tone) {
      if (!dropStatusEl) {
        dropStatusEl = document.createElement('div');
        dropStatusEl.className = 'tinyworld-drop-status';
        document.body.appendChild(dropStatusEl);
      }
      dropStatusEl.textContent = text;
      dropStatusEl.dataset.tone = tone || 'ok';
      dropStatusEl.hidden = false;
      clearTimeout(dropStatusTimer);
      dropStatusTimer = setTimeout(() => { if (dropStatusEl) dropStatusEl.hidden = true; }, MODEL_DROP_STATUS_MS);
    }

    function registerDroppedModels(files) {
      const register = window.__tinyworldRegisterDroppedModelStamps;
      if (typeof register !== 'function') return [];
      return register(files);
    }

    function selectedModelTool(asset) {
      if (!asset) return null;
      return {
        id: 'model-stamp:' + asset.id,
        label: asset.label || stripExt(asset.path),
        kind: 'model-stamp',
        modelStampId: asset.id,
        modelAsset: asset,
        isModelStamp: true,
        supported: asset.supported,
        color: '#8aa4b8',
        stampCategories: typeof stampBuilderCategoriesForModelAsset === 'function'
          ? stampBuilderCategoriesForModelAsset(asset)
          : ['models'],
      };
    }

    function selectDroppedModel(asset) {
      const tool = selectedModelTool(asset);
      if (!tool || tool.supported === false || typeof selectTool !== 'function') return false;
      selectTool(tool);
      if (typeof syncModelStampSettingsPanel === 'function') syncModelStampSettingsPanel(tool);
      if (typeof renderStampBuilderCards === 'function') renderStampBuilderCards();
      return true;
    }

    function modelPlacementTarget(evt) {
      if (typeof pickTile !== 'function') return null;
      const hit = pickTile(evt.clientX, evt.clientY);
      if (!hit) return null;
      if (typeof worldTargetFromHit === 'function') return worldTargetFromHit(hit, true);
      const bx = hit.boardX || 0;
      const bz = hit.boardZ || 0;
      return { x: hit.x + bx * GRID, z: hit.z + bz * GRID, cell: getWorldCell(hit.x + bx * GRID, hit.z + bz * GRID), userEdited: !!(bx || bz) };
    }

    function placeDroppedModel(asset, evt) {
      if (!asset || asset.supported === false || typeof setCell !== 'function') return false;
      if (window.__flightActive) return false;
      if (typeof mpEditAllowed === 'function' && !mpEditAllowed()) return false;
      const target = modelPlacementTarget(evt);
      if (!target) return false;
      const mp = window.__tinyworldMultiplayer;
      if (mp && typeof mp.canEdit === 'function' && !mp.canEdit(target.x, target.z)) return false;
      const cell = target.cell || getWorldCell(target.x, target.z);
      const cfg = typeof getModelStampSettings === 'function'
        ? getModelStampSettings(asset.id)
        : { objectScale: 1, offsetY: 0, rotationY: 0 };
      let terrain = (cell && cell.terrain) || 'grass';
      if (terrain === 'water' || terrain === 'lava') terrain = 'grass';
      setCell(target.x, target.z, {
        terrain,
        terrainFloors: cell ? terrainLevelForCell(cell) : 1,
        kind: 'model-stamp',
        floors: 1,
        rotationY: cfg.rotationY || 0,
        offsetY: cfg.offsetY || 0,
        appearance: { modelStampId: asset.id, objectScale: cfg.objectScale || 1 },
        userEdited: !!target.userEdited,
      });
      if (window.__tinyworldSelection && typeof window.__tinyworldSelection.replaceWorldCoords === 'function') {
        window.__tinyworldSelection.replaceWorldCoords([{ x: target.x, z: target.z }]);
      }
      selectDroppedModel(asset);
      return true;
    }

    function renderAgentAttachments() {
      const form = document.getElementById('agent-input');
      if (!form) return;
      let wrap = document.getElementById('agent-attachments');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'agent-attachments';
        wrap.className = 'agent-attachments';
        const suggestions = document.getElementById('agent-suggestions');
        form.insertBefore(wrap, suggestions || null);
      }
      wrap.innerHTML = '';
      wrap.hidden = !agentAttachments.length;
      agentAttachments.forEach(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'agent-attachment-chip';
        chip.title = item.name;
        chip.textContent = (item.type === 'image' ? 'Image: ' : 'Model: ') + item.name;
        chip.addEventListener('click', () => {
          agentAttachments = agentAttachments.filter(a => a.id !== item.id);
          renderAgentAttachments();
        });
        wrap.appendChild(chip);
      });
      form.classList.toggle('has-attachments', agentAttachments.length > 0);
    }

    async function attachFilesToAgent(files) {
      const models = registerDroppedModels(modelFiles(files));
      models.forEach(asset => {
        agentAttachments.push({
          id: 'model:' + asset.id,
          type: 'model',
          name: asset.label || stripExt(asset.path),
          modelStampId: asset.id,
        });
      });
      for (const file of imageFiles(files)) {
        const dataUrl = await fileToDataUrl(file);
        agentAttachments.push({
          id: 'image:' + Date.now().toString(36) + ':' + agentAttachments.length,
          type: 'image',
          name: stripExt(file.name),
          dataUrl,
        });
      }
      renderAgentAttachments();
      if (models.length || imageFiles(files).length) {
        showDropStatus('Attached ' + (models.length + imageFiles(files).length) + ' file' + ((models.length + imageFiles(files).length) === 1 ? '' : 's') + ' to chat');
      }
    }

    function setupDropTarget(el, opts) {
      if (!el) return;
      const kind = opts && opts.kind;
      el.addEventListener('dragover', e => {
        if (!hasDropFiles(e, kind)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = opts && opts.effect || 'copy';
        el.classList.add('drop-hot');
      });
      el.addEventListener('dragleave', e => {
        if (e.relatedTarget && el.contains(e.relatedTarget)) return;
        el.classList.remove('drop-hot');
      });
      el.addEventListener('drop', e => {
        const files = droppedFiles(e);
        if (!files.length || !hasDropFiles(e, kind)) return;
        e.preventDefault();
        el.classList.remove('drop-hot');
        opts.onDrop(files, e);
      });
    }

    function setupAgentDrops() {
      const form = document.getElementById('agent-input');
      const panel = document.getElementById('agent-panel');
      const onDrop = files => attachFilesToAgent(files).catch(err => showDropStatus(err.message || String(err), 'error'));
      setupDropTarget(form, { kind: 'any', effect: 'copy', onDrop });
      setupDropTarget(panel, { kind: 'any', effect: 'copy', onDrop });
    }

    function setupStampDrops() {
      const panel = document.getElementById('stamp-builder-panel');
      setupDropTarget(panel, {
        kind: 'model',
        effect: 'copy',
        onDrop(files) {
          const assets = registerDroppedModels(modelFiles(files));
          if (!assets.length) {
            showDropStatus('Drop GLB, GLTF, or OBJ files for Stamps', 'error');
            return;
          }
          selectDroppedModel(assets[0]);
          showDropStatus('Imported ' + assets.length + ' model stamp' + (assets.length === 1 ? '' : 's'));
        },
      });
    }

    function setupCanvasDrops() {
      const canvas = (typeof renderer !== 'undefined' && renderer) ? renderer.domElement : null;
      setupDropTarget(canvas, {
        kind: 'model',
        effect: 'copy',
        onDrop(files, evt) {
          const assets = registerDroppedModels(modelFiles(files));
          if (!assets.length) {
            showDropStatus('Drop a GLB, GLTF, or OBJ model on the world', 'error');
            return;
          }
          const placed = placeDroppedModel(assets[0], evt);
          showDropStatus(placed ? 'Placed ' + (assets[0].label || 'model') : 'Pick an editable tile before dropping a model', placed ? 'ok' : 'error');
        },
      });
    }

    window.__tinyworldAgentDropAttachments = {
      peek() {
        return agentAttachments.slice();
      },
      clear() {
        agentAttachments = [];
        renderAgentAttachments();
      },
      promptContext(items) {
        const attachments = Array.isArray(items) ? items : agentAttachments;
        if (!attachments.length) return '';
        const lines = ['\n\nAttached file context:'];
        attachments.forEach(item => {
          if (item.type === 'model') {
            lines.push('- Model "' + item.name + '" is already imported as modelStampId "' + item.modelStampId + '". To use it in generated world JSON, place a cell with kind:"model-stamp", floors:1, buildingType:null, fenceSide:null, and appearance:{ "modelStampId":"' + item.modelStampId + '", "objectScale":1 }.');
          } else if (item.type === 'image') {
            lines.push('- Image "' + item.name + '" is attached as visual reference. Match its subject, palette, or composition when relevant.');
          }
        });
        return lines.join('\n');
      },
      summaryText(items) {
        const attachments = Array.isArray(items) ? items : agentAttachments;
        if (!attachments.length) return '';
        return attachments.map(item => '[' + (item.type === 'image' ? 'image' : 'model') + ': ' + item.name + ']').join(' ');
      },
      addFiles(files) {
        return attachFilesToAgent(files);
      },
    };

    window.addEventListener('DOMContentLoaded', () => {
      setupAgentDrops();
      setupStampDrops();
      setupCanvasDrops();
      renderAgentAttachments();
    });
  }());
