/**
 * positionConservation.test.mjs
 *
 * Phase 5. Two invariants at the integration point.
 *
 * CONSERVATION. Every open position leaves resolution with exactly one of four
 * outcomes: RESOLVED, DEFAULTED, UNRESOLVED or ESCALATED. There is no fifth
 * outcome of "nothing happened". A position that quietly disappears is the
 * original defect in new clothing -- the document takes a stance and nobody can
 * say who took it.
 *
 * PROVENANCE SURVIVES. A resolved position still says how it was reached. A
 * pipeline that gets cleverer while the document loses the uncertainty
 * information the earlier phases worked to preserve has gone backwards.
 */
import assert from "node:assert";
import { resolvePositions, OUTCOME, PROVENANCE } from "../backend/services/positionResolution.js";
import { generateDocument } from "../backend/services/documentService.js";

const BASE = {
  party_1_name: "Devraj Vishal Bhore", party_1_type: "Individual",
  party_2_name: "Varun Raghunath Shastri", party_2_type: "Individual",
  consulting_fee: "30000", contract_duration: "12 months",
  services_description: "Strategic advisory covering market entry.",
  consulting_services: "Strategic advisory covering market entry.",
  deliverables: "Monthly strategy reports.",
  payment_terms: "Rs. 30,000 per month.", effective_date: "2026-08-21",
  operating_state: "Maharashtra", execution_city: "Pune", drafting_for: "Client",
};
const ANSWERS = {
  ACCESS: [
    "Information about identifiable people — staff, customers, patients, applicants",
    "Commercially sensitive information — pricing, strategy, client lists, methods",
  ],
  THIRD_PARTY_EXPOSURE: "Yes, that is a real possibility",
  WORK_PRODUCT_CREATED: "Yes",
  WORK_PRODUCT_OWNERSHIP: "I need to own it",
};
const VALID_OUTCOMES = new Set(Object.values(OUTCOME));
let checks = 0;

// ── 1. Conservation, across several answer states ───────────────────────────
const STATES = [
  ["no answers at all", {}],
  ["one question answered", { THIRD_PARTY_EXPOSURE: "Yes, that is a real possibility" }],
  ["fully answered", ANSWERS],
  ["an answer to a question that does not exist", { NOT_A_FACT: "Yes" }],
  ["an option that is not on the question", { THIRD_PARTY_EXPOSURE: "Perhaps" }],
];
for (const [label, answers] of STATES) {
  const r = resolvePositions({ documentType: "CONSULTANCY_AGREEMENT", variables: BASE, answers });
  assert.deepStrictEqual(r.conservation.leaked, [],
    `${label}: ${r.conservation.leaked.join(", ")} left resolution with no outcome at all.`);
  assert.strictEqual(r.conservation.accounted, r.conservation.open,
    `${label}: ${r.conservation.open} positions open but ${r.conservation.accounted} accounted for.`);
  for (const outcome of r.outcomes) {
    assert.ok(VALID_OUTCOMES.has(outcome.outcome),
      `${label}: ${outcome.mechanism} has outcome "${outcome.outcome}", which is not one of the four.`);
  }
  checks += 2 + r.outcomes.length;
}
console.log(`PASS  conservation holds across ${STATES.length} answer states`);

// An answer the system cannot place is reported, never silently swallowed.
const bogus = resolvePositions({
  documentType: "CONSULTANCY_AGREEMENT", variables: BASE,
  answers: { NOT_A_FACT: "Yes", THIRD_PARTY_EXPOSURE: "Perhaps" },
});
assert.strictEqual(bogus.unmatched.length, 2,
  "an answer that matches no question, and an option that is not offered, must both be reported");
checks += 1;

// ── 2. Every position says how it was reached ───────────────────────────────
const resolved = resolvePositions({ documentType: "CONSULTANCY_AGREEMENT", variables: BASE, answers: ANSWERS });
const known = new Set(Object.values(PROVENANCE));
for (const [flag, position] of Object.entries(resolved.positions)) {
  assert.ok(known.has(position.provenance),
    `${flag} was decided with provenance "${position.provenance}", which is not a known kind. ` +
    `A position whose origin cannot be named cannot be explained to the person signing.`);
  assert.strictEqual(typeof position.restsOnAssumedSide, "boolean",
    `${flag} does not record whether it rests on an assumption about which side the user is on.`);
  checks += 2;
}
// An answer the user gave, and a position nobody chose, must not look alike.
assert.strictEqual(resolved.positions.include_indemnity_clause.provenance, PROVENANCE.USER_ANSWER,
  "a position the user answered must be recorded as their answer");
const defaulted = resolvePositions({ documentType: "CONSULTANCY_AGREEMENT", variables: BASE, answers: {} });
const anyDefault = Object.values(defaulted.positions).find((p) => p.provenance === PROVENANCE.DRAFTING_DEFAULT);
assert.ok(anyDefault, "with no answers, at least one position must be recorded as a drafting default");
checks += 2;
console.log("PASS  provenance survives resolution; an answer and a default are distinguishable");

