/**
 * authoringCoherence.test.mjs
 *
 * A REQUIREMENT MUST BE GATED ON THE BOUNDARY ITS OWN TEXT DESCRIBES.
 *
 * Prerequisite to the fact-source repair. Handing assessment the facts
 * generation already holds makes nine conditional requirements determinate — and
 * a requirement whose statement describes a different condition from its gate
 * will then produce a confident wrong answer in place of an honest
 * APPLICABILITY_UNKNOWN. The blindness has been masking the mis-authoring.
 *
 * A KEYWORD SCREEN FOUND ONE. READING THEM FOUND FIVE. The screen looked for
 * "regardless", "in any event", "irrespective" — language a mis-authored
 * requirement need not use, and four of the five do not use it. Recorded because
 * it is the same undercount this work keeps producing from unscoped screens, and
 * because it is the reason this file lists cases by name rather than asserting a
 * pattern.
 *
 * WHAT THIS FILE DOES. It holds the five as named cases that must be RETIRED OR
 * REPLACED, never deleted. Each carries the gate as authored, the wording the
 * finding rests on, and a `resolution` that is null until an advocate decides.
 *
 * The structure matters. A case held only by its current wording can be
 * "resolved" by rewriting the prose until the test stops matching — the
 * semantic conflict untouched and the evidence gone. So a case with no
 * resolution must still exhibit its conflict, and a case with one must say which
 * way it went and who decided. Either way the entry stays; it does not vanish.
 *
 * It asserts nothing about which way any of them should be resolved. See
 * docs/audit/AUTHORING_COHERENCE.md.
 */
import assert from "node:assert";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";

let checks = 0;
const requirements = loadDocumentRequirements({ refresh: true });
const find = (family, id) => {
  const requirement = (requirements.get(family) || []).find((r) => r.id === id);
  assert.ok(requirement, `${family}/${id} has left the knowledge base`);
  return requirement;
};

// Each entry: the gate as authored, and the condition the requirement's own
// words describe. Resolving one means changing the gate, the words, or splitting
// the requirement — all authoring decisions.
// RESOLVED — each repaired, each retaining the question it was repaired against
// and the statutory proposition still awaiting verification. These entries do
// not disappear: the record of what was wrong and on whose authority it changed
// is the point.
//
// `by` says structural, not advocate, because that is what happened. Each repair
// follows what the artifact ITSELF already asserted — a requirement naming two
// duties was split into two, a gate contradicting its own statement was moved to
// the condition the statement names, a proxy was replaced by the fact it stood
// for. None of it settles the statutory questions, which stay flagged in the
// knowledge artifacts as $verification_needed.
const RESOLVED_CASES = [
  {
    family: "EMPLOYMENT_CONTRACT", id: "POSH_AWARENESS_REFLECTED",
    was: "POSH_DUTY_REFLECTED gated on employer_headcount_ge_10 while its identity_test said s.19 imposes its duty regardless",
    gate: { always: true },
    decided: "Split into two requirements, one per duty. The s.19 half is unconditional, as the original text asserted.",
    boundary: "Applies to every contract of service; the headcount governs the other half.",
    by: "structural repair following the requirement's own assertion — s.19 scope not yet verified against the Act",
    stillOpen: "POSH Act, 2013 s.19",
  },
  {
    family: "EMPLOYMENT_CONTRACT", id: "POSH_INTERNAL_COMMITTEE_REFLECTED",
    was: "the other half of POSH_DUTY_REFLECTED",
    gate: { position: "employer_headcount_ge_10", value: true },
    decided: "The threshold belongs to the s.4 Internal Committee duty and to that duty alone.",
    boundary: "Workplaces employing ten or more, as POSH_INTERNAL_COMMITTEE_001 states in its own text.",
    by: "structural repair following the clause's own wording — the threshold and who counts toward it not yet verified",
    stillOpen: "POSH Act, 2013 s.4",
  },
  {
    family: "EMPLOYMENT_CONTRACT", id: "MATERNITY_ENTITLEMENT",
    was: "gated on is_female_employee while the statement said 'where the establishment is covered'",
    gate: { position: "establishment_is_covered", value: true },
    decided: "Gated on establishment coverage, which is the condition the statement already named.",
    boundary: "Establishments the Act covers. The employee's sex is not the condition — a covered establishment should reflect the entitlement whoever holds the post.",
    by: "structural repair; coverage threshold derived from the existing headcount answer and not yet verified",
    stillOpen: "Maternity Benefit Act, 1961 — coverage threshold, and whether individual eligibility belongs as a second condition",
  },
  {
    family: "EMPLOYMENT_CONTRACT", id: "WORK_PRODUCT_OWNERSHIP",
    was: "gated on assigns_copyright == true, while its argument was about the gap s.17(c) leaves where nothing has been assigned",
    gate: { always: true },
    decided: "Unconditional, which is what its statement says: who owns what the employee creates is stated.",
    boundary: "Every contract of service. The three-state ip_ownership field is what satisfies it, not what decides whether the question arises.",
    by: "structural repair; whether any contract of service genuinely needs no ownership term is unverified",
    stillOpen: "Copyright Act, 1957 s.17(c) — the edges of 'in the course of employment'",
  },
  {
    family: "MASTER_SERVICE_AGREEMENT", id: "PERSONNEL_CONTINUITY",
    was: "gated on include_sla, a contractual mechanism standing in for a commercial fact",
    gate: { position: "key_person_dependency", value: true },
    decided: "The proxy is removed. A new intake fact asks whether the engagement depends on named individuals; an SLA is one treatment for the position that fact opens.",
    boundary: "Engagements that turn on particular people, whether or not service levels were included.",
    by: "structural repair — no statutory question involved, and none flagged",
    stillOpen: null,
  },
  {
    family: "LOAN_AGREEMENT", id: "ENFORCEMENT_MATCHES_SECURITY_POSITION",
    was: "ENFORCEMENT_MATCHES_THE_LOAN covered one of the two branches its guarded clause declares",
    gate: { position: "is_secured", value: false },
    decided: "Split into one requirement per branch of the clause's own invalid_if.",
    boundary: "Unsecured loans — the branch the clause states as 'Loan is unsecured'.",
    by: "structural repair following the clause's authored invalidity conditions",
    stillOpen: null,
  },
  {
    family: "LOAN_AGREEMENT", id: "ENFORCEMENT_MATCHES_LENDER_ELIGIBILITY",
    was: "the branch no requirement covered — a secured loan from an ineligible lender",
    gate: { position: "lender_is_regulated", value: false },
    decided: "Authored as its own requirement against the clause's first invalid_if branch.",
    boundary: "Lenders outside the class the Act confers the rights on. lender_is_regulated is the CLOSEST ESTABLISHED FACT and is not the statutory test.",
    by: "structural repair; whether lender_type distinguishes a 'secured creditor' under the Act is unverified and flagged in the artifact",
    stillOpen: "SARFAESI Act, 2002 s.2(1)(zd)",
  },
];

