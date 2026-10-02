/**
 * vacuousSatisfaction.test.mjs — D4.37
 *
 * PINS THE FALSE-POSITIVE MEASUREMENT AND THE INSTRUMENT THAT PRODUCED IT.
 *
 * Fourteen rule-family pairs are satisfied by a clause that is always present
 * and is not about the rule's subject. Nothing has been repaired, because
 * narrowing a satisfier list is a legal act — deciding that a recitals clause
 * does not evidence consideration is a view about the Contract Act.
 *
 * This file fails if the finding moves in either direction, and — unusually —
 * it also pins the SCOPE of the measurement, because three of this
 * investigation's four errors were about measuring rules the production system
 * never evaluates.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { DOCUMENT_TYPE_REGISTRY as IRE_REGISTRY } from "../IRE/src/indian-rule-engine/domainRegistry.js";
import { getAllClauses, getClauseById, getBlueprintForDocumentType } from "../backend/services/clauseAssembler.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const R = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/vacuous-satisfaction.json"), "utf8"));

const RULES = new Map();
for (const file of fs.readdirSync(path.join(ROOT, "knowledge-base/constraints"))) {
  if (!file.endsWith(".json")) continue;
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/constraints", file), "utf8"));
  for (const r of (body.rules || body.constraints || [])) {
    if (r?.rule_id && Array.isArray(r.fails_if)) RULES.set(r.rule_id, { ...r, $domain: body.domain });
  }
}

/* ── The three rules and their satisfier sets ─────────────────────────────── */

check("the surviving rules still enumerate the general provisions that discharge them", () => {
  /*
   * The finding's premise. If a satisfier list is narrowed, that is the repair
   * beginning — and it must arrive with the legal reasoning, not as a quiet
   * edit, because the whole point is that narrowing it is a view about the
   * Contract Act rather than about JSON.
   */
  /* CONTRACT_REQUIRES_CONSIDERATION was here until pass 5 withdrew it: its
     satisfier carries a consideration recital the probe had truncated away. */
  const expected = {
    SERVICE_REQUIRES_PAYMENT: "CORE_TERM_001",
    SERVICE_REQUIRES_SCOPE: "CORE_PURPOSE_001",
  };
  for (const [ruleId, clauseId] of Object.entries(expected)) {
    const rule = RULES.get(ruleId);
    assert.ok(rule, `${ruleId} no longer exists as a rule with a fails_if list.`);
    assert.ok(rule.fails_if.includes(clauseId),
      `${ruleId} no longer accepts ${clauseId}. If a satisfier list was narrowed, record the authority ` +
      `for that legal position in vacuous-satisfaction.json and update this file in the same change.`);
  }
});

check("the discharging clauses are still general provisions, not subject-specific", () => {
  /*
   * Reach is reported as a raw number precisely because an earlier pass
   * thresholded it and got CORE_TERM_001 wrong. Asserted here as an ordering,
   * not a cutoff: each of these must remain far more widespread than the loan
   * clause that the structural test misread.
   */
  const reach = new Map();
  let total = 0;
  for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
    let bp; try { bp = getBlueprintForDocumentType(type); } catch { continue; }
    if (!bp) continue;
    total += 1;
    const named = new Set([...(bp.clauses || []), ...(bp.conditional_clauses || []).map((e) => e.clause)]);
    for (const id of named) reach.set(id, (reach.get(id) || 0) + 1);
  }
  const loanReach = reach.get("LOAN_AMOUNT_001") || 0;
  for (const id of ["CORE_TERM_001", "CORE_PURPOSE_001"]) {
    const n = reach.get(id) || 0;
    assert.ok(n > loanReach * 5,
      `${id} is named by ${n} of ${total} blueprints, no longer clearly more widespread than the ` +
      `subject-specific comparator (LOAN_AMOUNT_001 at ${loanReach}). The general-provision reading no longer holds.`);
  }
});

/* ── The measurement's own scope — where three of four errors were ────────── */

check("rules are still bound to families by domain, so scoping the measurement is possible", () => {
  /*
   * The largest correction: an earlier pass scored every rule against every
   * family and reported 80 findings, most of them rules that never run there.
   * If the domain binding disappears, that scoping becomes impossible and the
   * measurement cannot be reproduced.
   */
  const withDomains = Object.keys(DOCUMENT_TYPE_REGISTRY)
    .filter((t) => (IRE_REGISTRY[t]?.domains || []).length);
  assert.ok(withDomains.length >= 35,
    `only ${withDomains.length} of ${Object.keys(DOCUMENT_TYPE_REGISTRY).length} families carry a domain ` +
    `binding. Without it, which rules apply to a family cannot be determined and this measurement is unscoped.`);

  const dist = RULES.get("DIST_REQUIRES_PRODUCTS");
  if (dist) {
    const ssa = new Set(IRE_REGISTRY.SHARE_SUBSCRIPTION_AGREEMENT?.domains || []);
    assert.ok(!ssa.has(dist.$domain),
      "SHARE_SUBSCRIPTION_AGREEMENT now binds the distribution domain. The canonical example of a rule " +
      "that does NOT run for a family is gone, and the scoping story in the record needs rechecking.");
  }
});

