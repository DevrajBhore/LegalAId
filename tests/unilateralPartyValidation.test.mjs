import assert from "node:assert";

import { validateDraftConsistency } from "../backend/services/draftConsistencyValidator.js";
import { applyDocumentQualityControls } from "../backend/services/documentQualityControl.js";
import { getParticipantExpectations } from "../backend/services/draftingPolicy.js";
import { partyNameAppears } from "../backend/services/partyNameMatcher.js";

function issueIds(issues = []) {
  return issues.map((issue) => issue.rule_id);
}

// ── 1. Shortened legal references ────────────────────────────────────────────
// A draft that introduces "Rajput Private Limited" once and then uses the
// defined short form "Rajput" is correct drafting, not a mismatch.
assert.strictEqual(
  partyNameAppears("...between Rajput and the Buyer...", "Rajput Private Limited"),
  true,
  "leading distinctive token is the conventional defined short form"
);
assert.strictEqual(
  partyNameAppears("Executed by Sharma on the date above.", "Sharma Textiles Pvt Ltd"),
  true,
  "short form should match even when a middle distinctive token is dropped"
);
assert.strictEqual(
  partyNameAppears("provided by Rockodile", "Rockodile "),
  true,
  "stray whitespace in the intake value must not break matching"
);
assert.strictEqual(
  partyNameAppears("...between Mehta Exports and the Buyer...", "Rajput Private Limited"),
  false,
  "a genuinely different party must still be rejected"
);
assert.strictEqual(
  partyNameAppears("", "Rajput Private Limited"),
  false,
  "an empty haystack must still be rejected"
);
assert.strictEqual(
  partyNameAppears("JK sold the goods.", "JK Cement Limited"),
  false,
  "a short ambiguous lead token must not be accepted as a short form"
);

// ── 2. Unilateral instruments (Terms of Service / Privacy Policy) ────────────
// These blueprints have no IDENTITY clause and no bilateral execution block.
// The party checks previously ran against an empty string and failed CRITICAL
// on every generation, so the document could never be produced.
const tosVariables = {
  company_name: "Rockodile Technologies Private Limited",
  company_address: "12 MG Road, Bengaluru 560001",
  service_name: "Rockodile ",
  website_url: "https://rockodile.example",
  service_description: "an online marketplace",
  grievance_officer: "Rijul",
  grievance_officer_email: "grievance@rockodile.example",
  effective_date: "2026-08-17",
  arbitration_city: "Bengaluru",
  operating_state: "Karnataka",
};

assert.deepStrictEqual(
  getParticipantExpectations("TERMS_OF_SERVICE", tosVariables).map((p) => p.id),
  [],
  "the service/product name is not a contracting party"
);

const termsOfServiceDraft = {
  document_type: "TERMS_OF_SERVICE",
  clauses: [
    {
      clause_id: "TOS_ACCEPTANCE_001",
      category: "PURPOSE",
      title: "Acceptance of Terms",
      text: "These Terms of Service govern your access to and use of Rockodile provided by Rockodile Technologies Private Limited, having its office at 12 MG Road, Bengaluru 560001. These Terms are effective from 17 August 2026.",
    },
    {
      clause_id: "CORE_DISPUTE_RESOLUTION_001",
      category: "DISPUTE_RESOLUTION",
      title: "Dispute Resolution",
      text: "Any dispute shall be referred to arbitration seated at Bengaluru.",
    },
    {
      clause_id: "CORE_GOVERNING_LAW_001",
      category: "GOVERNING_LAW",
      title: "Governing Law",
      text: "These Terms are governed by the laws of India, subject to the courts at Bengaluru.",
    },
    {
      clause_id: "TOS_ACKNOWLEDGEMENT_001",
      category: "SIGNATURE_BLOCK",
      title: "Acknowledgement",
      text: "These Terms of Service are published by Rockodile Technologies Private Limited. No physical or electronic signature is required for these Terms to be binding.",
    },
  ],
};

const tosIssues = validateDraftConsistency(termsOfServiceDraft, {
  documentType: "TERMS_OF_SERVICE",
  variables: tosVariables,
});
assert.deepStrictEqual(
  issueIds(tosIssues).filter((id) => /NAME$|ADDRESS$|EXECUTION_STYLE$/.test(id)),
  [],
  "a correct Terms of Service draft must not be blocked by party checks"
);

// ── 3. Bilateral documents keep their guarantees ─────────────────────────────
const serviceVariables = {
  party_1_name: "Rajput Private Limited",
  party_1_address: "5 Nehru Road, Pune 411001",
  party_2_name: "Mehta Consulting LLP",
  party_2_address: "9 FC Road, Pune 411004",
};

const wrongPartyDraft = {
  document_type: "SERVICE_AGREEMENT",
  clauses: [
    {
      clause_id: "CORE_IDENTITY_001",
      category: "IDENTITY",
      title: "Parties",
      text: "This Agreement is made between Kapoor Exports, of 5 Nehru Road, Pune 411001, and Mehta Consulting LLP, of 9 FC Road, Pune 411004.",
    },
    {
      clause_id: "CORE_SIGNATURE_BLOCK_001",
      category: "SIGNATURE_BLOCK",
      title: "Execution",
      text: "For and on behalf of Kapoor Exports\n\nFor and on behalf of Mehta Consulting LLP",
    },
  ],
};
assert.ok(
  issueIds(
    validateDraftConsistency(wrongPartyDraft, {
      documentType: "SERVICE_AGREEMENT",
      variables: serviceVariables,
    })
  ).includes("INPUT_MISMATCH_PARTY_1_NAME"),
  "a substituted party name must still block generation"
);

// ── 4. Guarantee extent drives the continuing-guarantee clause ───────────────
const guaranteeClauses = [
  { clause_id: "GUARANTEE_IDENTITY_001", category: "IDENTITY", title: "Parties", text: "..." },
  {
    clause_id: "GUARANTEE_OBLIGATION_LIMITED_001",
    category: "FINANCE",
    title: "Guarantee Obligation (Limited)",
    text: "The aggregate liability of the Guarantor shall not exceed the Guaranteed Amount.",
  },
  {
    clause_id: "GUARANTEE_CONTINUING_001",
    category: "FINANCE",
    title: "Continuing Guarantee and Liability",
    text: "This Guarantee is a continuing guarantee and shall remain in full force and effect...",
  },
];

function guaranteeClauseIds(guaranteeType) {
  return applyDocumentQualityControls(
    { document_type: "GUARANTEE_AGREEMENT", clauses: guaranteeClauses },
    { document_type: "GUARANTEE_AGREEMENT", variables: { guarantee_type: guaranteeType } }
  ).clauses.map((clause) => clause.clause_id);
}

for (const guaranteeType of ["Limited Guarantee", "Performance Guarantee"]) {
  assert.ok(
    !guaranteeClauseIds(guaranteeType).includes("GUARANTEE_CONTINUING_001"),
    `${guaranteeType} must not carry the continuing-guarantee clause`
  );
}
assert.ok(
  guaranteeClauseIds("Continuing Guarantee").includes("GUARANTEE_CONTINUING_001"),
  "a continuing guarantee must keep the continuing-guarantee clause"
);
assert.ok(
  guaranteeClauseIds(undefined).includes("GUARANTEE_CONTINUING_001"),
  "an unanswered guarantee type must keep the blueprint default"
);

console.log("Unilateral party + guarantee extent regression test passed.");
