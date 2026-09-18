/**
 * representability.test.mjs — D4.30 CLOSURE: THREE KINDS OF NOT-KNOWING
 *
 * The third state is the new one. UNASKABLE means the legal question is
 * well-formed and the fact that answers it is not represented anywhere in the
 * system — so there is nothing for an advocate to decide, and no amount of
 * further analysis of the clause discharges it.
 *
 * These checks exist because the state is most likely to be lost by accident.
 * NOT_CLASSIFIED is sitting right there, it looks like a fit, and treating a
 * representability failure as a backlog item is how it would disappear.
 *
 * This file is deliberately self-contained: it reads its own record and the
 * engine, and asserts nothing about the other governance files, so it can be run
 * and proved on a checkout that does not yet carry them.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const R = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/representability.json"), "utf8"));
const ENGINE = fs.readFileSync(
  path.join(ROOT, "backend/services/documentService.js"), "utf8");

/* ── THE THREE STATES ─────────────────────────────────────────────────────── */

check("all three states are present and each says what discharges it", () => {
  /*
   * The discharge condition is the load-bearing field. It is what tells you WHO
   * has to do something next, and it is the only thing that distinguishes the
   * three in practice.
   */
  const ids = R.states.map((s) => s.id);
  assert.deepStrictEqual(ids, ["ESTABLISHED", "UNDECIDED", "UNASKABLE"],
    "the state set has changed shape");
  for (const s of R.states) {
    assert.ok(s.definition && s.discharged_by, `${s.id}: no definition or discharge condition`);
  }
});

check("UNASKABLE is not dischargeable by looking harder", () => {
  /*
   * This is the whole distinction from NOT_CLASSIFIED. If the discharge condition
   * ever becomes "examine the clause", the state has quietly become a backlog item.
   */
  const u = R.states.find((s) => s.id === "UNASKABLE");
  assert.ok(/NOT by further analysis|not.*by looking/i.test(u.discharged_by),
    "UNASKABLE no longer records that analysis does not discharge it, which is what separates it from NOT_CLASSIFIED");
  assert.ok(/does not represent/i.test(u.definition),
    "UNASKABLE no longer turns on the absence of a representation");
  assert.ok(/^NONE\b/.test(u.engine_equivalent),
    "UNASKABLE has been mapped onto an existing engine kind; the finding is that none of them fits");
});

check("nothing has been promoted to ESTABLISHED", () => {
  const e = R.states.find((s) => s.id === "ESTABLISHED");
  assert.strictEqual(e.present_count_in_this_investigation, 0,
    "a proposition is now recorded as established; gate 5 requires an advocate and none has reviewed anything");
});

/* ── THE COLLAPSE ─────────────────────────────────────────────────────────── */

check("the three states are forbidden from sharing a signal", () => {
  const c = R.the_collapse_that_must_not_happen;
  assert.ok(/must never share a signal/i.test(c.rule), "the prohibition has been softened");
  assert.ok(/generic UNKNOWN/i.test(c.rule),
    "the record no longer forbids the generic UNKNOWN, which is the shape all three would collapse into");
  assert.strictEqual(c.why_each_merge_is_wrong.length, 3,
    "a merge has stopped being explained; an unexplained prohibition is one somebody will reverse");
  assert.ok(/three different people/i.test(c.why_each_merge_is_wrong.join(" ")),
    "the record no longer says that the states route to different people, which is the practical cost of merging them");
});

/* ── THE ENGINE, READ RATHER THAN RECALLED ────────────────────────────────── */

check("the engine still emits exactly the two kinds this record maps against", () => {
  /*
   * CHECK_WHETHER_THE_SYSTEM_ALREADY_SAYS_SO, applied to the vocabulary. If a third
   * kind appears in buildOpenTreatments, the mapping here is stale and the new kind
   * may be absorbing UNASKABLE without anyone deciding that it should.
   */
  const declared = R.engine_state_mapping.what_exists.map((k) => k.kind);
  const found = [...new Set((ENGINE.match(/kind: treatment\.shape \? "([A-Z_]+)" : "([A-Z_]+)"/) || [])
    .slice(1))];
  assert.deepStrictEqual(found.sort(), [...declared].sort(),
    `documentService now emits ${found.join(", ")}; representability.json maps against ${declared.join(", ")}`);
});

