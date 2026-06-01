  // -------- procedural pixel-art textures --------
  function createPixelTexture(type, scale = 16) {
    const canvas = document.createElement('canvas');
    canvas.width = scale;
    canvas.height = scale;
    const ctx = canvas.getContext('2d');
    const rand = makeMulberry32('pixel-texture:' + type + ':' + scale);

    if (type === 'checkered') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#e2e2e2';
      const half = scale / 2;
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
    } else if (type === 'noise') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x++) {
        for (let y = 0; y < scale; y++) {
          const r = rand();
          if (r > 0.75) ctx.fillStyle = '#f2f2f2';
          else if (r > 0.45) ctx.fillStyle = '#e5e5e5';
          else if (r > 0.15) ctx.fillStyle = '#dcdcdc';
          else ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else if (type === 'brick') {
      ctx.fillStyle = '#bfbfbf'; // mortar
      ctx.fillRect(0, 0, scale, scale);
      const rows = 4;
      const rowH = scale / rows;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (scale / 4);
        ctx.fillStyle = (r % 2 === 0) ? '#ffffff' : '#f0f0f0';
        ctx.fillRect(offset + 0.5, r * rowH + 0.5, scale / 2 - 1, rowH - 1);
        ctx.fillRect(scale / 2 + offset + 0.5, r * rowH + 0.5, scale / 2 - 1, rowH - 1);
        if (offset > 0) {
          ctx.fillRect(-scale / 2 + offset + 0.5, r * rowH + 0.5, scale / 2 - 1, rowH - 1);
        }
      }
    } else if (type === 'shingles') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#d0d0d0';
      const rows = 4;
      const rowH = scale / rows;
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(0, r * rowH, scale, 1);
        for (let c = 0; c < 2; c++) {
          const cx = Math.floor(c * (scale / 2) + (r % 2) * (scale / 4));
          ctx.fillRect(cx, r * rowH, 1, rowH);
        }
      }
    } else if (type === 'planks') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      const plankH = 4;
      for (let y = 0; y < scale; y += plankH) {
        ctx.fillStyle = '#b8b8b8';
        ctx.fillRect(0, y, scale, 1);
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, y + 1, scale, 1);
        const offset = (y / plankH) % 2 === 0 ? 0 : scale / 2;
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(offset, y, 1, plankH);
        ctx.fillRect((offset + scale / 2) % scale, y, 1, plankH);
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = rand() > 0.45 ? '#e5e5e5' : '#f4f4f4';
          ctx.fillRect(Math.floor(rand() * scale), y + 1 + Math.floor(rand() * Math.max(1, plankH - 1)), 1, 1);
        }
      }
    } else if (type === 'stone') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < scale * 1.8; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = 1 + Math.floor(rand() * 2);
        const h = 1 + Math.floor(rand() * 2);
        ctx.fillStyle = rand() > 0.45 ? '#d8d8d8' : '#f1f1f1';
        ctx.fillRect(x, y, w, h);
      }
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, scale, 1);
      ctx.fillRect(0, scale - 1, scale, 1);
      ctx.fillRect(0, 0, 1, scale);
      ctx.fillRect(scale - 1, 0, 1, scale);
    } else if (type === 'hay') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < 15; i++) {
        const x = rand() * scale;
        const y = rand() * scale;
        const len = 3 + rand() * 5;
        const a = rand() * Math.PI;
        ctx.strokeStyle = rand() > 0.4 ? '#d8d8d8' : '#efefef';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
    } else if (type === 'ripples') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(0, 3, scale, 1);
      ctx.fillRect(0, 11, scale, 1);
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(scale / 4, 4, scale / 2, 1);
      ctx.fillRect(scale * 0.75, 12, scale / 4, 1);
    } else if (type === 'leaves') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x++) {
        for (let y = 0; y < scale; y++) {
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = '#ffffff';
          } else {
            const r = rand();
            ctx.fillStyle = r > 0.6 ? '#f2f2f2' : (r > 0.2 ? '#e0e0e0' : '#d0d0d0');
          }
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else if (type === 'wood') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#f0f0f0';
      for (let x = 0; x < scale; x += 4) {
        ctx.fillRect(x, 0, 2, scale);
      }
      for (let i = 0; i < scale * scale * 0.1; i++) {
        const px = Math.floor(rand() * scale);
        const py = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.5 ? '#e0e0e0' : '#ffffff';
        ctx.fillRect(px, py, 1, 1);
      }
    } else if (type === 'dirt') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < 28; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.65 ? '#d2d2d2' : (rand() > 0.35 ? '#e5e5e5' : '#f4f4f4');
        ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 1 + Math.floor(rand() * 2));
      }
    } else if (type === 'sand') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < scale * scale * 0.22; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const r = rand();
        ctx.fillStyle = r > 0.72 ? '#f6f6f6' : (r > 0.35 ? '#e4e4e4' : '#d7d7d7');
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (type === 'rock-face') {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < scale * scale * 0.32; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = 1 + Math.floor(rand() * 3);
        const h = 1 + Math.floor(rand() * 3);
        const r = rand();
        ctx.fillStyle = r > 0.72 ? '#ffffff' : (r > 0.38 ? '#d8d8d8' : '#c8c8c8');
        ctx.fillRect(x, y, w, h);
      }
      for (let i = 0; i < Math.max(6, scale * 0.45); i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const len = 3 + Math.floor(rand() * 7);
        ctx.strokeStyle = rand() > 0.5 ? 'rgba(70,70,70,0.16)' : 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + Math.floor(rand() * 3) - 1);
        ctx.stroke();
      }
    } else if (type === 'grass') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x++) {
        for (let y = 0; y < scale; y++) {
          const r = rand();
          if (r > 0.88) {
            ctx.fillStyle = '#f7f7f7';
            ctx.fillRect(x, y, 1, 1);
          } else if (r < 0.12) {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.fillStyle = '#e2e2e2';
      const numBlades = Math.floor(scale * scale * 0.08);
      for (let i = 0; i < numBlades; i++) {
        const bx = Math.floor(rand() * scale);
        const by = Math.floor(rand() * (scale - 1));
        ctx.fillRect(bx, by, 1, 2);
        if (rand() > 0.6 && bx < scale - 1) {
          ctx.fillRect(bx + 1, by + 1, 1, 1);
        }
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function createCottageTexture(type, scale = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = scale;
    canvas.height = scale;
    const ctx = canvas.getContext('2d');
    const rand = makeMulberry32('cottage-texture:' + type + ':' + scale);
    function addNoise(amount = 42, alpha = 0.14) {
      const image = ctx.getImageData(0, 0, scale, scale);
      for (let i = 0; i < image.data.length; i += 4) {
        const n = Math.floor((rand() - 0.5) * amount);
        image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
        image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
        image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
        image.data[i + 3] = Math.floor(255 * (1 - alpha + alpha * rand()));
      }
      ctx.putImageData(image, 0, 0);
    }

    if (type === 'grass') {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < 850; i++) {
        const x = rand() * scale;
        const y = rand() * scale;
        const h = 2 + rand() * 8;
        ctx.strokeStyle = rand() > 0.5 ? '#d4d4d4' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand() * 3 - 1.5, y - h);
        ctx.stroke();
      }
    } else if (type === 'wood') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x += 9) {
        ctx.strokeStyle = x % 18 === 0 ? '#b8b8b8' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 4, scale * 0.25, x - 3, scale * 0.65, x + 2, scale);
        ctx.stroke();
      }
      addNoise(30, 0.08);
    } else if (type === 'glass') {
      const g = ctx.createLinearGradient(0, 0, scale, scale);
      g.addColorStop(0, '#9fe3ff');
      g.addColorStop(1, '#417fa8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.fillRect(scale * 0.19, scale * 0.16, scale * 0.13, scale * 0.78);
      ctx.fillRect(scale * 0.53, scale * 0.16, scale * 0.05, scale * 0.78);
      ctx.fillStyle = 'rgba(20,42,70,0.22)';
      ctx.fillRect(0, scale * 0.5 - 3, scale, 6);
      ctx.fillRect(scale * 0.5 - 3, 0, 6, scale);
    } else if (type === 'dirt') {
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(0, 0, scale, scale);
      for (let y = 0; y < scale; y += 11) {
        ctx.fillStyle = y % 22 === 0 ? '#d8d8d8' : '#e6e6e6';
        ctx.fillRect(0, y + Math.floor(rand() * 2), scale, 2);
      }
      for (let i = 0; i < 420; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = rand() > 0.78 ? 2 : 1;
        ctx.fillStyle = rand() > 0.55 ? '#d0d0d0' : '#f7f7f7';
        ctx.fillRect(x, y, w, 1);
      }
      addNoise(24, 0.06);
    } else {
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#b8b8b8';
      for (let y = 0; y < scale; y += 18) {
        ctx.fillRect(0, y, scale, 2);
      }
      for (let y = 0; y < scale; y += 36) {
        for (let x = 0; x < scale; x += 32) {
          ctx.fillRect(x + (y % 72 ? 16 : 0), y, 2, 18);
        }
      }
      for (let i = 0; i < 110; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = 1 + Math.floor(rand() * 4);
        const h = 1 + Math.floor(rand() * 3);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(90,90,90,0.14)';
        ctx.fillRect(x, y, w, h);
      }
      addNoise(26, 0.06);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapNearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function applyWorldUVs(material, texture, textureScale = 1.0, opts = {}) {
    if (!material) return;
    material.map = texture;
    material.userData = material.userData || {};
    material.userData.worldTextureScale = textureScale;
    material.userData.worldVoxelSeams = !!opts.voxelSeams;
    material.needsUpdate = true;
    material.onBeforeCompile = (shader) => {
      if (opts.voxelSeams) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `
          #include <common>
          varying vec3 vWorldVoxelPos;
          varying vec3 vWorldVoxelNormal;
          `
        );
      }
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 worldPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          worldPos = instanceMatrix * worldPos;
        #endif
        worldPos = modelMatrix * worldPos;

        vec4 localNormal = vec4(normal, 0.0);
        #ifdef USE_INSTANCING
          localNormal = instanceMatrix * localNormal;
        #endif
        vec3 worldNormal = normalize((modelMatrix * localNormal).xyz);

        if (abs(worldNormal.y) > 0.5) {
          vUv = worldPos.xz * ${textureScale.toFixed(4)};
        } else if (abs(worldNormal.x) > 0.5) {
          vUv = worldPos.zy * ${textureScale.toFixed(4)};
        } else {
          vUv = worldPos.xy * ${textureScale.toFixed(4)};
        }
        ${opts.voxelSeams ? `
        vWorldVoxelPos = worldPos.xyz;
        vWorldVoxelNormal = worldNormal;
        ` : ''}
        `
      );
      if (opts.voxelSeams) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `
          #include <common>
          varying vec3 vWorldVoxelPos;
          varying vec3 vWorldVoxelNormal;

          float twVoxelSeamLine(float coord, float scale, float width) {
            float f = fract(coord * scale);
            float d = min(f, 1.0 - f);
            return 1.0 - smoothstep(width, width * 2.8, d);
          }

          float twVoxelBlockHash(vec2 cell) {
            return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
          }
          `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          #include <map_fragment>
          vec3 seamNormal = normalize(vWorldVoxelNormal);
          float sideFace = 1.0 - smoothstep(0.42, 0.72, abs(seamNormal.y));
          float sideCoord = abs(seamNormal.x) > abs(seamNormal.z) ? vWorldVoxelPos.z : vWorldVoxelPos.x;
          float sideY = vWorldVoxelPos.y + 0.08;
          float sideGridX = 9.60;
          float sideGridY = 7.80;
          vec2 sideCell = floor(vec2(sideCoord * sideGridX, sideY * sideGridY));
          float yBand = twVoxelSeamLine(sideY, sideGridY, 0.015);
          float vBlock = twVoxelSeamLine(sideCoord, sideGridX, 0.015);
          float vBlockFine = twVoxelSeamLine(sideCoord + sideY * 0.08, sideGridX * 2.0, 0.005);
          float blockShade = twVoxelBlockHash(sideCell) - 0.5;
          float underFace = smoothstep(0.62, 0.86, -seamNormal.y);
          float underX = twVoxelSeamLine(vWorldVoxelPos.x, 5.00, 0.012);
          float underZ = twVoxelSeamLine(vWorldVoxelPos.z, 5.00, 0.012);
          float underCellShade = twVoxelBlockHash(floor(vWorldVoxelPos.xz * 5.00)) - 0.5;
          float sideSeam = sideFace * clamp(yBand * 0.64 + vBlock * 0.64 + vBlockFine * 0.10, 0.0, 1.0);
          float seam = clamp(sideSeam + underFace * max(underX, underZ) * 0.42, 0.0, 1.0);
          diffuseColor.rgb *= 1.0 + sideFace * blockShade * 0.055 + underFace * underCellShade * 0.045;
          diffuseColor.rgb *= mix(1.0, 0.56, seam);
          `
        );
      }
    };
  }

  const waterTextureFlowStates = new Map();

  function waterTextureFlowState(dx = 1, dz = 0) {
    const sx = Math.sign(dx || 0);
    const sz = Math.sign(dz || 0);
    const key = sx + ',' + sz;
    if (!waterTextureFlowStates.has(key)) {
      waterTextureFlowStates.set(key, {
        offset: new THREE.Vector2(0, 0),
        direction: new THREE.Vector2(sx, sz),
        speed: 0.20,
      });
    }
    return waterTextureFlowStates.get(key);
  }

  function applyFlowingWaterUVs(material, texture, textureScale = 1.0, flowState = waterTextureFlowState(1, 0)) {
    if (!material) return;
    material.map = texture;
    material.userData = material.userData || {};
    material.userData.worldTextureScale = textureScale;
    material.needsUpdate = true;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.waterFlowOffset = { value: flowState.offset };
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform vec2 waterFlowOffset;
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 worldPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          worldPos = instanceMatrix * worldPos;
        #endif
        worldPos = modelMatrix * worldPos;

        vec4 localNormal = vec4(normal, 0.0);
        #ifdef USE_INSTANCING
          localNormal = instanceMatrix * localNormal;
        #endif
        vec3 worldNormal = normalize((modelMatrix * localNormal).xyz);

        if (abs(worldNormal.y) > 0.5) {
          vUv = worldPos.xz * ${textureScale.toFixed(4)} + waterFlowOffset;
        } else if (abs(worldNormal.x) > 0.5) {
          vUv = worldPos.zy * ${textureScale.toFixed(4)} + waterFlowOffset.yx;
        } else {
          vUv = worldPos.xy * ${textureScale.toFixed(4)} + waterFlowOffset;
        }
        `
      );
    };
  }

  function applyTerrainWorldUVs(name, material, texture, textureScale = 1.0) {
    if (name === 'water' || name === 'waterDk') applyFlowingWaterUVs(material, texture, textureScale);
    else applyWorldUVs(material, texture, textureScale);
  }

  function tickWaterTextureFlow(dt) {
    if (!dt) return;
    for (const state of waterTextureFlowStates.values()) {
      state.offset.x = (state.offset.x + state.direction.x * state.speed * dt) % 1;
      state.offset.y = (state.offset.y + state.direction.y * state.speed * dt) % 1;
    }
  }

  const WATER_FLOW_DIRECTIONS = new Set(['auto', 'n', 's', 'e', 'w']);
  const waterFlowMaterialCache = new Map();

  function normalizeWaterFlow(value) {
    const key = String(value || 'auto').trim().toLowerCase();
    return WATER_FLOW_DIRECTIONS.has(key) ? key : 'auto';
  }

  function waterFlowVectorForKey(key) {
    if (key === 'n') return { dx: 0, dz: -1 };
    if (key === 's') return { dx: 0, dz: 1 };
    if (key === 'e') return { dx: 1, dz: 0 };
    if (key === 'w') return { dx: -1, dz: 0 };
    return null;
  }

  function waterFlowAxisForCell(terrainN) {
    const ew = terrainN && (terrainN.e === 'water' || terrainN.w === 'water');
    const ns = terrainN && (terrainN.n === 'water' || terrainN.s === 'water');
    if (ew && !ns) return 'x';
    if (ns && !ew) return 'z';
    return ew ? 'x' : 'z';
  }

  function waterFlowBridgeSplit(axis, x, z) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < GRID; i++) {
      const cell = axis === 'x' ? getWorldCell(i, z) : getWorldCell(x, i);
      if (cell && cell.terrain === 'water' && cell.kind === 'bridge') {
        total += i;
        count++;
      }
    }
    return count ? total / count : (GRID - 1) / 2;
  }

  function waterFlowVectorForCell(x, z, terrainN) {
    const cell = getWorldCell(x, z);
    const forced = waterFlowVectorForKey(normalizeWaterFlow(cell && cell.waterFlow));
    if (forced) return forced;
    const axis = waterFlowAxisForCell(terrainN);
    const split = waterFlowBridgeSplit(axis, x, z);
    // Each side of the bridge flows TOWARD the bridge (converging) instead of
    // away from it — gives the river a subtle "draws in under the bridge" look.
    if (axis === 'x') return { dx: x < split ? 1 : -1, dz: 0 };
    return { dx: 0, dz: z < split ? 1 : -1 };
  }

  function waterFlowMaterial(base, dx, dz) {
    if (!base) return base;
    const scale = base.userData && base.userData.worldTextureScale ? base.userData.worldTextureScale : 1;
    const map = base.map || texRipples;
    const color = base.color ? base.color.getHexString() : 'none';
    const key = (base.uuid || base.id) + ':' + (map && (map.uuid || map.id)) + ':' + scale + ':' + color + ':' + Math.sign(dx || 0) + ',' + Math.sign(dz || 0);
    if (!waterFlowMaterialCache.has(key)) {
      const mat = base.clone();
      applyFlowingWaterUVs(mat, map, scale, waterTextureFlowState(dx, dz));
      waterFlowMaterialCache.set(key, mat);
    }
    return waterFlowMaterialCache.get(key);
  }

  const texCheckered = createPixelTexture('checkered', 16);
  const texNoise = createPixelTexture('noise', 16);
  const texBrick = createPixelTexture('brick', 32);
  const texShingles = createPixelTexture('shingles', 16);
  const texRipples = createPixelTexture('ripples', 16);
  const texLeaves = createPixelTexture('leaves', 16);
  const texWood = createPixelTexture('wood', 16);
  const texGrass = createPixelTexture('grass', 16);
  const texPlanks = createPixelTexture('planks', 16);
  const texStone = createPixelTexture('stone', 16);
  const texHay = createPixelTexture('hay', 16);
  const texDirt = createPixelTexture('dirt', 16);
  const texSand = createPixelTexture('sand', 16);
  const texRockFace = createPixelTexture('rock-face', 32);
  const texCottageGrass = createCottageTexture('grass', 128);
  const texCottageWood = createCottageTexture('wood', 128);
  const texCottageGlass = createCottageTexture('glass', 128);
  const texCottageStone = createCottageTexture('stone', 128);
  const texCottageDirt = createCottageTexture('dirt', 128);

  function createMaterialImageTexture(src) {
    const tex = new THREE.TextureLoader().load(src, () => {
      repaintAfterTextureLoad();
    });
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  const texAtlasNatureWood = createMaterialImageTexture('textures/HJCliEibkAAmqIj.jpeg');
  const texAtlasTileSet = createMaterialImageTexture('textures/HJCliEjbEAA9Ah2.jpeg');
  const texAtlasRoofStrips = createMaterialImageTexture('textures/HJCliEqagAAE8e4.jpeg');
  const texAtlasReference = createMaterialImageTexture('textures/reference.jpeg');
  const proceduralPixelTextures = {
    checkered: texCheckered,
    noise: texNoise,
    brick: texBrick,
    shingles: texShingles,
    ripples: texRipples,
    leaves: texLeaves,
    wood: texWood,
    grass: texGrass,
    planks: texPlanks,
    stone: texStone,
    hay: texHay,
    dirt: texDirt,
    sand: texSand,
    'rock-face': texRockFace,
    'cottage-grass': texCottageGrass,
    'cottage-wood': texCottageWood,
    'cottage-glass': texCottageGlass,
    'cottage-stone': texCottageStone,
    'cottage-dirt': texCottageDirt,
  };

  const MATERIAL_TEXTURE_OPTIONS = [
    { key: 'default', label: 'Default' },
    { key: 'checkered', label: 'Checker' },
    { key: 'noise', label: 'Soft noise' },
    { key: 'brick', label: 'Brick' },
    { key: 'shingles', label: 'Shingles' },
    { key: 'planks', label: 'Planks' },
    { key: 'stone', label: 'Stone chips' },
    { key: 'leaves', label: 'Leaves' },
    { key: 'wood', label: 'Wood grain' },
    { key: 'grass', label: 'Grass blades' },
    { key: 'hay', label: 'Hay / straw' },
    { key: 'dirt', label: 'Dirt specks' },
    { key: 'sand', label: 'Sand grain' },
    { key: 'rock-face', label: 'Rock face' },
    { key: 'ripples', label: 'Water ripples' },
    { key: 'cottage-grass', label: 'Cottage grass' },
    { key: 'cottage-wood', label: 'Cottage wood' },
    { key: 'cottage-glass', label: 'Cottage glass' },
    { key: 'cottage-stone', label: 'Cottage stone' },
    { key: 'cottage-dirt', label: 'Cottage dirt' },
    { key: 'atlas-nature-wood', label: 'Texture folder: nature + wood' },
    { key: 'atlas-tiles', label: 'Texture folder: tile set' },
    { key: 'atlas-roofs', label: 'Texture folder: roof strips' },
    { key: 'atlas-reference', label: 'Texture folder: reference board' },
  ];

  const materialTextureMap = Object.assign({}, proceduralPixelTextures, {
    'atlas-nature-wood': texAtlasNatureWood,
    'atlas-tiles': texAtlasTileSet,
    'atlas-roofs': texAtlasRoofStrips,
    'atlas-reference': texAtlasReference,
  });

  function normalizeMaterialTextureKey(value) {
    const key = String(value || 'default').toLowerCase();
    if (key === 'none' || key === 'default') return 'default';
    return materialTextureMap[key] ? key : 'default';
  }

  function normalizeMaterialTextureScale(value) {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0.5, Math.min(4, n));
  }

  function materialTextureForKey(key) {
    return materialTextureMap[normalizeMaterialTextureKey(key)] || null;
  }

  M.grass.color.set(0x75b84b);
  M.grassEdge.color.set(0x5da23d);
  M.grassHi.color.set(0x8ccc5d);
  M.door.color.set(0x7b4b2a);
  M.woodTrim.color.set(0x5c361d);
  M.bridgeWood.color.set(0x7b4b2a);
  M.bridgeWoodD.color.set(0x5c361d);
  M.fence.color.set(0x7b4b2a);
  M.trunk.color.set(0x7b4b2a);

  const initialGrassTex = texCottageGrass;
  applyWorldUVs(M.grass, initialGrassTex, 1.0);
  applyWorldUVs(M.grassEdge, initialGrassTex, 1.0);
  applyWorldUVs(M.grassHi, initialGrassTex, 1.0);
  applyWorldUVs(M.boardSide, texRockFace, 2.4, { voxelSeams: true });

  applyWorldUVs(M.path, texNoise, 1.0);
  applyWorldUVs(M.pathTrim, texNoise, 1.0);
  applyWorldUVs(M.pathScuff, texNoise, 1.0);

  M.dirt.color.set(0x7b4b2a);
  M.dirtRich.color.set(0x5d361d);
  applyWorldUVs(M.dirt, texCottageDirt, 1.4);
  applyWorldUVs(M.dirtRich, texCottageDirt, 1.4);

  applyFlowingWaterUVs(M.water, texRipples, 1.0);
  applyFlowingWaterUVs(M.waterDk, texRipples, 1.0);

  applyWorldUVs(M.wallCream, texCottageStone, 10.0);
  applyWorldUVs(M.wallTrim, texCottageStone, 10.0);
  applyWorldUVs(M.roofBlue, texShingles, 28.0);
  applyWorldUVs(M.roofBlueD, texShingles, 28.0);
  applyWorldUVs(M.islandUnder, texRockFace, 2.8, { voxelSeams: true });
  applyWorldUVs(M.islandUnderD, texRockFace, 2.8, { voxelSeams: true });

  applyWorldUVs(M.castleStone, texBrick, 11.0);
  applyWorldUVs(M.castleStoneD, texBrick, 11.0);
  M.stone.color.set(0x8b8d88);
  M.stoneDk.color.set(0x5f6668);
  applyWorldUVs(M.stone, texCottageStone, 2.0);
  applyWorldUVs(M.stoneDk, texCottageStone, 2.0);
  applyWorldUVs(M.rock, texStone, 4.0);
  applyWorldUVs(M.rockDk, texStone, 4.0);
  applyWorldUVs(M.rockHi, texStone, 4.0);

  applyWorldUVs(M.manorBrick, texCottageStone, 10.0);
  applyWorldUVs(M.manorBrickD, texCottageStone, 10.0);
  applyWorldUVs(M.manorTrim, texNoise, 1.6);
  applyWorldUVs(M.manorRoof, texShingles, 28.0);
  applyWorldUVs(M.manorRoofD, texShingles, 28.0);

  applyWorldUVs(M.towerRoof, texShingles, 28.0);
  applyWorldUVs(M.towerRoofD, texShingles, 28.0);

  applyWorldUVs(M.leaves, texLeaves, 4.0);
  applyWorldUVs(M.leavesDk, texLeaves, 4.0);
  applyWorldUVs(M.trunk, texCottageWood, 3.0);
  applyWorldUVs(M.bridgeWood, texCottageWood, 3.0);
  applyWorldUVs(M.bridgeWoodD, texCottageWood, 3.0);
  applyWorldUVs(M.fence, texCottageWood, 3.0);
  applyWorldUVs(M.door, texCottageWood, 3.0);
  applyWorldUVs(M.woodTrim, texCottageWood, 3.0);
  applyWorldUVs(M.sand, texSand, 1.8);
  applyWorldUVs(M.sandDk, texSand, 1.8);
  applyWorldUVs(M.towerStone, texCottageStone, 10.0);
  applyWorldUVs(M.towerStoneD, texCottageStone, 10.0);
  M.windowB.map = texCottageGlass;
  M.windowB.color.set(0xffffff);
  M.windowB.needsUpdate = true;
  M.manorWindow.map = texCottageGlass;
  M.manorWindow.color.set(0xffffff);
  M.manorWindow.needsUpdate = true;
  M.skyGlass.map = texCottageGlass;
  M.skyGlass.color.set(0xffffff);
  M.skyGlass.needsUpdate = true;

  const customMaterialCache = new Map();
  function normalizeHexColor(value) {
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^[0-9a-f]{6}$/i.test(s)) return ('#' + s).toLowerCase();
    return null;
  }
  function shadeHexColor(hex, amount) {
    const clean = normalizeHexColor(hex);
    if (!clean) return null;
    const n = parseInt(clean.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  function normalizeProceduralTextureKind(kind) {
    const key = String(kind || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!key) return null;
    if (key === 'leaf' || key === 'leaves' || key === 'foliage') return 'leaves';
    if (key === 'shingle' || key === 'roof' || key === 'roofing') return 'shingles';
    if (key === 'plank' || key === 'planks' || key === 'board' || key === 'boards') return 'planks';
    if (key === 'stone' || key === 'rock' || key === 'masonry') return 'stone';
    if (key === 'wood' || key === 'trunk' || key === 'timber') return 'wood';
    if (key === 'hay' || key === 'straw' || key === 'wheat') return 'hay';
    if (key === 'dirt' || key === 'soil' || key === 'mud') return 'dirt';
    if (key === 'sand' || key === 'beach' || key === 'desert') return 'sand';
    if (proceduralPixelTextures[key]) return key;
    return null;
  }
  function proceduralTextureKindForMaterialName(name) {
    const key = String(name || '').toLowerCase();
    if (!key) return null;
    if (/roof|shingle/.test(key)) return 'shingles';
    if (/plank|board|crate|bridge/.test(key)) return 'planks';
    if (/wood|trunk|fence|post|rail|door/.test(key)) return 'wood';
    if (/stone|rock|slate|masonry|grey|gray/.test(key)) return 'stone';
    if (/leaf|leaves|foliage|crop|green|bush|grass|blossom/.test(key)) return 'leaves';
    if (/hay|straw|wheat|yellow/.test(key)) return 'hay';
    if (/dirt|soil|mud|path/.test(key)) return 'dirt';
    if (/sand|beach|desert/.test(key)) return 'sand';
    return null;
  }
  function inferProceduralTextureKind(hex, hint) {
    const named = normalizeProceduralTextureKind(hint) || proceduralTextureKindForMaterialName(hint);
    if (named) return named;
    const clean = normalizeHexColor(hex);
    if (!clean) return 'noise';
    const n = parseInt(clean.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;
    const val = max / 255;
    let h = 0;
    if (max !== min) {
      if (max === r) h = 60 * (((g - b) / (max - min)) % 6);
      else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
      else h = 60 * ((r - g) / (max - min) + 4);
      if (h < 0) h += 360;
    }
    if (sat < 0.14 && val < 0.86) return 'stone';
    if (h >= 15 && h <= 45 && val < 0.74 && sat > 0.20) return 'wood';
    if (h >= 38 && h <= 64 && val > 0.52 && sat > 0.32) return 'hay';
    if (h >= 65 && h <= 165 && sat > 0.18) return 'leaves';
    if (h >= 8 && h <= 38 && val < 0.56) return 'dirt';
    if (h >= 35 && h <= 58 && val >= 0.56 && sat > 0.14) return 'sand';
    return 'noise';
  }
  function proceduralTextureScaleForKind(kind) {
    if (kind === 'shingles' || kind === 'planks' || kind === 'wood') return 3.0;
    if (kind === 'brick' || kind === 'stone' || kind === 'leaves') return 4.0;
    if (kind === 'dirt' || kind === 'hay' || kind === 'sand') return 2.0;
    return 1.6;
  }

  const TERRAIN_COLOR_KEYS = ['grass', 'path', 'dirt', 'water', 'stone', 'sand', 'snow', 'lava'];
  const TERRAIN_COLOR_MATERIALS = {
    grass: ['grass', 'grassEdge', 'grassHi'],
    path: ['path', 'pathTrim', 'pathScuff'],
    dirt: ['dirt', 'dirtRich'],
    water: ['water', 'waterDk'],
    stone: ['stone', 'stoneDk'],
    sand: ['sand', 'sandDk'],
    snow: ['snow', 'snowDk'],
    lava: ['lava', 'lavaCrust'],
  };
  const terrainMaterialBaseColors = new Map();
  const terrainMaterialBaseMaps = new Map();
  const terrainMaterialBaseScales = new Map();
  const PART_MATERIAL_GROUPS = {
    walls: { label: 'Walls', materials: ['wallCream', 'wallTrim', 'manorBrick', 'manorBrickD', 'towerStone', 'towerStoneD', 'castleStone', 'castleStoneD', 'skyBody'] },
    roofs: { label: 'Roofs', materials: ['roofBlue', 'roofBlueD', 'manorRoof', 'manorRoofD', 'towerRoof', 'towerRoofD', 'skyRoof'] },
    trim: { label: 'Trim / frames / columns', materials: ['woodTrim', 'manorTrim', 'skyFrame', 'step', 'chimney'] },
    windows: { label: 'Windows / glass', materials: ['windowB', 'windowLit', 'windowNight', 'manorWindow', 'skyGlass', 'castleSlit'] },
    wood: { label: 'Wood / doors / fences', materials: ['door', 'bridgeWood', 'bridgeWoodD', 'fence'] },
    foliage: { label: 'Trees / foliage', materials: ['leaves', 'leavesDk', 'rockMoss'] },
    crops: { label: 'Crops / flowers', materials: ['cropLeaf', 'cropStem', 'cornStalk', 'cornCob', 'cornLeaf', 'wheatStalk', 'wheatHead', 'pumpkin', 'pumpkinDk', 'pumpkinStem', 'carrotBody', 'sunflowerStalk', 'sunflowerPetal', 'sunflowerCenter'] },
    rocks: { label: 'Rocks / stone props', materials: ['rock', 'rockDk', 'rockHi', 'stone', 'stoneDk'] },
    metal: { label: 'Metal / accents', materials: ['fenceWire', 'fenceSteel', 'knob', 'flagRed'] },
  };
  const partMaterialBaseColors = new Map();
  const partMaterialBaseMaps = new Map();
  const partMaterialBaseScales = new Map();

  const SURFACE_TEXTURE_DEFAULTS = {
    grass: { texture: 'cottage-grass', fallbackTexture: 'checkered', scale: 1.0, materials: ['grass', 'grassEdge', 'grassHi'] },
    dirt: { texture: 'cottage-dirt', scale: 1.4, materials: ['dirt', 'dirtRich'] },
    sand: { texture: 'sand', scale: 1.8, materials: ['sand', 'sandDk'] },
    stone: { texture: 'cottage-stone', scale: 2.6, materials: ['stone', 'stoneDk'] },
  };
  const SURFACE_LINKED_MODEL_MATERIALS = {
    stone: ['rock', 'rockDk', 'rockHi', 'castleStone', 'castleStoneD', 'towerStone', 'towerStoneD', 'chimney'],
  };
  const SURFACE_LINKED_MODEL_SCALES = {
    stone: {
      rock: 4.0,
      rockDk: 4.0,
      rockHi: 4.0,
      castleStone: 11.0,
      castleStoneD: 11.0,
      towerStone: 10.0,
      towerStoneD: 10.0,
      chimney: 10.0,
    },
  };

  function surfaceDefaultTextureKey(surface) {
    const def = SURFACE_TEXTURE_DEFAULTS[surface];
    if (!def) return 'default';
    if (surface === 'grass' && !renderTexturedGrass) return def.fallbackTexture || 'checkered';
    return def.texture;
  }

  function applySurfaceTextureToMaterial(name, textureKey, scale, updateBaseMaps = false) {
    const mat = M[name];
    const tex = materialTextureForKey(textureKey);
    if (!mat || !tex) return;
    applyTerrainWorldUVs(name, mat, tex, scale);
    if (updateBaseMaps) {
      if (terrainMaterialBaseMaps.has(name)) terrainMaterialBaseMaps.set(name, mat.map || null);
      if (terrainMaterialBaseScales.has(name)) terrainMaterialBaseScales.set(name, scale);
      if (partMaterialBaseMaps.has(name)) partMaterialBaseMaps.set(name, mat.map || null);
      if (partMaterialBaseScales.has(name)) partMaterialBaseScales.set(name, scale);
    }
  }

  function applySurfaceTextureDefaults() {
    for (const [surface, def] of Object.entries(SURFACE_TEXTURE_DEFAULTS)) {
      const textureKey = surfaceDefaultTextureKey(surface);
      for (const name of def.materials) applySurfaceTextureToMaterial(name, textureKey, def.scale, true);
    }
  }

  function terrainSurfaceTextureKey(surface) {
    const adjustment = renderTerrainMaterialAdjustments && renderTerrainMaterialAdjustments[surface];
    const texture = normalizeMaterialTextureKey(adjustment && adjustment.texture);
    return texture === 'default' ? surfaceDefaultTextureKey(surface) : texture;
  }

  function terrainSurfaceTextureScale(surface) {
    const def = SURFACE_TEXTURE_DEFAULTS[surface];
    const adjustment = renderTerrainMaterialAdjustments && renderTerrainMaterialAdjustments[surface];
    return (def ? def.scale : 1) * normalizeMaterialTextureScale(adjustment && adjustment.scale);
  }

  function linkedSurfaceMaterialTextureScale(surface, materialName) {
    const def = SURFACE_TEXTURE_DEFAULTS[surface];
    const adjustment = renderTerrainMaterialAdjustments && renderTerrainMaterialAdjustments[surface];
    const linkedScales = SURFACE_LINKED_MODEL_SCALES[surface] || {};
    const baseScale = linkedScales[materialName] || (def ? def.scale : 1);
    return baseScale * normalizeMaterialTextureScale(adjustment && adjustment.scale);
  }

  function applyLinkedSurfaceMaterialTextures() {
    if (!renderSurfaceLinkedMaterials) return;
    for (const [surface, names] of Object.entries(SURFACE_LINKED_MODEL_MATERIALS)) {
      const def = SURFACE_TEXTURE_DEFAULTS[surface];
      if (!def) continue;
      const textureKey = terrainSurfaceTextureKey(surface);
      for (const name of names) applySurfaceTextureToMaterial(name, textureKey, linkedSurfaceMaterialTextureScale(surface, name));
    }
    if (typeof customMaterialCache !== 'undefined') customMaterialCache.clear();
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  applySurfaceTextureDefaults();

  function loadTerrainMaterialAdjustments() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(RENDER_LS.terrainColors) || '{}'); } catch (_) { raw = {}; }
    const out = {};
    for (const key of TERRAIN_COLOR_KEYS) {
      const src = raw && raw[key];
      if (!src || typeof src !== 'object') continue;
      const tint = normalizeHexColor(src.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(src.tone) || 0));
      const texture = normalizeMaterialTextureKey(src.texture);
      const scale = normalizeMaterialTextureScale(src.scale);
      if (tint || Math.abs(tone) > 0.001 || texture !== 'default' || Math.abs(scale - 1) > 0.001) out[key] = { tint, tone, texture, scale };
    }
    return out;
  }

  function loadPartMaterialAdjustments() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(RENDER_LS.materialParts) || '{}'); } catch (_) { raw = {}; }
    const out = {};
    for (const key of Object.keys(PART_MATERIAL_GROUPS)) {
      const src = raw && raw[key];
      if (!src || typeof src !== 'object') continue;
      const tint = normalizeHexColor(src.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(src.tone) || 0));
      const texture = normalizeMaterialTextureKey(src.texture);
      const scale = normalizeMaterialTextureScale(src.scale);
      if (tint || Math.abs(tone) > 0.001 || texture !== 'default' || Math.abs(scale - 1) > 0.001) out[key] = { tint, tone, texture, scale };
    }
    return out;
  }

  let renderTerrainColorTarget = localStorage.getItem(RENDER_LS.terrainColorTarget) || 'grass';
  if (!TERRAIN_COLOR_KEYS.includes(renderTerrainColorTarget)) renderTerrainColorTarget = 'grass';
  let renderTerrainMaterialAdjustments = loadTerrainMaterialAdjustments();
  let renderMaterialTarget = localStorage.getItem(RENDER_LS.materialTarget) || 'walls';
  if (!PART_MATERIAL_GROUPS[renderMaterialTarget]) renderMaterialTarget = 'walls';
  let renderPartMaterialAdjustments = loadPartMaterialAdjustments();
  let renderMaterialWear = storedNumber(RENDER_LS.materialWear, 0, 0, 1);

  function captureTerrainMaterialBaseColors() {
    terrainMaterialBaseColors.clear();
    terrainMaterialBaseMaps.clear();
    terrainMaterialBaseScales.clear();
    for (const names of Object.values(TERRAIN_COLOR_MATERIALS)) {
      for (const name of names) {
        const mat = M[name];
        if (!mat) continue;
        if (mat.color) terrainMaterialBaseColors.set(name, mat.color.getHex());
        terrainMaterialBaseMaps.set(name, mat.map || null);
        terrainMaterialBaseScales.set(name, mat.userData && mat.userData.worldTextureScale ? mat.userData.worldTextureScale : 1);
      }
    }
  }

  function restoreTerrainMaterialBaseColors() {
    for (const [name, hex] of terrainMaterialBaseColors.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
    for (const [name, map] of terrainMaterialBaseMaps.entries()) {
      const mat = M[name];
      if (mat) {
        if (map) applyTerrainWorldUVs(name, mat, map, terrainMaterialBaseScales.get(name) || 1);
        else {
          mat.map = null;
          mat.needsUpdate = true;
        }
      }
    }
  }

  function terrainBaseColorForTarget(target) {
    const names = TERRAIN_COLOR_MATERIALS[target] || TERRAIN_COLOR_MATERIALS.grass;
    const matName = names && names[0];
    const mat = matName && M[matName];
    const baseHex = matName && terrainMaterialBaseColors.has(matName)
      ? terrainMaterialBaseColors.get(matName)
      : (mat && mat.color ? mat.color.getHex() : 0xffffff);
    return '#' + (baseHex & 0xffffff).toString(16).padStart(6, '0');
  }

  function applyToneToColor(color, tone) {
    const t = Math.max(-0.5, Math.min(0.5, tone || 0));
    if (t > 0) color.lerp(new THREE.Color(0xffffff), t);
    else if (t < 0) color.lerp(new THREE.Color(0x000000), -t);
    return color;
  }

  function applyWearToMaterialColor(color, name, wear) {
    const w = Math.max(0, Math.min(1, wear || 0));
    if (w <= 0.001 || !color) return color;
    const key = String(name || '').toLowerCase();
    let grime = new THREE.Color(0x5f5138);
    let amount = 0.10 + w * 0.16;
    let darken = -8 * w;
    if (/grass|leaf|leaves|foliage|crop|moss|pumpkin|carrot|sunflower|wheat|corn/.test(key)) {
      grime = new THREE.Color(0x71843b);
      amount = 0.07 + w * 0.13;
      darken = -5 * w;
    } else if (/water|glass|window/.test(key)) {
      grime = new THREE.Color(0x8fa0a1);
      amount = 0.04 + w * 0.08;
      darken = -3 * w;
    } else if (/roof|stone|rock|wall|trim|step|chimney|metal|steel|wire/.test(key)) {
      grime = new THREE.Color(0x6d6759);
      amount = 0.08 + w * 0.15;
      darken = -7 * w;
    } else if (/wood|door|fence|trunk|bridge|plank/.test(key)) {
      grime = new THREE.Color(0x4f3a24);
      amount = 0.09 + w * 0.16;
      darken = -9 * w;
    }
    color.lerp(grime, amount);
    return applyToneToColor(color, darken / 100);
  }

  function applyMaterialWearToMaterial(name, mat) {
    if (!mat || !mat.color || renderMaterialWear <= 0.001) return;
    applyWearToMaterialColor(mat.color, name, renderMaterialWear);
  }

  function applyTerrainMaterialAdjustments() {
    if (!terrainMaterialBaseColors.size) captureTerrainMaterialBaseColors();
    restoreTerrainMaterialBaseColors();
    for (const [terrain, adjustment] of Object.entries(renderTerrainMaterialAdjustments || {})) {
      const names = TERRAIN_COLOR_MATERIALS[terrain];
      if (!names) continue;
      const tint = normalizeHexColor(adjustment && adjustment.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(adjustment && adjustment.tone) || 0));
      const texture = normalizeMaterialTextureKey(adjustment && adjustment.texture);
      const scale = normalizeMaterialTextureScale(adjustment && adjustment.scale);
      for (const name of names) {
        const mat = M[name];
        if (!mat || !mat.color) continue;
        const c = new THREE.Color(mat.color.getHex());
        if (tint) c.lerp(new THREE.Color(tint), 0.55);
        applyToneToColor(c, tone);
        mat.color.copy(c);
        const baseScale = terrainMaterialBaseScales.get(name) || (mat.userData && mat.userData.worldTextureScale) || 1;
        const nextMap = texture !== 'default' ? materialTextureForKey(texture) : mat.map;
        if (nextMap && (texture !== 'default' || Math.abs(scale - 1) > 0.001)) {
          applyWorldUVs(mat, nextMap, baseScale * scale);
        }
      }
    }
    for (const names of Object.values(TERRAIN_COLOR_MATERIALS)) {
      for (const name of names) applyMaterialWearToMaterial(name, M[name]);
    }
    if (typeof customMaterialCache !== 'undefined') customMaterialCache.clear();
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  function capturePartMaterialBaseState() {
    partMaterialBaseColors.clear();
    partMaterialBaseMaps.clear();
    partMaterialBaseScales.clear();
    for (const group of Object.values(PART_MATERIAL_GROUPS)) {
      for (const name of group.materials) {
        const mat = M[name];
        if (!mat) continue;
        if (mat.color) partMaterialBaseColors.set(name, mat.color.getHex());
        partMaterialBaseMaps.set(name, mat.map || null);
        partMaterialBaseScales.set(name, mat.userData && mat.userData.worldTextureScale ? mat.userData.worldTextureScale : 1);
      }
    }
  }

  function restorePartMaterialBaseState() {
    for (const [name, hex] of partMaterialBaseColors.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
    for (const [name, map] of partMaterialBaseMaps.entries()) {
      const mat = M[name];
      if (mat) {
        if (map) applyWorldUVs(mat, map, partMaterialBaseScales.get(name) || 1);
        else {
          mat.map = null;
          mat.needsUpdate = true;
        }
      }
    }
  }

  function partBaseColorForTarget(target) {
    const group = PART_MATERIAL_GROUPS[target] || PART_MATERIAL_GROUPS.walls;
    const matName = group.materials[0];
    const mat = M[matName];
    const baseHex = partMaterialBaseColors.has(matName)
      ? partMaterialBaseColors.get(matName)
      : (mat && mat.color ? mat.color.getHex() : 0xffffff);
    return '#' + (baseHex & 0xffffff).toString(16).padStart(6, '0');
  }

  function applyPartMaterialAdjustments() {
    if (!partMaterialBaseColors.size) capturePartMaterialBaseState();
    restorePartMaterialBaseState();
    for (const [groupKey, adjustment] of Object.entries(renderPartMaterialAdjustments || {})) {
      const group = PART_MATERIAL_GROUPS[groupKey];
      if (!group) continue;
      const tint = normalizeHexColor(adjustment && adjustment.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(adjustment && adjustment.tone) || 0));
      const texture = normalizeMaterialTextureKey(adjustment && adjustment.texture);
      const scale = normalizeMaterialTextureScale(adjustment && adjustment.scale);
      for (const name of group.materials) {
        const mat = M[name];
        if (!mat) continue;
        if (mat.color) {
          const c = new THREE.Color(mat.color.getHex());
          if (tint) c.lerp(new THREE.Color(tint), 0.55);
          applyToneToColor(c, tone);
          mat.color.copy(c);
        }
        const baseScale = partMaterialBaseScales.get(name) || (mat.userData && mat.userData.worldTextureScale) || 1;
        const nextMap = texture !== 'default' ? materialTextureForKey(texture) : mat.map;
        if (nextMap && (texture !== 'default' || Math.abs(scale - 1) > 0.001)) {
          applyWorldUVs(mat, nextMap, baseScale * scale);
        }
      }
    }
    for (const group of Object.values(PART_MATERIAL_GROUPS)) {
      for (const name of group.materials) applyMaterialWearToMaterial(name, M[name]);
    }
    if (typeof customMaterialCache !== 'undefined') customMaterialCache.clear();
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  function commitTerrainMaterialAdjustments() {
    applyTerrainMaterialAdjustments();
    applyPartMaterialAdjustments();
    applyLinkedSurfaceMaterialTextures();
    recaptureWeatherMaterialBase();
    applyWeatherMaterialTint();
  }

  function commitPartMaterialAdjustments() {
    applyTerrainMaterialAdjustments();
    applyPartMaterialAdjustments();
    applyLinkedSurfaceMaterialTextures();
    recaptureWeatherMaterialBase();
    applyWeatherMaterialTint();
  }

  function customMaterial(base, hex) {
    const clean = normalizeHexColor(hex);
    if (!base || !base.clone || !clean) return base;
    const key = (base.uuid || base.id || 'mat') + ':' + clean + ':' + renderMaterialWear.toFixed(2);
    if (!customMaterialCache.has(key)) {
      const mat = base.clone();
      if (base.onBeforeCompile) mat.onBeforeCompile = base.onBeforeCompile;
      if (mat.color) {
        mat.color.set(clean);
        applyWearToMaterialColor(mat.color, 'custom', renderMaterialWear);
      }
      customMaterialCache.set(key, mat);
    }
    return customMaterialCache.get(key);
  }
  function customTextureMaterial(base, textureKey, textureScale) {
    const cleanKey = normalizeMaterialTextureKey(textureKey);
    const tex = materialTextureForKey(cleanKey);
    if (!base || !base.clone || !tex || cleanKey === 'default') return base;
    const scale = normalizeMaterialTextureScale(textureScale || 1);
    const baseScale = base.userData && base.userData.worldTextureScale
      ? base.userData.worldTextureScale
      : proceduralTextureScaleForKind(cleanKey);
    const key = (base.uuid || base.id || 'mat') + ':tex:' + cleanKey + ':' + baseScale.toFixed(3) + ':' + scale.toFixed(3);
    if (!customMaterialCache.has(key)) {
      const mat = base.clone();
      if (mat.color) applyWearToMaterialColor(mat.color, 'custom', renderMaterialWear);
      applyWorldUVs(mat, tex, baseScale * scale);
      customMaterialCache.set(key, mat);
    }
    return customMaterialCache.get(key);
  }
  function normalizeAppearance(value) {
    if (!value || typeof value !== 'object') return null;
    const bodyColor = normalizeHexColor(value.bodyColor || value.body || value.wallColor || value.walls);
    const topColor = normalizeHexColor(value.topColor || value.top || value.roofColor || value.roof);
    const rawVoxelBuildId = value.voxelBuildId || value.voxelBuild || value.stampId || value.stamp;
    const voxelBuildId = (typeof rawVoxelBuildId === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(rawVoxelBuildId))
      ? rawVoxelBuildId
      : null;
    const rawModelStampId = value.modelStampId || value.modelStamp || value.modelAssetId || value.assetId;
    const modelStampId = (typeof rawModelStampId === 'string' && /^[a-z0-9][a-z0-9_-]{0,95}$/i.test(rawModelStampId))
      ? rawModelStampId
      : null;
    const rawScale = Array.isArray(value.objectScale) || Array.isArray(value.scale)
      ? null
      : (value.objectScale !== undefined ? value.objectScale : value.scale);
    const objectScaleNumber = rawScale === null ? NaN : Number(rawScale);
    const objectScale = Number.isFinite(objectScaleNumber)
      ? Math.max(0.2, Math.min(4, objectScaleNumber))
      : null;
    const axisScale = raw => {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0.15, Math.min(5, n)) : null;
    };
    const scaleX = axisScale(value.scaleX !== undefined ? value.scaleX : value.objectScaleX);
    const scaleY = axisScale(value.scaleY !== undefined ? value.scaleY : value.objectScaleY);
    const scaleZ = axisScale(value.scaleZ !== undefined ? value.scaleZ : value.objectScaleZ);
    const materialTexture = normalizeMaterialTextureKey(value.materialTexture || value.textureKey || value.texture);
    const materialTextureScale = normalizeMaterialTextureScale(value.materialTextureScale || value.textureScale || 1);
    const bodyTexture = normalizeMaterialTextureKey(value.bodyTexture || value.bodyMaterial || value.wallTexture);
    const bodyTextureScale = normalizeMaterialTextureScale(value.bodyTextureScale || value.bodyMaterialScale || 1);
    const topTexture = normalizeMaterialTextureKey(value.topTexture || value.topMaterial || value.roofTexture);
    const topTextureScale = normalizeMaterialTextureScale(value.topTextureScale || value.topMaterialScale || 1);
    const rawObjectStyle = String(value.objectStyle || value.style || '').toLowerCase();
    const objectStyle = rawObjectStyle === 'normal' || rawObjectStyle === 'voxel'
      ? rawObjectStyle
      : null;
    const rawFenceStyle = String(value.fenceStyle || value.fence || '').toLowerCase();
    const fenceStyle = rawFenceStyle === 'garden' ? 'garden' : null;
    const out = {};
    if (bodyColor) out.bodyColor = bodyColor;
    if (topColor) out.topColor = topColor;
    if (voxelBuildId) out.voxelBuildId = voxelBuildId;
    if (modelStampId) out.modelStampId = modelStampId;
    if (objectScale !== null && Math.abs(objectScale - 1) > 0.001) out.objectScale = +objectScale.toFixed(3);
    if (scaleX !== null && Math.abs(scaleX - 1) > 0.001) out.scaleX = +scaleX.toFixed(3);
    if (scaleY !== null && Math.abs(scaleY - 1) > 0.001) out.scaleY = +scaleY.toFixed(3);
    if (scaleZ !== null && Math.abs(scaleZ - 1) > 0.001) out.scaleZ = +scaleZ.toFixed(3);
    if (materialTexture !== 'default') {
      out.materialTexture = materialTexture;
      if (Math.abs(materialTextureScale - 1) > 0.001) out.materialTextureScale = +materialTextureScale.toFixed(3);
    }
    if (bodyTexture !== 'default') {
      out.bodyTexture = bodyTexture;
      if (Math.abs(bodyTextureScale - 1) > 0.001) out.bodyTextureScale = +bodyTextureScale.toFixed(3);
    }
    if (topTexture !== 'default') {
      out.topTexture = topTexture;
      if (Math.abs(topTextureScale - 1) > 0.001) out.topTextureScale = +topTextureScale.toFixed(3);
    }
    if (objectStyle) out.objectStyle = objectStyle;
    if (fenceStyle) out.fenceStyle = fenceStyle;
    return Object.keys(out).length ? out : null;
  }
  function sameAppearance(a, b) {
    const aa = normalizeAppearance(a);
    const bb = normalizeAppearance(b);
    return JSON.stringify(aa || null) === JSON.stringify(bb || null);
  }
  function towerPaletteWithAppearance(basePalette, appearance) {
    const a = normalizeAppearance(appearance);
    const p = Object.assign({}, basePalette || {});
    if (a && a.bodyColor) {
      p.stone = customMaterial(p.stone || M.towerStone, a.bodyColor);
      p.stoneD = customMaterial(p.stoneD || M.towerStoneD, shadeHexColor(a.bodyColor, -48));
    }
    if (a && a.topColor) {
      p.roof = customMaterial(p.roof || M.towerRoof, a.topColor);
      p.roofD = customMaterial(p.roofD || M.towerRoofD, shadeHexColor(a.topColor, -52));
    }
    return p;
  }
  function applyAppearanceToObject(root, kind, appearance) {
    const a = normalizeAppearance(appearance);
    if (!root || !a) return root;
    const topBase = new Set([
      M.roofBlue, M.manorRoof, M.towerRoof, M.castleRoof, M.skyRoof,
      M.leaves, M.rockHi, M.cropLeaf, M.cornCob, M.cornLeaf, M.wheatHead,
      M.pumpkin, M.carrotBody, M.sunflowerPetal, M_PLANT.petalRed,
      M_PLANT.petalYellow, M_PLANT.petalPurple, M_PLANT.petalWhite,
      M_PLANT.bushBerry, M_ANIMAL.cowSpot, M_ANIMAL.cowMuzzle,
      M_ANIMAL.sheepFace, M.grass, M.grassHi,
    ]);
    const topDark = new Set([
      M.roofBlueD, M.manorRoofD, M.towerRoofD, M.castleRoofD, M.leavesDk,
      M.pumpkinDk, M.sunflowerCenter, M_ANIMAL.hoof, M.grassEdge,
    ]);
    const bodyBase = new Set([
      M.wallCream, M.manorBrick, M.towerStone, M.castleStone, M.skyBody,
      M.trunk, M.bridgeWood, M.fence, M.rock, M.cropStem, M.cornStalk,
      M.wheatStalk, M.pumpkinStem, M.sunflowerStalk, M_ANIMAL.cowWhite,
      M_ANIMAL.sheepWool, M.dirtRich, M.islandUnder,
    ]);
    const bodyDark = new Set([
      M.wallTrim, M.manorBrickD, M.towerStoneD, M.castleStoneD,
      M.bridgeWoodD, M.fenceWire, M.fenceSteel, M.rockDk, M.islandUnderD,
    ]);
    function remap(mat) {
      if (!mat) return mat;
      let next = mat;
      if (a.topColor && topBase.has(mat)) next = customMaterial(mat, a.topColor);
      else if (a.topColor && topDark.has(mat)) next = customMaterial(mat, shadeHexColor(a.topColor, -48));
      else if (a.bodyColor && bodyBase.has(mat)) next = customMaterial(mat, a.bodyColor);
      else if (a.bodyColor && bodyDark.has(mat)) next = customMaterial(mat, shadeHexColor(a.bodyColor, -42));
      if (a.topTexture && (topBase.has(mat) || topDark.has(mat))) next = customTextureMaterial(next, a.topTexture, a.topTextureScale || 1);
      else if (a.bodyTexture && (bodyBase.has(mat) || bodyDark.has(mat))) next = customTextureMaterial(next, a.bodyTexture, a.bodyTextureScale || 1);
      if (a.materialTexture) next = customTextureMaterial(next, a.materialTexture, a.materialTextureScale || 1);
      return next;
    }
    root.traverse(node => {
      if (!node.isMesh) return;
      node.material = Array.isArray(node.material) ? node.material.map(remap) : remap(node.material);
    });
    return root;
  }

  const SEASON_FOLIAGE = {
    spring: {
      grass: 0xa7cf58, grass2: 0x7fb03d, leaves: 0x86d139, leavesDk: 0x5fab26,
      cropLeaf: 0x96d943, cropStem: 0x5e9c2e, cornStalk: 0x6fa848, cornLeaf: 0xa8c948,
      pumpkinStem: 0x4d6a18, sunflowerStalk: 0x4d8a2a, rockMoss: 0x6f8a3a,
    },
    summer: {
      grass: 0x9ec74b, grass2: 0x78a83b, leaves: 0x86d139, leavesDk: 0x5fab26,
      cropLeaf: 0x96d943, cropStem: 0x5e9c2e, cornStalk: 0x6fa848, cornLeaf: 0xa8c948,
      pumpkinStem: 0x4d6a18, sunflowerStalk: 0x4d8a2a, rockMoss: 0x6f8a3a,
    },
    autumn: {
      grass: 0xb0ad5a, grass2: 0x8c9240, leaves: 0xc07a2f, leavesDk: 0x8f5b24,
      cropLeaf: 0xb99638, cropStem: 0x8a7d2d, cornStalk: 0xa27c32, cornLeaf: 0xb99738,
      pumpkinStem: 0x6f5a20, sunflowerStalk: 0x8a6b24, rockMoss: 0x7b7336,
    },
    winter: {
      grass: 0x9fb27f, grass2: 0x7f9668, leaves: 0x7ba66d, leavesDk: 0x5f874f,
      cropLeaf: 0x8eb278, cropStem: 0x6f8f5a, cornStalk: 0x8e9154, cornLeaf: 0xa6a96a,
      pumpkinStem: 0x65743e, sunflowerStalk: 0x6f864e, rockMoss: 0x687c4e,
    },
  };
  const weatherMaterialBase = new Map();
  const WEATHER_MATERIAL_SKIP = new Set(['hover', 'hoverErase', 'waterFoam', 'cloud', 'cloudShade']);
  function rememberWeatherMaterialBase() {
    for (const [name, mat] of Object.entries(M)) {
      if (!mat || !mat.color || WEATHER_MATERIAL_SKIP.has(name)) continue;
      if (!weatherMaterialBase.has(name)) weatherMaterialBase.set(name, mat.color.getHex());
    }
  }
  function resetWeatherMaterialTint() {
    rememberWeatherMaterialBase();
    for (const [name, hex] of weatherMaterialBase.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
  }
  function recaptureWeatherMaterialBase() {
    weatherMaterialBase.clear();
    rememberWeatherMaterialBase();
  }
  function applyWeatherMaterialTint() {
    resetWeatherMaterialTint();
    const mode = typeof tileWeatherMode === 'string' ? tileWeatherMode : 'clear';
    if (mode !== 'rain' && mode !== 'snow') {
      if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
      return;
    }
    const heavy = (typeof weatherEffectFactor === 'function') ? weatherEffectFactor() : 0;
    const tint = new THREE.Color(mode === 'snow' ? 0xeaf3ff : 0x5f6f7f);
    const amount = mode === 'snow' ? 0.06 + heavy * 0.18 : 0.08 + heavy * 0.20;
    for (const [name] of weatherMaterialBase.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.lerp(tint, amount);
    }
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  function applySeasonFoliage(seasonName) {
    resetWeatherMaterialTint();
    const palette = SEASON_FOLIAGE[seasonName === 'fall' ? 'autumn' : seasonName] || SEASON_FOLIAGE.summer;
    for (const [name, hex] of Object.entries(palette)) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
    captureTerrainMaterialBaseColors();
    applyTerrainMaterialAdjustments();
    capturePartMaterialBaseState();
    applyPartMaterialAdjustments();
    applyLinkedSurfaceMaterialTextures();
    recaptureWeatherMaterialBase();
    applyWeatherMaterialTint();
  }

  function castReceive(obj) {
    obj.traverse(c => {
      if (c.isMesh) {
        if (c.userData && c.userData.noShadow) {
          c.castShadow = false;
          c.receiveShadow = false;
        } else {
          c.castShadow = true;
          c.receiveShadow = c.material !== M.wallCream;
        }
        c.frustumCulled = true;
      }
    });
    return obj;
  }

  function groundReceiveOnly(obj) {
    obj.traverse(c => {
      if (c.isMesh) {
        c.castShadow = false;
        c.receiveShadow = true;
        c.frustumCulled = true;
      }
    });
    return obj;
  }

  function cellRand(x, z, salt) {
    const n = Math.sin((x + 1) * 127.1 + (z + 1) * 311.7 + (salt || 0) * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function edgeBand(dir, width, depth, y, mat) {
    const alongX = dir === 'n' || dir === 's';
    const geo = alongX
      ? getBoxGeometry(width, depth, 0.05)
      : getBoxGeometry(0.05, depth, width);
    const m = new THREE.Mesh(geo, mat);
    if (dir === 'n') m.position.set(0, y, -0.465);
    if (dir === 's') m.position.set(0, y,  0.465);
    if (dir === 'w') m.position.set(-0.465, y, 0);
    if (dir === 'e') m.position.set( 0.465, y, 0);
    return m;
  }
