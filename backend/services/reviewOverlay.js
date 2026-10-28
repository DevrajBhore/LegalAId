/**
 * reviewOverlay.js — advocate review state that outlives the container.
 *
 * WHY THIS EXISTS. The review services write sign-offs into the knowledge-base
 * JSON files. On the deployment those writes do not survive: the service runs on
 * Render's free plan, render.yaml declares no persistent disk, and the filesystem
 * is rebuilt from the deployed image whenever the instance restarts or wakes from
 * sleep. The advocate's work was being reverted, silently.
 *
 * HOW IT WORKS. Decisions are written to MongoDB and held in a module-level Map.
 * Reads apply that Map over whatever the files say, database winning. The Map is
 * hydrated once at boot and kept current by every write, which matters because
 * the clause cache is built synchronously and cannot await a query.
 *
 * WHEN THERE IS NO DATABASE — a developer machine with no MONGODB_URI — every
 * function here is a no-op and the file behaviour is exactly what it was. This
 * must never throw into a generation path.
 *
 * FAILURE POLICY. Where durable review state is required (MONGODB_URI set, or
 * a production environment), a write that cannot reach the database is
 * REFUSED: it throws a 503 before memory or files change, so no process ever
 * serves a decision that will vanish on restart or differ between instances.
 * Memory is updated only after the database write succeeds. Reads still fall
 * back to file state, so documents keep generating; reviewOverlayStatus()
 * reports the degraded state and /ready turns it into a readiness failure.
 *
 * A withdrawal (reset) is stored as a payload of nulls, never as a deleted row:
 * deleting the row let a sign-off still present in the deployed files
 * reappear after the next restart.
 */

import ReviewSignoff from "../models/ReviewSignoff.js";
import { isProductionEnv } from "../auth/originPolicy.js";

export const OVERLAY_KIND = { CLAUSE: "clause", CONSTRAINT_SCOPE: "constraint_scope" };

/** kind -> Map(targetId -> payload) */
const overlay = new Map([
  [OVERLAY_KIND.CLAUSE, new Map()],
  [OVERLAY_KIND.CONSTRAINT_SCOPE, new Map()],
]);

let hydrated = false;
let available = false;
let lastHydratedAt = null;
let lastError = null;

/** Durable review state is expected: a database is configured, or this is production. */
export function reviewPersistenceRequired(env = process.env) {
  return Boolean(env.MONGODB_URI) || isProductionEnv(env);
}

function unavailableError(reason) {
  const error = new Error(
    `Review decisions cannot be saved right now: the review database is unavailable (${reason}). Nothing was changed; retry once it is back.`
  );
  error.statusCode = 503;
  return error;
}

function bucket(kind) {
  if (!overlay.has(kind)) overlay.set(kind, new Map());
  return overlay.get(kind);
}

function connected() {
  // Read lazily rather than at import: the module is loaded before mongoose
  // connects, and a cached "false" would disable the overlay for the process.
  try {
    // eslint-disable-next-line global-require
    return ReviewSignoff.db?.readyState === 1;
  } catch {
    return false;
  }
}

/**
 * Load every stored decision into memory. Called once after the database
 * connects; safe to call again.
 */
export async function hydrateReviewOverlay() {
  if (!connected()) {
    hydrated = true;
    available = false;
    lastError = "no database connection";
    return { hydrated: 0, available: false, changed: false };
  }
  try {
    const rows = await ReviewSignoff.find({}).lean();
    // Rebuild rather than merge, so a decision withdrawn by another instance
    // disappears here too.
    const next = new Map([
      [OVERLAY_KIND.CLAUSE, new Map()],
      [OVERLAY_KIND.CONSTRAINT_SCOPE, new Map()],
    ]);
    for (const row of rows) {
      if (!next.has(row.kind)) next.set(row.kind, new Map());
      next.get(row.kind).set(row.targetId, row.payload || {});
    }
    const changed = signatureOf(next) !== signatureOf(overlay);
    overlay.clear();
    for (const [kind, entries] of next) overlay.set(kind, entries);
    hydrated = true;
    available = true;
    lastHydratedAt = new Date();
    lastError = null;
    return { hydrated: rows.length, available: true, changed };
  } catch (error) {
    // A review overlay that cannot load must not stop the product serving
    // documents. Reads keep the last good state (or the files); writes are
    // refused until the database is reachable again.
    hydrated = true;
    available = false;
    lastError = error.message;
    return { hydrated: 0, available: false, changed: false, error: error.message };
  }
}

function signatureOf(map) {
  return JSON.stringify(
    [...map.entries()]
      .map(([kind, entries]) => [kind, [...entries.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))])
      .sort(([a], [b]) => (a < b ? -1 : 1))
  );
}

export function reviewOverlayStatus() {
  const required = reviewPersistenceRequired();
  return {
    hydrated,
    available,
    required,
    // Ready means review decisions read here are the durable ones and new ones
    // will persist. Not ready is not an outage for document generation.
    ready: !required || (available && connected()),
    last_hydrated_at: lastHydratedAt,
    last_error: lastError,
    clauses: bucket(OVERLAY_KIND.CLAUSE).size,
    constraint_scopes: bucket(OVERLAY_KIND.CONSTRAINT_SCOPE).size,
  };
}

/** The stored payload for one target, or null. Synchronous by design. */
export function overlayFor(kind, targetId) {
  return bucket(kind).get(targetId) || null;
}

/**
 * Merge the stored decision onto an object read from a file.
 *
 * Mutates and returns the object. Keys whose stored value is null are DELETED,
 * which is how a withdrawal is represented — otherwise a reset would leave the
 * file's stale reviewer in place and the withdrawal would appear not to work.
 */
export function applyOverlay(kind, targetId, object) {
  const payload = overlayFor(kind, targetId);
  if (!payload || !object) return object;
  for (const [key, value] of Object.entries(payload)) {
    if (value === null) delete object[key];
    else object[key] = value;
  }
  return object;
}

/**
 * Record a decision. Persists first and publishes to memory only once the
 * database has it. Without a database where none is required (local
 * development), memory and files are the only state, as before.
 */
export async function saveOverlay(kind, targetId, payload, updatedBy = null) {
  if (!connected()) {
    if (reviewPersistenceRequired()) throw unavailableError("no database connection");
    bucket(kind).set(targetId, payload);
    return { persisted: false, reason: "no database configured (development)" };
  }
  try {
    await ReviewSignoff.findOneAndUpdate(
      { kind, targetId },
      { kind, targetId, payload, updatedBy },
      { upsert: true, new: true }
    );
  } catch (error) {
    available = false;
    lastError = error.message;
    throw unavailableError(error.message);
  }
  available = true;
  bucket(kind).set(targetId, payload);
  return { persisted: true };
}

/**
 * Remove a stored decision outright. Review withdrawals should NOT use this
 * (see the header); it exists for maintenance only.
 */
export async function clearOverlay(kind, targetId) {
  if (!connected()) {
    if (reviewPersistenceRequired()) throw unavailableError("no database connection");
    bucket(kind).delete(targetId);
    return { persisted: false, reason: "no database configured (development)" };
  }
  try {
    await ReviewSignoff.deleteOne({ kind, targetId });
  } catch (error) {
    available = false;
    lastError = error.message;
    throw unavailableError(error.message);
  }
  bucket(kind).delete(targetId);
  return { persisted: true };
}
