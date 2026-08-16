/**
 * clauseLocker.js
 * 
 * Protects critical legal boundaries by setting `locked: true` on clauses
 * that should not be touched by the AI `/fix-issue` generator.
 * 
 * Allowed locked tags:
 * - IDENTITY
 * - GOVERNING_LAW / DISPUTE_RESOLUTION
 * - SIGNATURE_BLOCK
 * - LIABILITY_CAP
 */

export function lockCriticalClauses(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  const CORE_CATEGORIES = new Set([
    "IDENTITY",
    "GOVERNING_LAW",
    "DISPUTE_RESOLUTION",
    "SIGNATURE_BLOCK",
    "SIGNATURES",
    "LIABILITY_CAP"
  ]);

  const CORE_CLAUSE_IDS = new Set([
    "CORE_IDENTITY_001",
    "CORE_GOVERNING_LAW_001",
    "CORE_DISPUTE_RESOLUTION_001",
    "CORE_SIGNATURE_BLOCK_001",
    "CORE_LIABILITY_CAP_001",
  ]);

  draft.clauses = draft.clauses.map(clause => {
    if (
      CORE_CATEGORIES.has(clause.category) ||
      CORE_CLAUSE_IDS.has(clause.clause_id)
    ) {
      return {
        ...clause,
        locked: true
      };
    }
    return clause;
  });

  return draft;
}
