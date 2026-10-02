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
 */

import ReviewSignoff from "../models/ReviewSignoff.js";

export const OVERLAY_KIND = { CLAUSE: "clause", CONSTRAINT_SCOPE: "constraint_scope" };

/** kind -> Map(targetId -> payload) */
const overlay = new Map([
  [OVERLAY_KIND.CLAUSE, new Map()],
  [OVERLAY_KIND.CONSTRAINT_SCOPE, new Map()],
]);

let hydrated = false;
let available = false;

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
    return { hydrated: 0, available: false };
  }
  try {
    const rows = await ReviewSignoff.find({}).lean();
    for (const row of rows) bucket(row.kind).set(row.targetId, row.payload || {});
    hydrated = true;
    available = true;
    return { hydrated: rows.length, available: true };
  } catch (error) {
    // A review overlay that cannot load must not stop the product serving
    // documents. It degrades to the file state, which is what shipped.
    hydrated = true;
    available = false;
    return { hydrated: 0, available: false, error: error.message };
  }
}

export function reviewOverlayStatus() {
  return {
    hydrated,
    available,
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
 * Record a decision. Updates memory first so a read immediately after a write
 * sees it even if the database write is slow, then persists.
 */
export async function saveOverlay(kind, targetId, payload, updatedBy = null) {
  bucket(kind).set(targetId, payload);
  if (!connected()) return { persisted: false, reason: "no database connection" };
  try {
    await ReviewSignoff.findOneAndUpdate(
      { kind, targetId },
      { kind, targetId, payload, updatedBy },
      { upsert: true, new: true }
    );
    available = true;
    return { persisted: true };
  } catch (error) {
    return { persisted: false, reason: error.message };
  }
}

export async function clearOverlay(kind, targetId) {
  bucket(kind).delete(targetId);
  if (!connected()) return { persisted: false, reason: "no database connection" };
  try {
    await ReviewSignoff.deleteOne({ kind, targetId });
    return { persisted: true };
  } catch (error) {
    return { persisted: false, reason: error.message };
  }
}
