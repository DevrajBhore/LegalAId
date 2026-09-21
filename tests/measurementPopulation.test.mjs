/**
 * measurementPopulation.test.mjs — MEMBERSHIP MUST NOT DEPEND ON THE RESULT
 *
 * The historical 40-family population is irrecoverable. The temptation is to
 * define the next one as "whatever generates today", which would make a family
 * leave the population the moment it broke: the measurement stays green, and the
 * regression disappears by definition rather than by repair.
 *
 * So the rule is asserted, not the number. The count is measured from the rule
 * and compared against the record, which fails if either drifts.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const P = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/measurement-population.json"), "utf8"));

const BP_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
const blueprintNames = new Set(
  fs.readdirSync(BP_DIR).filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.blueprint\.json$|\.json$/, "")));

check("the recommended rule is satisfiable with no exceptions", () => {
  /*
   * Every registry entry names a blueprint and every one of those files exists.
   * A missing blueprint fails here rather than being skipped at generation time,
   * which is the point of choosing a rule that is decidable statically.
   */
  const broken = Object.entries(DOCUMENT_TYPE_REGISTRY)
    .filter(([, e]) => !e.blueprintName || !blueprintNames.has(e.blueprintName))
    .map(([t, e]) => `${t} -> ${e.blueprintName || "(no blueprintName)"}`);
  assert.deepStrictEqual(broken, [],
    `registry entries name a blueprint that does not exist: ${broken.join(", ")}. Either the blueprint was removed or the entry is wrong; the population rule cannot be applied until one is corrected.`);
});

check("the recorded count is the count the rule produces", () => {
  /*
   * Asserted against a live computation rather than a pinned literal. If the
   * registry gains or loses a family the record has to be updated deliberately,
   * and if the record is edited without the registry changing that fails too.
   */
  const live = Object.keys(DOCUMENT_TYPE_REGISTRY).length;
  const rule = P.candidate_rules.find((r) => r.id === P.recommendation.rule);
  assert.ok(rule, "the recommended rule is not among the candidates");
  assert.strictEqual(rule.count, live,
    `the record says the rule yields ${rule.count} and it yields ${live} today`);
  assert.strictEqual(P.recommendation.count_that_follows, live,
    "the recommendation's count no longer matches the registry");
});

check("membership by generation success is recorded as rejected, with its reason", () => {
  /*
   * The load-bearing refusal. If this ever becomes the rule, every one of the
   * eleven currently-failing families silently leaves the population.
   */
  const r = P.independence_condition.rejected_rule;
  assert.ok(/currently generate/i.test(r.rule), "the rejected rule is no longer the endogenous one");
  assert.ok(/endogenous/i.test(r.why_rejected) && /by definition rather than by repair/i.test(r.why_rejected),
    "the reason for rejecting it has been softened; without it someone will reach for the convenient rule again");
  assert.ok(/Choosing the population that makes the tests green is choosing the answer/i.test(P.independence_condition.$governance),
    "the governance principle has been dropped");
});

check("every candidate rule is decidable without generating", () => {
  for (const r of P.candidate_rules) {
    assert.strictEqual(r.decidable_without_generating, true,
      `${r.id} is recorded as requiring generation to decide membership, which makes it endogenous`);
  }
});

check("the baseline is not cited as corroborating the registry", () => {
  /*
   * clause-baseline.json holds the same 40 types, and freezeClauseBaseline builds
   * it by iterating the registry. One source counted twice. The coincidence is
   * exactly the shape that invites the wrong inference — including the inference
   * that the historical population has been recovered, which it has not.
   */
  const a = P.an_apparent_corroboration_that_is_not_one;
  assert.ok(/by construction/i.test(a.why_it_proves_nothing),
    "the record no longer says the agreement is by construction");
  const freeze = fs.readFileSync(path.join(ROOT, "scripts/freezeClauseBaseline.mjs"), "utf8");
  assert.ok(/Object\.keys\(DOCUMENT_TYPE_REGISTRY\)/.test(freeze),
    "freezeClauseBaseline no longer derives its types from the registry, so this record's claim about the two agreeing by construction is stale");
});

check("the rule was chosen before the number, and the record says so", () => {
  assert.ok(/not chosen because it produces 40/i.test(P.recommendation.$order_matters),
    "the record no longer states that the count followed the rule rather than the other way round");
  assert.ok(/RESULT about the product rather than a definition/i.test(P.recommendation.what_it_makes_measurable),
    "the record no longer distinguishes the generation result from the population definition");
});

