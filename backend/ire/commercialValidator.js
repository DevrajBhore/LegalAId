/**
 * commercialValidator.js
 *
 * Checks for standard commercial protections in bilateral commercial agreements.
 * Deliberately NOT fired on:
 *   - Unilateral instruments (Wills, Affidavits, POA, Legal Notice)
 *   - Family/personal documents (Maintenance, Divorce, Gift Deed)
 *   - Government/regulatory documents (RTI, Undertaking)
 */

// Document types that require commercial clause checks
const COMMERCIAL_DOC_TYPES = new Set([
  "NDA",
  "SERVICE_AGREEMENT",
  "CONSULTANCY_AGREEMENT",
  "SUPPLY_AGREEMENT",
  "DISTRIBUTION_AGREEMENT",
  "SALES_OF_GOODS_AGREEMENT",
  "INDEPENDENT_CONTRACTOR_AGREEMENT",
  "EMPLOYMENT_CONTRACT",
  "EMPLOYMENT_AGREEMENT",
  "COMMERCIAL_LEASE_AGREEMENT",
  "SHAREHOLDERS_AGREEMENT",
  "JOINT_VENTURE_AGREEMENT",
  "PARTNERSHIP_DEED",
  "LOAN_AGREEMENT",
  "SOFTWARE_DEVELOPMENT_AGREEMENT",
  "SAAS_AGREEMENT",
  "IP_ASSIGNMENT_AGREEMENT",
  "IP_LICENSE_AGREEMENT",
  "FOUNDERS_AGREEMENT",
]);

export function commercialValidate(draft, documentType) {
  const issues = [];

  // Only run on bilateral commercial documents
  if (!COMMERCIAL_DOC_TYPES.has(documentType)) return issues;

  const clauses  = draft.clauses || [];
  const fullText = clauses.map(c => (c.text || "").toLowerCase()).join(" ");

  // ── 1. Liability Cap ──────────────────────────────────────────────────────
  const hasLiabilityCap =
    /liability\s*(shall\s*not\s*exceed|is\s*limited|cap)/i.test(fullText) ||
    /aggregate\s*liability/i.test(fullText) ||
    /limitation\s*of\s*liability/i.test(fullText);

  if (!hasLiabilityCap) {
    issues.push({
      rule_id   : "LIABILITY_CAP_MISSING",
      severity  : "MEDIUM",
      message   : "No limitation of liability clause detected.",
      suggestion: "Add a clause capping aggregate liability at total consideration paid.",
    });
  }

  // ── 2. Indemnity ──────────────────────────────────────────────────────────
  const hasIndemnity = /indemnif|hold\s*harmless/i.test(fullText);

  if (!hasIndemnity) {
    issues.push({
      rule_id   : "INDEMNITY_MISSING",
      severity  : "MEDIUM",
      message   : "No indemnity clause detected.",
      suggestion: "Add mutual indemnification against losses arising from breach.",
    });
  }

  // ── 3. Force Majeure ──────────────────────────────────────────────────────
  const hasForceMajeure = /force\s*majeure|act\s*of\s*god|vis\s*major/i.test(fullText);

  if (!hasForceMajeure) {
    issues.push({
      rule_id   : "FORCE_MAJEURE_MISSING",
      severity  : "MEDIUM",
      message   : "No force majeure clause detected.",
      suggestion: "Add a force majeure clause covering events beyond reasonable control.",
    });
  }

  // ── 4. IP Ownership (service/IP doc types only) ───────────────────────────
  const ipDocTypes = new Set([
    "SERVICE_AGREEMENT", "CONSULTANCY_AGREEMENT", "INDEPENDENT_CONTRACTOR_AGREEMENT",
    "SOFTWARE_DEVELOPMENT_AGREEMENT", "SAAS_AGREEMENT", "IP_ASSIGNMENT_AGREEMENT",
    "IP_LICENSE_AGREEMENT", "EMPLOYMENT_CONTRACT", "EMPLOYMENT_AGREEMENT",
  ]);

  if (ipDocTypes.has(documentType)) {
    const hasIP =
      /intellectual\s*property|ip\s*ownership|copyright\s*(.*\s*)?vest|ownership\s*of\s*(work|deliverable)/i.test(fullText);
    if (!hasIP) {
      issues.push({
        rule_id   : "IP_OWNERSHIP_UNCLEAR",
        severity  : "MEDIUM",
        message   : "No clear intellectual property ownership clause detected.",
        suggestion: "Specify who owns IP created under this agreement.",
      });
    }
  }

  // ── 5. Late Payment Interest (payment-bearing docs) ───────────────────────
  const hasPayment = /payment|fee|salary|remuneration|consideration/i.test(fullText);
  const hasInterest = /interest|late\s*(payment|fee)|penalty.*payment/i.test(fullText);

  if (hasPayment && !hasInterest) {
    issues.push({
      rule_id   : "LATE_PAYMENT_INTEREST_MISSING",
      severity  : "LOW",
      message   : "No late payment interest clause detected.",
      suggestion: "Consider adding interest on overdue payments (typically 18% p.a.).",
    });
  }

  // ── 6. Termination Notice (termination-bearing docs) ─────────────────────
  const hasTermination = /terminat/i.test(fullText);
  const hasNotice      = /\d+\s*(days?|months?)\s*(written\s+|prior\s+)?notice|notice\s*period/i.test(fullText);

  if (hasTermination && !hasNotice) {
    issues.push({
      rule_id   : "TERMINATION_NOTICE_UNCLEAR",
      severity  : "MEDIUM",
      message   : "Termination clause present but notice period not clearly specified.",
      suggestion: "Specify number of days written notice required for termination.",
    });
  }

  return issues;
}
