/**
 * completenessValidator.js
 *
 * Validates structural completeness of the generated document:
 *  1. Unfilled template placeholders (multiple patterns)
 *  2. Purpose/scope clause must be meaningful
 *  3. Party names must not be stubs
 *  4. Minimum clause count sanity check
 *  5. Date consistency
 */

export function completenessValidate(draft) {

  if (!draft?.clauses) return [];

  const issues = [];

  const fullText = draft.clauses
    .map(c => c.text || "")
    .join("\n");

  const fullTextLower = fullText.toLowerCase();

  // ── 1. Unfilled placeholders ─────────────────────────────────────────────
  const PLACEHOLDER_PATTERNS = [
    { regex: /\[[A-Z][A-Z_\s]{2,}\]/g,    label: "uppercase bracket placeholders like [PARTY_NAME]" },
    { regex: /\{\{[^}]+\}\}/g,             label: "double-brace placeholders like {{date}}" },
    { regex: /_{3,}/g,                     label: "blank lines like ___" },  // NOTE: filtered below
    { regex: /<<<[^>]+>>>/g,               label: "angle-bracket placeholders like <<<insert>>>" },
    { regex: /\(\s*_+\s*\)/g,             label: "parenthetical blanks like (_____)" },
    { regex: /\[INSERT\s/i,               label: "[INSERT ...] placeholder" },
    { regex: /\bTBD\b|\bTBA\b/g,          label: "TBD/TBA markers" },
    { regex: /\bXXXX\b|\bYYYY\b/g,        label: "XXXX/YYYY stub markers" },
  ];

  // Exclude signature block clauses from placeholder scan (_____ blanks are intentional)
  const nonSignatureText = draft.clauses
    .filter(c => c.category !== "SIGNATURE_BLOCK" && !c.clause_id?.includes("SIGNATURE"))
    .map(c => c.text || "")
    .join("\n");

  const foundPlaceholders = new Set();

  for (const { regex, label } of PLACEHOLDER_PATTERNS) {
    const searchText = label.includes("blank lines") ? nonSignatureText : fullText;
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(searchText)) !== null) {
      foundPlaceholders.add(match[0].trim().slice(0, 40));
    }
  }

  if (foundPlaceholders.size > 0) {
    const examples = [...foundPlaceholders].slice(0, 5).join(", ");
    issues.push({
      rule_id: "UNFILLED_PLACEHOLDERS",
      severity: "CRITICAL",
      message: `${foundPlaceholders.size} unfilled placeholder(s) detected: ${examples}${foundPlaceholders.size > 5 ? "…" : ""}`,
      suggestion: "Fill all placeholders before the document is considered complete.",
    });
  }

  // ── 2. Purpose clause validation ─────────────────────────────────────────
  // PURPOSE clause OR a definitions/identity clause that implies scope (e.g. NDA definitions)
  const purposeClause = draft.clauses.find(
    c => c.category === "PURPOSE" || c.clause_id?.includes("PURPOSE")
  );
  // IDENTITY clause with WHEREAS recitals counts as scope (covers NDA, bilateral agreements)
  const identityWithScope = draft.clauses.find(
    c => c.category === "IDENTITY" &&
    /whereas|purpose|object of|subject matter|in relation to|pertaining to/i.test(c.text || "")
  );
  // CONFIDENTIALITY clause counts as scope for NDAs
  const confidentialityAsScope = draft.clauses.find(
    c => c.category === "CONFIDENTIALITY" || c.category === "NDA"
  );
  const scopeClause = purposeClause || identityWithScope || confidentialityAsScope;

  if (!scopeClause || !scopeClause.text) {
    issues.push({
      rule_id: "UNDEFINED_SCOPE",
      severity: "HIGH",
      message: "No purpose or scope clause found. The document must clearly state its subject matter.",
      suggestion: "Add a purpose clause explaining what this agreement governs.",
    });
  } else {
    const purposeText = scopeClause.text.toLowerCase();

    const vagueIndicators = [
      "to be decided", "to be determined", "tbd", "to be specified",
      "as agreed", "as mutually decided", "as applicable"
    ];

    const isVague = vagueIndicators.some(v => purposeText.includes(v));
    if (isVague) {
      issues.push({
        rule_id: "UNDEFINED_SCOPE",
        severity: "HIGH",
        message: "Purpose clause is vague or deferred ('TBD', 'as agreed', etc.). The object of the contract must be certain.",
        statutory_reference: "Indian Contract Act 1872 – S.29",
        suggestion: "Replace vague terms with a specific description of the agreement's subject matter.",
      });
    }

    if (scopeClause.text.trim().length < 40) {
      issues.push({
        rule_id: "PURPOSE_CLAUSE_TOO_SHORT",
        severity: "MEDIUM",
        message: "Purpose clause is too brief to adequately define the scope of the agreement.",
        suggestion: "Expand the purpose clause with specific details.",
      });
    }
  }

  // ── 3. Stub party names ───────────────────────────────────────────────────
  const identityClause = draft.clauses.find(c => c.category === "IDENTITY");
  if (identityClause) {
    const identityText = (identityClause.text || "").toLowerCase();
    const stubPatterns = [
      /\bparty\s+a\b/i, /\bparty\s+b\b/i,
      /\bname\s+here\b/i, /\byour\s+name\b/i,
      /\bcompany\s+name\b/i, /\bfull\s+name\b/i,
    ];
    const hasStub = stubPatterns.some(p => p.test(identityText));
    if (hasStub) {
      issues.push({
        rule_id: "STUB_PARTY_NAMES",
        severity: "CRITICAL",
        message: "Party identification clause contains placeholder names ('Party A', 'Name Here', etc.).",
        statutory_reference: "Indian Contract Act 1872 – S.10",
        suggestion: "Replace all stub party names with the full legal names of the contracting parties.",
      });
    }
  }

  // ── 4. Minimum clause count ───────────────────────────────────────────────
  const clauseCount = draft.clauses.length;
  if (clauseCount < 3) {
    issues.push({
      rule_id: "INSUFFICIENT_CLAUSES",
      severity: "HIGH",
      message: `Document has only ${clauseCount} clause(s). A valid contract requires substantially more.`,
      suggestion: "Ensure all required clauses for this document type are included.",
    });
  }

  // ── 5. Absence of both TERM and TERMINATION for contracts ────────────────
  const hasTerm = draft.clauses.some(c =>
    c.category === "TERM" || c.category === "TERMINATION" ||
    c.clause_id?.includes("TERM") || c.clause_id?.includes("TERMINATION")
  );

  // Only flag missing term for bilateral agreements — not for unilateral instruments
  const isUnilateralDoc = /affidavit|power of attorney|will and testament|legal notice|vakalatnama|undertaking|i hereby|i solemnly|testator|deponent/i.test(fullTextLower);
  if (!hasTerm && clauseCount > 3 && !isUnilateralDoc) {
    const isTimebound =
      fullTextLower.includes("months") ||
      fullTextLower.includes("years") ||
      fullTextLower.includes("expire") ||
      fullTextLower.includes("duration");

    if (!isTimebound) {
      issues.push({
        rule_id: "NO_TERM_OR_TERMINATION",
        severity: "MEDIUM",
        message: "No term, duration, or termination clause detected.",
        suggestion: "Specify the duration of the agreement and conditions for termination.",
      });
    }
  }

  return issues;
}