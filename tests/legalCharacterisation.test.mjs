/**
 * legalCharacterisation.test.mjs — D4.30: ARITHMETIC IS NOT A LEGAL CONCLUSION
 *
 * MEASURE, INTERACTION and APPORTIONMENT all assume the clause IS a ceiling.
 * D4.29 produced a case where that assumption is the question: a ceiling measured
 * on a payment that never arises computes to nil, and nil recovery is what an
 * absolute bar produces.
 *
 * The temptation is to let the division settle it. These checks exist to make that
 * inference fail loudly if anyone ever builds it, and to stop the seven affected
 * families being treated as one legal population when they are at least three.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVariables } from "../backend/config/variableConfig.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/governance", f), "utf8"));
const C = read("legal-characterisation.json");
const R = read("cap-referent.json");
const M = read("investigation-methodology.json");

/* ── THE CONSTRAINT ───────────────────────────────────────────────────────── */

check("a characterisation may not be inferred from a computed value", () => {
  const h = C.hard_constraint;
  assert.strictEqual(h.id, "ARITHMETIC_DOES_NOT_DETERMINE_CHARACTERISATION");
  assert.ok(/may never be inferred/i.test(h.constraint), "the constraint has been softened");
  assert.ok(/evaluates to zero does not make/i.test(h.constraint),
    "the zero case is no longer named, and it is the case the constraint exists for");
  assert.ok(/positive figure does not make it a valid/i.test(h.constraint),
    "only the zero direction is forbidden; the inference is equally wrong in the other direction and a rule that runs one way invites the other");
  assert.strictEqual(h.certification, "AUTHORED_DECISION_PENDING");
});

check("characterisation sits beside the three layers, not inside them", () => {
  const f = M.fourth_dimension;
  assert.ok(f, "the fourth dimension has been removed");
  assert.ok(/prior to all three|not after them/i.test(f.$note.join(" ")),
    "the record no longer says that characterisation comes BEFORE the layers; as a fourth layer it would inherit their blocking order and be answered last");
  assert.ok(/No evidence yet shows|not generalised/i.test(f.not_generalised),
    "the dimension has been generalised beyond the liability ceiling without evidence");
  const layers = M.cap_decomposition.layers.map((l) => l.layer);
  assert.ok(!layers.includes("LEGAL_CHARACTERISATION"),
    "characterisation has been folded into the cap layers, which makes it resolvable by a measurement result");
});

/* ── THE SEVEN ARE NOT ONE POPULATION ─────────────────────────────────────── */

check("every structurally empty family is placed in exactly one legal population", () => {
  const placed = C.the_seven_are_not_one_population.populations.flatMap((p) => p.members);
  const empty = R.structurally_empty.members.map((m) => m.type);
  assert.deepStrictEqual([...placed].sort(), [...empty].sort(),
    "the populations and the structurally empty table have diverged; a family in one and not the other would get a legal answer derived from an arithmetic it does not have, or the reverse");
  assert.strictEqual(new Set(placed).size, placed.length, "a family appears in two populations");
  assert.ok(C.the_seven_are_not_one_population.populations.length >= 3,
    "the populations have been merged; the consumer families do not share a legal route with the commercial ones");
});

check("the consumer families keep a route that does not depend on the unsettled line", () => {
  const p = C.the_seven_are_not_one_population.populations
    .find((x) => x.id === "CONSUMER_FACING_UNILATERAL");
  assert.deepStrictEqual(p.members.sort(), ["PRIVACY_POLICY", "TERMS_OF_SERVICE"]);
  assert.ok(/Consumer Protection Act 2019/.test(p.route), "the statutory route has been dropped");
  assert.ok(/regardless of how the Simplex line resolves/i.test(p.route),
    "the record no longer says the consumer route is independent, which is the whole reason these two are a separate population");
});

check("the population claim about party_2 is true of the schemas, not asserted", () => {
  /*
   * The record says TERMS_OF_SERVICE and PRIVACY_POLICY collect no party_2 at all.
   * That is checkable, so it is checked — the D4.24 rule about computing a claim
   * rather than asserting it applies to structural claims too.
   */
  for (const type of ["TERMS_OF_SERVICE", "PRIVACY_POLICY"]) {
    const schema = getVariables(type) || {};
    assert.ok(!schema.party_2_name && !schema.party_2_type,
      `${type} now collects a counterparty. If a party_2 was added, these are no longer unilateral instruments and the population record must be revisited.`);
  }
  for (const type of ["NDA", "DISTRIBUTION_AGREEMENT", "SHAREHOLDERS_AGREEMENT", "FOUNDERS_AGREEMENT"]) {
    const schema = getVariables(type) || {};
    assert.ok(schema.party_2_type, `${type} is recorded as bilateral but no longer collects party_2_type`);
  }
});

