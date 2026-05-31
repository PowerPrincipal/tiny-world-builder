// @ts-check
/// <reference types="partykit/server" />

const MESSAGE_LIMIT = 48 * 1024;
const PRESENCE_KEYS = new Set(['id', 'name', 'color', 'cursor', 'selection', 'tool', 'ts']);
const OP_KEYS = new Set(['id', 'kind', 'x', 'z', 'cell', 'ts']);

function safeJson(message) {
  if (typeof message !== 'string' || message.length > MESSAGE_LIMIT) return null;
  try {
    return JSON.parse(message);
  } catch (_) {
    return null;
  }
}

function cleanText(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanCursor(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    x: cleanNumber(value.x),
    z: cleanNumber(value.z),
    y: cleanNumber(value.y),
  };
}

function cleanSelection(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 64).map(cell => {
    if (!cell || typeof cell !== 'object') return null;
    return {
      x: Math.round(cleanNumber(cell.x)),
      z: Math.round(cleanNumber(cell.z)),
    };
  }).filter(Boolean);
}

function cleanPresence(input, fallbackId) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of PRESENCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  }
  out.id = cleanText(out.id || fallbackId, 64) || fallbackId;
  out.name = cleanText(out.name || 'Builder', 48) || 'Builder';
  out.color = /^#[0-9a-f]{6}$/i.test(String(out.color || '')) ? String(out.color) : '#3c82f7';
  out.cursor = cleanCursor(out.cursor);
  out.selection = cleanSelection(out.selection);
  out.tool = cleanText(out.tool, 48);
  out.ts = Date.now();
  return out;
}

function cleanCell(cell) {
  if (!cell || typeof cell !== 'object') return null;
  const copy = JSON.parse(JSON.stringify(cell));
  if (!copy.terrain) copy.terrain = 'grass';
  if (!Array.isArray(copy.extras)) copy.extras = [];
  return copy;
}

function cleanCellSet(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of OP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  }
  out.id = cleanText(out.id, 96) || String(Date.now());
  out.kind = 'cell.set';
  out.x = Math.round(cleanNumber(out.x));
  out.z = Math.round(cleanNumber(out.z));
  out.cell = cleanCell(out.cell);
  out.ts = Date.now();
  if (!out.cell) return null;
  return out;
}

export default class TinyWorldParty {
  constructor(room) {
    this.room = room;
    this.presence = new Map();
  }

  onConnect(conn) {
    conn.send(JSON.stringify({
      type: 'welcome',
      room: this.room.id,
      id: conn.id,
      peers: Array.from(this.presence.values()),
    }));
  }

  onMessage(message, sender) {
    const data = safeJson(message);
    if (!data || typeof data.type !== 'string') return;

    if (data.type === 'presence') {
      const presence = cleanPresence(data.presence, sender.id);
      if (!presence) return;
      presence.id = sender.id;
      this.presence.set(sender.id, presence);
      this.room.broadcast(JSON.stringify({ type: 'presence', presence }), [sender.id]);
      return;
    }

    if (data.type === 'cell.set') {
      const op = cleanCellSet(data.op);
      if (!op) return;
      op.userId = sender.id;
      this.room.broadcast(JSON.stringify({ type: 'cell.set', op }), [sender.id]);
    }
  }

  onClose(conn) {
    this.presence.delete(conn.id);
    this.room.broadcast(JSON.stringify({ type: 'leave', id: conn.id }));
  }

  onError(conn) {
    this.onClose(conn);
  }
}
