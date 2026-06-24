import { timingSafeEqual } from 'node:crypto';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';
import { computeWeeklyPayoutPlan } from '../../packages/tinyworld-mmo-core/src/index.js';

export const config = { path: '/api/admin/gold-payout' };

// E2 — weekly holdings-based GOLD payout.
// Snapshots each linked wallet's $TINYWORLD holdings + island count, computes the
// weekly GOLD allowance, and writes ONE authoritative ALLOWANCE_RECALCULATED ledger
// event per (wallet, cycle_id). The partial unique index uq_gold_allowance_wallet_cycle
// makes the write idempotent (re-runs within a cycle are no-ops).
//
// ADMIN-ONLY + ECONOMY-GATE-FRIENDLY:
//   GET  -> DRY RUN: compute and return the plan, write NOTHING. Lets the owner
//           preview exactly what the weekly payout would credit before launch.
//   POST -> EXECUTE: idempotently upsert the allowance events.
// Both require the x-admin-secret header (timing-safe). At launch, wire a weekly
// trigger (Netlify scheduled function or external cron) to POST this endpoint.

const HOLDER_CAP = 5000;

function adminSecret() {
  return process.env.TINYWORLD_ADMIN_SECRET || '';
}

function isAdmin(request) {
  const secret = adminSecret();
  if (!secret) return false; // never run unguarded
  const provided = request.headers.get('x-admin-secret') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Atomic token units -> whole tokens (floored), BigInt throughout. Independent of
// any other module so this function does not collide with the E1 gold branch.
function wholeFromAtomic(atomicStr, decimals) {
  let a = 0n;
  const raw = String(atomicStr == null ? '0' : atomicStr).trim();
  if (/^[0-9]+$/.test(raw)) {
    try { a = BigInt(raw); } catch (_) { a = 0n; }
  }
  const d = Math.max(0, Math.min(36, Number(decimals) || 0));
  if (d === 0) return a.toString();
  return (a / (10n ** BigInt(d))).toString();
}

const isMissingSchema = (err) => isMissingRelations(err, ['profiles', 'wallet_accounts', 'gold_ledger_events', 'worlds']);

export default async function goldPayout(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'GET' && request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, origin);
  }
  if (!isAdmin(request)) return errorResponse('Forbidden', 403, origin);

  const execute = request.method === 'POST';

  try {
    const sql = getSql();

    // Aggregate holdings per profile that has at least one verified wallet. Only
    // numeric atomic balances are summed (junk rows are skipped, never crash the run).
    const rows = await sql`
      SELECT
        p.id AS profile_id,
        COALESCE((
          SELECT SUM((wa.token_balance_atomic)::numeric)
          FROM wallet_accounts wa
          WHERE wa.profile_id = p.id AND wa.verified_at IS NOT NULL
            AND wa.token_balance_atomic ~ '^[0-9]+$'
        ), 0)::text AS atomic_sum,
        COALESCE((
          SELECT MAX(wa.token_decimals)
          FROM wallet_accounts wa
          WHERE wa.profile_id = p.id AND wa.verified_at IS NOT NULL
        ), 0) AS decimals,
        COALESCE((
          SELECT COUNT(*) FROM worlds w
          WHERE w.owner_profile_id = p.id AND w.status = 'published'
        ), 0) AS island_count
      FROM profiles p
      WHERE EXISTS (
        SELECT 1 FROM wallet_accounts wa
        WHERE wa.profile_id = p.id AND wa.verified_at IS NOT NULL
      )
      ORDER BY p.id ASC
      LIMIT ${HOLDER_CAP + 1}
    `;

    const capped = (rows || []).length > HOLDER_CAP;
    const holders = (rows || []).slice(0, HOLDER_CAP).map((r) => ({
      wallet: 'profile:' + Number(r.profile_id),
      tinyworldHeld: wholeFromAtomic(r.atomic_sum, r.decimals),
      islandCount: Number(r.island_count) || 0,
    }));

    const plan = computeWeeklyPayoutPlan(holders, { now: new Date() });
    const totalGold = plan.events.reduce((sum, e) => sum + Number(e.amount), 0);

    if (!execute) {
      // DRY RUN — preview only, write nothing.
      return jsonResponse({
        mode: 'dry-run',
        cycleId: plan.cycleId,
        holders: holders.length,
        eventsToWrite: plan.events.length,
        skippedZeroAllowance: plan.skippedZero,
        totalGoldAllowance: totalGold,
        capped,
        sample: plan.events.slice(0, 10),
      }, origin);
    }

    // EXECUTE — idempotent upsert, one allowance row per (wallet, cycle_id).
    let written = 0;
    for (const e of plan.events) {
      const res = await sql`
        INSERT INTO gold_ledger_events (wallet, cycle_id, type, amount, reason, reference_id)
        VALUES (${e.wallet}, ${e.cycleId}, 'ALLOWANCE_RECALCULATED', ${e.amount}, ${e.reason}, NULL)
        ON CONFLICT (wallet, cycle_id) WHERE type = 'ALLOWANCE_RECALCULATED'
        DO NOTHING
        RETURNING id
      `;
      if (res && res.length) written += 1;
    }

    return jsonResponse({
      mode: 'execute',
      cycleId: plan.cycleId,
      holders: holders.length,
      eventsComputed: plan.events.length,
      written,
      alreadyPresent: plan.events.length - written,
      skippedZeroAllowance: plan.skippedZero,
      totalGoldAllowance: totalGold,
      capped,
    }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingSchema(err)) {
      return errorResponse('gold-payout-unavailable: schema or DB not ready', 503, origin);
    }
    return errorResponse('gold-payout-failed: ' + (err.message || err), 500, origin);
  }
}
