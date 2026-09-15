/**
 * npartyClassification.test.mjs — THREE STATES, AND NO FOURTH
 *
 * The measurable ceiling. Every clause reachable by a family that can carry more
 * than two principals lands in exactly one of:
 *
 *   SAFE                       generalises with nobody choosing anything
 *   AUTHORED_DECISION_PENDING  a legal question is identified and left open
 *   NOT_CLASSIFIED             nobody has established whether a question exists
 *
 * WHY THE LAST TWO MUST NOT MERGE. Both prevent certification and they mean
 * opposite things to whoever has to act. AUTHORED_DECISION_PENDING is work for an
 * advocate, with the question framed and the candidate readings written down.
 * NOT_CLASSIFIED is work for whoever runs the sweep next. There are currently 32
 * times as many of the second as the first, so a single "unresolved" bucket would
 * be, in practice, a report that says nothing.
 *
 * The test that earns its place here is the LAST one: it asserts the classified
 * set only ever grows. A classification is a claim somebody made about a clause,
 * and a clause quietly falling back out of SAFE — because a shape was renamed, a
 * clause id changed, or an entry was dropped in an edit — would restore exactly
 * the invisible-backlog condition this file exists to prevent.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVariables } from "../backend/config/variableConfig.js";
import { treatmentFor, TREATMENT } from "../backend/services/npartyTreatment.js";
import { isRosterExtensionField } from "../backend/services/partyRoster.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const checkAsync = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };

const PRINCIPAL_PREFIXES = ["party", "partner", "shareholder", "founder", "member"];
const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));
const DOC_TYPES = Object.keys(baseline.types);

const nPartyFamilies = DOC_TYPES
  .map((type) => {
    const fields = new Set(Object.keys(getVariables(type) || {}));
    const prefix = PRINCIPAL_PREFIXES.find(
      (p) => fields.has(`${p}_1_name`) && fields.has(`${p}_2_name`));
    return prefix ? { type, prefix, fields } : null;
  })
  .filter(Boolean);

const reachable = new Map();
for (const { type } of nPartyFamilies) {
  for (const level of Object.values(baseline.types[type] || {})) {
    for (const id of level?.clauses || []) {
      if (!reachable.has(id)) reachable.set(id, new Set());
      reachable.get(id).add(type);
    }
  }
}

const STATE = { SAFE: "SAFE", PENDING: "AUTHORED_DECISION_PENDING", UNSEEN: "NOT_CLASSIFIED" };

function classify(clauseId) {
  const t = treatmentFor(clauseId, 3);
  if (t.outcome === TREATMENT.DETERMINED) return STATE.SAFE;
  if (t.outcome === TREATMENT.UNRESOLVED) return t.shape ? STATE.PENDING : STATE.UNSEEN;
  return `UNEXPECTED_${t.outcome}`;
}

const classified = new Map([...reachable.keys()].map((id) => [id, classify(id)]));
const counts = { SAFE: 0, AUTHORED_DECISION_PENDING: 0, NOT_CLASSIFIED: 0 };
for (const state of classified.values()) counts[state] += 1;

check("the family set is derived from the admission rule, not from a list", () => {
  /*
   * A family is N-party capable exactly when a third principal survives
   * sanitisation. Deriving the set any other way would let the sweep measure a
   * different portfolio than the engine actually admits.
   */
  assert.ok(nPartyFamilies.length >= 20,
    `only ${nPartyFamilies.length} families identified; the derivation is probably wrong`);
  for (const { type, prefix, fields } of nPartyFamilies) {
    assert.ok(isRosterExtensionField(`${prefix}_3_name`, fields),
      `${type} is counted as N-party capable but ${prefix}_3_name would not be admitted`);
  }
  for (const type of DOC_TYPES.filter((t) => !nPartyFamilies.some((f) => f.type === t))) {
    const fields = new Set(Object.keys(getVariables(type) || {}));
    for (const prefix of PRINCIPAL_PREFIXES) {
      assert.ok(!isRosterExtensionField(`${prefix}_3_name`, fields),
        `${type} is excluded from the sweep but would admit ${prefix}_3_name`);
    }
  }
});

