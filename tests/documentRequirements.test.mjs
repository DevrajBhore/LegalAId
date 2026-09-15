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
import fs from "node:fs";
import path from "node:path";
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
// Empty again, and getting back here was the point of a correction.
//
// This briefly expected PERSONAL_DATA_HANDLED, after the requirement was moved
// from the POSITION source to the EVIDENCE source on the strength of a
// portfolio audit reporting that processes_personal_data had no source in the
// system. The audit was wrong: deriveGenerationControls takes
// (documentType, variables) and the script called it (variables, documentType),
// so nearly nothing came back derived. The flag is derived, here and in four
// other families, and the migration made every MSA report a requirement
// permanently undetermined for no reason. See tests/derivationProbes.
assert.deepStrictEqual(
  unmet.map((r) => r.id), [],
  `the generated MSA fails identity requirements that block: ${unmet.map((r) => r.id).join(", ")}`
);

// And without that answer, the same requirement must be reported as undetermined
// rather than quietly skipped. This is the MSA instance of the defect the
// employment registry exposed.
const unanswered = await generateDocument({
  document_type: "MASTER_SERVICE_AGREEMENT", variables, answers: {},
});
const dpdp = unanswered.requirements.results.find((r) => r.id === "PERSONAL_DATA_HANDLED");
assert.strictEqual(dpdp.coverage, COVERAGE.APPLICABILITY_UNKNOWN,
  "where nobody established whether personal data is processed, the DPDP requirement must be " +
  "reported as undetermined — not skipped as inapplicable");
