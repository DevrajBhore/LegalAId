/**
 * satisfactionOwnership.test.mjs — D4.40
 *
 * PINS AN ARCHITECTURE DECISION TO THE EVIDENCE THAT DECIDED IT.
 *
 * The decision rests on one measured asymmetry: the concept layer ASSUMES when
 * a question is unresolved, the evidence layer ESCALATES, and the legal
 * proposition layer has no such construct at all. `assume: present` turned
 * around into satisfaction reads "assume the requirement is met", which is the
 * false positive four phases were spent measuring.
 *
 * If that asymmetry disappears, the decision is unsupported and someone has to
 * know before building on it.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getClauseById, getBlueprintForDocumentType, preloadKnowledgeBase } from "../backend/services/clauseAssembler.js";
import { resolveConcept as resolveConceptLive } from "../backend/services/conceptResolver.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

preloadKnowledgeBase({});
const D = readJson(path.join(ROOT, "knowledge-base/governance/satisfaction-ownership-decision.json"));

const concepts = fs.readdirSync(path.join(ROOT, "knowledge-base/concepts"))
  .filter((f) => f.endsWith(".json") && !f.includes("schema") && f !== "dimensions.json")
  .map((f) => readJson(path.join(ROOT, "knowledge-base/concepts", f)));

check("the concept layer still assumes when a question is unresolved — measured on behaviour", () => {
  /*
   * CORRECTED IN D4.41. This check once counted DECLARATIONS, and three of the
   * seven declared assumptions (assume:present) are not implemented. The decision
   * rests on what EXECUTES: safe_default turns an unresolved concept into PRESENT.
   */
  const live = concepts.filter((c) => {
    const r = resolveConceptLive(c, {}, {});
    return r.assumed && r.state === "PRESENT";
  });
  assert.ok(live.length >= 1,
    "no concept now turns 'cannot establish' into 'applies' when run. That live behaviour — not the declarations — is " +
    "D4.40's decisive evidence; without it the decision needs re-examining.");
  /*
   * The load-bearing measurement. If concepts stopped assuming, the asymmetry
   * that disqualified them from owning satisfaction would be gone.
   */
  /* Declarations, kept only as context and labelled as such: 7 declare, 4 execute.
     The three assume:present declarations are a known gap (concept-layer-gaps.json),
     so they are NOT cited here as the construct that inverts — safe_default is. */
  const declaring = concepts.filter((c) => {
    const a = c.unresolved_behaviour?.assume;
    return a && a !== "none";
  });
  assert.ok(declaring.length >= live.length,
    "fewer concepts declare an assumption than execute one — the declarations and the evaluator have diverged the other way.");
});

check("the evidence layer still escalates rather than assuming", () => {
  const ev = readJson(path.join(ROOT, "knowledge-base/intake/propositions/service_practice.propositions.json"));
  const modes = new Set(ev.propositions.map((p) => p.when_unknown));
  assert.deepStrictEqual([...modes], ["ESCALATE"],
    `evidence propositions now use ${[...modes].join(", ")} on unknown. The contrast with the concept layer ` +
    `is half the argument, and the discipline D4.40 says transfers to satisfaction is exactly this one.`);
});

check("the legal proposition layer still has no assumption construct", () => {
  /*
   * For satisfaction this absence is a feature: nothing is established until
   * something establishes it. If a default appears here, the layer has acquired
   * the very construct it was chosen for lacking.
   */
  const v = readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json"));
  const keys = new Set(v.propositions.flatMap((p) => Object.keys(p)));
  const offenders = [...keys].filter((k) => /assum|default|unresolved/i.test(k));
  assert.deepStrictEqual(offenders, [],
    `the legal proposition vocabulary gained ${offenders.join(", ")}. It was chosen to own satisfaction ` +
    `partly BECAUSE it had no assumption machinery; adding one reopens D4.40.`);
});

/* ── Case G's correction, which the repository had already made ───────────── */

