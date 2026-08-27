/**
 * executionValidator.js
 * Validates execution formalities for all Indian legal document types.
 */

/**
 * A unilateral instrument is promulgated by one organisation, not agreed between
 * parties. Requiring it to identify "contracting parties" is not a check it can
 * pass, and the check was only passing by accident: the PoSH policy satisfied
 * the party regex through a commercial dispute-resolution clause that had been
 * pulled in by a dependency and should never have been in a statutory policy at
 * all. Removing that clause exposed the real defect in this check.
 *
 * The issuer still has to be named -- a policy that does not say whose it is is
 * useless -- so the requirement is replaced rather than dropped.
 */
const UNILATERAL_INSTRUMENTS = new Set([
  "POSH_POLICY",
  "PRIVACY_POLICY",
  "TERMS_OF_SERVICE",
  "REFUND_AND_CANCELLATION_POLICY",
  "SHIPPING_AND_DELIVERY_POLICY",
]);

export function executionValidate(draft, documentType = "") {
  if (!draft?.clauses) return [];
  const docType = String(documentType || draft.document_type || "").toUpperCase();
  const isPolicyInstrument = UNILATERAL_INSTRUMENTS.has(docType);

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
    // ISO form. Clause text interpolates {{effective_date}} verbatim, and only
    // the document types with a hardening builder get it reformatted into
    // "1st day of September, 2026". Without this, a document carrying a
    // perfectly good date in 2026-09-01 form was reported as having none --
    // which happened to four separate document types before it was fixed here
    // rather than by adding the words "Effective Date" to each clause.
    /\b\d{4}-\d{2}-\d{2}\b/.test(allText) ||
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

  // A statutory policy has no termination clause. The word "terminat" appears in
  // the PoSH policy only because dismissal is one of the penalties the Internal
  // Committee may recommend under Section 13, which is not a contractual
  // termination right and carries no notice period.
  if (hasTermination && !hasNotice && !isUnilateral && !isPolicyInstrument) {
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

  if (!hasDisputeResolution && !isUnilateral && !isPolicyInstrument) {
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

  if (!hasGoverningLaw && !isUnilateral && !isPolicyInstrument) {
    issues.push({
      rule_id: "NO_GOVERNING_LAW_REFERENCE",
      severity: "CRITICAL",
      message: "No governing law clause found.",
      statutory_reference: "Indian Contract Act 1872 – S.23",
      suggestion: "Add: 'This Agreement shall be governed by and construed in accordance with the laws of India.'",
    });
  }

  // ── 6. Parties identified ───────────────────────────────────────────────────
  if (isPolicyInstrument) {
    // What matters for a policy is that the reader can tell whose it is.
    const namesIssuer =
      /\b(?:is\s+)?(?:adopted|issued|published)\s+by\b/i.test(allText) ||
      /\bthis\s+Policy\s+is\s+(?:that|the\s+policy)\s+of\b/i.test(allText) ||
      /\bon\s+behalf\s+of\b/i.test(allText);
    if (!namesIssuer) {
      issues.push({
        rule_id: "NO_ISSUER_IDENTIFICATION",
        severity: "CRITICAL",
        message: "The policy does not say which organisation adopts or publishes it.",
        statutory_reference: "Indian Contract Act 1872 – S.10",
        suggestion: "State the adopting organisation, e.g. 'This Policy is adopted by <name>'.",
      });
    }
  } else {
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
  }

  return issues;
}