assert.ok(dpdp.blocking, "an undetermined requirement keeps the escalation it was authored with");
// And answering DOES settle it, which is the behaviour the revert restored.
const answeredDpdp = generated.requirements.results.find((r) => r.id === "PERSONAL_DATA_HANDLED");
assert.notStrictEqual(
  answeredDpdp.coverage, dpdp.coverage,
  "answering the access question must change this requirement's coverage; if it does not, the " +
  "position has lost its source again"
);
checks += 3;
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
// THREE outcomes, not two. This assertion balanced only `applicable` and
// `not_applicable` and passed for as long as the fixture happened to leave
// nothing undetermined — so it was asserting the model's own central
// distinction did not occur, rather than that every requirement was disposed of.
// Moving one MSA requirement to the EVIDENCE source produced the first
// undetermined result in this fixture and the assertion failed, which is how it
// was found. "Nobody knows whether it applies" is a disposition and has to be
// counted like one.
assert.strictEqual(
  generated.requirements.summary.applicable
    + generated.requirements.summary.not_applicable
    + generated.requirements.summary.undetermined,
  generated.requirements.results.length,
  "a requirement was assessed as neither applicable, nor not applicable, nor undetermined"
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
// The defect the employment registry exposed. The requirement resting on the
// employer's headcount was being reported NOT_APPLICABLE where nobody was asked
// -- skipped rather than assessed, on exactly the reasoning invariant 3 forbids.
//
// The requirement is now POSH_INTERNAL_COMMITTEE_REFLECTED. POSH_DUTY_REFLECTED
// was split in two: it named a s.19 duty its own text called unconditional
// beside the s.4 committee duty the headcount governs, and gated both on the
// headcount. The threshold belongs to this half. See tests/authoringCoherence.
const unknownApplicability = assessRequirements("EMPLOYMENT_CONTRACT", [], {});
const posh = unknownApplicability.results.find((r) => r.id === "POSH_INTERNAL_COMMITTEE_REFLECTED");
assert.strictEqual(posh.coverage, COVERAGE.APPLICABILITY_UNKNOWN,
  "a requirement whose applicability rests on a fact nobody established must be reported as " +
  "undetermined, never as not applicable");
const known = assessRequirements("EMPLOYMENT_CONTRACT", [], {
  employer_headcount_ge_10: { value: false, provenance: "user_answer" },
});
assert.strictEqual(
  known.results.find((r) => r.id === "POSH_INTERNAL_COMMITTEE_REFLECTED").coverage,
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
// Was RESOLVED, and that was wrong. Proviso (b) runs thirty days from the
// drawer's RECEIPT of the memo; return_memo_date is the date the bank WROTE it,
// a different and usually earlier event. Computing from the proxy and reporting
// a positive finding told a payee the notice was in time on an assumption
// nobody stated — and on day twenty-nine a two-day postal delay is the case.
// return_memo_date is now declared as a proxy, and a proxy names its assumption
// and reports UNVERIFIABLE. See tests/timingAssessment.test.mjs.
assert.strictEqual(timed(inTime).coverage, COVERAGE.UNVERIFIABLE,
  "the memo's date is not the date it was received, and only the latter starts the clock");
assert.strictEqual(timed(inTime).computed_from_proxy, "return_memo_date");
const withTrigger = assessRequirements("CHEQUE_BOUNCE_NOTICE", NOTICE_CLAUSES, {},
  { memo_receipt_date: "2026-08-20", notice_date: "2026-08-25" });
assert.strictEqual(timed(withTrigger).coverage, COVERAGE.RESOLVED,
  "a notice given five days after RECEIPT of the memo is in time");
checks += 2;
const lateWithTrigger = assessRequirements("CHEQUE_BOUNCE_NOTICE", NOTICE_CLAUSES, {},
  { memo_receipt_date: "2026-07-20", notice_date: "2026-08-20" });
assert.strictEqual(lateByOne.results.find((r) => r.id === "NOTICE_GIVEN_IN_TIME").coverage,
  COVERAGE.UNVERIFIABLE, "still a proxy, however late the arithmetic looks");
assert.strictEqual(timed(lateWithTrigger).coverage, COVERAGE.OUT_OF_TIME,
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

// ── 8b. A DRAFTED OBLIGATION IS NOT A DISCHARGED ONE ───────────────────────
//
// The loan matrix produced six identical CONTENT findings across six different
// states of the world, and that is CORRECT rather than a defect. The clause
// LOAN_FEMA_ECB_001 says drawdown shall not occur until approvals are in place.
// The document contains that promise whether or not the Loan Registration Number
// was ever issued, so the content axis reports RESOLVED in every case — it is
// answering "does the instrument address this?", which has one answer.
//
// The danger is a future change that makes the requirement assessor "cleverer"
// and collapses the two truths, so that a document promising to wait for an
// approval reads as a document whose approval came through. This pins the
// divergence: for one requirement set, on one document, CONTENT must be able to
// say RESOLVED while the external axis says UNVERIFIABLE.
//
// Same shape as the tenancy: a clause providing for an act is not the act.
const APPROVAL_PROBE = path.join(
  path.dirname(new URL(import.meta.url).pathname), "..",
  "knowledge-base/documents/requirements/__divergence.requirements.json"
);
// A probe-only document type. Written under LOAN_AGREEMENT it REPLACED that
// family's authored requirements in the loader's map — last file wins — which
// stayed invisible until the Loan family actually had requirements to replace.
fs.writeFileSync(APPROVAL_PROBE, JSON.stringify({
  document_type: "__DIVERGENCE_PROBE",
  requirements: [
    { id: "APPROVALS_ADDRESSED", kind: "CONTENT",
      statement: "The approvals a cross-border loan depends on are addressed in the instrument.",
      identity_test: "Remove it and an ECB agreement says nothing about the registration its drawdown depends on.",
      applicability: { always: true }, satisfied_by: { any_of: ["LOAN_FEMA_ECB_001"] },
      when_unsatisfied: "ESCALATE", review_status: "regression-fixture" },
    { id: "APPROVAL_OBTAINED", kind: "EXTERNAL_COHERENCE",
      statement: "The registration the drawdown depends on has actually been issued.",
      identity_test: "Remove it and the agreement's own promise to wait is all that stands between the parties and an unregistered borrowing.",
      applicability: { always: true }, satisfied_by: { any_of: ["LOAN_FEMA_ECB_001"] },
      external_instrument: "loan registration record",
      external_provision: "loan_registration_number_issued",
      subject_binding: ["party_1_name"], requires: "ISSUED",
      when_unsatisfied: "ESCALATE", review_status: "regression-fixture" },
  ],
}));
try {
  loadDocumentRequirements({ refresh: true });
  const LOAN = ["LOAN_FEMA_ECB_001", "CORE_IDENTITY_001", "CORE_GOVERNING_LAW_001"];
  const who = { party_1_name: "Meridian Capital Advisors Private Limited" };
  const divergent = assessRequirements("__DIVERGENCE_PROBE", LOAN, {}, who, []);
  const addressed = divergent.results.find((r) => r.id === "APPROVALS_ADDRESSED");
  const obtained = divergent.results.find((r) => r.id === "APPROVAL_OBTAINED");

  assert.strictEqual(addressed.coverage, COVERAGE.RESOLVED,
    "the instrument contains the approval obligation, so the content axis is satisfied");
  assert.strictEqual(obtained.coverage, COVERAGE.UNVERIFIABLE,
    "nothing establishes that the approval was obtained, and the clause saying it must be " +
    "obtained is not evidence that it was");
  assert.notStrictEqual(addressed.coverage, obtained.coverage,
    "CONTENT and EXTERNAL_COHERENCE have collapsed into one answer. A document that promises " +
    "to wait for an approval now reads the same as one whose approval came through.");

  // And supplying the evidence moves ONLY the external axis.
  const issued = assessRequirements("__DIVERGENCE_PROBE", LOAN, {}, who, [{
    instrument: "loan registration record", subject: { party_1_name: who.party_1_name },
    provisions: { loan_registration_number_issued: "ISSUED" },
  }]);
  assert.strictEqual(
    issued.results.find((r) => r.id === "APPROVALS_ADDRESSED").coverage, addressed.coverage,
    "evidence about the world changed the content finding; the document did not change"
  );
  assert.strictEqual(issued.results.find((r) => r.id === "APPROVAL_OBTAINED").coverage,
    COVERAGE.RESOLVED);
  checks += 5;
} finally {
  fs.unlinkSync(APPROVAL_PROBE);
  loadDocumentRequirements({ refresh: true });
}
console.log("PASS  a drafted obligation and a discharged one stay different findings");

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
// Each of these families once produced a green report for a legally unfinished
// document. Every future change to this layer must survive all of them.
const CORPUS = {
  MASTER_SERVICE_AGREEMENT: "boilerplate masquerading as substance",
  EMPLOYMENT_CONTRACT: "unknown applicability masquerading as inapplicability",
  RENTAL_AGREEMENT: "a clause about an act masquerading as the act",
  CHEQUE_BOUNCE_NOTICE: "a stated period masquerading as a met deadline",
  MOU: "a declared character its own content defeats",
  SHAREHOLDERS_AGREEMENT: "absence of an external instrument as evidence of consistency with it",
  POWER_OF_ATTORNEY: "stale and self-contradictory evidence of a continuing state, as proof it holds now",
  // The only one of these whose defect is not about a requirement at all. Every
  // requirement was satisfied by a clause that was present and well drafted;
  // the two clauses disagreed with each other. See tests/requirementCoherence.
  NDA: "clauses each satisfying their own requirement while contradicting one another",
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

// ── 13. Truth that cannot be established from the document at all ──────────
// The sixth family, and the first whose legal effect turns on an instrument
// LegalAId has never seen. A shareholders' agreement is unenforceable against
// the company to the extent it conflicts with the articles of association.
// Every earlier falsification could in principle be settled by reading the
// artifact, the intake or a date. This one cannot.
//
// ABSENCE OF THE ARTICLES IS NOT EVIDENCE OF CONSISTENCY. That is the whole
// point, and the reason "nothing supplied" and "supplied and consistent" must
// never share an outcome.
const SHA_CLAUSES = [
  "CORP_SHARE_SUBSCRIPTION_001", "CORP_SHARE_TRANSFER_001", "CORP_TAG_ALONG_001",
  "CORP_DRAG_ALONG_001", "CORP_BOARD_COMPOSITION_001", "CORP_DEADLOCK_001",
];
const OURS = { company_cin: "U74999MH2015PTC123456" };
const articles = (cin, provision) => [{
  instrument: "ARTICLES_OF_ASSOCIATION",
  subject: { company_cin: cin },
  provisions: { share_transfer_restrictions: provision },
}];
const external = (instruments) => assessRequirements(
  "SHAREHOLDERS_AGREEMENT", SHA_CLAUSES, {}, OURS, instruments
).results.find((r) => r.id === "TRANSFER_RESTRICTIONS_IN_ARTICLES");

const STATES = [
  ["no articles supplied", [], COVERAGE.UNVERIFIABLE],
  ["articles of a different company", articles("U11111MH2019PTC999999", "RESTRICTED"),
    COVERAGE.EVIDENCE_MISMATCHED],
  ["matching and consistent", articles(OURS.company_cin, "RESTRICTED"), COVERAGE.RESOLVED],
  ["matching and conflicting", articles(OURS.company_cin, "FREELY_TRANSFERABLE"),
    COVERAGE.CONTRADICTED],
  ["matching and ambiguous", articles(OURS.company_cin, "AMBIGUOUS"), COVERAGE.AMBIGUOUS_EVIDENCE],
  ["matching and silent", articles(OURS.company_cin, "SILENT"), COVERAGE.AMBIGUOUS_EVIDENCE],
];
const seen = new Map();
for (const [label, instruments, expected] of STATES) {
  const result = external(instruments);
  assert.strictEqual(result.coverage, expected,
    `"${label}" reported ${result.coverage}, expected ${expected}`);
  assert.ok(String(result.detail || "").length > 40, `"${label}" must explain itself`);
  seen.set(label, result.coverage);
  checks += 2;
}
// Only one of the six is success, and the two "nothing known" cases must not
// resemble it.
const successes = [...seen.entries()].filter(([, c]) => findingFor(c) === FINDING.ESTABLISHED_POSITIVE);
assert.deepStrictEqual(successes.map(([l]) => l), ["matching and consistent"],
  "only articles that were supplied, match this company and say what the Agreement needs may " +
  "count as success");
assert.notStrictEqual(seen.get("no articles supplied"), seen.get("articles of a different company"),
  "a file existing is not evidence — supplying the wrong company's articles must be reported " +
  "differently from supplying none, because a careless reader treats a present file as a met " +
  "requirement");
checks += 2;
console.log(
  `PASS  external coherence: ${new Set(seen.values()).size} distinct outcomes across ` +
  `${STATES.length} evidence states, one of them success`
);

// The pattern is reusable, not SHA logic: nothing in the assessor names a
// shareholders' agreement, articles, or the Companies Act.
const source = fs.readFileSync(
  path.resolve("backend/services/documentRequirements.js"), "utf8"
);
for (const term of ["SHAREHOLDERS", "ARTICLES_OF_ASSOCIATION", "Companies Act", "share_transfer"]) {
  assert.ok(!source.includes(term),
    `the assessor mentions "${term}". External-instrument dependency must be a reusable ` +
    `requirement pattern — trust deeds, board resolutions, partnership deeds and powers of ` +
    `attorney pose the same question — not bespoke logic for one family.`);
  checks += 1;
}
console.log("PASS  the pattern names no document family, instrument or statute");

// ── 14. A continuing state must be evidenced as at a moment ────────────────
// The seventh family, and the matrix was written BEFORE the requirements so the
// architecture could not be quietly designed around what happens to pass.
//
// A power of attorney depends on a state of the world HOLDING NOW: section 201
// of the Indian Contract Act, 1872 ends the agency on the donor's death or
// unsoundness of mind, so a flawless instrument is a dead letter the moment it
// happens and not a word of the document changes. Two of the five cases were
// reported as success — evidence from 2019, and two records flatly disagreeing,
// the latter resolved by whichever arrived first.
const POA_CLAUSES = [
  "POA_APPOINTMENT_001", "POA_POWERS_001", "POA_LIMITATIONS_001",
  "POA_REVOCATION_001", "POA_EXECUTION_001",
];
const DONOR = { donor_identity_number: "4213 8867 1290" };
const today = new Date().toISOString().slice(0, 10);
const status = (capacity, asOf, who = DONOR.donor_identity_number) => ({
  instrument: "DONOR_STATUS_EVIDENCE",
  subject: { donor_identity_number: who },
  as_of: asOf,
  provisions: { donor_capacity: capacity },
});
const capacity = (instruments) => assessRequirements(
  "POWER_OF_ATTORNEY", POA_CLAUSES, {}, DONOR, instruments
).results.find((r) => r.id === "DONOR_CAPACITY_SUBSISTS");

const MATRIX = [
  ["not supplied", [], COVERAGE.UNVERIFIABLE],
  ["condition ceased", [status("CEASED", today)], COVERAGE.CONTRADICTED],
  ["condition subsists, evidenced today", [status("SUBSISTS", today)], COVERAGE.RESOLVED],
  ["subsists, but evidenced in 2019", [status("SUBSISTS", "2019-04-02")], COVERAGE.STALE_EVIDENCE],
  ["subsists, undated", [status("SUBSISTS", undefined)], COVERAGE.STALE_EVIDENCE],
  ["records disagree", [status("SUBSISTS", today), status("CEASED", today)],
    COVERAGE.CONFLICTING_EVIDENCE],
  ["about a different donor", [status("SUBSISTS", today, "9999 0000 1111")],
    COVERAGE.EVIDENCE_MISMATCHED],
];
for (const [label, instruments, expected] of MATRIX) {
  const result = capacity(instruments);
  assert.strictEqual(result.coverage, expected, `"${label}" reported ${result.coverage}`);
  checks += 1;
}
// Order must not decide a legal question.
const oneWay = capacity([status("SUBSISTS", today), status("CEASED", today)]);
const theOther = capacity([status("CEASED", today), status("SUBSISTS", today)]);
assert.strictEqual(oneWay.coverage, theOther.coverage,
  "reversing the order of two conflicting records changed the finding, so the assessment is " +
  "deciding a legal question by array order");
assert.strictEqual(findingFor(oneWay.coverage), FINDING.NOT_ESTABLISHED,
  "conflicting evidence establishes nothing; which record is right is a question for a person");
checks += 2;

// Exactly one of the seven is success.
const positives = MATRIX.filter(([, , expected]) => findingFor(expected) === FINDING.ESTABLISHED_POSITIVE);
assert.strictEqual(positives.length, 1,
  `${positives.length} of the seven evidence states count as success`);
checks += 1;
console.log(
  `PASS  continuing state: ${new Set(MATRIX.map(([, , e]) => e)).size} distinct outcomes across ` +
  `${MATRIX.length} evidence states, one success, order-independent`
);

// Still no family-specific logic: the temporal window is authored knowledge.
for (const term of ["POWER_OF_ATTORNEY", "donor", "Contract Act"]) {
  assert.ok(!source.includes(term),
    `the assessor mentions "${term}" — continuing-state evidence must stay a reusable pattern, ` +
    `usable for licence validity, corporate status, insurance cover and board authority alike`);
  checks += 1;
}
console.log("PASS  the temporal and conflict rules name no family, party or statute");

console.log(`\nALL GREEN (${checks} checks)`);
