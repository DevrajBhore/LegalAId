// const UNIVERSAL_REQUIRED_CATEGORIES = [
//   "IDENTITY",
//   "PURPOSE",
//   "CONSIDERATION",
//   "TERM",
//   "TERMINATION",
//   "DISPUTE_RESOLUTION",
//   "GOVERNING_LAW",
//   "ENFORCEABILITY",
//   "SIGNATURE_BLOCK"
// ];

const PROTECTED_CATEGORIES = new Set([
  "IDENTITY",
  "GOVERNING_LAW",
  "DISPUTE_RESOLUTION",
  "SIGNATURE_BLOCK",
  "SIGNATURES",
  "LIABILITY_CAP",
]);

const PROTECTED_CLAUSE_IDS = new Set([
  "CORE_IDENTITY_001",
  "CORE_GOVERNING_LAW_001",
  "CORE_DISPUTE_RESOLUTION_001",
  "CORE_SIGNATURE_BLOCK_001",
  "CORE_LIABILITY_CAP_001",
]);

function isProtectedClause(clause = {}) {
  return Boolean(
    clause.locked ||
      PROTECTED_CATEGORIES.has(clause.category) ||
      PROTECTED_CLAUSE_IDS.has(clause.clause_id)
  );
}

export function buildStructuredDraft(aiContent, baseDraft) {
  if (!aiContent || !aiContent.clauses) {
    throw new Error("Invalid AI content structure");
  }

  const clauses = baseDraft.clauses.map((baseClause) => {
    // Never overwrite deterministic legal guardrails with AI text.
    if (isProtectedClause(baseClause)) {
      return baseClause;
    }

    const aiClause = aiContent.clauses.find(
      (clause) => clause.clause_id === baseClause.clause_id
    );

    if (aiClause && aiClause.text && aiClause.text.trim() !== "") {
      return {
        ...baseClause,
        title: aiClause.title || baseClause.title,
        text: aiClause.text,
      };
    }

    return baseClause;
  });

  return {
    document_type: baseDraft.document_type,
    jurisdiction: "India",
    clauses,
  };
}
