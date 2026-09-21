/**
 * constraintScope.test.mjs — THE SCOPE IS AUTHORED IN PROSE AND DECLARED NOWHERE
 *
 * D4.32 established that an undeclared scope is a universal one. D4.33 asked what
 * each of the thirteen rules is a rule ABOUT, and the answer turned out to be
 * written on each rule already: every one of them opens "Employment contract
 * must…", "Every contract must…", "All contracts must…". The scope is not
 * unknown. It is unencoded.
 *
 * These checks assert the current state, defect included, and they assert the
 * record's refusals — that no scope has been chosen and no rule called wrong.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const S = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/constraint-scope.json"), "utf8"));
const rulesOf = (f) => JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/constraints", f), "utf8")).rules || [];
const live = [...rulesOf("contract.constraints.json"), ...rulesOf("employment.constraints.json")];

check("every rule surveyed is still in the constraint files, with its proposition intact", () => {
  assert.strictEqual(S.rules.length, live.length,
    `the survey covers ${S.rules.length} rules and the files hold ${live.length}`);
  for (const r of S.rules) {
    const actual = live.find((x) => x.rule_id === r.rule_id);
    assert.ok(actual, `${r.rule_id} is no longer in the constraint files`);
    assert.strictEqual(actual.description, r.proposition,
      `${r.rule_id}: the proposition has been reworded. The survey reads scope out of this sentence, so a rewording changes the finding.`);
  }
});

check("every rule still names its instrument class in prose and declares none as data", () => {
  /*
   * THE DEFECT ITSELF. It fails when a scope is authored, which is the decision
   * landing — record it in constraint-scope.json rather than relaxing this.
   */
  const SUBJECT = /^(Employment contracts?|Every contract|All contracts|Contracts)\b/;
  for (const r of live) {
    assert.match(r.description, SUBJECT,
      `${r.rule_id} no longer states its instrument class in its description; the survey's reading of it is stale`);
    const declared = r.applies_to_doc_types || r.excludes_doc_types || r.excludes_shapes;
    assert.ok(!declared,
      `${r.rule_id} now declares a scope as data. If CONSTRAINT_SCOPE_DECLARATIONS has been decided for it, record the decision and its authority.`);
  }
});

check("the counterfactuals keep not_applicable separate from pass", () => {
  /*
   * The invariant that stops this becoming an exercise in turning eleven failures
   * into eleven passes. A rule scoped out of an instrument has not been satisfied
   * by it.
   */
  assert.ok(/not_applicable is NOT pass/i.test(S.counterfactuals.$invariant),
    "the invariant has been dropped");
  assert.ok(/not to turn 11 failures into 11 passes/i.test(S.counterfactuals.$invariant),
    "the record no longer says what the goal is not");
  for (const c of S.counterfactuals.candidates) {
    for (const k of ["not_applicable", "pass", "fail"]) {
      assert.strictEqual(typeof c.result[k], "number", `${c.id}: ${k} is not recorded as a measured number`);
    }
    assert.ok(c.reading, `${c.id}: no reading recorded`);
  }
});

check("the literal-description candidate carries why it is probably too narrow", () => {
  /*
   * C1 produces zero failures, which is exactly the shape of an answer that looks
   * finished. It makes every employment protection not_applicable to an
   * appointment letter, and that is a decision rather than a side effect.
   */
  const c1 = S.counterfactuals.candidates.find((x) => x.id === "C1_LITERAL_DESCRIPTION");
  assert.strictEqual(c1.result.fail, 0);
  /*
   * Checked as a property, not a word. The first version of this matched /too
   * narrow/ against the VALUE while the phrase lives in the KEY — the same mistake
   * recorded twice already in investigation-methodology.json.
   */
  assert.ok(typeof c1.why_it_is_probably_too_narrow === "string" && c1.why_it_is_probably_too_narrow.length > 60,
    "the caution on the zero-failure candidate has been removed");
  assert.ok(/APPOINTMENT_LETTER/.test(c1.why_it_is_probably_too_narrow),
    "the instruments it would exclude are no longer named");
});

check("the portfolio measurement records how far past the eleven this reaches", () => {
  const e = S.portfolio_measurement.employment_rules_today;
  assert.strictEqual(e.not_applicable, 0, "employment rules are now scoped; the measurement is stale");
  assert.ok(e.fail > 300 && e.families_with_any_failure >= 39,
    "the portfolio-wide figures have changed; re-measure before treating the record as current");
  assert.ok(/visible tip/i.test(S.portfolio_measurement.reading.join(" ")),
    "the record no longer distinguishes the blocking failures from the portfolio-wide ones");
});

