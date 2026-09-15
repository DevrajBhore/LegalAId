/**
 * evidencePropositions.test.mjs
 *
 * EVIDENCE ABSENT != EVIDENCE FALSE != REQUIREMENT INAPPLICABLE.
 *
 * Three distinctions that were one thing before this layer existed. The
 * portfolio audit across 45 families found 29 propositions the knowledge base
 * already treats as legally consequential enough to gate a clause, with nothing
 * in the system able to establish any of them — and every one of those gates
 * reads `== true`, so an unestablished proposition omitted its clause SILENTLY.
 * A service that processes personal data and a service that does not received
 * the same document.
 *
 * The acceptance corpus below is those real propositions, not a synthetic
 * family. Each declared proposition must demonstrate all four:
 *
 *     positive   evidence establishes X       -> APPLIES
 *     negative   evidence establishes not-X   -> DOES_NOT_APPLY
 *     absent     nothing establishes X        -> UNKNOWN/ESCALATED, never false
 *     mismatched evidence is about someone else -> EVIDENCE_MISMATCHED
 *
 * The fourth is not decoration. The shareholders' agreement work established
 * that a record existing is not evidence: the articles of a different company
 * satisfied a requirement about this one. Subject binding is what stops it, and
 * a proposition without it would let evidence about any party establish the
 * proposition about every party.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  establish, resolveEvidence, loadPropositions, clearPropositionCache,
  EVIDENCE, APPLICABILITY, NEVER_ADMISSIBLE,
} from "../backend/services/evidencePropositions.js";
import { assessRequirements, loadDocumentRequirements, COVERAGE, FINDING }
  from "../backend/services/documentRequirements.js";

let checks = 0;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const declared = loadPropositions({ refresh: true });
assert.ok(declared.size > 0, "no propositions are declared");

// ── 1. THE ACCEPTANCE CORPUS: four cases for every declared proposition ─────
//
// Driven off the declarations themselves rather than a hand-written list, so a
// proposition added tomorrow is tested tomorrow without anyone remembering to.
const SUBJECT_VALUE = "Acme Technologies Private Limited";
const OTHER_VALUE = "Sundry Holdings Private Limited";

for (const [id, declaration] of declared) {
  const variables = Object.fromEntries(
    declaration.subject_binding.map((field) => [field, SUBJECT_VALUE])
  );
  const onSubject = Object.fromEntries(
    declaration.subject_binding.map((field) => [field, SUBJECT_VALUE])
  );
  const elsewhere = Object.fromEntries(
    declaration.subject_binding.map((field) => [field, OTHER_VALUE])
  );
  const provenance = declaration.admissible_provenance[0];
  const record = (state, subject) => [{
    proposition: id, subject, state, provenance,
    authority: "acceptance corpus", as_of: new Date().toISOString().slice(0, 10),
  }];

  // positive
  const yes = establish(id, record("TRUE", onSubject), variables);
  assert.equal(yes.evidence, EVIDENCE.PRESENT, `${id}: positive evidence not admitted`);
  assert.equal(yes.applicability, APPLICABILITY.APPLIES);
  assert.equal(yes.value, true);

  // negative — and this is a REAL finding, not a gap
  const no = establish(id, record("FALSE", onSubject), variables);
  assert.equal(no.evidence, EVIDENCE.PRESENT, `${id}: negative evidence is still evidence`);
  assert.equal(no.applicability, APPLICABILITY.DOES_NOT_APPLY);
  assert.equal(no.value, false);

  // absent — the case the whole layer exists for
  const nothing = establish(id, [], variables);
  assert.equal(nothing.evidence, EVIDENCE.ABSENT);
  assert.notEqual(
    nothing.applicability, APPLICABILITY.DOES_NOT_APPLY,
    `${id}: nothing was supplied and the system concluded the proposition is FALSE. That is the ` +
    `defect this layer exists to make impossible.`
  );
  assert.ok([APPLICABILITY.UNKNOWN, APPLICABILITY.ESCALATED].includes(nothing.applicability));
  assert.equal(nothing.value, undefined, `${id}: an unestablished proposition must carry no value`);

  // wrong subject
  const theirs = establish(id, record("TRUE", elsewhere), variables);
  assert.equal(
    theirs.evidence, EVIDENCE.MISMATCHED,
    `${id}: evidence about ${OTHER_VALUE} established the proposition about ${SUBJECT_VALUE}`
  );
  assert.equal(theirs.value, undefined);
  assert.notEqual(theirs.applicability, APPLICABILITY.APPLIES);

  checks += 12;
}
console.log(
  `PASS  acceptance corpus: ${declared.size} real propositions x 4 evidence cases, ` +
  `all four distinguished`
);

// ── 2. The prohibition: an inference is a proposal, never an authority ──────
//
// Without this the layer would move the defect rather than fix it: "no evidence"
// becomes "the model guessed", which reports better and is worse.
const [firstId, first] = [...declared][0];
const variables = Object.fromEntries(first.subject_binding.map((f) => [f, SUBJECT_VALUE]));
const subject = Object.fromEntries(first.subject_binding.map((f) => [f, SUBJECT_VALUE]));
for (const forbidden of NEVER_ADMISSIBLE) {
  const guessed = establish(firstId, [{
    proposition: firstId, subject, state: "TRUE", provenance: forbidden,
    authority: "a model", as_of: new Date().toISOString().slice(0, 10),
  }], variables);
  assert.equal(
    guessed.evidence, EVIDENCE.INADMISSIBLE,
    `${forbidden} established a legal proposition. An inference may be proposed to a person; ` +
    `it may not be the authority for an affirmative legal conclusion.`
  );
  assert.equal(guessed.value, undefined);
  assert.notEqual(guessed.applicability, APPLICABILITY.APPLIES);
  // Refused by the ABSOLUTE rule at the point of use, not merely by failing to
  // appear on this proposition's list. The two defences are separate: the gate
  // stops the declaration being written, and this stops a record that reached
  // the function anyway. A test that cannot tell them apart is satisfied by
  // either one alone, and would pass with the runtime guard deleted.
  assert.equal(guessed.inference_only, true, `${forbidden}: refused by the wrong rule`);
  assert.match(guessed.detail, /never establish a legal proposition/);
  checks += 5;
}
// The declaration's OWN list is a separate defence and is pinned separately.
// lender_is_nbfc deliberately excludes operator_declaration: whether a lender is
// an RBI-registered NBFC decides which lending rules bind it, and a party's own
// statement about its regulatory status is precisely the assertion that most
// needs a register behind it. A source that is perfectly good evidence for one
// proposition establishes nothing about another.
//
// What this checks is the LABEL on the record, not where the record came from.
// See 2b: a record claiming "public_register" is accepted on that claim.
let narrowed = 0;
for (const [id, declaration] of declared) {
  const wrongSource = ["operator_declaration", "system_observation", "public_register"]
    .find((kind) => !declaration.admissible_provenance.includes(kind));
  if (!wrongSource) continue;
  narrowed += 1;
  const vars = Object.fromEntries(declaration.subject_binding.map((f) => [f, SUBJECT_VALUE]));
  const result = establish(id, [{
    proposition: id, subject: { ...vars }, state: "TRUE", provenance: wrongSource,
    authority: "a source this proposition does not accept",
    as_of: new Date().toISOString().slice(0, 10),
  }], vars);
  assert.equal(result.evidence, EVIDENCE.INADMISSIBLE,
    `${id}: accepted ${wrongSource}, which its declaration does not list`);
  assert.notEqual(result.inference_only, true,
    `${id}: refused as an inference — that is the other rule, and it would mask this one`);
  assert.equal(result.value, undefined);
  checks += 3;
}
assert.ok(narrowed > 0,
  "every declared proposition accepts every provenance, so the declaration's own list is " +
  "untested and could be deleted without any test noticing");

// And the gate refuses a declaration that tries to admit one.
const probe = path.join(ROOT, "knowledge-base/intake/propositions/__probe.propositions.json");
const declare = (mutation) => {
  fs.writeFileSync(probe, JSON.stringify({ propositions: [{
    id: "probe_proposition",
    statement: "The subject actually does the thing this proposition is about.",
    subject_binding: ["company_name"],
    admissible_provenance: ["operator_declaration"],
    when_unknown: "ESCALATE",
    review_status: "probe",
    ...mutation,
  }] }));
  try {
    return loadPropositions({ refresh: true });
  } finally {
    fs.unlinkSync(probe);
  }
};
const refuses = (mutation, because) => {
  assert.throws(() => declare(mutation), because);
  clearPropositionCache();
  loadPropositions({ refresh: true });
  checks += 1;
};
refuses({ admissible_provenance: ["ai_inference"] }, /never be admissible/);
refuses({ subject_binding: [] }, /subject_binding/);
refuses({ when_unknown: "TREAT_AS_FALSE" }, /when_unknown/);
refuses({ continuing: true }, /evidence_valid_for_days/);
refuses({ statement: "It does." }, /statement/);
console.log("PASS  an AI inference can be proposed and is never admitted, by record and by gate");

// ── 2b. THE LIMIT OF admissible_provenance, asserted rather than assumed ────
//
// Everything above tests that a record LABELLED with an inadmissible provenance
// is refused. None of it tests — and none of it can — that a record labelled
// "public_register" came from one. The field is supplied with the record.
//
// So the property this mechanism actually has is narrower than the one its
// comments originally claimed. It stops honest mislabelling and it makes the
// declaration say who ought to have produced the evidence. It does not
// establish provenance, because nothing in the record shape distinguishes:
//
//     SELF-ASSERTED     the record says where it came from
//     SYSTEM-OBSERVED   the system recorded where it got it
//
// Pinned as a test so the limit travels with the mechanism. If provenance
// verification is ever added, this assertion is where it announces itself.
const asIfFromRegister = (extra) => establish(firstId, [{
  proposition: firstId, subject, state: "TRUE",
  provenance: first.admissible_provenance[0],
  authority: "as stated on the record",
  as_of: new Date().toISOString().slice(0, 10),
  ...extra,
}], variables);

const retrieved = asIfFromRegister({ retrieval: { channel: "authority-api", verified: true } });
const emailedByTheParty = asIfFromRegister({
  retrieval: { channel: "email attachment from the party whose status is in question",
               verified: false },
});
assert.equal(
  emailedByTheParty.evidence, retrieved.evidence,
  "the layer now distinguishes how a record arrived from what it says about itself. That is a " +
  "real improvement — update this assertion and say what establishes provenance."
);
assert.equal(emailedByTheParty.evidence, EVIDENCE.PRESENT,
  "a record claiming an admissible provenance is accepted on that claim");
checks += 2;
console.log(
  "PASS  admissible_provenance is a check on a CLAIM of provenance — limit asserted, not assumed"
);

// ── 3. Staleness, on a real continuing proposition ──────────────────────────
//
// The POA lesson, reused rather than re-invented: a state that held once is not
// a state that holds now, and undated evidence of one establishes nothing.
const continuing = [...declared].find(([, d]) => d.continuing);
assert.ok(continuing, "no declared proposition is continuing — staleness is untested");
const [contId, cont] = continuing;
const contVars = Object.fromEntries(cont.subject_binding.map((f) => [f, SUBJECT_VALUE]));
const contSubject = { ...contVars };
const dated = (as_of) => [{
  proposition: contId, subject: contSubject, state: "TRUE",
  provenance: cont.admissible_provenance[0], authority: "register", as_of,
}];
const old = new Date(Date.now() - (cont.evidence_valid_for_days + 60) * 86400000)
  .toISOString().slice(0, 10);
assert.equal(establish(contId, dated(old), contVars).evidence, EVIDENCE.STALE);
assert.equal(establish(contId, dated(undefined), contVars).evidence, EVIDENCE.STALE);
assert.equal(establish(contId, dated(new Date().toISOString().slice(0, 10)), contVars).evidence,
  EVIDENCE.PRESENT);
// Conflicting admissible records are never resolved by order of arrival.
const conflict = establish(contId, [
  ...dated(new Date().toISOString().slice(0, 10)),
  { ...dated(new Date().toISOString().slice(0, 10))[0], state: "FALSE" },
], contVars);
assert.equal(conflict.evidence, EVIDENCE.CONFLICTING);
assert.equal(conflict.value, undefined);
checks += 5;
console.log("PASS  continuing propositions: stale, undated and conflicting all establish nothing");

// ── 4. THE PRIVACY POLICY REGRESSION, routed through the same mechanism ─────
//
// Not a privacy-specific test. The proposition is processes_personal_data, one
// of the 29 orphans, gating DPDP clauses in five families. The requirement is
// authored with an EVIDENCE applicability source, and the two arms differ ONLY
// in what the world does.
const requirementsFile = path.join(
  ROOT, "knowledge-base/documents/requirements/__evidenceprobe.requirements.json"
);
// A probe-only document type. Written under PRIVACY_POLICY this would replace
// that family's authored requirements the moment it has any — the loader keys
// by document_type and the last file wins. Harmless today and a trap tomorrow,
// which is exactly how the Loan collision stayed invisible for several turns.
fs.writeFileSync(requirementsFile, JSON.stringify({
  document_type: "__EVIDENCE_PROBE",
  requirements: [{
    id: "PROCESSING_IS_DISCLOSED",
    kind: "CONTENT",
    statement: "Where the service actually processes personal data, the policy discloses it.",
    identity_test:
      "Remove it and a service that processes personal data can publish a policy that never " +
      "says so, and nothing in the system notices, because the clause that would have said so " +
      "is gated on a proposition nobody established.",
    applicability: { evidence: "processes_personal_data" },
    satisfied_by: { any_of: ["PRIVACY_PROCESSING_DISCLOSURE_001"] },
    when_unsatisfied: "ESCALATE",
    review_status: "probe-only",
  }],
}));
try {
  loadDocumentRequirements({ refresh: true });
  const POLICY_SILENT = JSON.parse(fs.readFileSync(
    path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"
  )).types.PRIVACY_POLICY.full.clauses;
  const vars = { service_provider_name: SUBJECT_VALUE };
  const world = (state) => resolveEvidence(["processes_personal_data"], [{
    proposition: "processes_personal_data", subject: { service_provider_name: SUBJECT_VALUE },
    state, provenance: "operator_declaration", authority: "the operator",
    as_of: new Date().toISOString().slice(0, 10),
  }], vars);

  const does = assessRequirements("__EVIDENCE_PROBE", POLICY_SILENT, {}, vars, [], {},
    world("TRUE").outcomes);
  const doesNot = assessRequirements("__EVIDENCE_PROBE", POLICY_SILENT, {}, vars, [], {},
    world("FALSE").outcomes);
  const nobodyKnows = assessRequirements("__EVIDENCE_PROBE", POLICY_SILENT, {}, vars, [], {},
    resolveEvidence(["processes_personal_data"], [], vars).outcomes);

  const find = (r) => r.results.find((x) => x.id === "PROCESSING_IS_DISCLOSED");

  // The attack. Before this layer both arms were byte-identical.
  assert.notDeepEqual(
    find(does), find(doesNot),
    "policy silent + service DOES process, and policy silent + service does NOT, produced the " +
    "same finding. The world state is still invisible and nothing has been added."
  );
  assert.equal(find(does).coverage, COVERAGE.ESCALATED,
    "a service that processes personal data and says nothing about it must be found out");
  assert.equal(find(does).finding, FINDING.WORK_INCOMPLETE);
  assert.equal(find(doesNot).coverage, COVERAGE.NOT_APPLICABLE,
    "a service that processes nothing does not need the disclosure");
  assert.equal(find(doesNot).finding, FINDING.ESTABLISHED_NEGATIVE);

  // And the third arm, which is the one that separates this from a boolean.
  assert.equal(find(nobodyKnows).coverage, COVERAGE.APPLICABILITY_UNKNOWN,
    "nobody established whether the service processes personal data, and that is not the same " +
    "as establishing that it does not");
  assert.notEqual(find(nobodyKnows).coverage, find(doesNot).coverage);
  assert.equal(find(nobodyKnows).undetermined_source, "evidence");
  assert.equal(find(nobodyKnows).evidence_outcome.evidence, EVIDENCE.ABSENT);
  checks += 8;

  // Wrong subject must not resolve it either — evidence about another company.
  const someoneElse = assessRequirements("__EVIDENCE_PROBE", POLICY_SILENT, {}, vars, [], {},
    resolveEvidence(["processes_personal_data"], [{
      proposition: "processes_personal_data", subject: { service_provider_name: OTHER_VALUE },
      state: "TRUE", provenance: "operator_declaration", authority: "someone else",
      as_of: new Date().toISOString().slice(0, 10),
    }], vars).outcomes);
  assert.equal(find(someoneElse).coverage, COVERAGE.APPLICABILITY_UNKNOWN);
  assert.equal(find(someoneElse).evidence_outcome.evidence, EVIDENCE.MISMATCHED);
  checks += 2;
} finally {
  fs.unlinkSync(requirementsFile);
  loadDocumentRequirements({ refresh: true });
}
console.log(
  "PASS  policy silent + service does X  !=  policy silent + service does not X  !=  nobody knows"
);

// ── 5. Conservation: every proposition asked about terminates somewhere ─────
const asked = [...declared.keys(), "a_proposition_nobody_declared"];
const resolved = resolveEvidence(asked, [], {});
assert.equal(resolved.outcomes.length, asked.length);
for (const outcome of resolved.outcomes) {
  assert.ok(Object.values(EVIDENCE).includes(outcome.evidence), `${outcome.proposition}: no state`);
  assert.ok(Object.values(APPLICABILITY).includes(outcome.applicability));
  assert.ok(String(outcome.detail || "").length > 20, `${outcome.proposition}: no explanation`);
  checks += 3;
}
// An undeclared proposition is reported as undeclared, not silently skipped:
// that is exactly the state the 29 orphan gates are in today.
assert.equal(resolved.summary.undeclared, 1);
assert.equal(Object.keys(resolved.flags).length, 0,
  "nothing was supplied, so nothing may be flagged true or false");
checks += 2;

// ── 6. The mechanism names no family, party or statute ──────────────────────
const source = fs.readFileSync(
  path.join(ROOT, "backend/services/evidencePropositions.js"), "utf8"
).split("export function establish")[1];
for (const token of ["privacy", "DPDP", "lender", "NBFC", "personal data"]) {
  assert.ok(!new RegExp(token, "i").test(source),
    `establish() names "${token}" — the doctrine belongs in the knowledge artifact`);
  checks += 1;
}

console.log(`\nALL GREEN (${checks} checks)`);
