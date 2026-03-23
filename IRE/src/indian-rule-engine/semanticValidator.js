/**
 * semanticValidator.js  – v2
 *
 * PREVIOUS PROBLEM: word-match on "lawful", "consideration", "free consent"
 * fired false positives on almost every professionally-drafted document.
 *
 * v2 APPROACH:
 *  - Check for the SUBSTANCE of each doctrine, not a magic keyword.
 *  - Flag actual failure patterns — not absence of specific words.
 *  - Anchored to Indian Contract Act 1872 sections.
 */

export function semanticValidate(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return [
      {
        rule_id: "SEMANTIC_INVALID_DRAFT",
        severity: "CRITICAL",
        message: "Draft is missing or has no clauses array.",
      },
    ];
  }

  const issues = [];
  const text = draft.clauses
    .map((c) => c.text || "")
    .join(" ")
    .toLowerCase();

  // ── ICA s.10 – Free Consent ───────────────────────────────────────────────
  // Only flag if document ACTIVELY waives consent or uses coercive language.
  if (
    /without\s+(the\s+)?consent/.test(text) &&
    !/mutual\s+consent|written\s+consent|prior\s+consent|express\s+consent/.test(
      text
    )
  ) {
    issues.push({
      rule_id: "UNILATERAL_ACTION_WITHOUT_CONSENT",
      severity: "HIGH",
      message:
        "Document permits action 'without consent' without a mutual-consent safeguard — " +
        "free consent risk under ICA 1872, Section 10.",
      statutory_ref: "Indian Contract Act, 1872 – Section 10",
    });
  }

  // ── ICA s.23 – Unlawful Object ────────────────────────────────────────────
  // Flag only if explicitly unlawful language is present.
  const unlawfulPatterns = [
    /forbidden\s+by\s+law/,
    /defeat\s+the\s+provisions\s+of\s+any\s+law/,
    /immoral\s+(purpose|object)/,
    /against\s+public\s+policy/,
    /involves\s+injury\s+to\s+the\s+person/,
  ];
  if (unlawfulPatterns.some((p) => p.test(text))) {
    issues.push({
      rule_id: "UNLAWFUL_OBJECT_DETECTED",
      severity: "CRITICAL",
      message:
        "Document contains language suggesting an unlawful or immoral object/consideration — " +
        "void under ICA 1872, Section 23.",
      statutory_ref: "Indian Contract Act, 1872 – Section 23",
    });
  }

  // ── ICA s.27 – Restraint of Trade ─────────────────────────────────────────
  const hasNonCompete =
    /non.?compete|shall not.*engag|shall not.*work for/i.test(text);
  const hasCarveOut =
    /trade\s+secret|good.?will|intellectual\s+property|proprietary|confidential\s+information|protect.*legitimate.*business/i.test(
      text
    );
  const isPostTerm =
    /after\s+(termination|resignation|separation)|post.?termination/i.test(
      text
    );

  if (hasNonCompete && isPostTerm && !hasCarveOut) {
    issues.push({
      rule_id: "POST_TERMINATION_RESTRAINT_VOID",
      severity: "HIGH",
      message:
        "Post-termination non-compete detected without a trade-secret/goodwill carve-out — " +
        "generally void under ICA 1872, Section 27.",
      statutory_ref: "Indian Contract Act, 1872 – Section 27",
    });
  }

  // ── ICA s.74 – Penalty Clause ─────────────────────────────────────────────
  const hasPenalty =
    /penalty|liquidated\s+damage|pre.?determined\s+amount/i.test(text);
  const hasQualifier =
    /genuine\s+(pre.?estimate|estimate)|reasonable\s+(estimate|compensation)/i.test(
      text
    );

  if (hasPenalty && !hasQualifier) {
    issues.push({
      rule_id: "PENALTY_CLAUSE_UNQUALIFIED",
      severity: "MEDIUM",
      message:
        "Penalty/liquidated damages clause is not qualified as a 'genuine pre-estimate of loss' — " +
        "courts may reduce it under ICA 1872, Section 74.",
      statutory_ref: "Indian Contract Act, 1872 – Section 74",
    });
  }

  // ── ICA s.28 – Absolute Bar on Legal Proceedings ──────────────────────────
  if (
    /no\s+(party|person)\s+shall\s+(bring|file|commence)\s+(any\s+)?(suit|action|proceeding)/i.test(
      text
    )
  ) {
    issues.push({
      rule_id: "ABSOLUTE_BAR_ON_LEGAL_PROCEEDINGS",
      severity: "CRITICAL",
      message:
        "Clause absolutely bars legal proceedings, which is void under ICA 1872, Section 28.",
      statutory_ref: "Indian Contract Act, 1872 – Section 28",
    });
  }

  // ── ICA s.29 – Uncertainty ────────────────────────────────────────────────
  const vagueTerms = draft.clauses.filter((c) => {
    const t = (c.text || "").toLowerCase();
    return (
      (t.includes("to be decided") ||
        t.includes("to be agreed") ||
        t.includes("tbd") ||
        t.includes("as mutually agreed later")) &&
      ["CONSIDERATION", "PURPOSE", "TERM"].includes(c.category)
    );
  });
  if (vagueTerms.length > 0) {
    issues.push({
      rule_id: "AGREEMENT_VOID_FOR_UNCERTAINTY",
      severity: "HIGH",
      message:
        `Key clauses (${vagueTerms
          .map((c) => c.category)
          .join(", ")}) contain deferred/uncertain terms — ` +
        "void for uncertainty under ICA 1872, Section 29.",
      statutory_ref: "Indian Contract Act, 1872 – Section 29",
    });
  }

  // ── Foreign Governing Law ─────────────────────────────────────────────────
  const glClause = draft.clauses.find(
    (c) =>
      c.category === "GOVERNING_LAW" || /governing\s+law/i.test(c.title || "")
  );
  if (glClause) {
    const glText = (glClause.text || "").toLowerCase();
    if (
      /laws?\s+of\s+(england|usa|united\s+states|uae|singapore|uk\b)/i.test(
        glText
      ) &&
      !/laws?\s+of\s+india|india\b/i.test(glText)
    ) {
      issues.push({
        rule_id: "FOREIGN_GOVERNING_LAW",
        severity: "CRITICAL",
        message:
          "Governing law clause specifies a foreign jurisdiction for a domestic contract — " +
          "invalid under ICA 1872 and Constitution Art. 13.",
        statutory_ref:
          "Indian Contract Act, 1872; Constitution of India, Art. 13",
      });
    }
  }

  return issues;
}
