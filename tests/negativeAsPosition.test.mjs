/**
 * negativeAsPosition.test.mjs
 *
 * "NO" MUST NOT BECOME "YES".
 *
 * The standing rule is that absence of information must never become an
 * affirmative contractual position. This is the stronger violation: an explicit
 * NEGATIVE becoming an affirmative position.
 *
 * Found while certifying the Loan family. `security_collateral` is a REQUIRED
 * free-text field, and `is_secured` is inferred from whether it holds a
 * "meaningful value" — which means anything that is not empty and not one of a
 * handful of bare tokens. So:
 *
 *     security_collateral: "None — this is an unsecured loan"
 *         -> is_secured = true
 *         -> LOAN_SECURITY_001 ships, describing collateral that does not exist
 *         -> and where the lender is regulated, LOAN_SARFAESI_ENFORCEMENT_001
 *            ships too, asserting the lender is a secured creditor entitled to
 *            take possession of the secured assets without a court
 *
 * The user is REQUIRED to write something in that box. The only answers that
 * produce an unsecured loan are four bare tokens. Every natural sentence
 * produces a secured one.
 *
 * It is not a Loan defect. Twelve free-text fields across the portfolio are read
 * as booleans this way, four of them required somewhere.
 *
 * WHAT THIS FILE DOES. It records the defect as a failing attack with the
 * surviving phrasings NAMED, and it deliberately does NOT fix it by widening the
 * negative-detection pattern. A wider screen has a narrower gap, not no gap, and
 * this codebase has been caught by screen-tuning enough times. The real fix is a
 * design decision with a large blast radius — a free-text box should not be able
 * to establish a position at all; the question should be asked — and that is not
 * something to slip in under a test.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasMeaningfulValue, deriveGenerationControls } from "../backend/services/generationControls.js";

let checks = 0;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── 1. security_collateral is FIXED — asserted as a guarantee ──────────────
//
// It was the first instance repaired, and it is the proof that the repair works:
// the position is declared, and no phrasing in the description can establish it.
const source = fs.readFileSync(path.join(ROOT, "backend/services/generationControls.js"), "utf8");
const proxies = [...new Set(
  [...source.matchAll(/hasMeaningfulValue\(variables\.(\w+)\)/g)].map((m) => m[1])
)].sort();
assert.ok(
  !proxies.includes("security_collateral"),
  "security_collateral is a boolean proxy again — the repair has been reverted"
);
checks += 1;

// Every phrasing that used to produce a secured loan now produces nothing,
// because the description no longer establishes anything.
const ATTACKS = [
  "None — this is an unsecured loan", "Unsecured", "No security", "no collateral",
  "Not required", "None agreed", "Nothing — unsecured", "There is no security",
  "First charge over receivables", "Mortgage over the factory premises",
];
for (const text of ATTACKS) {
  const derived = deriveGenerationControls("LOAN_AGREEMENT", {
    security_collateral: text, lender_type: "Scheduled Bank", loan_amount: "5000000",
  });
  assert.notStrictEqual(
    derived.is_secured, true,
    `"${text}" in the description established a SECURED loan. A description is not a position — ` +
    `not even a description of collateral.`
  );
  checks += 1;
}
// The declared answer, and only the declared answer, decides.
assert.strictEqual(
  deriveGenerationControls("LOAN_AGREEMENT", { loan_is_secured: "Yes" }).is_secured, true);
assert.strictEqual(
  deriveGenerationControls("LOAN_AGREEMENT", {
    loan_is_secured: "No", security_collateral: "First charge over receivables",
  }).is_secured, false,
  "a description of collateral overrode an explicit No");
assert.strictEqual(
  deriveGenerationControls("LOAN_AGREEMENT", { security_collateral: "First charge" }).is_secured,
  null, "an unanswered question must stay UNKNOWN, not become either answer");
checks += 3;

// ── 2. The other eleven remain a CEILING, named ────────────────────────────
//
// The class is systemic and the repair is deliberately not a batch migration:
// these fields look alike and may not mean alike. `deliverables` may be presence
// of a substantive description; `ip_ownership` may encode a commercial position;
// `warranty_period` is a value whose absence means something different again.
// The common invariant does not imply a common replacement.
const REMAINING = [
  "acceptance_criteria", "deliverables", "indemnity_scope", "ip_ownership",
  "nomenclature_terms", "non_compete_period", "service_levels", "special_terms",
  "support_maintenance", "tax_responsibility", "warranty_period",
];
assert.deepEqual(
  proxies, REMAINING,
  "the set of free-text fields read as booleans has changed. Removing one is progress — say " +
  "which, and what replaced it. Adding one is the defect returning."
);
checks += 1;

// And the detector they still rest on is still unsound, with the surviving
// phrasings named rather than counted.
const SURVIVING_NEGATIVES = [
  "None — not applicable to this engagement", "No security", "Not required",
  "None agreed", "Nothing — unsecured", "There is no security", "Unsecured",
  "n/a - unsecured loan", "no collateral",
];
assert.deepEqual(
  SURVIVING_NEGATIVES.filter((t) => hasMeaningfulValue(t)).sort(),
  [...SURVIVING_NEGATIVES].sort(),
  "a phrasing changed category. If the detector was widened rather than replaced, that is a " +
  "smaller gap and not a closed one."
);
for (const text of ["none", "None", "NONE", "nil", "N/A", "not applicable"]) {
  assert.ok(!hasMeaningfulValue(text), `"${text}" is no longer recognised as a negative`);
  checks += 1;
}
checks += 1;

console.log(
  `PASS  security_collateral repaired; ${proxies.length} free-text fields still read as booleans, ` +
  `named`
);
console.log(`\nALL GREEN (${checks} checks)`);
