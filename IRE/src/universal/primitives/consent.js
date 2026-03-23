export function evaluateFreeConsent(facts, documentText = "") {
    const issues = [];
    const text = documentText.toLowerCase();
  
    // 🔹 Absolute unilateral amendment
    if (
      text.includes("may amend at its sole discretion") ||
      text.includes("without consent of the other party")
    ) {
      issues.push({
        rule_id: "UNILATERAL_AMENDMENT_RISK",
        severity: "HIGH",
        message:
          "Unilateral amendment rights without mutual consent may create free consent risk."
      });
    }
  
    // 🔹 Absolute discretion language
    if (
      text.includes("sole discretion") &&
      !text.includes("reasonable")
    ) {
      issues.push({
        rule_id: "ABSOLUTE_DISCRETION_RISK",
        severity: "MEDIUM",
        message:
          "Use of absolute discretion without reasonableness qualifier may affect enforceability."
      });
    }
  
    // 🔹 Immediate termination without cause or notice
    if (
      text.includes("terminate at any time") &&
      !text.includes("notice")
    ) {
      issues.push({
        rule_id: "NO_NOTICE_TERMINATION_RISK",
        severity: "HIGH",
        message:
          "Termination without notice may raise fairness and free consent concerns."
      });
    }
  
    // 🔹 Blanket misrepresentation disclaimer
    if (
      text.includes("no reliance") &&
      text.includes("no representation")
    ) {
      issues.push({
        rule_id: "MISREPRESENTATION_DISCLAIMER_RISK",
        severity: "MEDIUM",
        message:
          "Broad non-reliance disclaimers may not fully exclude misrepresentation liability."
      });
    }
  
    return issues;
  }