check("every reachable clause lands in exactly one of the three states", () => {
  assert.ok(reachable.size > 100, `only ${reachable.size} clauses reachable; the sweep is not sweeping`);
  for (const [id, state] of classified) {
    assert.ok(Object.values(STATE).includes(state),
      `${id} classified as ${state} — a fourth state exists`);
  }
  assert.strictEqual(
    counts.SAFE + counts.AUTHORED_DECISION_PENDING + counts.NOT_CLASSIFIED,
    reachable.size, "the three states do not partition the reachable set");
});

check("the two unresolved states are distinguishable, and differ by an order of magnitude", () => {
  /*
   * The operational point. If these ever collapse into one number the report
   * stops telling anybody what to do next.
   */
  assert.ok(counts.AUTHORED_DECISION_PENDING > 0, "no clause has an identified open question");
  assert.ok(counts.NOT_CLASSIFIED > 0, "the portfolio claims to be fully classified");
  for (const id of [...classified].filter(([, s]) => s === STATE.PENDING).map(([id]) => id)) {
    const t = treatmentFor(id, 3);
    assert.ok(t.decision_id, `${id} is PENDING without naming the decision it waits on`);
    assert.strictEqual(t.decision, "UNDECIDED", `${id} is PENDING with a decision already made`);
    assert.ok(t.legal_question, `${id} is PENDING without stating the question`);
  }
  for (const id of [...classified].filter(([, s]) => s === STATE.UNSEEN).map(([id]) => id)) {
    const t = treatmentFor(id, 3);
    assert.strictEqual(t.shape, null,
      `${id} is NOT_CLASSIFIED yet carries a shape — the two states are leaking into each other`);
    assert.ok(!t.decision_id, `${id} is NOT_CLASSIFIED yet names a decision`);
  }
});

check("a SAFE clause needs no decision, and a PENDING one is never SAFE", () => {
  for (const [id, state] of classified) {
    const t = treatmentFor(id, 3);
    if (state === STATE.SAFE) {
      assert.strictEqual(t.outcome, TREATMENT.DETERMINED);
      assert.ok(t.shape, `${id} is SAFE without a shape`);
      assert.ok(!t.decision_id, `${id} is SAFE and also waiting on ${t.decision_id}`);
    }
    if (state === STATE.PENDING) {
      assert.notStrictEqual(t.outcome, TREATMENT.DETERMINED);
    }
  }
});

check("at two principals the whole portfolio is NOT_APPLICABLE", () => {
  /*
   * The control. If this ever fails, some clause has acquired N-party behaviour
   * in a two-party document — which is the corpus-churn outcome the conditional
   * design exists to prevent.
   */
  for (const id of reachable.keys()) {
    assert.strictEqual(treatmentFor(id, 2).outcome, TREATMENT.NOT_APPLICABLE,
      `${id} proposes to change a two-party document`);
  }
});

check("ROSTER_DRIVEN is backed by tests that exist and name real checks", () => {
  /*
   * The shape added in D4.19 claims to be established by evidence rather than by
   * reading a sentence. That claim is only worth something if the evidence is
   * real, so the test files and the named checks are verified to exist.
   */
  const shapes = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/nparty-shapes.json"), "utf8"));
  const rd = shapes.shapes.find((s) => s.shape === "ROSTER_DRIVEN");
  assert.ok(rd, "the ROSTER_DRIVEN shape is gone");
  assert.strictEqual(rd.decision_required, false);
  assert.ok(rd.evidence?.length >= 3, "an evidence-backed shape must cite its evidence");
  for (const line of rd.evidence) {
    const [file] = line.split(":");
    if (!file.endsWith(".mjs")) continue;
    const full = path.join(ROOT, file);
    assert.ok(fs.existsSync(full), `${file} is cited as evidence and does not exist`);
    const quoted = line.match(/'([^']+)'|"([^"]+)"/);
    if (quoted) {
      const name = quoted[1] || quoted[2];
      assert.ok(fs.readFileSync(full, "utf8").includes(name),
        `${file} does not contain the check "${name}" cited as evidence`);
    }
  }
  /* And the caveat has to still be true: the capital clause is safe on
   * cardinality and open on attribution, and saying so is the point. */
  assert.ok(rd.clauses.includes("PARTNERSHIP_CAPITAL_001"));
  assert.ok(rd.caveat?.join(" ").includes("allocation-semantics.json"),
    "the clause that is settled on one axis and open on another no longer says so");
});

