/**
 * dependencyResolver.js
 * 
 * Ensures logical consistency across assembled clauses by injecting dependencies.
 * Example: If INDEMNITY is present, LIABILITY_CAP is legally required.
 */

import { getKnowledgeBaseStats } from "./clauseAssembler.js";

// Hardcoded logic maps for common legal dependencies. In the future this can move to KB json.
const DEPENDENCY_RULES = [
  {
    trigger_category: "INDEMNIFICATION",
    required_clause_id: "LIABILITY_LIMITATION_01",
    fallback_text: "The aggregate liability of either Party under this Agreement shall not exceed the total fees paid by the respective Party under this Agreement during the twelve (12) months immediately preceding the event giving rise to such liability.",
    title: "Limitation of Liability",
    category: "LIABILITY_CAP"
  },
  {
    trigger_category: "TERMINATION",
    trigger_condition: (draft) => {
      const hasTermination = draft.clauses.some((clause) =>
        String(clause.category || "").toUpperCase().includes("TERMINATION")
      );

      if (!hasTermination) {
        return false;
      }

      const hasNoticeCoverage = draft.clauses.some((clause) => {
        const text = String(clause.text || "");
        const title = String(clause.title || clause.name || "");
        const category = String(clause.category || "").toUpperCase();

        return (
          category === "TERMINATION_NOTICE" ||
          /termination notice/i.test(title) ||
          /written\s+notice|prior\s+written\s+notice|notice\s+period|\b\d+\s*\(?[a-z]*\)?\s*days?\b.*notice/i.test(text)
        );
      });

      return !hasNoticeCoverage;
    },
    required_clause_id: "NOTICE_PERIOD_DEFAULT",
    fallback_text: "Either party may terminate this Agreement without cause by providing a prior written notice of thirty (30) days to the other party.",
    title: "Termination Notice",
    category: "TERMINATION_NOTICE"
  }
];

export function resolveDependencies(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  const existingCategories = new Set(draft.clauses.map(c => c.category));
  const existingClauseIds = new Set(draft.clauses.map(c => c.clause_id));

  let resolvedClauses = [...draft.clauses];

  DEPENDENCY_RULES.forEach(rule => {
    const triggerActivated = rule.trigger_condition 
        ? rule.trigger_condition(draft) 
        : existingCategories.has(rule.trigger_category);

    if (triggerActivated && !existingClauseIds.has(rule.required_clause_id) && !existingCategories.has(rule.category)) {
      // Inject missing dependency
      resolvedClauses.push({
        clause_id: rule.required_clause_id,
        category: rule.category,
        title: rule.title,
        text: rule.fallback_text,
        injected_by: "dependencyResolver"
      });
      existingCategories.add(rule.category);
      existingClauseIds.add(rule.required_clause_id);
    }
  });

  return {
    ...draft,
    clauses: resolvedClauses
  };
}
