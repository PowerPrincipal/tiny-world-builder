#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tiny-world-builder.html'), 'utf8');
const devServer = fs.readFileSync(path.join(root, 'tools/dev-server.js'), 'utf8');

function fail(message) {
  console.error('smoke failed:', message);
  process.exit(1);
}
function requireIncludes(text, label) {
  if (!html.includes(text)) fail('missing ' + label + ': ' + text);
}
function requireNotIncludes(text, label) {
  if (html.includes(text)) fail('unexpected ' + label + ': ' + text);
}

requireIncludes('function setCell(', 'state mutation entry point');
requireIncludes('function renderCellObject(', 'object renderer');
requireIncludes('function applyTool(', 'tool application');
requireIncludes('function doClear(', 'clear action');
requireIncludes('function togglePerspective(', 'camera toggle');
requireIncludes('function runSeededVehicleDemo(', 'shareable vehicle seed demo');
requireIncludes('VEHICLE_DEMO_DEFAULT_SEED', 'vehicle demo default seed');
requireIncludes('vehicle-demo-badge', 'visible vehicle demo badge');
requireIncludes('M_VEHICLE.beacon', 'visible vehicle beacon marker');
requireIncludes('VEHICLE_COLLISION_RADIUS', 'vehicle collision radius');
requireIncludes('function getVehicleCollisionRisk(', 'vehicle collision risk check');
requireIncludes('function rerouteVehicleAroundTraffic(', 'traffic-aware vehicle reroute');
requireIncludes('function isVehicleDrivableCell(', 'object-aware vehicle drivable cell check');
requireIncludes('function refreshVehiclesForWorldObstacleChange(', 'vehicle reroute on world obstacle edits');
requireIncludes('__getVehicleRuntimeSnapshot', 'vehicle runtime debug snapshot');
requireIncludes('function makeCloud(', 'voxel cloud factory');
requireIncludes('function openTinyModal(', 'modal focus helper');
requireIncludes('customDepthMaterial', 'cloud shadow depth material');
requireIncludes('vendor/three/three.r128.min.js', 'self-hosted Three.js');
requireIncludes('vendor/three/GLTFLoader.r128.js', 'self-hosted GLTFLoader');

const netlifyToml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
if (!netlifyToml.includes('publish = "dist"') || !netlifyToml.includes('command = "./publish.sh"')) {
  fail('netlify.toml does not point Netlify at publish.sh/dist');
}

requireNotIncludes('cdnjs.cloudflare.com/ajax/libs/three.js', 'Three.js CDN');
requireNotIncludes('cdn.jsdelivr.net/npm/three', 'GLTFLoader CDN');
requireNotIncludes('postTarget', 'post-processing render target');
requireNotIncludes('postMaterial', 'post-processing shader material');
requireNotIncludes('postProcessingEnabled', 'post-processing mode flag');
requireNotIncludes('render-smoothing', 'dead post smoothing control');
requireNotIncludes('<script type="module" src="cluso/cluso-embed.js"></script>', 'production-visible Cluso script tag');
requireNotIncludes('<link rel="stylesheet" href="cluso/cluso-embed.css">', 'production-visible Cluso stylesheet tag');

for (const asset of [
  'vendor/three/three.r128.min.js',
  'vendor/three/GLTFLoader.r128.js',
]) {
  if (!fs.existsSync(path.join(root, asset))) fail('missing local asset ' + asset);
}

if (!devServer.includes("const vehicleDemoPath = '/tiny-world-builder?demo=vehicles&seed=tide-ridge-428'")) {
  fail('dev server root does not define the vehicle demo redirect path');
}
if (!devServer.includes("if (pathname === '/') return { redirect: vehicleDemoPath };")) {
  fail('dev server bare root does not redirect to the vehicle demo');
}
if (!devServer.includes("if (pathname === '/tiny-world-builder' && !parsed.search) return { redirect: vehicleDemoPath };")) {
  fail('dev server /tiny-world-builder without query does not redirect to the vehicle demo');
}

console.log('smoke ok');