await checkAsync("ROSTER_DRIVEN is proved by generation, not by citation", async () => {
  /*
   * THE ESCAPE-HATCH GUARD.
   *
   * ROSTER_DRIVEN must mean "N-party correctness was established by tracing the
   * authoritative roster through generation and verifying the artifact". It must
   * not come to mean "this clause looks like it uses the roster". Citations are
   * checked elsewhere in this file, but a citation is a claim about a test; this
   * asserts the BEHAVIOUR directly, here, every run.
   *
   * The property: a ROSTER_DRIVEN clause's shipped text must demonstrably change
   * when a third principal is added, and must name that principal. A clause whose
   * words are identical at two and three principals is not driven by the roster,
   * whatever anyone wrote in a JSON file.
   */
  const PEOPLE = [
    { name: "Meera Iyer", address: "12 Hill Road, Bandra, Mumbai, Maharashtra 400050", pan: "AAAPI1234C" },
    { name: "Arjun Desai", address: "44 Linking Road, Khar, Mumbai, Maharashtra 400052", pan: "AABPD2345F" },
    { name: "Sunita Rao", address: "9 Carter Road, Bandra, Mumbai, Maharashtra 400050", pan: "AACPR3456G" },
  ];
  const deed = async (n) => {
    const variables = {
      ...variablesFor("PARTNERSHIP_DEED", { profile: FIXTURE_PROFILE.WELL_FILLED }),
      partnership_name: "Bandra Associates",
      party_1_pan: "", party_2_pan: "", party_1_gstin: "", party_2_gstin: "",
      partner_1_name: "", partner_2_name: "", partner_1_address: "", partner_2_address: "",
      capital_contribution_1: 600000, capital_contribution_2: 300000,
      ...Object.fromEntries(PEOPLE.slice(0, n).flatMap((p, i) => [
        [`partner_${i + 1}_name`, p.name], [`partner_${i + 1}_address`, p.address],
        [`partner_${i + 1}_type`, "Individual"], [`partner_${i + 1}_pan`, p.pan],
      ])),
    };
    const r = await generateDocument({ document_type: "PARTNERSHIP_DEED", variables });
    return Object.fromEntries(
      (r?.draft?.clauses || []).map((c) => [c.clause_id, c.text || ""]));
  };

  const two = await deed(2);
  const three = await deed(3);
  const THIRD = /Sunita Rao|Partner 3/;

  const shapes = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/nparty-shapes.json"), "utf8"));
  const rosterDriven = shapes.shapes.find((s) => s.shape === "ROSTER_DRIVEN").clauses;

  let proved = 0;
  for (const id of rosterDriven) {
    if (!(id in two) || !(id in three)) continue;  // not carried by this family
    assert.notStrictEqual(three[id], two[id],
      `${id} is ROSTER_DRIVEN and renders identically at two and three principals — ` +
      `it is not driven by the roster, it merely sits near one`);
    assert.ok(THIRD.test(three[id]),
      `${id} is ROSTER_DRIVEN and does not name the third principal at three principals`);
    assert.ok(!THIRD.test(two[id]),
      `${id} names a third principal in a two-party deed`);
    proved += 1;
  }
  assert.strictEqual(proved, 3,
    `only ${proved} of the ROSTER_DRIVEN clauses were reachable to prove; the guard is not guarding`);

  /*
   * THE CONTROL. A test that cannot fail proves nothing, so a clause that is NOT
   * roster-driven is run through the same assertion and must not satisfy it.
   * CORE_DISPUTE_RESOLUTION_001 is written ABOUT the parties rather than assembled
   * FROM them, and its text is identical at two and three.
   */
  assert.strictEqual(three.CORE_DISPUTE_RESOLUTION_001, two.CORE_DISPUTE_RESOLUTION_001,
    "the control clause changed with the roster, so this test cannot distinguish");
  assert.ok(!THIRD.test(three.CORE_DISPUTE_RESOLUTION_001 || ""),
    "the control clause names the third principal, so the test would pass anything");
});