check("the scope must be encoded as a declaration, not in code", () => {
  const h = S.how_the_answer_must_be_encoded;
  assert.ok(/scope declaration/.test(h.correct) && /JavaScript/.test(h.incorrect),
    "the encoding direction has been lost");
  assert.ok(/already exists and is used/.test(h.$why),
    "the record no longer notes that the vocabulary exists, which is what makes a code special-case inexcusable");
});

check("nothing has been decided and no rule called wrong", () => {
  /*
   * Two statuses, deliberately. The investigation is complete; the decision is
   * not. Collapsing them would let a finished investigation read as a settled
   * question, which is the whole thing this phase refused to do.
   */
  assert.strictEqual(S.decision_status, "UNDECIDED");
  assert.ok(/INVESTIGATION COMPLETE/.test(S.investigation_status),
    "the investigation status has changed; if it reopened, say why");
  assert.ok(S.$two_statuses, "the record no longer explains why the two statuses are separate");
  const n = S.what_this_record_does_not_do.join(" ");
  for (const [needle, why] of [
    ["does not choose a scope", "the record no longer disclaims choosing"],
    ["not the same as the instrument being entitled to omit", "the record no longer separates a rule firing from a rule being wrong"],
    ["may be correctly blocked", "the record no longer allows that some of the eleven should fail"],
    ["changes no constraint file", "the record no longer states that nothing was edited"],
  ]) assert.ok(n.includes(needle), why);
});


/* ── THE GAP, AND THE SHEET THAT CLOSES IT ───────────────────────────────── */

check("the scope-encoding gap is recorded as a production-validity condition", () => {
  /*
   * The dangerous conversion, stated once so it cannot be argued back:
   *
   *   "we have not encoded what the author said"  ->  "the author said this
   *   applies everywhere"
   *
   * Those are opposite claims. One admits incompleteness; the other asserts a
   * legal reach no advocate made.
   */
  const v = S.production_validity;
  assert.ok(v, "the production-validity condition has been removed");
  assert.strictEqual(v.rules_failing_it, v.of,
    "some rules now pass the condition; if a scope was encoded, the decision belongs in the sheet");
  assert.ok(/not enforced in the evaluator/i.test(v.$note),
    "the record no longer says the condition is not enforced, and someone will assume generation is gated on it");
});

check("the representable dimensions are read from the engine, not imagined", () => {
  /*
   * An advocate's answer has to land in this vocabulary or the vocabulary has to
   * grow — and knowing which is part of the decision rather than a detail after it.
   */
  const d = S.representable_dimensions;
  const engine = fs.readFileSync(
    path.join(ROOT, "IRE/src/indian-rule-engine/constraintEngine.js"), "utf8");
  for (const key of Object.keys(d.rule_level_applicability).filter((k) => !k.startsWith("$"))) {
    assert.ok(engine.includes(`rule.${key}`), `${key} is recorded as representable but the engine does not read it`);
  }
  for (const key of ["doc_type_in", "state_in", "clause_present", "clause_absent", "category_present"]) {
    assert.ok(engine.includes(`predicate.${key}`), `${key} is recorded as a predicate the engine does not implement`);
  }
  assert.ok(/no first-class representation is INSTRUMENT CHARACTER/i.test(d.reading.join(" ")),
    "the vocabulary gap is no longer recorded, so a finer distinction would be approximated with a type list and nobody would know");
});

check("the decision sheet has a row per rule and every answer is still open", () => {
  /*
   * Asserts an ABSENCE. It fails when an answer is filled in, which is exactly
   * when it should have an authority behind it.
   */
  const sheet = S.decision_sheet;
  assert.strictEqual(sheet.rows.length, S.rules.length, "the sheet and the survey disagree on the rule count");
  for (const row of sheet.rows) {
    assert.ok(row.question && row.sub_questions.length >= 4, `${row.rule_id}: the question is incomplete`);
    assert.strictEqual(row.answer, null,
      `${row.rule_id} has been answered inside the sheet that exists to say it is not yet answered. Record the authority and who decided it.`);
    assert.strictEqual(row.authority, null, `${row.rule_id} carries an authority with no answer`);
  }
  assert.ok(/An answer without an authority is not a decision/i.test(sheet.$invariant),
    "the invariant binding an answer to its authority has been dropped");
});

console.log(`\n${checks} checks passed`);
