/**
 * clauseProvenanceContract.test.mjs — D4.34-B
 *
 * PINS A GAP THAT IS DELIBERATELY NOT CLOSED.
 *
 * Roughly a third of shipped clause occurrences can say nothing about why they
 * are in the document. The contract for fixing that is written down; it is not
 * implemented, because implementing it touches every stage that produces a
 * clause and D4.34-B was scoped to specify, not to change selection.
 *
 * This file exists so the gap cannot move unnoticed:
 *
 *   it WIDENS   — a new producer appears, or coverage falls
 *   it NARROWS  — someone stamps a stage, which is welcome, and must arrive
 *                 with the vocabulary rather than an ad-hoc string
 *
 * Both fail here. A deliberate repair updates this file and the record together.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { assembleDocument } from "../backend/services/clauseAssembler.js";
import { resolveDependencies } from "../backend/services/dependencyResolver.js";
import { applyDocumentHardening } from "../backend/services/documentHardening.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const RECORD = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/clause-provenance-contract.json"), "utf8"));

/* ── The partition, recomputed ────────────────────────────────────────────── */

function measurePartition() {
  let total = 0, reasoned = 0, stamped = 0, silent = 0, both = 0;
  for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
    const variables = variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED });
    let draft;
    try { draft = assembleDocument(type, variables); } catch { continue; }
    draft = resolveDependencies(draft, { variables, document_type: type });
    draft = applyDocumentHardening(draft, { variables, document_type: type });
    for (const c of draft.clauses || []) {
      total += 1;
      const hasReason = c.inclusion_reason != null;
      const hasStamp = c.injected_by != null;
      if (hasReason && hasStamp) both += 1;
      else if (hasReason) reasoned += 1;
      else if (hasStamp) stamped += 1;
      else silent += 1;
    }
  }
  return { total, reasoned, stamped, silent, both };
}

const P = measurePartition();

check("the partition is exact — every occurrence is in exactly one class", () => {
  /*
   * Asserted before the counts, because a partition that does not add up makes
   * every number below meaningless. `both` is expected to be zero today: no
   * producer writes an inclusion_reason AND a stamp. If one starts to, that is
   * not a failure, but this file's arithmetic has to be revisited with it.
   */
  assert.strictEqual(P.reasoned + P.stamped + P.silent + P.both, P.total,
    `the classes do not sum to the total: ${JSON.stringify(P)}`);
  assert.strictEqual(P.both, 0,
    `${P.both} occurrences now carry both an inclusion_reason and a stamp. That is progress, but the ` +
    `three-way partition this file pins no longer describes the draft — update it with the change.`);
});

check("silent clauses have not become a larger share", () => {
  /*
   * A SHARE, not a count. The count moves whenever a blueprint gains a clause,
   * and pinning it would make this file fail for reasons that have nothing to
   * do with provenance.
   */
  const recorded = RECORD.what_a_shipped_clause_can_say_today.partition
    .find((p) => p.carries === "NOTHING");
  const recordedShare = parseFloat(recorded.share);
  const measuredShare = (100 * P.silent) / P.total;
  assert.ok(measuredShare <= recordedShare + 1.0,
    `clauses that can say nothing about their origin rose from ${recordedShare}% to ` +
    `${measuredShare.toFixed(1)}% (${P.silent} of ${P.total}). A new producer was added without a stamp, ` +
    `or an existing one grew.`);
  if (measuredShare < recordedShare - 1.0) {
    assert.fail(
      `silent clauses FELL from ${recordedShare}% to ${measuredShare.toFixed(1)}%. If a producer was ` +
      `stamped, that is the intended direction — update clause-provenance-contract.json in the same ` +
      `change so the record stops describing a state that no longer exists.`);
  }
});

check("exactly one of the four producers stamps", () => {
  /*
   * The asymmetry is the finding. Enforced as a property of the code rather
   * than by re-running the stage walk, which is slow and which this file would
   * otherwise duplicate from the probe.
   */
  const stamping = [];
  for (const dir of ["backend/services", "backend/commercial"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!f.endsWith(".js")) continue;
      if (/injected_by:/.test(fs.readFileSync(path.join(ROOT, dir, f), "utf8"))) stamping.push(`${dir}/${f}`);
    }
  }
  assert.deepStrictEqual(stamping, ["backend/services/dependencyResolver.js"],
    `the set of files that stamp a clause's origin changed: ${stamping.join(", ") || "(none)"}. ` +
    `If a producer was given a stamp, use the closed vocabulary in clause-provenance-contract.json ` +
    `rather than a new ad-hoc string, and update that record.`);
});

/* ── The blind spot that made the decline unreadable ──────────────────────── */

check("the decline blind spot is the size the record states", () => {
  /*
   * applicability_excluded_clause_ids can only record a decline the blueprint
   * asked about. This pins how many (family, protection) pairs sit outside that,
   * because the number moving means either a gate was added (good, and the
   * record must say so) or a protection was exposed without one (the defect
   * spreading).
   */
  const recorded = RECORD.where_the_negative_decision_is_actually_lost.the_blind_spot;
  const report = path.join(ROOT, "docs/audit/ungated-declines.json");
  if (!fs.existsSync(report)) {
    console.log("      (skipped: docs/audit/ungated-declines.json not present — run scripts/probeUngatedDeclines.mjs)");
    return;
  }
  const measured = JSON.parse(fs.readFileSync(report, "utf8")).totals;
  assert.strictEqual(measured.asked_but_ungated, recorded.asked_but_no_blueprint_gate,
    `protections the intake offers with no blueprint gate behind them: recorded ` +
    `${recorded.asked_but_no_blueprint_gate}, measured ${measured.asked_but_ungated}.`);
});

