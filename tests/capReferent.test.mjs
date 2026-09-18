/**
 * capReferent.test.mjs — D4.29: THE CEILING MEASURES A PAYMENT THAT NEVER HAPPENS
 *
 * These assertions record a DEFECT and will fail when it is repaired. That is
 * deliberate, and it is the ASSERT_THE_STATE_NOT_THE_HOPE rule: a fixture that
 * passes by describing a hoped-for state is how a suite starts lying. Each
 * failure message says what a flip means, so whoever sees it updates the
 * governance record rather than quietly changing the assertion.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const acheck = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };

const R = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/cap-referent.json"), "utf8"));

const CAP_CLAUSES = new Set([
  "CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001",
  "CORE_LIABILITY_LIMIT_FALLBACK_001", "GUARANTEE_OBLIGATION_001",
]);
const CURRENCY_LABEL = /₹|\bRs\.?\b|\bINR\b|\brupees?\b/i;
const MEASURE_PHRASE = /aggregate fees paid or payable under this Agreement|total consideration paid under this Agreement/i;

const capTextFor = async (type, overrides = {}) => {
  const vars = { ...variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }), ...overrides };
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete vars[k];
  const out = await generateDocument({ document_type: type, variables: vars });
  return (out?.draft?.clauses || []).find((c) => CAP_CLAUSES.has(c.clause_id))?.text || "";
};

/* ── THE DEFECT ITSELF ────────────────────────────────────────────────────── */

await acheck("each structurally empty family still renders a ceiling it cannot compute", async () => {
  for (const m of R.structurally_empty.members) {
    const text = await capTextFor(m.type);
    assert.ok(text, `${m.type}: the cap clause no longer renders at all — that is a change of scope, not of measurement, and belongs in the SCOPE layer`);
    assert.ok(MEASURE_PHRASE.test(text),
      `${m.type}: the ceiling no longer measures fees or consideration. If the clause was rewritten to name a quantity the family holds, that is the D4.29 repair landing — update knowledge-base/governance/cap-referent.json before changing this assertion.`);
  }
});

check("and still holds no rupee quantity other than the cap's own input", () => {
  for (const m of R.structurally_empty.members) {
    const schema = getVariables(m.type) || {};
    const money = Object.entries(schema)
      .filter(([k, d]) => d?.type === "number" && CURRENCY_LABEL.test(String(d.label || "")))
      .map(([k]) => k)
      .filter((k) => k !== "liability_cap_amount");
    assert.deepStrictEqual(money, [],
      `${m.type}: now collects ${money.join(", ")}. If a payment was added to the intake, the referent may no longer be empty — re-run scripts/probeCapReferent.mjs and move the family out of the table rather than loosening this check.`);
  }
});

check("the cap's own input is never counted as evidence that the family can measure", () => {
  /*
   * `liability_cap_amount` is the figure the cap would use INSTEAD of measuring
   * anything. Counting it as a measurable quantity is circular, and the circularity
   * is what made DISTRIBUTION_AGREEMENT and SHAREHOLDERS_AGREEMENT look supplied.
   */
  const circular = R.structurally_empty.members.filter((m) => /only liability_cap_amount/.test(m.rupee_fields));
  assert.ok(circular.length >= 2,
    "the families whose only rupee field is the cap's own input are no longer recorded; that circularity is the reason they are in this table");
});

/* ── THE OPTION THAT NAMES SOMETHING THE FORM CANNOT EXPRESS ──────────────── */

await acheck("the negotiated-cap option still produces no negotiated cap", async () => {
  const d = R.basis_option_defect;
  const text = await capTextFor("PARTNERSHIP_DEED", {
    liability_cap_basis: d.option, liability_cap_amount: undefined,
  });
  assert.ok(/limited to direct damages only/i.test(text), "the direct-damages branch no longer renders");
  assert.ok(/aggregate fees paid or payable/i.test(text),
    "the option no longer falls back to the fees formula. If a negotiated figure now reaches the clause, the defect is fixed — record it in cap-referent.json and retire this assertion.");
  assert.ok(!/₹[\d,]/.test(text),
    "a rupee figure now appears under the negotiated-cap option; that is the fix landing, not a test to relax");
});

