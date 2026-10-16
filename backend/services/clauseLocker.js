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

import { PROTECTED_CATEGORIES, PROTECTED_CLAUSE_IDS } from "./mutationGuard.js";

export function lockCriticalClauses(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  // One definition, shared with every mutation guard (D4.46).
  const CORE_CATEGORIES = PROTECTED_CATEGORIES;
  const CORE_CLAUSE_IDS = PROTECTED_CLAUSE_IDS;

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
