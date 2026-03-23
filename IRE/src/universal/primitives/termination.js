export function evaluateTermination(facts) {
    const issues = [];
  
    // 🔹 No termination notice detected
    if (facts.terminationNoticeDays === null) {
      issues.push({
        rule_id: "TERMINATION_NOTICE_UNDEFINED",
        severity: "HIGH",
        message:
          "Termination clause does not clearly define notice period, increasing enforceability risk."
      });
    }
  
    // 🔹 Unreasonably short notice
    if (facts.terminationNoticeDays !== null && facts.terminationNoticeDays < 7) {
      issues.push({
        rule_id: "UNREASONABLE_NOTICE_PERIOD",
        severity: "HIGH",
        message:
          "Notice period appears unreasonably short and may be challenged as arbitrary or unfair."
      });
    }
  
    // 🔹 Extremely long notice (commercial imbalance risk)
    if (facts.terminationNoticeDays !== null && facts.terminationNoticeDays > 180) {
      issues.push({
        rule_id: "EXCESSIVE_NOTICE_PERIOD",
        severity: "MEDIUM",
        message:
          "Excessively long notice period may create commercial imbalance or restraint concerns."
      });
    }
  
    return issues;
  }