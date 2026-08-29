import {
  isPolicy,
  isNotice,
  isSworn,
  isDemandNotice,
  expectsAgreementBoilerplate,
} from "../../../shared/documentShape.js";

/**
 * executionValidator.js
 * Validates execution formalities for all Indian legal document types.
 */

/**
 * Which checks apply depends on the shape of the document, and the shapes are
 * classified once in shared/documentShape.js rather than by a set of exceptions
 * kept here. A policy, a notice and an affidavit each fail the agreement checks
 * for different reasons, and each needs a different question asked instead.
 */
export function executionValidate(draft, documentType = "") {
  if (!draft?.clauses) return [];
  const docType = String(documentType || draft.document_type || "").toUpperCase();
  const isPolicyInstrument = isPolicy(docType);
  const isNoticeInstrument = isNotice(docType);
  const isSwornInstrument = isSworn(docType);
  // Everything that is not a bargain between two parties. Grouped once here so
  // a new instrument type is exempted from all five agreement checks together
  // rather than from four of them.
  const isNotAnAgreement = !expectsAgreementBoilerplate(docType);

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
  if (hasTermination && !hasNotice && !isUnilateral && !isNotAnAgreement) {
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

  if (!hasDisputeResolution && !isUnilateral && !isNotAnAgreement) {
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

  if (!hasGoverningLaw && !isUnilateral && !isNotAnAgreement) {
    issues.push({
      rule_id: "NO_GOVERNING_LAW_REFERENCE",
      severity: "CRITICAL",
      message: "No governing law clause found.",
      statutory_reference: "Indian Contract Act 1872 – S.23",
      suggestion: "Add: 'This Agreement shall be governed by and construed in accordance with the laws of India.'",
    });
  }

  // ── 6. Parties identified ───────────────────────────────────────────────────
  if (isNoticeInstrument) {
    // A notice must say who sends it and to whom. Everything else about it is
    // negotiable; these two are not, because a notice that cannot be traced to a
    // sender or tied to an addressee cannot be proved to have been served.
    const namesAddressee = /\bTo[,:]?\s|\baddressed?\s+to\b|\bDear\b|\bthe\s+Addressee\b|\bthe\s+Noticee\b/i.test(allText);
    const namesSender =
      /\bon\s+(?:the\s+)?(?:behalf|instructions)\s+of\b/i.test(allText) ||
      /\bmy\s+client\b/i.test(allText) ||
      /\byours\s+faithfully\b/i.test(allText) ||
      /\bunder\s+instructions\s+from\b/i.test(allText);

    if (!namesAddressee) {
      issues.push({
        rule_id: "NOTICE_HAS_NO_ADDRESSEE",
        severity: "CRITICAL",
        message: "The notice does not identify the person it is addressed to.",
        statutory_reference: "Negotiable Instruments Act 1881 – S.138 proviso (b) / Civil Procedure Code 1908 – S.80",
        suggestion: "Name the addressee and give the address at which the notice is served. Service is proved against that address.",
      });
    }
    if (!namesSender) {
      issues.push({
        rule_id: "NOTICE_HAS_NO_SENDER",
        severity: "CRITICAL",
        message: "The notice does not identify who sends it or on whose instructions.",
        statutory_reference: "Indian Contract Act 1872 – S.10",
        suggestion: "State the sender, and where an advocate sends it, that it is sent on the client's instructions and on the client's behalf.",
      });
    }

    // The operative content of a demand notice.
    if (isDemandNotice(docType)) {
      const statesDeadline =
        /\bwithin\s+(?:a\s+period\s+of\s+)?(?:\d+|one|two|three|five|seven|ten|fifteen|thirty|sixty|ninety)\s+(?:clear\s+)?(?:days?|weeks?|months?)\b/i.test(allText) ||
        /\bon\s+or\s+before\b/i.test(allText) ||
        /\bfailing\s+which,?\s+within\b/i.test(allText);
      const statesConsequence =
        /\bfailing\s+which\b/i.test(allText) ||
        // "Should you fail to concur ... my client shall apply for the
        // appointment of an arbitrator" states a consequence perfectly well.
        /\bshould\s+you\s+fail\b/i.test(allText) ||
        /\bin\s+the\s+event\s+of\s+(?:your\s+)?(?:failure|default)\b/i.test(allText) ||
        /\bin\s+default\s+(?:where)?of\b/i.test(allText) ||
        /\bshall\s+be\s+constrained\s+to\b/i.test(allText) ||
        /\bwithout\s+further\s+(?:notice|reference)\s+to\s+you\b/i.test(allText) ||
        /\blegal\s+proceedings\b/i.test(allText);

      if (!statesDeadline) {
        issues.push({
          rule_id: "NOTICE_STATES_NO_DEADLINE",
          severity: "CRITICAL",
          message: "The notice makes a demand but does not say by when it must be met.",
          statutory_reference: "Negotiable Instruments Act 1881 – S.138 proviso (c)",
          suggestion: "State the period for compliance. Under S.138 the drawer must be given fifteen days from receipt, and a notice that omits the period will not support a complaint.",
        });
      }
      if (!statesConsequence) {
        issues.push({
          rule_id: "NOTICE_STATES_NO_CONSEQUENCE",
          severity: "HIGH",
          message: "The notice does not say what follows if the demand is not met.",
          statutory_reference: "Civil Procedure Code 1908 – S.80(1)",
          suggestion: "State the proceedings that will be taken on non-compliance, so the addressee is on notice of what is intended.",
        });
      }
    }
  } else if (isSwornInstrument) {
    // A sworn or unilateral instrument names one person: the deponent, the
    // obligor, or the executant. There is nobody on the other side.
    const namesExecutant =
      /\b(deponent|obligor|executant|donor|principal|declarant|testator)\b/i.test(allText) ||
      /\bI,\s/.test(allText) ||
      /\bsolemnly\s+(affirm|declare)\b/i.test(allText) ||
      /\bdo\s+hereby\s+(state|declare|bind)\b/i.test(allText);

    if (!namesExecutant) {
      issues.push({
        rule_id: "NO_EXECUTANT_IDENTIFICATION",
        severity: "CRITICAL",
        message: "The instrument does not identify the person executing or swearing it.",
        statutory_reference: "Civil Procedure Code 1908 – Order XIX / Indian Contract Act 1872 – S.10",
        suggestion: "Name the deponent, obligor or executant and state the capacity in which they act.",
      });
    }
  } else if (isPolicyInstrument) {
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
