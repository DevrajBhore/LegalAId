export function evaluateCapacity(facts, documentText = "") {
    const issues = [];
    const text = documentText.toLowerCase();
  
    // 🔹 Minor detection
    if (facts.partyAge && facts.partyAge < 18) {
      issues.push({
        rule_id: "MINOR_PARTY",
        severity: "CRITICAL",
        message:
          "A party appears to be a minor. Agreements with minors are void under Indian law."
      });
    }
  
    // 🔹 Guardian reference without structure
    if (
      text.includes("guardian of") &&
      !text.includes("natural guardian") &&
      !text.includes("court appointed")
    ) {
      issues.push({
        rule_id: "GUARDIAN_STRUCTURE_UNCLEAR",
        severity: "HIGH",
        message:
          "Guardian representation detected but legal authority structure unclear."
      });
    }
  
    // 🔹 Company authority missing
    if (facts.corporatePartyDetected && !facts.authorityEstablished) {
      issues.push({
        rule_id: "AUTHORITY_UNCLEAR",
        severity: "LOW",
        message:
          "Corporate party detected but authority of signatory not clearly established."
      });
    }
  
    return issues;
  }
