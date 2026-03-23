export function jurisdictionAdvisory(draft) {

    const issues = [];
    const jurisdiction = draft?.draft?.jurisdiction;
  
    if (!jurisdiction) {
      return issues;
    }
  
    if (jurisdiction.toLowerCase() === "india") {
  
      issues.push({
        rule_id: "STAMP_DUTY_ADVISORY",
        severity: "INFO",
        message: "Ensure appropriate stamp duty is paid as per applicable State Stamp Act before execution."
      });
  
      issues.push({
        rule_id: "REGISTRATION_ADVISORY",
        severity: "INFO",
        message: "If this contract creates rights in immovable property, registration under the Registration Act, 1908 may be mandatory."
      });
  
      issues.push({
        rule_id: "ARBITRATION_COMPLIANCE",
        severity: "INFO",
        message: "Arbitration clauses must comply with the Arbitration and Conciliation Act, 1996."
      });
    }
  
    return issues;
  }