await acheck("and selecting it still suppresses the indicative figure the default branch gives", async () => {
  /*
   * SERVICE_AGREEMENT is one of the four families where the indication fires, so
   * it can show the asymmetry. Asserting it anywhere else would prove nothing.
   */
  const dflt = await capTextFor("SERVICE_AGREEMENT");
  assert.ok(/presently estimate at approximately/.test(dflt),
    "the indicative figure no longer renders on the default basis; the asymmetry below can no longer be measured here");
  const direct = await capTextFor("SERVICE_AGREEMENT", {
    liability_cap_basis: R.basis_option_defect.option, liability_cap_amount: undefined,
  });
  assert.ok(!/presently estimate at approximately/.test(direct),
    "the direct-damages branch now discloses an indicative figure too — the asymmetry is resolved, so update the governance record");
});

/* ── THE RECORD MUST NOT SOFTEN WITHOUT EVIDENCE ──────────────────────────── */

check("the refusal to build a referent-resolution primitive keeps its evidence", () => {
  const g = R.engine_generalisation;
  assert.strictEqual(g.verdict, "REFUSED_ON_EVIDENCE",
    "the primitive has been accepted; it may only be accepted on evidence that the premise reproduces outside the cap family");
  assert.ok(g.method && g.what_they_measure && g.why_that_settles_it,
    "the refusal no longer says how it was reached, which makes it an opinion");
});

check("the unresolved flow question is recorded as unresolved, not decided", () => {
  assert.strictEqual(R.flow_undetermined.count, R.flow_undetermined.members.length);
  for (const m of R.flow_undetermined.members) {
    assert.ok(m.question, `${m.type}: no question recorded`);
    assert.ok(m.provisional_reading, `${m.type}: no provisional reading recorded`);
    assert.ok(!/^(yes|no)$/i.test(String(m.provisional_reading).trim()),
      `${m.type}: a provisional reading has hardened into a verdict; it is an authored legal decision and this file is not where it is made`);
  }
});

check("the legal frame was verified against sources, and says so", () => {
  /*
   * This block was rewritten after the user declined to accept the premise on the
   * investigation's own assertion. The draft was wrong in BOTH directions — it
   * understated the authority against damage-barring clauses and missed a whole
   * statutory route — which is the case for the standing rule below rather than
   * against it.
   */
  const v = R.verification;
  assert.ok(v?.performed_on && v.method && v.sources?.length >= 5,
    "the verification record has been removed or thinned; the legal frame is only executable because of it");
  assert.ok(/does not become executable knowledge on the strength of the investigation's own assertion/i.test(v.$standing_rule)
    || /No legal proposition .* own assertion/i.test(v.$standing_rule),
    "the standing rule that assertions are not knowledge has been softened");
  assert.ok(v.what_changed?.length >= 3,
    "what verification corrected is no longer recorded, which makes the check look like a formality it was not");
});

check("every authority carries its court and its verification state", () => {
  /*
   * A citation with no verification state is indistinguishable from one recalled
   * rather than read, and recalling case law confidently is exactly how D4.28's
   * near-miss happened.
   */
  const f = R.central_finding.legal_frame;
  assert.ok(f.authorities.length >= 6, "authorities have been dropped");
  for (const a of f.authorities) {
    assert.ok(a.case, "an authority with no case name");
    assert.ok(a.verified, `${a.case}: no verification state recorded`);
    if (/REPORTED_UNVERIFIED/.test(a.verified)) {
      assert.ok(/do not cite|may change|not confirmed/i.test(a.verified),
        `${a.case}: marked unverified without saying what follows from that`);
    } else {
      assert.ok(a.court, `${a.case}: verified but no court recorded`);
    }
  }
});

