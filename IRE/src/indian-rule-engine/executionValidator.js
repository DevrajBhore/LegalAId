/**
 * executionValidator.js
 * Validates execution formalities for all Indian legal document types.
 */

export function executionValidate(draft) {
  if (!draft?.clauses) return [];

  const issues = [];
  const allText = draft.clauses.map(c => c.text || "").join(" ");
  const allTextLower = allText.toLowerCase();

  // Categorise clauses for targeted checks
  const clausesByCategory = {};
  for (const c of draft.clauses) {
    if (c.category) {
      if (!clausesByCategory[c.category]) clausesByCategory[c.category] = [];
      clausesByCategory[c.category].push(c);
    }
  }

  // Detect unilateral instruments — these don't need dispute/governing law/consideration
  const isUnilateral = /\b(affidavit|power of attorney|will and testament|legal notice|vakalatnama|i hereby|i solemnly|testator|deponent|declarant|general power|special power)\b/i.test(allText);

  // ── 1. Signature block ──────────────────────────────────────────────────────
  const hasSignature =
    clausesByCategory["SIGNATURE_BLOCK"]?.length > 0 ||
    /\b(sign(ed|ature)|in witness whereof|executed by|subscribed)\b/i.test(allText);

  if (!hasSignature) {
    issues.push({
      rule_id: "NO_SIGNATURE_BLOCK",
      severity: "HIGH",
      message: "No signature block detected. Documents require signatures to be binding.",
      statutory_reference: "Indian Contract Act 1872 – S.10",
      suggestion: "Add a signature block for all executing parties.",
    });
  }

  // ── 2. Effective date ───────────────────────────────────────────────────────
  const hasEffectiveDate =
    /effective\s+date/i.test(allText) ||
    /dated?\s+(this\s+)?\d{1,2}(st|nd|rd|th)?\s+(day\s+of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(allText) ||
    /\b(?:on\s+this\s+)?\d{1,2}(st|nd|rd|th)?\s+day\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i.test(allText) ||
    /\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i.test(allText) ||
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i.test(allText) ||
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(allText) ||
    /entered\s+into\s+(as\s+of|on)\s+\d/i.test(allText) ||
    /executed\s+on\s+\d/i.test(allText) ||
    /commenc(e|ing)\s+\w+\s+\d{1,2}/i.test(allText);

  if (!hasEffectiveDate) {
    issues.push({
      rule_id: "NO_EFFECTIVE_DATE",
      severity: "MEDIUM",
      message: "No execution date detected. Documents should specify the date of execution.",
      statutory_reference: "Indian Contract Act 1872 – S.10",
      suggestion: "Add the execution date to the document.",
    });
  }

  // ── 3. Notice period (only when termination exists) ────────────────────────
  const hasTermination = clausesByCategory["TERMINATION"]?.length > 0 ||
    /terminat/i.test(allText);
  const hasNotice = /\d+\s*(days?|months?)\s*(prior\s+)?notice|written\s+notice|notice\s+period/i.test(allText);

  if (hasTermination && !hasNotice && !isUnilateral) {
    issues.push({
      rule_id: "TERMINATION_NOTICE_MISSING",
      severity: "MEDIUM",
      message: "Termination clause present but no notice period specified.",
      statutory_reference: "Transfer of Property Act 1882 – S.106 / Indian Contract Act 1872",
      suggestion: "Specify the number of days written notice required for termination.",
    });
  }

  // ── 4. Dispute resolution (bilateral agreements only) ──────────────────────
  const hasDisputeResolution =
    clausesByCategory["DISPUTE_RESOLUTION"]?.length > 0 ||
    /arbitration|mediation|dispute.*resolution|in the event of.*dispute/i.test(allText);

  if (!hasDisputeResolution && !isUnilateral) {
    issues.push({
      rule_id: "NO_DISPUTE_MECHANISM",
      severity: "HIGH",
      message: "No dispute resolution mechanism found.",
      statutory_reference: "Arbitration and Conciliation Act 1996 – S.7",
      suggestion: "Add a dispute resolution clause specifying arbitration or mediation and the seat.",
    });
  }

  // ── 5. Governing law (bilateral agreements only) ────────────────────────────
  const hasGoverningLaw =
    clausesByCategory["GOVERNING_LAW"]?.length > 0 ||
    /governing\s+law|laws\s+of\s+india|indian\s+law|construed.*india/i.test(allText);

  if (!hasGoverningLaw && !isUnilateral) {
    issues.push({
      rule_id: "NO_GOVERNING_LAW_REFERENCE",
      severity: "CRITICAL",
      message: "No governing law clause found.",
      statutory_reference: "Indian Contract Act 1872 – S.23",
      suggestion: "Add: 'This Agreement shall be governed by and construed in accordance with the laws of India.'",
    });
  }

  // ── 6. Parties identified ───────────────────────────────────────────────────
  const hasParties =
    clausesByCategory["IDENTITY"]?.length > 0 ||
    /hereinafter\s+referred\s+to|between.*and.*\(|party\s+means/i.test(allText);

  if (!hasParties) {
    issues.push({
      rule_id: "NO_PARTY_IDENTIFICATION",
      severity: "CRITICAL",
      message: "No clear identification of contracting parties found.",
      statutory_reference: "Indian Contract Act 1872 – S.10",
      suggestion: "Add an identification section naming all parties.",
    });
  }

  return issues;
}
