/**
 * investigationMethodology.test.mjs — THE RULES THIS INVESTIGATION LEARNED BY BREAKING THEM
 *
 * Five rules, each recorded because a probe here produced a wrong answer that the
 * rule would have caught. They are asserted rather than filed because the whole
 * point is that they bind the NEXT probe, and a methodology nobody checks is a
 * methodology nobody follows.
 *
 * The most load-bearing is CHECK_WHETHER_THE_SYSTEM_ALREADY_SAYS_SO. Without it
 * the measurement probes become a source of false legal conclusions — the exact
 * failure they exist to prevent, arriving through the instrument meant to prevent
 * it.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const M = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/investigation-methodology.json"), "utf8"));

check("every rule cites the phase where it was learned and what went wrong", () => {
  /*
   * A rule with no failure behind it is advice, and advice accumulates without
   * cost. These were each paid for.
   */
  assert.ok(M.rules.length >= 5, "rules have been dropped");
  for (const r of M.rules) {
    assert.ok(r.id && r.rule, "a rule with no statement");
    assert.ok(r.learned_in, `${r.id}: no phase recorded — an unattributed rule is advice`);
    assert.ok(r.what_happened?.length, `${r.id}: no failure recorded, so nothing justifies it`);
  }
});

check("the already-disclosed rule is present and names the validator that taught it", () => {
  const r = M.rules.find((x) => x.id === "CHECK_WHETHER_THE_SYSTEM_ALREADY_SAYS_SO");
  assert.ok(r, "the most load-bearing rule has been removed");
  assert.ok(/BEFORE classifying it as a defect/i.test(r.rule));
  assert.ok(r.what_happened.join(" ").includes("LIABILITY_CAP_ANSWERS_CONFLICT"),
    "the rule no longer names the existing validator that falsified the claim");
  assert.ok(r.how_to_apply, "a rule that cannot be applied is a slogan");
});

check("the five cap layers are ordered and none claims to resolve another", () => {
  const layers = M.cap_decomposition.layers.map((l) => l.layer);
  assert.deepStrictEqual(layers,
    ["MEASURE", "SCOPE", "EXCLUSIONS", "INTERACTION", "APPORTIONMENT"],
    "the cap decomposition has changed shape; measurement must come first and apportionment last");
  const interaction = M.cap_decomposition.layers.find((l) => l.layer === "INTERACTION");
  assert.ok(/measurement is unresolved/i.test(interaction.blocked_where),
    "the interaction layer no longer records that measurement blocks it");
  const app = M.cap_decomposition.layers.find((l) => l.layer === "APPORTIONMENT");
  assert.strictEqual(app.status, "UNDECIDED",
    "apportionment has been resolved; check whether a lower layer answered it as a side effect");
});

check("MEASURE carries all four sub-questions, in the order they were forced into", () => {
  /*
   * D4.27 asked "can it be computed?" and answered it. D4.28 showed that a
   * cumulative measure computes a DIFFERENT ceiling every month, so the answer
   * was necessary and not sufficient. D4.29 then found a question UNDERNEATH
   * both: whether the class of payment the clause names can arise between these
   * parties at all.
   *
   * Order is asserted rather than membership alone, because REFERENT_NON_EMPTY
   * has to come first. Asking "can the formula be computed?" invites the repair
   * of supplying the missing field, and supplying a fee to a partnership deed is
   * not a repair — partners do not pay fees to one another.
   */
  const measure = M.cap_decomposition.layers.find((l) => l.layer === "MEASURE");
  const ids = measure.sub_questions.map((s) => s.id);
  assert.deepStrictEqual(ids, ["REFERENT_NON_EMPTY", "REFERENT_OBSERVABLE", "COMPUTABLE", "WELL_DEFINED"],
    "the measurement sub-questions have changed shape or order; each was added because the one before it proved insufficient");
  const wd = measure.sub_questions.find((s) => s.id === "WELL_DEFINED");
  assert.ok(/necessary and not sufficient/i.test(wd.result),
    "the record no longer says that computability was insufficient");
  const rn = measure.sub_questions.find((s) => s.id === "REFERENT_NON_EMPTY");
  assert.ok(/exclusion of liability rather than a limitation/i.test(rn.result),
    "the record no longer says what an empty referent makes the clause into, which is the whole reason it ranks first");
});

