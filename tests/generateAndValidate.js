import { generateDocument } from "../backend/services/documentService.js";

const documentTypes = [
  "NDA",
  "EMPLOYMENT_AGREEMENT",
  "MOU",
  "LEAVE_AND_LICENSE",
  "SERVICE_PROVIDER_AGREEMENT",
  "PRIVACY_POLICY",
  "ADDENDUM",
];

async function runTests() {
  for (const type of documentTypes) {
    console.log(`\n=== Testing ${type} ===`);

    const result = await generateDocument({
      document_type: type,
      jurisdiction: "India",
    });

    if (!result.validation) {
      console.log("Validation not executed.");
      console.log("Draft error:", result.draft?.error);
      continue;
    }
    
    if (result.validation.risk_level === "BLOCKED") {
      console.log("Blocked due to missing input.");
      console.log("Issues:", result.validation.issues.map(i => i.rule_id));
      continue;
    }
    
    console.log("Legal Risk:", result.validation.legal_risk);
    console.log("Commercial Risk:", result.validation.commercial_risk);
    console.log("Overall Risk:", result.validation.overall_risk);
    console.log("Issues:", result.validation.issues.map(i => i.rule_id));
  }
}

runTests();
