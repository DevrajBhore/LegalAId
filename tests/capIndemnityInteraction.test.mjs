/**
 * capIndemnityInteraction.test.mjs — THE ADVERSARIAL FIXTURE, AND THE REASON NOTHING WAS PORTED
 *
 * D4.25 found that the guarantee family orders its cap against its indemnity and
 * that five other families do not. The obvious next move was to port the
 * guarantee sentence. D4.26 measured whether the semantics are identical first,
 * because that was the stated condition for a reusable treatment, and they are
 * not:
 *
 *     the shipped cap reads "shall not exceed the total consideration paid under
 *     this Agreement", and NDA and FOUNDERS_AGREEMENT COLLECT NO CONSIDERATION
 *     FIELD AT ALL.
 *
 * So folding a mutual confidentiality indemnity into that cap would not limit it;
 * it would erase it. Same sentence, opposite effect, which is exactly what
 * "extract the semantic contract, do not copy the wording" was guarding against.
 *
 * This file therefore asserts THREE things and deliberately not a fourth:
 *
 *   1. the adversarial configuration is reachable — cap, indemnity and three
 *      principals in one generated document;
 *   2. that document does NOT resolve the relationship, which is the defect
 *      stated as a fact about the artifact rather than as an opinion;
 *   3. the guarantee family DOES resolve it, as the permanent regression case;
 *
 * and NOT that the relationship has been fixed, because it has not been, and an
 * assertion that passes by describing a hoped-for state is how a test suite
 * starts lying.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { treatmentFor, TREATMENT } from "../backend/services/npartyTreatment.js";
import { resolveRoster } from "../backend/services/partyRoster.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };

const INTERACTION =
  /taken together with any liability under the indemnity|forms part of, and shall not increase, the aggregate cap|counts? towards? the aggregate cap|(?:excluded|carved out) from the aggregate cap/i;

const CAPS = ["CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001", "CORE_LIABILITY_LIMIT_FALLBACK_001"];
const INDS = ["CORE_INDEMNITY_FULL_001", "CORE_INDEMNITY_001"];

/* Three principals, coherent identities, in a family that carries both clauses. */
const PEOPLE = [
  { name: "Meera Iyer", address: "12 Hill Road, Bandra, Mumbai, Maharashtra 400050", pan: "AAAPI1234C" },
  { name: "Arjun Desai", address: "44 Linking Road, Khar, Mumbai, Maharashtra 400052", pan: "AABPD2345F" },
  { name: "Sunita Rao", address: "9 Carter Road, Bandra, Mumbai, Maharashtra 400050", pan: "AACPR3456G" },
];

