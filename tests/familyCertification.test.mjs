/**
 * familyCertification.test.mjs
 *
 * The dangerous claim this exists to prevent:
 *
 *     40 document types
 *     40 generators that run
 *     40 documents called "supported"
 *
 * when five have been substantively tested. "It generates" and "it has been
 * shown to do the legal work it claims" are different sentences.
 *
 * STATUS IS DERIVED, NEVER DECLARED. No family can be promoted by writing a
 * better word in a file. The one rung with an authored component — falsification
 * — requires naming the specific attack and the false green it produced, because
 * "we tested it" is not evidence and "we fed it a boilerplate façade and it
 * reported 1 of 13" is.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { certify, RUNG, REVIEW_EVIDENCE } from "../backend/services/familyCertification.js";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";

const baseline = JSON.parse(fs.readFileSync(path.resolve("tests/baseline/clause-baseline.json"), "utf8"));
const generates = new Set(
  Object.entries(baseline.types || {})
    .filter(([, record]) => (record?.full?.clauses || []).length)
    .map(([documentType]) => documentType)
);
const reviewedClauses = new Set(
  getAllClauses()
    .filter((c) => c.review_status && !/draft|needs/i.test(c.review_status))
    .map((c) => c.clause_id)
);
const emits = new Map(
  Object.entries(baseline.types || {}).map(([type, record]) => [type, record?.full?.clauses || []])
);
const { families, counts, approved, total } = certify({ generates, emits, reviewedClauses });
let checks = 0;

// ── 1. Nothing claims approval it has not earned ────────────────────────────
assert.strictEqual(approved, 0,
  `${approved} families report APPROVED. With zero advocate sign-off anywhere in the system, ` +
  `that is impossible, and the ladder has started accepting a declaration in place of evidence.`);
for (const [documentType, family] of Object.entries(families)) {
  assert.ok(RUNG.includes(family.status), `${documentType}: unknown status "${family.status}"`);
  if (family.status !== "NOT_ASSESSED") {
    assert.ok(family.reasons.length >= 2,
      `${documentType} claims ${family.status} with ${family.reasons.length} piece(s) of evidence`);
  }
  checks += 2;
}
console.log(`PASS  ${total} families, ${approved} approved, status derived from evidence`);

// ── 2. Falsification cannot be claimed, only described ──────────────────────
// A family reaching this rung must name an attack and the false green it found.
// "Tested" is not evidence.
const requirements = loadDocumentRequirements();
const attacked = Object.entries(families).filter(([, f]) =>
  ["FALSIFICATION_PASSED", "ADVOCATE_REVIEW", "APPROVED"].includes(f.status)
);
for (const [documentType] of attacked) {
  const record = requirements.get(documentType).find((r) => r.falsification);
  assert.ok(String(record?.falsification?.attack || "").length > 60,
    `${documentType} claims falsification without describing the attack`);
  assert.ok(String(record?.falsification?.false_green || "").length > 40,
    `${documentType} claims falsification without naming the false green it produced. A family ` +
    `that was attacked and held tells you nothing; a family that was attacked and BROKE is what ` +
    `made the abstraction better.`);
  checks += 2;
}
assert.ok(attacked.length >= 4,
  `only ${attacked.length} families have survived adversarial testing`);
console.log(`PASS  ${attacked.length} families name a specific attack and the false green it found`);

// ── 3. The ladder is monotone in evidence ───────────────────────────────────
// Removing evidence must lower the rung. Tested by withholding the generation
// baseline, which is the one input the assessment cannot fake.
const withoutBaselines = certify({ generates: new Set(), emits, reviewedClauses });
for (const [documentType, family] of Object.entries(withoutBaselines.families)) {
  const withEvidence = RUNG.indexOf(families[documentType].status);
  const without = RUNG.indexOf(family.status);
  assert.ok(without <= withEvidence,
    `${documentType} rose from ${family.status} to ${families[documentType].status} when ` +
    `evidence was REMOVED, so the ladder is not reading evidence at all`);
  checks += 1;
}
assert.strictEqual(withoutBaselines.families.MASTER_SERVICE_AGREEMENT.status, "REQUIREMENTS_ADMITTED",
  "a family whose generation baseline is withheld must fall back to what its requirements alone prove");
checks += 1;
console.log("PASS  the ladder falls when evidence is withheld");

// ── 4. The honest headline ──────────────────────────────────────────────────
// The number that may be put in front of a user as "supported" is APPROVED, and
// it is zero. Everything else is work in progress with a name.
assert.ok(counts.NOT_ASSESSED > 0,
  "every family reporting as assessed would be a stronger claim than this system can make");
console.log(
  "PASS  " + RUNG.filter((r) => counts[r]).map((r) => `${r}=${counts[r]}`).join("  ")
);
checks += 1;

// ── 5. Review evidence does not accumulate into approval ───────────────────
// The attack: mark every requirement reviewed and see whether APPROVED falls
// out. It must not. These four statements are all different, and none implies
// the next:
//
//     all requirements reviewed
//         != all emitted clauses reviewed
//         != the family reviewed
//         != a generated artifact reviewed
//         != the family approved
//
// An earlier version derived the top rungs from requirement-level review_status
// alone, which meant enough lower-level flags would eventually add up to an
// approval nobody gave.
const allRequirementsReviewed = new Map(
  [...loadDocumentRequirements()].map(([type, list]) => [
    type, list.map((r) => ({ ...r, review_status: "reviewed-by-advocate" })),
  ])
);
const originalLoad = loadDocumentRequirements();
for (const [type, list] of allRequirementsReviewed) originalLoad.set(type, list);
const withFlags = certify({ generates, emits, reviewedClauses });
assert.strictEqual(withFlags.approved, 0,
  `marking every requirement reviewed produced ${withFlags.approved} APPROVED families. ` +
  `Requirement metadata must never accumulate into an approval: the clauses are unreviewed, ` +
  `no advocate has examined the family, and nobody signed anything.`);
const msa = withFlags.families.MASTER_SERVICE_AGREEMENT;
assert.strictEqual(msa.evidence.requirement_review, true, "the flags were applied");
assert.strictEqual(msa.evidence.clause_review, false,
  "clause review must be read from the clause library, not inferred from requirements");
assert.strictEqual(msa.status, "FALSIFICATION_PASSED",
  `the MSA rose to ${msa.status} on requirement flags alone`);
checks += 4;

// Nor does clause review alone, nor both together.
const everyClauseReviewed = new Set(getAllClauses().map((c) => c.clause_id));
const withBoth = certify({ generates, emits, reviewedClauses: everyClauseReviewed });
assert.strictEqual(withBoth.approved, 0,
  "every requirement and every clause marked reviewed still must not approve a family: an " +
  "advocate has still not examined the family or any generated artifact, and has signed nothing");
assert.strictEqual(withBoth.families.MASTER_SERVICE_AGREEMENT.status, "FALSIFICATION_PASSED",
  "two kinds of evidence are not five");
checks += 2;

// Approval requires all five, and only then.
const signed = new Map([["MASTER_SERVICE_AGREEMENT",
  { family_review: true, artifact_review: true, approval: true }]]);
const properly = certify({ generates, emits, reviewedClauses: everyClauseReviewed, signOff: signed });
assert.strictEqual(properly.families.MASTER_SERVICE_AGREEMENT.status, "APPROVED",
  "with all five kinds of evidence the family is approved — the ladder must be reachable, or it " +
  "is theatre rather than a measurement");
assert.strictEqual(properly.approved, 1, "and only that family");
for (const kind of REVIEW_EVIDENCE) {
  const partial = new Map([["MASTER_SERVICE_AGREEMENT",
    { family_review: true, artifact_review: true, approval: true, [kind]: false }]]);
  const held = certify({
    generates, emits,
    reviewedClauses: kind === "clause_review" ? new Set() : everyClauseReviewed,
    signOff: partial,
  });
  if (kind === "requirement_review") continue; // supplied through the registry, covered above
  assert.notStrictEqual(held.families.MASTER_SERVICE_AGREEMENT.status, "APPROVED",
    `withholding ${kind} still produced APPROVED, so that evidence is not actually required`);
  checks += 1;
}
checks += 2;
console.log("PASS  approval needs all five kinds of evidence; no four of them suffice");

console.log(`\nALL GREEN (${checks} checks)`);