check("the two authorities that make this an open question are both present", () => {
  /*
   * Bharathi Knitting enforces a very low threshold cap. Simplex voids an absolute
   * bar. PLUS 91 draws the line between them. A nil-computing formula sits ON that
   * line, and dropping either side of it would turn an open question into a false
   * conclusion in one direction or the other.
   */
  const names = R.central_finding.legal_frame.authorities.map((a) => a.case).join(" | ");
  for (const needed of ["Bharathi Knitting", "Simplex Concrete Piles", "PLUS 91"]) {
    assert.ok(names.includes(needed), `${needed} has been dropped; without it the finding collapses to one side`);
  }
  const q = R.central_finding.legal_frame.the_question_authority_actually_answers;
  assert.ok(/no decision found addresses it|not answered|unsettled/i.test(q.unsettled),
    "the record now claims the authorities answer the question they were read to establish they do not");
});

check("the consumer families are not given the commercial answer", () => {
  /*
   * The draft said India has no Unfair Contract Terms Act and stopped there. True
   * of commercial contracts; misleading as a general statement, because the
   * Consumer Protection Act 2019 confers an unfairness jurisdiction that reaches
   * TERMS_OF_SERVICE and PRIVACY_POLICY. A single characterisation across all
   * seven families would be wrong for those two.
   */
  const r = R.central_finding.legal_frame.statutory_route_the_draft_missed;
  assert.ok(/Consumer Protection Act, 2019/.test(r.act));
  assert.ok(r.s_49_2 && /null and void/i.test(r.s_49_2),
    "the power to declare a consumer term void is no longer recorded");
  for (const fam of ["TERMS_OF_SERVICE", "PRIVACY_POLICY"]) {
    assert.ok(r.consequence_for_this_portfolio.includes(fam),
      `${fam} is no longer identified as consumer-facing, so it would inherit the commercial answer`);
  }
});

check("the finding is certified as pending, not as a legal conclusion", () => {
  const w = R.central_finding.legal_frame.what_this_makes_the_finding;
  assert.strictEqual(w.certification, "AUTHORED_DECISION_PENDING",
    "the characterisation question has been certified as decided; the authorities read do not decide it");
  /*
   * This check first looked for the word "not" inside the value. Two mistakes in one
   * line: it enforced a WORD rather than a property, which is the D4.28 failure, and
   * the pattern was written through a non-raw Python string so the word boundary
   * became a literal control character — the D4.21 failure. Both are recorded in
   * investigation-methodology.json and both happened again here.
   *
   * What actually matters is that both halves are present and say different things.
   */
  assert.ok(typeof w.not === "string" && w.not.trim(),
    "the record no longer says what this finding is NOT, which is the half that stops it being over-read");
  assert.ok(w.is && w.is !== w.not,
    "the two halves have collapsed into one, so the record no longer distinguishes the question from the conclusion");
});

check("the method limit keeps the remaining families as NOT_KNOWN", () => {
  const m = R.method_limit;
  assert.ok(/NOT_KNOWN/.test(m.status_of_the_remaining_families),
    "the WELL_DEFINED question has been marked resolved for families no probe has been able to test");
  assert.ok(/every numeric question with 3/.test(m.finding),
    "the reason the fixture cannot test magnitude is no longer recorded");
});

check("the crosswalk keeps D4.27 and D4.29 from reading as contradictory", () => {
  const c = R.crosswalk_to_d427;
  assert.ok(c.axis_d427 && c.axis_d429 && c.axis_d427 !== c.axis_d429,
    "the two taxonomies no longer record that they classify on different axes");
  for (const d of c.differences) {
    assert.ok(d.reconciliation, `${d.type}: a difference with no reconciliation is a contradiction`);
  }
});

/* ── THE INTERACTION LAYER MUST NOT BE RESOLVED HERE ──────────────────────── */

check("the NDA chain is recorded without deciding the interaction question", () => {
  const i = R.interaction_layer_note;
  assert.strictEqual(i.status, "recorded, not decided",
    "the measurement record has resolved the INTERACTION layer; the five-layer decomposition exists precisely so that one layer cannot resolve another as a side effect");
  assert.ok(i.partial_mitigation && /Specific Relief/.test(i.partial_mitigation),
    "the equitable-relief mitigation has been dropped, which overstates the exposure");
});

console.log(`\n${checks} checks passed`);
