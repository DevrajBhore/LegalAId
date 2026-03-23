export function evaluateArbitration(facts, documentText = "") {
    const issues = [];
  
    const text = documentText.toLowerCase();
  
    // 🔹 Arbitration mentioned but no seat
    // Check for seat more broadly - many valid docs say "arbitration in Mumbai" without using word "seat"
    const hasBroadSeat = /seat.*arbitrat|arbitrat.*seat|arbitrat.*at\s+\w+|arbitrat.*in\s+[A-Z][a-z]+/i.test(documentText);
    if (facts.hasArbitration && !facts.arbitrationSeat && !hasBroadSeat) {
      issues.push({
        rule_id: "ARBITRATION_SEAT_UNDEFINED",
        severity: "HIGH",
        message:
          "Arbitration clause does not clearly define the seat of arbitration, which may create jurisdictional ambiguity."
      });
    }
  
    // 🔹 Arbitration vague language
    if (facts.hasArbitration && text.includes("may refer to arbitration")) {
      issues.push({
        rule_id: "ARBITRATION_OPTIONAL_LANGUAGE",
        severity: "MEDIUM",
        message:
          "Use of optional language ('may refer') weakens enforceability of arbitration agreement."
      });
    }
  
    // 🔹 No arbitrator appointment mechanism
    if (
      facts.hasArbitration &&
      !text.includes("appoint") &&
      !text.includes("sole arbitrator")
    ) {
      issues.push({
        rule_id: "ARBITRATOR_APPOINTMENT_UNDEFINED",
        severity: "MEDIUM",
        message:
          "Arbitration clause does not specify arbitrator appointment mechanism."
      });
    }
  
    return issues;
  }