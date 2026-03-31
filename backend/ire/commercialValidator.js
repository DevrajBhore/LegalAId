/**
 * commercialValidator.js
 *
 * Checks for standard commercial protections in bilateral commercial agreements.
 * These are recommendation-style safeguards, not validity blockers.
 */
import { getDisallowedProtections } from "../services/documentHardening.js";

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

function recommendation(rule_id, severity, message, suggestion) {
  return {
    rule_id,
    severity,
    message,
    suggestion,
    recommendation_only: true,
  };
}

export function commercialValidate(draft, documentType) {
  const issues = [];
  const disallowedProtections = getDisallowedProtections(documentType);

  if (!COMMERCIAL_DOC_TYPES.has(documentType)) {
    return issues;
  }

  const clauses = draft.clauses || [];
  const fullText = clauses
    .map((clause) => (clause.text || "").toLowerCase())
    .join(" ");

  const hasLiabilityCap =
    /liability[^.]{0,140}(?:shall\s+not\s+exceed|is\s+limited|limited\s+to|cap|capped|maximum)/i.test(
      fullText
    ) ||
    /aggregate\s*liability/i.test(fullText) ||
    /limitation\s*of\s*liability/i.test(fullText);

  if (!disallowedProtections.has("LIABILITY_CAP") && !hasLiabilityCap) {
    issues.push(
      recommendation(
        "LIABILITY_CAP_MISSING",
        "MEDIUM",
        "No limitation of liability clause detected.",
        "Add a clause capping aggregate liability at total consideration paid."
      )
    );
  }

  const hasIndemnity = /indemnif|hold\s*harmless/i.test(fullText);
  if (!disallowedProtections.has("INDEMNITY") && !hasIndemnity) {
    issues.push(
      recommendation(
        "INDEMNITY_MISSING",
        "MEDIUM",
        "No indemnity clause detected.",
        "Add mutual indemnification against losses arising from breach."
      )
    );
  }

  const hasForceMajeure =
    /force\s*majeure|act\s*of\s*god|vis\s*major/i.test(fullText) ||
    /act(?:s)?\s*of\s*god|beyond\s+(?:its|their)\s+reasonable\s+control/i.test(
      fullText
    );
  if (!disallowedProtections.has("FORCE_MAJEURE") && !hasForceMajeure) {
    issues.push(
      recommendation(
        "FORCE_MAJEURE_MISSING",
        "MEDIUM",
        "No force majeure clause detected.",
        "Add a force majeure clause covering events beyond reasonable control."
      )
    );
  }

  const ipDocTypes = new Set([
    "SERVICE_AGREEMENT",
    "CONSULTANCY_AGREEMENT",
    "INDEPENDENT_CONTRACTOR_AGREEMENT",
    "SOFTWARE_DEVELOPMENT_AGREEMENT",
    "SAAS_AGREEMENT",
    "IP_ASSIGNMENT_AGREEMENT",
    "IP_LICENSE_AGREEMENT",
    "EMPLOYMENT_CONTRACT",
    "EMPLOYMENT_AGREEMENT",
  ]);

  if (ipDocTypes.has(documentType)) {
    const hasIP =
      /intellectual\s*property|ip\s*ownership|copyright\s*(.*\s*)?vest|ownership\s*of\s*(work|deliverable)|commissioning\s*party|pre-existing\s*intellectual\s*property/i.test(
        fullText
      );
    if (!hasIP) {
      issues.push(
        recommendation(
          "IP_OWNERSHIP_UNCLEAR",
          "MEDIUM",
          "No clear intellectual property ownership clause detected.",
          "Specify who owns IP created under this agreement."
        )
      );
    }
  }

  const hasPayment =
    /payment|fees?|salary|remuneration|invoice|rent|royalty|subscription|repay|repayment|purchase\s+price|license\s+fee/i.test(
      fullText
    );

  const hasInterest =
    /interest|late\s*(payment|fee)|penalty.*payment|overdue\s+amount\s+shall\s+accrue\s+interest|default\s+interest/i.test(
      fullText
    );

  if (hasPayment && !hasInterest) {
    issues.push(
      recommendation(
        "LATE_PAYMENT_INTEREST_MISSING",
        "LOW",
        "No late payment interest clause detected.",
        "Consider adding interest on overdue payments (typically 18% p.a.)."
      )
    );
  }

  const hasTermination = /terminat/i.test(fullText);
  const hasNotice =
    /\(?\d+\)?\s*(days?|months?)(?:['’]|['â€™])?[^.]{0,80}(?:written\s+|prior\s+)?notice|notice\s*period|prior\s+written\s+notice/i.test(
      fullText
    );

  if (hasTermination && !hasNotice) {
    issues.push(
      recommendation(
        "TERMINATION_NOTICE_UNCLEAR",
        "MEDIUM",
        "Termination clause present but notice period not clearly specified.",
        "Specify number of days written notice required for termination."
      )
    );
  }

  return issues;
}
