/**
 * measurementModel.test.mjs — THREE LEVELS THAT MUST NOT COLLAPSE
 *
 * D4.31 produced one failure at each level and they needed different people:
 *
 *   1  EXECUTION PROVENANCE   a green number from a tree nobody could name
 *   2  TEST EVIDENCE          generation dead in production, suite never run there
 *   3  GOVERNANCE             308 unreviewed clauses against a ceiling of 307
 *
 * Collapsing them is how "all tests green" gets read as "the product is ready to
 * ship", and equally how a governance breach gets mistaken for a broken build.
 * The clause ceiling failing does not mean generation is broken — it means
 * someone has to choose something.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/governance", f), "utf8"));

const M = read("investigation-methodology.json");
const C = read("clause-ceiling.json");

check("the three levels are recorded in order, each with what enforces it", () => {
  const levels = M.measurement_model.levels;
  assert.deepStrictEqual(levels.map((l) => l.id),
    ["EXECUTION_PROVENANCE", "TEST_EVIDENCE", "LEGAL_AND_CONTENT_GOVERNANCE"],
    "the measurement model has changed shape");
  for (const l of levels) {
    assert.ok(l.question && l.enforced_by, `level ${l.level}: no question or no enforcement`);
  }
  assert.ok(/BOTH its correctness and its measurement provenance/i.test(M.measurement_model.rule),
    "the rule no longer requires both halves, and Level 2 alone would again read as evidence about the product");
});

check("level 1 is enforced by a test that actually runs first", () => {
  /*
   * A provenance check that runs last tells you what you measured after you have
   * already read the number. The ordering is the point.
   */
  const l1 = M.measurement_model.levels.find((l) => l.id === "EXECUTION_PROVENANCE");
  assert.ok(/measurementProvenance/.test(l1.enforced_by));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok(/^node tests\/measurementProvenance\.test\.mjs\b/.test(pkg.scripts.test.trim()),
    "the provenance test is no longer the first thing the suite runs");
});

check("the governance breach is recorded as not affecting generation", () => {
  /*
   * The half that stops a panic, and the half that stops the red being dismissed.
   */
  assert.strictEqual(C.level, "LEGAL_AND_CONTENT_GOVERNANCE");
  assert.ok(/none/i.test(C.finding.generation_impact),
    "the record no longer states that the ceiling breach leaves generation unaffected");
  assert.ok(/NOT evidence that generation is broken/i.test(C.$comment.join(" ")),
    "the distinction between a governance boundary and a broken build is no longer stated");
});

check("the clause that crossed the ceiling is named, with how it was found", () => {
  /*
   * "Why is the number 308" is the weaker question. "What entered the governed
   * library, and under what decision" is the one that can be acted on.
   */
  const w = C.what_crossed_it;
  assert.ok(w.clause_id && w.file && w.entered_in, "the clause is no longer identified");
  assert.ok(/diff-filter=A/.test(w.$method),
    "how the clause was identified is no longer recorded, so the claim cannot be re-checked");
  assert.ok(fs.existsSync(path.join(ROOT, w.file)),
    `${w.file} is no longer in the library — if the clause was removed, the ceiling question has changed and this record needs revisiting`);
});

check("the ceiling has not been raised, and the record says a test may not raise it", () => {
  /*
   * ASSERT_THE_STATE_NOT_THE_HOPE. This fails when the ceiling moves, which is
   * exactly when someone should be confirming that the move was deliberate.
   */
  const provenance = fs.readFileSync(path.join(ROOT, "tests/clauseProvenance.test.mjs"), "utf8");
  const pinned = /const MAX_UNREVIEWED = (\d+);/.exec(provenance);
  assert.ok(pinned, "the pinned ceiling has been removed from clauseProvenance");
  assert.strictEqual(Number(pinned[1]), C.finding.ceiling,
    `the ceiling is now ${pinned[1]} and clause-ceiling.json still records ${C.finding.ceiling}. If it was raised deliberately, record the decision; if not, this is the drift the pin exists to catch.`);
  assert.strictEqual(C.decision_required.status, "UNDECIDED");
  assert.ok(/must not decide which/i.test(C.decision_required.$constraint),
    "the constraint that the test may not make this choice has been dropped");
});

check("the earlier green results are retracted as product evidence but kept", () => {
  const p = M.d431_closing_state.prior_measurements;
  assert.strictEqual(p.status, "RETRACTED AS PRODUCT EVIDENCE");
  assert.ok(/historical measurements/i.test(p.retained_as),
    "the earlier runs are no longer retained as measurements of the tree they were taken in");
  assert.ok(/only record of the error/i.test(p.$why_not_deleted),
    "the reason for keeping rather than rewriting them is gone, and a later reader will tidy them away");
});

check("the provenance refinement stays open and unexpanded", () => {
  /*
   * A commit plus a dirty count does not uniquely identify a tree. That is true
   * and it is not yet a demonstrated source of a wrong result, so it is recorded
   * as an observation rather than built.
   */
  const r = M.open_refinements.find((x) => x.id === "REPOSITORY_IDENTITY_IS_NOT_MEASUREMENT_IDENTITY");
  assert.ok(r, "the refinement has been removed");
  assert.ok(/OPEN/.test(r.status), "the refinement has been built without an investigation showing it changes a result");
  assert.ok(/demonstrates that it can change a result/i.test(r.$discipline),
    "the condition for adding a dimension is no longer recorded, and a full environment fingerprint will accrete");
  assert.ok(r.distinction.repository_identity && r.distinction.measurement_identity,
    "the two identities are no longer distinguished");
});

console.log(`\n${checks} checks passed`);