/* ── The contract must stay a contract, not drift into an implementation ──── */

check("the vocabulary is closed and covers every measured producer", () => {
  const kinds = RECORD.the_minimum_provenance_contract.the_closed_vocabulary.map((k) => k.kind);
  assert.ok(new Set(kinds).size === kinds.length, "the vocabulary contains a duplicate kind.");
  /*
   * Every stage the walk found producing a clause must have at least one kind
   * that could describe it. Checked by stage, not by string match, so renaming
   * a kind does not silently drop a producer.
   */
  const producers = RECORD.the_producers.producers_in_the_deterministic_path.map((p) => p.stage);
  const coverage = {
    "resolveClauseSelection (blueprint)": ["BLUEPRINT_REQUIRED", "BLUEPRINT_CONDITIONAL", "BLUEPRINT_VARIANT"],
    "resolveDependencies": ["DEPENDENCY_STRUCTURAL", "DEPENDENCY_CONDITIONAL", "DEPENDENCY_FALLBACK"],
    "applyDocumentHardening": ["HARDENING_BASELINE", "HARDENING_REQUIRED"],
    "enhanceCommercially": ["COMMERCIAL_ENHANCEMENT"],
  };
  for (const stage of producers) {
    const need = coverage[stage];
    assert.ok(need, `producer "${stage}" has no kinds mapped to it in this test.`);
    for (const k of need) assert.ok(kinds.includes(k), `the vocabulary lost the kind ${k}, which ${stage} needs.`);
  }
});

check("the unmeasured producer is still declared unmeasured", () => {
  /*
   * The semantic merge path cannot be measured without a provider key. It is
   * recorded as an ASSUMED producer rather than omitted, because a stage left
   * out of the table would read as a stage that cannot add a clause.
   */
  const notMeasured = RECORD.the_producers.not_measured || [];
  assert.ok(notMeasured.some((n) => /semantic/i.test(n.stage)),
    "the semantic/AI merge path was dropped from not_measured. If it was measured, record the result; " +
    "if it was removed from the product, say so. Silence makes an unknown look like a zero.");
});

check("the forbidden repairs are still named", () => {
  const forbidden = (RECORD.the_minimum_provenance_contract.what_must_NOT_be_done || []).join(" ").toLowerCase();
  assert.ok(/infer/.test(forbidden),
    "the record no longer forbids inferring a clause's origin after the fact — the one repair that would " +
    "look correct until the moment it matters.");
  assert.ok(/back-fill|back fill|default kind/.test(forbidden),
    "the record no longer forbids back-filling a default kind, which makes an unknown look established.");
  assert.ok(/inclusion_reason/.test(forbidden),
    "the record no longer forbids folding machine-checkable origin into inclusion_reason.");
});

check("the contract is still unimplemented, or the record says otherwise", () => {
  /*
   * Scope assertion. D4.34-B was to specify, not to change selection. If a
   * stage starts writing a vocabulary kind, that is the repair happening — fine,
   * but the record must stop calling itself unimplemented.
   */
  const kinds = RECORD.the_minimum_provenance_contract.the_closed_vocabulary.map((k) => k.kind);
  const written = [];
  for (const dir of ["backend/services", "backend/commercial"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!f.endsWith(".js")) continue;
      const src = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
      if (kinds.some((k) => src.includes(`"${k}"`) || src.includes(`'${k}'`))) written.push(`${dir}/${f}`);
    }
  }
  const status = String(RECORD.the_minimum_provenance_contract.$status || "");
  if (written.length) {
    assert.ok(!/NOT IMPLEMENTED/i.test(status),
      `${written.join(", ")} now writes a provenance kind, but the record still says the contract is ` +
      `NOT IMPLEMENTED. Update the record in the same change.`);
  } else {
    assert.ok(/NOT IMPLEMENTED/i.test(status),
      "the record claims the contract is implemented, but no stage writes any kind from the vocabulary.");
  }
});

check("the attribution of the six is kept, with its own caveat", () => {
  /*
   * Both halves matter. The attribution closed a question D4.34 left open; the
   * caveat stops it being mistaken for the gap being closed.
   */
  const w = RECORD.where_the_six_came_from;
  assert.ok(w?.attribution?.applyDocumentHardening?.count === 5,
    "the attribution of the five hardening-injected occurrences was dropped or changed.");
  assert.ok(w.$attribution_is_not_provenance,
    "the caveat separating 'attributed for the investigation' from 'the artifact can state its origin' " +
    "was dropped. Without it this record reads as though the gap were closed.");
});

check("the reconciliation that closes the account is kept", () => {
  /*
   * 10 blind-spot pairs minus 4 families that produce no draft equals the 6
   * observed occurrences. It is what licenses the claim that there is no
   * seventh path, and a later reader cannot re-derive it from the counts alone.
   */
  assert.ok(RECORD.where_the_negative_decision_is_actually_lost.the_numbers_reconcile?.$and,
    "the reconciliation between the blind spot, the non-generating families and the six occurrences " +
    "was dropped. Without it, the claim that the account is complete is unsupported.");
});

console.log(`\n${checks} checks passed  (partition: ${P.reasoned} reasoned / ${P.stamped} stamped / ${P.silent} silent of ${P.total})`);
