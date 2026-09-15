/**
 * derivationProbes.test.mjs
 *
 * A PROBE THAT MEASURES THE WRONG THING IS WORSE THAN NO PROBE, BECAUSE IT
 * PRODUCES A CONFIDENT NUMBER.
 *
 * Three times in one stretch of work a reachability probe reported that a gate
 * rested on nothing, and three times it was the probe that was broken:
 *
 *   1. A hand-written alias table reported sixteen unreachable gates. All
 *      sixteen were reachable.
 *   2. A probe invented lender_type values — "Bank", "NBFC" — and found nothing,
 *      because the declared option is "Scheduled Bank".
 *   3. deriveGenerationControls takes (documentType, variables). Three audit
 *      scripts called it (variables, documentType). Handed a string where it
 *      expects an object it returns almost nothing, every gate reads as
 *      sourceless, and the portfolio audit reported 29 orphan propositions where
 *      there are 10 — which was enough to justify migrating a live requirement
 *      onto a different applicability source and make every Master Service
 *      Agreement report it permanently undetermined.
 *
 * None of those failures was loud. Each produced a plausible smaller number and
 * an argument built on it. So the probing METHOD is pinned here, separately from
 * anything that uses it.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { deriveGenerationControls } from "../backend/services/generationControls.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { buildVariables } from "../scripts/freezeClauseBaseline.mjs";
import { getVariables } from "../backend/config/variableConfig.js";

let checks = 0;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// ── 1. Argument order, asserted directly ────────────────────────────────────
//
// The call that matters, spelled out, so a reordering of the signature fails
// here rather than in a report nobody re-derives.
const right = deriveGenerationControls(
  "MASTER_SERVICE_AGREEMENT", buildVariables("MASTER_SERVICE_AGREEMENT", "full")
);
assert.ok(Object.keys(right).length > 5,
  "deriveGenerationControls(documentType, variables) returned almost nothing — either the " +
  "signature changed or the fixture is empty");
// And the swapped call must be visibly useless, so the failure mode stays loud.
const swapped = deriveGenerationControls(
  buildVariables("MASTER_SERVICE_AGREEMENT", "full"), "MASTER_SERVICE_AGREEMENT"
);
assert.ok(
  Object.keys(swapped).length < Object.keys(right).length,
  "calling deriveGenerationControls with the arguments reversed returns as much as calling it " +
  "correctly. If that is now true, the swap is undetectable and this test cannot protect anyone."
);
checks += 2;

// ── 2. Fixtures come from the schema, never from invention ──────────────────
//
// A probe may only use values the schema itself declares. Inventing plausible
// ones is how "Scheduled Bank" was missed.
const schema = getVariables("LOAN_AGREEMENT") || {};
const lenderType = schema.lender_type;
assert.ok(lenderType, "LOAN_AGREEMENT no longer declares lender_type");
const fixture = buildVariables("LOAN_AGREEMENT", "full");
if (Array.isArray(lenderType.options) && lenderType.options.length) {
  const declared = lenderType.options.map((o) => (typeof o === "string" ? o : o?.value ?? o?.label));
  assert.ok(declared.includes(fixture.lender_type),
    `the fixture uses lender_type "${fixture.lender_type}", which the schema does not declare`);
  checks += 1;
}
checks += 1;

// ── 3. The flags that were wrongly called orphans ───────────────────────────
//
// Each of these was reported as "gates a clause with nothing able to establish
// it". Each is derived. They are named individually because the aggregate count
// was what made the error persuasive, and a count cannot be checked by reading.
const DERIVED = {
  MASTER_SERVICE_AGREEMENT: ["processes_personal_data"],
  EMPLOYMENT_CONTRACT: ["processes_personal_data", "is_female_employee", "employer_headcount_ge_10"],
  LOAN_AGREEMENT: ["lender_is_regulated", "lender_is_nbfc", "is_cross_border"],
  RENTAL_AGREEMENT: ["is_commercial_lease", "long_term_lease"],
};
for (const [documentType, flags] of Object.entries(DERIVED)) {
  const derived = deriveGenerationControls(documentType, buildVariables(documentType, "full")) || {};
  for (const flag of flags) {
    assert.ok(flag in derived,
      `${documentType}: "${flag}" is not derived. It was reported as an orphan once and was not ` +
      `one; if it has genuinely become unreachable, that is a regression in intake, not a ` +
      `correction to this list.`);
    checks += 1;
  }
}
console.log(
  `PASS  ${Object.values(DERIVED).flat().length} flags once miscounted as orphans are derived`
);

// ── 4. No consumer reconstructs the derivation contract ────────────────────
//
// The bug was not really an argument order. It was that three scripts each knew
// the contract independently, so getting it wrong was a thing each of them could
// do on its own. Measurement code now asks through one adapter, and this asserts
// that it cannot go round it.
for (const name of ["auditClaimAuthority", "portfolioInventory", "abstractionPressure",
                    "measurementIntegrity"]) {
  // Tested on the IMPORT, not on the text of a call.
  //
  // Screening the source for "deriveGenerationControls(" fired on these files'
  // own prose explaining the bug, and then on a string literal quoting it —
  // twice making the guard report a problem that was a sentence. The invariant
  // is structural anyway: a module that never imports the raw function cannot
  // reconstruct its contract, whatever it says in its comments.
  const source = fs.readFileSync(path.join(ROOT, `scripts/${name}.mjs`), "utf8");
  const imports = [...source.matchAll(/^\s*import\s+\{([^}]*)\}\s+from\s+["']([^"']+)["']/gm)];
  const raw = imports.find(([, names, from]) =>
    /generationControls\.js$/.test(from) && /\bderiveGenerationControls\b/.test(names));
  assert.ok(
    !raw,
    `${name}: imports deriveGenerationControls directly. Measurement code must go through ` +
    `derivationAdapter, so the call contract exists in exactly one place.`
  );
  checks += 1;
}
console.log("PASS  no audit script reconstructs the derivation call contract");

// The adapter REFUSES a swapped call rather than answering it. A wrong call that
// returns a small plausible object is how a false measurement becomes a finding.
assert.throws(
  () => deriveControlsForDocument({ loan_amount: "500000" }, "LOAN_AGREEMENT"),
  /must be an UPPER_SNAKE_CASE document type/,
  "the adapter answered a swapped call instead of refusing it"
);
assert.throws(() => deriveControlsForDocument("LOAN_AGREEMENT", "not an object"), /must be the intake/);
assert.ok(Object.keys(deriveControlsForDocument("LOAN_AGREEMENT", { loan_amount: "500000" })).length > 5);
checks += 3;

// ── 5. The three audit scripts agree with one another ──────────────────────
//
// They answer different questions over different populations, which is fine, and
// they must still agree about the underlying facts. Two of them disagreed by
// three gates because one tested "is this field askable ANYWHERE" while
// sanitisation filters to the document's OWN schema. Three gates is small enough
// to read as rounding, which is precisely how the previous wrong numbers
// survived being looked at.
const integrity = execFileSync("node", [path.join(ROOT, "scripts/measurementIntegrity.mjs")],
  { encoding: "utf8", cwd: ROOT });
const claims = execFileSync("node", [path.join(ROOT, "scripts/auditClaimAuthority.mjs")],
  { encoding: "utf8", cwd: ROOT });
const pressure = execFileSync("node", [path.join(ROOT, "scripts/abstractionPressure.mjs")],
  { encoding: "utf8", cwd: ROOT });
const number = (text, pattern) => {
  const match = text.match(pattern);
  assert.ok(match, `could not read "${pattern}" from the report`);
  return Number(match[1]);
};
const integrityFlags = number(integrity, /PROPOSITION \/ NO SOURCE — \d+ gate uses, (\d+) distinct/);
const claimsFlags = number(claims, /(\d+) distinct propositions gate a clause and have no source/);
const pressureFlags = number(pressure, /(\d+) distinct propositions gate a clause with no source/);
assert.equal(claimsFlags, integrityFlags,
  `auditClaimAuthority reports ${claimsFlags} sourceless propositions, measurementIntegrity ` +
  `${integrityFlags}. They must agree about the facts even where they report different populations.`);
assert.equal(pressureFlags, integrityFlags,
  `abstractionPressure reports ${pressureFlags}, measurementIntegrity ${integrityFlags}`);
checks += 3;
console.log(`PASS  three audit scripts independently report ${integrityFlags} sourceless propositions`);


console.log(`\nALL GREEN (${checks} checks)`);
