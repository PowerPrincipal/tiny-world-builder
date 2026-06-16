// Unit tests for the PartyKit emote relay (party/index.js).
// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import TinyWorldParty, { EMOTE_CMDS } from '../party/index.js';

function makeRoom() {
  const conns = new Map();
  return {
    id: 'room-test',
    conns,
    getConnection: (id) => conns.get(id) || null,
    broadcast: () => {},
    addConn(id) {
      const c = { id, received: [], closed: false,
        send(raw) { c.received.push(JSON.parse(raw)); }, close() { c.closed = true; } };
      conns.set(id, c); return c;
    },
  };
}
function setup() {
  const room = makeRoom();
  const party = new TinyWorldParty(room);
  const connect = (id) => { const c = room.addConn(id); party.onConnect(c); return c; };
  const send = (sender, obj) => party.onMessage(JSON.stringify(obj), sender);
  return { room, party, connect, send };
}

test('emote command set has the six v1 commands', () => {
  assert.deepEqual([...EMOTE_CMDS].sort(),
    ['attack', 'crouch', 'dance', 'jump', 'sit', 'wave']);
});

test('admitted peer emote broadcasts to all admitted, stamped from sender', () => {
  const { party, connect, send } = setup();
  const a = connect('a'); const b = connect('b');
  party.admitted.set('a', { role: 'host', island: null });
  party.admitted.set('b', { role: 'play', island: null });
  party.presence.set('a', { id: 'a', name: 'Alice' });
  a.received.length = 0; b.received.length = 0;
  send({ id: 'a' }, { type: 'emote', cmd: 'wave', id: 'spoofed', name: 'Mallory' });
  const msgA = a.received.find(m => m.type === 'emote');
  const msgB = b.received.find(m => m.type === 'emote');
  assert.ok(msgA && msgB, 'both admitted peers receive the emote');
  assert.equal(msgB.id, 'a', 'id is stamped from sender, not the client value');
  assert.equal(msgB.name, 'Alice', 'name comes from the trusted presence record');
  assert.equal(msgB.cmd, 'wave');
});

test('unknown emote command is rejected (no broadcast)', () => {
  const { party, connect, send } = setup();
  const a = connect('a');
  party.admitted.set('a', { role: 'host', island: null });
  a.received.length = 0;
  send({ id: 'a' }, { type: 'emote', cmd: 'explode' });
  assert.equal(a.received.find(m => m.type === 'emote'), undefined);
});

test('non-admitted peer emote is ignored', () => {
  const { party, connect, send } = setup();
  connect('host');                        // First peer becomes host (admitted)
  const guest = connect('guest');         // Second peer is NOT admitted (in lobby)
  guest.received.length = 0;
  send({ id: 'guest' }, { type: 'emote', cmd: 'wave' });
  assert.equal(guest.received.find(m => m.type === 'emote'), undefined);
});
