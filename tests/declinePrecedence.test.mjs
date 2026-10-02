/**
 * declinePrecedence.test.mjs — D4.34-A
 *
 * PINS A DEFECT THAT IS NOT YET REPAIRABLE.
 *
 * The precedence question — does a structural dependency outrank a user's
 * express decline? — has no authority behind either answer, so the resolver is
 * deliberately left as it is. This file exists so that the defect cannot move
 * without someone noticing, in either direction:
 *
 *   it SPREADS    — another family, or another clause, joins the exposed set
 *   it VANISHES   — someone "fixes" it while the precedence question is still
 *                   recorded as unanswered, which would mean an unauthorised
 *                   legal rule was encoded to make a test go green
 *
 * Both fail here. A deliberate repair updates this file and the record together.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { assembleDocument, getAllClauses } from "../backend/services/clauseAssembler.js";
import { resolveDependencies } from "../backend/services/dependencyResolver.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const RECORD = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/decline-precedence.json"), "utf8"));

const TARGET = "CORE_DEFINITIONS_001";

/* ── The exposure surface, recomputed rather than pinned as a literal ─────── */

const structuralCarriers = new Map();
for (const c of getAllClauses()) {
  for (const target of (Array.isArray(c.depends_on) ? c.depends_on : [])) {
    if (!structuralCarriers.has(target)) structuralCarriers.set(target, []);
    structuralCarriers.get(target).push(c.clause_id);
  }
}

function measureExposure() {
  const exposed = [];
  for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
    let draft;
    try { draft = assembleDocument(type, variablesFor(type, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED })); }
    catch { continue; }
    const excluded = draft.metadata?.applicability_excluded_clause_ids;
    if (!Array.isArray(excluded)) continue;
    const presentIds = new Set(draft.clauses.map((c) => c.clause_id));
    for (const target of excluded) {
      const carriers = (structuralCarriers.get(target) || []).filter((id) => presentIds.has(id));
      if (carriers.length) exposed.push(`${type}:${target}`);
    }
  }
  return exposed.sort();
}

check("the exposed set is exactly the one the record names", () => {
  const recorded = RECORD.the_exposure_surface.pairs
    .map((p) => `${p.family}:${p.excluded_clause}`).sort();
  const measured = measureExposure();
  assert.deepStrictEqual(measured, recorded,
    `the set of (family, excluded clause with a structural carrier present) pairs has changed.\n` +
    `  recorded: ${recorded.join(", ")}\n  measured: ${measured.join(", ")}\n` +
    `If it GREW, a decline is now being overridden somewhere new. If it SHRANK, check whether the ` +
    `precedence question in decline-precedence.json was answered with an authority first — and if ` +
    `it was not, the shrink is an unauthorised legal rule encoded to make a test pass.`);
});

/* ── The mechanism itself ─────────────────────────────────────────────────── */

check("selection still honours the decline — the gate is not the defect", () => {
  /*
   * Asserted because the tempting repair is to "fix the gate", and the gate is
   * already correct. If this ever fails, the defect has moved upstream and
   * everything below is measuring something else.
   */
  for (const p of RECORD.the_exposure_surface.pairs) {
    const draft = assembleDocument(p.family, variablesFor(p.family, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED }));
    assert.ok(!draft.clauses.some((c) => c.clause_id === p.excluded_clause),
      `${p.family}: ${p.excluded_clause} survived blueprint selection, so the conditional gate is no longer excluding it.`);
    assert.ok((draft.metadata?.applicability_excluded_clause_ids || []).includes(p.excluded_clause),
      `${p.family}: the decline was not recorded in applicability_excluded_clause_ids, so no downstream stage can consult it.`);
  }
});

check("the exclusion set reaches the dependency resolver", () => {
  /*
   * The load-bearing fact of the whole finding: this is NOT an information gap.
   * The stage has the decline and does not consult it on one of its two paths.
   * If this key ever stops being written, the finding changes character and the
   * repair changes with it.
   */
  const p = RECORD.the_exposure_surface.pairs[0];
  const draft = assembleDocument(p.family, variablesFor(p.family, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED }));
  assert.ok(Array.isArray(draft.metadata?.applicability_excluded_clause_ids),
    "applicability_excluded_clause_ids is absent, so the resolver cannot tell 'excluded' from 'no gate ran'.");
});

