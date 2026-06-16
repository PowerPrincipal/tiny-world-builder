// Shared community moderation primitives + Hermes webhook bridge.
//
// These helpers are used by both the interactive `/api/community` endpoint and
// the server-to-server `/api/community/webhook` endpoint (driven by the Hermes
// agent) so moderation behaves identically no matter who triggers it.
//
// Every function takes an explicit `sql` (from getSql()) and uses parameterized
// queries. Profile resolution is intentionally flexible so an agent can target a
// member by profile id, username, display name, or wallet public key.

import { createHmac, timingSafeEqual } from 'node:crypto';

function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

// -------- duration / expiry --------
// Mirror of community.mjs banExpiry: hours -> absolute Date, or null = permanent.
export function banExpiry(nowMs, durationHours) {
  const h = Number(durationHours);
  if (!Number.isFinite(h) || h <= 0) return null;
  return new Date(Number(nowMs) + h * 3600 * 1000);
}

// -------- webhook auth --------
export function webhookSecret() {
  return envValue('TINYWORLD_COMMUNITY_WEBHOOK_SECRET');
}

// Constant-time compare of two short strings.
export function safeEqual(a, b) {
  const left = Buffer.from(String(a == null ? '' : a), 'utf8');
  const right = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (left.length !== right.length) return false;
  try { return timingSafeEqual(left, right); } catch (_) { return false; }
}

// Compute the hex HMAC-SHA256 of `rawBody` with the shared secret.
export function signBody(rawBody, secret) {
  return createHmac('sha256', String(secret || '')).update(String(rawBody || ''), 'utf8').digest('hex');
}

// Verify an inbound webhook request. Accepts either:
//   - HMAC: header `x-tinyworld-signature: sha256=<hexdigest of the raw body>`
//   - Shared bearer: header `x-webhook-secret: <secret>` (simpler for quick
//     setups; HMAC is preferred because it also authenticates the body).
// Returns { ok: true } or { ok: false, error, status }.
export function verifyWebhookAuth(headers, rawBody) {
  const secret = webhookSecret();
  if (!secret) return { ok: false, error: 'Webhook is not configured (set TINYWORLD_COMMUNITY_WEBHOOK_SECRET).', status: 503 };

  const sigHeader = String(headers.get('x-tinyworld-signature') || '').trim();
  if (sigHeader) {
    const provided = sigHeader.replace(/^sha256=/i, '').trim();
    const expected = signBody(rawBody, secret);
    return safeEqual(provided, expected)
      ? { ok: true, method: 'hmac' }
      : { ok: false, error: 'Invalid signature', status: 401 };
  }

  const bearer = String(headers.get('x-webhook-secret') || '').trim();
  if (bearer) {
    return safeEqual(bearer, secret) ? { ok: true, method: 'bearer' } : { ok: false, error: 'Invalid webhook secret', status: 401 };
  }

  return { ok: false, error: 'Missing webhook signature', status: 401 };
}

// -------- profile resolution --------
// Resolve a target member from a flexible selector object:
//   { profileId } | { username } | { displayName } | { wallet }  (any one)
// Returns the profile row or null.
export async function resolveProfile(sql, selector) {
  if (!selector || typeof selector !== 'object') return null;
  const id = Number(selector.profileId);
  if (Number.isInteger(id) && id > 0) {
    const rows = await sql`SELECT id, username, display_name, image FROM profiles WHERE id = ${id} LIMIT 1`;
    return rows[0] || null;
  }
  const username = String(selector.username || '').trim().toLowerCase();
  if (username) {
    const rows = await sql`SELECT id, username, display_name, image FROM profiles WHERE LOWER(username) = ${username} LIMIT 1`;
    if (rows.length) return rows[0];
  }
  const displayName = String(selector.displayName || '').trim().toLowerCase();
  if (displayName) {
    const rows = await sql`SELECT id, username, display_name, image FROM profiles WHERE LOWER(display_name) = ${displayName} ORDER BY id ASC LIMIT 1`;
    if (rows.length) return rows[0];
  }
  const wallet = String(selector.wallet || selector.publicKey || '').trim();
  if (wallet) {
    const rows = await sql`
      SELECT p.id, p.username, p.display_name, p.image
      FROM profiles p JOIN wallet_accounts wa ON wa.profile_id = p.id
      WHERE wa.public_key = ${wallet} LIMIT 1
    `;
    if (rows.length) return rows[0];
  }
  return null;
}

async function roomIdFromSelector(sql, selector) {
  if (selector == null) return null;
  // Accept a numeric id directly, or { roomId } / { roomSlug }.
  const direct = Number(selector);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const id = Number(selector.roomId);
  if (Number.isInteger(id) && id > 0) return id;
  const slug = String(selector.roomSlug || selector.slug || '').trim().toLowerCase();
  if (slug) {
    const rows = await sql`SELECT id FROM community_rooms WHERE LOWER(slug) = ${slug} LIMIT 1`;
    if (rows.length) return rows[0].id;
  }
  return null;
}

