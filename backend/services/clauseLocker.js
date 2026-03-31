/**
 * clauseLocker.js
 * 
 * Protects critical legal boundaries by setting `locked: true` on clauses
 * that should not be touched by the AI `/fix-issue` generator.
 * 
 * Allowed locked tags:
 * - GOVERNING_LAW / DISPUTE_RESOLUTION
 * - SIGNATURE_BLOCK
 * - LIABILITY_CAP
 */

export function lockCriticalClauses(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  const CORE_CATEGORIES = [
    "GOVERNING_LAW",
    "DISPUTE_RESOLUTION",
    "SIGNATURES",
    "LIABILITY_CAP"
  ];

  draft.clauses = draft.clauses.map(clause => {
    if (CORE_CATEGORIES.includes(clause.category)) {
      return {
        ...clause,
        locked: true
      };
    }
    return clause;
  });

  return draft;
}