check("the singleton category that misled the instrument is still a singleton", () => {
  /*
   * INTELLECTUAL_PROPERTY once against IP twenty times. It made a correct IP
   * assignment clause look off-subject. If the library normalises it, that is
   * knowledge hygiene worth having — and the UNRESOLVED row in the record
   * becomes decidable, so the record must be revisited.
   */
  const counts = new Map();
  for (const c of getAllClauses()) {
    const cat = String(c.category || "").toUpperCase();
    if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  const alias = counts.get("INTELLECTUAL_PROPERTY") || 0;
  const main = counts.get("IP") || 0;
  assert.ok(alias === 1 && main > 5,
    `category spelling changed: INTELLECTUAL_PROPERTY=${alias}, IP=${main}. If the alias was normalised, ` +
    `the UNRESOLVED row in vacuous-satisfaction.json can now be decided — revisit it in the same change.`);
});

/* ── The record must keep what a later reader cannot re-derive ────────────── */

check("the correction history is kept, with the counts it removed", () => {
  /*
   * The first pass reported 83 and the honest number is 4. An investigation
   * whose result only ever grows should be distrusted; this one shrank five
   * times and the record says by how much each time.
   */
  const c = R.what_the_measurement_cost_to_get_right;
  assert.ok(Array.isArray(c?.corrections_in_order) && c.corrections_in_order.length === 6,
    "the six corrections were dropped or changed. Without them the number 4 looks like a first result.");
  const sixth = c.corrections_in_order.find((x) => x.pass === 6);
  assert.ok(/No change to the count/.test(sixth?.effect || ""),
    "the sixth correction no longer records that it changed a REASON and not the count — the distinction it exists for.");
  const scope = R.the_fourteen.by_rule.find((r) => r.rule_id === "SERVICE_REQUIRES_SCOPE");
  assert.ok(!/\{\{\s*purpose\s*\}\}/.test(scope?.full_clause_text || "{{purpose}}"),
    "the SERVICE_REQUIRES_SCOPE row again quotes the TEMPLATE. The finding rests on the rendered clause.");
  const big = c.corrections_in_order.find((x) => x.pass === 3);
  assert.ok(/never runs|does not run/i.test(JSON.stringify(big)),
    "the largest correction — scoring rules the production system never evaluates — was dropped.");
});

check("the ten withdrawn rows are kept, not deleted", () => {
  /*
   * They were reported as the strongest part of the finding and they are not
   * findings at all. Deleting them would leave the correction history
   * describing a reduction the record no longer shows.
   */
  const w = R.the_ten_that_did_not_survive;
  assert.ok(w?.what_is_true && /recital/i.test(JSON.stringify(w)),
    "the withdrawn CONTRACT_REQUIRES_CONSIDERATION rows were removed from the record rather than kept as a retraction.");
  const clause = getClauseById("CORE_IDENTITY_001");
  assert.ok(clause && /consideration/i.test(String(clause.text || "")),
    "CORE_IDENTITY_001 no longer mentions consideration, so the reason those ten rows were withdrawn no longer holds. " +
    "Re-examine them before leaving them retracted.");
});

check("the misleading headline is kept, and kept labelled as misleading", () => {
  /*
   * 194 of 211 pairs are vacuous. Reporting that as a defect would be true and
   * misleading, and the record says so rather than quietly omitting it.
   */
  const h = R.the_headline_that_is_not_the_finding;
  assert.ok(h?.observation && h.$why_it_is_not_reported_as_a_defect,
    "the record no longer carries the '92% of evaluations cannot fail' observation together with the " +
    "reason it is not the finding. Dropping either half makes the record dishonest in one direction or the other.");
});

check("nothing was repaired", () => {
  /*
   * Scope assertion. D4.37 was to measure, not to narrow a satisfier list.
   */
  assert.ok(/not repaired/i.test(String(R.status || "")),
    "the record no longer says the finding is unrepaired.");
  const joined = JSON.stringify(R.what_this_record_does_not_do || []);
  assert.ok(/legal act/i.test(joined),
    "the record no longer states that narrowing a satisfier list is a legal act performed as a code change.");
});

check("both directions of the id-list defect stay linked", () => {
  /*
   * D4.35 (too narrow) and D4.37 (too broad) are the same coupling failing
   * opposite ways. Recorded together because repairing either one alone would
   * make the other look like a different problem.
   */
  const rel = R.relationship_to_the_other_findings;
  assert.ok(/too NARROW/i.test(JSON.stringify(rel)) && /too BROAD/i.test(JSON.stringify(rel)),
    "the record no longer links the false-negative and false-positive directions as one coupling defect.");
});

console.log(`\n${checks} checks passed`);