check("the polarity repair is still demonstrated in production", () => {
  /*
   * MOU_BINDING_001 / MOU_NON_BINDING_001 behind a variant slot is what makes
   * case G1 an authoring task rather than a new primitive. If it regresses,
   * case G returns to the new-primitive column.
   */
  const binding = getClauseById("MOU_BINDING_001");
  const nonBinding = getClauseById("MOU_NON_BINDING_001");
  assert.ok(binding && nonBinding, "one of the MOU polarity clauses no longer exists.");
  assert.deepStrictEqual(binding.implements, ["LEGAL_RELATIONS_INTENDED"],
    "MOU_BINDING_001 no longer implements LEGAL_RELATIONS_INTENDED — the demonstration that `implements` on a " +
    "clause id is world-correct when the id differs by world.");
  assert.ok(!nonBinding.implements,
    "MOU_NON_BINDING_001 now declares implements. It asserts the OPPOSITE position; annotating it is the error " +
    "the two-clause pattern exists to avoid.");
  const bp = getBlueprintForDocumentType("MOU");
  const slot = (bp?.variant_clauses || []).find((v) => v.replaces === "MOU_NON_BINDING_001");
  assert.ok(slot && (slot.select_first_match || []).some((o) => o.clause === "MOU_BINDING_001"),
    "the MOU variant slot no longer selects between the two positions, so the pattern is no longer demonstrated.");
});

check("the one clause still awaiting the polarity repair still withholds its claim", () => {
  /*
   * TECH_SOURCE_CODE_001 states the obligation in one world and its absence in
   * the other under one id. Its annotation was authored and withdrawn. If an
   * implements appears without the clause being split, a false claim has been
   * made in one of the two worlds.
   */
  const c = getClauseById("TECH_SOURCE_CODE_001");
  assert.ok(c, "TECH_SOURCE_CODE_001 no longer exists.");
  assert.ok(!c.implements,
    "TECH_SOURCE_CODE_001 now declares implements. Unless it was split into two clause ids behind a variant " +
    "slot, that annotation is false in one of the two worlds — which is why the earlier one was withdrawn.");
});

check("the second G1 hazard still carries no implements claim", () => {
  /*
   * Found in D4.41: IP_OWNERSHIP_001 renders a client-exclusive assignment in one
   * world and a label-slot 'Shared IP' allocation in another, under one id. A claim
   * on that id would have to hold in every world that renders it.
   */
  const c = getClauseById("IP_OWNERSHIP_001");
  assert.ok(c, "IP_OWNERSHIP_001 no longer exists.");
  assert.ok(!c.implements,
    "IP_OWNERSHIP_001 now declares implements. Its rendered text differs materially by world under one id; confirm the " +
    "claim holds in the Shared world too, or split the clause as MOU_BINDING_001 / MOU_NON_BINDING_001 were split.");
});

check("case G is recorded as corrected, not silently restated", () => {
  const g = D.a_correction_to_case_G_the_repository_had_already_made;
  assert.ok(g?.what_is_actually_true?.G1_polarity_under_one_id && g.what_is_actually_true.G2_about_but_not_establishing,
    "the case G correction no longer splits G1 from G2. They have different verdicts — one solved by an " +
    "existing pattern, one withdrawn as an artifact of the measuring instrument.");
  assert.match(String(g.what_is_actually_true.G2_about_but_not_establishing.verdict || ""), /NOT DEMONSTRATED/,
    "G2 is no longer recorded as not demonstrated. It came from my category heuristic, not from the production path.");
  assert.strictEqual(g.consequence_for_the_D4_39_tally?.now?.startsWith("2"), true,
    "the tally correction from 3 new primitives to 2 was dropped.");
});

/* ── The decision must stay a decision, not become an implementation ─────── */

check("no schema, no migration, no implements expansion", () => {
  assert.ok(/no schema, no code, nothing migrated/i.test(String(D.status || "")),
    "the decision's status no longer disclaims a schema or a migration.");
  const v = readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json"));
  const declaring = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "blueprints") walk(p); continue; }
      if (!e.name.endsWith(".json") || e.name.includes("schema")) continue;
      let doc; try { doc = readJson(p); } catch { continue; }
      for (const c of Array.isArray(doc) ? doc : [doc]) if (c?.implements?.length) declaring.push(c.clause_id);
    }
  })(path.join(ROOT, "knowledge-base/clause_library"));
  assert.ok(declaring.length <= 4,
    `${declaring.length} clauses now declare implements (${declaring.join(", ")}). D4.40 explicitly did not ` +
    `authorise expanding it; if a migration began, it needs its own record.`);
  assert.strictEqual(v.propositions.length, 12,
    `the proposition vocabulary changed size. D4.40 decided ownership, not content.`);
});

