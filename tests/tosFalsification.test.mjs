/**
 * tosFalsification.test.mjs — PHASE D3.5
 *
 * THE ATTACK: a Terms of Service that reports a clean sheet while telling the
 * reader it is enforceable, that they have read and understood it, and that they
 * gave free consent — none of which anything establishes, about a person who
 * does not exist yet.
 *
 * THE FALSE GREEN, measured before anything was changed. Author the three
 * out-of-scope propositions the natural way — as ordinary CONTENT satisfied by
 * the clause that asserts them:
 *
 *     USER_ACCEPTED_THE_TERMS                  RESOLVED / ESTABLISHED_POSITIVE
 *     INSTRUMENT_IS_ENFORCEABLE                RESOLVED / ESTABLISHED_POSITIVE
 *     PARTIES_HAVE_CAPACITY_AND_FREE_CONSENT   RESOLVED / ESTABLISHED_POSITIVE
 *
 * 9 of 9 green. The system would have told a service operator that their
 * published terms are enforceable and accepted, because the terms say so. It is
 * the sharpest false green in this work, and nothing structural prevents it —
 * the defence is that the requirements are not authored, and the reason they are
 * not authored is D3.2: they have no subject in this artifact to bind to.
 *
 * NOTHING WAS CHANGED TO MAKE THIS PASS. The two self-certifying assertions are
 * still in the shipped document; no invalid_if was made executable; no new
 * mechanism was added. This file records what the system does refuse and what it
 * does not.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { COVERAGE, FINDING, loadDocumentRequirements } from "../backend/services/documentRequirements.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { establish, EVIDENCE, APPLICABILITY } from "../backend/services/evidencePropositions.js";

let checks = 0;
const BASE = variablesFor("TERMS_OF_SERVICE", { profile: FIXTURE_PROFILE.WELL_FILLED });

async function tos(overrides = {}) {
  const variables = { ...BASE, ...overrides };
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete variables[k];
  const result = await generateDocument({ document_type: "TERMS_OF_SERVICE", variables });
  const clauses = result.draft?.clauses || [];
  return {
    generates: clauses.length > 0,
    ids: clauses.map((c) => c.clause_id),
    text: clauses.map((c) => c.text || "").join("\n"),
    of: (id) => result.requirements?.results?.find((r) => r.id === id),
    relationships: result.requirements?.relationships || [],
    summary: result.requirements?.summary,
  };
}

// ── The document still says all of it. The fixture is not sanitised ──────────
const shipped = await tos();
assert.ok(shipped.generates, "the Terms of Service fixture does not generate");
const STILL_ASSERTED = [
  [/do not require a physical or digital signature to be enforceable/i, "self-certifying enforceability"],
  [/entered into with free consent under Sections 13[^.]{0,20}19/i, "self-certifying free consent"],
  [/Each Party is competent to contract/i, "self-certifying capacity"],
  [/you[^.]{0,90}acknowledge that you have read, understood, and agree/i, "a claim about the reader"],
];
for (const [pattern, label] of STILL_ASSERTED) {
  assert.match(
    shipped.text, pattern,
    `the document no longer makes the ${label} claim. If it was repaired, that is good — but ` +
    `this falsification evidence was gathered against a document that made it, and must be ` +
    `re-gathered rather than quietly passing against an easier fixture.`
  );
}
checks += STILL_ASSERTED.length + 1;

// ── 1. The six authored requirements resolve, and they SHOULD ───────────────
// This is not the thing under attack. It is the control: a repair that made the
// whole family fail would satisfy every negative assertion below.
const AUTHORED = [
  "INSTRUMENT_IDENTIFIES_THE_SERVICE", "SUBSTANTIVE_TERMS_STATED", "ACCEPTANCE_ROUTE_PROVIDED",
  "AMENDMENT_ROUTE_STATED", "WITHDRAWAL_OF_ACCESS_STATED", "GRIEVANCE_ROUTE_STATED",
];
for (const id of AUTHORED) {
  assert.equal(shipped.of(id)?.coverage, COVERAGE.RESOLVED, `${id} does not resolve`);
}
checks += AUTHORED.length;

// ── 2. THE OUT-OF-SCOPE PROPOSITIONS ARE NOT AUTHORED ───────────────────────
// The whole defence. Each of these, authored as CONTENT satisfied by the clause
// that asserts it, reports RESOLVED — measured, not assumed.
const declared = loadDocumentRequirements().get("TERMS_OF_SERVICE") || [];
const FORBIDDEN = /accepted|acceptance_by|enforceab|capacity|free_consent|binding_on_user|formation/i;
const trespassing = declared.filter((r) => FORBIDDEN.test(r.id) && r.id !== "ACCEPTANCE_ROUTE_PROVIDED");
assert.deepEqual(
  trespassing.map((r) => r.id), [],
  "a Terms of Service requirement now claims a proposition about a particular user's acceptance " +
  "or about the instrument's enforceability. Authored as CONTENT it will report RESOLVED on the " +
  "strength of the clause that asserts it — 9 of 9 green, telling an operator their terms are " +
  "enforceable because the terms say so. If this is deliberate, the subject it binds to has to " +
  "be named first: see docs/audit/TOS_ACCEPTED_COUNTERFACTUAL.md."
);
checks += 1;

// ── 3. There is still no subject to bind such a proposition to ──────────────
const schema = getVariables("TERMS_OF_SERVICE") || {};
const subjects = Object.keys(schema).filter((f) => /^user_|_user_name|subscriber|accepted_at|accepted_version/i.test(f));
assert.deepEqual(
  subjects, [],
  `the Terms of Service intake now collects ${subjects.join(", ")}. A field naming a user or a ` +
  `version changes the D3.2 finding, and whether acceptance belongs in this family should be ` +
  `re-probed rather than assumed either way.`
);
// And the evidence layer refuses evidence whose subject does not match, which is
// the check that makes the absence meaningful rather than merely convenient.
const wrongSubject = establish(
  "posh_policy_disseminated",
  [{ proposition: "posh_policy_disseminated", provenance: "operator_declaration", state: "true",
     subject: { company_name: "One Company" }, as_of: new Date().toISOString().slice(0, 10) }],
  { company_name: "A Different Company" }
);
assert.equal(wrongSubject.evidence, EVIDENCE.MISMATCHED);
assert.notEqual(wrongSubject.applicability, APPLICABILITY.APPLIES);
checks += 3;

// ── 4. The signature contradiction is caught, and bars approval ─────────────
const coherence = shipped.relationships.find((r) => r.id === "SIGNATURE_REQUIREMENT_COHERENT");
assert.ok(coherence, "the signature coherence relationship has left the matrix");
assert.equal(
  coherence.coverage, COVERAGE.CONTRADICTED,
  `the instrument tells the reader no signature is required and then presents a signature block, ` +
  `and the relationship reports ${coherence.coverage}. This is a library-to-rendering defect, ` +
  `not a legal-concept one, and it is pinned separately so that repairing either self-certifying ` +
  `assertion does not make it disappear.`
);
assert.equal(coherence.finding, FINDING.ESTABLISHED_NEGATIVE);
checks += 3;

// ── 5. Amendment is a different event from initial acceptance ───────────────
// Folded together they would let a document with no amendment route report a
// route provided. Removing the amendment clause must break exactly one of them.
{
  const acceptance = declared.find((r) => r.id === "ACCEPTANCE_ROUTE_PROVIDED");
  const amendment = declared.find((r) => r.id === "AMENDMENT_ROUTE_STATED");
  const overlap = (acceptance.satisfied_by?.any_of || [])
    .filter((id) => (amendment.satisfied_by?.any_of || []).includes(id));
  assert.deepEqual(
    overlap, [],
    `the acceptance and amendment requirements share satisfier(s) ${overlap.join(", ")}. ` +
    `Accepting the terms and becoming bound by a later revision are different events; one clause ` +
    `satisfying both lets a document with no amendment route report one provided.`
  );
  checks += 1;
}

// ── 6. No external evidence satisfies a document requirement ───────────────
// The two axes must not be able to substitute for one another in either
// direction: a clause cannot establish an act, and an attestation cannot write
// a clause into the instrument.
{
  const noGrievanceClause = shipped.ids.includes("PRIVACY_GRIEVANCE_OFFICER_001");
  assert.ok(noGrievanceClause, "the grievance clause is absent — this check needs it present");
  const result = shipped.of("GRIEVANCE_ROUTE_STATED");
  assert.equal(result.coverage, COVERAGE.RESOLVED);
  assert.ok(
    Array.isArray(result.satisfied_by) && result.satisfied_by.length,
    "a CONTENT requirement resolved without naming the clause that satisfied it. Satisfaction " +
    "must be traceable to text in the instrument, never to something outside it."
  );
  checks += 3;
}

console.log(
  `PASS  the document still asserts its own enforceability, the reader's understanding and the\n` +
  `      parties' free consent — and ${AUTHORED.length}/${AUTHORED.length} authored requirements resolve while none of the\n` +
  `      three out-of-scope propositions is authorable: no subject exists to bind them to\n` +
  `      the signature contradiction is CONTRADICTED and bars approval`
);
console.log(`\nALL GREEN (${checks} checks)`);
