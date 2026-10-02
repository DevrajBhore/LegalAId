/**
 * propositionSatisfactionLayer.test.mjs — D4.36
 *
 * PINS WHAT THE PROPOSITION LAYER CAN AND CANNOT DO.
 *
 * D4.36 answered six questions about it and wired nothing in. Two answers were
 * NO — no joint satisfaction, no attribute requirements — and those are what
 * make the layer, as it stands, a relocation of the coupling rather than a
 * semantic bridge.
 *
 * This file fails if any of those answers stops being true without the record
 * being updated. A capability appearing is the intended direction; a capability
 * appearing while the record still says it is absent is how an architecture
 * document starts describing a system that no longer exists.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const R = readJson(path.join(ROOT, "knowledge-base/governance/proposition-satisfaction-layer.json"));
const VOCAB = readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json"));

const clauses = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "blueprints") walk(p); continue; }
    if (!e.name.endsWith(".json") || e.name.includes("schema")) continue;
    let doc; try { doc = readJson(p); } catch { continue; }
    for (const c of Array.isArray(doc) ? doc : [doc]) if (c?.clause_id) clauses.push(c);
  }
})(path.join(ROOT, "knowledge-base/clause_library"));

const implementers = new Map();
for (const c of clauses) for (const id of c.implements || []) {
  if (!implementers.has(id)) implementers.set(id, new Set());
  implementers.get(id).add(c.clause_id);
}

check("the three layers still point the directions the record says", () => {
  /*
   * The distinction the whole record rests on. If a `gates` edge acquired a
   * satisfaction meaning, or `implements` an applicability one, the layers
   * would have merged and the analysis would be describing a system that no
   * longer exists.
   */
  const evidence = readJson(path.join(ROOT, "knowledge-base/intake/propositions/service_practice.propositions.json"));
  assert.ok(evidence.propositions.some((p) => Array.isArray(p.gates)),
    "the evidence-proposition layer no longer declares `gates` — its applicability direction is gone.");
  assert.ok(evidence.propositions.every((p) => !p.satisfaction),
    "an evidence proposition now declares `satisfaction`. The two layers are merging, and they answer different questions.");
  assert.ok(VOCAB.propositions.every((p) => p.satisfaction),
    "a legal proposition no longer declares `satisfaction`.");
  assert.ok(VOCAB.propositions.every((p) => !p.gates),
    "a legal proposition now declares `gates`, which is the applicability layer's edge.");
});

