export function extractPrimitives(text = "") {

    const primitives = [];
    const lowerText = text.toLowerCase();
  
    /* -------------------------
       PROHIBITION
    -------------------------- */
    if (/no\s+\w+\s+shall/i.test(text) || /shall\s+not/i.test(text)) {
      primitives.push({
        primitive_type: "PROHIBITION",
        raw: text
      });
    }
  
    /* -------------------------
       MANDATORY OBLIGATION
    -------------------------- */
    if (/\bshall\b|\bmust\b|\bis required to\b/i.test(text)) {
      primitives.push({
        primitive_type: "MANDATORY",
        raw: text
      });
    }
  
    /* -------------------------
       TIME DEADLINE (Digits Only for Now)
    -------------------------- */
    const timeMatch = text.match(/(\d+)\s*(day|days|month|months|year|years)/i);
    if (timeMatch) {
      primitives.push({
        primitive_type: "TIME_DEADLINE",
        value: parseInt(timeMatch[1]),
        unit: timeMatch[2].toLowerCase(),
        raw: text
      });
    }
  
    /* -------------------------
       MONETARY THRESHOLD
    -------------------------- */
    const moneyMatch = text.match(/(₹|rs\.?|rupees?)\s*(\d+)/i);
    if (moneyMatch) {
      primitives.push({
        primitive_type: "MONETARY_THRESHOLD",
        value: parseInt(moneyMatch[2]),
        currency: "INR",
        raw: text
      });
    }
  
    /* -------------------------
       REGISTRATION / FILING
    -------------------------- */
    if (/shall\s+be\s+registered/i.test(text) ||
        /\bshall\s+file\b/i.test(text) ||
        /\bobtain\s+licen[sc]e\b/i.test(text)) {
      primitives.push({
        primitive_type: "REGISTRATION_OR_FILING",
        raw: text
      });
    }
  
    /* -------------------------
       PENALTY
    -------------------------- */
    if (/punishable|fine|imprisonment|penalty/i.test(text)) {
      primitives.push({
        primitive_type: "PENALTY",
        raw: text
      });
    }
  
    /* -------------------------
       CONDITIONAL
    -------------------------- */
    if (/\bif\b|\bwhere\b|\bprovided that\b/i.test(text)) {
      primitives.push({
        primitive_type: "CONDITIONAL",
        raw: text
      });
    }
  
    return primitives;
  }