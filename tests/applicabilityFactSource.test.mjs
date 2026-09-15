/**
 * applicabilityFactSource.test.mjs
 *
 * THE ASSESSOR IS NOT TOLD WHAT THE GENERATOR KNEW.
 *
 * Found at step F of the Loan certification, on the first run of newly authored
 * requirements. Three of them rest on `is_secured`, which is now a declared
 * Yes/No answer, and all three reported APPLICABILITY_UNKNOWN whichever way it
 * was answered — while the same document shipped LOAN_SECURITY_001 because
 * clause selection had read the very same flag as true.
 *
 * Two halves of the system disagree about one fact, because they read it from
 * different places:
 *
 *     clause selection   deriveGenerationControls(documentType, variables)
 *     assessment         resolution.positions   (the fact-question layer)
 *
 * `is_secured` is a derived control. It never appears in resolution.positions,
 * so a requirement conditioned on it can never become applicable. The document
 * asserts security and the report says nobody knows whether security applies.
 *
 * THIS IS NOT LOAN-SPECIFIC. Every position-conditioned requirement in the
 * product is affected — nine of nine, across three families. It also explains
 * findings that have been read as honest uncertainty for some time: the
 * employment family's POSH and maternity requirements report
 * APPLICABILITY_UNKNOWN not because nobody established the facts, but because
 * the assessor is never handed them.
 *
 * NOT REPAIRED HERE. The fix looks obvious — give the assessor the same controls
 * generation used — and it changes reported findings in three families,
 * including moving a POSH requirement to NOT_APPLICABLE, which is the exact
 * state the employment falsification exists to make suspicious. That transition
 * is only correct if the derivation behind it is, and that is a legal-knowledge
 * question rather than a plumbing one. Recorded precisely so the decision is
 * made on the evidence.
 */
import assert from "node:assert";
import { loadDocumentRequirements, assessRequirements, COVERAGE }
  from "../backend/services/documentRequirements.js";
import { buildVariables } from "../scripts/freezeClauseBaseline.mjs";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let checks = 0;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselines = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
).types || {};

// Every requirement whose applicability rests on a flag, and what it reports
// today versus what it would report if the assessor saw the generator's facts.
const requirements = loadDocumentRequirements({ refresh: true });
const rows = [];
for (const [family, list] of requirements) {
  const clauses = baselines[family]?.full?.clauses || [];
  if (!clauses.length) continue;
  const positioned = list.filter((r) => r.applicability?.position);
  if (!positioned.length) continue;
  const variables = buildVariables(family, "full");
  const derived = deriveControlsForDocument(family, variables);
  const asShipped = assessRequirements(family, clauses, {}, variables);
  const asKnown = assessRequirements(family, clauses, derived, variables);
  for (const requirement of positioned) {
    rows.push({
      family, id: requirement.id, flag: requirement.applicability.position,
      shipped: asShipped.results.find((r) => r.id === requirement.id).coverage,
      known: asKnown.results.find((r) => r.id === requirement.id).coverage,
    });
  }
}
assert.ok(rows.length >= 9, `only ${rows.length} position-conditioned requirements found`);
checks += 1;

// Today: every one is undetermined.
const determinedToday = rows.filter((r) => r.shipped !== COVERAGE.APPLICABILITY_UNKNOWN);
assert.deepEqual(
  determinedToday.map((r) => `${r.family}/${r.id}`), [],
  "a position-conditioned requirement now resolves as shipped. If the assessor was given the " +
  "derived controls, invert this file: it should become a guarantee that the two halves of the " +
  "system agree, and the three families' findings should be re-read."
);
checks += 1;

// And the facts exist — the assessor simply is not given them.
const resolvable = rows.filter((r) => r.known !== COVERAGE.APPLICABILITY_UNKNOWN);
assert.equal(
  resolvable.length, rows.length,
  `${rows.length - resolvable.length} requirements stay undetermined even when the assessor is ` +
  `handed the derived controls. Those are genuinely unestablished and are a different problem ` +
  `from this one: ${rows.filter((r) => r.known === COVERAGE.APPLICABILITY_UNKNOWN)
    .map((r) => `${r.family}/${r.id} (${r.flag})`).join(", ")}`
);
checks += 1;

// The disagreement stated at its sharpest: the document acts on the fact while
// the report says the fact is unknown.
const loanClauses = baselines.LOAN_AGREEMENT?.full?.clauses || [];
const secured = buildVariables("LOAN_AGREEMENT", "full");
assert.strictEqual(
  deriveControlsForDocument("LOAN_AGREEMENT", secured).is_secured, true,
  "the loan fixture is no longer secured — this assertion needs a fixture that is"
);
assert.ok(loanClauses.includes("LOAN_SECURITY_001"), "the shipped loan carries a security clause");
assert.strictEqual(
  assessRequirements("LOAN_AGREEMENT", loanClauses, {}, secured)
    .results.find((r) => r.id === "SECURITY_POSITION_SETTLED").coverage,
  COVERAGE.APPLICABILITY_UNKNOWN,
  "the security requirement now resolves — the two halves agree and this file should be rewritten"
);
checks += 3;

console.log(
  `PASS  ${rows.length} position-conditioned requirements are permanently undetermined; all ${rows.length} ` +
  `resolve\n      when the assessor is given the facts generation already used`
);
console.log(`\nALL GREEN (${checks} checks)`);
