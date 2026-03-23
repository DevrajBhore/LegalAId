export function evaluateIndemnity(facts, documentText = "") {
  const issues = [];
  const text = documentText.toLowerCase();

  if (!facts.hasIndemnity) {
    return issues; // Not mandatory universally
  }

  // 🔹 Unlimited indemnity risk
  if (
    text.includes("unlimited liability") ||
    text.includes("without limitation") ||
    text.includes("without cap")
  ) {
    issues.push({
      rule_id: "UNLIMITED_INDEMNITY_RISK",
      severity: "HIGH",
      message:
        "Indemnity appears uncapped, creating potentially unlimited financial exposure."
    });
  }

  // 🔹 Consequential damages exposure
  if (
    text.includes("consequential damages") ||
    text.includes("indirect damages") ||
    text.includes("special damages")
  ) {
    issues.push({
      rule_id: "CONSEQUENTIAL_DAMAGE_EXPOSURE",
      severity: "HIGH",
      message:
        "Indemnity includes consequential or indirect damages, increasing financial risk."
    });
  }

  // 🔹 One-sided indemnity detection
  // "each party", "either party", "both parties" = mutual — not one-sided
  const isMutual = /each\s+party|either\s+party|both\s+parties|mutual.*indemnif|indemnif.*mutual/i.test(text);
  const indemnifyCount = (text.match(/indemnif/gi) || []).length;

  if (indemnifyCount === 1 && !isMutual) {
    issues.push({
      rule_id: "ONE_SIDED_INDEMNITY",
      severity: "MEDIUM",
      message:
        "Indemnity appears one-sided and may create contractual imbalance."
    });
  }

  // 🔹 Survival without limit
  if (
    text.includes("indemnity shall survive") &&
    !text.match(/(\d+)\s?(year|years|month|months)/)
  ) {
    issues.push({
      rule_id: "INDEMNITY_SURVIVAL_UNDEFINED",
      severity: "MEDIUM",
      message:
        "Indemnity survival period not clearly limited, increasing long-term liability risk."
    });
  }

  return issues;
}