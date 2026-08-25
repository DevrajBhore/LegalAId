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
    /forbidden\s+by\s+law/g,
    /defeat\s+the\s+provisions\s+of\s+any\s+law/g,
    /immoral\s+(purpose|object)/g,
    /against\s+public\s+policy/g,
    /involves\s+injury\s+to\s+the\s+person/g,
  ];

  // A well-drafted contract recites compliance with s.23 in the negative -- "the
  // object and consideration are NOT forbidden by law, fraudulent, immoral, or
  // opposed to public policy". Matching the bare phrase flagged that recital as
  // evidence of the very defect it disclaims, and returned CRITICAL on
  // perfectly sound drafting. Only treat a match as a finding when it is not
  // governed by a negation.
  const NEGATORS = /\b(not|nor|never|neither|no|without being|free from|excluding)\b[^.;:]{0,60}$/i;
  const isNegated = (offset) => NEGATORS.test(text.slice(Math.max(0, offset - 80), offset));

  const hasUnlawfulLanguage = unlawfulPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (!isNegated(match.index)) return true;
    }
    return false;
  });

  if (hasUnlawfulLanguage) {
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
  // Section 74 governs a sum the PARTIES stipulate as payable on breach. It has
  // nothing to say about a penalty imposed by a statute, and the bare word
  // "penalty" appears in perfectly sound clauses for exactly that reason -- the
  // stamp-duty clause notes that deficient duty must be made good "together with
  // any penalty", which is the Stamp Act's penalty, not the parties' bargain.
  // Matching the word alone put a MEDIUM finding on every document we generate.
  // "Rs. 10,000" puts a full stop inside the very sentence being matched, so the
  // window is bounded by a sentence BOUNDARY (a stop followed by a capital)
  // rather than by any full stop at all.
  const near = (n) => `(?:(?!\\.\\s+[A-Z])[\\s\\S]){0,${n}}`;
  const STATUTORY_PENALTY = new RegExp(
    `(?:stamp|duty|tax|gst|tds|statutory|registration|regulator|authority|late\\s+filing|non.?compliance)${near(90)}penalt` +
      `|penalt${near(90)}(?:stamp|duty|tax|gst|tds|statute|statutory)`,
    "i"
  );

  // A genuine s.74 clause ties the sum to breach, delay, or termination.
  const CONTRACTUAL_PENALTY = new RegExp(
    `(?:liquidated\\s+damage|pre.?determined\\s+amount)` +
      `|penalt${near(140)}(?:breach|default|delay|failure to|terminat|non.?performance)` +
      `|(?:breach|default|delay|failure to|terminat|non.?performance)${near(140)}penalt`,
    "i"
  );

  const hasPenalty =
    CONTRACTUAL_PENALTY.test(text) && !STATUTORY_PENALTY.test(text);
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