// -------- moderation actions --------
// Each returns a small result object describing what happened. They throw on DB
// errors; the caller maps those to an HTTP response.

export async function banMember(sql, { target, roomId = null, durationHours = 0, reason = '', actorProfileId = null }) {
  const profile = await resolveProfile(sql, target);
  if (!profile) return { ok: false, error: 'Member not found' };
  const room = await roomIdFromSelector(sql, roomId);
  const expires = banExpiry(Date.now(), durationHours);
  const rows = await sql`
    INSERT INTO community_bans (room_id, profile_id, banned_by, reason, expires_at)
    VALUES (${room}, ${profile.id}, ${actorProfileId}, ${String(reason || '').slice(0, 200)}, ${expires})
    RETURNING id, room_id, profile_id, reason, expires_at, created_at
  `;
  return { ok: true, action: 'ban', profileId: profile.id, username: profile.username, roomId: room, expiresAt: expires, ban: rows[0] };
}

export async function unbanMember(sql, { target, roomId = null }) {
  const profile = await resolveProfile(sql, target);
  if (!profile) return { ok: false, error: 'Member not found' };
  const room = await roomIdFromSelector(sql, roomId);
  await sql`
    DELETE FROM community_bans
    WHERE profile_id = ${profile.id} AND (room_id IS NOT DISTINCT FROM ${room})
  `;
  return { ok: true, action: 'unban', profileId: profile.id, username: profile.username, roomId: room };
}

// Agent-side block: hide `blocked` from `blocker`. When no blocker is given the
// super-owner (or any staff) profile id should be passed by the caller.
export async function blockMember(sql, { blocker, blocked }) {
  const a = await resolveProfile(sql, blocker);
  const b = await resolveProfile(sql, blocked);
  if (!a || !b) return { ok: false, error: 'Member not found' };
  if (a.id === b.id) return { ok: false, error: 'Cannot block self' };
  await sql`
    INSERT INTO community_blocks (blocker_profile_id, blocked_profile_id)
    VALUES (${a.id}, ${b.id})
    ON CONFLICT (blocker_profile_id, blocked_profile_id) DO NOTHING
  `;
  return { ok: true, action: 'block', blockerId: a.id, blockedId: b.id };
}

export async function deleteMessage(sql, { messageId }) {
  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid messageId' };
  const rows = await sql`DELETE FROM community_messages WHERE id = ${id} RETURNING id, author_profile_id, room_id, dm_key`;
  if (!rows.length) return { ok: false, error: 'Message not found' };
  return { ok: true, action: 'deleteMessage', messageId: id, deleted: rows[0] };
}

// Bulk-purge a member's recent messages (spam cleanup). `limit` caps how many.
export async function purgeMemberMessages(sql, { target, roomId = null, limit = 50 }) {
  const profile = await resolveProfile(sql, target);
  if (!profile) return { ok: false, error: 'Member not found' };
  const room = await roomIdFromSelector(sql, roomId);
  const cap = Math.max(1, Math.min(500, Number(limit) || 50));
  const rows = await sql`
    DELETE FROM community_messages
    WHERE id IN (
      SELECT id FROM community_messages
      WHERE author_profile_id = ${profile.id}
        AND (${room == null ? sql`TRUE` : sql`room_id = ${room}`})
      ORDER BY id DESC
      LIMIT ${cap}
    )
    RETURNING id
  `;
  return { ok: true, action: 'purgeMessages', profileId: profile.id, roomId: room, deletedCount: rows.length };
}

export async function deleteRoom(sql, { roomId }) {
  const room = await roomIdFromSelector(sql, roomId);
  if (!room) return { ok: false, error: 'Room not found' };
  const rows = await sql`DELETE FROM community_rooms WHERE id = ${room} RETURNING id, slug, name`;
  if (!rows.length) return { ok: false, error: 'Room not found' };
  return { ok: true, action: 'deleteRoom', room: rows[0] };
}

// -------- outbound: notify Hermes of community events --------
// Fire-and-forget POST to the configured Hermes webhook URL. Never throws — a
// down webhook must not break the user-facing request. Signs the body with the
// same secret so Hermes can verify authenticity.
export async function emitCommunityEvent(event, payload) {
  const url = envValue('HERMES_COMMUNITY_WEBHOOK_URL') || envValue('TINYWORLD_COMMUNITY_EVENT_URL');
  if (!url) return { ok: false, skipped: 'no-url' };
  const body = JSON.stringify({
    source: 'tinyworld-community',
    event,
    sentAt: new Date().toISOString(),
    data: payload || {},
  });
  const headers = { 'Content-Type': 'application/json' };
  const secret = webhookSecret();
  if (secret) headers['x-tinyworld-signature'] = 'sha256=' + signBody(body, secret);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'emit failed' };
  }
}
