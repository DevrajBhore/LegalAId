/**
 * The graph-level checks: a clause referring to a provision, a party capacity,
 * or a place the rest of the document does not carry.
 *
 * Each case here is taken from a real generated Guarantee Agreement that a
 * reviewing advocate marked "would not allow this to be executed".
 */

import assert from "node:assert/strict";

import { __testables } from "../backend/services/agreementGraphValidator.js";

const {
  findUnresolvedConceptIssues,
  findInstructionLeakIssues,
  findJurisdictionMismatchIssues,
  findEntityTypeContradictions,
} = __testables;

const draftOf = (...clauses) => ({ clauses });

/* ── Unresolved concept references ───────────────────────────────────────── */

const survivalClaimingEverything = {
  clause_id: "CORE_SURVIVAL_001",
  category: "TERMINATION",
  title: "Survival",
  text:
    "The provisions of this Agreement relating to confidentiality, ownership of " +
    "intellectual property, indemnity, limitation of liability, and this clause " +
    "shall survive expiry or termination.",
};

{
  const issues = findUnresolvedConceptIssues(
    draftOf(survivalClaimingEverything, {
      clause_id: "GUARANTEE_INDEMNITY_001",
      category: "RISK",
      title: "Guarantor Indemnity",
      text: "The Guarantor shall indemnify the Creditor.",
    })
  );
  const ids = issues.map((issue) => issue.rule_id).sort();

  assert.deepStrictEqual(ids, [
    "UNRESOLVED_CONCEPT_CONFIDENTIALITY",
    "UNRESOLVED_CONCEPT_INTELLECTUAL_PROPERTY",
    "UNRESOLVED_CONCEPT_LIABILITY_CAP",
  ]);
  // Indemnity is claimed too, but the document actually has one.
  // Advisory by default: LEGALAID_GRAPH_BLOCKS=1 promotes these to blocking.
  const blocking = process.env.LEGALAID_GRAPH_BLOCKS === "1";
  assert.ok(issues.every((issue) => issue.blocks_generation === blocking));
  assert.ok(issues.every((issue) => issue.severity === (blocking ? "CRITICAL" : "HIGH")));
  console.log("PASS  survival naming provisions the document lacks is flagged");
}

{
  const issues = findUnresolvedConceptIssues(
    draftOf(
      survivalClaimingEverything,
      { clause_id: "CORE_CONFIDENTIALITY_001", category: "CONFIDENTIALITY", text: "..." },
      { clause_id: "IP_OWNERSHIP_001", category: "IP", text: "..." },
      { clause_id: "CORE_LIABILITY_CAP_001", category: "RISK", text: "..." },
      { clause_id: "CORE_INDEMNITY_001", category: "INDEMNITY", text: "..." }
    )
  );
  assert.deepStrictEqual(issues, []);
  console.log("PASS  the same survival clause passes once the provisions exist");
}

{
  // The false positive that would have made this check useless: an obligation
  // about a password is not a reference to a confidentiality clause.
  const issues = findUnresolvedConceptIssues(
    draftOf({
      clause_id: "TOS_ELIGIBILITY_ACCOUNT_001",
      category: "ELIGIBILITY",
      title: "Eligibility and Accounts",
      text:
        "You are responsible for maintaining the confidentiality of your account " +
        "credentials and for all activities that occur under your account.",
    })
  );
  assert.deepStrictEqual(issues, []);
  console.log("PASS  'confidentiality of your credentials' is not a cross-reference");
}

{
  const issues = findUnresolvedConceptIssues(
    draftOf({
      clause_id: "LOAN_DEFAULT_001",
      category: "FINANCE",
      title: "Events of Default",
      text:
        "material breach by the Borrower of any representation, warranty, or covenant " +
        "under this Agreement; and if any security created under this Agreement " +
        "ceases to be valid, enforceable, or perfected.",
    })
  );
  assert.deepStrictEqual(
    issues.map((issue) => issue.rule_id).sort(),
    ["UNRESOLVED_CONCEPT_REPRESENTATIONS", "UNRESOLVED_CONCEPT_SECURITY"]
  );
  console.log("PASS  a default limb predicated on absent representations or security is flagged");
}

/* ── Generator instructions ──────────────────────────────────────────────── */

{
  const issues = findInstructionLeakIssues(
    draftOf({
      clause_id: "CORE_PURPOSE_001",
      title: "Purpose of Agreement",
      text:
        "This Guarantee Agreement should read as a coherent Indian legal document in " +
        "connection with wholesale supply, with Creditor and Principal Debtor " +
        "described consistently in their correct legal capacities.",
    })
  );
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].rule_id, "GENERATOR_INSTRUCTION_LEAK");
  console.log("PASS  an instruction written for the generator is caught");
}

{
  const issues = findInstructionLeakIssues(
    draftOf({
      clause_id: "CORE_PURPOSE_001",
      text:
        "The purpose of this Agreement is to record the guarantee given by the " +
        "Guarantor to the Creditor in respect of the obligations of the Principal Debtor.",
    })
  );
  assert.deepStrictEqual(issues, []);
  console.log("PASS  a real purpose clause is left alone");
}

/* ── Seat, courts and governing law must agree on a state ────────────────── */

{
  const issues = findJurisdictionMismatchIssues({
    execution_city: "Pune",
    operating_state: "Andhra Pradesh",
  });
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].rule_id, "JURISDICTION_CITY_STATE_MISMATCH");
  assert.match(issues[0].message, /Pune is in Maharashtra/);
  console.log("PASS  Pune seated in Andhra Pradesh is flagged");
}

{
  assert.deepStrictEqual(
    findJurisdictionMismatchIssues({ execution_city: "Pune", operating_state: "Maharashtra" }),
    []
  );
  // A city the table does not know draws no conclusion rather than a false block.
  assert.deepStrictEqual(
    findJurisdictionMismatchIssues({ execution_city: "Chikkaballapur", operating_state: "Goa" }),
    []
  );
  console.log("PASS  a matching pair passes, and an unknown city is not guessed at");
}

/* ── A party described as something it is not ────────────────────────────── */

{
  const issues = findEntityTypeContradictions({
    party_2_name: "Beta Consulting LLP",
    party_2_type: "Private Limited Company",
  });
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].rule_id, "ENTITY_TYPE_CONTRADICTS_NAME");
  assert.match(issues[0].suggestion, /Limited Liability Partnership Act, 2008/);
  console.log("PASS  an LLP recorded as a private limited company is flagged");
}

{
  assert.deepStrictEqual(
    findEntityTypeContradictions({
      party_1_name: "Alpha Industries Private Limited",
      party_1_type: "Private Limited Company",
      party_2_name: "Beta Consulting LLP",
      party_2_type: "LLP",
      party_3_name: "Ramesh Kulkarni",
      party_3_type: "Individual",
    }),
    []
  );
  console.log("PASS  names and types that agree pass, including an individual");
}

console.log("\nALL GREEN");