check("the taxonomy separates intake defects from content defects from advocate decisions", () => {
  /*
   * Four families offering a basis they cannot supply is a PRODUCT defect; six
   * families containing an unmeasurable fixed basis is a CONTENT defect. Merging
   * them would put an intake question and a drafting question in one queue item.
   */
  const natures = new Set(M.finding_taxonomy.map((f) => f.nature));
  for (const n of ["INTAKE_AND_APPLICABILITY", "DOCUMENT_SEMANTICS", "ADVOCATE_DECISION"]) {
    assert.ok(natures.has(n), `the taxonomy no longer distinguishes ${n}`);
  }
  /*
   * THIS CHECK USED TO ASSERT THAT NO FAMILY APPEARED UNDER TWO NATURES, on the
   * ground that a family has one defect kind per layer. D4.29 falsified it.
   * DISTRIBUTION_AGREEMENT and SHAREHOLDERS_AGREEMENT carry both defects at the
   * MEASURE layer: the form offers a fees basis they cannot supply, and the
   * clause names fees that can never arise between these parties. Two repairs,
   * two owners, one family.
   *
   * What survives is narrower, and it is the part that does the work: a FINDING
   * has one nature, because that is what routes it to a person. So the check is
   * now on findings, not on families.
   */
  assert.ok(M.taxonomy_note?.falsified_in,
    "the correction that a family may hold more than one defect kind is no longer recorded, and the stronger claim will creep back");
  for (const f of M.finding_taxonomy) {
    assert.strictEqual(typeof f.nature, "string",
      `${f.finding}: a finding with no single nature cannot be routed to an owner`);
    assert.ok(f.owner, `${f.finding}: no owner`);
    assert.ok(!(f.members && f.members_recorded_in),
      `${f.finding}: membership is recorded in two places at once, and two copies drift`);
  }
});

check("no rule has been softened into a suggestion", () => {
  /*
   * These bind the next probe. A rule phrased as "should consider" binds nothing,
   * and the drift from must to should is how methodology quietly stops applying.
   */
  for (const r of M.rules) {
    assert.ok(!/\bshould consider\b|\bmight\b|\bwhere convenient\b/i.test(r.rule),
      `${r.id} has been softened into a suggestion`);
    /*
     * The imperative counts as an obligation too. The first version of this check
     * looked only for must/requires/never and failed READ_THE_SOURCE, which was
     * phrased as a plain instruction — the test enforcing a WORD rather than the
     * property. Both were repaired: the rule now states its obligation
     * explicitly for consistency with the other four, and the check recognises
     * imperative mood so it is testing the property and not the vocabulary.
     */
    const obligation = /\bmust\b|\brequires?\b|\bonly\b|\bnever\b|\bnot\b/i.test(r.rule)
      || /^[A-Z]?[a-z]+ (?:the |what |whether |a )/.test(r.rule.trim());
    assert.ok(obligation, `${r.id} no longer states an obligation`);
  }
});

/* ── CONSTRAINTS THAT BIND EVERY FAMILY ───────────────────────────────────── */

check("zero and unknown may not share a signal", () => {
  /*
   * The dangerous case is not the ceiling nobody can compute. It is the one that
   * computes, to nil. That passes every structural "is there a cap?" check and puts
   * a reassuring cap-present signal over a total bar on recovery.
   */
  const c = M.architectural_constraints.constraints.find((x) => x.id === "UNKNOWN_IS_NOT_ZERO");
  assert.ok(c, "the constraint separating a computed zero from an absent answer has been removed");
  assert.ok(/must never/i.test(c.constraint), "the constraint has been softened");
  assert.ok(c.test_form, "no testable form recorded, so nothing enforces it");
});

