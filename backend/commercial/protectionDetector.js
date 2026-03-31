// backend/commercial/protectionDetector.js

/**
 * Detect existing commercial protections.
 */
export function detectProtections(text = "") {
  const lower = text.toLowerCase();

  return {
    hasLiabilityCap:
      /liability[^.]{0,140}(?:cap|capped|limit(?:ed)?\s+to|shall\s+not\s+exceed|maximum)/.test(
        lower
      ) ||
      /aggregate\s+liability/.test(lower) ||
      /limitation\s+of\s+liability/.test(lower),

    hasIndemnity: /indemnif|hold harmless/.test(lower),

    hasForceMajeure:
      /force majeure|act(?:s)? of god|vis major|beyond (?:its|their) reasonable control/.test(
        lower
      ),

    hasIPOwnershipClause:
      /intellectual property.*(vest|belong|own)|ownership of intellectual property|ip shall vest|assignment of ip|ownership of (?:work|deliverables?)/.test(
        lower
      ),

    hasLatePaymentInterest:
      /interest on overdue|late payment interest|default interest|overdue amount shall bear interest|delayed payment.*interest/.test(
        lower
      ),

    hasTerminationNotice:
      /\b\d+\s*(days?|months?)\b[^.]{0,80}(?:prior\s+|written\s+)?notice|notice\s*period|prior\s+written\s+notice/.test(
        lower
      ),

    hasPostTerminationObligations:
      /upon termination|after termination|survive termination/.test(lower),
  };
}
