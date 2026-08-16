import assert from "node:assert";

import { validateDraftConsistency } from "../backend/services/draftConsistencyValidator.js";
import { validateDocumentQuality } from "../backend/services/documentQualityControl.js";
import { partyNameAppears } from "../backend/services/partyNameMatcher.js";

const variables = {
  party_1_name: "Rajput Private Limited",
  party_1_type: "Private Limited Company",
  party_1_address: "12 Market Road, Mumbai, Maharashtra 400001",
  party_2_name: "Sharma Trading Co",
  party_2_type: "Partnership Firm",
  party_2_address: "44 Industrial Estate, Pune, Maharashtra 411001",
};

const shortenedNameDraft = {
  document_type: "VENDOR_AGREEMENT",
  clauses: [
    {
      clause_id: "CORE_IDENTITY_001",
      category: "IDENTITY",
      title: "Parties",
      text: `This Vendor Agreement is made between Rajput, a Private Limited Company having its registered office at ${variables.party_1_address} ("Supplier"), and Sharma, a Partnership Firm having its principal place of business at ${variables.party_2_address} ("Buyer").`,
    },
    {
      clause_id: "CORE_SIGNATURE_BLOCK_001",
      category: "SIGNATURE_BLOCK",
      title: "Execution",
      text: `FOR AND ON BEHALF OF RAJPUT

_____________________________
Authorised Signatory

FOR AND ON BEHALF OF SHARMA

_____________________________
Authorised Signatory`,
    },
  ],
};

function issueIds(issues = []) {
  return issues.map((issue) => issue.rule_id);
}

assert.strictEqual(
  partyNameAppears("FOR AND ON BEHALF OF RAJPUT", variables.party_1_name),
  true,
  "distinctive short name should match the full legal name"
);

const consistencyIssues = validateDraftConsistency(shortenedNameDraft, {
  documentType: "VENDOR_AGREEMENT",
  variables,
});
assert.deepStrictEqual(
  issueIds(consistencyIssues).filter((id) => /PARTY_[12].*NAME|EXECUTION_STYLE/.test(id)),
  [],
  "shortened party names should not trigger name or execution-style validation errors"
);

const qualityIssues = validateDocumentQuality(shortenedNameDraft, {
  documentType: "VENDOR_AGREEMENT",
  variables,
});
assert.deepStrictEqual(
  issueIds(qualityIssues).filter((id) => id.startsWith("FORMAT_MISSING_PARTY_")),
  [],
  "shortened party names should not be treated as missing from the final draft"
);

const missingBuyerDraft = {
  ...shortenedNameDraft,
  clauses: shortenedNameDraft.clauses.map((clause) => ({
    ...clause,
    text: clause.text.replace(/\bSharma\b/gi, "Counterparty"),
  })),
};
const missingBuyerIssues = validateDocumentQuality(missingBuyerDraft, {
  documentType: "VENDOR_AGREEMENT",
  variables,
});
assert.ok(
  issueIds(missingBuyerIssues).includes("FORMAT_MISSING_PARTY_PARTY_2"),
  "a genuinely missing buyer name should still be caught"
);

console.log("Party name validation regression test passed.");