check("the families the rules disagree about are named and left open", () => {
  /*
   * Three look superseded and three are live instruments the registry does not
   * list. Nothing in either artifact records the intent, so a mechanical rule
   * would be inventing product scope.
   */
  const d = P.what_the_rules_disagree_about;
  const all = [...d.apparently_superseded.blueprints, ...d.unlisted_instruments.blueprints];
  assert.strictEqual(all.length, d.count, "the orphan count and the enumerated blueprints disagree");
  for (const name of all) {
    assert.ok(blueprintNames.has(name), `${name} is recorded as an orphan blueprint but no such file exists`);
    const named = Object.values(DOCUMENT_TYPE_REGISTRY).some((e) => e.blueprintName === name);
    assert.ok(!named, `${name} is now named by a registry entry; the disagreement it represents has been resolved and the record should say how`);
  }
  assert.ok(/authored judgement/i.test(d.unlisted_instruments.$why_it_cannot_be_settled_mechanically),
    "the record no longer says why this cannot be settled mechanically");
});

check("nothing was pinned and no continuity is claimed", () => {
  const n = P.not_done.join(" ");
  for (const [needle, why] of [
    ["No population was pinned", "the record no longer disclaims pinning"],
    ["irrecoverable", "the record no longer states that the historical population is gone"],
    ["uninterpreted", "propositionCoverage is no longer recorded as uninterpreted"],
  ]) assert.ok(n.includes(needle), why);
  assert.strictEqual(P.status, "ADOPTED");
  /*
   * Adoption settles membership and nothing else. The forbidden definition has to
   * stay forbidden in the record, because it is the one that would make every
   * unrealized family disappear.
   */
  assert.ok(/must never be used as the population/i.test(P.adoption.forbidden_definition),
    "the prohibition on defining the population by generation success has been dropped");
  assert.ok(/is an ERROR/.test(P.adoption.errors_not_exclusions),
    "a registry/blueprint mismatch is no longer recorded as an error, so it could silently shrink the population");
  assert.strictEqual(P.adoption.population_members, Object.keys(DOCUMENT_TYPE_REGISTRY).length);
});


/* ── MEMBERSHIP IS NOT REALIZATION ────────────────────────────────────────── */

check("membership and realization are recorded as different facts", () => {
  /*
   * A family that is in the population and does not generate is a measurable
   * product result. It has not left the experiment, and it is not yet evidence of
   * a knowledge gap. Collapsing the two is what would make the next round of
   * findings uninterpretable.
   */
  const r = P.population_vs_realization;
  assert.ok(r, "the membership/realization distinction has been removed");
  assert.strictEqual(r.realization_today.members, Object.keys(DOCUMENT_TYPE_REGISTRY).length,
    "the recorded membership no longer matches the registry");
  assert.strictEqual(
    r.realization_today.realize + r.realization_today.do_not_realize,
    r.realization_today.members,
    "the realization figures do not account for every member, which is how a family quietly leaves the population");
  assert.ok(/not equivalent to the product lacking/i.test(r.consequence_for_propositionCoverage),
    "the record no longer separates an unrealized family from a missing legal proposition");
});

check("the realization classification stays data and names what it does not claim", () => {
  /*
   * Three facts sitting next to each other are not a mechanism. This investigation
   * has already recorded what happens when a plausible mechanism is adopted
   * because it reaches the right conclusion — D4.25, Contract Act s.146.
   */
  const c = P.realization_classification;
  assert.ok(/DATA, NOT INTERPRETATION/i.test(c.$status), "the classification has been promoted to a finding");
  const listed = c.by_blocking_rule.flatMap((b) => b.families);
  assert.strictEqual(listed.length, P.population_vs_realization.realization_today.do_not_realize,
    "the classified families and the unrealized count disagree");
  assert.strictEqual(new Set(listed).size, listed.length, "a family is classified under two blocking rules");
  for (const t of listed) {
    assert.ok(t in DOCUMENT_TYPE_REGISTRY, `${t} is classified but is not in the population`);
  }
  const o = c.an_observation_that_is_not_yet_a_finding;
  assert.ok(o.$what_is_NOT_claimed && o.$what_would_settle_it,
    "the observation no longer records what it refuses to claim, or what would settle it");
  assert.ok(o.$note_on_the_other_six,
    "the half the shape explanation would not cover is no longer recorded, and a partial account reads as a complete one");
});

check("the D4.32 state keeps every open item open", () => {
  const s = P.d432_state;
  assert.strictEqual(s.historical_population, "IRRECOVERABLE");
  assert.strictEqual(s.baseline_repinning, "PROHIBITED");
  for (const k of ["propositionCoverage", "six_unregistered_blueprints"]) {
    assert.ok(/UNRESOLVED|unestablished/i.test(s[k]), `${k} has been marked resolved`);
  }
  assert.ok(/ADOPTED/.test(s.population_rule), "the population rule is no longer recorded as adopted");
});

console.log(`\n${checks} checks passed`);
