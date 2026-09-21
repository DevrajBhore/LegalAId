/**
 * constraintApplicability.test.mjs — UNDECLARED SCOPE IS UNIVERSAL SCOPE
 *
 * Eleven of the forty population members do not generate. The mechanism is
 * established: the evaluator's machinery is sound and the declarations are empty.
 * contract.constraints.json and employment.constraints.json carry thirteen rules
 * between them and not one declares a document type or a shape, and an undeclared
 * scope means the rule applies to everything.
 *
 * So an affidavit is required to have lawful consideration.
 *
 * These checks assert the CURRENT state, defect included. When the scoping is
 * authored they will fail, and that failure is the signal to update the record
 * rather than to relax the assertion.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runConstraints } from "../IRE/src/indian-rule-engine/constraintEngine.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { documentShape } from "../shared/documentShape.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const R = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/constraint-applicability.json"), "utf8"));
const rulesOf = (f) => JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/constraints", f), "utf8")).rules || [];

check("the evaluator still distinguishes not-applicable from failed", () => {
  /*
   * The finding is about declarations, not machinery. If that stops being true —
   * if the evaluator loses the distinction — this record's whole reading changes.
   */
  const src = fs.readFileSync(
    path.join(ROOT, "IRE/src/indian-rule-engine/constraintEngine.js"), "utf8");
  for (const outcome of ["not_applicable", "no_assertion", "pass"]) {
    assert.ok(src.includes(`outcome: "${outcome}"`), `the evaluator no longer records ${outcome}`);
  }
  assert.ok(/documentShape/.test(src), "the evaluator no longer consults documentShape");
  assert.ok(/if \(!Array\.isArray\(rule\.applies_to_doc_types\)\) return true;/.test(src),
    "the undeclared-means-universal line has changed; this record's mechanism rests on it");
});

check("the two constraint sets still declare no scoping at all", () => {
  /*
   * THE DEFECT ITSELF. It fails when someone authors the scoping, which is the fix
   * landing — update knowledge-base/governance/constraint-applicability.json and
   * record the decision rather than loosening this.
   */
  let total = 0;
  for (const f of ["contract.constraints.json", "employment.constraints.json"]) {
    for (const rule of rulesOf(f)) {
      total += 1;
      const scoped = rule.applies_to_doc_types || rule.excludes_doc_types || rule.excludes_shapes;
      assert.ok(!scoped,
        `${f}:${rule.rule_id} now declares a scope. If that was authored deliberately, the decision CONSTRAINT_SCOPE_DECLARATIONS has been made and belongs in the governance record.`);
    }
  }
  assert.strictEqual(total, 13, `the two sets now hold ${total} rules; the record describes 13`);
});

check("the scoping vocabulary is used elsewhere, so the gap is a declaration gap", () => {
  /*
   * Without this the finding would read as a missing feature. It is not: the
   * mechanism exists and other constraint sets use it.
   */
  const users = fs.readdirSync(path.join(ROOT, "knowledge-base/constraints"))
    .filter((f) => f.endsWith(".json"))
    .filter((f) => rulesOf(f).some((r) =>
      r.applies_to_doc_types || r.excludes_doc_types || r.excludes_shapes));
  assert.ok(users.length >= 2,
    "no constraint set declares scoping any more, so the vocabulary may have been removed and this record is stale");
});

check("both rules still reach every family, including instruments that are not bargains", () => {
  const rules = [...rulesOf("contract.constraints.json"), ...rulesOf("employment.constraints.json")];
  const types = Object.keys(DOCUMENT_TYPE_REGISTRY);
  for (const id of ["CONTRACT_REQUIRES_CONSIDERATION", "EMP_REQUIRES_ROLE"]) {
    const outcomes = types.map((t) => {
      const e = runConstraints([], rules, t, {}).evaluated.find((x) => x.rule_id === id);
      return e ? e.outcome : "(absent)";
    });
    const notApplicable = outcomes.filter((o) => o === "not_applicable").length;
    assert.strictEqual(outcomes.filter((o) => o === "(absent)").length, 0,
      `${id} is no longer among the evaluated rules; the harness or the rule set has changed`);
    assert.strictEqual(notApplicable, 0,
      `${id} is now recorded not_applicable for ${notApplicable} families. That is the scoping being authored — record the decision.`);
  }
  const nonBargain = types.filter((t) => documentShape(t) !== "AGREEMENT");
  assert.ok(nonBargain.length >= 5,
    "the shape taxonomy no longer classifies any family as something other than an agreement");
});

check("the falsification control is recorded and both halves are explained", () => {
  /*
   * A shape-only account would have covered five of eleven and read as complete.
   * The requirement that an account explain both halves is what forced the
   * type-inappropriate six into view.
   */
  const f = R.falsification;
  assert.match(f.result, /^SURVIVES\b/, "the falsification result has changed");
  const how = f.how.join(" ");
  assert.ok(/SHAPE-INAPPROPRIATE/.test(how) && /TYPE-INAPPROPRIATE/.test(how),
    "the two manifestations are no longer distinguished, and a partial account reads as a complete one");
  assert.ok(/BOTH halves/i.test(f.requirement), "the control has been dropped from the requirement");
});

check("the legal question is left to an advocate, and says why", () => {
  const d = R.decision_required;
  assert.strictEqual(d.status, "UNDECIDED");
  assert.ok(/not a mechanical repair/i.test(d.$constraint),
    "the record no longer says this cannot be fixed mechanically");
  assert.ok(R.what_is_NOT_established.length >= 3,
    "the record no longer bounds what the mechanism does not establish");
});

console.log(`\n${checks} checks passed`);
