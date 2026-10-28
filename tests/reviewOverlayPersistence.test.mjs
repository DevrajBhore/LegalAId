/**
 * reviewOverlayPersistence.test.mjs — A REVIEW DECISION IS DURABLE OR REFUSED
 *
 * The overlay used to update its in-memory map before the database write and
 * keep the change even when that write failed, so one process could serve a
 * sign-off that would vanish on restart. A reset deleted the stored row, which
 * let a sign-off still present in the deployed files reappear after a restart.
 *
 * Runs offline: ReviewSignoff is swapped for an in-memory stand-in whose
 * connection state and failures the test controls.
 */
import assert from "node:assert/strict";
import { register } from "node:module";

const fake = `
const rows = new Map();
export const control = { readyState: 1, failWrites: false, failReads: false };
const key = (f) => f.kind + "|" + f.targetId;
export default {
  get db() { return { readyState: control.readyState }; },
  _rows: rows,
  find() {
    return { lean: async () => { if (control.failReads) throw new Error("read failed"); return [...rows.values()].map((r) => structuredClone(r)); } };
  },
  async findOneAndUpdate(filter, update) {
    if (control.failWrites) throw new Error("write failed");
    rows.set(key(filter), structuredClone(update));
    return update;
  },
  async deleteOne(filter) {
    if (control.failWrites) throw new Error("write failed");
    rows.delete(key(filter));
  },
};`;
const FAKE_URL = "data:text/javascript," + encodeURIComponent(fake);
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (/\\/models\\/ReviewSignoff\\.js$/.test(specifier)) return { url: ${JSON.stringify(FAKE_URL)}, shortCircuit: true };
  return next(specifier, context);
}`));

const { control, default: ReviewSignoff } = await import(FAKE_URL);
const overlay = await import("../backend/services/reviewOverlay.js");
const { saveOverlay, overlayFor, applyOverlay, hydrateReviewOverlay, reviewOverlayStatus, reviewPersistenceRequired, OVERLAY_KIND } = overlay;

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks += 1;
  console.log(`PASS  ${msg}`);
};
const rejects503 = async (promise, msg) => {
  await assert.rejects(promise, (err) => err.statusCode === 503);
  checks += 1;
  console.log(`PASS  ${msg}`);
};

const saved = { MONGODB_URI: process.env.MONGODB_URI, NODE_ENV: process.env.NODE_ENV, RENDER: process.env.RENDER };
process.env.MONGODB_URI = "mongodb://example/test";
process.env.NODE_ENV = "";
process.env.RENDER = "";
const C = OVERLAY_KIND.CLAUSE;

try {
  ok(reviewPersistenceRequired(), "a configured database makes durable review state required");

  /* ── Success: persisted, then published ─────────────────────────────── */
  const approved = { review_status: "approved", reviewed_by: "Adv. A" };
  const result = await saveOverlay(C, "CL_1", approved, "Adv. A");
  ok(result.persisted === true && overlayFor(C, "CL_1")?.reviewed_by === "Adv. A",
    "a successful write is persisted and then visible");

  /* ── Failed write: refused, nothing changes ─────────────────────────── */
  control.failWrites = true;
  await rejects503(saveOverlay(C, "CL_1", { review_status: "draft", reviewed_by: null }, "Adv. B"),
    "a failed database write is refused with 503");
  ok(overlayFor(C, "CL_1")?.reviewed_by === "Adv. A", "a refused write leaves the served decision unchanged");
  ok(reviewOverlayStatus().ready === false, "after a failed write the overlay reports not ready");
  control.failWrites = false;

  /* ── Disconnected: refused where durability is required ─────────────── */
  control.readyState = 0;
  await rejects503(saveOverlay(C, "CL_2", approved, "Adv. A"), "a write with the database disconnected is refused");
  ok(overlayFor(C, "CL_2") === null, "a refused write is not held in memory");
  control.readyState = 1;

  /* ── Reset is stored as nulls, so the file cannot resurrect it ──────── */
  await saveOverlay(C, "CL_1", { review_status: "draft", reviewed_by: null, reviewed_on: null }, "Adv. A");
  const fromFile = applyOverlay(C, "CL_1", { review_status: "approved", reviewed_by: "Old Reviewer", reviewed_on: "2026-01-01" });
  ok(fromFile.review_status === "draft" && !("reviewed_by" in fromFile) && !("reviewed_on" in fromFile),
    "a withdrawal overrides a sign-off still present in the files");
  ok(ReviewSignoff._rows.has(`${C}|CL_1`), "the withdrawal is kept as a stored row, not deleted");

  /* ── Hydration rebuilds, so other instances' withdrawals propagate ──── */
  ReviewSignoff._rows.delete(`${C}|CL_1`);
  ReviewSignoff._rows.set(`${C}|CL_3`, { kind: C, targetId: "CL_3", payload: { review_status: "approved" } });
  const refreshed = await hydrateReviewOverlay();
  ok(refreshed.changed === true && overlayFor(C, "CL_1") === null && overlayFor(C, "CL_3")?.review_status === "approved",
    "refreshing replaces memory with the database state (adds and removals)");
  ok((await hydrateReviewOverlay()).changed === false, "an unchanged database reports no change");
  ok(reviewOverlayStatus().ready === true, "a healthy refresh reports ready");

  control.failReads = true;
  const failedRefresh = await hydrateReviewOverlay();
  ok(failedRefresh.available === false && overlayFor(C, "CL_3")?.review_status === "approved",
    "a failed refresh keeps serving the last good state and reports unavailable");
  control.failReads = false;

  /* ── Development without a database keeps the old file-only behaviour ─ */
  process.env.MONGODB_URI = "";
  control.readyState = 0;
  const dev = await saveOverlay(C, "CL_DEV", approved, "Dev");
  ok(dev.persisted === false && overlayFor(C, "CL_DEV")?.review_status === "approved",
    "with no database configured (development) decisions stay local, as before");
} finally {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

console.log(`\nALL GREEN (${checks} checks)`);