check("the defect reproduces: depends_on overrides the decline, and says so", () => {
  for (const p of RECORD.the_exposure_surface.pairs) {
    const variables = variablesFor(p.family, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
    const draft = assembleDocument(p.family, variables);
    const resolved = resolveDependencies(draft, { variables, document_type: p.family });
    const injected = resolved.clauses.find((c) => c.clause_id === p.excluded_clause);
    assert.ok(injected,
      `${p.family}: ${p.excluded_clause} was NOT re-injected. If this is a deliberate repair, the ` +
      `precedence question must be answered in decline-precedence.json with an authority, and this ` +
      `file updated in the same change.`);
    assert.strictEqual(injected.injected_by, "dependencyResolver",
      `${p.family}: ${p.excluded_clause} came back with injected_by=${JSON.stringify(injected.injected_by)}. ` +
      `A clause arriving by an unstamped path is D4.34-B, not this defect.`);
  }
});

check("required_with still refuses, so the asymmetry is real", () => {
  /*
   * The two branches disagreeing is the finding. If required_with started
   * injecting too, the defect would be twice the size; if it stopped refusing
   * visibly, the diagnostic that proves the resolver CAN consult the exclusion
   * set would be gone.
   */
  const src = fs.readFileSync(path.join(ROOT, "backend/services/dependencyResolver.js"), "utf8");
  assert.ok(/applicabilityExcludedClauseIds\.has\(requiredClauseId\)/.test(src),
    "the required_with branch no longer consults the exclusion set; the two dependency kinds no longer differ.");
});

/* ── The question must stay open until it is answered with an authority ───── */

check("the precedence question is unanswered, or answered with an authority", () => {
  const d = RECORD.the_precedence_decision;
  assert.ok(d, "decline-precedence.json no longer states the precedence question.");
  const status = String(d.$status || "");
  if (/NOT MADE/.test(status)) return;          // still open: correct
  assert.ok(d.authority && String(d.authority).trim(),
    "the precedence decision was marked made without recording the authority relied on. " +
    "A decision on which legal requirement outranks a party's express choice cannot rest on this " +
    "investigation's own assertion.");
});

check("the forbidden defaults are still named as forbidden", () => {
  /*
   * Enforces the property, not the wording: both directions must be listed as
   * things NOT to encode. A record that quietly drops one of them has made the
   * decision by omission.
   */
  const forbidden = RECORD.the_precedence_decision.$do_not_encode_meanwhile || [];
  const joined = forbidden.join(" ").toLowerCase();
  assert.ok(forbidden.length >= 2, "both directions must remain listed as unencodable defaults.");
  assert.ok(joined.includes("dependency beats decline"),
    "the record no longer forbids defaulting to 'dependency beats decline' — which is the rule currently in the code.");
  assert.ok(/decline always wins/.test(joined),
    "the record no longer forbids defaulting to 'decline always wins'.");
});

check("generation is unchanged by this investigation", () => {
  /*
   * D4.34-A was explicitly scoped as trace-only. This asserts the scope held:
   * the resolver still documents depends_on as injecting whatever the gate
   * decided. When that sentence changes, a repair happened, and it must arrive
   * with the answer to the precedence question.
   */
  const src = fs.readFileSync(path.join(ROOT, "backend/services/dependencyResolver.js"), "utf8");
  assert.ok(/Injected whatever the gate decided/.test(src),
    "the depends_on branch's documented behaviour changed. If the resolver now honours declines, " +
    "update decline-precedence.json with the authority for that precedence and update this file.");
});

check("the record keeps its own correction and its own methodology failure", () => {
  /*
   * Both were load-bearing: the control turned out to be a control by accident
   * of fixture, and the first trace was of the wrong object. A later reader who
   * sees only the conclusion would re-make both mistakes.
   */
  assert.ok(RECORD.a_correction_to_the_D4_34_record,
    "the correction to D4.34's control claim was dropped from the record.");
  assert.ok(RECORD.a_methodology_failure_in_this_investigation?.rule,
    "the 'a trace of a different object is not a trace' rule was dropped from the record.");
});

check("the other six occurrences stay excluded from this defect", () => {
  /*
   * The basis is that injected_by is stamped at exactly two sites, both in the
   * dependency resolver. If a third stamp site appears, an unstamped clause no
   * longer implies "not the resolver", and D4.34-B's boundary moves.
   */
  const src = fs.readFileSync(path.join(ROOT, "backend/services/dependencyResolver.js"), "utf8");
  const here = (src.match(/injected_by:/g) || []).length;
  assert.strictEqual(here, 2,
    `dependencyResolver now stamps injected_by at ${here} sites, not 2. The count is load-bearing: ` +
    `the claim that an unstamped clause did not come from this stage depends on every path here stamping.`);

  const others = [];
  for (const dir of ["backend/services", "backend/commercial"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!f.endsWith(".js") || f === "dependencyResolver.js") continue;
      if (/injected_by:/.test(fs.readFileSync(path.join(ROOT, dir, f), "utf8"))) others.push(`${dir}/${f}`);
    }
  }
  assert.deepStrictEqual(others, [],
    `another stage now stamps injected_by: ${others.join(", ")}. That is progress on D4.34-B, but this ` +
    `file's reasoning about which occurrences are NOT this defect has to be revisited with it.`);
});

console.log(`\n${checks} checks passed`);
