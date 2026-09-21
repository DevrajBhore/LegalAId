/**
 * declinedProtectionsFinding.test.mjs — NINE PLACES A DECLINE IS NOT HONOURED
 *
 * declinedProtections.test.mjs asserts the invariant and fails. This file asserts
 * the FINDING — where it fails, and how much of the why is established — so that
 * a repair to one class cannot quietly look like a repair to all three.
 *
 * It asserts the current state, defect included. When a class is repaired these
 * fail, and that failure is the signal to update the record.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { getVariables } from "../backend/config/variableConfig.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const acheck = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };
const D = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/declined-protections.json"), "utf8"));

const draftFor = async (type) => {
  const out = await generateDocument({
    document_type: type, variables: variablesFor(type, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED }),
  });
  return out?.draft?.clauses || [];
};

await acheck("every recorded occurrence still occurs, with the recorded injector", async () => {
  for (const role of D.occurrences.by_role) {
    for (const type of role.members) {
      const clauses = await draftFor(type);
      assert.ok(clauses.length, `${type} no longer generates; the occurrence cannot be checked`);
      const clause = clauses.find((c) => c.clause_id === role.clause);
      assert.ok(clause,
        `${type}: ${role.clause} no longer appears despite the decline. If that class was repaired, update knowledge-base/governance/declined-protections.json rather than this assertion.`);
      const stamp = clause.injected_by || "(none recorded)";
      assert.strictEqual(stamp, role.injected_by,
        `${type}: injected_by is now "${stamp}" and the record says "${role.injected_by}". A new stamp is progress — record what it revealed.`);
    }
  }
});

check("the total matches the enumerated members", () => {
  const listed = D.occurrences.by_role.reduce((n, r) => n + r.members.length, 0);
  assert.strictEqual(listed, D.occurrences.total, "the by-role members and the total disagree");
  for (const r of D.occurrences.by_role) {
    assert.strictEqual(r.families, r.members.length, `${r.role}: family count and member list disagree`);
  }
});

await acheck("the control still respects the decline, so the gate is not the mechanism", async () => {
  /*
   * SERVICE_AGREEMENT carries the identical conditional gate AND the identical
   * per-document hardening entry as the three NOMENCLATURE failures. It respects
   * the decline. That is what rules the declaration out as the cause and leaves
   * the dependency resolver as the one stated mechanism.
   */
  const clauses = await draftFor("SERVICE_AGREEMENT");
  assert.ok(clauses.length, "the control no longer generates");
  assert.ok(!clauses.some((c) => c.clause_id === "CORE_DEFINITIONS_001"),
    "SERVICE_AGREEMENT now carries CORE_DEFINITIONS_001 despite the decline; the control is gone and the NOMENCLATURE finding needs re-deriving");
  assert.ok(/RESPECTS the decline/i.test(D.established.control),
    "the control is no longer recorded, and without it the mechanism reads as a guess");
});

check("only the stamped class is recorded as established", () => {
  /*
   * The discipline this investigation keeps returning to: a plausible mechanism
   * that reaches the right conclusion is still not a mechanism.
   */
  assert.ok(/dependencyResolver/.test(D.established.evidence),
    "the established class no longer cites the stamp that establishes it");
  assert.strictEqual(D.not_established.classes.length, 2,
    "the number of unexplained classes has changed without the record saying why");
  assert.ok(/cannot choose between them/i.test(D.not_established.why.join(" ")),
    "the record now claims to know how the unstamped six arrive");
  assert.ok(D.not_established.$a_hypothesis_i_did_not_adopt,
    "the rejected hypothesis is no longer recorded; it is the reason the control was built");
});

check("the provenance gap is recorded and not repaired", () => {
  const g = D.the_provenance_gap_is_the_deeper_finding;
  assert.ok(/Three of nine can; six cannot/i.test(g.statement),
    "the stamped/unstamped split is no longer stated");
  assert.ok(/Recorded, not repaired/i.test(g.$scope),
    "the record no longer says the gap was left alone");
});

