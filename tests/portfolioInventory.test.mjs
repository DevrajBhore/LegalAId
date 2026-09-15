/**
 * portfolioInventory.test.mjs
 *
 * THE INVENTORY IS THE SOURCE OF TRUTH FOR WHAT THIS PRODUCT NEEDS NEXT, SO IT
 * HAS TO BE ENFORCED RATHER THAN READ.
 *
 * One row per family x requirement, never per family: eleven healthy
 * requirements and one resting on a proposition nothing can establish is a
 * clean-looking family and a dangerous document, and rolled up to a single row
 * it reports as fine. That is the same arithmetic that once let twenty
 * boilerplate clauses satisfy one of thirteen identity requirements.
 *
 * The property this file exists to hold is the one the portfolio work found is
 * NOT implied by knowing an input's source:
 *
 *     processes_personal_data           source EVIDENCE   unknown -> ESCALATED
 *     an optional commercial preference source POSITION   unknown -> DEFAULTED
 *
 * Same shape of missing input, entirely different legal behaviour. Knowing where
 * a fact would have come from tells you nothing about what happens in its
 * absence, and the absence is the normal case.
 */
import assert from "node:assert";
import { buildInventory, DIMENSIONS, certified } from "../scripts/portfolioInventory.mjs";
import { loadPropositions } from "../backend/services/evidencePropositions.js";

let checks = 0;
const rows = buildInventory();
const propositions = loadPropositions({ refresh: true });
assert.ok(rows.length > 0, "the inventory is empty");

// ── 1. Every row is complete ────────────────────────────────────────────────
const SOURCES = ["UNCONDITIONAL", "POSITION", "FACT", "EVIDENCE"];
for (const row of rows) {
  assert.ok(SOURCES.includes(row.applicability_source),
    `${row.family}/${row.requirement_id}: applicability_source "${row.applicability_source}"`);
  assert.ok(String(row.failure_if_unknown || "").length > 3,
    `${row.family}/${row.requirement_id}: no failure_if_unknown`);
  assert.ok(row.identity_dimension, `${row.family}/${row.requirement_id}: no dimension`);
  assert.ok(row.certification_rung, `${row.family}/${row.requirement_id}: no rung`);
  checks += 4;
}

// ── 2. UNKNOWN NEVER COLLAPSES ──────────────────────────────────────────────
//
// Not into FALSE, not into NOT_APPLICABLE, not into a drafting default nobody
// chose. Measured across every requirement in the portfolio rather than asserted
// once in a comment.
const collapsing = rows.filter((row) =>
  row.applicability_source !== "UNCONDITIONAL" &&
  /\bFALSE\b|NOT_APPLICABLE|DEFAULT/i.test(row.failure_if_unknown)
);
assert.deepEqual(
  collapsing.map((r) => `${r.family}/${r.requirement_id}`), [],
  "an UNKNOWN input collapses into FALSE, NOT_APPLICABLE or a drafting default"
);
checks += 1;

// ── 3. Source does not determine failure behaviour ──────────────────────────
//
// If every source mapped to one outcome, the column would be redundant and the
// distinction it was added to capture would not exist in the data.
const behaviours = new Set(rows.map((r) => r.failure_if_unknown));
assert.ok(behaviours.size >= 2,
  `only ${behaviours.size} distinct failure behaviours across the portfolio`);

// THE EVIDENCE SOURCE IS BUILT AND NOTHING CONSUMES IT. Recorded as a ceiling,
// not hidden.
//
// One requirement did use it for a while. MASTER_SERVICE_AGREEMENT's
// PERSONAL_DATA_HANDLED was moved from POSITION to EVIDENCE because a portfolio
// audit reported that processes_personal_data had no source anywhere in the
// system. The audit was wrong — deriveGenerationControls takes
// (documentType, variables) and the script called it the other way round — and
// the flag is derived for that family and four others. The migration was
// reverted; see tests/derivationProbes.test.mjs, which pins the probing method
// so the same measurement cannot justify the same move again.
//
// So the mechanism, its seven evidence states and its acceptance corpus all
// stand on their own, and no authored requirement rests on them. That is an
// honest state and it must not be papered over by authoring a requirement onto
// the EVIDENCE source to make a number move — which is exactly how this got
// wrong the first time.
const evidenceRows = rows.filter((r) => r.applicability_source === "EVIDENCE");
assert.equal(
  evidenceRows.length, 0,
  `${evidenceRows.length} requirement(s) now use the EVIDENCE source: ` +
  `${evidenceRows.map((r) => `${r.family}/${r.requirement_id}`).join(", ")}. ` +
  `If that was deliberate, update this ceiling and assert their behaviour below.`
);
for (const row of evidenceRows) {
  assert.ok(/ESCALAT|UNRESOLVED/.test(row.failure_if_unknown),
    `${row.family}/${row.requirement_id}: an unestablished world proposition must escalate or ` +
    `be disclosed, never pass quietly`);
  assert.ok(propositions.has(row.rests_on),
    `${row.family}/${row.requirement_id}: rests on undeclared proposition "${row.rests_on}"`);
  assert.ok((row.subject_binding || []).length,
    `${row.family}/${row.requirement_id}: world evidence with no subject binding`);
  checks += 3;
}
checks += 2;