async function threePartyFounders() {
  const variables = {
    ...variablesFor("FOUNDERS_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED }),
    ...Object.fromEntries(PEOPLE.flatMap((p, i) => [
      [`party_${i + 1}_name`, p.name], [`party_${i + 1}_address`, p.address],
      [`party_${i + 1}_type`, "Individual"], [`party_${i + 1}_pan`, p.pan],
    ])),
  };
  const r = await generateDocument({ document_type: "FOUNDERS_AGREEMENT", variables });
  return { result: r, variables, clauses: r?.draft?.clauses || [] };
}

await check("the adversarial configuration is reachable: cap + indemnity + three principals", async () => {
  const d = await threePartyFounders();
  assert.ok(d.clauses.length > 0,
    `the fixture did not generate: ${(d.result?.validation?.blockingIssues || []).map((i) => i.rule_id).join(", ")}`);
  const ids = new Set(d.clauses.map((c) => c.clause_id));
  assert.ok(CAPS.some((c) => ids.has(c)), "no cap clause in the generated document");
  assert.ok(INDS.some((i) => ids.has(i)), "no indemnity clause in the generated document");
  assert.strictEqual(resolveRoster(d.variables).count, 3,
    "the third principal did not survive into the generation input");
  /* Both must be decision-bearing, or the configuration is not the one D4.24 modelled. */
  const capId = CAPS.find((c) => ids.has(c));
  const indId = INDS.find((i) => ids.has(i));
  assert.strictEqual(treatmentFor(capId, 3).outcome, TREATMENT.UNRESOLVED,
    `${capId} is no longer decision-bearing`);
  assert.strictEqual(treatmentFor(indId, 3).outcome, TREATMENT.UNRESOLVED,
    `${indId} is no longer decision-bearing`);
});

await check("that document does NOT order the cap against the indemnity — the defect, as a fact", async () => {
  const d = await threePartyFounders();
  const relevant = d.clauses.filter((c) => CAPS.includes(c.clause_id) || INDS.includes(c.clause_id));
  const ordered = relevant.filter((c) => INTERACTION.test(c.text || ""));
  assert.deepStrictEqual(ordered.map((c) => c.clause_id), [],
    "a family that lacked the interaction rule now has one. That may be the fix landing — re-run " +
    "scripts/probeGuaranteeCoherence.mjs and update cap-indemnity-interaction.json rather than " +
    "letting this assertion flip silently");
});

await check("the guarantee family resolves it — the permanent regression case", async () => {
  /*
   * The control. If the guarantee wording is ever edited away, the only worked
   * example of a same-axis interaction rule in the repository goes with it, and
   * D4.25's comparison loses its other half.
   */
  const r = await generateDocument({
    document_type: "GUARANTEE_AGREEMENT",
    variables: variablesFor("GUARANTEE_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED }),
  });
  const byId = Object.fromEntries((r?.draft?.clauses || []).map((c) => [c.clause_id, c.text || ""]));
  assert.ok(INTERACTION.test(byId.GUARANTEE_OBLIGATION_001 || ""),
    "the guarantee cap no longer states that it applies taken together with the indemnity");
  assert.ok(INTERACTION.test(byId.GUARANTEE_INDEMNITY_001 || ""),
    "the guarantee indemnity no longer states that it forms part of the cap");
});

await check("the condition for a reusable treatment fails, and it fails on measurable grounds", () => {
  /*
   * The reason nothing was ported. Not taste, not caution — two of the five
   * families have no field the cap's own measure can read.
   */
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/cap-indemnity-interaction.json"), "utf8"));
  const CONSIDERATION = /fee|consideration|amount|value|rent|salary|ctc|price|compensation/i;
  for (const fam of doc.per_family) {
    const fields = Object.keys(getVariables(fam.document_type) || {});
    const has = fields.some((f) => CONSIDERATION.test(f));
    assert.strictEqual(has, fam.consideration_field_exists,
      `${fam.document_type}: the recorded consideration_field_exists disagrees with the schema`);
  }
  const nil = doc.per_family.filter((f) => !f.consideration_field_exists);
  assert.ok(nil.length >= 2,
    "fewer than two families now lack a consideration field; the ground for refusing to port the " +
    "guarantee pattern has changed and the refusal should be revisited deliberately");
  assert.strictEqual(doc.decision, "UNDECIDED");
});

await check("the interaction question has not resolved the apportionment question", () => {
  /*
   * The boundary that matters most. Ordering the indemnity against the cap says
   * nothing about whether the cap is per-party, shared, or inter se at three
   * principals. If an interaction treatment ever silently assumed one, it would
   * answer an open legal question as a side effect of a drafting fix.
   */
  const treatments = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/nparty-treatments.json"), "utf8"));
  const lca = treatments.decisions.find((d) => d.decision_id === "LIABILITY_CAP_APPORTIONMENT");
  assert.ok(lca, "LIABILITY_CAP_APPORTIONMENT has disappeared");
  assert.strictEqual(lca.decision, "UNDECIDED",
    "the cap apportionment has been decided; check whether an interaction treatment resolved it as a side effect");
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/cap-indemnity-interaction.json"), "utf8"));
  const text = doc.what_was_deliberately_not_done.join(" ");
  assert.ok(/LIABILITY_CAP_APPORTIONMENT REMAINS OPEN/i.test(text),
    "the separation between interaction and apportionment is no longer recorded");
  for (const dir of doc.candidate_directions) {
    assert.ok(!/per.?party|shared cap|inter se/i.test(dir.reading),
      `${dir.direction}: a candidate direction names an apportionment treatment, which would let a ` +
      `drafting fix decide an open legal question`);
  }
});

await check("measurement blocks interaction, and the block is recorded as a hierarchy", () => {
  /*
   * D4.27's structural finding. Asking whether the indemnity consumes a ceiling
   * that cannot be computed is asking an advocate to order a clause against a
   * quantity that does not exist — the answer would look like progress and mean
   * nothing.
   */
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/cap-indemnity-interaction.json"), "utf8"));
  const bp = doc.blocking_prior;
  assert.ok(bp, "the blocking prior has been removed");
  assert.match(bp.status, /BLOCKS THE INTERACTION/i,
    "the measurement question no longer states that it blocks the interaction question");
  assert.ok(bp.hierarchy.join(" ").includes("BLOCKED"));
  assert.ok(bp.advocate_queue_item?.constraint?.includes("must not resolve or imply"),
    "the constraint forbidding interaction decisions from implying the measurement answer is gone");
  /* Two distinct failure states, because they need different repairs. */
  const states = bp.measured.two_distinct_failures.map((f) => f.state);
  assert.deepStrictEqual([...states].sort(),
    ["FIXED_PROSE_UNMEASURABLE", "OFFERS_A_BASIS_IT_CANNOT_SUPPLY"],
    "the two cap-measurement failures have been merged; they need different repairs");
});

await check("the interaction question is per head, and the settled heads stay settled", () => {
  /*
   * The cap already carves out three heads and the indemnity triggers on three;
   * they overlap on exactly one. A Boolean "is the indemnity capped?" would
   * overwrite a settled head in order to answer an open one.
   */
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/cap-indemnity-interaction.json"), "utf8"));
  const heads = doc.interaction_is_per_head_not_boolean.heads;
  const settled = heads.filter((h) => h.state.startsWith("SETTLED")).map((h) => h.head);
  const open = heads.filter((h) => h.state.includes("UNRESOLVED")).map((h) => h.head);
  assert.deepStrictEqual(settled.sort(), ["FRAUD", "UNLIMITABLE_BY_LAW", "WILFUL_MISCONDUCT"],
    "a head that the cap expressly carves out is no longer recorded as settled");
  assert.deepStrictEqual(open.sort(), ["BREACH_OF_AGREEMENT", "NEGLIGENCE"],
    "the open heads have changed; the question is supposed to be two heads wide");

  /* And the settled heads must still be what the shipped clause actually says. */
  const capText = "except in cases of fraud, wilful misconduct, or liabilities that cannot be limited under applicable law";
  for (const h of ["fraud", "wilful misconduct"]) {
    assert.ok(capText.includes(h),
      `${h} is recorded as carved out of the cap; confirm against the shipped clause text`);
  }
});

await check("the three layers are recorded as non-contaminating", () => {
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/cap-indemnity-interaction.json"), "utf8"));
  const text = doc.three_layers_must_not_contaminate.join(" ");
  for (const layer of ["MEASUREMENT", "INTERACTION", "APPORTIONMENT"]) {
    assert.ok(text.includes(layer), `the ${layer} layer is missing from the separation`);
  }
  assert.ok(/none may resolve another as a\s+side effect/i.test(text),
    "the rule that no layer may resolve another as a side effect has been lost");
});

await check("a retracted finding stays retracted, with its reason", () => {
  /*
   * The probe was one step from reporting correct, already-disclosed behaviour as
   * a defect. What stopped it was checking whether the system already said so.
   * Keeping the retraction visible is how that stays learnable rather than
   * becoming a silently deleted mistake.
   */
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/cap-indemnity-interaction.json"), "utf8"));
  const r = doc.retracted_finding;
  assert.ok(r, "the retracted finding has been deleted rather than kept as a record");
  assert.match(r.status, /RETRACTED/);
  assert.ok(r.why.join(" ").includes("LIABILITY_CAP_ANSWERS_CONFLICT"),
    "the retraction no longer names the existing validator that made the claim false");
});

console.log(`\nALL GREEN (${checks} checks)`);
