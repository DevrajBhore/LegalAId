/**
 * derivationIdempotence.test.mjs
 *
 * deriveGenerationControls runs TWICE on the same variables -- once in
 * prepareGenerationInput and again inside assembleDocument's clause selection.
 * Every derivation in it must therefore be idempotent.
 *
 * This is not theoretical. A derivation written as
 *
 *     derived.is_paid_service = normalizeText(v.is_paid_service).startsWith("yes")
 *
 * reads the boolean `true` it wrote on the first pass, stringifies it to
 * "true", finds that "true" does not start with "yes", and writes back false.
 * The conditional clause gated on that flag then never appears, and nothing
 * fails -- the document is simply missing a clause the user asked for. That is
 * exactly how the fees clause went missing for every paid service.
 */
import { deriveGenerationControls } from "../backend/services/generationControls.js";

const failures = [];
let checked = 0;

// One realistic intake per document type family, exercising the select-driven
// flags that gate conditional clauses.
const CASES = [
  ["TERMS_OF_SERVICE", {
    hosts_user_content: "Yes",
    requires_account: "Yes — registration required",
    is_paid_service: "Yes — recurring subscription",
    minimum_age: "Under 18 permitted with parent or guardian consent",
  }],
  ["TERMS_OF_SERVICE", {
    hosts_user_content: "No",
    requires_account: "No — open access",
    is_paid_service: "No — free to use",
    minimum_age: "18 and over only",
  }],
  ["IP_ASSIGNMENT_AGREEMENT", { ip_types: "Trade marks and goodwill" }],
  ["IP_ASSIGNMENT_AGREEMENT", { ip_types: "A mix of the above" }],
  ["DATA_PROCESSING_AGREEMENT", {
    involves_personal_data: "Yes",
    sub_processing_permitted: "No — not without prior written consent",
    cross_border_transfer: "No — processed only in India",
  }],
  ["DISTRIBUTION_AGREEMENT", { exclusivity: "Exclusive" }],
  ["EMPLOYMENT_CONTRACT", {
    workplace_headcount: "10 or more",
    employee_gender: "Female",
    seniority_level: "Senior / Leadership",
  }],
  ["RENTAL_AGREEMENT", { lease_term: "24", occupancy_term: "24" }],
];

for (const [docType, variables] of CASES) {
  const once = deriveGenerationControls(docType, variables);
  const twice = deriveGenerationControls(docType, once);

  for (const key of Object.keys(once)) {
    checked += 1;
    const a = once[key];
    const b = twice[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    failures.push(
      `${docType}  ${key}: first pass ${JSON.stringify(a)} -> second pass ${JSON.stringify(b)}\n` +
        `    a derivation that changes its own answer disables whatever it gates, silently`
    );
  }
}

if (failures.length) {
  console.error(`\nFAIL  ${failures.length} derivations are not idempotent\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS  ${checked} derived values are stable across a second derivation pass`);
console.log("all passed");