check("satisfaction is still evaluated existentially — no joint satisfaction", () => {
  /*
   * Answer 5 was NO. Asserted against the evaluator rather than the schema,
   * because a `requires_all` key could be added to the vocabulary and quietly
   * ignored, which would be worse than not having it.
   */
  const src = fs.readFileSync(path.join(ROOT, "tests/propositionCoverage.test.mjs"), "utf8");
  assert.ok(/\.some\(/.test(src),
    "propositionCoverage no longer evaluates satisfaction existentially. If joint satisfaction was " +
    "added, update proposition-satisfaction-layer.json — its answer to question 5 is now wrong.");
  const jointly = VOCAB.propositions.filter((p) => p.requires_all || p.jointly_satisfied_by || p.satisfaction_mode);
  assert.deepStrictEqual(jointly.map((p) => p.proposition_id), [],
    "a proposition now declares a joint-satisfaction construct. That is the intended direction and the record must say so.");
});

check("satisfaction still cannot require attributes or context", () => {
  /*
   * Answer 6, the load-bearing one: satisfaction means 'a clause claiming to
   * implement this is present', which is the same test as fails_if with a name
   * in front of it.
   */
  const MODES = ["IN_THE_DOCUMENT", "OUTSIDE_THE_DOCUMENT"];
  for (const p of VOCAB.propositions) {
    assert.ok(MODES.includes(p.satisfaction),
      `${p.proposition_id}: satisfaction is "${p.satisfaction}", outside the two-valued enum the record describes.`);
    for (const key of ["requires_attributes", "subject_binding", "admissible_provenance", "satisfaction_conditions"]) {
      assert.ok(!(key in p),
        `${p.proposition_id} now declares ${key}. Satisfaction has gained a vocabulary the record says it lacks — ` +
        `update the answer to question 6 in the same change.`);
    }
  }
});

check("the implements claim is still unverified against clause text", () => {
  /*
   * The residual proxy. Nothing checks that a clause declaring it implements a
   * proposition actually discharges it, and the record says so plainly. If a
   * verification step appears, the honest summary stops being honest.
   */
  const declaring = clauses.filter((c) => (c.implements || []).length);
  assert.ok(declaring.length > 0, "no clause declares `implements` any more — the layer's only satisfaction edge is gone.");
  for (const c of declaring) {
    assert.match(String(c.implements_review_status || ""), /draft|needs/i,
      `${c.clause_id}: its implements claim is marked reviewed. An advocate-confirmed claim is a stronger ` +
      `artifact than this record describes — update the "what would still be a proxy" section.`);
  }
});

check("the layer is still almost entirely unpopulated", () => {
  /*
   * A SHARE of the recorded figure, not an equality: populating it is the point,
   * and this should not fail because someone did the right thing. It fails when
   * the record's characterisation — 'any claim about behaviour at scale is a
   * claim about code that has never run on real data' — stops holding.
   */
  const rec = R.the_layer_is_almost_entirely_unpopulated;
  const declaring = clauses.filter((c) => (c.implements || []).length).length;
  assert.ok(declaring >= rec.clauses_declaring_implements,
    `clauses declaring implements fell from ${rec.clauses_declaring_implements} to ${declaring}. The layer is being removed, not populated.`);
  if (declaring > rec.clauses_declaring_implements * 3) {
    assert.fail(
      `clauses declaring implements rose from ${rec.clauses_declaring_implements} to ${declaring}. That is the ` +
      `intended direction — update proposition-satisfaction-layer.json, which still describes both plural cases as unexercised.`);
  }
});

check("both plural cases are still unexercised, or the record says otherwise", () => {
  const multiProposition = clauses.filter((c) => (c.implements || []).length > 1).map((c) => c.clause_id);
  const multiImplementer = [...implementers.entries()].filter(([, s]) => s.size > 1).map(([id]) => id);
  const rec = R.the_layer_is_almost_entirely_unpopulated;
  if (rec.clauses_implementing_more_than_one_proposition === 0)
    assert.deepStrictEqual(multiProposition, [],
      `${multiProposition.join(", ")} now implements more than one proposition. The record calls that case unexercised.`);
  if (rec.propositions_with_more_than_one_implementer === 0)
    assert.deepStrictEqual(multiImplementer, [],
      `${multiImplementer.join(", ")} now has more than one implementer. The record calls that case unexercised.`);
});

check("nothing was wired into the constraint engine", () => {
  /*
   * Scope assertion. D4.36 was to answer six questions, not to build the bridge.
   */
  const dir = path.join(ROOT, "knowledge-base/constraints");
  const migrated = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const body = readJson(path.join(dir, f));
    for (const r of (body.rules || body.constraints || []))
      if (r.requires_proposition || r.satisfied_by_proposition || r.proposition) migrated.push(r.rule_id);
  }
  assert.deepStrictEqual(migrated, [],
    `${migrated.join(", ")} now expresses a requirement as a proposition. That is the migration D4.36 ` +
    `deliberately did not perform; the record must stop saying nothing was wired in.`);
});

check("the record keeps the near-miss that produced it", () => {
  /*
   * The analysis was one paragraph from reporting that no satisfaction relation
   * existed anywhere, because two directories share the word 'propositions'.
   * A later reader who sees only the conclusion would not know how close the
   * opposite conclusion came, or what caught it.
   */
  const c = R.a_correction_i_nearly_shipped;
  assert.ok(c?.what_caught_it && c.$the_recurring_error,
    "the record no longer states that it nearly concluded the satisfaction relation was absent, or what caught it.");
});

check("the four prerequisites stay requirements, not a design", () => {
  const w = R.what_the_layer_would_need_before_it_could_carry_constraints;
  assert.ok(/REQUIREMENTS, NOT A DESIGN/i.test(String(w.$status || "")),
    "the prerequisites section now reads as a design. D4.36 establishes what would be needed; it does not propose how.");
  assert.ok((w.items || []).length >= 4, "a prerequisite was dropped from the list.");
});

console.log(`\n${checks} checks passed`);
