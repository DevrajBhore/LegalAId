/**
 * requirementCoherence.test.mjs
 *
 * PRESENCE + SUPERFICIALLY PLAUSIBLE WORDING IS NOT A COHERENT BOUNDARY.
 *
 * Every state in documentRequirements.js answers a question about ONE
 * requirement: does it apply, is it satisfied, by what, and how well is that
 * known. A document can answer all of them positively and still be incoherent,
 * because the defect lives BETWEEN two provisions each of which reads correctly
 * on its own.
 *
 * The NDA is the proof, and it is not a synthetic one. Every NDA this system
 * ships carries both of these:
 *
 *   NDA_DURATION_001       "The confidentiality obligations set forth in this
 *                           Agreement shall survive its termination or expiration
 *                           and continue for a period of five (5) years thereafter."
 *
 *   NDA_TERM_SURVIVAL_001  "... the obligations of confidentiality shall survive
 *                           for a further period of three (3) years in respect of
 *                           Confidential Information that does not constitute a
 *                           trade secret, and indefinitely in respect of trade
 *                           secrets."
 *
 * Two clauses, each individually well drafted, giving different answers to the
 * only question a confidentiality obligation must settle. The clause library
 * does not merely permit this pairing -- NDA_DURATION_001 lists
 * NDA_TERM_SURVIVAL_001 in `required_with`, so the library FORCES the
 * contradiction into every NDA it produces.
 *
 * Before this mechanism existed the requirement model reported nine of nine
 * RESOLVED for that document, because both clauses were present and each
 * satisfied its own requirement. That is the false green.
 *
 * Two rules keep the mechanism from degenerating into a semantic-similarity
 * guess, and both are tested below:
 *
 *   1. The comparison is EVIDENCE-BASED -- a declared regex reads each clause's
 *      answer out of that clause's own text. Nothing is inferred from clause
 *      names, categories or proximity.
 *   2. FAILURE OF THE INSTRUMENT IS NOT AGREEMENT. If the extract reads nothing
 *      from a clause that is present, the relationship is NOT_ESTABLISHED.
 *
 * What this layer does NOT decide: whether five years or three years is
 * reasonable under section 27 of the Contract Act, or which of the two ought to
 * govern. Both are legal conclusions, and this layer is not permitted to reach
 * one. It establishes only that the instrument states two and does not say which.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessRequirements, assessRelationships, loadDocumentRequirements, COVERAGE, FINDING,
} from "../backend/services/documentRequirements.js";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { certify } from "../backend/services/familyCertification.js";

let checks = 0;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const requirements = loadDocumentRequirements({ refresh: true });
const TEXT = {};
for (const clause of getAllClauses()) TEXT[clause.clause_id] = clause.text || "";

// ── 1. Every declared relationship clears the admission gate ────────────────
//
// The gate itself runs in loadDocumentRequirements; reaching here means it
// passed. What is checked here is that relationships are LOADED at all -- an
// earlier version parsed the array and silently discarded it, which is the
// quietest possible failure: the artifact declares a check, the model has no
// notion of it, and the report says nothing is wrong.
let declared = 0;
for (const [documentType, list] of requirements) {
  const relationships = list.relationships || [];
  declared += relationships.length;
  for (const relationship of relationships) {
    assert.ok(
      relationship.between.length >= 2,
      `${documentType}/${relationship.id}: a relationship needs at least two participants`
    );
    assert.ok(
      /^remove/i.test(relationship.identity_test),
      `${documentType}/${relationship.id}: identity_test must begin "Remove it and ..."`
    );
    assert.doesNotThrow(
      () => new RegExp(relationship.extract, "gi"),
      `${documentType}/${relationship.id}: extract must compile`
    );
    checks += 3;
  }
}
assert.ok(declared > 0, "no document family declares a requirement relationship");
checks += 1;

// ── 2. THE FALSIFICATION: the NDA as actually shipped ───────────────────────
//
// Both recorded baselines, not a hand-assembled clause list, so that the
// finding is about the product rather than about the fixture.
const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
).types.NDA;

for (const variant of ["minimal", "full"]) {
  const clauses = baseline[variant].clauses;
  const assessment = assessRequirements("NDA", clauses, {}, {}, [], TEXT);

  // The false green, preserved. Every identity requirement is satisfied.
  assert.equal(
    assessment.summary.resolved, assessment.summary.applicable,
    `NDA ${variant}: the requirement axis is expected to report complete — that is the point`
  );
  // And the document contradicts itself.
  assert.equal(
    assessment.coherence.broken, 1,
    `NDA ${variant}: the shipped instrument states two different confidentiality periods and ` +
    `the coherence axis must say so`
  );
  const period = assessment.relationships.find((r) => r.id === "CONFIDENTIALITY_PERIOD_COHERENT");
  assert.equal(period.coverage, COVERAGE.CONTRADICTED);
  assert.equal(period.finding, FINDING.ESTABLISHED_NEGATIVE);
  // Evidence-based: the finding names what each clause says, out of its own text.
  assert.deepEqual(period.read.NDA_DURATION_001, ["5"]);
  assert.deepEqual(period.read.NDA_TERM_SURVIVAL_001, ["3"]);
  checks += 5;
}

// ── 3. The extract reads the RIGHT quantity out of each clause ──────────────
//
// NDA_TERM_SURVIVAL_001 states TWO periods: the term of the agreement itself
// (two years) and the post-termination confidentiality period (three years). An
// extract anchored on any "period of N years" phrasing would read the term out
// of one clause and the survival period out of the other and compare two
// different things -- producing a confident finding about the wrong quantities,
// which is worse than not comparing at all.
assert.ok(
  /period of two \(2\) years/.test(TEXT.NDA_TERM_SURVIVAL_001),
  "fixture drift: NDA_TERM_SURVIVAL_001 no longer states the agreement's own term"
);
const relationship = requirements.get("NDA").relationships
  .find((r) => r.id === "CONFIDENTIALITY_PERIOD_COHERENT");
const readsFrom = [...new Set([...baseline.minimal.clauses, ...baseline.full.clauses])]
  .filter((id) => new RegExp(relationship.extract, "gi").test(TEXT[id] || ""));
assert.deepEqual(
  readsFrom.sort(), ["NDA_DURATION_001", "NDA_TERM_SURVIVAL_001"],
  "the extract reads a confidentiality period out of clauses it was not aimed at"
);
checks += 2;

// ── 4. A coherent instrument passes ─────────────────────────────────────────
//
// Without this the mechanism could be a constant that always reports broken,
// which would be indistinguishable from working on the evidence above.
const COHERENT = {
  ...TEXT,
  NDA_TERM_SURVIVAL_001:
    "This Agreement shall commence on the Effective Date and continue for a period of two (2) " +
    "years, unless earlier terminated by mutual written consent of the Parties. Notwithstanding " +
    "termination or expiry, the obligations of confidentiality shall survive for a further " +
    "period of five (5) years.",
};
const coherent = assessRequirements("NDA", baseline.minimal.clauses, {}, {}, [], COHERENT);
assert.equal(coherent.coherence.broken, 0);
assert.equal(coherent.coherence.holds, 1);
assert.equal(
  coherent.relationships[0].finding, FINDING.ESTABLISHED_POSITIVE,
  "an instrument that states one period must be able to establish the relationship positively"
);
checks += 3;

// ── 5. The two documents are INDISTINGUISHABLE on the requirement axis ──────
//
// This is the abstraction gap stated as an equality. The coherent NDA and the
// self-contradicting NDA contain exactly the same clause ids and produce exactly
// the same requirement summary. Nothing on that axis could ever have told them
// apart, however many requirements were authored, because the difference is not
// about which requirements are met.
const broken = assessRequirements("NDA", baseline.minimal.clauses, {}, {}, [], TEXT);
assert.deepEqual(
  broken.summary, coherent.summary,
  "the requirement summary must be identical for both — if it is not, this test is measuring " +
  "something other than the relationship"
);
assert.notDeepEqual(broken.coherence, coherent.coherence);
checks += 2;

// ── 6. Coherence is never counted into the requirement summary ──────────────
//
// Folding one broken relationship into "nine of ten resolved" would restore
// exactly the arithmetic this mechanism exists to defeat.
for (const key of Object.keys(broken.summary)) {
  assert.ok(
    !/relationship|coheren/i.test(key),
    `summary.${key}: relationship results must not appear on the requirement axis`
  );
  checks += 1;
}
assert.equal(
  broken.summary.contradicted, 0,
  "the broken relationship must not be counted as a CONTRADICTED requirement: no requirement " +
  "of this document is contradicted, and reporting one would misattribute the defect"
);
checks += 1;

// ── 7. FAILURE OF THE INSTRUMENT IS NOT AGREEMENT ───────────────────────────
//
// The subtler attack, and the one this codebase has already been caught by once
// in a different form (a word boundary matching "nda" inside "standards"). Here
// the clause is present and says something perfectly sensible about duration in
// prose the extract does not match. A mechanism that compared only what it
// managed to read would find one value, see no disagreement, and report the
// relationship as holding — a false green produced by its own blindness.
const SILENT = {
  ...TEXT,
  NDA_TERM_SURVIVAL_001:
    "Notwithstanding termination or expiry, the obligations of confidentiality shall endure " +
    "for so long as the Confidential Information retains commercial value.",
};
const silent = assessRequirements("NDA", baseline.minimal.clauses, {}, {}, [], SILENT);
assert.equal(silent.coherence.holds, 0, "a clause the extract cannot read is not agreement");
assert.equal(silent.coherence.not_established, 1);
assert.equal(silent.relationships[0].coverage, COVERAGE.AMBIGUOUS_EVIDENCE);
assert.equal(silent.relationships[0].finding, FINDING.NOT_ESTABLISHED);
assert.deepEqual(silent.relationships[0].silent, ["NDA_TERM_SURVIVAL_001"]);
checks += 5;

// ── 8. Unsupplied clause text is unfinished work, not agreement ─────────────
//
// The assessor has always been callable with clause ids alone. Every existing
// call site does exactly that. If a missing text map read as coherence, adding
// this mechanism would have silently certified every family that has not yet
// been wired to pass texts.
const noTexts = assessRequirements("NDA", baseline.minimal.clauses, {}, {}, []);
assert.equal(noTexts.coherence.holds, 0);
assert.equal(noTexts.coherence.work_incomplete, 1);
assert.equal(noTexts.relationships[0].finding, FINDING.WORK_INCOMPLETE);
assert.deepEqual(
  noTexts.relationships[0].missing_text.sort(),
  ["NDA_DURATION_001", "NDA_TERM_SURVIVAL_001"]
);
checks += 4;

// ── 9. One participant present: not applicable, and not a pass ──────────────
const single = assessRequirements(
  "NDA", baseline.minimal.clauses.filter((id) => id !== "NDA_TERM_SURVIVAL_001"), {}, {}, [], TEXT
);
assert.equal(single.relationships[0].coverage, COVERAGE.NOT_APPLICABLE);
assert.equal(
  single.coherence.holds, 0,
  "an instrument that states the period once was never tested for coherence and must not be " +
  "reported as having passed"
);
assert.equal(single.coherence.broken, 0, "nor as having failed");
assert.equal(single.coherence.tested, 0);
checks += 4;

// ── 10. The gate refuses relationships that cannot establish anything ───────
const { relationships: _drop, ...NDA_DOC } = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/documents/requirements/nda.requirements.json"), "utf8"
));
const GOOD = {
  id: "X_COHERENT", between: ["A_001", "B_001"],
  must_agree_on: "the period for which the obligation runs after termination",
  extract: "period of \\w+ \\((\\d+)\\) years",
  identity_test: "Remove it and the instrument states two different periods.",
  when_broken: "CONTRADICTED", review_status: "draft-needs-legal-review",
};
const tmp = path.join(ROOT, "knowledge-base/documents/requirements/__gate.requirements.json");
const refuses = (mutation, because) => {
  fs.writeFileSync(tmp, JSON.stringify({
    ...NDA_DOC, document_type: "__GATE_PROBE",
    relationships: [{ ...GOOD, ...mutation }],
  }));
  try {
    assert.throws(() => loadDocumentRequirements({ refresh: true }), because);
    checks += 1;
  } finally {
    fs.unlinkSync(tmp);
  }
};
// Presence agreeing with presence is the false green itself.
refuses({ extract: "period of \\w+ years" }, /capturing group/);
// Escaped parentheses are not a capture group.
refuses({ extract: "period of \\w+ \\(\\d+\\) years" }, /capturing group/);
refuses({ between: ["A_001"] }, /at least two/);
refuses({ when_broken: "VERY_BAD" }, /when_broken/);
refuses({ identity_test: "This checks the periods agree." }, /identity_test/);
refuses({ must_agree_on: "the period" }, /must_agree_on/);
refuses({ extract: "period of (\\d+ years" }, /does not compile/);
loadDocumentRequirements({ refresh: true });

// ── 11. THE PERMANENT NDA REGRESSION: the whole chain, end to end ──────────
//
// Not a mutation test and not a fixture I built. This is the document the
// product generates today, asserted through all four layers at once, so that a
// future change cannot repair the REPORTING while leaving the semantic conflict
// in the clause library:
//
//     requirements   RESOLVED (every one)          <- must stay green
//     coherence      CONTRADICTED                  <- must stay red
//     certification  FALSIFICATION_PASSED          <- found BECAUSE of the above
//     approval       impossible while it stands    <- structural, not incidental
//
// The first line is the surprising one. It is asserted as a REQUIRED outcome
// rather than tolerated, because the moment requirement coverage starts
// reporting this document as incomplete, the two axes have begun to leak into
// one another and the independence this whole mechanism rests on is gone.
const SHIPPED = assessRequirements("NDA", baseline.full.clauses, {}, {}, [], TEXT);
assert.equal(SHIPPED.summary.resolved, SHIPPED.summary.applicable);
assert.equal(SHIPPED.summary.unresolved + SHIPPED.summary.escalated, 0);
assert.equal(SHIPPED.coherence.broken, 1);
assert.equal(
  SHIPPED.relationships.find((r) => r.id === "CONFIDENTIALITY_PERIOD_COHERENT").coverage,
  COVERAGE.CONTRADICTED
);
checks += 4;

// The conflict is in the LIBRARY, not in one rendering of it. Asserted against
// the clause text itself so that rewording either clause without reconciling
// them fails here rather than passing quietly.
assert.match(TEXT.NDA_DURATION_001, /surviv\w+[^.]*period of five \(5\) years/i);
assert.match(TEXT.NDA_TERM_SURVIVAL_001, /surviv\w+[^.]*period of three \(3\) years/i);
// And the library FORCES the pairing: this is not a combination a user chose.
const library = Object.fromEntries(getAllClauses().map((c) => [c.clause_id, c]));
assert.ok(
  (library.NDA_DURATION_001.required_with || []).includes("NDA_TERM_SURVIVAL_001"),
  "NDA_DURATION_001 no longer requires NDA_TERM_SURVIVAL_001 — if the pairing was broken " +
  "deliberately, this fixture needs rewriting; if it was broken by accident, it has just " +
  "been caught"
);
checks += 3;

// And the approval bar, which must be STRUCTURAL rather than a side effect of
// there being no review evidence yet.
//
// Today the NDA cannot be approved for a much duller reason: none of its nine
// requirements has been read by an advocate. If the bar were only tested
// against the NDA it would appear to hold for the wrong reason and fail
// silently on the day that review is finished. So the control arm here is a
// family carried ALL THE WAY to APPROVED — every one of the five review kinds
// genuinely satisfied, including requirement review, which cannot be faked
// through certify() because it is read from the knowledge artifact — and the
// only variable changed is whether it ships a coherence defect.
// A probe-only type, named to certify() rather than borrowing a real family's
// name. Written under TERM_SHEET this file would have replaced that family's
// requirements the moment it had any — the loader now refuses it outright.
const PROBE = "__APPROVAL_PROBE";
const probeFile = path.join(
  ROOT, "knowledge-base/documents/requirements/__approvalprobe.requirements.json"
);
const probeRequirements = JSON.parse(JSON.stringify(NDA_DOC.requirements))
  .map((r) => ({ ...r, review_status: "reviewed-2026-09" }));
probeRequirements[0].falsification = {
  attack: "Control arm for the coherence approval bar.",
  false_green: "A family with complete review evidence reaching APPROVED while its own " +
               "generated document contradicts itself.",
  fixture: "tests/requirementCoherence.test.mjs",
};
fs.writeFileSync(probeFile, JSON.stringify({
  document_type: PROBE, requirements: probeRequirements,
}));
try {
  loadDocumentRequirements({ refresh: true });
  const probeClauses = baseline.full.clauses;
  const reviewed = {
    generates: new Set([PROBE]),
    emits: new Map([[PROBE, probeClauses]]),
    reviewedClauses: new Set(probeClauses),
    signOff: new Map([[PROBE, { family_review: true, artifact_review: true, approval: true }]]),
  };
  const clean = certify({ ...reviewed, families: [PROBE] }).families[PROBE];
  assert.equal(
    clean.status, "APPROVED",
    "the control arm must actually reach APPROVED, or this test proves nothing about the bar"
  );

  const defective = certify({
    families: [PROBE],
    ...reviewed, defects: new Map([[PROBE, ["CONFIDENTIALITY_PERIOD_COHERENT"]]]),
  }).families[PROBE];
  assert.notEqual(
    defective.status, "APPROVED",
    "a family whose own generated document contradicts itself must not be approvable, however " +
    "complete the review evidence"
  );
  assert.equal(
    defective.status, "ADVOCATE_REVIEW",
    "a family may be UNDER review with a live defect — that is what an advocate should be " +
    "looking at — but it may not come out the other side approved"
  );
  assert.deepEqual(defective.ships_defects, ["CONFIDENTIALITY_PERIOD_COHERENT"]);
  assert.ok(defective.reasons.some((r) => /approval barred/.test(r)));
  // The rung is not secretly lowered to hide the defect either: the falsification
  // evidence is still recorded, and coherence is reported BESIDE the rung.
  assert.ok(defective.reasons.some((r) => /adversarially attacked/.test(r)));
  checks += 6;
} finally {
  fs.unlinkSync(probeFile);
  loadDocumentRequirements({ refresh: true });
}

// And the live NDA, whose bar holds today for the duller reason, is where the
// ladder says it is.
const nda = certify({
  generates: new Set(["NDA"]),
  emits: new Map([["NDA", baseline.full.clauses]]),
  defects: new Map([["NDA", ["CONFIDENTIALITY_PERIOD_COHERENT"]]]),
}).families.NDA;
assert.equal(nda.status, "FALSIFICATION_PASSED");
assert.deepEqual(nda.ships_defects, ["CONFIDENTIALITY_PERIOD_COHERENT"]);
checks += 2;

// ── 12. A clause that disagrees with ITSELF is read as disagreement ─────────
//
// The extract collects every match in each clause, not the first. Taking the
// first would make the finding depend on drafting order: a clause promising
// seven years in one sentence and five in the next would report whichever came
// earlier and agree with a companion clause by accident. The evidence is
// everything the instrument says, not the first thing it says.
const SELF_CONTRADICTING = {
  ...TEXT,
  NDA_TERM_SURVIVAL_001:
    "Notwithstanding termination or expiry, the obligations of confidentiality shall survive " +
    "for a further period of five (5) years. The obligations in respect of technical " +
    "information shall survive for a period of seven (7) years from termination.",
};
const selfBroken = assessRequirements(
  "NDA", baseline.minimal.clauses, {}, {}, [], SELF_CONTRADICTING
);
assert.deepEqual(
  selfBroken.relationships[0].read.NDA_TERM_SURVIVAL_001, ["5", "7"],
  "every answer the clause gives is evidence, not only the first"
);
assert.equal(
  selfBroken.coherence.broken, 1,
  "one clause agreeing with its companion in its first sentence and contradicting it in its " +
  "second is not coherence"
);
checks += 2;

// ── 13. The mechanism carries no family-specific knowledge ──────────────────
//
// The same reusability rule the assessor itself is held to. If the word NDA
// appears in the implementation, the next family gets its own branch and the
// mechanism is not a mechanism.
const source = fs.readFileSync(
  path.join(ROOT, "backend/services/documentRequirements.js"), "utf8"
);
const implementation = source
  .split("export function assessRelationships")[1]
  .split("export function assessRequirements")[0];
for (const token of ["NDA", "confidential", "duration", "years"]) {
  assert.ok(
    !new RegExp(token, "i").test(implementation),
    `assessRelationships names "${token}" — the doctrine belongs in the knowledge artifact`
  );
  checks += 1;
}

console.log(`requirementCoherence: ${checks} checks passed`);
