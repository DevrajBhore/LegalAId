/**
 * positionSemantics.test.mjs
 *
 * A flag is not a boolean. It records where the user stands on a mechanism:
 *
 *   TRUE     the user has affirmatively selected or required it
 *   FALSE    the user has affirmatively rejected it
 *   UNKNOWN  the user has not expressed a position
 *
 * The rule these tests defend: NEVER CONVERT ABSENCE OF INFORMATION INTO AN
 * AFFIRMATIVE CONTRACTUAL POSITION.
 *
 * The system used to violate it everywhere. A Quick Form consultancy -- client,
 * consultant, fee, term, services -- reached the generator with thirteen of
 * thirteen shape-determining flags set to hard `false` and not one set to
 * unknown. Every `include_if` gate then read a user who had never been asked as
 * a user who had refused, so the only clauses that survived were the
 * unconditional ones and the force-injected boilerplate. That is the whole
 * generic-document problem, and it was a representation bug.
 *
 * The rental agreement is the clearest single instance. `utilities_included`
 * was read by two blueprints and collected by no form, so it was permanently
 * unknown; the gate `utilities_included == false` fired on that silence and put
 * a clause into every tenancy making the tenant liable for all utility bills
 * and letting arrears be deducted from the deposit. Nobody agreed to that.
 */
import assert from "node:assert";
import {
  POSITION,
  positionOf,
  deriveGenerationControls,
} from "../backend/services/generationControls.js";
import { assembleDocument } from "../backend/services/clauseAssembler.js";

let checks = 0;
const check = (actual, expected, what) => {
  assert.deepStrictEqual(actual, expected, what);
  checks += 1;
};

// ── 1. The three positions ──────────────────────────────────────────────────
for (const v of [true, "Yes", "yes", "TRUE", "1", "required"]) {
  check(positionOf(v), POSITION.TRUE, `${JSON.stringify(v)} is an affirmative position`);
}
for (const v of [false, "No", "no", "FALSE", "0", "not applicable", "none"]) {
  check(positionOf(v), POSITION.FALSE, `${JSON.stringify(v)} is a rejection`);
}
for (const v of [null, undefined, "", "   ", "maybe", "Maharashtra"]) {
  check(positionOf(v), POSITION.UNKNOWN, `${JSON.stringify(v)} expresses no position`);
}
console.log(`PASS  position mapping (${checks} inputs)`);

// ── 2. Silence is not rejection ─────────────────────────────────────────────
// The Quick Form case. A flag may still be FALSE here, but only where FALSE is
// a determination drawn from a fact the user actually stated -- a fee of
// Rs. 30,000 is genuinely not high value -- never from the absence of an answer.
const QUICK = {
  party_1_name: "Devraj Vishal Bhore",
  party_2_name: "Varun Raghunath Shastri",
  consulting_fee: "30000",
  contract_duration: "12 months",
  services_description: "Strategic advisory covering market entry.",
};
const quick = deriveGenerationControls("CONSULTANCY_AGREEMENT", QUICK);
const flagNames = Object.keys(quick).filter((k) =>
  /^(include_|involves_|is_|has_|requires_)/.test(k)
);

// Each of these is a determination from a stated fact, not a manufactured
// refusal. is_high_value and is_long_engagement are read off the fee and the
// term the user gave; has_special_terms describes the record itself rather than
// a mechanism the user could accept or decline.
const JUSTIFIED_FALSE = new Set(["is_high_value", "is_long_engagement", "has_special_terms"]);
const rejected = flagNames.filter((k) => positionOf(quick[k]) === POSITION.FALSE);
const manufactured = rejected.filter((k) => !JUSTIFIED_FALSE.has(k));
assert.deepStrictEqual(
  manufactured,
  [],
  `Quick Form manufactured a rejection out of silence for: ${manufactured.join(", ")}. ` +
  `A flag the user was never asked about must be UNKNOWN, not false. If one of these ` +
  `genuinely follows from a fact the user stated, add it to JUSTIFIED_FALSE with the reason.`
);
const unknowns = flagNames.filter((k) => positionOf(quick[k]) === POSITION.UNKNOWN);
assert.ok(
  unknowns.length >= 8,
  `only ${unknowns.length} flags are open after a Quick Form intake; the gap check has ` +
  `nothing to reason over. Something has started collapsing unknowns back into positions.`
);
console.log(
  `PASS  Quick Form leaves ${unknowns.length} positions open, ` +
  `${rejected.length} determined from stated facts, 0 manufactured`
);

// ── 3. An inference may establish a position, never reject one ──────────────
// Stating a warranty period is good evidence the user wants a warranty. Saying
// nothing about warranties is not evidence they refuse one.
const withWarranty = deriveGenerationControls("CONSULTANCY_AGREEMENT", {
  ...QUICK,
  warranty_period: "6 months",
});
check(positionOf(withWarranty.include_warranty_clause), POSITION.TRUE,
  "a stated warranty period infers the mechanism");
check(positionOf(quick.include_warranty_clause), POSITION.UNKNOWN,
  "silence about warranties leaves the position open");

// A stated rejection is authoritative and survives a contrary inference.
const declined = deriveGenerationControls("CONSULTANCY_AGREEMENT", {
  ...QUICK,
  warranty_period: "6 months",
  include_warranty_clause: "No",
});
check(positionOf(declined.include_warranty_clause), POSITION.FALSE,
  "an explicit No beats the inference");
console.log("PASS  inference establishes, never rejects");

// ── 4. The gate grammar ─────────────────────────────────────────────────────
// Exercised through a real blueprint rather than by reaching into the parser,
// so the test fails if the assembler stops routing conditions through it.
const RENTAL = {
  party_1_name: "Ramesh Anant Kulkarni", party_1_type: "Individual",
  party_1_address: "12 Bhandarkar Road, Pune, Maharashtra 411004",
  party_2_name: "Sneha Vikram Deshpande", party_2_type: "Individual",
  party_2_address: "7 Law College Road, Pune, Maharashtra 411004",
  property_address: "Flat 4B, Sunshine Apartments, MG Road, Pune, Maharashtra 411001",
  permitted_use: "Residential use only",
  occupancy_fee: "25000", security_deposit: "100000",
  occupancy_term: "11 months", effective_date: "2026-09-01",
  operating_state: "Maharashtra", execution_city: "Pune",
};
const tenantPaysUtilities = (utilities) => {
  const variables = { ...RENTAL };
  if (utilities !== undefined) variables.utilities_included = utilities;
  const draft = assembleDocument("RENTAL_AGREEMENT", variables);
  return (draft?.clauses || []).some((c) => c.clause_id === "RENT_UTILITIES_001");
};

check(tenantPaysUtilities(undefined), false,
  "a tenancy where nobody was asked about utilities must NOT assert that the tenant pays them");
check(tenantPaysUtilities("Yes"), false,
  "utilities included in the rent means no separate tenant liability");
check(tenantPaysUtilities("No"), true,
  "utilities excluded from the rent is the answer that earns the clause");
console.log("PASS  gate reads the three positions distinctly (rental utilities)");

console.log(`\nALL GREEN (${checks} checks)`);