/* ── THE FACTS THE CHARACTERISATION NEEDS ARE NOT COLLECTED ───────────────── */

check("no family among the seven collects consumer status or bargaining relationship", () => {
  /*
   * This asserts a DEFECT and will fail when the intake gap is closed. That is the
   * ASSERT_THE_STATE_NOT_THE_HOPE rule: when it flips, the characterisation may have
   * become askable, and that belongs in the governance record rather than in a
   * quietly relaxed assertion.
   */
  const PAT = /consumer|bargain|negotiat|standard form|adhesion|non[- ]negotiable|sophisticat/i;
  const placed = C.the_seven_are_not_one_population.populations.flatMap((p) => p.members);
  for (const type of placed) {
    const schema = getVariables(type) || {};
    const hits = Object.entries(schema).filter(([k, d]) =>
      PAT.test(k) || PAT.test(String(d?.label || "")) || PAT.test(String(d?.description || "")));
    assert.deepStrictEqual(hits.map(([k]) => k), [],
      `${type} now asks about consumer status or bargaining relationship. That may be the intake gap closing — update legal-characterisation.json#the_facts_are_not_collected rather than loosening this check.`);
  }
});

check("legal form is recorded as a forbidden basis for inferring consumer status", () => {
  /*
   * This is the convenient inference. party_1_type and party_2_type exist, they are
   * one step from a characterisation, and taking that step would be an invention.
   */
  const f = C.the_facts_are_not_collected.forbidden_inference;
  assert.strictEqual(f.id, "PARTY_TYPE_IS_NOT_CONSUMER_STATUS");
  assert.ok(/must never/i.test(f.rule), "the prohibition has been softened");
  const why = f.why.join(" ");
  assert.ok(/commercial purpose/i.test(why),
    "the record no longer says why an individual may not be a consumer, so the rule reads as caution rather than as law");
  assert.ok(/PUBLISHER/i.test(why),
    "the record no longer notes that in the unilateral families the only party type collected belongs to the publisher");
  assert.ok(/UNASKABLE/i.test(C.the_facts_are_not_collected.consequence),
    "the record no longer says the question cannot be asked at all, which is the difference between an open decision and a missing input");
});

/* ── AUTHORITIES CARRY WHAT THEY DID NOT DECIDE ───────────────────────────── */

check("every verified authority records its facts, its scope and what it did not decide", () => {
  /*
   * "Court said X" is not a record. The nil-cap question lives entirely in what
   * these decisions did NOT decide, and a record that stopped at the holding would
   * have made the question invisible.
   */
  const schema = R.central_finding.legal_frame.$authority_schema;
  assert.ok(schema?.fields?.includes("did_not_decide") && schema.fields.includes("factual_context"),
    "the authority schema no longer requires the two fields that decide whether a holding reaches our facts");
  for (const a of R.central_finding.legal_frame.authorities) {
    if (/REPORTED_UNVERIFIED/.test(a.verified)) continue;
    for (const field of ["court", "date", "proposition_actually_decided", "factual_context", "scope", "did_not_decide"]) {
      assert.ok(a[field], `${a.case}: verified but missing ${field}`);
    }
    assert.notStrictEqual(a.did_not_decide, "not established",
      `${a.case}: verified but its limits are unrecorded, which is the half that governs whether it reaches us`);
  }
});

check("the PLUS 91 limitation is held at second-hand and says so", () => {
  /*
   * The distinction between an absolute bar and a threshold cap is what makes the
   * nil ceiling an open question rather than a settled defect. It is therefore the
   * single proposition least entitled to be assumed — and the judgment text could
   * not be read.
   */
  const a = R.central_finding.legal_frame.authorities.find((x) => /PLUS 91/.test(x.case));
  assert.ok(/SECONDARY-SOURCE ONLY|not read/i.test(a.verified),
    "the record now presents the Simplex distinction as this court's holding; the judgment was not read");
  assert.ok(/literature's reading|never as this court's holding/i.test(a.bearing + a.verified),
    "the record no longer distinguishes what the court held from what practitioners read it to imply");
  const pos = M.knowledge_authoring_pipeline.current_positions.find((p) => /PLUS 91/.test(p.proposition));
  assert.strictEqual(pos.gate_reached, 2,
    "the PLUS 91 limitation has advanced past candidate status without the judgment being read");
});

