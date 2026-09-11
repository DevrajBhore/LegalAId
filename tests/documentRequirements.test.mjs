/**
 * documentRequirements.test.mjs
 *
 * DOCUMENT-SPECIFIC SUBSTANCE CANNOT BE SATISFIED BY GENERIC NOMENCLATURE.
 *
 * A draft can carry definitions, interpretation, notices, confidentiality,
 * representations, a generic indemnity, governing law, dispute resolution,
 * boilerplate and signatures -- and still be a bad document, because the
 * provisions that define the transaction are missing or weak. This is what a
 * seventeen-heading review of the Master Service Agreement exposed: the engine
 * was good at legally plausible infrastructure and unreliable at the clauses
 * that make a particular document what it is.
 *
 * So identity is measured on its own, and never inferred from clause count.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import {
  assessRequirements, loadDocumentRequirements, COVERAGE, FINDING, findingFor,
} from "../backend/services/documentRequirements.js";

let checks = 0;
const requirements = loadDocumentRequirements({ refresh: true });

// ── 1. Every requirement says what is lost without it ───────────────────────
for (const [documentType, list] of requirements) {
  assert.ok(list.length >= 5, `${documentType} declares only ${list.length} identity requirements`);
  for (const requirement of list) {
    assert.ok(/^remove/i.test(requirement.identity_test || ""),
      `${documentType}/${requirement.id}: identity_test must begin "Remove it and ...". ` +
      `A provision whose absence changes nothing is infrastructure, not identity.`);
    checks += 1;
  }
}
console.log(`PASS  ${[...requirements.values()].flat().length} requirements each state what is lost without them`);

// ── 2. Boilerplate cannot satisfy identity ──────────────────────────────────
// The heart of it. A draft made entirely of well-drafted general provisions must
// fail the identity assessment, however respectable it looks.
const BOILERPLATE_ONLY = [
  "CORE_IDENTITY_001", "CORE_PURPOSE_001", "CORE_DEFINITIONS_001", "CORE_INTERPRETATION_001",
  "CORE_NOTICE_001", "CORE_CONFIDENTIALITY_001", "CORE_REPRESENTATIONS_001",
  "CORE_INDEMNITY_001", "CORE_GOVERNING_LAW_001", "CORE_DISPUTE_RESOLUTION_001",
  "CORE_SEVERABILITY_001", "CORE_WAIVER_001", "CORE_AMENDMENT_001", "CORE_ASSIGNMENT_001",
  "CORE_FORCE_MAJEURE_001", "CORE_ENTIRE_AGREEMENT_001", "CORE_COUNTERPARTS_001",
  "CORE_SURVIVAL_001", "CORE_FURTHER_ASSURANCE_001", "CORE_SIGNATURE_BLOCK_001",
];
const facade = assessRequirements("MASTER_SERVICE_AGREEMENT", BOILERPLATE_ONLY, {});
const blocking = facade.results.filter((r) => r.blocking);
assert.ok(blocking.length >= 4,
  `a document of ${BOILERPLATE_ONLY.length} pure boilerplate clauses failed only ` +
  `${blocking.length} blocking requirements. Twenty general provisions are not a Master ` +
  `Service Agreement, and the assessment must say so.`);
assert.ok(facade.summary.resolved < facade.summary.applicable,
  "boilerplate alone must not satisfy the identity requirements");
checks += 2;
console.log(
  `PASS  ${BOILERPLATE_ONLY.length} boilerplate clauses satisfy only ` +
  `${facade.summary.resolved} of ${facade.summary.applicable} identity requirements ` +
  `(${blocking.length} of the failures are blocking)`
);

// ── 3. A real MSA satisfies its identity, and says so on the result ─────────
const BASE = {
  party_1_name: "Ashwin Traders Private Limited", party_1_type: "Private Limited Company",
  party_2_name: "Kesari Systems LLP", party_2_type: "LLP",
  services_description: "Application support and managed operations across statements of work.",
  payment_terms: "Charges per Statement of Work, net 30 days.", contract_duration: "36 months",
  effective_date: "2026-09-01", operating_state: "Maharashtra", execution_city: "Pune",
  audit_rights: "Client may audit service records once per quarter on five business days' notice.",
};
let generated, variables = { ...BASE };
for (let attempt = 0; attempt < 20; attempt += 1) {
  generated = await generateDocument({
    document_type: "MASTER_SERVICE_AGREEMENT", variables,
    answers: {
      WORK_PRODUCT_CREATED: "Yes",
      THIRD_PARTY_EXPOSURE: "Yes, that is a real possibility",
      // Answered so the DPDP requirement's applicability is DETERMINED. Without
      // it PERSONAL_DATA_HANDLED comes back undetermined and blocking, which is
      // the correct report and a legitimate reason not to call the document
      // complete -- see the check below.
      ACCESS: ["Commercially sensitive information — pricing, strategy, client lists, methods"],
    },
  });
  if (generated?.draft) break;
  const missing = String(generated?.error || "").match(/Missing required field: (\w+)/);
  if (!missing) break;
  variables[missing[1]] = /fee|amount|value/.test(missing[1]) ? "500000" : "Stated in this Agreement.";
}
assert.ok(generated?.draft, "the MSA fixture must generate");
assert.ok(generated.requirements?.assessed,
  "a generated document must report whether it does what its kind of document has to do");
const unmet = generated.requirements.results.filter(
  (r) => r.blocking && r.coverage !== COVERAGE.NOT_APPLICABLE
);
assert.deepStrictEqual(unmet.map((r) => r.id), [],
  `the generated MSA fails identity requirements that block: ${unmet.map((r) => r.id).join(", ")}`);

// And without that answer, the same requirement must be reported as undetermined
// rather than quietly skipped. This is the MSA instance of the defect the
// employment registry exposed.
const unanswered = await generateDocument({
  document_type: "MASTER_SERVICE_AGREEMENT", variables, answers: {},
});
const dpdp = unanswered.requirements.results.find((r) => r.id === "PERSONAL_DATA_HANDLED");
assert.strictEqual(dpdp.coverage, COVERAGE.APPLICABILITY_UNKNOWN,
  "where nobody said whether personal data is processed, the DPDP requirement must be " +
  "reported as undetermined — not skipped as inapplicable");
assert.ok(dpdp.blocking, "an undetermined requirement keeps the escalation it was authored with");
checks += 2;
assert.ok(generated.requirements.summary.applicable >= 10,
  "too few requirements were assessed for the result to mean anything");
checks += 4;
console.log(
  `PASS  generated MSA: ${generated.requirements.summary.resolved} of ` +
  `${generated.requirements.summary.applicable} identity requirements met, ` +
  `${generated.requirements.summary.unresolved} open, ` +
  `${generated.requirements.summary.not_applicable} not applicable`
);

// ── 4. Conservation: no requirement falls off the edge ──────────────────────
const VALID = new Set(Object.values(COVERAGE));
for (const result of generated.requirements.results) {
  assert.ok(VALID.has(result.coverage),
    `${result.id} has coverage "${result.coverage}", which is not one of the five`);
  checks += 1;
}
assert.strictEqual(
  generated.requirements.summary.applicable + generated.requirements.summary.not_applicable,
  generated.requirements.results.length,
  "a requirement was assessed as neither applicable nor not applicable"
);
checks += 1;
console.log("PASS  every requirement terminates in a stated coverage");

// ── 5. The model survives outside the family it was designed for ───────────
// The MSA's identity comes from commercial architecture; the employment
// contract's comes largely from statute. If Requirement -> Treatment -> Clause
// only works where the parties freely design the bargain, this is an MSA
// implementation rather than an architecture.
const employment = loadDocumentRequirements().get("EMPLOYMENT_CONTRACT");
assert.ok(employment && employment.length >= 10,
  "the employment contract must have its own identity requirements");
const statutory = employment.filter((r) =>
  /Code on Wages|POSH Act|Copyright Act|Maternity Benefit|Provident Fund|Industrial Relations Code/.test(
    r.identity_test || ""
  )
);
assert.ok(statutory.length >= 5,
  `only ${statutory.length} employment requirements name the statute whose operation makes ` +
  `them identity-defining. A statute-driven document whose requirements read like commercial ` +
  `preferences has not been modelled, only listed.`);
checks += 2;

// ── 6. Silence about applicability is not an answer that it does not apply ──
// The defect the employment registry exposed. POSH_DUTY_REFLECTED rests on the
// employer's headcount; where nobody was asked, the requirement was being
// reported NOT_APPLICABLE -- skipped rather than assessed, on exactly the
// reasoning invariant 3 forbids.
const unknownApplicability = assessRequirements("EMPLOYMENT_CONTRACT", [], {});
const posh = unknownApplicability.results.find((r) => r.id === "POSH_DUTY_REFLECTED");
assert.strictEqual(posh.coverage, COVERAGE.APPLICABILITY_UNKNOWN,
  "a requirement whose applicability rests on a fact nobody established must be reported as " +
  "undetermined, never as not applicable");
const known = assessRequirements("EMPLOYMENT_CONTRACT", [], {
  employer_headcount_ge_10: { value: false, provenance: "user_answer" },
});
assert.strictEqual(
  known.results.find((r) => r.id === "POSH_DUTY_REFLECTED").coverage,
  COVERAGE.NOT_APPLICABLE,
  "an employer who answered that it has fewer than ten employees HAS determined applicability"
);
checks += 2;
console.log(
  `PASS  the model holds for a statute-driven family (${employment.length} requirements, ` +
  `${statutory.length} statutory); unknown applicability is distinguished from not applicable`
);

// ── 7. A formality is never reported as done ───────────────────────────────
// The third family, chosen because its identity comes from a third place again:
// partly from FORMALITY. A tenancy can say everything correctly and still be
// legally ineffective because of an act performed, or not performed, outside it.
const tenancy = assessRequirements(
  "RENTAL_AGREEMENT",
  ["RENTAL_PROPERTY_DESCRIPTION_001", "RENTAL_RENT_PAYMENT_001", "RENTAL_TERM_001",
   "RENTAL_SECURITY_DEPOSIT_001", "RENTAL_TERMINATION_001", "PROP_REGISTRATION_001"],
  {}
);
for (const id of ["INSTRUMENT_IS_STAMPED", "INSTRUMENT_IS_REGISTERED"]) {
  const result = tenancy.results.find((r) => r.id === id);
  assert.strictEqual(result.coverage, COVERAGE.PROVIDED_FOR,
    `${id} reports "${result.coverage}" with the clause present. A clause reading "the parties ` +
    `shall register this Agreement" does not make the instrument registered, and RESOLVED would ` +
    `tell a user their lease is complete when section 49 of the Registration Act, 1908 bars it ` +
    `from being received in evidence.`);
  assert.ok(String(result.outside_the_document || "").trim(),
    `${id} must say what act lies outside the document`);
  checks += 2;
}
assert.ok(!("provided_for" in tenancy.summary) || tenancy.summary.provided_for === 2,
  "formalities must be counted apart from resolved requirements");
assert.strictEqual(tenancy.summary.resolved, 4,
  `formalities have been folded into the resolved count (${tenancy.summary.resolved}), which ` +
  `restores the conflation PROVIDED_FOR exists to prevent`);
checks += 2;

// Three sources of document identity, one model.
const families = [...loadDocumentRequirements().keys()].sort();
assert.ok(families.length >= 3,
  `the model has been tested against ${families.length} families. It was designed against a ` +
  `document whose identity is commercial; it is only an architecture if it survives one whose ` +
  `identity is statutory and one whose identity is formal.`);
checks += 1;
console.log(
  `PASS  formalities report PROVIDED_FOR, never RESOLVED; model holds across ` +
  `${families.length} families (${families.join(", ")})`
);

// ── 8. Falsification: a green report for a legally dead notice ─────────────
// The fourth family was chosen to BREAK the model, not to confirm it. A notice
// under section 138 of the Negotiable Instruments Act, 1881 has almost none of
// its legal effect in the words: thirty days from the bank's memo to give it,
// fifteen for the drawer to pay, a month to complain. Authored as CONTENT
// requirements the model reported 7 of 7 RESOLVED for a notice it had no idea
// when was sent. That is the false green TIMING exists to prevent.
const NOTICE_CLAUSES = [
  "NOTICE_ADDRESSEE_001", "S138_SUBJECT_001", "NOTICE_INSTRUCTIONS_001",
  "S138_CHEQUE_PARTICULARS_001", "S138_DISHONOUR_001", "S138_STATUTORY_DEMAND_001",
  "S138_PAYMENT_PERIOD_001", "S138_CONSEQUENCE_001", "NOTICE_RESERVATION_001",
  "CORE_SIGNATURE_BLOCK_001",
];
const inTime = assessRequirements("CHEQUE_BOUNCE_NOTICE", NOTICE_CLAUSES, {},
  { return_memo_date: "2026-08-20", notice_date: "2026-08-25" });
const lateByOne = assessRequirements("CHEQUE_BOUNCE_NOTICE", NOTICE_CLAUSES, {},
  { return_memo_date: "2026-07-20", notice_date: "2026-08-20" });
const noDates = assessRequirements("CHEQUE_BOUNCE_NOTICE", NOTICE_CLAUSES, {}, {});

const timed = (a) => a.results.find((r) => r.id === "NOTICE_GIVEN_IN_TIME");
assert.strictEqual(timed(inTime).coverage, COVERAGE.RESOLVED,
  "a notice given five days after the memo is in time");
assert.strictEqual(timed(lateByOne).coverage, COVERAGE.OUT_OF_TIME,
  "a notice given on day thirty-one must fail. Proviso (b) to section 138 cannot be extended " +
  "by anything the notice says, and every other requirement being met is precisely why this " +
  "one has to be reported separately.");
assert.strictEqual(timed(noDates).coverage, COVERAGE.UNVERIFIABLE,
  "where the dates are unknown the system must say it cannot tell — not that the notice is in time");
checks += 3;

// The complaint has not been filed and cannot be checked. UNVERIFIABLE is the
// honest answer and must never drift to RESOLVED.
assert.strictEqual(
  inTime.results.find((r) => r.id === "COMPLAINT_FILED_IN_TIME").coverage,
  COVERAGE.UNVERIFIABLE,
  "a future act the system cannot observe must not be reported as satisfied"
);
checks += 1;

// ── 9. No coverage state may be counted as success but RESOLVED/DEFAULTED ──
// PROVIDED_FOR, UNVERIFIABLE and OUT_OF_TIME must never be folded into a
// "n of n satisfied" summary. That number is what a user reads.
for (const [label, assessment] of Object.entries({ inTime, lateByOne, noDates, tenancy })) {
  const { summary, results } = assessment;
  const trulyResolved = results.filter(
    (r) => r.coverage === COVERAGE.RESOLVED || r.coverage === COVERAGE.DEFAULTED
  ).length;
  assert.strictEqual(summary.resolved, trulyResolved,
    `${label}: the resolved count (${summary.resolved}) includes states that are not ` +
    `satisfaction. "Provided for", "unverifiable" and "out of time" are not successes, and a ` +
    `summary that says otherwise is the most dangerous output this system can produce.`);
  checks += 1;
}
console.log(
  "PASS  timing is computed where it can be, reported unverifiable where it cannot, " +
  "and never counted as satisfaction"
);

// ── 10. A document cannot assert a legal character its content defeats ─────
// The fifth falsification, aimed at a boundary the first four never touched.
// Those were all about the world OUTSIDE the document. This one is internal: an
// MOU declaring itself non-binding while carrying dispute resolution, survival,
// governing law and termination is not incomplete, it is incoherent — and Indian
// courts gather intention from the whole instrument, not the label on it.
//
// It also breaks an assumption the model held silently until now: satisfaction
// was MONOTONE in clause presence. Adding a clause could only ever help. Here
// adding one defeats the requirement.
const MOU_AS_GENERATED = [
  "CORE_IDENTITY_001", "CORE_PURPOSE_001", "MOU_NON_BINDING_001", "CORE_CONFIDENTIALITY_001",
  "CORE_TERM_001", "CORE_SURVIVAL_001", "CORE_TERMINATION_001",
  "CORE_DISPUTE_RESOLUTION_001", "CORE_GOVERNING_LAW_001",
];
const incoherent = assessRequirements("MOU", MOU_AS_GENERATED, {}, {});
const character = incoherent.results.find((r) => r.id === "NON_BINDING_CHARACTER");
assert.strictEqual(character.coverage, COVERAGE.CONTRADICTED,
  "an MOU that declares itself non-binding while carrying the machinery of a binding contract " +
  "must not report its non-binding character as satisfied merely because the declaring clause " +
  "is present");
assert.ok(character.contradicted_by.length >= 3, "the defeating clauses must be named");
assert.strictEqual(findingFor(character.coverage), FINDING.ESTABLISHED_NEGATIVE,
  "a contradiction is a determined negative, not incomplete work");

// Remove the machinery and the same declaration stands.
const coherent = assessRequirements("MOU",
  ["CORE_IDENTITY_001", "CORE_PURPOSE_001", "MOU_NON_BINDING_001", "CORE_CONFIDENTIALITY_001", "CORE_TERM_001"],
  {}, {});
assert.strictEqual(
  coherent.results.find((r) => r.id === "NON_BINDING_CHARACTER").coverage, COVERAGE.RESOLVED,
  "without the contradicting clauses the declaration is sound — confidentiality alone must not " +
  "defeat it, or every workable MOU becomes incoherent"
);
checks += 4;
console.log("PASS  a declared legal character is defeated by content that contradicts it");

// ── 11. Two dimensions, kept apart ─────────────────────────────────────────
// KIND says what sort of thing is evaluated; FINDING says what was established.
// Collapsing them is how a status vocabulary silts up with special cases.
for (const assessment of [incoherent, inTime, lateByOne, tenancy]) {
  for (const result of assessment.results) {
    assert.ok(["CONTENT", "FORMALITY", "TIMING", "CHARACTER"].includes(result.kind),
      `${result.id} has no kind`);
    assert.ok(Object.values(FINDING).includes(result.finding),
      `${result.id} coverage "${result.coverage}" maps to no finding`);
    // The rule the whole vocabulary rests on.
    const isSuccess = result.finding === FINDING.ESTABLISHED_POSITIVE;
    const countsAsResolved = result.coverage === COVERAGE.RESOLVED || result.coverage === COVERAGE.DEFAULTED;
    assert.strictEqual(isSuccess, countsAsResolved,
      `${result.id}: "${result.coverage}" and its finding disagree about whether it is success`);
    checks += 3;
  }
}
console.log("PASS  kind and finding are separate, and only ESTABLISHED_POSITIVE is success");

// ── 12. The semantic regression corpus ─────────────────────────────────────
// Five families, each of which once produced a green report for a legally
// unfinished document. Every future change to this layer must survive all five.
const CORPUS = {
  MASTER_SERVICE_AGREEMENT: "boilerplate masquerading as substance",
  EMPLOYMENT_CONTRACT: "unknown applicability masquerading as inapplicability",
  RENTAL_AGREEMENT: "a clause about an act masquerading as the act",
  CHEQUE_BOUNCE_NOTICE: "a stated period masquerading as a met deadline",
  MOU: "a declared character its own content defeats",
};
const registered = loadDocumentRequirements();
for (const [documentType, falseGreen] of Object.entries(CORPUS)) {
  assert.ok(registered.has(documentType),
    `${documentType} has left the semantic regression corpus. It is there because it once ` +
    `reported green for a legally unfinished document — ${falseGreen} — and removing it removes ` +
    `the evidence that the defect is fixed.`);
  checks += 1;
}
console.log(`PASS  semantic regression corpus intact (${Object.keys(CORPUS).length} families)`);

console.log(`\nALL GREEN (${checks} checks)`);