// ── 3. An unticked box on an answered question is a no, not a silence ───────
const partial = resolvePositions({
  documentType: "CONSULTANCY_AGREEMENT", variables: BASE,
  answers: { ACCESS: ["Commercially sensitive information — pricing, strategy, client lists, methods"] },
});
assert.strictEqual(partial.positions.include_non_solicit?.value, false,
  "a user who read the access checklist and did not tick 'my staff, customers or suppliers' has " +
  "answered that question. Leaving it open would ask them the same thing twice.");
assert.strictEqual(partial.positions.include_non_solicit?.provenance, PROVENANCE.USER_ANSWER,
  "a position taken from a non-selection is still the user's answer and must say so");
checks += 2;
console.log("PASS  a non-selection on an answered checklist is an answer");

// ── 4. Answers actually reach the document ──────────────────────────────────
// The layer can be perfectly correct and still change nothing, which is what
// happened when resolved positions were merged as intake variables and stripped
// by sanitisation on the way to clause selection.
const withAnswers = await generateDocument({
  document_type: "CONSULTANCY_AGREEMENT", variables: BASE, answers: ANSWERS,
});
const without = await generateDocument({
  document_type: "CONSULTANCY_AGREEMENT", variables: BASE, answers: {},
});
assert.ok(withAnswers?.draft && without?.draft, "both drafts must generate");
const before = new Set(without.draft.clauses.map((c) => c.clause_id));
const added = withAnswers.draft.clauses.map((c) => c.clause_id).filter((id) => !before.has(id));
assert.ok(added.length >= 3,
  `answering four questions changed the document by ${added.length} clauses. The resolved ` +
  `positions are not reaching clause selection.`);
assert.ok(withAnswers.assumptions.length < without.assumptions.length,
  "answering questions must reduce what the document has to assume");
assert.ok(without.assumptions.length > 0,
  "a document drafted entirely on defaults must disclose that it was");
for (const assumption of [...withAnswers.assumptions, ...without.assumptions]) {
  assert.ok(String(assumption.text || "").trim().length > 30,
    "every assumption must be a sentence a reader can act on");
  checks += 1;
}
checks += 4;
console.log(
  `PASS  answers reach the document: +${added.length} clauses ` +
  `(${added.join(", ")}), assumptions ${without.assumptions.length} → ${withAnswers.assumptions.length}`
);

// ── 5. Precedence, as an architectural invariant ────────────────────────────
// direct answer  >  deterministic derivation  >  inference / default
//
// Tested directly rather than left to the fact that resolved positions happen to
// be applied at the end of deriveGenerationControls. Implementation order stops
// being obvious the moment someone adds a block below it, and the failure is
// silent: the document quietly stops honouring what the user actually said.
const inferenceSaysYes = { ...BASE, warranty_period: "6 months", acceptance_criteria: "Per the agreed template." };

const answerOverridesInference = await generateDocument({
  document_type: "CONSULTANCY_AGREEMENT",
  variables: inferenceSaysYes,
  answers: { WORK_PRODUCT_CREATED: "Yes", PERFORMANCE_STANDARD: "No — I will judge the work as it comes" },
});
assert.ok(answerOverridesInference?.draft, "the override fixture must generate");
assert.ok(
  !answerOverridesInference.draft.clauses.some((c) => c.clause_id === "SERVICE_WARRANTY_001"),
  "the intake implies a quality assurance (a warranty period was given) but the user was asked " +
  "directly and said no. The answer must win: an inference drawn from something else they " +
  "wrote cannot outrank the question they were actually put."
);

const answerAddsWhatInferenceMissed = await generateDocument({
  document_type: "CONSULTANCY_AGREEMENT",
  variables: BASE,
  answers: { WORK_PRODUCT_CREATED: "Yes", PERFORMANCE_STANDARD: "Yes" },
});
assert.ok(
  answerAddsWhatInferenceMissed.draft.clauses.some((c) => c.clause_id === "SERVICE_WARRANTY_001"),
  "nothing in this intake implies a standard, but the user said there is one. The answer must " +
  "establish the position where no inference would have."
);

// A stated fact outranks a drafting default, and says so.
const stated = resolvePositions({
  documentType: "CONSULTANCY_AGREEMENT",
  variables: BASE,
  answers: { THIRD_PARTY_EXPOSURE: "Yes, that is a real possibility" },
});
assert.strictEqual(stated.positions.include_indemnity_clause.provenance, PROVENANCE.USER_ANSWER,
  "an answered position must never be recorded as a drafting default");
checks += 4;
console.log("PASS  precedence holds: answer > derivation > inference > default");

console.log(`\nALL GREEN (${checks} checks)`);
