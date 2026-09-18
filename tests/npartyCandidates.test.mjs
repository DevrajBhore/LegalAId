/**
 * npartyCandidates.test.mjs — THE ADJUDICATION MUST AGREE WITH ITSELF
 *
 * D4.21 replaced the pronoun scan with mechanism detectors and immediately
 * reproduced its disease: the first run flagged 59 new candidates, 34 of which
 * were artefacts of four defects — `majority` matching "the age of majority",
 * `Recipient` matching "recipient GSTIN", `assign\w*` matching every copyright
 * assignment in the corpus, and `proportion` matching vesting over time.
 *
 * So the deliverable is not a candidate count. It is a candidate set WITH
 * EVIDENCE AND VERDICTS, and this file asserts the properties that make such a
 * set worth anything:
 *
 *   - every verdict is one of three, with no implicit fourth;
 *   - a false positive must say WHY it fired, or it is just a deletion;
 *   - a true candidate must state the question, or it is just a flag;
 *   - the summary is recomputed from the list rather than trusted, because the
 *     first version of it claimed 15 true candidates over a list of 14.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { treatmentFor, TREATMENT } from "../backend/services/npartyTreatment.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const doc = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/nparty-candidates.json"), "utf8"));
const VERDICTS = new Set(["TRUE_CANDIDATE", "ALREADY_CLASSIFIED", "FALSE_POSITIVE"]);

check("every adjudication carries one of three verdicts and a reason", () => {
  assert.ok(doc.adjudications.length >= 15, "the adjudication list has been gutted");
  for (const a of doc.adjudications) {
    assert.ok(VERDICTS.has(a.verdict), `${a.clause_id}: unknown verdict ${a.verdict}`);
    assert.ok(a.reason && a.reason.length > 40,
      `${a.clause_id}: a verdict without a reason is an assertion`);
  }
});

check("a false positive says what fired and why it was wrong", () => {
  const fps = doc.adjudications.filter((a) => a.verdict === "FALSE_POSITIVE");
  assert.ok(fps.length > 0,
    "no false positives recorded — a detector that never misfires has not been tested");
  for (const a of fps) {
    assert.ok(a.mechanism, `${a.clause_id}: a false positive must name the mechanism that fired`);
    assert.ok(!a.question, `${a.clause_id}: a false positive cannot also pose a question`);
  }
});

check("a true candidate states its question and its mechanism", () => {
  for (const a of doc.adjudications.filter((x) => x.verdict === "TRUE_CANDIDATE")) {
    assert.ok(a.question && a.question.length > 30,
      `${a.clause_id}: a candidate without a stated question is a flag, not a finding`);
    assert.ok(a.mechanism, `${a.clause_id}: no mechanism recorded`);
    assert.ok(["HIGHEST", "HIGH", "MEDIUM", "LOW"].includes(a.priority),
      `${a.clause_id}: unranked, so the backlog has no order`);
  }
});

check("ALREADY_CLASSIFIED agrees with the shape index — the detector's own control", () => {
  /*
   * These three are how we know the detector works at all: it independently
   * flagged CORE_IDENTITY_001 and CORE_SIGNATURE_BLOCK_001, which the pronoun
   * scan could not see and which were later proved cardinality-sensitive by
   * generation. If the shape index and this file ever disagree, one of them is
   * stale and the agreement was coincidence.
   */
  for (const a of doc.adjudications.filter((x) => x.verdict === "ALREADY_CLASSIFIED")) {
    const t = treatmentFor(a.clause_id, 3);
    assert.strictEqual(t.outcome, TREATMENT.DETERMINED,
      `${a.clause_id} is recorded as already classified but the index says ${t.outcome}`);
    assert.strictEqual(t.shape, a.shape,
      `${a.clause_id}: recorded shape ${a.shape}, index says ${t.shape}`);
  }
});

check("a true candidate is NOT already classified", () => {
  /* Otherwise the backlog contains work that is already done. */
  for (const a of doc.adjudications.filter((x) => x.verdict === "TRUE_CANDIDATE")) {
    const t = treatmentFor(a.clause_id, 3);
    assert.notStrictEqual(t.outcome, TREATMENT.DETERMINED,
      `${a.clause_id} is listed as an open candidate and is already SAFE`);
  }
});

check("the summary is arithmetic over the list, not a claim beside it", () => {
  const v = {};
  for (const a of doc.adjudications) v[a.verdict] = (v[a.verdict] || 0) + 1;
  const folded = doc.adjudications.flatMap((a) => a.resolves_with || []);
  assert.strictEqual(doc.summary.adjudicated, doc.adjudications.length);
  assert.strictEqual(doc.summary.true_candidates, v.TRUE_CANDIDATE || 0);
  assert.strictEqual(doc.summary.already_classified, v.ALREADY_CLASSIFIED || 0);
  assert.strictEqual(doc.summary.false_positives, v.FALSE_POSITIVE || 0);
  assert.strictEqual(doc.summary.folded_into_another_adjudication, folded.length);
  assert.strictEqual(doc.summary.accounted_for,
    doc.adjudications.length + folded.length,
    "the accounted-for total does not equal adjudicated plus folded");
  assert.strictEqual(doc.summary.accounted_for, doc.summary.newly_discovered,
    "some newly discovered candidates were neither adjudicated nor folded — they have gone missing");
});

check("folded clauses are folded into a candidate, never into a false positive", () => {
  for (const a of doc.adjudications) {
    if (!a.resolves_with?.length) continue;
    assert.strictEqual(a.verdict, "TRUE_CANDIDATE",
      `${a.clause_id} absorbs other clauses while not being a candidate itself`);
    for (const id of a.resolves_with) {
      assert.ok(!doc.adjudications.some((x) => x.clause_id === id),
        `${id} is both folded into ${a.clause_id} and adjudicated separately — counted twice`);
    }
  }
});

console.log(`\nALL GREEN (${checks} checks)`);
