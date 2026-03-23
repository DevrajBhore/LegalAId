export function evaluateRestraint(facts, documentText = "") {
  const issues = [];
  const text = (documentText || "").toLowerCase();

  if (!facts.hasNonCompete) {
    return issues;
  }

  // Non-compete tied to protecting Confidential Information or trade secrets
  // is the ONLY type valid under ICA S.27 — do not flag these
  const isConfidentialityTied =
    /confidential\s+information|trade\s+secret|proprietary|protect.*legitimate.*business/i.test(text);

  // 🔹 Post-employment/post-term restraint NOT tied to confidential information
  if (facts.nonCompeteDurationMonths && facts.nonCompeteDurationMonths > 0 && !isConfidentialityTied) {
    issues.push({
      rule_id: "POST_TERMINATION_RESTRAINT",
      severity: "HIGH",
      message:
        "Post-employment non-compete clauses are generally void under Section 27 of the Indian Contract Act, 1872, except to protect trade secrets or goodwill."
    });
  }

  // 🔹 Indefinite restraint — only flag if no time limit can be found AND
  // the non-compete is not tied to confidentiality obligations
  if (facts.nonCompeteDurationMonths === null && !isConfidentialityTied) {
    issues.push({
      rule_id: "INDEFINITE_RESTRAINT",
      severity: "HIGH",
      message:
        "Indefinite or undefined restraint period increases unenforceability risk under Section 27."
    });
  }

  return issues;
}