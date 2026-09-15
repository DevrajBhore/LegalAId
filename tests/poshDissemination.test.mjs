/**
 * poshDissemination.test.mjs — PHASE D2.4
 *
 *     "The policy says it was disseminated"  !=  "the system has evidence it was"
 *
 * Section 19(a) of the Sexual Harassment of Women at Workplace (Prevention,
 * Prohibition and Redressal) Act, 2013 makes the employer's duty to formulate
 * AND widely disseminate. Every external act the system had modelled before this
 * one is performed before an AUTHORITY that keeps a record — registration,
 * stamping, a company's articles. There is no registrar of dissemination: the
 * act is performed on a workplace, toward a workforce, and the only people who
 * can speak to it are the employer, who has an interest, and the employees, whom
 * the system never meets.
 *
 * THE RESULT: the existing evidence machinery carries it unchanged. No new
 * primitive, no extension — the third abstraction this family made a case for
 * and then failed to justify.
 *
 * THE DANGEROUS PATH, and the reason this file exists: the generated policy
 * CONTAINS sentences asserting display. POSH_POLICY_ADOPTION_001 and
 * POSH_CONSEQUENCES_REPORTING_001 both say so. If clause text could establish
 * the proposition, every generated policy would certify its own compliance with
 * section 19 — the document asserting the act it was supposed to evidence.
 */
import assert from "node:assert";
import { establish, EVIDENCE, APPLICABILITY } from "../backend/services/evidencePropositions.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { COVERAGE, FINDING } from "../backend/services/documentRequirements.js";

let checks = 0;
const PROPOSITION = "posh_policy_disseminated";
const variables = variablesFor("POSH_POLICY", { profile: FIXTURE_PROFILE.WELL_FILLED });
const SUBJECT = { company_name: variables.company_name };
const today = new Date().toISOString().slice(0, 10);
const record = (provenance, state, extra = {}) => ({
  proposition: PROPOSITION, provenance, state: String(state), subject: SUBJECT, as_of: today, ...extra,
});
const state = (records) => establish(PROPOSITION, records, SUBJECT);

// ── The policy does assert it, in its own words ──────────────────────────────
const result = await generateDocument({ document_type: "POSH_POLICY", variables });
const text = (result.draft?.clauses || []).map((c) => c.text || "").join("\n");
assert.match(
  text, /display(ed)? at a conspicuous place/i,
  "the policy no longer asserts display. If that sentence was removed, this file's premise is " +
  "gone and the self-certification risk with it — rewrite rather than delete."
);
checks += 1;

// ── AND THAT ASSERTION ESTABLISHES NOTHING ───────────────────────────────────
for (const provenance of ["clause_text", "ai_inference", "document_text", "llm"]) {
  const outcome = state([record(provenance, true)]);
  assert.notEqual(
    outcome.evidence, EVIDENCE.PRESENT,
    `"${provenance}" established that the policy was disseminated. A document saying an act was ` +
    `done is not evidence that it was, and a policy that certifies its own section 19 compliance ` +
    `is worth less than one that admits it does not know.`
  );
  assert.notEqual(outcome.applicability, APPLICABILITY.APPLIES);
}
checks += 4;

// ── The states the requirement must tell apart ───────────────────────────────
const cases = [
  ["nothing supplied", [], EVIDENCE.ABSENT, APPLICABILITY.ESCALATED],
  ["the employer says they displayed it", [record("operator_declaration", true)], EVIDENCE.PRESENT, APPLICABILITY.APPLIES],
  // A stated negative is a POSITION, not silence — the rule the loan family
  // established, holding here on a different layer.
  ["the employer says they did NOT", [record("operator_declaration", false)], EVIDENCE.PRESENT, APPLICABILITY.DOES_NOT_APPLY],
  ["attested by a third party", [record("third_party_attestation", true)], EVIDENCE.PRESENT, APPLICABILITY.APPLIES],
  ["attested two years ago", [record("third_party_attestation", true, { as_of: "2023-09-01" })], EVIDENCE.STALE, APPLICABILITY.ESCALATED],
  ["two records that disagree", [record("operator_declaration", true), record("third_party_attestation", false)], EVIDENCE.CONFLICTING, APPLICABILITY.ESCALATED],
  ["about a different company", [record("operator_declaration", true, { subject: { company_name: "Someone Else Pvt Ltd" } })], EVIDENCE.MISMATCHED, APPLICABILITY.ESCALATED],
];
const seen = new Set();
for (const [label, records, evidence, applicability] of cases) {
  const outcome = state(records);
  assert.equal(outcome.evidence, evidence, `${label}: evidence read ${outcome.evidence}`);
  assert.equal(outcome.applicability, applicability, `${label}: applicability read ${outcome.applicability}`);
  seen.add(outcome.evidence);
}
assert.ok(
  seen.size >= 5,
  `only ${seen.size} distinct evidence states reached. If the machinery collapses these into ` +
  `two, the dissemination question is not being carried and a new mechanism IS needed — which ` +
  `is the finding this probe exists to make or refute.`
);
checks += cases.length * 2 + 1;

// ── The two paths stay apart ─────────────────────────────────────────────────
// POLICY_DISSEMINATED is a FORMALITY satisfied_by clause ids, so the clause path
// can take it to PROVIDED_FOR. That is right, and it is NOT the evidence path:
// PROVIDED_FOR means the policy provides for the act, never that it happened.
const assessed = result.requirements.results.find((r) => r.id === "POLICY_DISSEMINATED");
assert.equal(
  assessed.coverage, COVERAGE.PROVIDED_FOR,
  `the dissemination requirement reports ${assessed.coverage} on a policy nobody has shown was ` +
  `displayed. RESOLVED here would be the clause text certifying the act.`
);
assert.equal(
  assessed.finding, FINDING.CEILING_FOR_KIND,
  "PROVIDED_FOR is being reported as a success finding. It is the ceiling for a formality, and " +
  "the finding axis is what keeps it from reading as one."
);
checks += 2;

console.log(
  `PASS  ${cases.length} dissemination states told apart by the existing machinery, unextended\n` +
  `      the policy's own words establish nothing; the requirement stops at PROVIDED_FOR`
);
console.log(`\nALL GREEN (${checks} checks)`);