/* ── THE PIPELINE ─────────────────────────────────────────────────────────── */

check("the knowledge-authoring pipeline keeps all six gates and the failure it prevents", () => {
  const p = M.knowledge_authoring_pipeline;
  assert.deepStrictEqual(p.gates.map((g) => g.id), [
    "OBSERVATION", "CANDIDATE_PROPOSITION", "AUTHORITATIVE_VERIFICATION",
    "SCOPE_JURISDICTION_EXCEPTIONS", "ADVOCATE_LEGAL_REVIEW", "EXECUTABLE_KNOWLEDGE",
  ], "the gates have changed shape; each one is somewhere a proposition of ours has actually stopped");
  const note = p.$note.join(" ");
  assert.ok(/a test passes/i.test(note) && /treats the proposition as law/i.test(note),
    "the backdoor this pipeline closes is no longer described, and an unstated failure mode is one nobody checks for");
  assert.ok(/proves nothing whatever about the law/i.test(note),
    "the record no longer says that a green test proves nothing about the law");
  assert.ok(/LEGAL propositions/.test(p.applies_to),
    "the pipeline no longer says it governs legal propositions only; applied to mechanical observations it would stall the investigation");
});

check("nothing has been promoted to executable knowledge", () => {
  const p = M.knowledge_authoring_pipeline;
  assert.ok(/Nothing in this repository has passed gate 5/i.test(p.$standing) || /nothing.*gate 5/i.test(p.$standing),
    "the record no longer states that nothing has advocate sign-off");
  for (const pos of p.current_positions) {
    assert.ok(pos.gate_reached <= 4,
      `${pos.proposition}: recorded at gate ${pos.gate_reached}. No proposition may sit past gate 4 while no advocate has reviewed anything.`);
  }
  for (const f of ["legal-characterisation.json", "cap-referent.json"]) {
    assert.strictEqual(read(f).review_status, "draft-needs-legal-review",
      `${f}: review status has changed without an advocate record`);
  }
});

check("the failed proposition is recorded as failed, with where it stopped", () => {
  const pos = M.knowledge_authoring_pipeline.current_positions
    .find((x) => /nil ceiling is a total exclusion/i.test(x.proposition));
  assert.ok(pos, "the proposition that failed verification has been removed from the register rather than kept as evidence");
  assert.strictEqual(pos.gate_reached, 3);
  assert.ok(/FAILED AT GATE 3/i.test(pos.outcome), "the failure has been softened into progress");
  assert.ok(/became the question/i.test(pos.outcome),
    "the record no longer says the claim turned into a question, which is the useful part");
});

check("the suite is required to be able to fail because we were wrong", () => {
  const p = M.property_the_suite_must_keep;
  assert.ok(/not only because the product regressed/i.test(p.property),
    "the property has been reduced to ordinary regression testing");
  assert.ok(p.demonstrated_in?.length >= 3,
    "the occasions on which the suite failed because our hypothesis was wrong are no longer recorded, and an undemonstrated property is an aspiration");
});

/* ── THE OTHER LAYERS STAY UNTOUCHED ──────────────────────────────────────── */

check("characterisation has not resolved measurement, interaction or apportionment", () => {
  const nots = C.what_this_record_does_not_do.join(" ");
  for (const [needle, why] of [
    ["bar or a cap", "the record now decides a family's characterisation"],
    ["INTERACTION", "the interaction layer is no longer recorded as blocked"],
    ["LIABILITY_CAP_APPORTIONMENT", "apportionment is no longer recorded as untouched"],
    ["Nothing here has been implemented", "the record no longer states that nothing was built"],
  ]) assert.ok(nots.includes(needle), why);
  const app = M.cap_decomposition.layers.find((l) => l.layer === "APPORTIONMENT");
  assert.strictEqual(app.status, "UNDECIDED",
    "apportionment has been resolved; check whether the characterisation dimension answered it as a side effect");
});

console.log(`\n${checks} checks passed`);