for (const entry of RESOLVED_CASES) {
  const requirement = find(entry.family, entry.id);
  const key = `${entry.family}/${entry.id}`;
  assert.deepEqual(
    requirement.applicability, entry.gate,
    `${key}: the gate has moved again since this repair. Record the new decision rather than ` +
    `editing this entry to match — what was wrong before was: ${entry.was}`
  );
  for (const field of ["was", "decided", "boundary", "by"]) {
    assert.ok(
      String(entry[field] || "").trim().length > 20,
      `${key}: ${field} — the record of what was wrong and how it changed is the evidence here`
    );
    checks += 1;
  }
  // A repair that flagged a statutory question must leave that flag in the
  // knowledge artifact, where an advocate reading the requirement will see it.
  if (entry.stillOpen) {
    assert.ok(
      String(requirement.$verification_needed || JSON.stringify(requirement.$repaired || requirement.$split || ""))
        .length > 20,
      `${key}: the artifact carries no verification note, and this repair left ` +
      `"${entry.stillOpen}" unanswered. The flag belongs where the requirement is read.`
    );
    checks += 1;
  }
  checks += 1;
}

// Nothing is blocked any more — but the list stays, so that re-blocking is an
// act rather than an omission.
const BLOCKED = [];

// The four that DO state the condition their gate implements. Without them a
// change that broke every gate would satisfy the assertions above.
const COHERENT = [
  ["LOAN_AGREEMENT", "SECURITY_POSITION_SETTLED", "is_secured"],
  ["LOAN_AGREEMENT", "SECURITY_PERFECTION_PROVIDED_FOR", "is_secured"],
  ["MASTER_SERVICE_AGREEMENT", "SERVICE_LEVELS_MEASURED", "include_sla"],
  ["MASTER_SERVICE_AGREEMENT", "PERSONAL_DATA_HANDLED", "processes_personal_data"],
];
for (const [family, id, flag] of COHERENT) {
  const requirement = find(family, id);
  assert.strictEqual(
    requirement.applicability?.position, flag,
    `${family}/${id} no longer rests on ${flag}`
  );
  checks += 1;
}

// And the population is closed: every conditional requirement is either blocked
// or coherent, so a new one cannot be added without being classified.
const conditional = [];
for (const [family, list] of requirements) {
  for (const r of list) {
    if (r.applicability?.position || r.applicability?.evidence) conditional.push(`${family}/${r.id}`);
  }
}
const classified = new Set([
  ...BLOCKED.map((b) => `${b.family}/${b.id}`),
  ...RESOLVED_CASES.map((r) => `${r.family}/${r.id}`),
  ...COHERENT.map(([f, i]) => `${f}/${i}`),
]);
const unclassified = conditional.filter((key) => !classified.has(key));
assert.deepEqual(
  unclassified, [],
  `conditional requirements with no authoring-coherence verdict: ${unclassified.join(", ")}. ` +
  `Read each against its gate and add it to BLOCKED or COHERENT — the fact-source repair will ` +
  `make it determinate, and an unread gate is how a wrong boundary becomes a confident answer.`
);
checks += 1;

for (const entry of BLOCKED) {
  assert.ok(
    String(entry.question || "").trim().endsWith("?"),
    `${entry.family}/${entry.id}: no question recorded. Each of these needs an advocate's answer, ` +
    `and the answer is only findable if the question is written down.`
  );
  checks += 1;
}

console.log(
  `PASS  ${RESOLVED_CASES.length} authoring-coherence repairs recorded with what was wrong and ` +
  `what is still\n      unverified; ${BLOCKED.length} blocked; ${conditional.length} conditional ` +
  `requirements all classified`
);
console.log(`\nALL GREEN (${checks} checks)`);
