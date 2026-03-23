// backend/commercial/protectionDetector.js

/**
 * Detect existing commercial protections.
 */
export function detectProtections(text = "") {
    const lower = text.toLowerCase();
  
    return {
      hasLiabilityCap:
        /liability.*(cap|limit|limited to|shall not exceed)/.test(lower),
  
      hasIndemnity:
        /indemnif|hold harmless/.test(lower),
  
      hasForceMajeure:
        /force majeure|act of god|unforeseen circumstances/.test(lower),
  
      hasIPOwnershipClause:
        /ownership of intellectual property|ip shall vest|assignment of ip/.test(lower),
  
      hasPostTerminationObligations:
        /upon termination|after termination|survive termination/.test(lower)
    };
  }