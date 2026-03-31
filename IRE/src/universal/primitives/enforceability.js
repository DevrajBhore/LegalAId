export function evaluateEnforceability(facts, documentText = "") {
  const issues = [];
  const text = documentText.toLowerCase();

  // 🔹 Placeholder leakage
  if (
    text.includes("[") ||
    text.includes("to be decided") ||
    text.includes("to be mutually agreed")
  ) {
    issues.push({
      rule_id: "UNCERTAINTY_PLACEHOLDER",
      severity: "CRITICAL",
      message:
        "Unresolved placeholders or undefined terms may render the agreement void for uncertainty."
    });
  }

  // 🔹 Undefined duration
  if (
    text.includes("term shall commence") &&
    !text.match(/\d+\s?(year|years|month|months|day|days)/)
  ) {
    issues.push({
      rule_id: "UNDEFINED_DURATION",
      severity: "HIGH",
      message:
        "Agreement duration appears undefined, increasing uncertainty risk."
    });
  }

  // 🔹 Undefined payment terms
  // Only flag if document has actual monetary consideration (INR amounts or fee/salary language)
  // AND no payment structure defined. Exclude NDA/confidentiality-only docs.
  const hasMonetaryConsideration =
    facts.hasConsideration &&
    facts.considerationValue !== null;
  const hasPaymentObligationContext =
    /\binvoice|payment|fees?\b|salary|wages|rent|license fee|purchase price|repay|repayment|instal(?:ment)?|remuneration\b/i.test(
      text
    );

  if (
    hasMonetaryConsideration &&
    hasPaymentObligationContext &&
    !text.includes("monthly") &&
    !text.includes("installment") &&
    !text.includes("lump sum") &&
    !text.includes("per annum") &&
    !text.includes("per month") &&
    !text.includes("milestone") &&
    !text.includes("upon delivery") &&
    !text.includes("within 30") &&
    !text.includes("within 45") &&
    !text.includes("within 60")
  ) {
    issues.push({
      rule_id: "PAYMENT_STRUCTURE_UNDEFINED",
      severity: "MEDIUM",
      message:
        "Payment structure not clearly defined (frequency or schedule missing)."
    });
  }

  return issues;
}
