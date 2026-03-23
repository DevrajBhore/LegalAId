/**
 * constraintEngine.js
 *
 * Evaluates constraint rules against the clause IDs present in a draft.
 *
 * Bug fixed: original code called registry.constraints (undefined).
 * Constraints are keyed by domain in registry.constraintsByDomain.
 * The documentValidator must pass the correct domain rules here.
 */

/**
 * @param {string[]} presentClauseIds  - clause_ids present in the draft
 * @param {Array}    rules             - constraint rules for the relevant domains
 * @returns {Array}  violations
 */
export function evaluateConstraints(presentClauseIds = [], rules = [], docType = "") {

  if (!Array.isArray(rules) || rules.length === 0) return [];

  const violations = [];

  for (const rule of rules) {

    if (!rule.fails_if || !Array.isArray(rule.fails_if)) continue;

    // Skip if rule is scoped to specific document types and this doc doesn't match
    if (rule.applies_to_doc_types && Array.isArray(rule.applies_to_doc_types)) {
      const docTypeMatch = rule.applies_to_doc_types.some(dt =>
        (docType || "").toUpperCase().includes(dt.toUpperCase()) ||
        dt.toUpperCase().includes((docType || "").toUpperCase())
      );
      if (!docTypeMatch) continue;
    }

    // fails_if semantics: OR logic — fire only when NONE of the listed IDs are present.
    const anyPresent = rule.fails_if.some(
      requiredId => presentClauseIds.includes(requiredId)
    );

    if (!anyPresent) {
      const missingList = rule.fails_if.join(" or ");
      violations.push({
        rule_id  : rule.rule_id,
        severity : rule.severity,
        message  : rule.description || `Required clause missing: ${missingList}`,
        missing_clause_id: rule.fails_if[0],
        statutory_reference: rule.statutory_reference || null,
      });
    }
  }

  return violations;
}
