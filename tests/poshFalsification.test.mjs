/**
 * poshFalsification.test.mjs — PHASE D2.5
 *
 * THE ATTACK: make the document look completely compliant while establishing
 * nothing, and see whether the system agrees with it.
 *
 * A POSH policy is the sharpest case in the portfolio for one failure mode,
 * because its clauses are written in the Act's own words. Section 4's
 * qualifications — a Presiding Officer who is a woman employed at a senior
 * level, an external member from a non-governmental organisation, not fewer than
 * half the members women, no term beyond three years — appear in the generated
 * text as statements of fact. The system holds two typed names and knows none of
 * it.
 *
 *     LEGAL-SOUNDING LANGUAGE IS NOT ESTABLISHED LEGAL FACT.
 *
 * Every fixture below is a real semantic state, not a state chosen because it
 * makes a requirement resolve. Where a fixture cannot be built — because the
 * intake has no field for the fact — that is recorded as the finding rather than
 * simulated with a field that means something else.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { establish, EVIDENCE, APPLICABILITY } from "../backend/services/evidencePropositions.js";
import { COVERAGE, FINDING, loadDocumentRequirements } from "../backend/services/documentRequirements.js";
import { getVariables } from "../backend/config/variableConfig.js";

let checks = 0;
const BASE = variablesFor("POSH_POLICY", { profile: FIXTURE_PROFILE.WELL_FILLED });

async function policy(overrides = {}) {
  const variables = { ...BASE, ...overrides };
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete variables[k];
  const result = await generateDocument({ document_type: "POSH_POLICY", variables });
  const clauses = result.draft?.clauses || [];
  return {
    generates: clauses.length > 0,
    text: clauses.map((c) => c.text || "").join("\n"),
    of: (id) => result.requirements?.results?.find((r) => r.id === id),
    summary: result.requirements?.summary,
  };
}

// ── ATTACK 1 — the perfect-looking policy ────────────────────────────────────
// Everything answered, nothing established. This is the fixture the family
// exists to be tested against.
{
  const perfect = await policy();
  assert.ok(perfect.generates, "the baseline POSH policy does not generate");

  // The document makes every statutory claim.
  const CLAIMS = [
    [/has constituted an Internal Committee under Section 4/i, "the Committee is constituted under s.4"],
    [/a woman employed at a senior level/i, "the Presiding Officer is a senior woman"],
    [/non-governmental organisation/i, "the external member comes from an NGO"],
    [/[Nn]ot fewer than one half of the total members .{0,20}are women/i, "half the members are women"],
    [/term not exceeding three years/i, "no term exceeds three years"],
  ];
  for (const [pattern, claim] of CLAIMS) {
    assert.match(perfect.text, pattern, `the policy no longer claims ${claim} — rewrite this file`);
  }

  // And the system agrees with NONE of them.
  const committee = perfect.of("INTERNAL_COMMITTEE_LAWFULLY_CONSTITUTED");
  assert.equal(
    committee.coverage, COVERAGE.PROVIDED_FOR,
    `the policy asserts five elements of section 4 and the assessment reports ` +
    `${committee.coverage}. RESOLVED here would be the document's own words certifying the ` +
    `constitution of a statutory body — the exact failure this family was selected to expose.`
  );
  assert.equal(
    committee.finding, FINDING.CEILING_FOR_KIND,
    "PROVIDED_FOR is reading as a success finding. It is the ceiling for a formality, and the " +
    "finding axis is the only thing keeping it from being read as one."
  );
  assert.ok(
    String(committee.outside_the_document || "").length > 80,
    "the requirement does not say what lies outside the document, so a reader has no way to know " +
    "what PROVIDED_FOR is withholding"
  );
  checks += CLAIMS.length + 4;
}

// ── ATTACK 2 — name only, and name stuffed with qualifications ───────────────
// posh_presiding_officer is free text. The loan family established that a
// description must never become a position; this is the same attack against a
// statutory qualification rather than a commercial one.
{
  const nameOnly = await policy({ posh_presiding_officer: "Priya Sharma" });
  const stuffed = await policy({
    posh_presiding_officer:
      "Priya Sharma, a woman employed at senior level, heading a six-member Committee of which " +
      "four are women, all nominated within the last three years",
    posh_external_member:
      "Anita Rao of the Sakhi Foundation, a non-governmental organisation committed to the cause of women",
  });

  for (const [label, side] of [["name only", nameOnly], ["name stuffed with qualifications", stuffed]]) {
    assert.ok(side.generates, `${label}: the policy does not generate`);
    assert.equal(
      side.of("INTERNAL_COMMITTEE_LAWFULLY_CONSTITUTED").coverage, COVERAGE.PROVIDED_FOR,
      `${label}: writing the statutory qualifications into a free-text name field moved the ` +
      `requirement. A description is not a position — the rule the loan family established when ` +
      `"None — this is an unsecured loan" produced a secured loan.`
    );
  }
  // The stuffed text reaches the document, which is exactly why it must not count.
  assert.match(
    stuffed.text, /four are women/,
    "the stuffed qualification did not reach the document, so this attack tested nothing"
  );
  checks += 5;
}

// ── ATTACK 3 — the Local Committee route is not gated on headcount ───────────
// Section 6 read with section 9(1) gives the route both where the workplace
// employs fewer than ten AND where the complaint is against the employer. The
// second limb applies at any size, so gating this on the threshold would remove
// the route in exactly the case the threshold has nothing to do with — the
// defect the employment family's POSH requirement carried.
{
  const declared = loadDocumentRequirements().get("POSH_POLICY") || [];
  const route = declared.find((r) => r.id === "LOCAL_COMMITTEE_ROUTE_STATED");
  assert.ok(route, "LOCAL_COMMITTEE_ROUTE_STATED has left the matrix");
  assert.equal(
    route.applicability?.always, true,
    "the Local Committee route is now conditional. If it was gated on headcount, a woman whose " +
    "complaint is against the employer at a workplace of fifty loses the only forum open to her."
  );
  assert.ok(
    !route.applicability?.position && !route.applicability?.evidence,
    `the route rests on ${route.applicability?.position || route.applicability?.evidence}`
  );
  // And POSH has no headcount field at all, so nothing could gate it even by accident.
  assert.ok(
    !("workplace_headcount" in (getVariables("POSH_POLICY") || {})),
    "POSH_POLICY now collects workplace_headcount. Before gating anything on it, note that the " +
    "employer-respondent limb of section 6 applies at every size."
  );
  checks += 4;
}

// ── ATTACK 4 — dissemination evidence, every shape of it ─────────────────────
// The requirement must not move, whatever the evidence says. PROVIDED_FOR is
// about the DOCUMENT providing for the act; whether the act happened is reported
// on the evidence axis and nowhere else.
{
  const PROPOSITION = "posh_policy_disseminated";
  const subject = { company_name: BASE.company_name };
  const today = new Date().toISOString().slice(0, 10);
  const record = (provenance, state, extra = {}) => ({
    proposition: PROPOSITION, provenance, state: String(state), subject, as_of: today, ...extra,
  });

  const ATTACKS = [
    ["no evidence at all", [], EVIDENCE.ABSENT],
    ["stale attestation", [record("third_party_attestation", true, { as_of: "2023-09-01" })], EVIDENCE.STALE],
    ["records that disagree", [record("operator_declaration", true), record("third_party_attestation", false)], EVIDENCE.CONFLICTING],
    ["evidence about another employer", [record("operator_declaration", true, { subject: { company_name: "Another Co Pvt Ltd" } })], EVIDENCE.MISMATCHED],
    ["the policy's own words", [record("clause_text", true)], EVIDENCE.INADMISSIBLE],
    ["a model's reading of the policy", [record("ai_inference", true)], EVIDENCE.INADMISSIBLE],
  ];
  for (const [label, records, expected] of ATTACKS) {
    const outcome = establish(PROPOSITION, records, subject);
    assert.equal(outcome.evidence, expected, `${label}: read ${outcome.evidence}`);
    assert.notEqual(
      outcome.applicability, APPLICABILITY.APPLIES,
      `${label}: established that the policy WAS disseminated. None of these states does.`
    );
  }

  // Only a real, current, admissible, on-subject record does.
  const good = establish(PROPOSITION, [record("operator_declaration", true)], subject);
  assert.equal(good.evidence, EVIDENCE.PRESENT);
  assert.equal(
    good.applicability, APPLICABILITY.APPLIES,
    "nothing can establish dissemination, which would make the proposition unusable rather than " +
    "strict — and every assertion above would pass for the wrong reason"
  );

  // Through all of it the requirement itself never moves.
  const shipped = await policy();
  assert.equal(shipped.of("POLICY_DISSEMINATED").coverage, COVERAGE.PROVIDED_FOR);
  assert.equal(shipped.of("POLICY_DISSEMINATED").finding, FINDING.CEILING_FOR_KIND);
  checks += ATTACKS.length * 2 + 4;
}

// ── What the family reports, as a whole ──────────────────────────────────────
{
  const shipped = await policy();
  assert.equal(
    shipped.summary.provided_for, 2,
    `${shipped.summary.provided_for} formalities at their ceiling, expected 2 — the constitution ` +
    `of the Committee and the dissemination of the policy. If one became RESOLVED, the document ` +
    `is now certifying an act performed outside it.`
  );
  assert.equal(shipped.summary.undetermined, 0);
  console.log(
    `PASS  the perfect-looking policy makes 5 statutory claims and establishes none of them\n` +
    `      ${shipped.summary.resolved} content requirements resolved; ` +
    `${shipped.summary.provided_for} formalities held at CEILING_FOR_KIND\n` +
    `      free-text qualification stuffing, stale, conflicting, mismatched, self-asserted and\n` +
    `      model-inferred evidence all refused`
  );
  checks += 2;
}

// ── THE CEILING ─────────────────────────────────────────────────────────────
// Surviving falsification is not approval. POSH has no reviewed requirement and
// no signed-off clause, and the ladder must keep it below ADVOCATE_REVIEW on
// that basis alone — otherwise "we attacked it and it held" quietly becomes
// "a lawyer approved it", which is the one claim this system must never make by
// accident.
{
  const declared = loadDocumentRequirements().get("POSH_POLICY") || [];
  const reviewed = declared.filter((r) => r.review_status && r.review_status !== "draft-needs-legal-review");
  assert.deepEqual(
    reviewed.map((r) => r.id), [],
    "a POSH requirement now claims a review status other than draft-needs-legal-review. If an " +
    "advocate really did review it, say who and when; if the status drifted, that is the family " +
    "advancing on the ladder without the evidence."
  );

  // And the generation defect is still recorded as open, in the artifact that
  // carries it. The assessment was repaired; the document was not.
  const committee = declared.find((r) => r.id === "INTERNAL_COMMITTEE_LAWFULLY_CONSTITUTED");
  assert.ok(
    String(committee.$verification_needed || "").length > 100,
    "the open question on the section 4 assertions has gone from the requirement. It is a " +
    "GENERATION defect: the clause still asserts five statutory qualifications the system cannot " +
    "establish, and the honest assessment does not repair the document."
  );
  checks += 2;
}

console.log(`\nALL GREEN (${checks} checks)`);
