/**
 * npartyDiscoveryValidation.test.mjs — THE DETECTOR IS THE THING UNDER TEST
 *
 * D4.22 falsified marker-based discovery for this corpus. The three experiments
 * that did it have to stay runnable, because the conclusion they support —
 * PRESUME RELEVANT, DISCHARGE THE IRRELEVANT — is now load-bearing.
 *
 * The check that matters most is the ablation. Strip the characteristic
 * vocabulary from six clauses known to be cardinality-sensitive and five become
 * undiscoverable. If that ever stops being true, either the detectors have
 * genuinely improved or somebody has quietly re-tuned them to the test, and
 * either way the recorded conclusion needs revisiting rather than inheriting.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { treatmentFor, TREATMENT } from "../backend/services/npartyTreatment.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const doc = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/nparty-discovery-validation.json"), "utf8"));

/* The dependency graph, rebuilt here so the test does not trust the probe. */
function edges() {
  const out = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith(".json")) continue;
      let j; try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
      for (const c of Array.isArray(j) ? j : (j.clauses || [j])) {
        for (const t of c?.depends_on || []) out.push([c.clause_id, t]);
      }
    }
  })(path.join(ROOT, "knowledge-base/clause_library"));
  return out;
}
const dep = new Map();
for (const [a, b] of edges()) { if (!dep.has(a)) dep.set(a, new Set()); dep.get(a).add(b); }
const isOpen = (id) => {
  const t = treatmentFor(id, 3);
  return t.outcome === TREATMENT.UNRESOLVED && Boolean(t.shape);
};
function inherits(id, seen = new Set()) {
  for (const n of dep.get(id) || []) {
    if (seen.has(n)) continue;
    seen.add(n);
    if (isOpen(n) || inherits(n, seen)) return true;
  }
  return false;
}

check("the model counterexample is recovered structurally, not lexically", () => {
  /*
   * CORE_SURVIVAL_001 asks what stands after termination, and whether
   * termination ends the instrument or one relationship is UNDECIDED. The edge
   * is authored in the clause library; no word in the survival clause says any
   * of this.
   */
  assert.ok(dep.get("CORE_SURVIVAL_001")?.has("CORE_TERMINATION_001"),
    "the declared dependency survival→termination is gone; the structural detector has nothing to walk");
  assert.ok(inherits("CORE_SURVIVAL_001"),
    "CORE_SURVIVAL_001 no longer inherits an open question — either the edge or the decision moved");
});

check("the structural detector is high-precision and near-zero-recall, and says so", () => {
  /*
   * Inheritance can only reach as far as the open decisions extend. Recording it
   * as a general solution would be the overclaim this phase exists to prevent.
   */
  const reached = [...new Set([...dep.keys()])].filter((id) => inherits(id));
  assert.ok(reached.length >= 1, "the detector reaches nothing at all");
  assert.ok(reached.length <= 12,
    `the detector now reaches ${reached.length} clauses — if inheritance has genuinely broadened, ` +
    `the near-zero-recall finding in nparty-discovery-validation.json is stale and must be re-measured`);
});

check("the ablation result is recorded with five of six lost", () => {
  const a = doc.ablation.results;
  assert.strictEqual(a.length, 6);
  const survived = a.filter((r) => r.survives);
  assert.strictEqual(survived.length, 1,
    "the ablation no longer loses five of six — re-run it before trusting the conclusion built on it");
  assert.strictEqual(survived[0].clause_id, "CORE_SURVIVAL_001");
  assert.strictEqual(survived[0].structural, true,
    "the survivor survived lexically, which would mean the ablation did not actually strip the vocabulary");
  for (const r of a) {
    assert.strictEqual(r.lexical_after, false,
      `${r.clause_id} is still found lexically after ablation — the stripping is incomplete`);
  }
});

check("the read sample is reproducible and its arithmetic holds", () => {
  const s = doc.read_sample;
  assert.ok(/deterministic/i.test(s.method),
    "a sample chosen non-deterministically cannot be re-run, so its rate cannot be checked");
  const v = {};
  for (const a of s.adjudications) v[a.verdict] = (v[a.verdict] || 0) + 1;
  assert.strictEqual(s.adjudications.length, s.result.read);
  assert.strictEqual(v.RELEVANT || 0, s.result.relevant);
  assert.strictEqual(v.NOT_RELEVANT || 0, s.result.not_relevant);
  assert.strictEqual(v.UNDETERMINED || 0, s.result.undetermined);
  for (const a of s.adjudications) {
    if (a.verdict === "RELEVANT") {
      assert.ok(a.question, `${a.clause_id}: relevant without a stated question`);
      assert.ok(a.missed_because,
        `${a.clause_id}: a false negative must say WHY the detector missed it, or it teaches nothing`);
    } else {
      assert.ok(a.reason, `${a.clause_id}: no reason recorded`);
    }
  }
});

check("no single coverage percentage is reported", () => {
  /*
   * Precision, recall and ablation survival measure different failures and were
   * required to be reported separately. One blended number would hide that the
   * detector is 89% precise and roughly 42% sensitive.
   */
  const text = JSON.stringify(doc.summary);
  assert.ok(/precision/i.test(text) && /recall/i.test(text) && /ablation/i.test(text),
    "the three measures are no longer reported separately");
  assert.ok(!/\bcoverage\s*[:=]\s*\d/i.test(text), "a single coverage figure has appeared");
});

check("UNDETERMINED dominates, and is not treated as cleared", () => {
  assert.ok(doc.summary.undetermined > doc.summary.positively_discharged_as_irrelevant * 10,
    "the undetermined population has collapsed — check whether clauses were discharged on absence of evidence");
  assert.ok(doc.summary.positively_discharged_as_irrelevant < 10,
    "a large number of clauses were certified irrelevant; that requires positive evidence per clause");
});

check("the presumption of relevance is recorded as a rule, with its asymmetry", () => {
  /*
   * The load-bearing conclusion of D4.22, promoted from a probe result to a
   * methodological rule. Detection proposes; it never closes. If this ever
   * softens into "detection may certify", the three experiments that established
   * it have been forgotten rather than overturned.
   */
  const r = doc.methodological_rule;
  assert.ok(r, "the methodological rule is gone");
  assert.ok(/presumed/i.test(r.rule), "the presumption has been dropped from the rule");
  assert.ok(/may not\s+CERTIFY|may not certify/i.test(r.rule),
    "the rule no longer forbids detection from certifying relevance — the asymmetry is the whole point");
  assert.ok(/discharge/i.test(r.rule), "the rule no longer says detection may discharge");
  const consequences = r.consequences.join(" ");
  assert.ok(/NOT YET SEMANTICALLY DISCHARGED/i.test(consequences),
    "NOT_CLASSIFIED's meaning is no longer pinned, so it can drift back to 'probably irrelevant'");
  assert.ok(/separately/i.test(consequences) && /blend/i.test(consequences),
    "the separate-reporting requirement has been lost");
  assert.ok(r.accounting?.right?.length,
    "the corrected accounting model is missing; the old flat count can return");
});

console.log(`\nALL GREEN (${checks} checks)`);