/* ── Ownership of meaning is not ownership of mechanism ──────────────────── */

check("the proposition layer's applicability is still deliberately narrow", () => {
  /*
   * `always: true`, or one position and its value. That narrowness is
   * load-bearing: if applicability here grows into a general predicate tree,
   * applicability semantics have migrated into the satisfaction layer and the
   * three questions have started to collapse.
   */
  const v = readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json"));
  const shapes = new Set(v.propositions.map((p) =>
    Object.keys(p.applicability || {}).sort().join("+")));
  const allowed = new Set(["always", "position+value"]);
  const grown = [...shapes].filter((s) => !allowed.has(s));
  assert.deepStrictEqual(grown, [],
    `legal proposition applicability gained the shape(s) ${grown.join(", ")}. D4.40 records that its ` +
    `narrowness is load-bearing — a general predicate tree here is applicability semantics moving into the ` +
    `satisfaction layer.`);
});

check("there is still no third expression evaluator", () => {
  /*
   * The repository carries exactly two closed evaluators: the blueprint gate
   * grammar in clauseAssembler, and the concept detection predicates in
   * conceptResolver. A third would be a new dialect with its own drift, and
   * D4.40's operational form is: if implementing satisfaction requires writing
   * an expression evaluator, stop.
   */
  const evaluators = [];
  for (const dir of ["backend/services", "backend/commercial"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!f.endsWith(".js")) continue;
      const src = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
      if (/case\s+"eq"|case\s+"present"|case\s+"gte"|case\s+"lte"/.test(src)) evaluators.push(`${dir}/${f}`);
    }
  }
  assert.deepStrictEqual(evaluators, ["backend/services/conceptResolver.js"],
    `predicate evaluation now lives in ${evaluators.join(", ")}. The repository had exactly one predicate ` +
    `evaluator plus the blueprint gate grammar; a third dialect is the boundary D4.40 draws being crossed.`);
});

check("the ownership-is-not-mechanism boundary is recorded", () => {
  const b = D.ownership_of_meaning_is_not_ownership_of_mechanism;
  assert.ok(b?.what_the_evidence_does_NOT_support?.length >= 3,
    "the three things the evidence does not support — duplicating the predicate engine, a second expression " +
    "language, moving applicability into propositions — were dropped.");
  assert.ok(b.$the_operational_form,
    "the operational form was dropped. Without it the boundary is a sentiment rather than a rule someone can apply.");
});

check("the three questions are kept apart in the record", () => {
  const q = D.the_three_questions_kept_apart;
  assert.strictEqual((q?.questions || []).length, 3, "the three-question boundary was altered.");
  for (const item of q.questions) {
    assert.ok(item.owner && item.truth_maker,
      `question ${item.n} no longer names both its owner and its truth-maker. The truth-maker is what makes ` +
      `the separation a safety property rather than a filing convention.`);
  }
});

check("the falsifiers are stated", () => {
  const f = D.what_would_falsify_this?.conditions || [];
  assert.ok(f.length >= 3, "the falsifiers were dropped. A decision with no falsifier is a preference.");
  assert.ok(/assuming the requirement met is the correct behaviour/i.test(JSON.stringify(f)),
    "the primary falsifier — a satisfaction case where assumption is correct — was dropped.");
});

check("the six legal judgements are unchanged and still six", () => {
  const j = D.the_six_legal_judgements_are_unchanged?.judgements || [];
  assert.strictEqual(j.length, 6,
    `${j.length} judgements recorded, expected 6. The decision moves no work from the advocate to the engine; ` +
    `a list that shrank means a judgement was absorbed into a default.`);
});

console.log(`\n${checks} checks passed`);
