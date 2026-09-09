/**
 * inputMismatchSeverity.test.mjs
 *
 * Guards the line drawn in draftConsistencyValidator.js between a mismatch that
 * WITHHOLDS the document and one that ships with it.
 *
 * Why this exists: every INPUT_MISMATCH check used to block. Measured across the
 * 40 document types, 9 refused to generate on a fully-completed intake and every
 * blocking issue was one of these -- while 8 of those 9 generated perfectly on a
 * MINIMAL intake. Filling in the form was what broke the document.
 *
 * The checks are verbatim substring tests, but the hardening builders rewrite
 * input into contract prose, so a correct rewrite fails the test. Blocking on
 * that leaves the user with nothing and an instruction they cannot act on.
 *
 * The two directions this protects:
 *   - a descriptive field not echoed word for word must NOT withhold the document
 *   - a party, forum, start date or duration mismatch MUST still withhold it
 */
import { validateDraftConsistency } from "../backend/services/draftConsistencyValidator.js";

const failures = [];
const passes = [];
const check = (label, condition, detail = "") => {
  if (condition) passes.push(label);
  else failures.push(`${label}${detail ? `\n    ${detail}` : ""}`);
};

const VARIABLES = {
  party_1_name: "Northline Industries Private Limited",
  party_1_address: "12 Turner Road, Bandra West, Mumbai, Maharashtra 400050",
  party_1_type: "Private Limited Company",
  party_2_name: "Cavalry Logistics LLP",
  party_2_address: "88 Residency Road, Bengaluru, Karnataka 560025",
  party_2_type: "LLP",
  governing_law_state: "Maharashtra",
  arbitration_city: "Mumbai",
  renewal_terms: "Renewable for two further years by mutual written consent",
};

// An identity clause that names both parties correctly, and a term clause that
// paraphrases the renewal arrangement instead of quoting it -- which is what a
// good builder actually does.
const draftWith = (identityText, termText) => ({
  clauses: [
    { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", text: identityText },
    { clause_id: "CORE_TERM_001", category: "TERM", text: termText },
    {
      clause_id: "CORE_GOVERNING_LAW_001",
      category: "GOVERNING_LAW",
      text: "This Agreement is governed by the laws of India and the courts at Mumbai, Maharashtra shall have jurisdiction.",
    },
    // The seat check is deliberately skipped where an instrument carries no
    // dispute-resolution clause -- a PoSH policy supplies its own mechanism and
    // has nothing to bind a commercial seat to. So the fixture needs one, or
    // the test proves nothing.
    {
      clause_id: "CORE_DISPUTE_RESOLUTION_001",
      category: "DISPUTE_RESOLUTION",
      text: "Any dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be Mumbai.",
    },
  ],
});

const CORRECT_IDENTITY =
  "This Agreement is made between Northline Industries Private Limited, a Private Limited Company " +
  "having its registered office at 12 Turner Road, Bandra West, Mumbai, Maharashtra 400050 (the " +
  "First Party), and Cavalry Logistics LLP, an LLP having its registered office at 88 Residency " +
  "Road, Bengaluru, Karnataka 560025 (the Second Party).";

const run = (draft, variables = VARIABLES) =>
  validateDraftConsistency(draft, { documentType: "NDA", variables });

const byId = (issues, prefix) =>
  issues.filter((issue) => String(issue.rule_id || "").startsWith(prefix));

// ── 1. A paraphrased renewal arrangement reports, but does not withhold ──────
{
  const issues = run(
    draftWith(
      CORRECT_IDENTITY,
      "This Agreement commences on the Effective Date and may be renewed for a further " +
        "two (2) years upon mutual written agreement of the Parties."
    )
  );
  const renewal = byId(issues, "INPUT_MISMATCH_RENEWAL_TERMS");

  check(
    "a paraphrased renewal arrangement is still reported",
    renewal.length > 0,
    "the check disappeared entirely, which loses the signal"
  );
  check(
    "a paraphrased renewal arrangement does not withhold the document",
    renewal.every((issue) => issue.blocks_generation === false),
    JSON.stringify(renewal.map((i) => [i.rule_id, i.blocks_generation]))
  );
  check(
    "the advisory tells the user something they can act on",
    renewal.every((issue) => /edit it in the editor/i.test(issue.suggestion || "")),
    renewal.map((i) => i.suggestion).join(" | ")
  );
  check(
    "the advisory keeps its severity so it is not buried",
    renewal.every((issue) => issue.severity === "HIGH"),
    renewal.map((i) => i.severity).join(", ")
  );
}

// ── 2. A document that names the wrong party is still refused ────────────────
{
  const issues = run(
    draftWith(
      "This Agreement is made between Redgate Traders Private Limited, having its registered " +
        "office at 5 Some Road, Pune, Maharashtra 411001 (the First Party), and Cavalry Logistics " +
        "LLP, an LLP having its registered office at 88 Residency Road, Bengaluru, Karnataka " +
        "560025 (the Second Party).",
      "This Agreement may be renewed for a further two (2) years upon mutual written agreement."
    )
  );
  const identity = byId(issues, "INPUT_MISMATCH_PARTY_1");

  check(
    "a document naming the wrong party still raises an identity mismatch",
    identity.length > 0
  );
  check(
    "an identity mismatch still withholds the document",
    identity.some((issue) => issue.blocks_generation === true),
    JSON.stringify(identity.map((i) => [i.rule_id, i.blocks_generation]))
  );
}

// ── 3. The wrong forum is still refused ─────────────────────────────────────
{
  const issues = run(
    draftWith(
      CORRECT_IDENTITY,
      "This Agreement may be renewed for a further two (2) years upon mutual written agreement."
    ),
    { ...VARIABLES, arbitration_city: "Chennai" }
  );
  const seat = byId(issues, "INPUT_MISMATCH_ARBITRATION_CITY");

  check("a seat that is not in the document is still raised", seat.length > 0);
  check(
    "a seat mismatch still withholds the document",
    seat.every((issue) => issue.blocks_generation === true),
    "the seat fixes which High Court supervises the arbitration under the A&C Act 1996"
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\nFAIL ${failures.length} of ${failures.length + passes.length} checks\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
for (const pass of passes) console.log(`PASS  ${pass}`);
console.log("\nall passed");