check("no Boolean stands in for the per-head interaction decision", () => {
  /*
   * Three heads are already carved out by the shipped clause and two are open. A
   * single `indemnity_inside_cap` would overwrite the three settled ones to answer
   * the two open ones — answering more than the advocate decided.
   *
   * This check is executable rather than documentary: it reads the source tree.
   */
  const c = M.architectural_constraints.constraints.find((x) => x.id === "INTERACTION_IS_PER_HEAD");
  assert.ok(c?.forbidden_shapes?.length, "the forbidden field shapes are no longer recorded");
  assert.strictEqual(c.settled_heads.length + c.open_heads.length, 5,
    "the exposure heads have changed count; the interaction question is exactly two heads wide and that is what makes it cheap to put to an advocate");

  const roots = ["backend", "knowledge-base/governance"];
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { walk(rel); continue; }
      if (!/\.(js|mjs|json)$/.test(e.name)) continue;
      /* The file that DECLARES the forbidden shapes necessarily contains them. */
      if (rel.endsWith("investigation-methodology.json")) continue;
      const body = fs.readFileSync(path.join(ROOT, rel), "utf8");
      for (const shape of c.forbidden_shapes) {
        /*
         * Case-sensitive, deliberately. cap-indemnity-interaction.json names
         * INDEMNITY_INSIDE_CAP as one CANDIDATE DIRECTION among several, which is the
         * opposite of collapsing the decision into a flag, and it is not caught. A
         * lower-case field or variable of that name is the defect this looks for.
         */
        if (new RegExp(`\\b${shape}\\b`).test(body)) offenders.push(`${rel}: ${shape}`);
      }
    }
  };
  roots.forEach(walk);
  assert.deepStrictEqual(offenders, [],
    `a Boolean now stands for the interaction decision: ${offenders.join(", ")}`);
});

check("the three liability layers still refuse to resolve one another", () => {
  const c = M.architectural_constraints.constraints.find((x) => x.id === "LAYERS_ARE_INDEPENDENT");
  assert.ok(c, "the layer-independence boundary has been removed");
  assert.deepStrictEqual(Object.keys(c.shape), ["MEASURE", "INTERACTION", "APPORTIONMENT"]);
  assert.ok(c.worked_example_of_the_temptation,
    "the worked example is gone; without it the constraint reads as abstract and the NDA chain looks like an interaction decision");
});

check("the fixture rule requires non-colliding values, not merely realistic ones", () => {
  /*
   * The magnitude problem is the visible half. The formula problem is worse: with
   * fee, investment, cap and claim all equal to 3, a cap computed from the wrong
   * quantity produces the right number and several wrong formulas agree.
   */
  const r = M.rules.find((x) => x.id === "A_UNIFORM_FIXTURE_HIDES_MAGNITUDE");
  assert.ok(/NON-COLLIDING/i.test(r.rule), "the non-collision requirement has been dropped from the rule itself");
  assert.ok(r.non_collision?.requirement, "no requirement recorded, so the rule cannot be applied");
  assert.ok(/does not prove the semantics work|semantics/i.test(r.non_collision.$why.join(" ")),
    "the record no longer distinguishes proving the path from proving the semantics");
  assert.ok(/has not been changed/i.test(r.non_collision.status),
    "the fixture is now claimed to meet the requirement; if it was actually changed, the clause baseline moved and that is its own piece of work");
});

check("the retraction register keeps every claim that was withdrawn", () => {
  /*
   * These are evidence. Every one originated in the measurement apparatus rather
   * than in the product, and that ratio is the reason the next probe gets attacked
   * before it gets believed.
   */
  const reg = M.retraction_register;
  assert.ok(reg?.entries?.length >= 11, "retractions have been dropped from the register");
  for (const e of reg.entries) {
    assert.ok(e.phase && e.nearly_claimed && e.falsified_by && e.class,
      `a retraction is missing its phase, claim, falsifier or class: ${JSON.stringify(e)}`);
  }
  const classes = new Set(reg.entries.map((e) => e.class));
  for (const needed of ["VOCABULARY", "FIXTURE", "LEGAL_FRAME", "ALREADY_DISCLOSED", "PREMATURE_ABSTRACTION"]) {
    assert.ok(classes.has(needed), `the ${needed} retraction class is no longer represented`);
  }
});

check("the verification rule binds legal propositions specifically", () => {
  const r = M.rules.find((x) => x.id === "A_LEGAL_PROPOSITION_IS_NOT_KNOWLEDGE_UNTIL_VERIFIED");
  assert.ok(r, "the rule requiring legal propositions to be verified has been removed");
  assert.ok(/own assertion/i.test(r.rule), "the rule no longer names the thing it forbids");
  const w = r.what_happened.join(" ");
  assert.ok(/UNDERSTATED/.test(w) && /OVERSTATED/.test(w) && /MISSED/.test(w),
    "the record no longer shows that the draft was wrong in both directions AND incomplete; one-directional error would be a weaker case for the rule");
});

console.log(`\nALL GREEN (${checks} checks)`);