check("no generic catch-all state has appeared in the engine", () => {
  /*
   * An asserted absence. It fails the moment someone introduces a state that would
   * swallow all three, which is exactly when this record needs to be re-read.
   */
  const bad = /kind:\s*"(UNKNOWN|UNSPECIFIED|OTHER|TBD)"/.exec(ENGINE);
  assert.strictEqual(bad, null,
    `a catch-all state ${bad?.[1]} now exists in documentService; the three kinds of not-knowing would collapse into it`);
});

check("the engine's own refusal to merge two states is still recorded as precedent", () => {
  const p = R.the_collapse_that_must_not_happen.$precedent;
  assert.ok(/buildOpenTreatments/.test(p), "the precedent no longer names where it lives");
  assert.ok(ENGINE.includes("TWO DIFFERENT KINDS OF NOT-KNOWING"),
    "the engine comment this record builds on has been removed; the precedent citation is now dangling");
  assert.ok(ENGINE.includes('treatment.decision || "UNDECIDED"'),
    "the engine no longer emits the word UNDECIDED in place of omitting the key, and this record cites that as the same discipline");
});

check("the existing kinds are recorded as N-party scoped, not as general states", () => {
  /*
   * They fire only where the roster exceeds two principals. Reading them as the
   * system's general vocabulary for not-knowing would overstate what exists and
   * make the gap look smaller than it is.
   */
  const m = R.engine_state_mapping;
  assert.ok(/N-party/i.test(m.scope_of_the_existing_kinds) && /two principals/i.test(m.scope_of_the_existing_kinds),
    "the scope limit on the existing kinds is no longer recorded");
  assert.ok(ENGINE.includes("if (!(roster.count > 2)) return [];"),
    "the guard that limits open treatments to more than two principals has changed; the scope note is stale");
  assert.ok(/not a matter of adding a third enum value/i.test(m.consequence),
    "the record now implies the fix is a third enum value, which is a solution nobody has established");
});

/* ── THE WORKED CASE ──────────────────────────────────────────────────────── */

check("the worked case ends in UNASKABLE and disclaims the legal conclusion", () => {
  const w = R.worked_case;
  assert.strictEqual(w.certification, "UNASKABLE");
  assert.ok(w.chain.length >= 5 && /cannot be entered|UNASKABLE/i.test(w.chain.at(-1)),
    "the chain no longer terminates in the state it is there to illustrate");
  assert.ok(/not a finding that the clause is unfair, or that it is not/i.test(w.what_it_is_not),
    "the worked case no longer disclaims the conclusion in both directions, and one-directional disclaimers get read as the other answer");
});

/* ── THE BOUNDARY INTO D4.31 ──────────────────────────────────────────────── */

check("the determination steps are recorded as questions and remain unanswered", () => {
  /*
   * This asserts an ABSENCE, deliberately. The tempting move from a representability
   * finding is to add the fields the law mentions. That is a jump from finding to
   * solution, and this check fails the moment an answer is filled in — which is the
   * point at which it should have had evidence behind it.
   */
  const d = R.deliberately_not_done;
  assert.strictEqual(d.the_determination_that_must_come_first.length, 6,
    "the determination chain has changed length");
  for (const s of d.the_determination_that_must_come_first) {
    assert.ok(s.question, `step ${s.step}: no question`);
    assert.strictEqual(s.answer, null,
      `step ${s.step} has been answered inside the record that exists to say it is not yet answered. If evidence now supports it, that is D4.31 and it needs its own governance entry, not a filled-in null.`);
  }
  assert.ok(/does not tell us what data model/i.test(d.$note.join(" ")),
    "the record no longer says that a legal concept does not imply a data model");
});

check("the record states its own strength and builds nothing", () => {
  const n = R.what_this_record_does_not_do.join(" ");
  for (const [needle, why] of [
    ["does not add a field", "the record no longer disclaims implementation"],
    ["does not decide any characterisation", "the record no longer disclaims the legal conclusion"],
    ["one family's evidence", "the record no longer states that the three states came from one family and are held at that strength"],
  ]) assert.ok(n.includes(needle), why);
  assert.strictEqual(R.review_status, "draft-needs-legal-review");
});

console.log(`\n${checks} checks passed`);