// ── 4. The unresolvable ceiling ─────────────────────────────────────────────
//
// Requirements resting on something nothing in the system can ever establish.
// These sit permanently at APPLICABILITY_UNKNOWN: not a bug in the assessor, a
// missing intake question or a missing derivation. Recorded as a CEILING that
// may fall and must never rise, in the same spirit as the verification flags —
// naming them is what stops them being rediscovered every few months.
// EMPTY, and it was not empty an hour ago.
//
// This list held EMPLOYMENT_CONTRACT/POSH_DUTY_REFLECTED (employer_headcount_ge_10)
// and MATERNITY_ENTITLEMENT (is_female_employee), recorded as intake debt:
// positions the employer knows and is never asked, which must never be converted
// into evidence requirements merely because an evidence subsystem exists.
//
// Both are derived. They always were. The entry existed because the probe that
// found them called deriveGenerationControls(variables, documentType) instead of
// (documentType, variables), so nearly nothing came back derived and any gate
// resting on a derived flag read as resting on nothing.
//
// The guard against converting them to evidence debt was therefore protecting
// against a problem that did not exist — which is its own lesson: a false
// measurement does not only cause wrong work, it causes correct-sounding
// principles about wrong work. Kept as an empty ceiling because a new entry here
// is a real event: a requirement that can never be assessed, added without a
// source.
const UNRESOLVABLE = [];
const unresolvable = rows
  .filter((r) => /NO SOURCE|UNDECLARED|UNKNOWABLE|never resolve/i.test(
    `${r.source_provenance} ${r.failure_if_unknown}`))
  .map((r) => `${r.family}/${r.requirement_id}`)
  .sort();
assert.deepEqual(
  unresolvable, UNRESOLVABLE,
  `a requirement now rests on something nothing in the system can establish: ` +
  `${unresolvable.join(", ")}. Before adding it to this list, check the probe — three times ` +
  `running it was the measurement that was broken, not the knowledge base.`
);
checks += 1;

// ── 5. Dimension coverage does not silently regress ─────────────────────────
//
// Each of these is a distinct class of legal truth, each was found by attacking
// a family, and each is held by at least one family today. A dimension losing
// its last family means the architecture stopped being exercised there, which is
// exactly the thing nobody notices.
const EXERCISED = {
  "identity / substance": 8,
  "statutory applicability": 2,
  "formality vs act": 2,
  "timing": 1,
  "declared character": 1,
  "external instrument": 2,
  "inter-clause coherence": 1,
};
for (const [dimension, test] of Object.entries(DIMENSIONS)) {
  const families = new Set(rows.filter(test).map((r) => r.family));
  // world-sourced applicability is deliberately absent — see the ceiling above.
  if (!(dimension in EXERCISED)) {
    assert.equal(families.size, 0,
      `"${dimension}" is now exercised by ${[...families].join(", ")}. Add it to EXERCISED.`);
    checks += 1;
    continue;
  }
  assert.ok(families.size > 0, `no family exercises "${dimension}"`);
  assert.ok(
    families.size >= EXERCISED[dimension],
    `"${dimension}" is exercised by ${families.size} families, was ${EXERCISED[dimension]}`
  );
  checks += 2;
}
console.log(
  `PASS  ${Object.keys(DIMENSIONS).length} architectural dimensions, each exercised by at least ` +
  `one family`
);

// ── 6. A family that generates has its findings measured ────────────────────
//
// CHEQUE_BOUNCE_NOTICE is the standing counter-example: it generates perfectly
// well, appears in no enumeration of supported types and has no recorded
// baseline, so its seven requirements report "family does not generate" and its
// rung reads NOT REGISTERED. It is the ONLY family exercising the timing
// dimension, which means that dimension is uncovered in shipped product.
const unmeasured = [...new Set(
  rows.filter((r) => r.current_finding === "family does not generate").map((r) => r.family)
)].sort();
assert.deepEqual(
  unmeasured, ["CHEQUE_BOUNCE_NOTICE"],
  `families with authored requirements that are never measured: ${unmeasured.join(", ")}`
);
assert.equal(
  certified.CHEQUE_BOUNCE_NOTICE, undefined,
  "CHEQUE_BOUNCE_NOTICE is now in the registry — remove this counter-example and the note above"
);
checks += 2;

console.log(`\nALL GREEN (${checks} checks)`);