check("the MOU case is kept separate from the other eight", () => {
  /*
   * Its blueprint marks the clause REQUIRED. A clause appearing despite a decline
   * may be the blueprint doing its job, which makes it an intake/knowledge
   * disagreement rather than an injection bug — a different repair.
   */
  const c = D.not_all_nine_are_necessarily_defects;
  assert.ok(/REQUIRED/.test(c.$caution) && /intake\/knowledge disagreement/i.test(c.$caution),
    "the MOU case is no longer distinguished; merging it would produce one repair for three problems");
  assert.ok(/Three candidate repairs, not one/i.test(c.consequence),
    "the record no longer keeps the three repairs apart");
});

check("nothing was repaired and the test under investigation is not reinterpreted", () => {
  const n = D.what_this_record_does_not_do.join(" ");
  assert.ok(/does not repair anything/i.test(n));
  assert.ok(/the test is correct/i.test(n),
    "the record no longer affirms that declinedProtections is right to fail");
});

check("the three investigations stay separate and none is marked repaired", () => {
  /*
   * The boundary that stops a repair of A making B and C look resolved. They have
   * different causes, different owners and different repairs.
   */
  const t = D.three_investigations;
  const ids = Object.keys(t).filter((k) => !k.startsWith("$"));
  assert.deepStrictEqual(ids, ["A_DECLINE_PRECEDENCE", "B_CLAUSE_PROVENANCE", "C_INTAKE_KNOWLEDGE_CONSISTENCY"],
    "the three investigations have changed shape");
  for (const id of ids) {
    assert.strictEqual(t[id].repaired, false, `${id} is marked repaired; record what changed and re-derive the others`);
    assert.ok(t[id].owner, `${id}: no owner, so it cannot be routed`);
  }
  assert.strictEqual(t.C_INTAKE_KNOWLEDGE_CONSISTENCY.which_is_correct, "NOT ESTABLISHED",
    "the intake/knowledge question has been answered; that is an advocate decision and needs its authority recorded");
  assert.ok(/not six injection defects/i.test(t.B_CLAUSE_PROVENANCE.$what_it_is_not),
    "B has collapsed into six injection defects; the finding is that the origin is unknown, not that six stages misbehaved");
  assert.ok(/distinct and should not be merged/i.test(t.B_CLAUSE_PROVENANCE.$on_the_analogy),
    "the record no longer separates clause provenance from measurement provenance");
});

check("both invariants keep their refusals attached", () => {
  /*
   * Each invariant is dangerous without the half that says what NOT to encode.
   * "A decline must survive assembly" collapses into "the user always wins" if the
   * higher-authority clause is dropped.
   */
  const inv = Object.fromEntries(D.invariants_emerging.map((i) => [i.id, i]));
  const a = inv.A_NEGATIVE_DECISION_MUST_SURVIVE_ASSEMBLY;
  assert.ok(/unless a higher-authority legal requirement has been established/i.test(a.statement),
    "the exception has been dropped and the invariant now says a decline always wins");
  assert.strictEqual(a.what_must_NOT_be_encoded.length, 2,
    "one of the two forbidden encodings has been removed; both directions are wrong and the record needs both");
  assert.ok(/knowledge model, not from the order the stages happen to run/i.test(a.$the_load_bearing_phrase),
    "the record no longer says where the hierarchy comes from");
  const b = inv.A_SHIPPED_CLAUSE_MUST_SAY_WHY_IT_IS_THERE;
  assert.ok(/Not necessarily one injector name/i.test(b.$not_a_schema),
    "the provenance invariant has hardened into a particular field, which would make a stamp look like a fix");
  assert.ok(/not implemented/i.test(b.$status), "the provenance invariant is now claimed as implemented");
});

console.log(`\n${checks} checks passed`);
