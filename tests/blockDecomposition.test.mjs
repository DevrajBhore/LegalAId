/**
 * blockDecomposition.test.mjs — the 11 non-generating families
 *
 * PINS A CLASSIFICATION, NOT A REPAIR.
 *
 * Eleven families produce no draft. Their causal blockers are established and
 * deliberately not fixed: five wait on an advocate scope decision, and the other
 * six turn on a legal question about whether a clause the document already has
 * discharges the rule's proposition.
 *
 * This file fails if the population moves in either direction — a family joining
 * the blocked set, or one leaving it while the questions are still open, which
 * would mean a symptom was repaired ahead of its cause.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { assembleDocument, getClauseById } from "../backend/services/clauseAssembler.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const acheck = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };

const R = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/block-decomposition.json"), "utf8"));

const SCOPE_RESOLVABLE = R.the_split_that_matters.SCOPE_RESOLVABLE.families;
const NOT_RESOLVABLE = R.the_split_that_matters.NOT_SCOPE_RESOLVABLE.families;

/* ── The population ───────────────────────────────────────────────────────── */

const blocked = [];
for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  let out;
  try { out = await generateDocument({ document_type: type, variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }) }); }
  catch { blocked.push(type); continue; }
  if (!out?.draft?.clauses?.length) blocked.push(type);
}

await acheck("the non-generating set is exactly the one the record names", async () => {
  const recorded = [...SCOPE_RESOLVABLE, ...NOT_RESOLVABLE].sort();
  assert.deepStrictEqual(blocked.sort(), recorded,
    `the set of families producing no draft changed.\n  recorded: ${recorded.join(", ")}\n  measured: ${blocked.join(", ")}\n` +
    `If it GREW, a family regressed. If it SHRANK, check that the cause was established before the ` +
    `symptom was repaired — the six in NOT_SCOPE_RESOLVABLE turn on a legal question that has no ` +
    `recorded answer, and the five in SCOPE_RESOLVABLE are blocked on the advocate.`);
});

/* ── The thing that makes this more than a list of names ──────────────────── */

check("each blocked family still contains a clause in the rule's principal category", () => {
  /*
   * The finding is not "six families fail". It is that the document ALREADY
   * CONTAINS a clause doing the rule's work, under an id the rule does not
   * know. If that stopped being true — because a clause was renamed, recategorised
   * or removed — the finding would no longer describe the system, and the record
   * would be asserting something about a state that had passed.
   */
  for (const e of R.what_actually_blocks_the_six.evidence) {
    if (!e.document_has || e.$see) continue;               // the IP row is checked below
    const id = e.document_has.split(" ")[0].replace(/[^A-Z0-9_]/gi, "");
    const clause = getClauseById(id);
    assert.ok(clause, `${e.family}: ${id} is no longer in the clause library, so the evidence for this row is gone.`);
    const draft = assembleDocument(e.family, variablesFor(e.family, { profile: FIXTURE_PROFILE.WELL_FILLED }));
    assert.ok(draft.clauses.some((c) => c.clause_id === id),
      `${e.family}: ${id} is no longer in the assembled draft. The record claims this document already ` +
      `contains a clause in ${e.rule}'s principal category; that is no longer true.`);
  }
});

check("the IP family still grants the assignment it is refused for lacking", () => {
  /*
   * Checked on its own because it is the one blocker outside the advocate queue,
   * and because the category heuristic got this verdict right from wrong
   * evidence. The claim that matters is the concrete one: the operative grant is
   * in the draft.
   */
  const draft = assembleDocument("IP_ASSIGNMENT_AGREEMENT",
    variablesFor("IP_ASSIGNMENT_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED }));
  assert.ok(draft.clauses.some((c) => c.clause_id === "IPA_COPYRIGHT_ASSIGNMENT_001"),
    "IPA_COPYRIGHT_ASSIGNMENT_001 is no longer in the IP assignment draft. The finding — that the " +
    "document grants the assignment and is refused for not granting it — rests on its presence.");
});

check("the rules still enumerate satisfiers by clause id", () => {
  /*
   * The architectural finding, asserted as a property of the knowledge rather
   * than of any one family. If a rule gains a proposition-based requirement,
   * that is the repair beginning and the record must stop describing an
   * unconnected layer.
   */
  const dir = path.join(ROOT, "knowledge-base/constraints");
  let idListed = 0, propositionListed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const body = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const r of (body.rules || body.constraints || [])) {
      if (Array.isArray(r.fails_if)) idListed += 1;
      if (r.requires_proposition || r.satisfied_by_proposition) propositionListed += 1;
    }
  }
  assert.ok(idListed > 0, "no rule enumerates satisfiers by clause id any more — the finding's premise is gone.");
  assert.strictEqual(propositionListed, 0,
    `${propositionListed} rule(s) now express a requirement as a proposition. That is the intended ` +
    `direction, but block-decomposition.json still describes the proposition layer as unconnected — ` +
    `update it in the same change.`);
});

check("clauses still do not declare what they establish", () => {
  const sample = ["EMP_APPOINTMENT_TERMS_001", "IPA_COPYRIGHT_ASSIGNMENT_001", "PN_PROMISE_TO_PAY_001"];
  for (const id of sample) {
    const c = getClauseById(id);
    if (!c) continue;
    assert.ok(!c.establishes && !c.propositions,
      `${id} now declares what it establishes. That is the other half of the repair; the record ` +
      `describes clauses as carrying no such field.`);
  }
});

/* ── The record must keep the parts a later reader cannot re-derive ───────── */

check("the correction to the earlier split is kept", () => {
  const c = R.a_correction_to_my_own_earlier_split;
  assert.ok(c?.what_is_true && c.$but_the_split_still_matters,
    "the correction — that 10 of 11 are blocked only by queued rules, and that queue membership is " +
    "not the same as scope-resolvability — was dropped.");
});

check("the instrument's own failure is kept", () => {
  const i = R.the_instrument_and_where_it_fails;
  assert.ok(Array.isArray(i?.it_failed_in_both_directions_on_the_IP_case) &&
    i.it_failed_in_both_directions_on_the_IP_case.length === 2,
    "the record no longer states that the category test produced a false positive AND a false negative " +
    "on the IP case. Without it, a reader will trust the heuristic further than it has earned.");
});

check("the over-enumeration observation stays raised and unpursued", () => {
  const o = R.a_separate_observation_not_investigated;
  assert.ok(/CORE_IDENTITY_001/.test(JSON.stringify(o)),
    "the observation that CONTRACT_REQUIRES_CONSIDERATION accepts an identity clause as proof of " +
    "consideration was dropped. It is the opposite failure and would pass documents that have none.");
});

check("nothing here claims a legal question was answered", () => {
  const joined = JSON.stringify(R.what_this_record_does_not_do || []);
  assert.ok(/legal question/.test(joined) && /does not repair/i.test(joined),
    "the record no longer disclaims deciding the legal questions or repairing anything.");
});

console.log(`\n${checks} checks passed  (${blocked.length} families produce no draft)`);
