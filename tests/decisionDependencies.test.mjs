/**
 * decisionDependencies.test.mjs — THE SIX DECISIONS ARE NOT A FLAT LIST
 *
 * D4.24 measured the dependency structure among the open N-party decisions
 * before anybody authors one. Two properties came out of it and both are
 * load-bearing:
 *
 *   1. The structure is THIN — no DETERMINES edges, one GATES edge — so
 *      conditionality is modelled as named edges and NOT as a general engine
 *      mechanism. This test holds that line: if a general mechanism ever appears,
 *      it should be because more gates were found, and this will say so.
 *
 *   2. LIABILITY_CAP_APPORTIONMENT and INDEMNITY_APPORTIONMENT constrain EACH
 *      OTHER. A cycle has no order, so they cannot be scheduled one after the
 *      other — and the first version of the ordering did exactly that by skipping
 *      bidirectional edges while computing in-degrees, hiding the cycle inside
 *      the thing meant to reveal it.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const dd = JSON.parse(fs.readFileSync(
  path.join(ROOT, "docs/audit/decision-dependencies.json"), "utf8"));
const treatments = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/nparty-treatments.json"), "utf8"));

check("the matrix covers exactly the open decisions, and no stale ones", () => {
  const live = treatments.decisions.map((d) => d.decision_id).sort();
  assert.deepStrictEqual([...dd.decisions].sort(), live,
    "the matrix and the decision file disagree about which decisions exist");
});

check("every non-independent edge carries a worked instance", () => {
  /*
   * An edge without a concrete three-party situation is an opinion about a
   * diagram. This is the same bar D4.23 had to clear by enumerating pair-regimes.
   */
  for (const c of dd.claims) {
    assert.ok(["DETERMINES", "GATES", "CONSTRAINS"].includes(c.edge),
      `${c.from}→${c.to}: a claimed edge must be one of the three non-independent kinds`);
    assert.ok(c.instance && c.instance.length > 120,
      `${c.from}→${c.to}: no worked instance — the edge is asserted, not demonstrated`);
  }
});

check("the GATES edge matches the conditional decision it describes", () => {
  /*
   * The matrix and the decision record must agree. If TERMINATION_FOR_DEFAULT_SCOPE
   * stops gating survival — or survival loses its conditional_on — one of the two
   * is stale and the backlog ordering built on it is wrong.
   */
  const gates = dd.claims.filter((c) => c.edge === "GATES");
  assert.strictEqual(gates.length, 1, `expected exactly 1 GATES edge, found ${gates.length}`);
  const g = gates[0];
  const child = treatments.decisions.find((d) => d.decision_id === g.to);
  assert.ok(child.conditional_on, `${g.to} is gated by the matrix and carries no conditional_on`);
  assert.strictEqual(child.conditional_on.decision_id, g.from,
    "the matrix and the decision record name different parents");
});

check("a mutually constraining pair is never given a sequence", () => {
  /*
   * THE CHECK THAT CAUGHT THE BUG. Two decisions that constrain each other must
   * appear in the SAME tier, as one joint node. Sequencing them invites an
   * advocate to answer each coherently and the instrument incoherently.
   */
  const bidi = dd.claims.filter((c) => c.bidirectional);
  assert.ok(bidi.length >= 1, "no mutual constraint recorded; the cycle finding has been lost");
  for (const c of bidi) {
    const tierOf = (id) => dd.tiers.findIndex((t) => t.some((n) => n.split(" + ").includes(id)));
    assert.strictEqual(tierOf(c.from), tierOf(c.to),
      `${c.from} and ${c.to} constrain each other and were placed in different tiers — ` +
      `the cycle has been broken silently, which is what the first version of this ordering did`);
    const joint = dd.tiers.flat().find((n) => n.includes(" + ") && n.includes(c.from));
    assert.ok(joint, `${c.from} and ${c.to} are not collapsed into a joint node`);
  }
});

check("no general conditionality mechanism was built on one instance", () => {
  /*
   * The restraint this phase exists to record. One gate is not a case for an
   * engine. If this assertion ever has to change, it should be because more gates
   * were measured — so the failure message says what evidence would justify it.
   */
  assert.strictEqual(dd.counts.DETERMINES, 0,
    "a DETERMINES edge has appeared; the 'named edges, not a mechanism' conclusion needs revisiting");
  assert.ok(dd.counts.GATES <= 2,
    `${dd.counts.GATES} GATES edges now exist. The D4.24 conclusion rested on there being one. ` +
    `Re-run the matrix and decide deliberately whether a general treatment-level conditionality ` +
    `mechanism is now justified, rather than inheriting a conclusion drawn from a single instance`);
});

check("the inconsistency risk is recorded with computed arithmetic", () => {
  /*
   * The finding that outranks conditionality: the danger is answers that
   * contradict, not questions that vanish. It is computed rather than asserted,
   * because the narrative first claimed PER_PARTY + SEVERAL_TO_EACH was coherent
   * and the arithmetic showed it is not.
   */
  const risky = dd.claims.filter((c) => c.risk);
  assert.ok(risky.length >= 2, "the named risks have been dropped");
  const cap = dd.claims.find((c) => c.risk === "INCONSISTENT_ANSWERS");
  assert.ok(cap, "the cap/indemnity inconsistency is no longer recorded");
  assert.ok(/CORRECTED/i.test(cap.instance),
    "the record no longer says that the computation corrected the first narrative — " +
    "which is the reason the arithmetic is there at all");
});

console.log(`\nALL GREEN (${checks} checks)`);