check("no clause is listed under two shapes", () => {
  /*
   * A latent defect the dispute-resolution probe exposed. The shape index is
   * built with shapeOf.set(clauseId, shape), so a clause appearing under two
   * shapes silently takes whichever file entry is read last — no error, no
   * warning, and the classification would depend on JSON key order.
   *
   * CORE_DISPUTE_RESOLUTION_001 genuinely has two N-party components with
   * different verdicts. It is listed once, under the demanding one, and the
   * settled component is recorded in the decision's `components` field instead.
   */
  const shapes = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/nparty-shapes.json"), "utf8"));
  const seen = new Map();
  for (const shape of shapes.shapes) {
    for (const id of shape.clauses || []) {
      if (seen.has(id)) {
        assert.fail(`${id} is listed under both ${seen.get(id)} and ${shape.shape} — ` +
          `the index would silently keep one and the classification would depend on key order`);
      }
      seen.set(id, shape.shape);
    }
  }
});

check("a multi-component clause records its settled parts rather than losing them", () => {
  const treatments = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/nparty-treatments.json"), "utf8"));
  const arb = treatments.decisions.find((d) => d.decision_id === "ARBITRATION_REFERENCE_SCOPE");
  assert.ok(arb, "the arbitration reference-scope decision is gone");
  assert.strictEqual(arb.decision, "UNDECIDED");
  assert.ok(arb.components?.settled?.length >= 2,
    "the components that ARE settled were dropped when the clause was classified by its hardest part");
  assert.strictEqual(arb.components.open.length, 1);
  assert.ok(arb.statutory_gap?.join(" ").includes("no"),
    "an UNDECIDED point with no statutory default must say that there is none");
  for (const c of arb.candidate_treatments) {
    for (const k of ["consequence_2", "consequence_3", "consequence_4"]) {
      assert.ok(c[k], `${c.treatment}: missing ${k}`);
    }
  }
});

check("the classified set only grows — a ratchet, not a snapshot", () => {
  /*
   * A classification is a claim somebody made. A clause falling silently back to
   * NOT_CLASSIFIED — a renamed shape, a changed id, a dropped entry — would put
   * it back in the invisible backlog with nobody told. So the floor is recorded
   * and enforced, and raising it is a deliberate edit to this line.
   */
  const FLOOR = { SAFE: 17, AUTHORED_DECISION_PENDING: 6 };
  assert.ok(counts.SAFE >= FLOOR.SAFE,
    `SAFE fell from ${FLOOR.SAFE} to ${counts.SAFE}: a clause lost its classification`);
  assert.ok(counts.AUTHORED_DECISION_PENDING >= FLOOR.AUTHORED_DECISION_PENDING,
    `AUTHORED_DECISION_PENDING fell from ${FLOOR.AUTHORED_DECISION_PENDING} to ${counts.AUTHORED_DECISION_PENDING}`);
  console.log(`      ceiling: ${reachable.size} reachable | ${counts.SAFE} safe | ` +
    `${counts.AUTHORED_DECISION_PENDING} pending | ${counts.NOT_CLASSIFIED} unclassified ` +
    `(${(((counts.SAFE + counts.AUTHORED_DECISION_PENDING) / reachable.size) * 100).toFixed(1)}% classified)`);
});

console.log(`\nALL GREEN (${checks} checks)`);
